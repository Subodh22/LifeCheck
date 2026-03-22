"use client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Plus, Trash2, ChevronRight, ChevronLeft, Check, Zap, ArrowUp, Minus, RefreshCw } from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

type Frequency = "daily" | "weekly" | "once";
type Priority  = "urgent" | "high" | "medium" | "low";

interface WizardTask {
  id:        string;
  title:     string;
  frequency: Frequency;
  priority:  Priority;
  enabled:   boolean;
}

interface WizardArea {
  templateId:   string;
  name:         string;
  color:        string;
  icon:         string;
  category:     string;
  description:  string;
  goal:         string;
  metric:       string;
  currentValue: string;
  targetValue:  string;
  deadline:     string;
  tasks:        WizardTask[];
  goalStep:     boolean; // has user filled the goal yet
}

// ── Area templates ────────────────────────────────────────────────────────────

const AREA_TEMPLATES = [
  { id: "fitness",  name: "Health & Fitness", icon: "🏃", color: "#4CAF6B", category: "Health",        description: "Workouts, nutrition, wellness" },
  { id: "work",     name: "Work & Career",    icon: "💼", color: "#4A9EE0", category: "Work",           description: "Projects, career goals, deliverables" },
  { id: "guitar",   name: "Creative",         icon: "🎸", color: "#2563EB", category: "Creative",      description: "Music, art, writing, hobbies" },
  { id: "travel",   name: "Travel",           icon: "✈️", color: "#E85538", category: "Travel",        description: "Trips, adventures, planning" },
  { id: "finance",  name: "Finance",          icon: "💰", color: "#E8A838", category: "Finance",       description: "Budget, savings, investments" },
  { id: "learning", name: "Learning",         icon: "📚", color: "#9B59B6", category: "Learning",      description: "Courses, books, skills" },
  { id: "social",   name: "Relationships",    icon: "🤝", color: "#E8538A", category: "Relationships", description: "Family, friends, social goals" },
  { id: "home",     name: "Home & Life",      icon: "🏠", color: "#64748B", category: "Home",          description: "Household, admin, personal" },
];

// ── Smart task suggestions ───────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 8); }

