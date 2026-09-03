// dashboard/src/lib/costEstimate.js
//
// $ cost estimate from token usage -- uses Anthropic's PUBLIC LIST PRICING
// per model family (Opus/Sonnet/Haiku), NOT your account's actual
// contracted rate (that can't be known from the client). Deliberately
// labeled "estimate" in the UI (see InsightsPanel.jsx CostTab), not an
// exact bill figure -- cache write/read pricing follows Anthropic's
// standard ratio (write ~1.25x input price, read ~10% of input price).
//
// Price per MILLION tokens (USD), as of 2026 -- check
// console.anthropic.com/pricing for the most current figures if precision matters.
const PRICING_PER_MTOK = {
  opus: { in: 15, out: 75, cacheWrite: 18.75, cacheRead: 1.5 },
  sonnet: { in: 3, out: 15, cacheWrite: 3.75, cacheRead: 0.3 },
  haiku: { in: 0.8, out: 4, cacheWrite: 1, cacheRead: 0.08 },
};

export function pricingFor(model) {
  const m = (model || "").toLowerCase();
  if (m.includes("opus")) return PRICING_PER_MTOK.opus;
  if (m.includes("haiku")) return PRICING_PER_MTOK.haiku;
  return PRICING_PER_MTOK.sonnet; // default -- also the most commonly used family
}

export function estimateCostUsd(usage, model) {
  const rates = pricingFor(model);
  const toM = (n) => (n ?? 0) / 1_000_000;
  return (
    toM(usage.input_tokens) * rates.in +
    toM(usage.output_tokens) * rates.out +
    toM(usage.cache_creation_input_tokens) * rates.cacheWrite +
    toM(usage.cache_read_input_tokens) * rates.cacheRead
  );
}
