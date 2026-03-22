"use client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { healthColor } from "@/constants/colors";
import { format, startOfWeek } from "date-fns";
import { Id } from "../../../../convex/_generated/dataModel";
import { useState } from "react";
import { TrendingDown, CheckCheck } from "lucide-react";

const INK       = "#0D0D0D";
const INK_MID   = "#2A2A2A";
const INK_LIGHT = "#555550";
const INK_FAINT = "#999990";
const RED       = "#C41E3A";
const RULE_L    = "#CCCCBC";
const NEWSPRINT = "#FAFAF5";
const WHITE     = "#FFFFFF";

const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgent",
  high:   "High",
  medium: "Medium",
  low:    "Low",
};

export default function TodayPage() {
  const { userId } = useCurrentUser();
  const today        = useQuery(api.tasks.getTodayPriorities, userId ? { userId } : "skip") ?? [];
  const allTasks     = useQuery(api.tasks.listByUser,         userId ? { userId } : "skip") ?? [];
  const areas        = useQuery(api.areas.list,               userId ? { userId } : "skip") ?? [];
  const healthScores = useQuery(api.healthScores.getByUser,   userId ? { userId } : "skip") ?? {};
  const updateStatus = useMutation(api.tasks.updateStatus);

  const [completing, setCompleting] = useState<string | null>(null);

  const weekStartDate = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekStartMs   = weekStartDate.getTime();

  const wonThisWeek  = useQuery(api.tasks.wonThisWeek,                    userId ? { userId, weekStart: weekStartMs } : "skip") ?? [];
  const lastActivity = useQuery(api.healthScores.getLastActivityByUser,   userId ? { userId } : "skip") ?? {};
  const allGoals     = useQuery(api.goals.listByUser,                     userId ? { userId } : "skip") ?? [];

  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayMs    = todayStart.getTime();

  const areaMap      = Object.fromEntries(areas.map(a => [a._id, a]));
  const overdue        = allTasks.filter(t => t.dueDate && t.dueDate < Date.now() && t.status !== "done");
  const inProgress     = allTasks.filter(t => t.status === "in_progress");
  const done           = allTasks.filter(t => t.status === "done");
  const completedToday = allTasks.filter(t => t.status === "done" && t.completedAt && t.completedAt >= todayMs);

  const handleComplete = async (taskId: Id<"tasks">, isDone: boolean) => {
    setCompleting(taskId);
    try { await updateStatus({ id: taskId, status: isDone ? "todo" : "done" }); }
    finally { setCompleting(null); }
  };

  return (
    <div style={{ padding: "0 64px 80px", background: NEWSPRINT, minHeight: "calc(100vh - 72px)" }}>

      {/* ── Hero ── */}
      <div style={{ paddingTop: "40px", paddingBottom: "24px" }}>
        {/* Kicker */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "10px" }}>
          <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", color: RED }}>
            Morning Brief
          </span>
          <div style={{ flex: 1, height: "1px", background: RULE_L }} />
          <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "10px", letterSpacing: "1.5px", textTransform: "uppercase", color: INK_FAINT }}>
            {format(new Date(), "EEEE, MMMM d, yyyy")}
          </span>
        </div>

        {/* Headline */}
        <h1 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 900,
          fontSize: "80px",
          lineHeight: 0.92,
          letterSpacing: "-2px",
          color: INK,
          textTransform: "uppercase",
          marginBottom: "20px",
        }}>
          Today
        </h1>

        {/* Red rule */}
        <div style={{ width: "100%", height: "2px", background: RED }} />

        {/* Sub row */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 0",
          borderBottom: `1px solid ${RULE_L}`,
          marginBottom: "28px",
        }}>
          <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "12px", color: INK_LIGHT, letterSpacing: "0.5px" }}>
            <strong style={{ color: INK, fontWeight: 600 }}>{today.length}</strong> prioritized today &nbsp;·&nbsp;
            <strong style={{ color: overdue.length > 0 ? RED : INK, fontWeight: 600 }}>{overdue.length}</strong> overdue &nbsp;·&nbsp;
            <strong style={{ color: INK, fontWeight: 600 }}>{inProgress.length}</strong> in progress
          </span>
          {/* Stats */}
          <div style={{ display: "flex", gap: "40px" }}>
            {[
              { label: "Due Today",   value: today.length,       color: INK },
              { label: "In Progress", value: inProgress.length,  color: INK },
              { label: "Overdue",     value: overdue.length,     color: overdue.length > 0 ? RED : INK_FAINT },
              { label: "Completed",   value: done.length,        color: INK },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "28px", fontWeight: 700, color: s.color, lineHeight: 1 }}>
                  {s.value}
                </div>
                <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "9px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: INK_FAINT, marginTop: "2px" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 3-column grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "5fr 4fr 3fr", gap: 0 }}>

        {/* ── COL 1: Today's Focus + Completed Today ── */}
        <div style={{ paddingRight: "32px" }}>
          <SectionHeader label="Today's Focus" />

          {today.length === 0 && completedToday.length === 0 ? (
            <EmptyState message="No tasks due today." hint="Add due dates to surface tasks here." />
          ) : (
            <>
              {today.map(task => {
                const area   = areaMap[task.areaId];
                const isDone = task.status === "done";
                const isLead = today.indexOf(task) === 0;
                return (
                  <TaskArticle
                    key={task._id}
                    task={task}
                    area={area}
                    isDone={isDone}
                    isLead={isLead}
                    completing={completing}
                    onComplete={handleComplete}
                  />
                );
              })}
              {completedToday.length > 0 && (
                <div style={{ marginTop: today.length > 0 ? "24px" : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                    <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "9px", fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", color: "#3A7D44" }}>
                      Done Today · {completedToday.length}
                    </span>
                    <div style={{ flex: 1, height: "1px", background: "#3A7D44", opacity: 0.3 }} />
                  </div>
                  {completedToday.map(task => {
                    const area = areaMap[task.areaId];
                    return (
                      <div key={task._id} style={{ padding: "10px 0", borderBottom: `1px solid ${RULE_L}`, display: "flex", alignItems: "flex-start", gap: "8px" }}>
                        <CheckCircle done onClick={() => handleComplete(task._id, true)} />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "15px", fontWeight: 700, color: INK_FAINT, textDecoration: "line-through", lineHeight: 1.2 }}>
                            {task.title}
                          </span>
                          {area && (
                            <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "9px", color: INK_FAINT, marginTop: "2px", letterSpacing: "0.5px" }}>
                              {area.name}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── COL 2: In Progress + Overdue ── */}
        <div style={{ padding: "0 32px", borderLeft: `1px solid ${INK}` }}>

          {/* In Progress */}
          <div style={{ marginBottom: inProgress.length > 0 ? "28px" : 0 }}>
            <SectionHeader label="In Progress" />
            {inProgress.length === 0 ? (
              <EmptyState message="Nothing in progress." hint="Move a task to In Progress to track active work." />
            ) : (
              inProgress.map(task => {
                const area = areaMap[task.areaId];
                return (
                  <div key={task._id} style={{ padding: "11px 0", borderBottom: `1px solid ${RULE_L}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "4px" }}>
                      <span style={{
                        fontFamily: "'Inter', system-ui, sans-serif",
                        fontSize: "8px", fontWeight: 700, letterSpacing: "1.5px",
                        textTransform: "uppercase", color: WHITE,
                        background: INK_MID, padding: "2px 6px",
                      }}>
                        Active
                      </span>
                      {area && (
                        <span style={{
                          fontFamily: "'Inter', system-ui, sans-serif",
                          fontSize: "8px", fontWeight: 700, letterSpacing: "1.5px",
                          textTransform: "uppercase", color: INK_LIGHT,
                          border: `1px solid ${RULE_L}`, padding: "2px 6px",
                        }}>
                          {area.name}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "7px" }}>
                      <CheckCircle done={false} onClick={() => handleComplete(task._id, false)} />
                      <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "15px", fontWeight: 700, color: INK, lineHeight: 1.2 }}>
                        {task.title}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Overdue */}
          {overdue.length > 0 && (
            <div>
              <SectionHeader label="Overdue" labelColor={RED} />
              {overdue.slice(0, 6).map(task => {
                const area   = areaMap[task.areaId];
                const isDone = task.status === "done";
                return (
                  <div
                    key={task._id}
                    style={{
                      padding: "11px 0",
                      borderBottom: `1px solid ${RULE_L}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "4px" }}>
                      <span style={{
                        fontFamily: "'Inter', system-ui, sans-serif",
                        fontSize: "8px", fontWeight: 700, letterSpacing: "1.5px",
                        textTransform: "uppercase", color: WHITE,
                        background: RED, padding: "2px 6px",
                      }}>
                        Overdue
                      </span>
                      {area && (
                        <span style={{
                          fontFamily: "'Inter', system-ui, sans-serif",
                          fontSize: "8px", fontWeight: 700, letterSpacing: "1.5px",
                          textTransform: "uppercase", color: INK_LIGHT,
                          border: `1px solid ${RULE_L}`, padding: "2px 6px",
                        }}>
                          {area.name}
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "7px" }}>
                      <CheckCircle done={isDone} urgent onClick={() => handleComplete(task._id, isDone)} />
                      <span style={{
                        fontFamily: "'Playfair Display', Georgia, serif",
                        fontSize: "15px", fontWeight: 700, color: INK, lineHeight: 1.2,
                      }}>
                        {task.title}
                      </span>
                    </div>
                    {task.dueDate && (
                      <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "10px", color: RED, marginTop: "3px", paddingLeft: "21px" }}>
                        Was due {format(new Date(task.dueDate), "d MMM")}
                      </div>
                    )}
                  </div>
                );
              })}
              {overdue.length > 6 && (
                <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", color: INK_FAINT, padding: "10px 0" }}>
                  +{overdue.length - 6} more overdue
                </div>
              )}
            </div>
          )}

        </div>

        {/* ── COL 3: Area Health ── */}
        <div style={{ paddingLeft: "32px", borderLeft: `1px solid ${INK}` }}>
          <SectionHeader label="Area Health" />

          {areas.length === 0 ? (
            <EmptyState message="No areas yet." hint="Create an area to track health." />
          ) : (
            areas.map(area => {
              const score        = (healthScores as Record<string, number>)[area._id] ?? 50;
              const color        = healthColor(score);
              const daysInactive = (lastActivity as Record<string, number>)[area._id] ?? 99;
              const isStale      = daysInactive >= 3;
              const areaGoals    = allGoals.filter((g: {areaId: string; status: string; targetValue?: number}) => g.areaId === area._id && g.status === "active" && g.targetValue);
              const topGoal      = areaGoals[0] as {title: string; currentValue?: number; targetValue?: number} | undefined;
              const goalPct      = topGoal?.targetValue
                ? Math.min(100, Math.round(((topGoal.currentValue ?? 0) / topGoal.targetValue) * 100))
                : null;

              return (
                <div key={area._id} style={{ padding: "12px 0", borderBottom: `1px solid ${RULE_L}` }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "5px" }}>
                    <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "14px", fontWeight: 700, color: isStale ? INK_FAINT : INK }}>
                      {area.name}
                    </span>
                    <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "20px", fontWeight: 700, color }}>
                      {score}
                    </span>
                  </div>
                  <div style={{ width: "100%", height: "3px", background: RULE_L, marginBottom: "6px" }}>
                    <div style={{ width: `${score}%`, height: "100%", background: color, transition: "width 0.6s ease" }} />
                  </div>
                  {isStale && (
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "5px" }}>
                      <TrendingDown size={10} color={RED} />
                      <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "9px", fontWeight: 600, color: RED, letterSpacing: "0.5px" }}>
                        {daysInactive >= 99 ? "No activity yet" : `${daysInactive}d inactive — score dropping`}
                      </span>
                    </div>
                  )}
                  {goalPct !== null && topGoal && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                        <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "9px", color: INK_FAINT, maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {topGoal.title}
                        </span>
                        <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "0.5px",
                          color: goalPct >= 80 ? "#3A7D44" : goalPct >= 50 ? "#B08A4E" : INK_FAINT }}>
                          {goalPct}%{goalPct >= 70 && goalPct < 100 && <span style={{ marginLeft: "3px", fontSize: "8px" }}>↑</span>}
                        </span>
                      </div>
                      <div style={{ width: "100%", height: "2px", background: RULE_L }}>
                        <div style={{ width: `${goalPct}%`, height: "100%", transition: "width 0.8s ease",
                          background: goalPct >= 80 ? "#3A7D44" : goalPct >= 50 ? "#B08A4E" : INK_FAINT }} />
                      </div>
                      {goalPct >= 70 && goalPct < 100 && (
                        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "9px", color: "#3A7D44", fontWeight: 600, marginTop: "3px" }}>
                          {100 - goalPct}% to go — you&apos;re close
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

          {wonThisWeek.length > 0 && (
            <div style={{ marginTop: "28px" }}>
              <SectionHeader label={`Won This Week · ${wonThisWeek.length}`} />
              {wonThisWeek.slice(0, 8).map((task: {_id: string; title: string}) => (
                <div key={task._id} style={{ display: "flex", alignItems: "flex-start", gap: "7px", padding: "9px 0", borderBottom: `1px solid ${RULE_L}` }}>
                  <CheckCheck size={11} color="#3A7D44" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "12px", color: INK_FAINT, textDecoration: "line-through", lineHeight: 1.3 }}>
                    {task.title}
                  </span>
                </div>
              ))}
              {wonThisWeek.length > 8 && (
                <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "9px", fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: INK_FAINT, paddingTop: "8px" }}>
                  +{wonThisWeek.length - 8} more this week
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Internal components ── */

