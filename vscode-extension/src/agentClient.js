// vscode-extension/src/agentClient.js
//
// The Agent Server WebSocket + REST backfill consumer, the Node/Extension
// Host version -- the same pattern as
// dashboard/src/store/useAgentStore.js, but without Zustand/React (the
// extension host isn't a React UI environment). Shared by statusBar,
// decorations, and ActivityViewProvider via a plain event emitter.

const WebSocket = require("ws");
const { EventEmitter } = require("node:events");
const { reduceState } = require("./reduceState");

const MAX_BACKOFF_MS = 10_000;

class AgentClient extends EventEmitter {
  constructor({ httpBase, wsUrl }) {
    super();
    this.httpBase = httpBase;
    this.wsUrl = wsUrl;

    this.ws = null;
    this.sessionId = null;
    this.status = null;
    this.activeFile = null;
    this.events = [];
    this.connectionStatus = "idle"; // idle | connecting | open | closed | error

    this._backfilling = false;
    this._buffer = [];
    this._retryDelay = 1000;
    this._retryTimer = null;
    this._stopped = false;
  }

  connect() {
    if (this.ws) return; // already connected / connecting
    this._stopped = false;
    this._open();
  }

  disconnect() {
    this._stopped = true;
    if (this._retryTimer) clearTimeout(this._retryTimer);
    if (this.ws) this.ws.close();
    this.ws = null;
  }

  // Called from the "Agent Visualizer: Reconnect" command -- forces a
  // disconnect & reconnect with the delay reset, and discards old state so backfill starts clean.
  reconnectNow() {
    this._stopped = false;
    this._retryDelay = 1000;
    this.sessionId = null;
    this.status = null;
    this.activeFile = null;
    this.events = [];
    if (this._retryTimer) clearTimeout(this._retryTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    } else {
      this._open();
    }
  }

  _open() {
    this._setConnectionStatus("connecting");
    const ws = new WebSocket(this.wsUrl);
    this.ws = ws;

    ws.on("open", () => {
      this._retryDelay = 1000;
      this._setConnectionStatus("open");
    });

    ws.on("message", (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      this._handleMessage(msg);
    });

    ws.on("close", () => {
      this.ws = null;
      this._setConnectionStatus("closed");
      this._scheduleReconnect();
    });

    ws.on("error", (err) => {
      this._setConnectionStatus("error");
      this.emit("error", err);
    });
  }

  _scheduleReconnect() {
    if (this._stopped) return;
    const delay = Math.min(this._retryDelay, MAX_BACKOFF_MS);
    this._retryTimer = setTimeout(() => {
      this._retryDelay = Math.min(delay * 2, MAX_BACKOFF_MS);
      this._open();
    }, delay);
  }

  _setConnectionStatus(s) {
    this.connectionStatus = s;
    this.emit("connection", s);
  }

  async _handleMessage(msg) {
    if (msg.type === "state.snapshot") {
      this.sessionId = msg.session_id ?? this.sessionId;
      this.status = msg.payload?.status ?? null;
      this.activeFile = msg.payload?.activeFile ?? null;
      this._backfilling = true;
      this._buffer = [];
      this.emit("state", this._stateSnapshot());
      if (this.sessionId) await this._backfill(this.sessionId);
      return;
    }

    if (this._backfilling) {
      this._buffer.push(msg);
      return;
    }
    this._appendEvent(msg);
  }

  async _backfill(sessionId) {
    try {
      const res = await fetch(`${this.httpBase}/sessions/${encodeURIComponent(sessionId)}`);
      if (res.ok) {
        const data = await res.json();
        this.events = data.events ?? [];
        this.status = data.snapshot?.status ?? this.status;
        this.activeFile = data.snapshot?.activeFile ?? this.activeFile;
        this.emit("backfill", this.events);
        this.emit("state", this._stateSnapshot());
      }
    } catch (err) {
      this.emit("error", err);
    } finally {
      const buffered = this._buffer;
      this._backfilling = false;
      this._buffer = [];
      for (const event of buffered) this._appendEvent(event);
    }
  }

  _appendEvent(event) {
    const next = reduceState({ status: this.status, activeFile: this.activeFile }, event);
    this.events.push(event);
    this.status = next.status;
    this.activeFile = next.activeFile;
    this.sessionId = this.sessionId ?? event.session_id;
    this.emit("event", event);
    this.emit("state", this._stateSnapshot());
  }

  _stateSnapshot() {
    return { sessionId: this.sessionId, status: this.status, activeFile: this.activeFile };
  }
}

module.exports = { AgentClient };
