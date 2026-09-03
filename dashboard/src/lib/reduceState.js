// dashboard/src/lib/reduceState.js
//
// DELIBERATE duplicate of server/session-store.js's `reduceState()`. The
// dashboard is a consumer (design principle section 2: "the server is the
// single source of truth"), but the WebSocket only sends `state.snapshot`
// ONCE on connect (see section 6) -- after that the client receives raw
// events one at a time and has to derive `currentState` itself in a way
// identical to the server, so the status/activeFile shown always stays in
// sync with what the Agent Server holds.
//
// IMPORTANT: if reduceState() in server/session-store.js changes, change it
// here too. (First candidate to move into a `shared/` package if this
// project grows.)

export function reduceState(state, event) {
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
