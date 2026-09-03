// vscode-extension/src/activityViewProvider.js
//
// A sidebar panel (appears below Explorer) that shows a raw event log,
// similar to the dashboard but a lightweight version without React Flow --
// just a list of the newest events on top. The webview content is plain
// vanilla HTML/CSS/JS (not React) so no bundling is needed inside the extension.

const vscode = require("vscode");

class ActivityViewProvider {
  constructor(agentClient) {
    this.agentClient = agentClient;
    this._view = null;
  }

  resolveWebviewView(webviewView) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this._html();

    this._onEvent = (event) => this._post({ type: "event", event });
    this._onState = (state) =>
      this._post({
        type: "state",
        state: { ...state, connectionStatus: this.agentClient.connectionStatus },
      });
    this._onBackfill = () => this._postBackfill();
    this._onConnection = () =>
      this._post({
        type: "state",
        state: {
          sessionId: this.agentClient.sessionId,
          status: this.agentClient.status,
          activeFile: this.agentClient.activeFile,
          connectionStatus: this.agentClient.connectionStatus,
        },
      });

    this.agentClient.on("event", this._onEvent);
    this.agentClient.on("state", this._onState);
    this.agentClient.on("backfill", this._onBackfill);
    this.agentClient.on("connection", this._onConnection);

    // The panel can be opened after the client already connected earlier -- send the current state.
    this._onConnection();
    this._postBackfill();

    webviewView.onDidDispose(() => {
      this.agentClient.off("event", this._onEvent);
      this.agentClient.off("state", this._onState);
      this.agentClient.off("backfill", this._onBackfill);
      this.agentClient.off("connection", this._onConnection);
    });
  }

  _post(msg) {
    this._view?.webview.postMessage(msg);
  }

  _postBackfill() {
    this._post({ type: "backfill", events: this.agentClient.events });
  }

  _html() {
    const nonce = String(Date.now());
    return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
<style>
  body {
    font-family: var(--vscode-font-family);
    font-size: 12px;
    color: var(--vscode-foreground);
    padding: 6px 8px;
    margin: 0;
  }
  #header {
    display: flex;
    justify-content: space-between;
    opacity: 0.75;
    margin-bottom: 6px;
  }
  .event {
    padding: 4px 6px;
    margin-bottom: 4px;
    border-left: 3px solid var(--border-color, #64748b);
    background: var(--vscode-editorWidget-background);
    border-radius: 2px;
  }
  .event .row { display: flex; justify-content: space-between; gap: 6px; }
  .event .label { font-weight: 600; }
  .event .time { opacity: 0.6; font-size: 11px; white-space: nowrap; }
  .event .detail {
    opacity: 0.8;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .running { --border-color: #f59e0b; }
  .success { --border-color: #22c55e; }
  .error { --border-color: #ef4444; }
  .info { --border-color: #64748b; }
  #empty { opacity: 0.6; padding: 8px 0; }
</style>
</head>
<body>
<div id="header"><span id="conn">idle</span><span id="count">0 event</span></div>
<div id="list"></div>
<div id="empty">Belum ada event. Jalankan mock-agent atau tunggu hook Claude Code.</div>
<script nonce="${nonce}">
  const list = document.getElementById("list");
  const empty = document.getElementById("empty");
  const connEl = document.getElementById("conn");
  const countEl = document.getElementById("count");
  let events = [];

  function describeEvent(event) {
    const payload = event.payload || {};
    switch (event.type) {
      case "agent.start": return { label: "Agent Start", detail: "", variant: "info" };
      case "agent.thinking": return { label: "Thinking…", detail: "", variant: "running" };
      case "agent.complete": return { label: "Complete", detail: payload.status || "", variant: payload.status === "success" ? "success" : "error" };
      case "agent.error": return { label: "Error", detail: payload.message || "", variant: "error" };
      case "file.read": return { label: "Read", detail: payload.file || "", variant: "info" };
      case "file.edit": return { label: payload.status === "running" ? "Editing…" : "Edited", detail: payload.file || "", variant: payload.status === "running" ? "running" : "success" };
      case "terminal.start": return { label: "Run", detail: payload.command || "", variant: "running" };
      case "terminal.output": return { label: "Output", detail: payload.line || "", variant: "info" };
      case "terminal.complete": {
        const hasExit = payload.exit_code !== undefined;
        return { label: "Terminal Done", detail: hasExit ? "exit code " + payload.exit_code : (payload.output || ""), variant: hasExit ? (payload.exit_code === 0 ? "success" : "error") : "info" };
      }
      default: return { label: event.type, detail: "", variant: "info" };
    }
  }

  function render() {
    countEl.textContent = events.length + " event";
    empty.style.display = events.length === 0 ? "block" : "none";
    list.innerHTML = events.slice().reverse().map(function (event) {
      const info = describeEvent(event);
      const time = event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : "";
      return '<div class="event ' + info.variant + '">'
        + '<div class="row"><span class="label">' + info.label + '</span><span class="time">' + time + '</span></div>'
        + (info.detail ? '<div class="detail" title="' + escapeHtml(info.detail) + '">' + escapeHtml(info.detail) + '</div>' : '')
        + '</div>';
    }).join("");
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  window.addEventListener("message", (ev) => {
    const msg = ev.data;
    if (msg.type === "backfill") {
      events = msg.events || [];
      render();
    } else if (msg.type === "event") {
      events.push(msg.event);
      render();
    } else if (msg.type === "state") {
      connEl.textContent = msg.state.connectionStatus || "idle";
    }
  });
</script>
</body>
</html>`;
  }
}

module.exports = { ActivityViewProvider };
