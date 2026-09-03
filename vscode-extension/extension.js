// vscode-extension/extension.js
//
// Entry point. This extension is SEPARATE from the Claude Code extension
// itself (see architecture-design.md section 3, "crucial point") -- it's
// just a WebSocket consumer of the same Agent Server as the dashboard, it
// doesn't touch Claude Code's internals at all.

const vscode = require("vscode");
const { AgentClient } = require("./src/agentClient");
const { createStatusBar, updateStatusBar } = require("./src/statusBar");
const { createDecorationType, applyHighlight } = require("./src/decorations");
const { ActivityViewProvider } = require("./src/activityViewProvider");

function activate(context) {
  const config = vscode.workspace.getConfiguration("agentVisualizer");
  const client = new AgentClient({
    httpBase: config.get("httpUrl", "http://localhost:4000"),
    wsUrl: config.get("wsUrl", "ws://localhost:4000"),
  });

  const statusBarItem = createStatusBar();
  const decorationType = createDecorationType();
  let currentHighlightTarget = null;

  function refreshHighlight() {
    applyHighlight(decorationType, currentHighlightTarget);
  }

  function refreshStatusBar() {
    updateStatusBar(statusBarItem, {
      connectionStatus: client.connectionStatus,
      status: client.status,
      activeFile: client.activeFile,
    });
  }

  client.on("connection", refreshStatusBar);
  client.on("state", refreshStatusBar);

  client.on("event", (event) => {
    const payload = event.payload ?? {};
    if (event.type === "file.edit") {
      currentHighlightTarget =
        payload.status === "running"
          ? { file: payload.file, lineStart: payload.line_start, lineEnd: payload.line_end }
          : null;
      refreshHighlight();
    } else if (event.type === "agent.complete" || event.type === "agent.error") {
      currentHighlightTarget = null;
      refreshHighlight();
    }
  });

  client.on("error", (err) => {
    console.error("[agent-activity-visualizer]", err);
  });

  const activityProvider = new ActivityViewProvider(client);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("agentVisualizer.activityView", activityProvider)
  );

  context.subscriptions.push(vscode.window.onDidChangeVisibleTextEditors(() => refreshHighlight()));

  context.subscriptions.push(
    vscode.commands.registerCommand("agentVisualizer.reconnect", () => {
      client.reconnectNow();
      vscode.window.showInformationMessage("Agent Visualizer: mencoba reconnect ke Agent Server…");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("agentVisualizer.focusActiveFile", async () => {
      if (!client.activeFile) {
        vscode.window.showInformationMessage("Belum ada file aktif dari agent.");
        return;
      }
      try {
        const doc = await vscode.workspace.openTextDocument(client.activeFile);
        await vscode.window.showTextDocument(doc);
      } catch (err) {
        vscode.window.showWarningMessage(`Agent Visualizer: tidak bisa membuka file — ${err.message}`);
      }
    })
  );

  refreshStatusBar();
  client.connect();

  context.subscriptions.push({
    dispose() {
      client.disconnect();
      statusBarItem.dispose();
      decorationType.dispose();
    },
  });

  // Exposed via `extension.exports` -- used by test/suite (not a public
  // API for other consumers, just for runtime testing without needing the UI).
  return { client, statusBarItem };
}

function deactivate() {}

module.exports = { activate, deactivate };