function suggestTasks(templateId: string, goal: string, metric: string, targetValue: string): WizardTask[] {
  const g = goal.toLowerCase();
  const t = (title: string, frequency: Frequency, priority: Priority = "medium"): WizardTask =>
    ({ id: uid(), title, frequency, priority, enabled: true });

  // Fitness ─────────────────────────────────────────────────────────────────
  if (templateId === "fitness") {
    if (g.match(/body fat|fat|lean|shred|cut/)) {
      const cal = g.match(/(\d+)\s*cal/) ? g.match(/(\d+)\s*cal/)![1] : "2,200";
      return [
        t(`Hit ${cal} calorie target`,          "daily",  "high"),
        t("Log all meals",                       "daily",  "medium"),
        t("Walk 10,000 steps",                   "daily",  "low"),
        t("Drink 3L water",                      "daily",  "low"),
        t("Gym session",                         "weekly", "high"),
        t("Gym session",                         "weekly", "high"),
        t("Gym session",                         "weekly", "high"),
        t("Gym session",                         "weekly", "high"),
        t(`Measure ${metric || "body fat %"}`,  "weekly", "medium"),
        t("Find a workout program",              "once",   "high"),
        t("Calculate TDEE and calorie target",  "once",   "high"),
        t("Book a body scan / DEXA scan",        "once",   "medium"),
      ];
    }
    if (g.match(/run|5k|10k|marathon|cardio/)) {
      return [
        t("Morning run",                  "daily",  "high"),
        t("Stretching & warm-up",          "daily",  "low"),
        t("Long run",                      "weekly", "high"),
        t("Interval training session",     "weekly", "high"),
        t("Track run time & distance",     "weekly", "medium"),
        t("Buy proper running shoes",      "once",   "medium"),
        t("Register for target race",      "once",   "urgent"),
        t("Build a training plan",         "once",   "high"),
      ];
    }
    if (g.match(/muscle|bulk|strength|bench|squat|deadlift/)) {
      const target = targetValue ? `(target: ${targetValue}kg)` : "";
      return [
        t(`Gym — push day`,                            "weekly", "high"),
        t(`Gym — pull day`,                            "weekly", "high"),
        t(`Gym — leg day`,                             "weekly", "high"),
        t(`Gym — upper body ${target}`,               "weekly", "high"),
        t("Hit daily protein target (2g/kg)",          "daily",  "high"),
        t("Sleep 8 hours",                             "daily",  "medium"),
        t("Track lifts in notebook / app",             "daily",  "medium"),
        t("Weekly progress photo",                     "weekly", "low"),
        t("Find a powerlifting / hypertrophy program", "once",   "high"),
        t("Get bloodwork done",                        "once",   "medium"),
      ];
    }
    // Generic fitness
    return [
      t("Workout session",                  "weekly", "high"),
      t("Workout session",                  "weekly", "high"),
      t("Workout session",                  "weekly", "high"),
      t("Log nutrition",                    "daily",  "medium"),
      t("10-minute morning stretch",        "daily",  "low"),
      t(`Track ${metric || "progress"}`,   "weekly", "medium"),
      t("Create a training plan",           "once",   "high"),
    ];
  }

  // Work ────────────────────────────────────────────────────────────────────
  if (templateId === "work") {
    if (g.match(/revenue|mrr|arr|sales|customers/)) {
      return [
        t("Check revenue dashboard",           "daily",  "high"),
        t("Send 5 outreach / follow-up emails","daily",  "high"),
        t("Write one piece of content",        "daily",  "medium"),
        t("Customer interview or call",        "weekly", "high"),
        t("Review key metrics & KPIs",         "weekly", "high"),
        t("Update sales pipeline",             "weekly", "medium"),
        t("Set up analytics tracking",         "once",   "urgent"),
        t("Define 90-day growth plan",         "once",   "high"),
        t("Identify top 3 acquisition channels","once",  "high"),
      ];
    }
    if (g.match(/ship|launch|product|feature|deploy/)) {
      return [
        t("Review open pull requests",         "daily",  "high"),
        t("Daily standup notes",               "daily",  "medium"),
        t("Clear task board",                  "daily",  "low"),
        t("Sprint planning",                   "weekly", "high"),
        t("Retrospective",                     "weekly", "medium"),
        t("Release / deploy",                  "weekly", "high"),
        t("Write technical spec",              "once",   "high"),
        t("Set up CI/CD pipeline",             "once",   "medium"),
      ];
    }
    return [
      t("Review today's priorities",           "daily",  "high"),
      t("Clear email inbox",                   "daily",  "medium"),
      t("Weekly planning session",             "weekly", "high"),
      t("1:1 with manager / team",             "weekly", "medium"),
      t(`Define goal: ${goal}`,                "once",   "high"),
    ];
  }

  // Creative / Guitar ───────────────────────────────────────────────────────
  if (templateId === "guitar") {
    if (g.match(/guitar|bass|piano|instrument|music/)) {
      return [
        t("Practice session (30 min)",         "daily",  "high"),
        t("Scales & technique warmup",         "daily",  "medium"),
        t("Learn new song / section",          "weekly", "high"),
        t("Record & review practice",          "weekly", "medium"),
        t("Watch tutorial or lesson",          "weekly", "low"),
        t("Set up practice space",             "once",   "medium"),
        t("Find a song to learn",              "once",   "medium"),
        t("Book guitar lessons",               "once",   "low"),
      ];
    }
    return [
      t("Creative session (45 min)",           "daily",  "high"),
      t("Review & iterate on work",            "weekly", "medium"),
      t("Share work / get feedback",           "weekly", "low"),
      t("Set up creative workspace",           "once",   "medium"),
    ];
  }

  // Travel ──────────────────────────────────────────────────────────────────
  if (templateId === "travel") {
    return [
      t("Research destination",                "weekly", "high"),
      t("Compare accommodation options",       "weekly", "medium"),
      t("Build itinerary day by day",          "weekly", "medium"),
      t("Set aside travel budget",             "weekly", "high"),
      t("Book flights",                        "once",   "urgent"),
      t("Book accommodation",                  "once",   "high"),
      t("Apply for visa (if required)",        "once",   "urgent"),
      t("Get travel insurance",                "once",   "high"),
      t("Create packing list",                 "once",   "medium"),
      t("Notify bank of travel",              "once",   "low"),
    ];
  }

  // Finance ─────────────────────────────────────────────────────────────────
  if (templateId === "finance") {
    if (g.match(/save|savings|emergency|fund/)) {
      const monthly = targetValue ? Math.round(Number(targetValue) / 12) : 500;
      return [
        t("Log daily expenses",                   "daily",  "medium"),
        t(`Transfer $${monthly} to savings`,      "weekly", "high"),
        t("Review weekly spending",               "weekly", "medium"),
        t("Monthly budget review",                "weekly", "high"),
        t("Set up high-interest savings account", "once",   "urgent"),
        t("Create a budget spreadsheet",          "once",   "high"),
        t("Cancel unused subscriptions",          "once",   "high"),
        t("Calculate monthly savings target",     "once",   "medium"),
      ];
    }
    if (g.match(/invest|portfolio|stocks|etf|super/)) {
      return [
        t("Check portfolio performance",          "weekly", "medium"),
        t("Research next investment",             "weekly", "medium"),
        t("Regular investment transfer",          "weekly", "high"),
        t("Open brokerage account",               "once",   "urgent"),
        t("Define investment strategy",           "once",   "high"),
        t("Set up automated investing",           "once",   "high"),
        t("Read one investment book",             "once",   "medium"),
      ];
    }
    return [
      t("Log expenses",                           "daily",  "medium"),
      t("Review weekly spending",                 "weekly", "high"),
      t("Transfer to savings",                    "weekly", "high"),
      t("Create a budget",                        "once",   "high"),
      t("Set up automatic payments",              "once",   "medium"),
    ];
  }

  // Learning ────────────────────────────────────────────────────────────────
  if (templateId === "learning") {
    return [
      t("Study session (45 min)",                "daily",  "high"),
      t("Anki / flashcard review",               "daily",  "medium"),
      t("Take structured notes",                 "daily",  "medium"),
      t("Complete course module",                "weekly", "high"),
      t("Practice / build a project",            "weekly", "high"),
      t("Review week's notes",                   "weekly", "medium"),
      t("Choose course or book",                 "once",   "high"),
      t("Set up learning environment",           "once",   "medium"),
      t("Define what done looks like",           "once",   "medium"),
    ];
  }

  // Generic fallback
  return [
    t(`Work on: ${goal}`,      "daily",  "high"),
    t("Weekly review progress","weekly", "medium"),
    t("Define milestones",     "once",   "high"),
    t("Research & plan",       "once",   "medium"),
  ];
}

