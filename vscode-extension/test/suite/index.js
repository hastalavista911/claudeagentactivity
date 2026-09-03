const path = require("node:path");
const Mocha = require("mocha");
const { glob } = require("glob");

function run() {
  const mocha = new Mocha({ ui: "tdd", color: true, timeout: 20000 });
  const testsRoot = __dirname;

  return glob("**/*.test.js", { cwd: testsRoot }).then((files) => {
    files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));
    return new Promise((resolve, reject) => {
      try {
        mocha.run((failures) => {
          if (failures > 0) reject(new Error(`${failures} test gagal.`));
          else resolve();
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}

module.exports = { run };
