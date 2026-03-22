import { describe, it, expect } from "vitest";

// Inline the pure helpers from goals/page.tsx to test them in isolation
function pct(goal: { targetValue?: number; currentValue?: number }) {
  if (!goal.targetValue || goal.currentValue === undefined) return 0;
  return Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
}

function progressColor(p: number) {
  if (p >= 100) return "#4CAF6B";
  if (p >= 66)  return "#C9A84C";
  if (p >= 33)  return "#E8A838";
  return "#E85538";
}

function fmtValue(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}

describe("pct()", () => {
  it("returns 0 when no targetValue", () => {
    expect(pct({ currentValue: 50 })).toBe(0);
  });
  it("returns 0 when currentValue is undefined", () => {
    expect(pct({ targetValue: 100 })).toBe(0);
  });
  it("returns correct percentage", () => {
    expect(pct({ targetValue: 500000, currentValue: 250000 })).toBe(50);
  });
  it("caps at 100 when over target", () => {
    expect(pct({ targetValue: 100, currentValue: 150 })).toBe(100);
  });
});

describe("progressColor()", () => {
  it("returns green at 100%", () => {
    expect(progressColor(100)).toBe("#4CAF6B");
  });
  it("returns red below 33%", () => {
    expect(progressColor(0)).toBe("#E85538");
    expect(progressColor(32)).toBe("#E85538");
  });
  it("returns amber between 33-65%", () => {
    expect(progressColor(33)).toBe("#E8A838");
    expect(progressColor(65)).toBe("#E8A838");
  });
  it("returns gold between 66-99%", () => {
    expect(progressColor(66)).toBe("#C9A84C");
    expect(progressColor(99)).toBe("#C9A84C");
  });
});

describe("fmtValue()", () => {
  it("formats millions", () => {
    expect(fmtValue(1_500_000)).toBe("1.5M");
  });
  it("formats thousands", () => {
    expect(fmtValue(500_000)).toBe("500k");
  });
  it("returns plain number for small values", () => {
    expect(fmtValue(42)).toBe("42");
  });
});
