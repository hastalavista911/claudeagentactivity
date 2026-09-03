// vscode-extension/src/decorations.js
//
// Highlights the line the agent is currently editing in an open editor.
// Needs payload.line_start/line_end on a `file.edit` event -- currently
// only mock-agent sends that (doc section 5). The REAL hooks/emit-event.js
// doesn't yet extract a line range from Claude Code (Edit's tool_input
// doesn't always have an explicit line number; it could be derived from
// tool_response.structuredPatch on PostToolUse if this gets developed
// further later). If line_start/line_end is missing, the extension doesn't
// highlight anything -- rather than showing a wrong/guessed position.

const vscode = require("vscode");

function createDecorationType() {
  return vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor("editor.findMatchHighlightBackground"),
    isWholeLine: true,
    overviewRulerColor: new vscode.ThemeColor("editorOverviewRuler.findMatchForeground"),
    overviewRulerLane: vscode.OverviewRulerLane.Full,
  });
}

/**
 * @param {vscode.TextEditorDecorationType} decorationType
 * @param {{file: string, lineStart?: number, lineEnd?: number} | null} target
 */
function applyHighlight(decorationType, target) {
  for (const editor of vscode.window.visibleTextEditors) {
    if (!target || !target.lineStart || !filesMatch(editor.document.uri.fsPath, target.file)) {
      editor.setDecorations(decorationType, []);
      continue;
    }
    const startLine = Math.max(target.lineStart - 1, 0);
    const endLine = Math.max((target.lineEnd ?? target.lineStart) - 1, startLine);
    const range = new vscode.Range(startLine, 0, endLine, 0);
    editor.setDecorations(decorationType, [range]);
  }
}

function filesMatch(fsPath, eventFile) {
  if (!eventFile) return false;
  const normA = fsPath.replace(/\\/g, "/").toLowerCase();
  const normB = eventFile.replace(/\\/g, "/").toLowerCase();
  return normA === normB || normA.endsWith(`/${normB}`) || normB.endsWith(`/${normA}`);
}

module.exports = { createDecorationType, applyHighlight };
