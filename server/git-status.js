// server/git-status.js
//
// Git status badge (A/M/D/?) in the "Project Files" panel -- purely runs
// `git status` in whichever project folder is being watched, NOT calling
// any LLM.
//
// IMPORTANT: the project being watched (via the `cwd` the hook sends) can be
// a COMPLETELY DIFFERENT repo from this Agent Server's own repo (e.g. you
// run the Agent Server from the agentwork folder, but are watching a Claude
// Code session in the "sirkasir" project) -- so its git root has to be found
// from the path currently being browsed, not assumed to be the Agent
// Server's own process.cwd().

const { execFileSync } = require("node:child_process");
const path = require("node:path");

function findGitRoot(dirPath) {
  try {
    const out = execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: dirPath,
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 3000,
    });
    return out.toString("utf8").trim();
  } catch {
    return null; // not a git repo, or git isn't installed -- expected, not an error
  }
}

// Parses `git status --porcelain=v1`: 2-character status code + space + path
// (relative to the repo root). Simplified into a single letter that's easy
// to map to a badge color: "A" (added/newly staged), "M" (modified), "D"
// (deleted), "?" (untracked). For a rename ("R  old -> new") we just take
// the new path.
function parsePorcelain(output) {
  const map = new Map();
  for (const rawLine of output.split("\n")) {
    if (!rawLine.trim()) continue;
    const code = rawLine.slice(0, 2);
    let filePath = rawLine.slice(3).trim();
    const arrowIdx = filePath.indexOf(" -> ");
    if (arrowIdx !== -1) filePath = filePath.slice(arrowIdx + 4);

    let status = "M";
    if (code.includes("?")) status = "?";
    else if (code.includes("A")) status = "A";
    else if (code.includes("D")) status = "D";
    else if (code.includes("M")) status = "M";

    map.set(filePath.replace(/\\/g, "/"), status);
  }
  return map;
}

// null if `dirPath` isn't part of any git repo (or git isn't on PATH) -- the
// caller should treat that as a normal condition, not an error, and just
// show no badge at all.
function readGitStatus(dirPath) {
  const root = findGitRoot(dirPath);
  if (!root) return null;
  try {
    const out = execFileSync("git", ["status", "--porcelain=v1"], {
      cwd: root,
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { root, statusByPath: parsePorcelain(out.toString("utf8")) };
  } catch {
    return null;
  }
}

// Look up the status of `absoluteFilePath` relative to `gitStatus.root`.
// Used by buildTree() while assembling nodes -- see server/fs-utils.js.
function lookupStatus(gitStatus, absoluteFilePath) {
  if (!gitStatus) return null;
  const rel = path.relative(gitStatus.root, absoluteFilePath).replace(/\\/g, "/");
  return gitStatus.statusByPath.get(rel) ?? null;
}

module.exports = { findGitRoot, readGitStatus, lookupStatus };
