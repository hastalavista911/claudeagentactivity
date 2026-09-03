// vscode-extension/src/statusBar.js

const vscode = require("vscode");

const ICON_BY_STATUS = {
  thinking: "$(sync~spin)",
  running: "$(sync~spin)",
  completed: "$(check)",
  error: "$(error)",
};

function createStatusBar() {
  const item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  item.name = "AI Agent Activity Visualizer";
  item.command = "agentVisualizer.focusActiveFile";
  item.text = "$(circle-outline) Agent: idle";
  item.show();
  return item;
}

function updateStatusBar(item, { connectionStatus, status, activeFile }) {
  if (connectionStatus !== "open") {
    const label = connectionStatus === "connecting" ? "menghubungkan…" : "terputus";
    item.text = `$(debug-disconnect) Agent: ${label}`;
    item.tooltip = `Agent Server: ${connectionStatus}. Klik command "Agent Visualizer: Reconnect" untuk coba lagi.`;
    return;
  }

  const icon = ICON_BY_STATUS[status] ?? "$(circle-outline)";
  const label = status ?? "idle";
  const fileLabel = activeFile ? ` — ${basename(activeFile)}` : "";
  item.text = `${icon} Agent: ${label}${fileLabel}`;
  item.tooltip = activeFile
    ? `Active file: ${activeFile}\nKlik untuk buka file ini.`
    : "AI Agent Activity Visualizer — terhubung, belum ada aktivitas file.";
}

function basename(filePath) {
  return filePath.replace(/\\/g, "/").split("/").pop();
}

module.exports = { createStatusBar, updateStatusBar };