function SectionHeader({ label, extra, labelColor }: { label: string; extra?: string; labelColor?: string }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: "9px",
          fontWeight: 700,
          letterSpacing: "3px",
          textTransform: "uppercase",
          color: labelColor ?? RED,
        }}>
          {label}
        </span>
        {extra && (
          <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "9px", color: INK_FAINT }}>
            {extra}
          </span>
        )}
      </div>
      <div style={{ width: "100%", height: "1px", background: INK, marginTop: "5px" }} />
    </div>
  );
}

function CheckCircle({ done, urgent, onClick, style }: {
  done: boolean;
  urgent?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        width: "14px",
        height: "14px",
        borderRadius: "50%",
        border: `1.5px solid ${urgent && !done ? RED : done ? INK : INK}`,
        background: done ? INK : "transparent",
        cursor: onClick ? "pointer" : "default",
        flexShrink: 0,
        position: "relative",
        transition: "all 0.15s",
        ...style,
      }}
    >
      {done && (
        <div style={{
          position: "absolute",
          top: "1px", left: "3.5px",
          width: "4px", height: "7px",
          border: `1.5px solid #FFFFFF`,
          borderTop: "none",
          borderLeft: "none",
          transform: "rotate(45deg)",
        }} />
      )}
    </div>
  );
}

