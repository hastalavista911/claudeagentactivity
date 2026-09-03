// dashboard/src/lib/commandCategory.js
//
// A lightweight classification for the "Category" badge in the Details
// panel (e.g. "Git", "npm") -- a heuristic based on the command string
// itself, no new data is fetched. Falls back to "Shell" if it doesn't match
// any pattern -- that doesn't mean an error.

const PATTERNS = [
  { key: "git", label: "Git", test: /^git\b/ },
  { key: "npm", label: "npm", test: /^(npm|npx|pnpm|yarn)\b/ },
  { key: "node", label: "Node", test: /^node\b/ },
  { key: "python", label: "Python", test: /^(python3?|pip3?)\b/ },
  { key: "docker", label: "Docker", test: /^docker\b/ },
  { key: "test", label: "Test", test: /\b(jest|vitest|pytest|phpunit|go test)\b/i },
];

export function categorizeCommand(command) {
  if (!command || !command.trim()) return null;
  const trimmed = command.trim();
  const match = PATTERNS.find((p) => p.test.test(trimmed));
  return match ? { key: match.key, label: match.label } : { key: "shell", label: "Shell" };
}