// ── Priority meta ─────────────────────────────────────────────────────────────

const PRI_META: Record<Priority, { icon: React.ReactNode; color: string; label: string }> = {
  urgent: { icon: <Zap size={10} />,     color: "#E85538", label: "Urgent" },
  high:   { icon: <ArrowUp size={10} />, color: "#E8A838", label: "High" },
  medium: { icon: <Minus size={10} />,   color: "#2563EB", label: "Medium" },
  low:    { icon: <Minus size={10} />,   color: "#64748B", label: "Low" },
};

const FREQ_META: Record<Frequency, { label: string; color: string; bg: string }> = {
  daily:  { label: "Daily",  color: "#4A9EE0", bg: "#4A9EE018" },
  weekly: { label: "Weekly", color: "#2563EB", bg: "#2563EB18" },
  once:   { label: "One-off",color: "#64748B", bg: "#64748B18" },
};

// ── Main page ─────────────────────────────────────────────────────────────────

const STEPS = ["Choose areas", "Set your goals", "Build your plan", "Launch"];

export default function OnboardingPage() {
  const { userId } = useCurrentUser();
  const setupWorkspace = useMutation(api.onboarding.setupWorkspace);
  const router = useRouter();

  const [step,       setStep]       = useState(0);
  const [selected,   setSelected]   = useState<string[]>([]);
  const [areas,      setAreas]      = useState<WizardArea[]>([]);
  const [areaIdx,    setAreaIdx]    = useState(0); // which area we're configuring
  const [saving,     setSaving]     = useState(false);

  // ── Step 0: select area templates ────────────────────────────────────────

  const toggleTemplate = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const goToGoals = () => {
    const newAreas: WizardArea[] = selected.map((id) => {
      const tpl = AREA_TEMPLATES.find((t) => t.id === id)!;
      return {
        templateId: id, name: tpl.name, color: tpl.color, icon: tpl.icon,
        category: tpl.category, description: tpl.description,
        goal: "", metric: "", currentValue: "", targetValue: "", deadline: "",
        tasks: [], goalStep: false,
      };
    });
    setAreas(newAreas);
    setAreaIdx(0);
    setStep(1);
  };

  // ── Step 1: set goals ─────────────────────────────────────────────────────

  const updateArea = (idx: number, patch: Partial<WizardArea>) =>
    setAreas((prev) => prev.map((a, i) => i === idx ? { ...a, ...patch } : a));

  const generateTasks = (idx: number) => {
    const a = areas[idx];
    const tasks = suggestTasks(a.templateId, a.goal, a.metric, a.targetValue);
    updateArea(idx, { tasks, goalStep: true });
  };

  const nextAreaGoal = () => {
    const a = areas[areaIdx];
    if (!a.goalStep) generateTasks(areaIdx);
    if (areaIdx < areas.length - 1) {
      setAreaIdx(areaIdx + 1);
    } else {
      setAreaIdx(0);
      setStep(2);
    }
  };

  // ── Step 2: edit tasks ────────────────────────────────────────────────────

  const toggleTask = (aIdx: number, tId: string) => {
    setAreas((prev) => prev.map((a, i) =>
      i === aIdx
        ? { ...a, tasks: a.tasks.map((t) => t.id === tId ? { ...t, enabled: !t.enabled } : t) }
        : a
    ));
  };

  const editTask = (aIdx: number, tId: string, title: string) => {
    setAreas((prev) => prev.map((a, i) =>
      i === aIdx
        ? { ...a, tasks: a.tasks.map((t) => t.id === tId ? { ...t, title } : t) }
        : a
    ));
  };

  const addTask = (aIdx: number, frequency: Frequency) => {
    const task: WizardTask = { id: uid(), title: "", frequency, priority: "medium", enabled: true };
    setAreas((prev) => prev.map((a, i) => i === aIdx ? { ...a, tasks: [...a.tasks, task] } : a));
  };

  const removeTask = (aIdx: number, tId: string) => {
    setAreas((prev) => prev.map((a, i) =>
      i === aIdx ? { ...a, tasks: a.tasks.filter((t) => t.id !== tId) } : a
    ));
  };

  const regenerateTasks = (idx: number) => {
    const tasks = suggestTasks(areas[idx].templateId, areas[idx].goal, areas[idx].metric, areas[idx].targetValue);
    updateArea(idx, { tasks });
  };

  // ── Launch ────────────────────────────────────────────────────────────────

  const handleLaunch = async () => {
    if (!userId || saving) return;
    setSaving(true);
    try {
      await setupWorkspace({
        userId,
        areas: areas.map((a) => ({
          name:        a.name,
          color:       a.color,
          icon:        a.icon,
          category:    a.category,
          description: a.description,
          goal:        a.goal || `${a.name} goal`,
          metric:      a.metric || "progress",
          currentValue: Number(a.currentValue) || 0,
          targetValue:  Number(a.targetValue)  || 100,
          deadline:     a.deadline ? new Date(a.deadline).getTime() : undefined,
          tasks: a.tasks
            .filter((t) => t.enabled && t.title.trim())
            .map((t) => ({
              title:     t.title.trim(),
              priority:  t.priority,
              frequency: t.frequency,
              status:    (t.frequency === "once" ? "todo" : "backlog") as any,
            })),
        })),
      });
      localStorage.setItem("onboarded", "true");
      router.push("/areas");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const totalEnabledTasks = areas.reduce((s, a) => s + a.tasks.filter((t) => t.enabled && t.title.trim()).length, 0);

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex flex-col">
      {/* Top bar */}
      <div className="border-b border-[#E2E8F0] px-8 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded bg-[#2563EB] flex items-center justify-center">
            <span className="font-ui font-medium text-[11px] text-[#FFFFFF]">LO</span>
          </div>
          <span className="font-ui text-[13px] font-medium text-[#0F172A]">Life OS</span>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-1">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full font-ui text-[11px] transition-colors",
                i < step  ? "bg-[#2563EB20] text-[#2563EB]" :
                i === step ? "bg-[#0F172A20] text-[#0F172A]" :
                             "text-[#94A3B8]"
              )}>
                {i < step ? <Check size={10} /> : <span>{i + 1}</span>}
                {label}
              </div>
              {i < STEPS.length - 1 && <ChevronRight size={11} className="text-[#E2E8F0]" />}
            </div>
          ))}
        </div>

        <div className="w-32" />
      </div>

      {/* ── STEP 0: Choose areas ─────────────────────────────────────────── */}
      {step === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
          <p className="font-ui text-[12px] tracking-[0.2em] uppercase text-[#2563EB] mb-3">Step 1</p>
          <h1 className="font-display text-[40px] font-semibold text-[#0F172A] mb-2 text-center">
            What do you want to improve?
          </h1>
          <p className="font-ui text-[14px] text-[#64748B] mb-10 text-center">
            Pick the areas of your life you want to track. You can add more later.
          </p>

          <div className="grid grid-cols-4 gap-3 w-full max-w-[800px] mb-10">
            {AREA_TEMPLATES.map((tpl) => {
              const isSelected = selected.includes(tpl.id);
              return (
                <button
                  key={tpl.id}
                  onClick={() => toggleTemplate(tpl.id)}
                  className={cn(
                    "flex flex-col items-start gap-2 p-4 rounded border transition-all text-left relative",
                    isSelected
                      ? "border-[#2563EB] bg-[#2563EB08]"
                      : "border-[#E2E8F0] bg-[#FFFFFF] hover:border-[#CBD5E1]"
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-[#2563EB] flex items-center justify-center">
                      <Check size={9} className="text-[#FFFFFF]" />
                    </div>
                  )}
                  <div
                    className="w-9 h-9 rounded flex items-center justify-center text-[20px]"
                    style={{ backgroundColor: `${tpl.color}20` }}
                  >
                    {tpl.icon}
                  </div>
                  <div>
                    <p className="font-ui text-[13px] font-medium text-[#0F172A]">{tpl.name}</p>
                    <p className="font-ui text-[11px] text-[#64748B] mt-0.5">{tpl.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={goToGoals}
            disabled={selected.length === 0}
            className="flex items-center gap-2 px-6 py-3 bg-[#2563EB] rounded font-ui text-[14px] font-medium text-[#FFFFFF] hover:bg-[#1a73d1] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Continue with {selected.length} area{selected.length !== 1 ? "s" : ""}
            <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* ── STEP 1: Set goals (per area) ────────────────────────────────── */}
      {step === 1 && areas.length > 0 && (
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-10">
          {/* Area progress dots */}
          <div className="flex items-center gap-2 mb-8">
            {areas.map((a, i) => (
              <div
                key={i}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  i === areaIdx ? "w-6 rounded-full" : ""
                )}
                style={{ backgroundColor: i <= areaIdx ? a.color : "#E2E8F0" }}
              />
            ))}
          </div>

          <p className="font-ui text-[12px] tracking-[0.2em] uppercase text-[#64748B] mb-2">
            Area {areaIdx + 1} of {areas.length}
          </p>

          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center text-[28px] mb-4"
            style={{ backgroundColor: `${areas[areaIdx].color}20` }}
          >
            {areas[areaIdx].icon}
          </div>

          <h1 className="font-display text-[36px] font-semibold text-[#0F172A] mb-1 text-center">
            {areas[areaIdx].name}
          </h1>
          <p className="font-ui text-[13px] text-[#64748B] mb-8 text-center">
            What&apos;s your main goal here, and how will you measure it?
          </p>

          <div className="w-full max-w-[540px] space-y-4">
            {/* Area name */}
            <div>
              <label className="block font-ui text-[11px] tracking-[0.15em] uppercase text-[#64748B] mb-1.5">Area name</label>
              <input
                value={areas[areaIdx].name}
                onChange={(e) => updateArea(areaIdx, { name: e.target.value })}
                className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded px-3 py-2.5 font-ui text-[14px] text-[#0F172A] outline-none focus:border-[#2563EB] transition-colors"
              />
            </div>

            {/* Goal */}
            <div>
              <label className="block font-ui text-[11px] tracking-[0.15em] uppercase text-[#64748B] mb-1.5">
                Main goal <span className="normal-case tracking-normal text-[#94A3B8]">— what do you want to achieve?</span>
              </label>
              <input
                autoFocus
                value={areas[areaIdx].goal}
                onChange={(e) => updateArea(areaIdx, { goal: e.target.value })}
                placeholder={
                  areas[areaIdx].templateId === "fitness" ? "e.g. Reach 10% body fat" :
                  areas[areaIdx].templateId === "work"    ? "e.g. Hit $50k MRR" :
                  areas[areaIdx].templateId === "guitar"  ? "e.g. Learn 10 complete songs" :
                  areas[areaIdx].templateId === "finance" ? "e.g. Save $20k emergency fund" :
                  areas[areaIdx].templateId === "travel"  ? "e.g. Visit Japan in October" :
                  areas[areaIdx].templateId === "learning"? "e.g. Complete React course" :
                  "e.g. What does success look like?"
                }
                className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded px-3 py-2.5 font-ui text-[14px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#2563EB] transition-colors"
              />
            </div>

            {/* Metric row */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-ui text-[11px] tracking-[0.15em] uppercase text-[#64748B] mb-1.5">
                  Metric
                </label>
                <input
                  value={areas[areaIdx].metric}
                  onChange={(e) => updateArea(areaIdx, { metric: e.target.value })}
                  placeholder={
                    areas[areaIdx].templateId === "fitness" ? "Body fat %" :
                    areas[areaIdx].templateId === "work"    ? "MRR ($)" :
                    areas[areaIdx].templateId === "finance" ? "$ saved" :
                    "e.g. kg, $, score…"
                  }
                  className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded px-3 py-2.5 font-ui text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#2563EB] transition-colors"
                />
              </div>
              <div>
                <label className="block font-ui text-[11px] tracking-[0.15em] uppercase text-[#64748B] mb-1.5">
                  Current value
                </label>
                <input
                  type="number"
                  value={areas[areaIdx].currentValue}
                  onChange={(e) => updateArea(areaIdx, { currentValue: e.target.value })}
                  placeholder={areas[areaIdx].templateId === "fitness" ? "18" : "0"}
                  className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded px-3 py-2.5 font-ui text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#2563EB] transition-colors"
                />
              </div>
              <div>
                <label className="block font-ui text-[11px] tracking-[0.15em] uppercase text-[#64748B] mb-1.5">
                  Target value
                </label>
                <input
                  type="number"
                  value={areas[areaIdx].targetValue}
                  onChange={(e) => updateArea(areaIdx, { targetValue: e.target.value })}
                  placeholder={areas[areaIdx].templateId === "fitness" ? "10" : "100"}
                  className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded px-3 py-2.5 font-ui text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#2563EB] transition-colors"
                />
              </div>
            </div>

            {/* Deadline */}
            <div>
              <label className="block font-ui text-[11px] tracking-[0.15em] uppercase text-[#64748B] mb-1.5">
                Target deadline <span className="normal-case tracking-normal text-[#94A3B8]">— optional</span>
              </label>
              <input
                type="date"
                value={areas[areaIdx].deadline}
                onChange={(e) => updateArea(areaIdx, { deadline: e.target.value })}
                className="w-full bg-[#FFFFFF] border border-[#E2E8F0] rounded px-3 py-2.5 font-ui text-[13px] text-[#0F172A] outline-none focus:border-[#2563EB] transition-colors [color-scheme:light]"
              />
            </div>
          </div>

          {/* Nav */}
          <div className="flex items-center gap-3 mt-8">
            <button
              onClick={() => areaIdx > 0 ? setAreaIdx(areaIdx - 1) : setStep(0)}
              className="flex items-center gap-2 px-4 py-2 border border-[#E2E8F0] rounded font-ui text-[13px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] transition-colors"
            >
              <ChevronLeft size={14} />
              Back
            </button>
            <button
              onClick={nextAreaGoal}
              disabled={!areas[areaIdx].goal.trim()}
              className="flex items-center gap-2 px-6 py-2 bg-[#2563EB] rounded font-ui text-[13px] font-medium text-[#FFFFFF] hover:bg-[#1a73d1] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {areaIdx < areas.length - 1 ? `Next: ${areas[areaIdx + 1].name}` : "Build my action plan"}
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Edit tasks (per area tabs) ──────────────────────────── */}
      {step === 2 && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="text-center pt-8 pb-4 shrink-0">
            <p className="font-ui text-[12px] tracking-[0.2em] uppercase text-[#2563EB] mb-2">Step 3</p>
            <h1 className="font-display text-[36px] font-semibold text-[#0F172A] mb-1">Your action plan</h1>
            <p className="font-ui text-[13px] text-[#64748B]">
              Toggle tasks on/off, edit titles, and add your own. Checked tasks will be created.
            </p>
          </div>

          {/* Area tabs */}
          <div className="flex items-center gap-1 px-8 border-b border-[#E2E8F0] shrink-0">
            {areas.map((a, i) => (
              <button
                key={i}
                onClick={() => setAreaIdx(i)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2.5 font-ui text-[13px] border-b-2 transition-colors",
                  areaIdx === i
                    ? "border-[#2563EB] text-[#0F172A]"
                    : "border-transparent text-[#64748B] hover:text-[#475569]"
                )}
              >
                <span>{a.icon}</span>
                {a.name}
                <span className="font-ui text-[11px] text-[#94A3B8] bg-[#F1F5F9] px-1.5 py-0.5 rounded-full">
                  {a.tasks.filter((t) => t.enabled && t.title.trim()).length}
                </span>
              </button>
            ))}
          </div>

          {/* Task editor */}
          <div className="flex-1 overflow-y-auto px-8 py-5">
            {areas[areaIdx] && (
              <div className="max-w-[700px] mx-auto">
                {/* Area goal recap */}
                <div className="flex items-center justify-between mb-5 p-3 bg-[#FFFFFF] border border-[#E2E8F0] rounded">
                  <div>
                    <p className="font-ui text-[11px] text-[#94A3B8] uppercase tracking-[0.12em] mb-0.5">Goal</p>
                    <p className="font-ui text-[13px] text-[#0F172A]">{areas[areaIdx].goal || "—"}</p>
                  </div>
                  {areas[areaIdx].metric && (
                    <div className="text-right">
                      <p className="font-ui text-[11px] text-[#94A3B8] uppercase tracking-[0.12em] mb-0.5">Target</p>
                      <p className="font-ui text-[13px]" style={{ color: areas[areaIdx].color }}>
                        {areas[areaIdx].currentValue} → {areas[areaIdx].targetValue} {areas[areaIdx].metric}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => regenerateTasks(areaIdx)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 border border-[#E2E8F0] rounded font-ui text-[11px] text-[#64748B] hover:text-[#0F172A] transition-colors"
                  >
                    <RefreshCw size={11} />
                    Regenerate
                  </button>
                </div>

                {(["daily", "weekly", "once"] as Frequency[]).map((freq) => {
                  const freqTasks = areas[areaIdx].tasks.filter((t) => t.frequency === freq);
                  const meta = FREQ_META[freq];
                  return (
                    <div key={freq} className="mb-5">
                      {/* Frequency header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-ui text-[11px] font-medium px-2.5 py-1 rounded-full uppercase tracking-[0.1em]"
                            style={{ color: meta.color, backgroundColor: meta.bg }}
                          >
                            {meta.label}
                          </span>
                          <span className="font-ui text-[11px] text-[#94A3B8]">
                            {freqTasks.filter((t) => t.enabled && t.title.trim()).length} active
                          </span>
                        </div>
                        <button
                          onClick={() => addTask(areaIdx, freq)}
                          className="flex items-center gap-1 font-ui text-[11px] text-[#94A3B8] hover:text-[#64748B] transition-colors"
                        >
                          <Plus size={11} />
                          Add {freq}
                        </button>
                      </div>

                      {/* Task rows */}
                      <div className="space-y-1">
                        {freqTasks.length === 0 && (
                          <div className="border border-dashed border-[#E2E8F0] rounded px-4 py-3 text-center">
                            <p className="font-ui text-[12px] text-[#94A3B8]">No {freq} tasks — add one above</p>
                          </div>
                        )}
                        {freqTasks.map((task) => {
                          const pri = PRI_META[task.priority];
                          return (
                            <div
                              key={task.id}
                              className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded border transition-colors",
                                task.enabled ? "border-[#E2E8F0] bg-[#FFFFFF]" : "border-[#E2E8F0] bg-transparent opacity-50"
                              )}
                            >
                              {/* Toggle */}
                              <button
                                onClick={() => toggleTask(areaIdx, task.id)}
                                className={cn(
                                  "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                  task.enabled ? "border-[#2563EB] bg-[#2563EB20]" : "border-[#E2E8F0]"
                                )}
                              >
                                {task.enabled && <Check size={9} className="text-[#2563EB]" />}
                              </button>

                              {/* Title */}
                              <input
                                value={task.title}
                                onChange={(e) => editTask(areaIdx, task.id, e.target.value)}
                                placeholder="Task title…"
                                className="flex-1 bg-transparent font-ui text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none"
                              />

                              {/* Priority */}
                              <select
                                value={task.priority}
                                onChange={(e) => {
                                  setAreas((prev) => prev.map((a, i) =>
                                    i === areaIdx
                                      ? { ...a, tasks: a.tasks.map((t) => t.id === task.id ? { ...t, priority: e.target.value as Priority } : t) }
                                      : a
                                  ));
                                }}
                                className="appearance-none bg-transparent font-ui text-[11px] outline-none cursor-pointer"
                                style={{ color: pri.color }}
                              >
                                {Object.entries(PRI_META).map(([k, v]) => (
                                  <option key={k} value={k}>{v.label}</option>
                                ))}
                              </select>

                              {/* Delete */}
                              <button
                                onClick={() => removeTask(areaIdx, task.id)}
                                className="text-[#E2E8F0] hover:text-[#E85538] transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer nav */}
          <div className="border-t border-[#E2E8F0] px-8 py-4 flex items-center justify-between shrink-0">
            <button
              onClick={() => { setAreaIdx(areas.length - 1); setStep(1); }}
              className="flex items-center gap-2 px-4 py-2 border border-[#E2E8F0] rounded font-ui text-[13px] text-[#64748B] hover:text-[#0F172A] transition-colors"
            >
              <ChevronLeft size={14} />
              Back
            </button>
            <div className="flex items-center gap-3">
              <span className="font-ui text-[12px] text-[#64748B]">
                {totalEnabledTasks} tasks across {areas.length} areas
              </span>
              <button
                onClick={() => setStep(3)}
                className="flex items-center gap-2 px-6 py-2 bg-[#2563EB] rounded font-ui text-[13px] font-medium text-[#FFFFFF] hover:bg-[#1a73d1] transition-colors"
              >
                Review & launch
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 3: Review & launch ──────────────────────────────────────── */}
      {step === 3 && (
        <div className="flex-1 overflow-y-auto px-8 py-10">
          <div className="max-w-[660px] mx-auto">
            <p className="font-ui text-[12px] tracking-[0.2em] uppercase text-[#2563EB] mb-2 text-center">Step 4</p>
            <h1 className="font-display text-[36px] font-semibold text-[#0F172A] mb-2 text-center">Ready to launch</h1>
            <p className="font-ui text-[13px] text-[#64748B] mb-8 text-center">
              Here&apos;s everything that will be created in your Life OS.
            </p>

            {/* Summary cards */}
            <div className="space-y-3 mb-8">
              {areas.map((a, i) => {
                const daily  = a.tasks.filter((t) => t.enabled && t.title.trim() && t.frequency === "daily");
                const weekly = a.tasks.filter((t) => t.enabled && t.title.trim() && t.frequency === "weekly");
                const once   = a.tasks.filter((t) => t.enabled && t.title.trim() && t.frequency === "once");
                return (
                  <div key={i} className="border border-[#E2E8F0] rounded bg-[#FFFFFF] overflow-hidden">
                    {/* Card header */}
                    <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#E2E8F0]">
                      <div
                        className="w-8 h-8 rounded flex items-center justify-center text-[18px] shrink-0"
                        style={{ backgroundColor: `${a.color}20` }}
                      >
                        {a.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-ui text-[13px] font-semibold text-[#0F172A]">{a.name}</p>
                        <p className="font-ui text-[11px] text-[#64748B] truncate">{a.goal || "No goal set"}</p>
                      </div>
                      {a.metric && (
                        <div className="text-right shrink-0">
                          <p className="font-ui text-[11px] text-[#94A3B8] uppercase tracking-wider">Target</p>
                          <p className="font-ui text-[13px] font-medium" style={{ color: a.color }}>
                            {a.targetValue} {a.metric}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Task counts */}
                    <div className="grid grid-cols-3 divide-x divide-[#E2E8F0]">
                      {[
                        { label: "Daily",   tasks: daily,  color: "#4A9EE0" },
                        { label: "Weekly",  tasks: weekly, color: "#2563EB" },
                        { label: "One-off", tasks: once,   color: "#64748B" },
                      ].map(({ label, tasks: ts, color }) => (
                        <div key={label} className="px-4 py-3">
                          <p className="font-ui text-[11px] uppercase tracking-[0.1em] mb-1" style={{ color }}>
                            {label}
                          </p>
                          {ts.length === 0 ? (
                            <p className="font-ui text-[11px] text-[#94A3B8]">—</p>
                          ) : (
                            <ul className="space-y-0.5">
                              {ts.slice(0, 3).map((t) => (
                                <li key={t.id} className="font-ui text-[11px] text-[#64748B] truncate">
                                  · {t.title}
                                </li>
                              ))}
                              {ts.length > 3 && (
                                <li className="font-ui text-[11px] text-[#94A3B8]">+{ts.length - 3} more</li>
                              )}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                { label: "Spaces",    value: areas.length,                                           color: "#2563EB" },
                { label: "Goals",     value: areas.length,                                           color: "#4CAF6B" },
                { label: "Tasks",     value: totalEnabledTasks,                                      color: "#4A9EE0" },
              ].map(({ label, value, color }) => (
                <div key={label} className="border border-[#E2E8F0] rounded p-4 bg-[#FFFFFF] text-center">
                  <p className="font-ui text-[28px] font-bold" style={{ color }}>{value}</p>
                  <p className="font-ui text-[11px] text-[#64748B] uppercase tracking-[0.1em]">{label}</p>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 px-4 py-2.5 border border-[#E2E8F0] rounded font-ui text-[13px] text-[#64748B] hover:text-[#0F172A] transition-colors"
              >
                <ChevronLeft size={14} />
                Edit plan
              </button>
              <button
                onClick={handleLaunch}
                disabled={saving}
                className="flex items-center gap-3 px-8 py-3 bg-[#2563EB] rounded font-ui text-[15px] font-semibold text-[#FFFFFF] hover:bg-[#1a73d1] disabled:opacity-40 transition-colors"
              >
                {saving ? "Creating your workspace…" : "Launch Life OS"}
                {!saving && <ChevronRight size={15} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
