// vscode-extension/src/reduceState.js
//
// DELIBERATE duplicate of server/session-store.js's `reduceState()` -- same
// reason as dashboard/src/lib/reduceState.js: the WebSocket only sends
// `state.snapshot` once on connect, after that the extension has to derive
// currentState itself from raw events, in a way identical to the server.
//
// IMPORTANT: if reduceState() in server/session-store.js changes, change it
// here too (and in dashboard/src/lib/reduceState.js). First candidate to
// move into a `shared/` package if this project grows -- there are now 3 copies.

function reduceState(state, event) {
  switch (event.type) {
    case "file.edit":
      return { ...state, activeFile: event.payload.file, status: event.payload.status };
    case "agent.thinking":
      return { ...state, status: "thinking" };
    case "agent.complete":
      return { ...state, status: "completed" };
    default:
      return state;
  }
}

module.exports = { reduceState };
