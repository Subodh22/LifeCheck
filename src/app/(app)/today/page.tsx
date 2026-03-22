"use client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { healthColor } from "@/constants/colors";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { Zap, ArrowUp, Minus, CheckCircle2, Circle, Clock, AlertCircle, Flame } from "lucide-react";
import { Id } from "../../../../convex/_generated/dataModel";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Research basis:
// - Fogg Behavior Model (2009): daily habits must be prompted at the daily anchor point
// - Implementation Intentions (Gollwitzer 1999): today's tasks need clear context
// - GTD (Allen 2001): Engage = this page. Capture = Backlog. Plan = Goals. Reflect = Reviews.

const PRIORITY_META = {
  urgent: { icon: <Zap size={11} />,    color: "#E85538" },
  high:   { icon: <ArrowUp size={11} />, color: "#E8A838" },
  medium: { icon: <Minus size={11} />,   color: "#C9A84C" },
  low:    { icon: <Minus size={11} />,   color: "#6B6760" },
} as const;

type Priority = keyof typeof PRIORITY_META;

export default function TodayPage() {
  const { userId } = useCurrentUser();
  const today        = useQuery(api.tasks.getTodayPriorities, userId ? { userId } : "skip") ?? [];
  const allTasks     = useQuery(api.tasks.listByUser,         userId ? { userId } : "skip") ?? [];
  const areas        = useQuery(api.areas.list,               userId ? { userId } : "skip") ?? [];
  const healthScores = useQuery(api.healthScores.getByUser,   userId ? { userId } : "skip") ?? {};
  const habits       = useQuery(api.habits.list,              userId ? { userId } : "skip") ?? [];
  const updateStatus = useMutation(api.tasks.updateStatus);
  const toggleHabit  = useMutation(api.habits.toggleHabitCompletion);

  const [completing,    setCompleting]    = useState<string | null>(null);
  const [togglingHabit, setTogglingHabit] = useState<string | null>(null);

  const todayStr  = format(new Date(), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const weekEnd   = format(endOfWeek(new Date(),   { weekStartsOn: 1 }), "yyyy-MM-dd");

  const habitCompletions = useQuery(
    api.habits.getHabitCompletionsForWeek,
    userId ? { userId, weekStart, weekEnd } : "skip"
  ) ?? [];

  const completedTodayIds = new Set<string>(
    habitCompletions
      .filter((c) => c.completedDate === todayStr)
      .map((c) => c.habitId)
  );

  const dailyHabits    = habits.filter((h) => h.frequency === "daily");
  const habitsDoneToday = dailyHabits.filter((h) => completedTodayIds.has(h._id)).length;

  const areaMap    = Object.fromEntries(areas.map((a) => [a._id, a]));
  const hour       = new Date().getHours();
  const greeting   = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const doneTasks  = allTasks.filter((t) => t.status === "done");
  const overdue    = allTasks.filter((t) => t.dueDate && t.dueDate < Date.now() && t.status !== "done");
  const inProgress = allTasks.filter((t) => t.status === "in_progress");

  const handleComplete = async (taskId: Id<"tasks">, isDone: boolean) => {
    setCompleting(taskId);
    try {
      await updateStatus({ id: taskId, status: isDone ? "todo" : "done" });
    } finally {
      setCompleting(null);
    }
  };

  const handleToggleHabit = async (habitId: Id<"habits">) => {
    if (!userId) return;
    setTogglingHabit(habitId);
    try {
      await toggleHabit({ habitId, userId, date: todayStr });
    } finally {
      setTogglingHabit(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[900px] mx-auto px-8 py-6">

        {/* Header */}
        <div className="mb-6">
          <p className="font-ui text-[11px] text-[#3A3A3E] tracking-[0.15em] uppercase mb-1">
            {format(new Date(), "EEEE, d MMMM yyyy")}
          </p>
          <h1 className="font-display text-[32px] italic text-[#F2EEE8] leading-tight [text-wrap:balance]">
            {greeting}.
          </h1>
        </div>

        {/* Stat cards row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            {
              label: "In Progress",
              value: inProgress.length,
              icon: <Circle size={14} className="text-[#C9A84C]" />,
              color: "#C9A84C",
            },
            {
              label: "Completed",
              value: doneTasks.length,
              icon: <CheckCircle2 size={14} className="text-[#4CAF6B]" />,
              color: "#4CAF6B",
            },
            {
              label: "Overdue",
              value: overdue.length,
              icon: <AlertCircle size={14} className="text-[#E85538]" />,
              color: overdue.length > 0 ? "#E85538" : "#3A3A3E",
            },
            {
              label: "Open Tasks",
              value: allTasks.filter((t) => t.status !== "done").length,
              icon: <Clock size={14} className="text-[#4A9EE0]" />,
              color: "#4A9EE0",
            },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="bg-[#111113] border border-[#2A2A2E] rounded p-3.5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-ui text-[11px] text-[#6B6760] uppercase tracking-[0.1em]">{label}</span>
                {icon}
              </div>
              <span className="font-ui text-[24px] font-medium tabular-nums" style={{ color }}>{value}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[1fr_280px] gap-5">

          {/* Left: Focus + Overdue */}
          <div className="flex flex-col gap-5">

            {/* Today's Focus — tasks due today */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="font-ui text-[11px] font-medium text-[#6B6760] uppercase tracking-[0.15em]">
                  Today&apos;s Focus
                </h2>
                <span className="font-ui text-[11px] text-[#3A3A3E]">{today.length} issues</span>
              </div>

              <div className="border border-[#2A2A2E] rounded overflow-hidden">
                <div className="grid grid-cols-[20px_1fr_90px_70px] gap-3 px-4 py-2 bg-[#0D0D0F] border-b border-[#2A2A2E]">
                  <div />
                  <span className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#3A3A3E]">Issue</span>
                  <span className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#3A3A3E]">Area</span>
                  <span className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#3A3A3E]">Due</span>
                </div>

                {today.length === 0 ? (
                  <div className="px-4 py-8 text-center bg-[#111113]">
                    <p className="font-ui text-[13px] text-[#6B6760]">No priority tasks for today.</p>
                    <p className="font-ui text-[11px] text-[#3A3A3E] mt-1">Add due dates to surface tasks here.</p>
                  </div>
                ) : (
                  today.map((task) => {
                    const area      = areaMap[task.areaId];
                    const pri       = PRIORITY_META[task.priority as Priority] ?? PRIORITY_META.medium;
                    const isDone    = task.status === "done";
                    const isOverdue = task.dueDate && task.dueDate < Date.now() && !isDone;
                    return (
                      <div
                        key={task._id}
                        className="grid grid-cols-[20px_1fr_90px_70px] gap-3 px-4 py-2.5 border-b border-[#1E1E21] last:border-0 bg-[#111113] hover:bg-[#18181B] transition-colors items-center"
                      >
                        <button
                          onClick={() => handleComplete(task._id, isDone)}
                          disabled={completing === task._id}
                          className="flex items-center justify-center transition-opacity hover:opacity-80"
                          style={{ color: isDone ? "#4CAF6B" : pri.color }}
                        >
                          {isDone ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                        </button>
                        <p className={cn(
                          "font-ui text-[13px] truncate",
                          isDone ? "text-[#3A3A3E] line-through" : "text-[#F2EEE8]"
                        )}>
                          {task.title}
                        </p>
                        {area ? (
                          <span
                            className="font-ui text-[11px] px-1.5 py-0.5 rounded truncate"
                            style={{ color: area.color, backgroundColor: `${area.color}18` }}
                          >
                            {area.name}
                          </span>
                        ) : <span />}
                        <span className={cn(
                          "font-ui text-[11px]",
                          isOverdue ? "text-[#E85538]" : "text-[#6B6760]"
                        )}>
                          {task.dueDate ? format(new Date(task.dueDate), "d MMM") : "—"}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Overdue — requires triage */}
            {overdue.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={12} className="text-[#E85538]" />
                  <h2 className="font-ui text-[11px] font-medium text-[#E85538] uppercase tracking-[0.15em]">
                    Overdue
                  </h2>
                  <span className="font-ui text-[11px] text-[#3A3A3E]">{overdue.length}</span>
                </div>
                <div className="border border-[#E8553820] rounded overflow-hidden">
                  {overdue.slice(0, 5).map((task) => {
                    const area = areaMap[task.areaId];
                    const pri  = PRIORITY_META[task.priority as Priority] ?? PRIORITY_META.medium;
                    return (
                      <div
                        key={task._id}
                        className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1E1E21] last:border-0 bg-[#111113] hover:bg-[#18181B] transition-colors"
                      >
                        <span style={{ color: pri.color }}>{pri.icon}</span>
                        <span className="flex-1 font-ui text-[13px] text-[#F2EEE8] truncate">{task.title}</span>
                        {area && (
                          <span
                            className="font-ui text-[11px] px-1.5 py-0.5 rounded shrink-0"
                            style={{ color: area.color, backgroundColor: `${area.color}18` }}
                          >
                            {area.name}
                          </span>
                        )}
                        <span className="font-ui text-[11px] text-[#E85538] shrink-0">
                          {task.dueDate ? format(new Date(task.dueDate), "d MMM") : "—"}
                        </span>
                      </div>
                    );
                  })}
                  {overdue.length > 5 && (
                    <div className="px-4 py-2 bg-[#111113] border-t border-[#1E1E21]">
                      <span className="font-ui text-[11px] text-[#6B6760]">+{overdue.length - 5} more overdue</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Daily Routines + Area Health */}
          <div className="flex flex-col gap-5">

            {/* Daily Routines — Fogg: prompts must appear at the daily anchor point */}
            {dailyHabits.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Flame size={11} className="text-[#C9A84C]" />
                    <h2 className="font-ui text-[11px] font-medium text-[#6B6760] uppercase tracking-[0.15em]">
                      Daily Routines
                    </h2>
                  </div>
                  <span className="font-ui text-[11px] text-[#3A3A3E] tabular-nums">
                    {habitsDoneToday}/{dailyHabits.length}
                  </span>
                </div>

                <div className="border border-[#2A2A2E] rounded overflow-hidden">
                  {dailyHabits.map((habit, i) => {
                    const isDone     = completedTodayIds.has(habit._id);
                    const isToggling = togglingHabit === habit._id;
                    return (
                      <div
                        key={habit._id}
                        className={cn(
                          "flex items-center gap-3 px-3.5 py-2.5 bg-[#111113] hover:bg-[#18181B] transition-colors",
                          i > 0 && "border-t border-[#1E1E21]"
                        )}
                      >
                        <button
                          onClick={() => handleToggleHabit(habit._id)}
                          disabled={isToggling}
                          className="flex items-center justify-center shrink-0 transition-opacity hover:opacity-80"
                          style={{ color: isDone ? "#4CAF6B" : "#3A3A3E" }}
                        >
                          {isDone ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                        </button>
                        <span className={cn(
                          "flex-1 font-ui text-[13px] truncate",
                          isDone ? "text-[#3A3A3E] line-through" : "text-[#F2EEE8]"
                        )}>
                          {habit.title}
                        </span>
                        {/* Streak indicator (Seinfeld "don't break the chain") */}
                        {(habit.currentStreak ?? 0) > 0 && (
                          <span className="font-ui text-[11px] text-[#C9A84C] shrink-0 tabular-nums">
                            {habit.currentStreak}d
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Progress bar for today's routines */}
                {dailyHabits.length > 0 && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-0.5 bg-[#2A2A2E] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.round((habitsDoneToday / dailyHabits.length) * 100)}%`,
                          backgroundColor: habitsDoneToday === dailyHabits.length ? "#4CAF6B" : "#C9A84C",
                        }}
                      />
                    </div>
                    <span className="font-ui text-[11px] text-[#3A3A3E] tabular-nums shrink-0">
                      {Math.round((habitsDoneToday / dailyHabits.length) * 100)}%
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Area Health */}
            <div>
              <h2 className="font-ui text-[11px] font-medium text-[#6B6760] uppercase tracking-[0.15em] mb-2">
                Area Health
              </h2>
              <div className="border border-[#2A2A2E] rounded overflow-hidden">
                {areas.length === 0 ? (
                  <div className="p-5 text-center">
                    <p className="font-ui text-[13px] text-[#6B6760]">No areas yet.</p>
                  </div>
                ) : (
                  areas.map((area, i) => {
                    const score = (healthScores as Record<string, number>)[area._id] ?? 50;
                    const color = healthColor(score);
                    return (
                      <div
                        key={area._id}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3 bg-[#111113] hover:bg-[#18181B] transition-colors cursor-pointer",
                          i > 0 && "border-t border-[#1E1E21]"
                        )}
                      >
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: area.color }} />
                        <span className="font-ui text-[13px] text-[#F2EEE8] flex-1 truncate">{area.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-14 h-1 bg-[#2A2A2E] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${score}%`, backgroundColor: color }}
                            />
                          </div>
                          <span className="font-ui text-[11px] w-5 text-right tabular-nums" style={{ color }}>
                            {score}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
