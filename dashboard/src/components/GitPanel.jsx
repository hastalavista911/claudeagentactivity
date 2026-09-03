// dashboard/src/components/GitPanel.jsx
//
// A READ-ONLY Git panel, independent of Activity Flow -- purely shows the
// git repo status of whichever project is currently active (the folder of
// the file currently being touched, or the session's cwd if no file has
// been touched at all). Simple polling every ~5 seconds (NOT real-time
// WebSocket) against three read-only endpoints on the server (GET
// /git/status, /git/diff, /git/log) -- the server itself ONLY runs git
// commands that don't change anything (see server/git-info.js -- no
// commit/push/pull/checkout/reset).

import { useEffect, useState } from "react";
import { HTTP_BASE } from "../lib/config";
import { GitBranch, FileDiff, History } from "./icons";
import { shortenPath } from "../lib/eventToNode";
import { useI18n } from "../i18n/I18nContext";

const POLL_MS = 5000;
const GIT_STATUS_LABEL = { A: "A", M: "M", D: "D" };

function dirnameOf(filePath) {
  if (!filePath) return null;
  const normalized = filePath.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx === -1 ? null : normalized.slice(0, idx);
}

// Generic polling: fetch every POLL_MS, stops if rootPath changes/the panel unmounts.
function usePolled(url, deps) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!url) {
      setData(null);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(url);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // Ignore -- the next poll will try again, no need to show an error
        // for every single failed request (e.g. the server briefly restarted).
      }
    }
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return data;
}

function GitStatusBadge({ code }) {
  return <span className={`git-status-badge git-status-badge--${code}`}>{GIT_STATUS_LABEL[code] ?? code}</span>;
}

