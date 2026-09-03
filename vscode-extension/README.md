# AI Agent Activity Visualizer — VS Code Extension

An extension that is **separate** from the Claude Code extension itself (see
section 3 of `architecture-design.md`, "crucial point"). This extension is
just a WebSocket *consumer* of the same Agent Server the dashboard uses — it
never touches or modifies the Claude Code extension in any way.

## Features

- **Status bar item** (bottom right): current agent status (`thinking` /
  `completed` / etc.) + active file name. Click to open that file.
- **Line highlighting** in the editor for the line range the agent is
  currently editing (needs `payload.line_start`/`line_end` on the
  `file.edit` event — see the limitation note below).
- **"Agent Activity" sidebar panel** in the Explorer: a real-time event log,
  like a lightweight version of the dashboard without the graph.
- `Agent Visualizer: Reconnect to Agent Server` command.
- `Agent Visualizer: Open File the Agent Is Currently Working On` command.

## Manual testing (F5)

1. Make sure the Agent Server is running: `npm run server` from the project
   root.
2. Generate some data to try it with: `npm run mock-agent` from the project
   root.
3. Open the `vscode-extension/` folder as the workspace root in VS Code (or
   open `agentwork/` and make sure `vscode-extension` is set as the
   `extensionDevelopmentPath` when you hit F5 — the simplest route is to
   open the `vscode-extension/` folder directly).
4. Press **F5** (or Run → Start Debugging) → a new "Extension Development
   Host" window opens.
5. In that new window, check:
   - The bottom-right status bar shows the agent's status (no longer "Agent:
     idle" once the Agent Server has data).
   - The **Agent Activity** panel in the Explorer sidebar (near the bottom,
     may need scrolling/expanding) shows the event log.
   - Command palette (`Ctrl+Shift+P`) → search "Agent Visualizer" → try the
     Reconnect command.

## Configuration

In `settings.json` (workspace or user):

```json
{
  "agentVisualizer.httpUrl": "http://localhost:4000",
  "agentVisualizer.wsUrl": "ws://localhost:4000"
}
```

## Known limitations

- ~~Line highlighting only works with mock-agent~~ — **fixed on
  2026-08-27**: `hooks/emit-event.js` now derives `line_start`/`line_end`
  from `tool_response.structuredPatch` on the `post-edit` event (see
  `diffStats()` in that file). Line highlighting now works for real Claude
  Code hooks too, not just mock-agent.
- Automated tests (`test/runTest.js`, via `@vscode/test-electron`) were
  attempted but hit a Windows-specific issue (`Code.exe` rejects every CLI
  flag) — unresolved. Validation that did pass: syntax checks on every file
  (`node --check`) and manifest validation (`npx @vscode/vsce ls`). Actual
  runtime validation is still manual, via F5.

## Structure

```
extension.js                    # activate()/deactivate(), wires everything together
src/
  agentClient.js                 # WS connect + REST backfill + reconnect (same pattern as the dashboard)
  reduceState.js                  # duplicate of the server's reduceState() (state.snapshot only fires once)
  statusBar.js
  decorations.js
  activityViewProvider.js         # WebviewViewProvider for the sidebar panel
test/
  runTest.js, suite/               # automated test (see the limitation note above)
```
