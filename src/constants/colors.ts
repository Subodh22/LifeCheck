export const P = {
  bg: "#F9F9F7",
  s1: "#FFFFFF",
  s2: "#F1F5F9",
  s3: "#F5F3FF",
  border: "#E2E8F0",
  borderLight: "#D1D5DB",
  gold: "#8B5CF6",
  goldDim: "rgba(37,99,235,0.12)",
  goldMid: "rgba(37,99,235,0.30)",
  ink: "#111827",
  mid: "#6B7280",
  dim: "#9CA3AF",
  // Status colors
  success: "#4CAF6B",
  warning: "#E8A838",
  error: "#E85538",
  info: "#5B8FE8",
  // Priority colors
  urgent: "#E85538",
  high: "#E8A838",
  medium: "#8B5CF6",
  low: "#6B7280",
} as const;

// Area colors (one per domain)
export const AREA_COLORS = [
  "#8B5CF6", // blue
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