function StatusTab({ rootPath, onSelectFile }) {
  const { t } = useI18n();
  const data = usePolled(rootPath ? `${HTTP_BASE}/git/status?path=${encodeURIComponent(rootPath)}` : null, [rootPath]);

  if (!data) return <div className="panel__empty">{t("git.status.loading")}</div>;
  if (!data.root) return <div className="panel__empty">{t("git.status.notRepo")}</div>;

  const { staged = [], modified = [], untracked = [] } = data;
  if (staged.length === 0 && modified.length === 0 && untracked.length === 0) {
    return <div className="panel__empty">{t("git.status.clean")}</div>;
  }

  return (
    <div className="git-status-list">
      {/* Explicit clarification: this is the CURRENT state (working tree,
          not yet committed) compared to HEAD -- different from the History
          tab, whose content is already-finished commits. "Modified" in
          particular can contain code M (the file's content changed, the
          file STILL EXISTS) or D (the file was DELETED) at the same time
          -- this caption is also what makes clear "Modified" doesn't just
          mean "content was edited". */}
      <div className="git-status-list__caption">{t("git.status.caption")}</div>
      {staged.length > 0 ? (
        <>
          <div className="git-status-list__group">
            {t("git.status.staged")} ({staged.length})
          </div>
          {staged.map((f) => (
            <button key={"s" + f.file} type="button" className="git-status-list__row" onClick={() => onSelectFile(f.file, true)}>
              <GitStatusBadge code={f.code} />
              <span className="git-status-list__path" title={f.file}>
                {shortenPath(f.file, 40)}
              </span>
            </button>
          ))}
        </>
      ) : null}
      {modified.length > 0 ? (
        <>
          <div className="git-status-list__group">
            {t("git.status.modified")} ({modified.length})
          </div>
          {modified.map((f) => (
            <button key={"m" + f.file} type="button" className="git-status-list__row" onClick={() => onSelectFile(f.file, false)}>
              <GitStatusBadge code={f.code} />
              <span className="git-status-list__path" title={f.file}>
                {shortenPath(f.file, 40)}
              </span>
            </button>
          ))}
        </>
      ) : null}
      {untracked.length > 0 ? (
        <>
          <div className="git-status-list__group">
            {t("git.status.untracked")} ({untracked.length})
          </div>
          {untracked.map((f) => (
            <div key={"u" + f.file} className="git-status-list__row git-status-list__row--static">
              <span className="git-status-badge git-status-badge--?">U</span>
              <span className="git-status-list__path" title={f.file}>
                {shortenPath(f.file, 40)}
              </span>
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}

function DiffLine({ line }) {
  let variant = "ctx";
  if (line.startsWith("+") && !line.startsWith("+++")) variant = "add";
  else if (line.startsWith("-") && !line.startsWith("---")) variant = "remove";
  else if (line.startsWith("@@")) variant = "hunk";
  else if (line.startsWith("diff --git") || line.startsWith("index ") || line.startsWith("+++") || line.startsWith("---")) variant = "meta";
  return <div className={`git-diff__line git-diff__line--${variant}`}>{line || " "}</div>;
}

// selectedFile has 2 shapes:
//  - working tree/staged (from StatusTab): {file, staged}
//  - historical (from HistoryTab, expand a commit -> click a file): {file, commit: {hash, shortHash, subject}}
// Two DIFFERENT data sources on the server (/git/diff vs /git/commit-diff)
// -- the working-tree one always compares against the CURRENT HEAD, the
// historical one compares against when that commit was made. The header
// below is deliberately different so it's clear which one is being shown,
// not disguised as if it were the same diff.
function DiffTab({ rootPath, selectedFile }) {
  const { t } = useI18n();
  const isCommitDiff = Boolean(selectedFile?.commit);
  const url =
    rootPath && selectedFile
      ? isCommitDiff
        ? `${HTTP_BASE}/git/commit-diff?path=${encodeURIComponent(rootPath)}&hash=${encodeURIComponent(selectedFile.commit.hash)}&file=${encodeURIComponent(selectedFile.file)}`
        : `${HTTP_BASE}/git/diff?path=${encodeURIComponent(rootPath)}&file=${encodeURIComponent(selectedFile.file)}&staged=${selectedFile.staged}`
      : null;
  const data = usePolled(url, [rootPath, selectedFile?.file, selectedFile?.staged, selectedFile?.commit?.hash]);

  if (!selectedFile) return <div className="panel__empty">{t("git.diff.selectHint")}</div>;
  if (!data) return <div className="panel__empty">{t("git.diff.loading")}</div>;
  if (!data.diff) {
    return <div className="panel__empty">{t("git.diff.none", { file: shortenPath(selectedFile.file, 40) })}</div>;
  }

  // `key` is unique per SELECTED file (not per data) -- remounts this
  // element every time the user clicks a new file (even if the filename
  // happens to be the same between the working tree vs an old commit), so
  // the CSS fade+slide animation (.git-diff__panel, keyframes
  // diffFadeInLeft) replays on every click, not just once when the Diff
  // tab is first opened.
  const panelKey = `${selectedFile.file}|${selectedFile.commit?.hash ?? (selectedFile.staged ? "staged" : "working")}`;

  return (
    <div key={panelKey} className="git-diff__panel">
      <div className="git-diff__filename">{selectedFile.file}</div>
      {isCommitDiff ? (
        <div className="git-diff__commit-context">
          {t("git.diff.atCommit", { hash: selectedFile.commit.shortHash, subject: selectedFile.commit.subject })}
        </div>
      ) : null}
      <pre className="git-diff">
        {data.diff.split("\n").map((line, i) => (
          <DiffLine key={i} line={line} />
        ))}
      </pre>
    </div>
  );
}

// The per-commit file list is fetched ONCE, only when its commit row is
// clicked (not usePolled every 5 seconds like the other tabs) -- history
// is already committed, its data will never change, so repeated polling
// would just waste requests.
function useCommitFiles(rootPath, hash) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!rootPath || !hash) {
      setData(null);
      return;
    }
    let cancelled = false;
    setData(null);
    fetch(`${HTTP_BASE}/git/commit-files?path=${encodeURIComponent(rootPath)}&hash=${encodeURIComponent(hash)}`)
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setData({ files: [], error: "fetch gagal" });
      });
    return () => {
      cancelled = true;
    };
  }, [rootPath, hash]);
  return data;
}

// Clicking a file here -> the Diff tab, but via /git/commit-diff (the diff
// EXACTLY as that commit made it), NOT /git/diff (working-tree/staged
// against the current HEAD) -- that's why onSelectCommitFile also sends
// `commit`, used by DiffTab to pick the right endpoint & show its commit
// context header (see DiffTab, so it's not mistaken for the same diff as
// the one from Status).
function CommitFilesList({ rootPath, hash, commit, onSelectCommitFile }) {
  const { t } = useI18n();
  const data = useCommitFiles(rootPath, hash);

  if (!data) return <div className="git-log-list__files-loading">{t("git.history.filesLoading")}</div>;
  if (data.files.length === 0) return <div className="git-log-list__files-loading">{t("git.history.filesEmpty")}</div>;

  return (
    <div className="git-log-list__files">
      {data.files.map((f) => (
        <button
          key={f.file}
          type="button"
          className="git-status-list__row"
          onClick={() => onSelectCommitFile(f.file, commit)}
        >
          <GitStatusBadge code={f.code} />
          <span className="git-status-list__path" title={f.file}>
            {shortenPath(f.file, 40)}
          </span>
        </button>
      ))}
    </div>
  );
}

