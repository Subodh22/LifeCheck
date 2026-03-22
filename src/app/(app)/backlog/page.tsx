"use client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { format } from "date-fns";
import { useState } from "react";
import CreateTaskModal from "@/components/CreateTaskModal";

const INK       = "#0D0D0D";
const INK_LIGHT = "#555550";
const INK_FAINT = "#999990";
const RED       = "#C41E3A";
const RULE_L    = "#CCCCBC";
const NEWSPRINT = "#FAFAF5";
const WHITE     = "#FFFFFF";

const STATUS_LABELS: Record<string, string> = {
  backlog:     "Backlog",
  todo:        "To Do",
  in_progress: "In Progress",
  blocked:     "Blocked",
  done:        "Done",
};

const PRIORITY_ORDER = ["urgent", "high", "medium", "low"];
const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgent",
  high:   "High",
  medium: "Medium",
  low:    "Low",
};

type Status   = "backlog" | "todo" | "in_progress" | "blocked" | "done";
type Priority = "urgent" | "high" | "medium" | "low";

export default function BacklogPage() {
  const { userId } = useCurrentUser();
  const tasks  = useQuery(api.tasks.listByUser, userId ? { userId } : "skip") ?? [];
  const areas  = useQuery(api.areas.list,       userId ? { userId } : "skip") ?? [];
  const updateStatus = useMutation(api.tasks.updateStatus);

  const areaMap = Object.fromEntries(areas.map(a => [a._id, a]));

  const [search,         setSearch]         = useState("");
  const [statusFilter,   setStatusFilter]   = useState<Status | "">("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "">("");
  const [areaFilter,     setAreaFilter]     = useState("");
  const [showDone,       setShowDone]       = useState(false);
  const [createOpen,     setCreateOpen]     = useState(false);
  const [movingTask,     setMovingTask]     = useState<string | null>(null);

  const filtered = tasks
    .filter(t => showDone ? true : t.status !== "done")
    .filter(t => !search         || t.title.toLowerCase().includes(search.toLowerCase()))
    .filter(t => !statusFilter   || t.status   === statusFilter)
    .filter(t => !priorityFilter || t.priority === priorityFilter)
    .filter(t => !areaFilter     || t.areaId   === areaFilter);

  const sorted = [...filtered].sort((a, b) => {
    const pa = PRIORITY_ORDER.indexOf(a.priority);
    const pb = PRIORITY_ORDER.indexOf(b.priority);
    if (pa !== pb) return pa - pb;
    return (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity);
  });

  const handleMove = async (taskId: Id<"tasks">, status: Status) => {
    setMovingTask(taskId);
    try { await updateStatus({ id: taskId, status }); }
    finally { setMovingTask(null); }
  };

  const hasFilters = search || statusFilter || priorityFilter || areaFilter;

  return (
    <div style={{ padding: "0 64px 80px", background: NEWSPRINT, minHeight: "calc(100vh - 72px)" }}>

      {/* ── Page Hero ── */}
      <div style={{ paddingTop: "36px", paddingBottom: "24px", borderBottom: `2px solid ${INK}`, marginBottom: "28px" }}>
        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", color: RED, marginBottom: "8px" }}>
          Task Registry
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontWeight: 900,
            fontSize: "64px",
            lineHeight: 0.95,
            letterSpacing: "-2px",
            textTransform: "uppercase",
            color: INK,
          }}>
            Backlog
          </h1>
          {/* Stats */}
          <div style={{ display: "flex", gap: "32px", alignItems: "flex-end", paddingBottom: "4px" }}>
            {[
              { label: "Total",      value: tasks.filter(t => t.status !== "done").length },
              { label: "Filtered",   value: sorted.length, accent: true },
              { label: "Overdue",    value: tasks.filter(t => t.dueDate && t.dueDate < Date.now() && t.status !== "done").length, danger: true },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "right" }}>
                <div style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: "24px",
                  fontWeight: 700,
                  color: s.danger && (s.value as number) > 0 ? RED : INK,
                  lineHeight: 1,
                }}>
                  {s.value}
                </div>
                <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "9px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: INK_FAINT, marginTop: "2px" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sub row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "14px" }}>
          <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "12px", color: INK_LIGHT }}>
            Sorted by priority, then due date
          </span>
          <button
            onClick={() => setCreateOpen(true)}
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: "11px", fontWeight: 600, letterSpacing: "1px",
              textTransform: "uppercase", color: WHITE,
              background: INK, border: "none", cursor: "pointer",
              padding: "7px 14px", transition: "background 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = RED}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = INK}
          >
            + New Task
          </button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "8px" }}>
        {/* Status filter group */}
        <div style={{ display: "flex", overflow: "hidden" }}>
          {(["", "backlog", "todo", "in_progress", "blocked", "done"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s as Status | "")}
              style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: "10px", fontWeight: 600, letterSpacing: "1.5px",
                textTransform: "uppercase", padding: "7px 14px",
                border: `1px solid ${RULE_L}`, borderRight: "none",
                cursor: "pointer", transition: "all 0.15s",
                background: statusFilter === s ? INK : "transparent",
                color: statusFilter === s ? WHITE : INK_FAINT,
              }}
            >
              {s === "" ? "All" : STATUS_LABELS[s]}
            </button>
          ))}
          <div style={{ width: "1px", background: RULE_L }} />
        </div>

        {/* Priority filter */}
        <div style={{ display: "flex", overflow: "hidden" }}>
          {(["", "urgent", "high", "medium", "low"] as const).map(p => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p as Priority | "")}
              style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: "10px", fontWeight: 600, letterSpacing: "1.5px",
                textTransform: "uppercase", padding: "7px 12px",
                border: `1px solid ${RULE_L}`, borderRight: "none",
                cursor: "pointer", transition: "all 0.15s",
                background: priorityFilter === p ? INK : "transparent",
                color: priorityFilter === p ? WHITE : INK_FAINT,
              }}
            >
              {p === "" ? "Priority" : PRIORITY_LABELS[p]}
            </button>
          ))}
          <div style={{ width: "1px", background: RULE_L }} />
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search tasks…"
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "11px", color: INK, marginLeft: "auto",
            border: `1px solid ${RULE_L}`, background: "transparent",
            padding: "6px 14px", outline: "none", width: "220px",
          }}
        />

        {/* Show done */}
        <button
          onClick={() => setShowDone(v => !v)}
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "10px", fontWeight: 600, letterSpacing: "1px",
            textTransform: "uppercase", padding: "7px 12px",
            border: `1px solid ${RULE_L}`, cursor: "pointer",
            background: showDone ? INK : "transparent",
            color: showDone ? WHITE : INK_FAINT,
            marginLeft: "8px", transition: "all 0.15s",
          }}
        >
          {showDone ? "Hide Done" : "Show Done"}
        </button>

        {/* Clear */}
        {hasFilters && (
          <button
            onClick={() => { setSearch(""); setStatusFilter(""); setPriorityFilter(""); setAreaFilter(""); }}
            style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: "10px", fontWeight: 600, letterSpacing: "1px",
              textTransform: "uppercase", color: RED, background: "none",
              border: "none", cursor: "pointer", marginLeft: "8px",
            }}
          >
            Clear ×
          </button>
        )}
      </div>

      {/* ── Task table ── */}
      <div>
        {/* Column headers */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "0",
          borderTop: `1px solid ${INK}`,
          borderBottom: `1px solid ${RULE_L}`,
          padding: "10px 0",
        }}>
          {[
            { label: "Task",     flex: "1" },
            { label: "Status",   width: "130px" },
            { label: "Priority", width: "100px" },
            { label: "Area",     width: "130px" },
            { label: "Due",      width: "90px" },
          ].map(col => (
            <div
              key={col.label}
              style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: "9px", fontWeight: 700, letterSpacing: "2px",
                textTransform: "uppercase", color: INK_FAINT,
                flex: col.flex, width: col.width, flexShrink: col.width ? 0 : undefined,
              }}
            >
              {col.label}
            </div>
          ))}
        </div>

        {sorted.length === 0 ? (
          <div style={{ padding: "48px 0", textAlign: "center" }}>
            <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontSize: "18px", color: INK_LIGHT }}>
              No tasks match your filters.
            </p>
            <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "11px", color: INK_FAINT, marginTop: "8px" }}>
              Try adjusting your filters or create a new task.
            </p>
          </div>
        ) : (
          sorted.map(task => {
            const taskArea  = areaMap[task.areaId];
            const isOverdue = task.dueDate && task.dueDate < Date.now() && task.status !== "done";
            const isDone    = task.status === "done";
            const isUrgent  = task.priority === "urgent";

            return (
              <div
                key={task._id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  borderBottom: `1px solid ${RULE_L}`,
                  padding: "13px 0",
                  cursor: "pointer",
                  transition: "background 0.08s",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.02)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              >
                {/* Task title */}
                <div style={{ flex: 1, minWidth: 0, paddingRight: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                    {isUrgent && (
                      <span style={{
                        fontFamily: "'Inter', system-ui, sans-serif",
                        fontSize: "7.5px", fontWeight: 700, letterSpacing: "1.5px",
                        textTransform: "uppercase", color: WHITE,
                        background: RED, padding: "1.5px 5px", flexShrink: 0,
                      }}>
                        Urgent
                      </span>
                    )}
                    <span style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontSize: "15px", fontWeight: 700, color: isDone ? INK_FAINT : INK,
                      textDecoration: isDone ? "line-through" : "none",
                      lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {task.title}
                    </span>
                  </div>
                </div>

                {/* Status */}
                <div style={{ width: "130px", flexShrink: 0 }}>
                  <select
                    value={task.status}
                    onClick={e => e.stopPropagation()}
                    onChange={e => handleMove(task._id, e.target.value as Status)}
                    disabled={movingTask === task._id}
                    style={{
                      fontFamily: "'Inter', system-ui, sans-serif",
                      fontSize: "10px", fontWeight: 600, letterSpacing: "1px",
                      textTransform: "uppercase", color: INK_LIGHT,
                      background: "transparent", border: `1px solid ${RULE_L}`,
                      padding: "3px 8px", cursor: "pointer", outline: "none",
                    }}
                  >
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div style={{ width: "100px", flexShrink: 0 }}>
                  <span style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: "10px", fontWeight: 600, letterSpacing: "1px",
                    textTransform: "uppercase",
                    color: task.priority === "urgent" ? RED : task.priority === "high" ? "#B08A4E" : INK_FAINT,
                  }}>
                    {PRIORITY_LABELS[task.priority] ?? "—"}
                  </span>
                </div>

                {/* Area */}
                <div style={{ width: "130px", flexShrink: 0 }}>
                  {taskArea ? (
                    <span style={{
                      fontFamily: "'Inter', system-ui, sans-serif",
                      fontSize: "10px", fontWeight: 600, letterSpacing: "1px",
                      textTransform: "uppercase", color: INK_LIGHT,
                      border: `1px solid ${RULE_L}`, padding: "2px 7px",
                    }}>
                      {taskArea.name}
                    </span>
                  ) : (
                    <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "10px", color: INK_FAINT }}>—</span>
                  )}
                </div>

                {/* Due */}
                <div style={{ width: "90px", flexShrink: 0 }}>
                  <span style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: "11px",
                    color: isOverdue ? RED : INK_FAINT,
                    fontWeight: isOverdue ? 600 : 400,
                  }}>
                    {task.dueDate ? format(new Date(task.dueDate), "d MMM") : "—"}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      <CreateTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        userId={userId ?? ""}
        areas={areas}
      />
    </div>
  );
}
