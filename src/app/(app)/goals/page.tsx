"use client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import {
  Plus, X, ChevronRight, Target, Calendar,
  CheckCircle2, Clock, PauseCircle, XCircle,
  TrendingUp, ExternalLink, Trash2, ArrowRight, ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type Timeframe = "yearly" | "quarterly" | "monthly" | "weekly";
type GoalStatus = "active" | "achieved" | "paused" | "abandoned";

type Goal = {
  _id: Id<"goals">;
  userId: string;
  areaId: Id<"areas">;
  parentGoalId?: Id<"goals">;
  timeframe?: Timeframe;
  title: string;
  description?: string;
  targetMetric?: string;
  targetValue?: number;
  currentValue?: number;
  dueDate?: number;
  status: GoalStatus;
  createdAt: number;
};

const TIMEFRAMES: { id: Timeframe; label: string; short: string }[] = [
  { id: "yearly",    label: "Yearly",    short: "Y"  },
  { id: "quarterly", label: "Quarterly", short: "Q"  },
  { id: "monthly",   label: "Monthly",   short: "Mo" },
  { id: "weekly",    label: "Weekly",    short: "W"  },
];

const STATUS_META: Record<GoalStatus, { icon: React.ReactNode; color: string; label: string }> = {
  active:    { icon: <Clock size={11} />,        color: "#4A9EE0", label: "Active"    },
  achieved:  { icon: <CheckCircle2 size={11} />, color: "#4CAF6B", label: "Achieved"  },
  paused:    { icon: <PauseCircle size={11} />,  color: "#2383E2", label: "Paused"    },
  abandoned: { icon: <XCircle size={11} />,      color: "#C4C4C2", label: "Abandoned" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(goal: Goal) {
  if (!goal.targetValue || goal.currentValue === undefined) return 0;
  return Math.min(100, Math.round((goal.currentValue / goal.targetValue) * 100));
}

function progressColor(p: number) {
  if (p >= 100) return "#4CAF6B";
  if (p >= 66)  return "#2383E2";
  if (p >= 33)  return "#E8A838";
  return "#E85538";
}

function fmtValue(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}k`;
  return String(v);
}

// ── Quarter generation helpers ────────────────────────────────────────────────

const QUARTER_LABELS  = ["Q1 — Jan–Mar", "Q2 — Apr–Jun", "Q3 — Jul–Sep", "Q4 — Oct–Dec"];
const QUARTER_TITLES  = ["Foundation",   "Momentum",     "Acceleration", "Completion"];

type SplitType = "even" | "hockey" | "frontloaded";
const SPLIT_RATIOS: Record<SplitType, number[]> = {
  even:        [0.25, 0.50, 0.75, 1.00],
  hockey:      [0.15, 0.35, 0.65, 1.00],
  frontloaded: [0.35, 0.60, 0.80, 1.00],
};

type QuarterDraft = { title: string; targetValue?: number; dueDate: number };

function quarterDueDate(qIdx: number): number {
  const y = new Date().getFullYear();
  const ends = [[2,31],[5,30],[8,30],[11,31]] as const;
  return new Date(y, ends[qIdx][0], ends[qIdx][1], 23, 59, 59).getTime();
}

function generateQuarters(
  metric: string | undefined,
  targetValue: number | undefined,
  split: SplitType,
): QuarterDraft[] {
  const ratios = SPLIT_RATIOS[split];
  return [0, 1, 2, 3].map((i) => ({
    title:       QUARTER_TITLES[i],
    targetValue: metric && targetValue ? Math.round(ratios[i] * targetValue) : undefined,
    dueDate:     quarterDueDate(i),
  }));
}

// ── Yearly Goal Wizard ────────────────────────────────────────────────────────

interface YearlyWizardProps {
  userId: string;
  areas: { _id: Id<"areas">; name: string; icon?: string; color: string }[];
  defaultAreaId?: Id<"areas">;
  onClose: () => void;
}

function YearlyGoalWizard({ userId, areas, defaultAreaId, onClose }: YearlyWizardProps) {
  const createCascade = useMutation(api.goals.createCascade);
  const year = new Date().getFullYear();

  const [step, setStep] = useState(1);
  const TOTAL = 5;

  // Step 1 — Outcome + Area
  const [areaId,      setAreaId]      = useState<Id<"areas"> | "">(defaultAreaId ?? areas[0]?._id ?? "");
  const [title,       setTitle]       = useState("");
  // Step 2 — Why / 80%
  const [motivation,  setMotivation]  = useState("");
  const [eightyPct,   setEightyPct]   = useState("");
  // Step 3 — Metric
  const [metric,      setMetric]      = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [currentValue,setCurrentValue]= useState("0");
  // Step 4 — Constraint
  const [constraint,  setConstraint]  = useState("");
  // Step 5 — Quarters
  const [splitType,   setSplitType]   = useState<SplitType>("even");
  const [quarters,    setQuarters]    = useState<QuarterDraft[]>(() =>
    generateQuarters(undefined, undefined, "even")
  );
  const [saving,      setSaving]      = useState(false);

  // Regenerate quarter suggestions whenever step 5 becomes active
  const syncQuarters = (split: SplitType = splitType) => {
    const tv = targetValue ? Number(targetValue) : undefined;
    setQuarters(generateQuarters(metric || undefined, tv, split));
  };

  const canNext = () => {
    if (step === 1) return !!title.trim() && !!areaId;
    if (step === 5) return quarters.every((q) => q.title.trim());
    return true;
  };

  const handleNext = () => {
    if (step === 4) syncQuarters();
    if (step < TOTAL) setStep(step + 1);
  };

  const handleCreate = async () => {
    if (!areaId || !title.trim()) return;
    setSaving(true);
    try {
      await createCascade({
        userId,
        areaId:       areaId as Id<"areas">,
        title:        title.trim(),
        motivation:   motivation.trim() || undefined,
        eightyPct:    eightyPct.trim()  || undefined,
        constraint:   constraint.trim() || undefined,
        targetMetric: metric.trim()     || undefined,
        targetValue:  targetValue       ? Number(targetValue)  : undefined,
        currentValue: currentValue      ? Number(currentValue) : 0,
        quarters:     quarters.map((q) => ({
          title:       q.title.trim(),
          targetValue: q.targetValue,
          dueDate:     q.dueDate,
        })),
      });
      onClose();
    } finally { setSaving(false); }
  };

  const updateQuarter = (i: number, field: "title" | "targetValue", val: string) => {
    setQuarters((prev) => prev.map((q, idx) =>
      idx !== i ? q : { ...q, [field]: field === "targetValue" ? (val ? Number(val) : undefined) : val }
    ));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-[540px] bg-[#F7F7F5] border border-[#E3E3E1] rounded-lg overflow-hidden max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E3E3E1] shrink-0">
          <div>
            <p className="font-ui text-[14px] font-semibold text-[#191919]">Set a {year} Yearly Goal</p>
            <p className="font-ui text-[11px] text-[#C4C4C2] mt-0.5">Step {step} of {TOTAL}</p>
          </div>
          <button onClick={onClose} className="text-[#C4C4C2] hover:text-[#9B9A97]"><X size={14} /></button>
        </div>

        {/* Step progress bar */}
        <div className="h-0.5 bg-[#F0F0EE] shrink-0">
          <div
            className="h-full bg-[#2383E2] transition-all duration-300"
            style={{ width: `${(step / TOTAL) * 100}%` }}
          />
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">

          {/* ── Step 1: Outcome ── */}
          {step === 1 && (
            <>
              <div>
                <p className="font-ui text-[18px] font-semibold text-[#191919] mb-1">
                  What will be true on Dec 31?
                </p>
                <p className="font-ui text-[12px] text-[#9B9A97] leading-relaxed">
                  Write it as a concrete outcome — not a habit. Not &ldquo;I will work out more&rdquo; but &ldquo;I will weigh 85kg&rdquo; or &ldquo;I will have $200k saved.&rdquo;
                </p>
              </div>
              <div>
                <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#9B9A97] mb-1.5 block">Goal statement</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={`e.g. Hit $500k revenue · Run 5km in 24 min · 10% body fat`}
                  className="w-full bg-[#FFFFFF] border border-[#E3E3E1] rounded px-3 py-2.5 font-ui text-[14px] text-[#191919] placeholder:text-[#C4C4C2] outline-none focus:border-[#D5D5D3]"
                  autoFocus
                />
              </div>
              <div>
                <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#9B9A97] mb-1.5 block">Life area</label>
                <div className="grid grid-cols-2 gap-2">
                  {areas.map((a) => (
                    <button
                      key={a._id}
                      onClick={() => setAreaId(a._id)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded border font-ui text-[13px] transition-colors text-left",
                        areaId === a._id
                          ? "border-[#2383E2] text-[#191919] bg-[#2383E20C]"
                          : "border-[#E3E3E1] text-[#9B9A97] hover:border-[#D5D5D3] hover:text-[#6F6E69]"
                      )}
                    >
                      {a.icon && <span>{a.icon}</span>}
                      <span>{a.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── Step 2: Why / 80% ── */}
          {step === 2 && (
            <>
              <div>
                <p className="font-ui text-[18px] font-semibold text-[#191919] mb-1">
                  Why does this matter?
                </p>
                <p className="font-ui text-[12px] text-[#9B9A97] leading-relaxed">
                  Research shows goals with a clear &ldquo;why&rdquo; are 3× more likely to be achieved. Connect this to something bigger than the number.
                </p>
              </div>
              <div>
                <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#9B9A97] mb-1.5 block">
                  Why it matters to you
                </label>
                <textarea
                  value={motivation}
                  onChange={(e) => setMotivation(e.target.value)}
                  placeholder="e.g. Financial freedom means I can choose my work. This proves the business model works."
                  rows={3}
                  className="w-full bg-[#FFFFFF] border border-[#E3E3E1] rounded px-3 py-2.5 font-ui text-[13px] text-[#191919] placeholder:text-[#C4C4C2] outline-none focus:border-[#D5D5D3] resize-none leading-relaxed"
                  autoFocus
                />
              </div>
              <div>
                <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#9B9A97] mb-1.5 block">
                  The 80% version (what does &ldquo;good enough&rdquo; look like?)
                </label>
                <input
                  value={eightyPct}
                  onChange={(e) => setEightyPct(e.target.value)}
                  placeholder="e.g. $400k revenue — enough to replace my salary"
                  className="w-full bg-[#FFFFFF] border border-[#E3E3E1] rounded px-3 py-2.5 font-ui text-[13px] text-[#191919] placeholder:text-[#C4C4C2] outline-none focus:border-[#D5D5D3]"
                />
                <p className="font-ui text-[11px] text-[#C4C4C2] mt-1.5">
                  Knowing your floor prevents all-or-nothing thinking and keeps you motivated even when you&apos;re behind.
                </p>
              </div>
            </>
          )}

          {/* ── Step 3: Metric ── */}
          {step === 3 && (
            <>
              <div>
                <p className="font-ui text-[18px] font-semibold text-[#191919] mb-1">
                  How will you measure it?
                </p>
                <p className="font-ui text-[12px] text-[#9B9A97] leading-relaxed">
                  A goal without a number is a wish. Optionally add a metric so you can track progress and get quarterly breakdowns automatically.
                </p>
              </div>
              <div>
                <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#9B9A97] mb-1.5 block">
                  Metric name <span className="normal-case text-[#C4C4C2]">(optional)</span>
                </label>
                <input
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                  placeholder="revenue ($) · body fat % · sessions · books read"
                  className="w-full bg-[#FFFFFF] border border-[#E3E3E1] rounded px-3 py-2.5 font-ui text-[13px] text-[#191919] placeholder:text-[#C4C4C2] outline-none focus:border-[#D5D5D3]"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#9B9A97] mb-1.5 block">Current value</label>
                  <input
                    type="number"
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    placeholder="0"
                    className="w-full bg-[#FFFFFF] border border-[#E3E3E1] rounded px-3 py-2.5 font-ui text-[13px] text-[#191919] outline-none focus:border-[#D5D5D3]"
                  />
                </div>
                <div>
                  <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#9B9A97] mb-1.5 block">Target by Dec 31</label>
                  <input
                    type="number"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder="500000"
                    className="w-full bg-[#FFFFFF] border border-[#E3E3E1] rounded px-3 py-2.5 font-ui text-[13px] text-[#191919] placeholder:text-[#C4C4C2] outline-none focus:border-[#D5D5D3]"
                  />
                </div>
              </div>
              {metric && targetValue && (
                <div className="rounded border border-[#E3E3E1] bg-[#FFFFFF] px-4 py-3">
                  <p className="font-ui text-[12px] text-[#9B9A97]">
                    You need to grow <span className="text-[#2383E2] font-semibold">
                      {fmtValue(Number(targetValue) - (Number(currentValue) || 0))} {metric}
                    </span> this year — or about&nbsp;
                    <span className="text-[#2383E2] font-semibold">
                      {fmtValue(Math.round((Number(targetValue) - (Number(currentValue) || 0)) / 52))} {metric}
                    </span> per week.
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── Step 4: Constraint ── */}
          {step === 4 && (
            <>
              <div>
                <p className="font-ui text-[18px] font-semibold text-[#191919] mb-1">
                  What could derail this?
                </p>
                <p className="font-ui text-[12px] text-[#9B9A97] leading-relaxed">
                  Pre-mortem thinking: imagine it&apos;s December and you missed this goal. What went wrong? Research shows people who name obstacles in advance are significantly more likely to hit goals (Oettingen, 2014).
                </p>
              </div>
              <div>
                <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#9B9A97] mb-1.5 block">
                  Biggest obstacle or constraint <span className="normal-case text-[#C4C4C2]">(optional)</span>
                </label>
                <textarea
                  value={constraint}
                  onChange={(e) => setConstraint(e.target.value)}
                  placeholder="e.g. I consistently underestimate how long client work takes, leaving no time to build new revenue streams."
                  rows={3}
                  className="w-full bg-[#FFFFFF] border border-[#E3E3E1] rounded px-3 py-2.5 font-ui text-[13px] text-[#191919] placeholder:text-[#C4C4C2] outline-none focus:border-[#D5D5D3] resize-none leading-relaxed"
                  autoFocus
                />
              </div>
              <div className="rounded border border-[#E8E8E6] bg-[#FFFFFF] px-4 py-3 space-y-1.5">
                <p className="font-ui text-[11px] uppercase tracking-[0.1em] text-[#C4C4C2]">Your {year} goal summary</p>
                <p className="font-ui text-[14px] font-semibold text-[#191919]">{title}</p>
                {metric && targetValue && (
                  <p className="font-ui text-[12px] text-[#9B9A97]">
                    Target: <span className="text-[#2383E2]">{fmtValue(Number(targetValue))} {metric}</span>
                  </p>
                )}
                {motivation && (
                  <p className="font-ui text-[12px] text-[#9B9A97] leading-relaxed italic">&ldquo;{motivation}&rdquo;</p>
                )}
              </div>
            </>
          )}

          {/* ── Step 5: Quarterly breakdown ── */}
          {step === 5 && (
            <>
              <div>
                <p className="font-ui text-[18px] font-semibold text-[#191919] mb-1">
                  Quarterly milestones
                </p>
                <p className="font-ui text-[12px] text-[#9B9A97] leading-relaxed">
                  Breaking a yearly goal into quarters forces you to commit to a pace, not just a destination. Edit titles and targets to match your actual plan.
                </p>
              </div>

              {/* Split type selector */}
              {metric && targetValue && (
                <div>
                  <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#9B9A97] mb-2 block">Progress pattern</label>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      { id: "even" as SplitType,        label: "Even",        sub: "25 · 50 · 75 · 100%" },
                      { id: "hockey" as SplitType,      label: "Hockey stick",sub: "15 · 35 · 65 · 100%" },
                      { id: "frontloaded" as SplitType, label: "Front-loaded",sub: "35 · 60 · 80 · 100%" },
                    ]).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => { setSplitType(s.id); syncQuarters(s.id); }}
                        className={cn(
                          "rounded border px-3 py-2 text-left transition-colors",
                          splitType === s.id
                            ? "border-[#2383E2] bg-[#2383E20C]"
                            : "border-[#E3E3E1] hover:border-[#D5D5D3]"
                        )}
                      >
                        <p className={cn("font-ui text-[12px] font-medium", splitType === s.id ? "text-[#2383E2]" : "text-[#6F6E69]")}>{s.label}</p>
                        <p className="font-ui text-[10px] text-[#C4C4C2] mt-0.5 tabular-nums">{s.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quarter cards */}
              <div className="space-y-2">
                {quarters.map((q, i) => (
                  <div key={i} className="rounded border border-[#E3E3E1] bg-[#FFFFFF] px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-ui text-[11px] uppercase tracking-[0.1em] text-[#C4C4C2] shrink-0">
                        {QUARTER_LABELS[i]}
                      </span>
                    </div>
                    <input
                      value={q.title}
                      onChange={(e) => updateQuarter(i, "title", e.target.value)}
                      placeholder="Milestone title"
                      className="w-full bg-[#F7F7F5] border border-[#E8E8E6] rounded px-2.5 py-1.5 font-ui text-[13px] text-[#191919] placeholder:text-[#C4C4C2] outline-none focus:border-[#E3E3E1]"
                    />
                    {metric && (
                      <div className="flex items-center gap-2">
                        <span className="font-ui text-[11px] text-[#C4C4C2] shrink-0">Target:</span>
                        <input
                          type="number"
                          value={q.targetValue ?? ""}
                          onChange={(e) => updateQuarter(i, "targetValue", e.target.value)}
                          placeholder="—"
                          className="w-24 bg-[#F7F7F5] border border-[#E8E8E6] rounded px-2.5 py-1 font-ui text-[12px] text-[#2383E2] outline-none focus:border-[#E3E3E1] tabular-nums"
                        />
                        <span className="font-ui text-[11px] text-[#C4C4C2]">{metric}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E3E3E1] flex items-center justify-between shrink-0">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="flex items-center gap-1.5 font-ui text-[13px] text-[#9B9A97] hover:text-[#191919] transition-colors"
          >
            <ArrowLeft size={13} />
            {step > 1 ? "Back" : "Cancel"}
          </button>

          {step < TOTAL ? (
            <button
              onClick={handleNext}
              disabled={!canNext()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#4A9EE0] rounded font-ui text-[13px] font-medium text-white hover:bg-[#5AAFF0] disabled:opacity-40 transition-colors"
            >
              {step === 4 ? "Preview quarters" : "Continue"}
              <ArrowRight size={13} />
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={saving || !canNext()}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-[#2383E2] rounded font-ui text-[13px] font-medium text-[#FFFFFF] hover:bg-[#D9B85C] disabled:opacity-40 transition-colors"
            >
              {saving ? "Creating…" : `Create ${year} goal`}
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add / Edit Goal Modal ─────────────────────────────────────────────────────

interface GoalModalProps {
  userId: string;
  areas: { _id: Id<"areas">; name: string; icon?: string; color: string }[];
  goal?: Goal;
  defaultTimeframe?: Timeframe;
  defaultParentId?: Id<"goals">;
  defaultAreaId?: Id<"areas">;
  parentGoals?: Goal[];
  onClose: () => void;
}

function GoalModal({
  userId, areas, goal, defaultTimeframe, defaultParentId, defaultAreaId,
  parentGoals = [], onClose,
}: GoalModalProps) {
  const createGoal = useMutation(api.goals.create);
  const updateGoal = useMutation(api.goals.update);

  const [title,     setTitle]     = useState(goal?.title ?? "");
  const [desc,      setDesc]      = useState(goal?.description ?? "");
  const [areaId,    setAreaId]    = useState<Id<"areas"> | "">(goal?.areaId ?? defaultAreaId ?? areas[0]?._id ?? "");
  const [timeframe, setTimeframe] = useState<Timeframe | "">(goal?.timeframe ?? defaultTimeframe ?? "yearly");
  const [parentId,  setParentId]  = useState<Id<"goals"> | "">(goal?.parentGoalId ?? defaultParentId ?? "");
  const [metric,    setMetric]    = useState(goal?.targetMetric ?? "");
  const [current,   setCurrent]   = useState(String(goal?.currentValue ?? "0"));
  const [target,    setTarget]    = useState(String(goal?.targetValue ?? ""));
  const [dueDate,   setDueDate]   = useState(goal?.dueDate ? new Date(goal.dueDate).toISOString().split("T")[0] : "");
  const [saving,    setSaving]    = useState(false);

  const order: Timeframe[] = ["yearly", "quarterly", "monthly", "weekly"];
  const myIdx = order.indexOf(timeframe as Timeframe);
  const eligible = parentGoals.filter((g) => {
    if (!timeframe) return false;
    const parentIdx = order.indexOf(g.timeframe as Timeframe);
    return parentIdx >= 0 && parentIdx < myIdx;
  });

  const handleSave = async () => {
    if (!title.trim() || !areaId) return;
    setSaving(true);
    try {
      const payload = {
        title:        title.trim(),
        description:  desc.trim() || undefined,
        areaId:       areaId as Id<"areas">,
        timeframe:    (timeframe || undefined) as Timeframe | undefined,
        parentGoalId: (parentId || undefined) as Id<"goals"> | undefined,
        targetMetric: metric.trim() || undefined,
        targetValue:  target ? Number(target) : undefined,
        currentValue: current ? Number(current) : 0,
        dueDate:      dueDate ? new Date(dueDate).getTime() : undefined,
      };
      if (goal) {
        await updateGoal({ id: goal._id, ...payload });
      } else {
        await createGoal({ userId, ...payload });
      }
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[480px] bg-[#F7F7F5] border border-[#E3E3E1] rounded-lg overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E3E3E1] shrink-0">
          <p className="font-ui text-[14px] font-semibold text-[#191919]">{goal ? "Edit Goal" : "New Goal"}</p>
          <button onClick={onClose} className="text-[#9B9A97] hover:text-[#191919]"><X size={14} /></button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <div>
            <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#9B9A97] mb-1.5 block">Goal</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Hit $500k revenue, Run 5km under 25 min…"
              className="w-full bg-[#FFFFFF] border border-[#E3E3E1] rounded px-3 py-2 font-ui text-[13px] text-[#191919] placeholder:text-[#C4C4C2] outline-none focus:border-[#D5D5D3]"
              autoFocus
            />
          </div>

          <div>
            <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#9B9A97] mb-1.5 block">Description</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Why does this goal matter? What does success look like? Any context or strategy…"
              rows={3}
              className="w-full bg-[#FFFFFF] border border-[#E3E3E1] rounded px-3 py-2 font-ui text-[13px] text-[#191919] placeholder:text-[#C4C4C2] outline-none focus:border-[#D5D5D3] resize-none leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#9B9A97] mb-1.5 block">Timeframe</label>
              <div className="grid grid-cols-4 gap-1">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.id}
                    onClick={() => setTimeframe(tf.id)}
                    className={cn(
                      "py-1.5 rounded border font-ui text-[11px] font-medium transition-colors",
                      timeframe === tf.id
                        ? "border-[#4A9EE0] text-[#4A9EE0] bg-[#4A9EE018]"
                        : "border-[#E3E3E1] text-[#9B9A97] hover:border-[#D5D5D3]"
                    )}
                  >
                    {tf.short}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#9B9A97] mb-1.5 block">Area</label>
              <select
                value={areaId}
                onChange={(e) => setAreaId(e.target.value as Id<"areas">)}
                className="w-full bg-[#FFFFFF] border border-[#E3E3E1] rounded px-3 py-2 font-ui text-[12px] text-[#191919] outline-none cursor-pointer"
              >
                {areas.map((a) => <option key={a._id} value={a._id}>{a.icon} {a.name}</option>)}
              </select>
            </div>
          </div>

          {eligible.length > 0 && (
            <div>
              <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#9B9A97] mb-1.5 block">
                Contributes to
              </label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value as Id<"goals">)}
                className="w-full bg-[#FFFFFF] border border-[#E3E3E1] rounded px-3 py-2 font-ui text-[12px] text-[#191919] outline-none cursor-pointer"
              >
                <option value="">— None —</option>
                {eligible.map((g) => (
                  <option key={g._id} value={g._id}>[{g.timeframe?.charAt(0).toUpperCase()}] {g.title}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#9B9A97] mb-1.5 block">Metric</label>
            <input
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              placeholder="revenue ($), body fat %, sessions, books…"
              className="w-full bg-[#FFFFFF] border border-[#E3E3E1] rounded px-3 py-2 font-ui text-[13px] text-[#191919] placeholder:text-[#C4C4C2] outline-none focus:border-[#D5D5D3]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#9B9A97] mb-1.5 block">Current</label>
              <input
                type="number"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="w-full bg-[#FFFFFF] border border-[#E3E3E1] rounded px-3 py-2 font-ui text-[13px] text-[#191919] outline-none focus:border-[#D5D5D3]"
              />
            </div>
            <div>
              <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#9B9A97] mb-1.5 block">Target</label>
              <input
                type="number"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="500000"
                className="w-full bg-[#FFFFFF] border border-[#E3E3E1] rounded px-3 py-2 font-ui text-[13px] text-[#191919] placeholder:text-[#C4C4C2] outline-none focus:border-[#D5D5D3]"
              />
            </div>
          </div>

          <div>
            <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#9B9A97] mb-1.5 block">Due date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full bg-[#FFFFFF] border border-[#E3E3E1] rounded px-3 py-2 font-ui text-[12px] text-[#191919] outline-none [color-scheme:light]"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[#E3E3E1] flex justify-end gap-2 shrink-0">
          <button onClick={onClose} className="px-4 py-1.5 rounded border border-[#E3E3E1] font-ui text-[13px] text-[#9B9A97] hover:text-[#191919]">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || !areaId || saving}
            className="px-4 py-1.5 rounded bg-[#4A9EE0] font-ui text-[13px] font-medium text-white hover:bg-[#5AAFF0] disabled:opacity-40 transition-colors"
          >
            {saving ? "Saving…" : goal ? "Save" : "Add Goal"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Goal Detail Panel ─────────────────────────────────────────────────────────

interface DetailPanelProps {
  goal: Goal;
  allGoals: Goal[];
  areas: Record<string, { name: string; icon?: string; color: string }>;
  relatedTasks: { _id: string; title: string; status: string; priority: string }[];
  onClose: () => void;
  onEdit: () => void;
  onAddChild: () => void;
}

function GoalDetailPanel({ goal, allGoals, areas, relatedTasks, onClose, onEdit, onAddChild }: DetailPanelProps) {
  const { userId } = useCurrentUser();
  const updateGoal  = useMutation(api.goals.update);
  const archiveGoal = useMutation(api.goals.archive);
  const createTask  = useMutation(api.tasks.create);

  const [editingDesc,  setEditingDesc]  = useState(false);
  const [desc,         setDesc]         = useState(goal.description ?? "");
  const [editingVal,   setEditingVal]   = useState(false);
  const [currentInput, setCurrentInput] = useState(String(goal.currentValue ?? 0));
  const [addingTask,   setAddingTask]   = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const handleAddTask = async () => {
    const title = newTaskTitle.trim();
    if (!title || !userId) return;
    // For weekly goals set dueDate to end of current week so they appear
    // automatically in the Schedule sidebar's "This Week" section
    const dueDate = goal.timeframe === "weekly"
      ? (() => { const d = new Date(); d.setDate(d.getDate() + (7 - d.getDay())); d.setHours(23, 59, 59, 999); return d.getTime(); })()
      : undefined;
    await createTask({
      userId,
      areaId:   goal.areaId,
      goalId:   goal._id,
      title,
      priority: "medium",
      dueDate,
    });
    setNewTaskTitle("");
    setAddingTask(false);
  };

  const area      = areas[goal.areaId];
  const p         = pct(goal);
  const pColor    = progressColor(p);
  const status    = STATUS_META[goal.status];
  const parent    = goal.parentGoalId ? allGoals.find((g) => g._id === goal.parentGoalId) : null;
  const children  = allGoals.filter((g) => g.parentGoalId === goal._id);
  const isOver    = goal.dueDate && goal.dueDate < Date.now() && goal.status === "active";

  const saveDesc = async () => {
    await updateGoal({ id: goal._id, description: desc.trim() || undefined });
    setEditingDesc(false);
  };

  const saveProgress = async () => {
    const val = Number(currentInput);
    if (!isNaN(val)) {
      await updateGoal({ id: goal._id, currentValue: val });
      if (goal.targetValue && val >= goal.targetValue) {
        await updateGoal({ id: goal._id, status: "achieved" });
      }
    }
    setEditingVal(false);
  };

  const order: Timeframe[] = ["yearly", "quarterly", "monthly", "weekly"];
  const tfIdx   = goal.timeframe ? order.indexOf(goal.timeframe) : -1;
  const childTf = tfIdx >= 0 && tfIdx < 3 ? order[tfIdx + 1] : null;

  return (
    <div className="w-[320px] shrink-0 border-l border-[#E3E3E1] bg-[#F7F7F5] flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E3E3E1] shrink-0">
        <div className="flex items-center gap-2">
          {goal.timeframe && (
            <span className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#C4C4C2] bg-[#F0F0EE] border border-[#E3E3E1] px-2 py-0.5 rounded">
              {goal.timeframe}
            </span>
          )}
          {area && (
            <span className="font-ui text-[11px]" style={{ color: area.color }}>
              {area.icon} {area.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={onEdit} className="text-[#C4C4C2] hover:text-[#9B9A97] transition-colors p-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button onClick={onClose} className="text-[#9B9A97] hover:text-[#191919] transition-colors p-1">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">

        {/* Title + status */}
        <div className="px-4 pt-4 pb-3">
          <h2 className="font-ui text-[16px] font-semibold text-[#191919] leading-snug mb-2">{goal.title}</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={goal.status}
              onChange={(e) => updateGoal({ id: goal._id, status: e.target.value as GoalStatus })}
              className={cn(
                "appearance-none rounded px-2.5 py-1 font-ui text-[11px] font-medium outline-none cursor-pointer border"
              )}
              style={{ color: status.color, backgroundColor: `${status.color}18`, borderColor: `${status.color}40` }}
            >
              {Object.entries(STATUS_META).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            {goal.dueDate && (
              <span className={cn("flex items-center gap-1 font-ui text-[11px]", isOver ? "text-[#E85538]" : "text-[#9B9A97]")}>
                <Calendar size={11} />
                {format(new Date(goal.dueDate), "d MMM yyyy")}
              </span>
            )}
          </div>
        </div>

        {/* Progress */}
        {goal.targetValue !== undefined && (
          <div className="px-4 pb-4 border-b border-[#E3E3E1]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-ui text-[11px] uppercase tracking-[0.1em] text-[#C4C4C2]">Progress</span>
              <span className="font-ui text-[12px] font-semibold tabular-nums" style={{ color: pColor }}>{p}%</span>
            </div>
            <div className="h-2 bg-[#E3E3E1] rounded-full overflow-hidden mb-2">
              <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, backgroundColor: pColor }} />
            </div>
            <div className="flex items-center justify-between">
              {/* Editable current value */}
              {editingVal ? (
                <input
                  type="number"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onBlur={saveProgress}
                  onKeyDown={(e) => { if (e.key === "Enter") saveProgress(); if (e.key === "Escape") setEditingVal(false); }}
                  className="w-24 bg-[#F0F0EE] border border-[#4A9EE0] rounded px-2 py-0.5 font-ui text-[12px] text-[#191919] outline-none tabular-nums"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => { setCurrentInput(String(goal.currentValue ?? 0)); setEditingVal(true); }}
                  className="font-ui text-[12px] text-[#9B9A97] hover:text-[#191919] tabular-nums transition-colors flex items-center gap-1"
                >
                  <TrendingUp size={11} />
                  {goal.currentValue !== undefined ? fmtValue(goal.currentValue) : "0"}
                  {goal.targetMetric ? ` ${goal.targetMetric}` : ""}
                </button>
              )}
              <span className="font-ui text-[11px] text-[#C4C4C2]">
                of {fmtValue(goal.targetValue)}{goal.targetMetric ? ` ${goal.targetMetric}` : ""}
              </span>
            </div>
          </div>
        )}

        {/* Description */}
        <div className="px-4 py-4 border-b border-[#E3E3E1]">
          <p className="font-ui text-[11px] uppercase tracking-[0.1em] text-[#C4C4C2] mb-2">Description</p>
          {editingDesc ? (
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onBlur={saveDesc}
              onKeyDown={(e) => { if (e.key === "Escape") { setDesc(goal.description ?? ""); setEditingDesc(false); } }}
              rows={5}
              placeholder="Why does this goal matter? Strategy, context, success criteria…"
              className="w-full bg-[#F0F0EE] border border-[#E3E3E1] rounded px-3 py-2 font-ui text-[13px] text-[#191919] placeholder:text-[#C4C4C2] outline-none focus:border-[#D5D5D3] resize-none leading-relaxed"
              autoFocus
            />
          ) : (
            <p
              onClick={() => { setDesc(goal.description ?? ""); setEditingDesc(true); }}
              className={cn(
                "font-ui text-[13px] leading-relaxed cursor-text rounded px-1 py-1 -mx-1 hover:bg-[#F0F0EE] transition-colors whitespace-pre-wrap",
                goal.description ? "text-[#6F6E69]" : "text-[#C4C4C2] italic"
              )}
            >
              {goal.description || "Add a description…"}
            </p>
          )}
        </div>

        {/* Parent goal */}
        {parent && (
          <div className="px-4 py-3 border-b border-[#E3E3E1]">
            <p className="font-ui text-[11px] uppercase tracking-[0.1em] text-[#C4C4C2] mb-2">Contributes to</p>
            <div className="flex items-center gap-2 bg-[#F0F0EE] border border-[#E3E3E1] rounded px-3 py-2">
              <span className="font-ui text-[11px] uppercase text-[#C4C4C2] shrink-0">{parent.timeframe}</span>
              <span className="font-ui text-[12px] text-[#6F6E69] truncate">{parent.title}</span>
            </div>
          </div>
        )}

        {/* Child goals */}
        {(children.length > 0 || childTf) && (
          <div className="px-4 py-3 border-b border-[#E3E3E1]">
            <div className="flex items-center justify-between mb-2">
              <p className="font-ui text-[11px] uppercase tracking-[0.1em] text-[#C4C4C2]">
                {childTf ? `${childTf.charAt(0).toUpperCase() + childTf.slice(1)} milestones` : "Sub-goals"}
              </p>
              {childTf && (
                <button
                  onClick={onAddChild}
                  className="flex items-center gap-1 font-ui text-[11px] text-[#4A9EE0] hover:text-[#5AAFF0] transition-colors"
                >
                  <Plus size={11} /> Add
                </button>
              )}
            </div>
            {children.length === 0 ? (
              <p className="font-ui text-[12px] text-[#C4C4C2] italic">No milestones yet</p>
            ) : (
              <div className="space-y-1.5">
                {children.map((c) => {
                  const cp    = pct(c);
                  const cpClr = progressColor(cp);
                  return (
                    <div key={c._id} className="bg-[#F0F0EE] border border-[#E3E3E1] rounded px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-ui text-[12px] text-[#6F6E69] leading-snug flex-1 mr-2">{c.title}</span>
                        <span className="font-ui text-[11px] tabular-nums shrink-0" style={{ color: cpClr }}>{cp}%</span>
                      </div>
                      {c.targetValue !== undefined && (
                        <div className="h-1 bg-[#E3E3E1] rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${cp}%`, backgroundColor: cpClr }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tasks */}
        <div className="px-4 py-3 border-b border-[#E3E3E1]">
          <div className="flex items-center justify-between mb-2">
            <p className="font-ui text-[11px] uppercase tracking-[0.1em] text-[#C4C4C2]">Tasks</p>
            <button
              onClick={() => { setAddingTask(true); setNewTaskTitle(""); }}
              className="flex items-center gap-1 font-ui text-[11px] text-[#4A9EE0] hover:text-[#5AAFF0] transition-colors"
            >
              <Plus size={11} /> Add
            </button>
          </div>

          {/* Inline new task input */}
          {addingTask && (
            <div className="mb-2">
              <input
                autoFocus
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter")  handleAddTask();
                  if (e.key === "Escape") { setAddingTask(false); setNewTaskTitle(""); }
                }}
                placeholder="Task name…"
                className="w-full bg-[#F0F0EE] border border-[#4A9EE040] rounded px-3 py-1.5 font-ui text-[12px] text-[#191919] placeholder:text-[#C4C4C2] outline-none focus:border-[#4A9EE0] transition-colors"
              />
              <div className="flex items-center gap-2 mt-1.5">
                <button
                  onClick={handleAddTask}
                  className="font-ui text-[11px] text-[#4A9EE0] hover:text-[#5AAFF0] transition-colors"
                >
                  Add task
                </button>
                <span className="text-[#E3E3E1]">·</span>
                <button
                  onClick={() => { setAddingTask(false); setNewTaskTitle(""); }}
                  className="font-ui text-[11px] text-[#C4C4C2] hover:text-[#9B9A97] transition-colors"
                >
                  Cancel
                </button>
                {goal.timeframe === "weekly" && (
                  <span className="ml-auto font-ui text-[10px] text-[#C4C4C2]">due this week</span>
                )}
              </div>
            </div>
          )}

          {relatedTasks.length === 0 && !addingTask ? (
            <p className="font-ui text-[12px] text-[#C4C4C2] italic">No tasks yet</p>
          ) : (
            <div className="space-y-1.5">
              {relatedTasks.map((t) => (
                <div key={t._id} className="flex items-center gap-2">
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0",
                    t.status === "in_progress" ? "bg-[#2383E2]" :
                    t.status === "blocked"     ? "bg-[#E85538]" :
                    t.status === "todo"        ? "bg-[#4A9EE0]" : "bg-[#C4C4C2]"
                  )} />
                  <span className="font-ui text-[12px] text-[#9B9A97] flex-1 leading-snug">{t.title}</span>
                  {t.priority === "urgent" && (
                    <span className="font-ui text-[11px] text-[#E85538]">!</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Archive */}
        <div className="px-4 py-4">
          <button
            onClick={async () => { await archiveGoal({ id: goal._id }); onClose(); }}
            className="flex items-center gap-1.5 font-ui text-[11px] text-[#C4C4C2] hover:text-[#E85538] transition-colors"
          >
            <Trash2 size={11} />
            Archive goal
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Goal Card ─────────────────────────────────────────────────────────────────

interface GoalCardProps {
  goal: Goal;
  area?: { name: string; icon?: string; color: string };
  childCount: number;
  isSelected: boolean;
  isChildOfSelected: boolean;
  isDetailOpen: boolean;
  onClick: () => void;
  onEdit: () => void;
  onOpenDetail: () => void;
}

function GoalCard({ goal, area, childCount, isSelected, isChildOfSelected, isDetailOpen, onClick, onEdit, onOpenDetail }: GoalCardProps) {
  const p       = pct(goal);
  const pColor  = progressColor(p);
  const status  = STATUS_META[goal.status];
  const isOver  = goal.dueDate && goal.dueDate < Date.now() && goal.status === "active";

  return (
    <div
      onClick={() => { onClick(); onOpenDetail(); }}
      className={cn(
        "rounded border cursor-pointer transition-all group relative overflow-hidden",
        isDetailOpen
          ? "border-[#2383E2] bg-[#2383E208]"
          : isSelected
            ? "border-[#4A9EE0] bg-[#4A9EE010]"
            : isChildOfSelected
              ? "border-[#E3E3E1] bg-[#F7F7F5]"
              : "border-[#E3E3E1] bg-[#F7F7F5] hover:border-[#D5D5D3]"
      )}
      style={isChildOfSelected ? { borderLeftWidth: 2, borderLeftColor: area?.color ?? "#4A9EE0" } : undefined}
    >
      {/* Area color top bar */}
      {area && <div className="h-0.5 w-full" style={{ backgroundColor: area.color }} />}

      <div className="px-3 pt-2.5 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className={cn(
            "font-ui text-[13px] font-medium leading-snug flex-1",
            goal.status === "achieved" ? "text-[#4CAF6B]" : "text-[#191919]"
          )}>
            {goal.title}
          </p>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="opacity-0 group-hover:opacity-100 shrink-0 text-[#C4C4C2] hover:text-[#9B9A97] transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
        </div>

        {goal.targetValue !== undefined && (
          <div className="mb-2.5">
            <div className="h-1 bg-[#E3E3E1] rounded-full overflow-hidden mb-1">
              <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, backgroundColor: pColor }} />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-ui text-[11px] text-[#9B9A97]">
                {goal.currentValue !== undefined ? fmtValue(goal.currentValue) : "0"}
                {goal.targetMetric ? ` ${goal.targetMetric}` : ""}
              </span>
              <span className="font-ui text-[11px] font-semibold tabular-nums" style={{ color: pColor }}>{p}%</span>
              <span className="font-ui text-[11px] text-[#C4C4C2]">
                {fmtValue(goal.targetValue)}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 font-ui text-[11px]" style={{ color: status.color }}>
            {status.icon} {status.label}
          </span>
          {area && (
            <span className="font-ui text-[11px] px-1.5 py-0.5 rounded" style={{ color: area.color, backgroundColor: `${area.color}18` }}>
              {area.icon} {area.name}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {childCount > 0 && (
              <span className="flex items-center gap-0.5 font-ui text-[11px] text-[#C4C4C2]">
                <ChevronRight size={9} />{childCount}
              </span>
            )}
            {goal.dueDate && (
              <span className={cn("flex items-center gap-1 font-ui text-[11px]", isOver ? "text-[#E85538]" : "text-[#C4C4C2]")}>
                <Calendar size={9} />
                {format(new Date(goal.dueDate), "MMM yy")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Cascade Column ─────────────────────────────────────────────────────────────

interface ColumnProps {
  timeframe: Timeframe;
  goals: Goal[];
  allGoals: Goal[];
  areas: Record<string, { name: string; icon?: string; color: string }>;
  selected: Record<Timeframe, string | null>;
  detailGoalId: string | null;
  onSelect: (tf: Timeframe, id: string | null) => void;
  onAddGoal: (tf: Timeframe, parentId?: Id<"goals">) => void;
  onEditGoal: (goal: Goal) => void;
  onOpenDetail: (id: string) => void;
}

function CascadeColumn({ timeframe, goals, allGoals, areas, selected, detailGoalId, onSelect, onAddGoal, onEditGoal, onOpenDetail }: ColumnProps) {
  const tf      = TIMEFRAMES.find((t) => t.id === timeframe)!;
  const order: Timeframe[] = ["yearly", "quarterly", "monthly", "weekly"];
  const myIdx   = order.indexOf(timeframe);
  const prevTf  = myIdx > 0 ? order[myIdx - 1] : null;
  const selPrev = prevTf ? selected[prevTf] : null;

  const filtered = selPrev ? goals.filter((g) => g.parentGoalId === selPrev) : goals;
  const selectedId = selected[timeframe];

  const childCountMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const g of allGoals) {
      if (g.parentGoalId) m[g.parentGoalId] = (m[g.parentGoalId] ?? 0) + 1;
    }
    return m;
  }, [allGoals]);

  const defaultParentId = selPrev
    ? allGoals.find((g) => g._id === selPrev)?._id
    : undefined;

  return (
    <div className="w-[255px] shrink-0 flex flex-col h-full">
      <div className="flex items-center justify-between px-1 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#9B9A97] font-medium">{tf.label}</span>
          <span className="font-ui text-[11px] text-[#C4C4C2] bg-[#F0F0EE] border border-[#E3E3E1] px-1.5 py-0.5 rounded-full">
            {filtered.length}
          </span>
        </div>
        {selPrev && <span className="font-ui text-[11px] text-[#4A9EE040] italic">filtered</span>}
      </div>

      <div className="h-px bg-[#E3E3E1] mb-3" />

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
        {filtered.length === 0 ? (
          <div className="border border-dashed border-[#E8E8E6] rounded p-4 text-center">
            <p className="font-ui text-[11px] text-[#C4C4C2]">
              {selPrev ? `No ${tf.label.toLowerCase()} goals yet` : `No ${tf.label.toLowerCase()} goals`}
            </p>
          </div>
        ) : (
          filtered.map((g) => (
            <GoalCard
              key={g._id}
              goal={g}
              area={areas[g.areaId]}
              childCount={childCountMap[g._id] ?? 0}
              isSelected={selectedId === g._id}
              isChildOfSelected={!!selPrev && g.parentGoalId === selPrev}
              isDetailOpen={detailGoalId === g._id}
              onClick={() => onSelect(timeframe, selectedId === g._id ? null : g._id)}
              onEdit={() => onEditGoal(g)}
              onOpenDetail={() => onOpenDetail(g._id)}
            />
          ))
        )}
      </div>

      <button
        onClick={() => onAddGoal(timeframe, defaultParentId as Id<"goals"> | undefined)}
        className="mt-3 flex items-center gap-1.5 px-2 py-1.5 rounded border border-dashed border-[#E3E3E1] font-ui text-[12px] text-[#C4C4C2] hover:text-[#9B9A97] hover:border-[#D5D5D3] w-full transition-colors shrink-0"
      >
        <Plus size={11} />
        Add {tf.label.toLowerCase()} goal
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GoalsPage() {
  const { userId } = useCurrentUser();
  const goals  = useQuery(api.goals.listByUser, userId ? { userId } : "skip") ?? [];
  const areas  = useQuery(api.areas.list,       userId ? { userId } : "skip") ?? [];
  const tasks  = useQuery(api.tasks.listByUser, userId ? { userId } : "skip") ?? [];

  const [areaFilter,   setAreaFilter]   = useState<string>("all");
  const [selected,     setSelected]     = useState<Record<Timeframe, string | null>>({
    yearly: null, quarterly: null, monthly: null, weekly: null,
  });
  const [detailGoalId, setDetailGoalId] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    open: boolean; timeframe?: Timeframe; parentId?: Id<"goals">; goal?: Goal; defaultAreaId?: Id<"areas">;
  }>({ open: false });
  const [wizard, setWizard] = useState<{ open: boolean; defaultAreaId?: Id<"areas"> }>({ open: false });

  const areaMap = useMemo(() =>
    Object.fromEntries(areas.map((a) => [a._id, a])), [areas]);

  const filtered = areaFilter === "all" ? goals : goals.filter((g) => g.areaId === areaFilter);

  const byTimeframe: Record<Timeframe, Goal[]> = {
    yearly:    filtered.filter((g) => g.timeframe === "yearly"),
    quarterly: filtered.filter((g) => g.timeframe === "quarterly"),
    monthly:   filtered.filter((g) => g.timeframe === "monthly"),
    weekly:    filtered.filter((g) => g.timeframe === "weekly"),
  };

  const flatGoals  = filtered.filter((g) => !g.timeframe);
  const hasCascade = goals.some((g) => g.timeframe);

  const selectedGoal = Object.values(selected).reduce<Goal | null>((acc, id) => {
    if (!id) return acc;
    return goals.find((g) => g._id === id) ?? acc;
  }, null);

  const detailGoal = detailGoalId ? (goals.find((g) => g._id === detailGoalId) ?? null) : null;

  const detailRelatedTasks = detailGoal
    ? tasks.filter((t) => t.goalId === detailGoal._id && t.status !== "done")
    : [];

  const handleSelect = (tf: Timeframe, id: string | null) => {
    const order: Timeframe[] = ["yearly", "quarterly", "monthly", "weekly"];
    const idx  = order.indexOf(tf);
    const next = { ...selected };
    for (let i = idx; i < order.length; i++) next[order[i]] = null;
    next[tf] = id;
    setSelected(next);
  };

  return (
    <div className="h-full flex flex-col bg-[#FFFFFF]">

      {/* Header */}
      <div className="px-7 py-5 border-b border-[#E3E3E1] shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-ui text-[22px] font-semibold text-[#191919] [text-wrap:balance]">Goals</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWizard({ open: true })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2383E2] rounded font-ui text-[13px] font-medium text-[#FFFFFF] hover:bg-[#D9B85C] transition-colors"
            >
              <Plus size={13} />
              Yearly Goal
            </button>
            <button
              onClick={() => setModal({ open: true })}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F7F7F5] border border-[#E3E3E1] rounded font-ui text-[13px] font-medium text-[#6F6E69] hover:text-[#191919] hover:border-[#D5D5D3] transition-colors"
            >
              <Plus size={13} />
              New Goal
            </button>
          </div>
        </div>

        {/* Area filter */}
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setAreaFilter("all")}
            className={cn(
              "px-3 py-1 rounded font-ui text-[12px] transition-colors",
              areaFilter === "all" ? "bg-[#E8E8E6] text-[#191919]" : "text-[#9B9A97] hover:text-[#6F6E69] hover:bg-[#F0F0EE]"
            )}
          >
            All areas
          </button>
          {areas.map((a) => (
            <button
              key={a._id}
              onClick={() => setAreaFilter(a._id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded font-ui text-[12px] transition-colors",
                areaFilter === a._id ? "bg-[#E8E8E6] text-[#191919]" : "text-[#9B9A97] hover:text-[#6F6E69] hover:bg-[#F0F0EE]"
              )}
            >
              {a.icon && <span className="text-[12px]">{a.icon}</span>}
              {a.name}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex min-h-0">

        {/* Main board area */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">

        {hasCascade ? (
          /* ── Cascade board ── */
          <div className="flex-1 overflow-auto p-6 min-h-0">
            <div className="flex gap-4 h-full" style={{ minWidth: "max-content" }}>
              {(["yearly", "quarterly", "monthly", "weekly"] as Timeframe[]).map((tf, i) => (
                <div key={tf} className="flex gap-4 h-full">
                  <CascadeColumn
                    timeframe={tf}
                    goals={byTimeframe[tf]}
                    allGoals={filtered}
                    areas={areaMap}
                    selected={selected}
                    detailGoalId={detailGoalId}
                    onSelect={handleSelect}
                    onAddGoal={(tf, parentId) => {
                      if (tf === "yearly" && !parentId) {
                        setWizard({ open: true });
                      } else {
                        setModal({ open: true, timeframe: tf, parentId });
                      }
                    }}
                    onEditGoal={(g) => setModal({ open: true, goal: g })}
                    onOpenDetail={(id) => setDetailGoalId(detailGoalId === id ? null : id)}
                  />
                  {i < 3 && (
                    <div className="flex items-start pt-8 shrink-0">
                      <ChevronRight size={14} className="text-[#E3E3E1]" />
                    </div>
                  )}
                </div>
              ))}

              {/* Flat goals appendix */}
              {flatGoals.length > 0 && (
                <div className="flex gap-4">
                  <div className="w-px bg-[#E3E3E1] self-stretch mx-2" />
                  <div className="w-[255px] shrink-0">
                    <div className="flex items-center gap-2 px-1 pb-2">
                      <span className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#C4C4C2] font-medium">General</span>
                      <span className="font-ui text-[11px] text-[#C4C4C2] bg-[#F0F0EE] border border-[#E3E3E1] px-1.5 py-0.5 rounded-full">{flatGoals.length}</span>
                    </div>
                    <div className="h-px bg-[#E8E8E6] mb-3" />
                    <div className="space-y-2">
                      {flatGoals.map((g) => (
                        <GoalCard
                          key={g._id}
                          goal={g}
                          area={areaMap[g.areaId]}
                          childCount={0}
                          isSelected={false}
                          isChildOfSelected={false}
                          isDetailOpen={detailGoalId === g._id}
                          onClick={() => {}}
                          onEdit={() => setModal({ open: true, goal: g })}
                          onOpenDetail={() => setDetailGoalId(detailGoalId === g._id ? null : g._id)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Empty state ── */
          <div className="flex-1 overflow-auto p-6">
            <div className="max-w-lg mx-auto text-center py-12">
              <Target size={36} className="text-[#C4C4C2] mx-auto mb-4" />
              <p className="font-ui text-[16px] font-semibold text-[#191919] mb-2">Set your first yearly goal</p>
              <p className="font-ui text-[13px] text-[#9B9A97] mb-8 leading-relaxed">
                Start with a big yearly goal — like hitting $500k revenue or reaching 10% body fat. Then break it down into quarterly, monthly, and weekly milestones to see how daily actions connect to your biggest ambitions.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                {areas.slice(0, 4).map((a) => (
                  <button
                    key={a._id}
                    onClick={() => setWizard({ open: true, defaultAreaId: a._id })}
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#F7F7F5] border border-[#E3E3E1] rounded font-ui text-[13px] text-[#6F6E69] hover:border-[#D5D5D3] hover:text-[#191919] transition-colors"
                  >
                    {a.icon && <span>{a.icon}</span>}
                    {a.name}
                    <Plus size={12} className="text-[#C4C4C2]" />
                  </button>
                ))}
              </div>
              {flatGoals.length > 0 && (
                <p className="font-ui text-[11px] text-[#C4C4C2] mt-8 mb-4">
                  Existing goals without timeframes (click edit to assign them):
                </p>
              )}
            </div>

            {flatGoals.length > 0 && (
              <div className="max-w-xl mx-auto space-y-2">
                {flatGoals.map((g) => (
                  <GoalCard
                    key={g._id}
                    goal={g}
                    area={areaMap[g.areaId]}
                    childCount={0}
                    isSelected={false}
                    isChildOfSelected={false}
                    isDetailOpen={detailGoalId === g._id}
                    onClick={() => {}}
                    onEdit={() => setModal({ open: true, goal: g })}
                    onOpenDetail={() => setDetailGoalId(detailGoalId === g._id ? null : g._id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        </div>{/* end main board */}

        {/* Detail panel */}
        {detailGoal && (
          <GoalDetailPanel
            key={detailGoal._id}
            goal={detailGoal}
            allGoals={goals}
            areas={areaMap}
            relatedTasks={detailRelatedTasks}
            onClose={() => setDetailGoalId(null)}
            onEdit={() => setModal({ open: true, goal: detailGoal })}
            onAddChild={() => {
              const order: Timeframe[] = ["yearly", "quarterly", "monthly", "weekly"];
              const idx = detailGoal.timeframe ? order.indexOf(detailGoal.timeframe) : -1;
              const childTf = idx >= 0 && idx < 3 ? order[idx + 1] : undefined;
              setModal({ open: true, timeframe: childTf, parentId: detailGoal._id });
            }}
          />
        )}
      </div>

      {wizard.open && (
        <YearlyGoalWizard
          userId={userId ?? ""}
          areas={areas}
          defaultAreaId={
            wizard.defaultAreaId ??
            (areaFilter !== "all" ? areaFilter as Id<"areas"> : undefined)
          }
          onClose={() => setWizard({ open: false })}
        />
      )}

      {modal.open && (
        <GoalModal
          userId={userId ?? ""}
          areas={areas}
          goal={modal.goal}
          defaultTimeframe={modal.timeframe}
          defaultParentId={modal.parentId}
          defaultAreaId={
            modal.goal?.areaId ??
            modal.defaultAreaId ??
            (areaFilter !== "all" ? areaFilter as Id<"areas"> : undefined)
          }
          parentGoals={goals}
          onClose={() => setModal({ open: false })}
        />
      )}
    </div>
  );
}