function HistoryTab({ rootPath, onSelectCommitFile }) {
  const { t } = useI18n();
  const data = usePolled(rootPath ? `${HTTP_BASE}/git/log?path=${encodeURIComponent(rootPath)}&limit=20` : null, [rootPath]);
  const [expandedHash, setExpandedHash] = useState(null);

  if (!data) return <div className="panel__empty">{t("git.history.loading")}</div>;
  if (!data.root) return <div className="panel__empty">{t("git.status.notRepo")}</div>;
  if (data.commits.length === 0) return <div className="panel__empty">{t("git.history.empty")}</div>;

  return (
    <div className="git-log-list">
      {data.commits.map((c) => {
        const expanded = expandedHash === c.hash;
        return (
          <div key={c.hash} className="git-log-list__item">
            <button
              type="button"
              className="git-log-list__row git-log-list__row--clickable"
              onClick={() => setExpandedHash(expanded ? null : c.hash)}
            >
              <code className="git-log-list__hash">{c.shortHash}</code>
              <div className="git-log-list__body">
                <div className="git-log-list__subject">{c.subject}</div>
                <div className="git-log-list__meta">
                  {c.author} · {c.relDate}
                </div>
              </div>
            </button>
            {expanded ? (
              <CommitFilesList
                rootPath={rootPath}
                hash={c.hash}
                commit={{ hash: c.hash, shortHash: c.shortHash, subject: c.subject }}
                onSelectCommitFile={onSelectCommitFile}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function GitPanel({ activeFile, sessionCwd }) {
  const { t } = useI18n();
  const [tab, setTab] = useState("status");
  const [selectedFile, setSelectedFile] = useState(null); // {file, staged}

  const TABS = [
    { key: "status", label: t("git.tab.status"), Icon: GitBranch },
    { key: "history", label: t("git.tab.history"), Icon: History },
    { key: "diff", label: t("git.tab.diff"), Icon: FileDiff },
  ];

  // Root to inspect: the active file's folder, falling back to the
  // session's cwd if no file has been touched yet. findGitRoot() on the
  // server automatically walks up to the real repo root from wherever this
  // points.
  //
  // BUT activeFile is only used if it's ACTUALLY inside this session's
  // project folder (under sessionCwd) -- without this guard, editing a file
  // OUTSIDE that (e.g. Claude writing its own memory note to ~/.claude/...,
  // unrelated to the project being watched) hijacks this panel to a
  // completely irrelevant folder, showing "not a git repo" even though the
  // actual project is a perfectly valid one (user report 2026-09-03).
  const activeFileDir = dirnameOf(activeFile);
  const activeFileInSession =
    activeFileDir && sessionCwd && activeFileDir.replace(/\\/g, "/").toLowerCase().startsWith(sessionCwd.replace(/\\/g, "/").toLowerCase());
  const rootPath = (activeFileInSession ? activeFileDir : null) || sessionCwd || activeFileDir || null;

  function handleSelectFile(file, staged) {
    setSelectedFile({ file, staged });
    setTab("diff");
  }

  function handleSelectCommitFile(file, commit) {
    setSelectedFile({ file, commit });
    setTab("diff");
  }

  return (
    <section className="panel panel--git">
      <div className="panel__header">
        <h2 className="panel__title">
          <GitBranch size={15} strokeWidth={2} /> {t("git.title")}
        </h2>
      </div>

      {!rootPath ? (
        <div className="panel__empty">{t("git.noRoot")}</div>
      ) : (
        <>
          <div className="git-tabs">
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                className={`git-tabs__tab${tab === key ? " git-tabs__tab--active" : ""}`}
                onClick={() => setTab(key)}
              >
                <Icon size={12} strokeWidth={2} /> {label}
              </button>
            ))}
          </div>
          <div className="git-panel__body">
            {tab === "status" ? <StatusTab rootPath={rootPath} onSelectFile={handleSelectFile} /> : null}
            {tab === "diff" ? <DiffTab rootPath={rootPath} selectedFile={selectedFile} /> : null}
            {tab === "history" ? <HistoryTab rootPath={rootPath} onSelectCommitFile={handleSelectCommitFile} /> : null}
          </div>
        </>
      )}
    </section>
  );
}
