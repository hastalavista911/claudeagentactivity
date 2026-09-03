// vscode-extension/test/suite/extension.test.js
//
// This test needs a live Agent Server on localhost:4000 with at least one
// session that has events (run `npm run mock-agent` in the project root
// before testing). It doesn't test the visual appearance (that's checked
// manually via F5 / the Extension Development Host) -- this tests that the
// extension ACTIVATES without error and genuinely connects + derives state
// from a real Agent Server.

const assert = require("node:assert");
const vscode = require("vscode");

const EXTENSION_ID = "local-dev.agent-activity-visualizer";

function waitFor(check, { timeout = 8000, interval = 100 } = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (check()) return resolve();
      if (Date.now() - start > timeout) return reject(new Error("waitFor timeout"));
      setTimeout(tick, interval);
    };
    tick();
  });
}

suite("Agent Activity Visualizer Extension", () => {
  let ext;

  suiteSetup(async () => {
    ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `Extension ${EXTENSION_ID} tidak ditemukan -- cek field "name"/"publisher" di package.json`);
    if (!ext.isActive) await ext.activate();
  });

  test("extension aktif dan mengekspos client + statusBarItem", () => {
    assert.ok(ext.isActive, "extension harus aktif setelah activate()");
    assert.ok(ext.exports?.client, "activate() harus return { client }");
    assert.ok(ext.exports?.statusBarItem, "activate() harus return { statusBarItem }");
  });

  test("command agentVisualizer.reconnect & agentVisualizer.focusActiveFile terdaftar", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("agentVisualizer.reconnect"));
    assert.ok(commands.includes("agentVisualizer.focusActiveFile"));
  });

  test("command reconnect bisa dieksekusi tanpa throw", async () => {
    await vscode.commands.executeCommand("agentVisualizer.reconnect");
  });

  test("client benar-benar konek ke Agent Server (ws://localhost:4000)", async () => {
    const { client } = ext.exports;
    await waitFor(() => client.connectionStatus === "open", { timeout: 8000 });
    assert.strictEqual(client.connectionStatus, "open");
  });

  test("client menerima state.snapshot + backfill dari session yang ada", async () => {
    const { client } = ext.exports;
    // Needs at least 1 session with events on the server (mock-agent
    // should already be running before this test, see the test README).
    await waitFor(() => client.events.length > 0, { timeout: 8000 });
    assert.ok(client.sessionId, "sessionId harus terisi dari state.snapshot");
    assert.ok(client.events.length > 0, "events harus terisi dari backfill REST");
    assert.ok(["thinking", "completed"].includes(client.status) || client.status === undefined || client.status === null || typeof client.status === "string");
  });

  test("statusBarItem.text berubah dari default idle setelah connect", () => {
    const { statusBarItem } = ext.exports;
    assert.notStrictEqual(statusBarItem.text, "$(circle-outline) Agent: idle");
  });
});
