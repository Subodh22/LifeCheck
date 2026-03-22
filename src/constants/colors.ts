export const P = {
  bg: "#F7F8FA",
  s1: "#FFFFFF",
  s2: "#F1F5F9",
  s3: "#EFF6FF",
  border: "#E2E8F0",
  borderLight: "#CBD5E1",
  gold: "#2563EB",
  goldDim: "rgba(37,99,235,0.12)",
  goldMid: "rgba(37,99,235,0.30)",
  ink: "#0F172A",
  mid: "#64748B",
  dim: "#94A3B8",
  // Status colors
  success: "#4CAF6B",
  warning: "#E8A838",
  error: "#E85538",
  info: "#5B8FE8",
  // Priority colors
  urgent: "#E85538",
  high: "#E8A838",
  medium: "#2563EB",
  low: "#64748B",
} as const;

// Area colors (one per domain)
export const AREA_COLORS = [
  "#2563EB", // blue
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
