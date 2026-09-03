// dashboard/src/lib/testSummary.js
//
// BEST-EFFORT heuristic: try to recognize a test-result summary (Jest/Vitest,
// pytest, go test, or a generic checkmark) from a SINGLE terminal command's
// stdout/stderr text. There's NO universal approach that's 100% correct for
// every test runner -- this deliberately just tries the most common
// patterns, returning null if none of them match (used by
// InsightsPanel.jsx's TestsTab).

export function parseTestSummary(text) {
  if (!text) return null;

  // Jest/Vitest: "Tests:       3 failed, 12 passed, 15 total"
  let m = text.match(/Tests:\s*(?:(\d+)\s*failed,\s*)?(\d+)\s*passed(?:,\s*(\d+)\s*total)?/i);
  if (m) return { passed: Number(m[2]), failed: Number(m[1] ?? 0), source: "Jest/Vitest" };

  // pytest: "5 passed, 2 failed in 1.23s" or "3 passed in 0.5s"
  m = text.match(/(\d+)\s*passed(?:,\s*(\d+)\s*failed)?\s*in\s*[\d.]+s/i);
  if (m) return { passed: Number(m[1]), failed: Number(m[2] ?? 0), source: "pytest" };

  // go test: lines like "--- PASS: TestFoo" / "--- FAIL: TestBar"
  const goPass = (text.match(/--- PASS:/g) || []).length;
  const goFail = (text.match(/--- FAIL:/g) || []).length;
  if (goPass + goFail > 0) return { passed: goPass, failed: goFail, source: "go test" };

  // Generic fallback: count checkmarks/crosses -- the least accurate,
  // used LAST if none of the three patterns above match.
  const check = (text.match(/[✓✔]/g) || []).length;
  const cross = (text.match(/[✗✘]/g) || []).length;
  if (check + cross > 0) return { passed: check, failed: cross, source: "generic" };

  return null;
}

// Searches from the NEWEST terminal.complete event backward, using the
// first match found (the most relevant test activity is usually the most
// recently run one).
export function findLatestTestSummary(events) {
  const terminalEvents = events.filter((e) => e.type === "terminal.complete");
  for (let i = terminalEvents.length - 1; i >= 0; i--) {
    const p = terminalEvents[i].payload ?? {};
    const text = `${p.stdout ?? p.output ?? ""}\n${p.stderr ?? ""}`;
    const parsed = parseTestSummary(text);
    if (parsed) return parsed;
  }
  return null;
}