function TaskArticle({ task, area, isDone, isLead, completing, onComplete }: {
  task: { _id: Id<"tasks">; title: string; priority: string; dueDate?: number; status: string };
  area?: { name: string; color: string };
  isDone: boolean;
  isLead: boolean;
  completing: string | null;
  onComplete: (id: Id<"tasks">, isDone: boolean) => void;
}) {
  const isUrgent  = task.priority === "urgent";
  const isOverdue = task.dueDate && task.dueDate < Date.now() && !isDone;

  return (
    <div style={{ padding: "14px 0", borderBottom: `1px solid ${RULE_L}` }}>
      {/* Meta */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
        {isUrgent && (
          <span style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "8.5px", fontWeight: 700, letterSpacing: "1.5px",
            textTransform: "uppercase", color: WHITE, background: RED, padding: "2px 6px",
          }}>
            Urgent
          </span>
        )}
        {area && (
          <span style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "8.5px", fontWeight: 700, letterSpacing: "1.5px",
            textTransform: "uppercase", color: WHITE, background: INK, padding: "2px 6px",
          }}>
            {area.name}
          </span>
        )}
        {task.dueDate && (
          <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "9.5px", color: isOverdue ? RED : INK_FAINT }}>
            {isOverdue ? `Overdue · ` : ""}{format(new Date(task.dueDate), "d MMM")}
          </span>
        )}
      </div>

      {/* Headline */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "7px", marginBottom: "5px" }}>
        <CheckCircle
          done={isDone}
          urgent={isUrgent}
          onClick={() => completing !== task._id && onComplete(task._id, isDone)}
          style={{ marginTop: "3px" }}
        />
        <span style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontWeight: 700,
          fontSize: isLead ? "22px" : "17px",
          lineHeight: 1.15,
          color: isDone ? INK_FAINT : INK,
          textDecoration: isDone ? "line-through" : "none",
          cursor: "pointer",
          transition: "color 0.1s",
        }}>
          {task.title}
        </span>
      </div>

      {/* Actions */}
      {!isDone && (
        <div style={{ display: "flex", gap: "12px", paddingLeft: "21px" }}>
          <span style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "10px", fontWeight: 600, letterSpacing: "0.3px",
            color: INK, borderBottom: `1px solid ${INK}`, cursor: "pointer",
          }}>
            Complete
          </span>
          <span style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "10px", fontWeight: 600, letterSpacing: "0.3px",
            color: INK_FAINT, cursor: "pointer", borderBottom: "1px solid transparent",
          }}>
            Defer
          </span>
        </div>
      )}
    </div>
  );
}

function EmptyState({ message, hint }: { message: string; hint: string }) {
  return (
    <div style={{ padding: "24px 0" }}>
      <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontSize: "14px", color: INK_LIGHT }}>
        {message}
      </p>
      <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "11px", color: INK_FAINT, marginTop: "4px" }}>
        {hint}
      </p>
    </div>
  );
}
