export const P = {
  bg: "#FFFFFF",
  s1: "#F7F7F5",
  s2: "#F0F0EE",
  s3: "#E8E8E6",
  border: "#E3E3E1",
  borderLight: "#D5D5D3",
  gold: "#2383E2",
  goldDim: "rgba(35,131,226,0.12)",
  goldMid: "rgba(35,131,226,0.30)",
  ink: "#191919",
  mid: "#9B9A97",
  dim: "#C4C4C2",
  // Status colors
  success: "#4CAF6B",
  warning: "#E8A838",
  error: "#E85538",
  info: "#5B8FE8",
  // Priority colors
  urgent: "#E85538",
  high: "#E8A838",
  medium: "#2383E2",
  low: "#9B9A97",
} as const;

// Area colors (one per domain)
export const AREA_COLORS = [
  "#2383E2", // blue
  "#5B8FE8", // blue
  "#4CAF6B", // green
  "#E8A838", // amber
  "#C45BE8", // purple
  "#E85B8F", // pink
  "#5BE8D4", // teal
] as const;

// Health score color
export function healthColor(score: number): string {
  if (score >= 70) return "#4CAF6B";
  if (score >= 40) return "#E8A838";
  return "#E85538";
}
