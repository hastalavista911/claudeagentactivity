// server/git-info.js
//
// Data for the "Git" panel (read-only, independent of Activity Flow -- see
// dashboard/src/components/GitPanel.jsx). DELIBERATELY only runs git
// commands that DO NOT CHANGE anything in the repo: `status`, `diff`, `log`.
// There is NO and must NEVER BE a command that mutates repo state
// (commit/push/pull/checkout/reset/etc.) -- that's outside this
// observability tool's scope.
//
// Every command goes through execFileSync with an argument array (NOT a
// manually concatenated string) -- that's what prevents command injection
// even though `file`/`path` come from the client's request, the same safe
// pattern as server/git-status.js.

const { execFileSync } = require("node:child_process");
const { findGitRoot } = require("./git-status");

function runGit(root, args, options = {}) {
  return execFileSync("git", args, {
    cwd: root,
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 5000,
    maxBuffer: 10 * 1024 * 1024,
    encoding: "utf8",
    ...options,
  });
}

// {root: null} if startPath isn't part of any git repo -- that's a NORMAL
// condition (plenty of projects don't use git), not an error.
function getStatus(startPath) {
  const root = findGitRoot(startPath);
  if (!root) return { root: null };
  let out;
  try {
    out = runGit(root, ["status", "--porcelain=v1"]);
  } catch {
    return { root, staged: [], modified: [], untracked: [], error: "gagal jalankan git status" };
  }

  const staged = [];
  const modified = [];
  const untracked = [];
  for (const line of out.split("\n")) {
    if (!line.trim()) continue;
    const indexChar = line[0];
    const worktreeChar = line[1];
    let filePath = line.slice(3);
    const arrowIdx = filePath.indexOf(" -> ");
    if (arrowIdx !== -1) filePath = filePath.slice(arrowIdx + 4); // rename -- take the new name
    filePath = filePath.replace(/\\/g, "/");

    if (indexChar === "?" && worktreeChar === "?") {
      untracked.push({ file: filePath });
      continue;
    }
    // One file can be both staged AND modified at the same time (e.g. "MM"
    // -- already staged, then edited again) -- that's genuine `git status`
    // behavior, deliberately not forced into a single category.
    if (indexChar !== " " && indexChar !== "?") staged.push({ file: filePath, code: indexChar });
    if (worktreeChar === "M" || worktreeChar === "D") modified.push({ file: filePath, code: worktreeChar });
  }
  return { root, staged, modified, untracked };
}

// `staged`: true -> diff from the index (`--cached`), false -> diff from the
// working tree. An UNTRACKED file has no baseline to diff against at all --
// that's flagged explicitly, not silently treated as an empty diff.
function getDiff(startPath, file, staged) {
  const root = findGitRoot(startPath);
  if (!root) return { root: null };
  const args = staged ? ["diff", "--cached", "--", file] : ["diff", "--", file];
  try {
    const diff = runGit(root, args);
    return { root, file, diff, untracked: false };
  } catch (err) {
    return { root, file, diff: "", untracked: false, error: err.message };
  }
}

// Last ~20 commits. A repo that has NEVER had a commit makes `git log` exit
// with an error code (not empty output) -- caught and treated as "no
// commits yet", not a display error.
function getLog(startPath, limit = 20) {
  const root = findGitRoot(startPath);
  if (!root) return { root: null };
  // %x1f/%x1e = unit/record separator -- a delimiter that's nearly
  // impossible to appear in a real commit message, so it's safe to split on
  // without accidentally cutting things wrong if the commit message itself
  // happens to contain "|" or other common characters.
  const format = "%H%x1f%h%x1f%an%x1f%ar%x1f%s%x1e";
  try {
    const out = runGit(root, ["log", `-n`, String(limit), `--pretty=format:${format}`]);
    const commits = out
      .split("\x1e")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((rec) => {
        const [hash, shortHash, author, relDate, subject] = rec.split("\x1f");
        return { hash, shortHash, author, relDate, subject };
      });
    return { root, commits };
  } catch {
    return { root, commits: [] }; // expected for a fresh repo with no commits at all
  }
}

// List of files changed in ONE commit (for expanding a HistoryTab row when
// clicked -- see dashboard GitPanel.jsx). `git show --name-status` with
// --pretty=format: empty so the output is just the file list, no commit
// header (that's already shown in HistoryTab from getLog()).
function getCommitFiles(startPath, hash) {
  const root = findGitRoot(startPath);
  if (!root) return { root: null };
  if (!/^[0-9a-f]{4,40}$/i.test(hash)) return { root, hash, files: [], error: "hash tidak valid" };
  try {
    const out = runGit(root, ["show", "--name-status", "--pretty=format:", hash]);
    const files = out
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        // A rename/copy line is formatted "R100\told\tnew" -- take the NEW
        // name & just the short "R" code, everything else is plain
        // "M\tfile" / "A\tfile" / "D\tfile".
        const parts = line.split("\t");
        const code = parts[0][0];
        const file = parts[parts.length - 1].replace(/\\/g, "/");
        return { file, code };
      });
    return { root, hash, files };
  } catch (err) {
    return { root, hash, files: [], error: err.message };
  }
}

// Diff for ONE file EXACTLY as that commit introduced it -- different from
// getDiff() (working-tree/staged diff against the current HEAD). `git show`
// without an explicit parent automatically uses that commit's first parent
// as the comparison, including for the repo's very first commit (compared
// against an empty tree).
function getCommitFileDiff(startPath, hash, file) {
  const root = findGitRoot(startPath);
  if (!root) return { root: null };
  if (!/^[0-9a-f]{4,40}$/i.test(hash)) return { root, hash, file, diff: "", error: "hash tidak valid" };
  try {
    const diff = runGit(root, ["show", "--pretty=format:", hash, "--", file]);
    return { root, hash, file, diff };
  } catch (err) {
    return { root, hash, file, diff: "", error: err.message };
  }
}

module.exports = { getStatus, getDiff, getLog, getCommitFiles, getCommitFileDiff };
