// server/fs-utils.js
//
// Read files & list folders DIRECTLY from disk -- no LLM call at all, just
// plain fs. Used for the "VS Code Preview" & "Project Files" panels in the
// dashboard (UI reference requested by the user on 2026-08-27).
//
// This server runs locally for personal use (not a public API), so there's
// no strict path sandboxing -- but file size and skipped folders are still
// bounded, to avoid accidentally reading a huge file or a node_modules that
// would slow things down.

const fs = require("node:fs");
const path = require("node:path");
const { lookupStatus } = require("./git-status");

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB, plenty for a normal code file
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".vscode-test",
  ".next",
  "__pycache__",
  ".venv",
]);

function readFileSafe(filePath) {
  const stat = fs.statSync(filePath); // throws ENOENT if missing -- caught by the caller
  if (!stat.isFile()) throw new Error("path bukan file");
  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(`file terlalu besar untuk preview (${stat.size} bytes, maks ${MAX_FILE_SIZE})`);
  }
  return fs.readFileSync(filePath, "utf8");
}

// `gitStatus` is optional (from server/git-status.js readGitStatus()) --
// null if the folder being browsed isn't part of a git repo, which is
// expected (not every project being watched uses git). When present, each
// file node gets a `gitStatus: "M"/"A"/"D"/"?"` attached, for the badge in
// FileTreePanel.
function buildTree(rootPath, maxDepth = 3, gitStatus = null) {
  function walk(currentPath, depthLeft) {
    const stat = fs.statSync(currentPath);
    const name = path.basename(currentPath) || currentPath;

    if (!stat.isDirectory()) {
      const node = { name, type: "file" };
      const status = lookupStatus(gitStatus, currentPath);
      if (status) node.gitStatus = status;
      return node;
    }
    if (IGNORED_DIRS.has(name)) return null;
    if (depthLeft <= 0) return { name, type: "dir", children: [], truncated: true };

    const children = fs
      .readdirSync(currentPath)
      .map((child) => {
        try {
          return walk(path.join(currentPath, child), depthLeft - 1);
        } catch {
          return null; // broken symlink, permission denied, etc. -- skip silently
        }
      })
      .filter(Boolean)
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));

    return { name, type: "dir", children };
  }

  return walk(rootPath, maxDepth);
}

module.exports = { readFileSafe, buildTree };
