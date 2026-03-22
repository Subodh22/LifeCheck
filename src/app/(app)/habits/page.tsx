"use client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useState, useMemo } from "react";
import { format, addWeeks, startOfWeek, addDays } from "date-fns";
import {
  ChevronLeft, ChevronRight, Plus, X, Check, MoreHorizontal,
  ArrowRight, ArrowLeft, Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const QUARTER_LABELS = ["Q1","Q2","Q3","Q4"];
const QUARTER_STARTS = ["01","04","07","10"]; // ISO month of each quarter start
const QUARTER_RANGES = ["Jan–Mar","Apr–Jun","Jul–Sep","Oct–Dec"];
const DOW_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

const FREQ_CONFIG = {
  daily:     { label: "Daily",     sub: "True habit — daily automaticity",            accent: "#4A9EE0" },
  weekly:    { label: "Weekly",    sub: "Habit — one or more sessions per week",       accent: "#4CAF6B" },
  monthly:   { label: "Monthly",   sub: "Ritual — deliberate monthly practice",        accent: "#2563EB" },
  quarterly: { label: "Quarterly", sub: "Review — quarterly reflection or checkpoint", accent: "#E8A838" },
  yearly:    { label: "Yearly",    sub: "Milestone — annual commitment or review",     accent: "#E85538" },
} as const;

type Freq = keyof typeof FREQ_CONFIG;
type TimeOfDay = "morning" | "midday" | "evening" | "anytime";

// ── Date helpers ──────────────────────────────────────────────────────────────

function toIso(d: Date) {
  return d.toISOString().split("T")[0];
}

function getWeekDays(offset: number) {
  const monday = startOfWeek(addWeeks(new Date(), offset), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const TODAY = toIso(new Date());
const CURRENT_YEAR = new Date().getFullYear();

function monthCanonical(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}
function quarterCanonical(year: number, q: number) {
  return `${year}-${QUARTER_STARTS[q]}-01`;
}
function yearCanonical(year: number) {
  return `${year}-01-01`;
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function DayCell({
  done, isToday, isFuture, onToggle,
}: {
  done: boolean; isToday: boolean; isFuture: boolean; onToggle: () => void;
}) {
  return (
    <button
      onClick={isFuture ? undefined : onToggle}
      disabled={isFuture}
      className={cn(
        "w-7 h-7 rounded-full border flex items-center justify-center transition-all",
        done
          ? "bg-[#4CAF6B] border-[#4CAF6B] text-[#FFFFFF]"
          : isToday
            ? "border-[#4A9EE0] text-[#4A9EE0] hover:bg-[#4A9EE018]"
            : isFuture
              ? "border-[#E2E8F0] text-[#E2E8F0] cursor-not-allowed"
              : "border-[#E2E8F0] text-[#94A3B8] hover:border-[#64748B]"
      )}
    >
      {done && <Check size={11} strokeWidth={2.5} />}
    </button>
  );
}

function SessionDots({ completed, target, onAdd, onRemove }: {
  completed: number; target: number; onAdd: () => void; onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: target }, (_, i) => (
          <button
            key={i}
            onClick={i < completed ? onRemove : onAdd}
            className={cn(
              "w-5 h-5 rounded-full border transition-all",
              i < completed ? "bg-[#4CAF6B] border-[#4CAF6B]" : "border-[#E2E8F0] hover:border-[#4CAF6B]"
            )}
          />
        ))}
      </div>
      <span className={cn("font-ui text-[11px] tabular-nums", completed >= target ? "text-[#4CAF6B]" : "text-[#64748B]")}>
        {completed}/{target}
      </span>
    </div>
  );
}

function PeriodCell({ label, sub, done, isFuture, onToggle, accent }: {
  label: string; sub?: string; done: boolean; isFuture: boolean; onToggle: () => void; accent: string;
}) {
  return (
    <button
      onClick={isFuture ? undefined : onToggle}
      disabled={isFuture}
      className={cn(
        "flex flex-col items-center justify-center gap-1 px-3 py-2.5 rounded border transition-all min-w-[52px]",
        done
          ? "border-[#4CAF6B] bg-[#4CAF6B18] text-[#4CAF6B]"
          : isFuture
            ? "border-[#E2E8F0] text-[#E2E8F0] cursor-not-allowed"
            : "border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1] hover:text-[#475569]"
      )}
      style={done ? {} : { borderColor: undefined }}
    >
      <span className="font-ui text-[12px] font-medium">{label}</span>
      {sub && <span className="font-ui text-[10px] opacity-60">{sub}</span>}
      {done && <Check size={10} strokeWidth={2.5} />}
    </button>
  );
}

// ── 5-Step Habit Wizard ───────────────────────────────────────────────────────

interface WizardProps {
  userId: string;
  areas: { _id: Id<"areas">; name: string; icon?: string; color: string }[];
  initialFreq: Freq;
  onClose: () => void;
}

function HabitWizard({ userId, areas, initialFreq, onClose }: WizardProps) {
  const create = useMutation(api.habits.create);
  const [step, setStep] = useState<1|2|3|4|5>(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [areaId, setAreaId] = useState<Id<"areas"> | "">(areas[0]?._id ?? "");
  const [identity, setIdentity] = useState("");
  // Step 2
  const [title, setTitle] = useState("");
  const [freq, setFreq] = useState<Freq>(initialFreq);
  // Step 3
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("anytime");
  const [anchor, setAnchor] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [targetDays, setTargetDays] = useState(3);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [monthOfQuarter, setMonthOfQuarter] = useState(1);
  const [month, setMonth] = useState(1);
  // Step 4
  const [obstacle, setObstacle] = useState("");
  const [ifThen, setIfThen] = useState("");
  // Step 5
  const [minimum, setMinimum] = useState("");

  const config = FREQ_CONFIG[freq];

  const canNext: Record<number, boolean> = {
    1: !!areaId,
    2: !!title.trim(),
    3: true,
    4: true,
    5: true,
  };

  const handleSave = async () => {
    if (!title.trim() || !areaId) return;
    setSaving(true);
    try {
      await create({
        userId,
        areaId: areaId as Id<"areas">,
        title: title.trim(),
        frequency: freq,
        targetDaysPerWeek: freq === "daily" ? 7 : freq === "weekly" ? targetDays : undefined,
        timeOfDay: (freq === "daily" || freq === "weekly") ? timeOfDay : undefined,
        anchor: anchor.trim() || undefined,
        dayOfWeek: freq === "weekly" ? dayOfWeek : undefined,
        dayOfMonth: freq === "monthly" ? dayOfMonth : undefined,
        monthOfQuarter: freq === "quarterly" ? monthOfQuarter : undefined,
        month: freq === "yearly" ? month : undefined,
        identityStatement: identity.trim() || undefined,
        obstacle: obstacle.trim() || undefined,
        ifThenPlan: ifThen.trim() || undefined,
        minimumVersion: minimum.trim() || undefined,
      });
      onClose();
    } finally { setSaving(false); }
  };

  const STEP_LABELS = ["Identity", "Behavior", "Schedule", "Obstacles", "Safety net"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[500px] bg-[#FFFFFF] border border-[#E2E8F0] rounded-lg overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
          <div>
            <p className="font-ui text-[14px] font-semibold text-[#0F172A]">New Routine</p>
            <p className="font-ui text-[11px] text-[#64748B] mt-0.5">{STEP_LABELS[step - 1]} · Step {step} of 5</p>
          </div>
          <button onClick={onClose} className="text-[#64748B] hover:text-[#0F172A] transition-colors"><X size={14} /></button>
        </div>

        {/* Progress bar */}
        <div className="h-[2px] bg-[#EFF6FF]">
          <div
            className="h-full bg-[#2563EB] transition-all duration-300"
            style={{ width: `${(step / 5) * 100}%` }}
          />
        </div>

        {/* Step content */}
        <div className="px-5 py-5 min-h-[280px]">

          {/* ── Step 1: Identity & Area ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <p className="font-ui text-[13px] text-[#0F172A] mb-1">Which area of your life is this for?</p>
                <p className="font-ui text-[11px] text-[#64748B] mb-3">
                  Habits work best when rooted in a clear life domain.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {areas.map((a) => (
                    <button
                      key={a._id}
                      onClick={() => setAreaId(a._id)}
                      className={cn(
                        "flex items-center gap-2.5 px-3 py-2.5 rounded border text-left transition-colors",
                        areaId === a._id
                          ? "border-[#2563EB] bg-[#2563EB0F]"
                          : "border-[#E2E8F0] hover:border-[#CBD5E1]"
                      )}
                    >
                      {a.icon ? (
                        <span className="text-[14px]">{a.icon}</span>
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: a.color }} />
                      )}
                      <span className="font-ui text-[13px] text-[#0F172A] truncate">{a.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#64748B] mb-1.5 block">
                  Identity (optional — Clear 2018)
                </label>
                <div className="flex items-center gap-0 bg-[#FFFFFF] border border-[#E2E8F0] rounded overflow-hidden focus-within:border-[#CBD5E1]">
                  <span className="font-ui text-[12px] text-[#94A3B8] pl-3 shrink-0 whitespace-nowrap">I am becoming someone who</span>
                  <input
                    value={identity}
                    onChange={(e) => setIdentity(e.target.value)}
                    placeholder="meditates daily"
                    className="flex-1 bg-transparent px-2 py-2.5 font-ui text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none"
                  />
                </div>
                <p className="font-ui text-[11px] text-[#94A3B8] mt-1.5">
                  Identity-based framing increases long-term habit retention (Clear 2018).
                </p>
              </div>
            </div>
          )}

          {/* ── Step 2: Behavior & Cadence ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#64748B] mb-1.5 block">
                  Specific behavior
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Meditate for 10 minutes"
                  autoFocus
                  className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded px-3 py-2.5 font-ui text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#CBD5E1]"
                />
                <p className="font-ui text-[11px] text-[#94A3B8] mt-1.5">
                  Be specific. "Exercise" fails. "30-min walk after lunch" succeeds (Gollwitzer 1999).
                </p>
              </div>

              <div>
                <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#64748B] mb-2 block">
                  Cadence
                </label>
                <div className="space-y-1.5">
                  {(Object.keys(FREQ_CONFIG) as Freq[]).map((f) => {
                    const c = FREQ_CONFIG[f];
                    return (
                      <button
                        key={f}
                        onClick={() => setFreq(f)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded border text-left transition-colors",
                          freq === f ? "border-[#2563EB] bg-[#2563EB0F]" : "border-[#E2E8F0] hover:border-[#CBD5E1]"
                        )}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: freq === f ? c.accent : "#E2E8F0" }}
                        />
                        <div>
                          <p className="font-ui text-[13px] text-[#0F172A]">{c.label}</p>
                          <p className="font-ui text-[11px] text-[#64748B]">{c.sub}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Schedule ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <p className="font-ui text-[13px] text-[#0F172A] mb-1">When will you do this?</p>
                <p className="font-ui text-[11px] text-[#64748B] mb-4">
                  Specificity doubles follow-through. "Monday morning" outperforms "sometime this week" (Gollwitzer 1999).
                </p>
              </div>

              {/* Daily schedule */}
              {freq === "daily" && (
                <div className="space-y-4">
                  <div>
                    <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#64748B] mb-2 block">Time of day</label>
                    <div className="grid grid-cols-4 gap-2">
                      {(["morning","midday","evening","anytime"] as TimeOfDay[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTimeOfDay(t)}
                          className={cn(
                            "py-2 rounded border font-ui text-[12px] capitalize transition-colors",
                            timeOfDay === t ? "border-[#4A9EE0] text-[#4A9EE0] bg-[#4A9EE018]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#64748B] mb-1.5 block">
                      Anchor cue (Fogg 2020)
                    </label>
                    <div className="flex items-center gap-0 bg-[#FFFFFF] border border-[#E2E8F0] rounded overflow-hidden focus-within:border-[#CBD5E1]">
                      <span className="font-ui text-[12px] text-[#94A3B8] pl-3 shrink-0">After I</span>
                      <input
                        value={anchor}
                        onChange={(e) => setAnchor(e.target.value)}
                        placeholder="drink my morning coffee"
                        className="flex-1 bg-transparent px-2 py-2.5 font-ui text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none"
                      />
                    </div>
                    <p className="font-ui text-[11px] text-[#94A3B8] mt-1.5">
                      Link to an existing routine. Stacking increases habit durability 2-3×.
                    </p>
                  </div>
                </div>
              )}

              {/* Weekly schedule */}
              {freq === "weekly" && (
                <div className="space-y-4">
                  <div>
                    <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#64748B] mb-2 block">Sessions per week</label>
                    <div className="flex items-center gap-1.5">
                      {[1,2,3,4,5,6,7].map((n) => (
                        <button
                          key={n}
                          onClick={() => setTargetDays(n)}
                          className={cn(
                            "w-9 h-9 rounded border font-ui text-[13px] font-medium transition-colors",
                            targetDays === n ? "border-[#2563EB] text-[#2563EB] bg-[#2563EB18]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]"
                          )}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#64748B] mb-2 block">Preferred day</label>
                    <div className="grid grid-cols-7 gap-1">
                      {DOW_LABELS.map((d, i) => (
                        <button
                          key={i}
                          onClick={() => setDayOfWeek(i)}
                          className={cn(
                            "py-2 rounded border font-ui text-[11px] transition-colors",
                            dayOfWeek === i ? "border-[#4CAF6B] text-[#4CAF6B] bg-[#4CAF6B18]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]"
                          )}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#64748B] mb-2 block">Time of day</label>
                    <div className="grid grid-cols-4 gap-2">
                      {(["morning","midday","evening","anytime"] as TimeOfDay[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => setTimeOfDay(t)}
                          className={cn(
                            "py-2 rounded border font-ui text-[12px] capitalize transition-colors",
                            timeOfDay === t ? "border-[#4A9EE0] text-[#4A9EE0] bg-[#4A9EE018]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]"
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Monthly schedule */}
              {freq === "monthly" && (
                <div className="space-y-4">
                  <div>
                    <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#64748B] mb-2 block">Day of month</label>
                    <div className="grid grid-cols-7 gap-1.5">
                      {Array.from({length: 28}, (_, i) => i + 1).map((d) => (
                        <button
                          key={d}
                          onClick={() => setDayOfMonth(d)}
                          className={cn(
                            "h-8 rounded border font-ui text-[12px] tabular-nums transition-colors",
                            dayOfMonth === d ? "border-[#2563EB] text-[#2563EB] bg-[#2563EB18]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]"
                          )}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                    <p className="font-ui text-[11px] text-[#94A3B8] mt-2">Capped at 28 to avoid month-end edge cases.</p>
                  </div>
                  <div>
                    <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#64748B] mb-1.5 block">Anchor (optional)</label>
                    <input
                      value={anchor}
                      onChange={(e) => setAnchor(e.target.value)}
                      placeholder="e.g. First Sunday of the month"
                      className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded px-3 py-2.5 font-ui text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#CBD5E1]"
                    />
                  </div>
                </div>
              )}

              {/* Quarterly schedule */}
              {freq === "quarterly" && (
                <div className="space-y-4">
                  <div>
                    <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#64748B] mb-2 block">Month within quarter</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[1,2,3].map((m) => (
                        <button
                          key={m}
                          onClick={() => setMonthOfQuarter(m)}
                          className={cn(
                            "py-3 rounded border font-ui text-[13px] transition-colors",
                            monthOfQuarter === m ? "border-[#E8A838] text-[#E8A838] bg-[#E8A83818]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]"
                          )}
                        >
                          Month {m}
                        </button>
                      ))}
                    </div>
                    <p className="font-ui text-[11px] text-[#94A3B8] mt-2">
                      Month 1 = Jan/Apr/Jul/Oct · Month 2 = Feb/May/Aug/Nov · Month 3 = Mar/Jun/Sep/Dec
                    </p>
                  </div>
                </div>
              )}

              {/* Yearly schedule */}
              {freq === "yearly" && (
                <div>
                  <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#64748B] mb-2 block">Month</label>
                  <div className="grid grid-cols-4 gap-2">
                    {MONTH_LABELS.map((m, i) => (
                      <button
                        key={i}
                        onClick={() => setMonth(i + 1)}
                        className={cn(
                          "py-2 rounded border font-ui text-[12px] transition-colors",
                          month === i + 1 ? "border-[#E85538] text-[#E85538] bg-[#E8553818]" : "border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]"
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: WOOP ── */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <p className="font-ui text-[13px] text-[#0F172A] mb-1">What will get in your way?</p>
                <p className="font-ui text-[11px] text-[#64748B] mb-4">
                  Mental contrasting (WOOP) outperforms positive thinking alone by 2× in forming durable habits (Oettingen 2014).
                </p>
              </div>
              <div>
                <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#64748B] mb-1.5 block">
                  Most likely obstacle
                </label>
                <input
                  value={obstacle}
                  onChange={(e) => setObstacle(e.target.value)}
                  placeholder="e.g. I feel tired and skip it"
                  className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded px-3 py-2.5 font-ui text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#CBD5E1]"
                />
              </div>
              <div>
                <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#64748B] mb-1.5 block">
                  If–then plan (Gollwitzer 1999)
                </label>
                <div className="flex items-center gap-0 bg-[#FFFFFF] border border-[#E2E8F0] rounded overflow-hidden focus-within:border-[#CBD5E1]">
                  <span className="font-ui text-[12px] text-[#94A3B8] pl-3 shrink-0 whitespace-nowrap">If {obstacle.trim() ? `"${obstacle.trim()}"` : "[obstacle]"}, then</span>
                  <input
                    value={ifThen}
                    onChange={(e) => setIfThen(e.target.value)}
                    placeholder="I will do 5 min instead"
                    className="flex-1 bg-transparent px-2 py-2.5 font-ui text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none"
                  />
                </div>
                <p className="font-ui text-[11px] text-[#94A3B8] mt-1.5">
                  Specific if-then plans improve follow-through by 200–300% (Gollwitzer &amp; Sheeran 2006).
                </p>
              </div>
            </div>
          )}

          {/* ── Step 5: Minimum Version ── */}
          {step === 5 && (
            <div className="space-y-4">
              <div>
                <p className="font-ui text-[13px] text-[#0F172A] mb-1">What is your "worst day" version?</p>
                <p className="font-ui text-[11px] text-[#64748B] mb-4">
                  Tiny Habits (Fogg 2020): define a minimum version for low-energy days. Keeping the chain unbroken matters more than intensity — missing twice in a row breaks habit formation (Lally et al. 2010).
                </p>
              </div>
              <div>
                <label className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#64748B] mb-1.5 block">
                  Minimum version — bad day fallback
                </label>
                <input
                  value={minimum}
                  onChange={(e) => setMinimum(e.target.value)}
                  placeholder={
                    freq === "daily" ? "e.g. 2 minutes only"
                    : freq === "weekly" ? "e.g. One 15-min session"
                    : freq === "monthly" ? "e.g. Just open the journal"
                    : "e.g. Read one page of notes"
                  }
                  className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded px-3 py-2.5 font-ui text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#CBD5E1]"
                />
              </div>

              {/* Summary */}
              <div className="bg-[#FFFFFF] border border-[#E2E8F0] rounded p-4 space-y-2">
                <p className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#94A3B8] mb-2">Summary</p>
                {identity && (
                  <p className="font-ui text-[12px] text-[#64748B]">
                    <span className="text-[#94A3B8]">Identity: </span>I am becoming someone who {identity}
                  </p>
                )}
                <p className="font-ui text-[12px] text-[#0F172A]">{title}</p>
                <p className="font-ui text-[12px] text-[#64748B]">
                  <span className="text-[#94A3B8]">Cadence: </span>{FREQ_CONFIG[freq].label}
                </p>
                {obstacle && (
                  <p className="font-ui text-[12px] text-[#64748B]">
                    <span className="text-[#94A3B8]">If obstacle: </span>{ifThen || "—"}
                  </p>
                )}
                {minimum && (
                  <p className="font-ui text-[12px] text-[#64748B]">
                    <span className="text-[#94A3B8]">Bad-day version: </span>{minimum}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#E2E8F0] flex items-center justify-between">
          <button
            onClick={() => step > 1 ? setStep((s) => (s - 1) as 1|2|3|4|5) : onClose()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#E2E8F0] font-ui text-[13px] text-[#64748B] hover:text-[#0F172A] transition-colors"
          >
            <ArrowLeft size={13} />
            {step === 1 ? "Cancel" : "Back"}
          </button>

          {step < 5 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as 1|2|3|4|5)}
              disabled={!canNext[step]}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-[#2563EB] font-ui text-[13px] font-medium text-[#FFFFFF] hover:bg-[#D4B55A] disabled:opacity-40 transition-colors"
            >
              Next
              <ArrowRight size={13} />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={!title.trim() || !areaId || saving}
              className="px-4 py-1.5 rounded bg-[#4CAF6B] font-ui text-[13px] font-medium text-[#FFFFFF] hover:bg-[#5DC07B] disabled:opacity-40 transition-colors"
            >
              {saving ? "Saving…" : "Create Routine"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type TabFreq = Freq;

export default function HabitsPage() {
  const { userId } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<TabFreq>("daily");
  const [weekOffset, setWeekOffset] = useState(0);
  const [yearOffset, setYearOffset] = useState(0);
  const [wizardOpen, setWizardOpen] = useState(false);

  const viewYear = CURRENT_YEAR + yearOffset;
  const yearStart = `${viewYear}-01-01`;
  const yearEnd   = `${viewYear}-12-31`;

  const weekDays  = getWeekDays(weekOffset);
  const weekStart = toIso(weekDays[0]);
  const weekEnd   = toIso(weekDays[6]);
  const isThisWeek = weekOffset === 0;

  const areas        = useQuery(api.areas.list,                          userId ? { userId } : "skip") ?? [];
  const habits       = useQuery(api.habits.list,                         userId ? { userId } : "skip") ?? [];
  const weekDone     = useQuery(api.habits.getHabitCompletionsForWeek,   userId ? { userId, weekStart, weekEnd } : "skip") ?? [];
  const yearDone     = useQuery(api.habits.getHabitCompletionsForYear,   userId ? { userId, yearStart, yearEnd } : "skip") ?? [];

  const toggleHabit  = useMutation(api.habits.toggleHabitCompletion);
  const archiveHabit = useMutation(api.habits.archive);

  const areaMap = useMemo(() => Object.fromEntries(areas.map((a) => [a._id, a])), [areas]);

  // Completion lookups
  const weekDoneSet = useMemo(() => new Set(weekDone.map((c) => `${c.habitId}:${c.completedDate}`)), [weekDone]);
  const yearDoneSet = useMemo(() => new Set(yearDone.map((c) => `${c.habitId}:${c.completedDate}`)), [yearDone]);

  const isWeekDone  = (hId: string, date: string) => weekDoneSet.has(`${hId}:${date}`);
  const isYearDone  = (hId: string, date: string) => yearDoneSet.has(`${hId}:${date}`);

  // Filtered by tab
  const tabHabits = useMemo(() => habits.filter((h) => h.frequency === activeTab), [habits, activeTab]);

  // Weekly session helpers
  const weekCount = (hId: string) => weekDone.filter((c) => c.habitId === hId).length;

  const logWeeklySession = async (habitId: Id<"habits">) => {
    if (!userId) return;
    for (const day of weekDays) {
      const iso = toIso(day);
      if (!isWeekDone(habitId, iso)) {
        await toggleHabit({ habitId, userId, date: iso });
        return;
      }
    }
  };
  const removeWeeklySession = async (habitId: Id<"habits">) => {
    if (!userId) return;
    const last = [...weekDone].filter((c) => c.habitId === habitId).sort((a, b) => b.completedDate.localeCompare(a.completedDate))[0];
    if (last) await toggleHabit({ habitId: last.habitId as Id<"habits">, userId, date: last.completedDate });
  };

  const tabs: { key: TabFreq; label: string }[] = [
    { key: "daily",     label: "Daily" },
    { key: "weekly",    label: "Weekly" },
    { key: "monthly",   label: "Monthly" },
    { key: "quarterly", label: "Quarterly" },
    { key: "yearly",    label: "Yearly" },
  ];

  const nowMonth   = new Date().getMonth() + 1;   // 1-12
  const nowQuarter = Math.ceil(nowMonth / 3) - 1; // 0-3
  const nowYear    = CURRENT_YEAR;

  return (
    <div className="h-full flex flex-col bg-[#FFFFFF]">

      {/* Header */}
      <div className="px-7 py-5 border-b border-[#E2E8F0] shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-ui text-[22px] font-semibold text-[#0F172A]">Habits &amp; Routines</h1>
          <button
            onClick={() => setWizardOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#2563EB] text-[#2563EB] rounded font-ui text-[12px] hover:bg-[rgba(37,99,235,0.10)] transition-colors"
          >
            <Plus size={12} />
            New Routine
          </button>
        </div>

        {/* Cadence tabs */}
        <div className="flex items-center gap-1">
          {tabs.map(({ key, label }) => {
            const count = habits.filter((h) => h.frequency === key).length;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded font-ui text-[12px] transition-colors",
                  activeTab === key
                    ? "bg-[#EFF6FF] text-[#0F172A]"
                    : "text-[#64748B] hover:text-[#475569] hover:bg-[#F1F5F9]"
                )}
              >
                {label}
                {count > 0 && (
                  <span className={cn("font-ui text-[11px] tabular-nums", activeTab === key ? "text-[#64748B]" : "text-[#94A3B8]")}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Period nav — week for daily/weekly, year for monthly/quarterly/yearly */}
        {(activeTab === "daily" || activeTab === "weekly") && (
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={() => setWeekOffset((v) => v - 1)}
              className="w-7 h-7 flex items-center justify-center rounded border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="font-ui text-[13px] text-[#0F172A] w-48 text-center">
              {format(weekDays[0], "d MMM")} – {format(weekDays[6], "d MMM yyyy")}
            </span>
            <button
              onClick={() => setWeekOffset((v) => v + 1)}
              disabled={weekOffset >= 0}
              className="w-7 h-7 flex items-center justify-center rounded border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className="font-ui text-[12px] text-[#4A9EE0] hover:text-[#5AAFF0] transition-colors">
                This week
              </button>
            )}
          </div>
        )}

        {(activeTab === "monthly" || activeTab === "quarterly" || activeTab === "yearly") && (
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={() => setYearOffset((v) => v - 1)}
              className="w-7 h-7 flex items-center justify-center rounded border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="font-ui text-[13px] text-[#0F172A] w-16 text-center tabular-nums">{viewYear}</span>
            <button
              onClick={() => setYearOffset((v) => v + 1)}
              disabled={yearOffset >= 0}
              className="w-7 h-7 flex items-center justify-center rounded border border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
            {yearOffset !== 0 && (
              <button onClick={() => setYearOffset(0)} className="font-ui text-[12px] text-[#4A9EE0] hover:text-[#5AAFF0] transition-colors">
                This year
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Daily tab ── */}
        {activeTab === "daily" && (
          <>
            {tabHabits.length > 0 && (
              <div>
                {/* Column headers */}
                <div className="grid grid-cols-[1fr_repeat(7,36px)_40px] gap-1 px-7 py-2 bg-[#FFFFFF] border-b border-[#E2E8F0] sticky top-0 z-10">
                  <div />
                  {weekDays.map((day, i) => {
                    const isToday = toIso(day) === TODAY;
                    return (
                      <div key={i} className="flex flex-col items-center gap-0.5">
                        <span className={cn("font-ui text-[11px] uppercase tracking-[0.08em]", isToday ? "text-[#4A9EE0]" : "text-[#94A3B8]")}>{DAY_LABELS[i]}</span>
                        <span className={cn("font-ui text-[11px] tabular-nums", isToday ? "text-[#4A9EE0] font-semibold" : "text-[#94A3B8]")}>{format(day, "d")}</span>
                      </div>
                    );
                  })}
                  <div />
                </div>
                {tabHabits.map((habit) => {
                  const area = areaMap[habit.areaId];
                  const doneThisWeek = weekDays.filter((d) => isWeekDone(habit._id, toIso(d))).length;
                  return (
                    <div key={habit._id} className="grid grid-cols-[1fr_repeat(7,36px)_40px] gap-1 px-7 py-3 border-b border-[#E2E8F0] hover:bg-[#FFFFFF] transition-colors items-center group">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {area?.icon && <span className="text-[13px] shrink-0">{area.icon}</span>}
                        <div className="min-w-0">
                          <p className="font-ui text-[13px] text-[#0F172A] truncate">{habit.title}</p>
                          {area && <p className="font-ui text-[11px] truncate" style={{ color: area.color }}>{area.name}</p>}
                        </div>
                        {habit.currentStreak > 0 && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Flame size={11} className="text-[#E8A838]" />
                            <span className="font-ui text-[11px] text-[#E8A838] tabular-nums">{habit.currentStreak}</span>
                          </div>
                        )}
                      </div>
                      {weekDays.map((day, i) => {
                        const iso = toIso(day);
                        return (
                          <div key={i} className="flex justify-center">
                            <DayCell
                              done={isWeekDone(habit._id, iso)}
                              isToday={iso === TODAY}
                              isFuture={isThisWeek && day > new Date()}
                              onToggle={() => userId && toggleHabit({ habitId: habit._id, userId, date: iso })}
                            />
                          </div>
                        );
                      })}
                      <button
                        onClick={() => archiveHabit({ id: habit._id })}
                        className="opacity-0 group-hover:opacity-100 flex justify-center text-[#94A3B8] hover:text-[#E85538] transition-all"
                      >
                        <MoreHorizontal size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Weekly tab ── */}
        {activeTab === "weekly" && (
          <>
            {tabHabits.map((habit) => {
              const area   = areaMap[habit.areaId];
              const done   = weekCount(habit._id);
              const target = habit.targetDaysPerWeek ?? 3;
              return (
                <div key={habit._id} className="flex items-center gap-4 px-7 py-4 border-b border-[#E2E8F0] hover:bg-[#FFFFFF] transition-colors group">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {area?.icon && <span className="text-[14px] shrink-0">{area.icon}</span>}
                    <div className="min-w-0">
                      <p className="font-ui text-[13px] text-[#0F172A] truncate">{habit.title}</p>
                      {area && <p className="font-ui text-[11px] truncate" style={{ color: area.color }}>{area.name}</p>}
                    </div>
                    {habit.currentStreak > 0 && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <Flame size={11} className="text-[#E8A838]" />
                        <span className="font-ui text-[11px] text-[#E8A838] tabular-nums">{habit.currentStreak}</span>
                      </div>
                    )}
                  </div>
                  <SessionDots
                    completed={done}
                    target={target}
                    onAdd={() => logWeeklySession(habit._id)}
                    onRemove={() => removeWeeklySession(habit._id)}
                  />
                  <button
                    onClick={() => archiveHabit({ id: habit._id })}
                    className="opacity-0 group-hover:opacity-100 text-[#94A3B8] hover:text-[#E85538] transition-all"
                  >
                    <MoreHorizontal size={13} />
                  </button>
                </div>
              );
            })}
          </>
        )}

        {/* ── Monthly tab ── */}
        {activeTab === "monthly" && (
          <>
            {tabHabits.map((habit) => {
              const area = areaMap[habit.areaId];
              return (
                <div key={habit._id} className="px-7 py-4 border-b border-[#E2E8F0] hover:bg-[#FFFFFF] transition-colors group">
                  <div className="flex items-center gap-2.5 mb-3">
                    {area?.icon && <span className="text-[14px]">{area.icon}</span>}
                    <div className="flex-1 min-w-0">
                      <p className="font-ui text-[13px] text-[#0F172A] truncate">{habit.title}</p>
                      {area && <p className="font-ui text-[11px]" style={{ color: area.color }}>{area.name}</p>}
                    </div>
                    <button
                      onClick={() => archiveHabit({ id: habit._id })}
                      className="opacity-0 group-hover:opacity-100 text-[#94A3B8] hover:text-[#E85538] transition-all"
                    >
                      <MoreHorizontal size={13} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {Array.from({ length: 12 }, (_, i) => {
                      const m = i + 1;
                      const canonical = monthCanonical(viewYear, m);
                      const done = isYearDone(habit._id, canonical);
                      const isFuture = viewYear === nowYear && m > nowMonth;
                      const isCurrent = viewYear === nowYear && m === nowMonth;
                      return (
                        <button
                          key={m}
                          onClick={isFuture ? undefined : () => userId && toggleHabit({ habitId: habit._id, userId, date: canonical })}
                          disabled={isFuture}
                          className={cn(
                            "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded border transition-all",
                            done ? "border-[#4CAF6B] bg-[#4CAF6B18] text-[#4CAF6B]"
                              : isFuture ? "border-[#E2E8F0] text-[#E2E8F0] cursor-not-allowed"
                              : isCurrent ? "border-[#2563EB] text-[#2563EB]"
                              : "border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]"
                          )}
                        >
                          <span className="font-ui text-[11px]">{MONTH_LABELS[i]}</span>
                          {done && <Check size={9} strokeWidth={2.5} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ── Quarterly tab ── */}
        {activeTab === "quarterly" && (
          <>
            {tabHabits.map((habit) => {
              const area = areaMap[habit.areaId];
              return (
                <div key={habit._id} className="px-7 py-4 border-b border-[#E2E8F0] hover:bg-[#FFFFFF] transition-colors group">
                  <div className="flex items-center gap-2.5 mb-3">
                    {area?.icon && <span className="text-[14px]">{area.icon}</span>}
                    <div className="flex-1 min-w-0">
                      <p className="font-ui text-[13px] text-[#0F172A] truncate">{habit.title}</p>
                      {area && <p className="font-ui text-[11px]" style={{ color: area.color }}>{area.name}</p>}
                    </div>
                    <button
                      onClick={() => archiveHabit({ id: habit._id })}
                      className="opacity-0 group-hover:opacity-100 text-[#94A3B8] hover:text-[#E85538] transition-all"
                    >
                      <MoreHorizontal size={13} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    {QUARTER_LABELS.map((ql, q) => {
                      const canonical = quarterCanonical(viewYear, q);
                      const done = isYearDone(habit._id, canonical);
                      const isFuture = viewYear === nowYear && q > nowQuarter;
                      const isCurrent = viewYear === nowYear && q === nowQuarter;
                      return (
                        <button
                          key={q}
                          onClick={isFuture ? undefined : () => userId && toggleHabit({ habitId: habit._id, userId, date: canonical })}
                          disabled={isFuture}
                          className={cn(
                            "flex flex-col items-center gap-1 px-5 py-3 rounded border transition-all",
                            done ? "border-[#4CAF6B] bg-[#4CAF6B18] text-[#4CAF6B]"
                              : isFuture ? "border-[#E2E8F0] text-[#E2E8F0] cursor-not-allowed"
                              : isCurrent ? "border-[#E8A838] text-[#E8A838]"
                              : "border-[#E2E8F0] text-[#64748B] hover:border-[#CBD5E1]"
                          )}
                        >
                          <span className="font-ui text-[13px] font-medium">{ql}</span>
                          <span className="font-ui text-[10px] opacity-60">{QUARTER_RANGES[q]}</span>
                          {done && <Check size={10} strokeWidth={2.5} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ── Yearly tab ── */}
        {activeTab === "yearly" && (
          <>
            {tabHabits.map((habit) => {
              const area = areaMap[habit.areaId];
              const canonical = yearCanonical(viewYear);
              const done = isYearDone(habit._id, canonical);
              const isFuture = viewYear > nowYear;
              return (
                <div key={habit._id} className="flex items-center gap-4 px-7 py-4 border-b border-[#E2E8F0] hover:bg-[#FFFFFF] transition-colors group">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {area?.icon && <span className="text-[14px] shrink-0">{area.icon}</span>}
                    <div className="min-w-0">
                      <p className="font-ui text-[13px] text-[#0F172A] truncate">{habit.title}</p>
                      {area && <p className="font-ui text-[11px]" style={{ color: area.color }}>{area.name}</p>}
                    </div>
                  </div>
                  <button
                    onClick={isFuture ? undefined : () => userId && toggleHabit({ habitId: habit._id, userId, date: canonical })}
                    disabled={isFuture}
                    className={cn(
                      "w-8 h-8 rounded border flex items-center justify-center transition-all shrink-0",
                      done ? "bg-[#4CAF6B] border-[#4CAF6B] text-[#FFFFFF]"
                        : isFuture ? "border-[#E2E8F0] text-[#E2E8F0] cursor-not-allowed"
                        : "border-[#E2E8F0] text-[#94A3B8] hover:border-[#2563EB] hover:text-[#2563EB]"
                    )}
                  >
                    {done && <Check size={14} strokeWidth={2.5} />}
                  </button>
                  <button
                    onClick={() => archiveHabit({ id: habit._id })}
                    className="opacity-0 group-hover:opacity-100 text-[#94A3B8] hover:text-[#E85538] transition-all"
                  >
                    <MoreHorizontal size={13} />
                  </button>
                </div>
              );
            })}
          </>
        )}

        {/* Empty state */}
        {tabHabits.length === 0 && (
          <div className="px-7 py-20 flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded border border-[#E2E8F0] flex items-center justify-center mb-4">
              <Flame size={18} className="text-[#94A3B8]" />
            </div>
            <p className="font-ui text-[15px] text-[#64748B] mb-1">No {FREQ_CONFIG[activeTab].label.toLowerCase()} routines yet</p>
            <p className="font-ui text-[12px] text-[#94A3B8] mb-6 max-w-[280px]">
              {activeTab === "daily"     && "Daily habits build automaticity — the actions that happen without thinking (Clear 2018)."}
              {activeTab === "weekly"    && "Weekly habits form with consistent repetition across several months (Lally et al. 2010)."}
              {activeTab === "monthly"   && "Monthly rituals create deliberate touch points for reflection and renewal."}
              {activeTab === "quarterly" && "Quarterly reviews are the cornerstone of intentional progress tracking (OKR method)."}
              {activeTab === "yearly"    && "Annual milestones give direction to the year — set once, return to often."}
            </p>
            <button
              onClick={() => setWizardOpen(true)}
              className="flex items-center gap-2 px-4 py-2 border border-[#2563EB] text-[#2563EB] rounded font-ui text-[13px] hover:bg-[rgba(37,99,235,0.10)] transition-colors"
            >
              <Plus size={13} />
              Add {FREQ_CONFIG[activeTab].label} Routine
            </button>
          </div>
        )}
      </div>

      {wizardOpen && (
        <HabitWizard
          userId={userId ?? ""}
          areas={areas}
          initialFreq={activeTab}
          onClose={() => setWizardOpen(false)}
        />
      )}
    </div>
  );
}
