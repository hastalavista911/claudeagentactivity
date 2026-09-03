// vscode-extension/test/runTest.js
//
// GENUINE runtime validation (not just a syntax check): activates this
// extension in a headless VS Code test instance via
// @vscode/test-electron, so a `vscode.*` API misuse that only shows up
// when actually running gets caught.

const path = require("node:path");
const { runTests } = require("@vscode/test-electron");

async function main() {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, "..");
    const extensionTestsPath = path.resolve(__dirname, "./suite/index.js");
    await runTests({ extensionDevelopmentPath, extensionTestsPath });
  } catch (err) {
    console.error("Gagal menjalankan test extension:", err);
    process.exit(1);
  }
}

main();
