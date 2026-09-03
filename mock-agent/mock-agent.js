// mock-agent/mock-agent.js
//
// Mimics what hooks/emit-event.js will eventually do — POST directly to the
// Agent Server's /events endpoint, without needing Claude Code active.
// The scenario follows architecture-design.md section 5 exactly.

const SERVER_URL = process.env.AGENT_SERVER_URL
  ? `${process.env.AGENT_SERVER_URL}/events`
  : "http://localhost:4000/events";

// Unique per run -- so every time mock-agent is run again, the server's
// SessionStore (keyed per session_id) creates a NEW entry, instead of
// piling events onto an old one. The dashboard/extension also then knows
// this is a new session (see useAgentStore.js).
const SESSION_ID = `mock-session-${crypto.randomUUID()}`;

async function emit(type, payload = {}) {
  console.log(`-> emit ${type}`, payload);
  const res = await fetch(SERVER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: SESSION_ID, type, timestamp: Date.now(), payload }),
  });
  if (!res.ok) {
    console.error(`   !! server responded ${res.status} for ${type}`);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runMockAgent() {
  console.log(`Mock agent mulai, session_id=${SESSION_ID}, target=${SERVER_URL}`);

  await emit("agent.start");
  await sleep(2000);

  await emit("agent.thinking");
  await sleep(2000);

  await emit("file.read", { file: "app/Models/User.php" });
  await sleep(1000);

  await emit("file.edit", { file: "app/Controllers/User.php", line_start: 42, line_end: 48, status: "running" });
  await sleep(2000);
  await emit("file.edit", { file: "app/Controllers/User.php", line_start: 42, line_end: 48, status: "done" });

  await emit("terminal.start", { command: "php spark test" });
  await sleep(1500);
  await emit("terminal.output", { line: "✓ UserTest" });
  await emit("terminal.output", { line: "✗ PaymentTest" });
  await emit("terminal.complete", { exit_code: 1 });

  await emit("agent.error", { message: "PaymentTest failed" });
  await sleep(1000);

  await emit("agent.thinking");
  await sleep(1500);
  await emit("file.edit", { file: "app/Controllers/User.php", line_start: 42, line_end: 48, status: "running" });
  await sleep(1500);
  await emit("file.edit", { file: "app/Controllers/User.php", line_start: 42, line_end: 48, status: "done" });

  await emit("terminal.start", { command: "php spark test" });
  await sleep(1000);
  await emit("terminal.complete", { exit_code: 0 });

  await emit("agent.complete", { status: "success" });

  console.log("Mock agent selesai.");
}

runMockAgent().catch((err) => {
  console.error("Mock agent gagal:", err);
  process.exit(1);
});
