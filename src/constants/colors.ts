export const P = {
  bg: "#0A0A0B",
  s1: "#111113",
  s2: "#18181B",
  s3: "#1E1E21",
  border: "#2A2A2E",
  borderLight: "#333338",
  gold: "#C9A84C",
  goldDim: "rgba(201,168,76,0.12)",
  goldMid: "rgba(201,168,76,0.30)",
  ink: "#F2EEE8",
  mid: "#6B6760",
  dim: "#3A3A3E",
  // Status colors
  success: "#4CAF6B",
  warning: "#E8A838",
  error: "#E85538",
  info: "#5B8FE8",
  // Priority colors
  urgent: "#E85538",
  high: "#E8A838",
  medium: "#C9A84C",
  low: "#6B6760",
} as const;

// Area colors (one per domain)
export const AREA_COLORS = [
  "#C9A84C", // gold
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
