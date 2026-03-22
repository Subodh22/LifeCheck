// Newspaper editorial palette — option-16 theme
export const P = {
  newsprint:  "#FAFAF5",
  white:      "#FFFFFF",
  ink:        "#0D0D0D",
  inkMid:     "#2A2A2A",
  inkLight:   "#555550",
  inkFaint:   "#999990",
  red:        "#C41E3A",
  redPale:    "rgba(196,30,58,0.07)",
  rule:       "#0D0D0D",
  ruleLight:  "#CCCCBC",
  // Status
  success:    "#3A7D44",
  warning:    "#B08A4E",
  error:      "#C41E3A",
  // Area color palette
} as const;

// Area colors
export const AREA_COLORS = [
  "#2A5F8F",
  "#3A7D44",
  "#B08A4E",
  "#7A3D6B",
  "#5A6E2A",
  "#8F3A2A",
  "#2A7A7A",
] as const;

// Health score → color (newspaper greens/ambers/reds)
export function healthColor(score: number): string {
  if (score >= 70) return "#3A7D44";
  if (score >= 40) return "#B08A4E";
  return "#C41E3A";
}
