// dashboard/src/lib/exportReport.js
//
// Builds the session report as markdown text, purely from data already in
// the store (events + usage) -- no LLM call at all, no "smart" summary,
// just reassembling the exact same numbers & timeline shown on the
// dashboard so the file can be shared/saved.

import { describeEvent, labelFor } from "./eventToNode";
import { translations, DEFAULT_LOCALE } from "../i18n/translations";

// This report is ALWAYS in English regardless of the currently active UI
// language -- this downloaded file is meant to be shared/saved as a
// document, not an interactive view, so staying in one consistent language
// matters more than following the dashboard's language toggle. labelFor()
// still needs a t() function (the eventToNode.js lib is pure, it doesn't
// know about language) -- here it's locked to the "en" dictionary.
const reportT = (key, vars) => {
  const str = translations.en[key] ?? translations[DEFAULT_LOCALE][key] ?? key;
  return vars ? str.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : str;
};
import { formatDuration, formatTokens } from "./timeFormat";

export function buildReportMarkdown({ sessionId, events, stats, changedFiles, totalTokens, summary }) {
  const lines = [];
  lines.push("# Agent Session Report");
  lines.push("");
  lines.push(`- Session ID: \`${sessionId ?? "-"}\``);
  lines.push(`- Generated: ${new Date().toISOString()}`);
  if (summary) {
    lines.push(`- Duration: ${formatDuration(summary.durationMs)}`);
    lines.push(`- Outcome: ${summary.outcome}`);
  } else {
    lines.push(`- Status: session still running (no agent.complete event yet)`);
  }
  lines.push("");

  lines.push("## Summary");
  lines.push(`- Thinking turns: ${stats.thinking}`);
  lines.push(`- Tool calls: ${stats.toolCalls}`);
  lines.push(`- Files touched: ${stats.filesTouchedCount}`);
  lines.push(`- Tokens used: ${formatTokens(totalTokens)}`);
  if (stats.tests) {
    lines.push(`- Tests: ${stats.tests.pass}/${stats.tests.total} passed`);
  }
  lines.push("");

  if (changedFiles.length > 0) {
    lines.push("## Changed Files");
    for (const f of changedFiles) {
      const stat = f.hasLineStats ? ` (+${f.added}/-${f.removed})` : ` (${f.edits}x edit)`;
      lines.push(`- \`${f.file}\`${stat}`);
    }
    lines.push("");
  }

  lines.push("## Timeline");
  for (const event of events) {
    const info = describeEvent(event);
    const time = event.timestamp ? new Date(event.timestamp).toLocaleTimeString(undefined, { hour12: false }) : "";
    const detail = info.detail ? ` — ${info.detail}` : "";
    lines.push(`- [${time}] ${labelFor(reportT, info)}${detail}`);
  }
  lines.push("");
  lines.push("_Generated locally by AI Agent Activity Visualizer — no LLM calls involved._");

  return lines.join("\n");
}

export function downloadTextFile(filename, content, mimeType = "text/markdown") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
