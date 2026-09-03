// dashboard/src/lib/statusColors.js
//
// VALIDATED status palette from the dataviz skill (references/palette.md) --
// good/warning/serious/critical, chosen to be clearly distinct from the
// categorical palette & pass contrast on a dark surface. "Fixed -- never
// themed", so the same hex is used on both light and dark surfaces.

export const STATUS_COLOR = {
  running: "#fab219", // warning
  success: "#0ca30c", // good
  error: "#d03b3b", // critical
  info: "#898781", // muted ink (chrome, not a status palette color, but kept consistent)
};
