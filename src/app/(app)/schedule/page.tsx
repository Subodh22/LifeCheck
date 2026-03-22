"use client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useState, useCallback, useEffect, useMemo, memo } from "react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, addDays, setHours, setMinutes } from "date-fns";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  CalendarCheck2,
  Unlink,
  GripVertical,
  ExternalLink,
  Trash2,
  ChevronDown,
  Check,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────

const HOUR_START  = 6;
const HOUR_END    = 22;
const HOURS       = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const CELL_HEIGHT = 64; // px per hour
const SNAP_MINS   = 15;

// ── Types ──────────────────────────────────────────────────────────────────────

type Task = {
  _id: Id<"tasks">;
  title: string;
  status: string;
  priority: string;
  areaId: Id<"areas">;
  dueDate?: number;
  scheduledStart?: number;
  scheduledEnd?: number;
  gcalEventId?: string;
};

type GCalEvent = {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end:   { dateTime?: string; date?: string };
  htmlLink?: string;
  colorId?: string;
};

type PendingMove = { scheduledStart: number; scheduledEnd: number };

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtTime(ts: number) {
  return format(new Date(ts), "h:mma").toLowerCase();
}

function durationMins(start: number, end: number) {
  return Math.round((end - start) / 60000);
}

function priorityColor(p: string) {
  if (p === "urgent") return "#E85538";
  if (p === "high")   return "#E8A838";
  if (p === "medium") return "#4A9EE0";
  return "#3A3A3E";
}

function gcalColor(colorId?: string) {
  const map: Record<string, string> = {
    "1": "#7986CB", "2": "#33B679", "3": "#8E24AA", "4": "#E67C73",
    "5": "#F6BF26", "6": "#F4511E", "7": "#039BE5", "8": "#616161",
    "9": "#3F51B5", "10": "#0B8043", "11": "#D50000",
  };
  return colorId ? (map[colorId] ?? "#039BE5") : "#039BE5";
}

function tsToOffset(ts: number): number {
  const d = new Date(ts);
  return (d.getHours() + d.getMinutes() / 60 - HOUR_START) * CELL_HEIGHT;
}

// ── Sub-components (memo'd to prevent unnecessary re-renders) ─────────────────

const UnscheduledChip = memo(function UnscheduledChip({
  task, areaColor,
}: { task: Task; areaColor?: string }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `unscheduled-${task._id}`,
    data: { taskId: task._id, type: "unscheduled" },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center gap-2 px-3 py-2 bg-[#111113] border border-[#2A2A2E] rounded cursor-grab hover:border-[#333338] transition-colors group"
    >
      <GripVertical size={11} className="text-[#3A3A3E] shrink-0" />
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: priorityColor(task.priority) }} />
      {areaColor && <span className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ backgroundColor: areaColor }} />}
      <span className="font-ui text-[12px] text-[#C4C0BA] leading-snug flex-1 min-w-0 truncate">
        {task.title}
      </span>
    </div>
  );
});

const TimeSlotCell = memo(function TimeSlotCell({
  dayIdx, hour, minute = 0,
}: { dayIdx: number; hour: number; minute?: number }) {
  const id = `slot-${dayIdx}-${hour}-${minute}`;
  const { isOver, setNodeRef } = useDroppable({ id, data: { dayIdx, hour, minute } });

  return (
    <div
      ref={setNodeRef}
      className={cn("absolute w-full", isOver && "bg-[#C9A84C0A]")}
      style={{
        top:    (hour - HOUR_START + minute / 60) * CELL_HEIGHT,
        height: (SNAP_MINS / 60) * CELL_HEIGHT,
      }}
    />
  );
});

const ScheduledTaskBlock = memo(function ScheduledTaskBlock({
  task, onUnschedule, onComplete, onUndone,
}: {
  task: Task;
  onUnschedule: (id: Id<"tasks">) => void;
  onComplete:   (id: Id<"tasks">) => void;
  onUndone:     (id: Id<"tasks">) => void;
}) {
  const done     = task.status === "done";
  const start    = task.scheduledStart!;
  const end      = task.scheduledEnd!;
  const topPx    = tsToOffset(start);
  const heightPx = Math.max((durationMins(start, end) / 60) * CELL_HEIGHT, 24);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `scheduled-${task._id}`,
    data: { taskId: task._id, type: "scheduled", originalStart: start, originalEnd: end },
    disabled: done,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{ transform: CSS.Translate.toString(transform), top: topPx, height: heightPx, opacity: isDragging ? 0.5 : 1 }}
      className={cn(
        "absolute left-0.5 right-0.5 rounded px-2 py-1 z-10 group overflow-hidden",
        done
          ? "bg-[#1A1A1D] border border-[#2A2A2E] cursor-default"
          : "bg-[#4A9EE018] border border-[#4A9EE040] cursor-grab"
      )}
    >
      <p className={cn(
        "font-ui text-[11px] font-medium leading-tight truncate pr-8",
        done ? "line-through text-[#3A3A3E]" : "text-[#4A9EE0]"
      )}>
        {task.title}
      </p>
      <p className={cn("font-ui text-[10px] tabular-nums", done ? "text-[#2A2A2E]" : "text-[#4A9EE060]")}>
        {fmtTime(start)} – {fmtTime(end)}
      </p>

      {/* Action buttons — visible on hover */}
      <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
        {done ? (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onUndone(task._id)}
            className="text-[#4CAF6B] hover:text-[#3A3A3E] transition-colors"
            title="Mark undone"
          >
            <Check size={9} />
          </button>
        ) : (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onComplete(task._id)}
            className="text-[#3A3A3E] hover:text-[#4CAF6B] transition-colors"
            title="Mark done"
          >
            <Check size={9} />
          </button>
        )}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onUnschedule(task._id)}
          className="text-[#3A3A3E] hover:text-[#E85538] transition-colors"
          title="Remove from calendar"
        >
          <Unlink size={9} />
        </button>
      </div>

      {/* Done checkmark — always visible when done, hidden on hover (replaced by toggle) */}
      {done && (
        <div className="absolute top-1 right-1 group-hover:opacity-0 transition-all">
          <Check size={9} className="text-[#4CAF6B]" />
        </div>
      )}
    </div>
  );
});

const GCalEventBlock = memo(function GCalEventBlock({
  event, onDelete,
}: { event: GCalEvent; onDelete: (id: string) => void }) {
  const startStr = event.start.dateTime ?? event.start.date;
  const endStr   = event.end.dateTime   ?? event.end.date;
  if (!startStr || !endStr) return null;

  const start    = new Date(startStr).getTime();
  const end      = new Date(endStr).getTime();
  const topPx    = tsToOffset(start);
  const heightPx = Math.max((durationMins(start, end) / 60) * CELL_HEIGHT, 20);
  const color    = gcalColor(event.colorId);

  return (
    <div
      style={{ top: topPx, height: heightPx, borderLeftColor: color, backgroundColor: `${color}12` }}
      className="absolute left-0.5 right-0.5 rounded border-l-2 border border-transparent px-2 py-0.5 overflow-hidden pointer-events-auto group z-5"
    >
      <p className="font-ui text-[11px] leading-tight truncate pr-8" style={{ color }}>{event.summary}</p>
      <p className="font-ui text-[10px] tabular-nums" style={{ color: `${color}80` }}>
        {fmtTime(start)} – {fmtTime(end)}
      </p>
      <div className="absolute top-0.5 right-0.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {event.htmlLink && (
          <a
            href={event.htmlLink}
            target="_blank"
            rel="noreferrer"
            onPointerDown={(e) => e.stopPropagation()}
            className="p-0.5 rounded hover:bg-white/10 transition-colors"
            style={{ color }}
          >
            <ExternalLink size={9} />
          </a>
        )}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onDelete(event.id)}
          className="p-0.5 rounded hover:bg-white/10 transition-colors text-[#E85538]"
        >
          <Trash2 size={9} />
        </button>
      </div>
    </div>
  );
});

function DragOverlayChip({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[#1E1E21] border border-[#C9A84C] rounded shadow-xl cursor-grabbing">
      <GripVertical size={11} className="text-[#C9A84C]" />
      <span className="font-ui text-[12px] text-[#F2EEE8]">{title}</span>
    </div>
  );
}

// Static grid background — rendered once per column, no React re-renders
const DayColumnGrid = memo(function DayColumnGrid({ dayIdx }: { dayIdx: number }) {
  return (
    <>
      {HOURS.map((h) => (
        <div key={h} className="absolute w-full border-t border-[#1A1A1D]" style={{ top: (h - HOUR_START) * CELL_HEIGHT }} />
      ))}
      {HOURS.map((h) => (
        <div key={`${h}-h`} className="absolute w-full border-t border-dashed border-[#16161A]" style={{ top: (h - HOUR_START + 0.5) * CELL_HEIGHT }} />
      ))}
      {HOURS.flatMap((h) =>
        [0, 15, 30, 45].map((m) => (
          <TimeSlotCell key={`${h}-${m}`} dayIdx={dayIdx} hour={h} minute={m} />
        ))
      )}
    </>
  );
});

// ── Schedule page ──────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const { userId } = useCurrentUser();
  const areas = useQuery(api.areas.list, userId ? { userId } : "skip") ?? [];

  const [weekDate,      setWeekDate]      = useState(() => new Date());
  const [gcalEvents,    setGcalEvents]    = useState<GCalEvent[]>([]);
  const [gcalConnected, setGcalConnected] = useState<boolean | null>(null);
  const [activeId,      setActiveId]      = useState<string | null>(null);
  const [connectingGcal, setConnectingGcal] = useState(false);
  const [backlogOpen,    setBacklogOpen]    = useState(false);
  const [completedOpen,  setCompletedOpen]  = useState(false);

  // Optimistic moves: taskId → pending {scheduledStart, scheduledEnd}
  // Applied immediately on drop so the block moves without waiting for Convex
  const [pendingMoves, setPendingMoves] = useState<Map<string, PendingMove>>(new Map());

  const scheduleTask   = useMutation(api.tasks.scheduleTask);
  const unscheduleTask = useMutation(api.tasks.unscheduleTask);
  const updateStatus   = useMutation(api.tasks.updateStatus);

  const weekStart = useMemo(() => startOfWeek(weekDate, { weekStartsOn: 1 }), [weekDate]);
  const weekEnd   = useMemo(() => endOfWeek(weekDate,   { weekStartsOn: 1 }), [weekDate]);
  const weekDays  = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const weekStartMs = weekStart.getTime();
  const weekEndMs   = weekEnd.getTime();

  const scheduledTasks   = useQuery(
    api.tasks.listScheduledForWeek,
    userId ? { userId, weekStart: weekStartMs, weekEnd: weekEndMs } : "skip"
  ) ?? [];

  const unscheduledTasks = useQuery(
    api.tasks.listUnscheduled,
    userId ? { userId } : "skip"
  ) ?? [];

  const doneTasks = useQuery(
    api.tasks.listDoneForWeek,
    userId ? { userId, weekStart: weekStartMs, weekEnd: weekEndMs } : "skip"
  ) ?? [];

  const areaMap = useMemo(
    () => Object.fromEntries(areas.map((a) => [a._id, a])),
    [areas]
  );

  // Clear pending moves once Convex confirms them
  useEffect(() => {
    if (pendingMoves.size === 0) return;
    setPendingMoves((prev) => {
      const next = new Map(prev);
      for (const task of scheduledTasks) {
        const pending = next.get(task._id);
        if (pending && task.scheduledStart === pending.scheduledStart) {
          next.delete(task._id);
        }
      }
      return next.size === prev.size ? prev : next;
    });
  }, [scheduledTasks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Merge optimistic moves with Convex data for rendering
  const displayScheduledTasks = useMemo(() => {
    const result = scheduledTasks.map((t) => {
      const move = pendingMoves.get(t._id);
      return move ? { ...t, ...move } : t;
    });
    // Tasks moved FROM unscheduled before Convex updates
    for (const [taskId, move] of pendingMoves) {
      if (!result.find((t) => t._id === taskId)) {
        const task = unscheduledTasks.find((t) => t._id === taskId);
        if (task) result.push({ ...task, ...move });
      }
    }
    return result;
  }, [scheduledTasks, unscheduledTasks, pendingMoves]);

  // Split unscheduled tasks into "this week" and "backlog"
  // This week = due within the current week OR overdue OR urgent/high with no due date
  const { thisWeekTasks, backlogTasks } = useMemo(() => {
    const available = unscheduledTasks.filter((t) => !pendingMoves.has(t._id));
    const thisWeek: Task[] = [];
    const backlog:  Task[] = [];
    for (const t of available) {
      const dueThisWeek  = t.dueDate && t.dueDate >= weekStartMs && t.dueDate <= weekEndMs;
      const overdue      = t.dueDate && t.dueDate < weekStartMs;
      const urgentNoDue  = !t.dueDate && (t.priority === "urgent" || t.priority === "high");
      if (dueThisWeek || overdue || urgentNoDue) {
        thisWeek.push(t);
      } else {
        backlog.push(t);
      }
    }
    // Sort this week: overdue first, then by due date, then by priority
    thisWeek.sort((a, b) => {
      const priorityRank = { urgent: 0, high: 1, medium: 2, low: 3 };
      if (a.dueDate && b.dueDate) return a.dueDate - b.dueDate;
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return (priorityRank[a.priority as keyof typeof priorityRank] ?? 3) -
             (priorityRank[b.priority as keyof typeof priorityRank] ?? 3);
    });
    return { thisWeekTasks: thisWeek, backlogTasks: backlog };
  }, [unscheduledTasks, pendingMoves, weekStartMs, weekEndMs]);

  // ── GCal ──
  const loadGcalEvents = useCallback(() => {
    if (!userId) return;
    const ws = new Date(weekStartMs).toISOString();
    const we = new Date(weekEndMs).toISOString();
    fetch(`/api/calendar/events?weekStart=${encodeURIComponent(ws)}&weekEnd=${encodeURIComponent(we)}`)
      .then((r) => r.json())
      .then((d) => {
        setGcalConnected(d.connected ?? false);
        setGcalEvents(d.events ?? []);
      })
      .catch(() => setGcalConnected(false));
  }, [userId, weekStartMs, weekEndMs]);

  useEffect(() => { loadGcalEvents(); }, [loadGcalEvents]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gcal") === "connected") {
      setGcalConnected(true);
      window.history.replaceState({}, "", window.location.pathname);
      loadGcalEvents();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── DnD ──
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const activeTask = useMemo(
    () => activeId
      ? [...scheduledTasks, ...unscheduledTasks].find(
          (t) => activeId === `scheduled-${t._id}` || activeId === `unscheduled-${t._id}`
        )
      : null,
    [activeId, scheduledTasks, unscheduledTasks]
  );

  const handleDragStart = useCallback((e: DragStartEvent) => setActiveId(String(e.active.id)), []);

  const handleDragEnd = useCallback((e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || !userId) return;

    const taskData = active.data.current as {
      taskId: Id<"tasks">; type: string; originalStart?: number; originalEnd?: number;
    };
    const slotData = over.data.current as { dayIdx: number; hour: number; minute: number } | undefined;
    if (!slotData) return;

    const { dayIdx, hour, minute } = slotData;
    const slotDate   = addDays(weekStart, dayIdx);
    const startTs    = setMinutes(setHours(slotDate, hour), minute).getTime();
    const durationMs = taskData.originalStart && taskData.originalEnd
      ? taskData.originalEnd - taskData.originalStart
      : 60 * 60 * 1000;
    const endTs = startTs + durationMs;

    // ── Optimistic update — move the block immediately ──
    setPendingMoves((prev) => new Map(prev).set(taskData.taskId, { scheduledStart: startTs, scheduledEnd: endTs }));

    const existingTask        = [...scheduledTasks, ...unscheduledTasks].find((t) => t._id === taskData.taskId);
    const gcalEventIdToUpdate = existingTask?.gcalEventId;

    if (gcalConnected && existingTask) {
      const payload = {
        action:      gcalEventIdToUpdate ? "update" : "create",
        taskId:      existingTask._id,
        title:       existingTask.title,
        start:       startTs,
        end:         endTs,
        gcalEventId: gcalEventIdToUpdate,
      };
      fetch("/api/calendar/events", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      })
        .then((r) => r.json())
        .then((d) => {
          scheduleTask({
            id:             taskData.taskId,
            scheduledStart: startTs,
            scheduledEnd:   endTs,
            gcalEventId:    d.eventId ?? gcalEventIdToUpdate,
          });
          // Update gcalEvents state locally — no full refetch needed
          if (d.eventId && !gcalEventIdToUpdate) {
            // New event created — add to local state so filter can exclude it
            // We don't have the full event object so we mark it via gcalEventId stored in Convex
            // The deduplication filter will hide it once Convex updates
          }
        })
        .catch(() => {
          scheduleTask({ id: taskData.taskId, scheduledStart: startTs, scheduledEnd: endTs });
        });
      return;
    }

    // No GCal — update Convex directly
    scheduleTask({ id: taskData.taskId, scheduledStart: startTs, scheduledEnd: endTs });
  }, [userId, weekStart, scheduledTasks, unscheduledTasks, scheduleTask, gcalConnected]);

  // Accept id only — stable reference so memo'd children don't re-render
  const handleUnschedule = useCallback((id: Id<"tasks">) => {
    const task = [...scheduledTasks, ...unscheduledTasks].find((t) => t._id === id);
    if (task?.gcalEventId && gcalConnected) {
      fetch("/api/calendar/events", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "delete", gcalEventId: task.gcalEventId }),
      }).catch(() => {});
    }
    unscheduleTask({ id });
  }, [scheduledTasks, unscheduledTasks, gcalConnected, unscheduleTask]);

  const handleComplete = useCallback((id: Id<"tasks">) => {
    // Mark done + remove from calendar so it disappears cleanly
    const task = [...scheduledTasks, ...unscheduledTasks].find((t) => t._id === id);
    updateStatus({ id, status: "done" });
    unscheduleTask({ id });
    if (task?.gcalEventId && gcalConnected) {
      fetch("/api/calendar/events", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "delete", gcalEventId: task.gcalEventId }),
      }).catch(() => {});
    }
  }, [scheduledTasks, unscheduledTasks, updateStatus, unscheduleTask, gcalConnected]);

  const handleUndone = useCallback((id: Id<"tasks">) => {
    // Set back to todo — task is already unscheduled so it returns to sidebar
    updateStatus({ id, status: "todo" });
  }, [updateStatus]);

  const handleDeleteGcalEvent = useCallback((eventId: string) => {
    setGcalEvents((prev) => prev.filter((ev) => ev.id !== eventId));
    fetch("/api/calendar/events", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "delete", gcalEventId: eventId }),
    }).catch(() => loadGcalEvents());
  }, [loadGcalEvents]);

  // ── Derived display data ──
  const taskGcalIds = useMemo(
    () => new Set(displayScheduledTasks.map((t) => t.gcalEventId).filter(Boolean)),
    [displayScheduledTasks]
  );

  const tasksByDay = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const dayStart = addDays(weekStart, i).getTime();
      const dayEnd   = dayStart + 86400000;
      return displayScheduledTasks.filter(
        (t) => t.scheduledStart! >= dayStart && t.scheduledStart! < dayEnd
      );
    }),
    [weekStart, displayScheduledTasks]
  );

  const gcalByDay = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const dayStart = addDays(weekStart, i).setHours(0, 0, 0, 0);
      const dayEnd   = dayStart + 86400000;
      return gcalEvents.filter((ev) => {
        if (taskGcalIds.has(ev.id)) return false;
        const s = ev.start.dateTime
          ? new Date(ev.start.dateTime).getTime()
          : new Date(ev.start.date!).getTime();
        return s >= dayStart && s < dayEnd;
      });
    }),
    [weekStart, gcalEvents, taskGcalIds]
  );

  const today = useMemo(() => new Date(), []);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-full flex flex-col bg-[#0A0A0B]">

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2A2A2E] shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="font-ui text-[20px] font-semibold text-[#F2EEE8]">Schedule</h1>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWeekDate((d) => subWeeks(d, 1))}
                className="p-1.5 rounded text-[#3A3A3E] hover:text-[#F2EEE8] hover:bg-[#18181B] transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setWeekDate(new Date())}
                className="px-3 py-1 rounded font-ui text-[12px] text-[#6B6760] hover:text-[#F2EEE8] hover:bg-[#18181B] transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => setWeekDate((d) => addWeeks(d, 1))}
                className="p-1.5 rounded text-[#3A3A3E] hover:text-[#F2EEE8] hover:bg-[#18181B] transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <span className="font-ui text-[13px] text-[#6B6760]">
              {format(weekStart, "d MMM")} – {format(weekEnd, "d MMM yyyy")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {gcalConnected === true && (
              <span className="flex items-center gap-1.5 font-ui text-[11px] text-[#4CAF6B]">
                <CalendarCheck2 size={12} />
                Google Calendar synced
              </span>
            )}
            {gcalConnected === false && (
              <button
                onClick={() => { setConnectingGcal(true); window.location.href = "/api/calendar"; }}
                disabled={connectingGcal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#2A2A2E] font-ui text-[12px] text-[#6B6760] hover:text-[#F2EEE8] hover:border-[#333338] transition-colors disabled:opacity-40"
              >
                <CalendarCheck2 size={12} />
                {connectingGcal ? "Connecting…" : "Connect Google Calendar"}
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 flex min-h-0 overflow-hidden">

          {/* Sidebar */}
          <div className="w-[220px] shrink-0 border-r border-[#2A2A2E] flex flex-col overflow-hidden">

            {/* Header */}
            <div className="px-3 py-2.5 border-b border-[#2A2A2E] shrink-0">
              <p className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#3A3A3E] font-medium">This Week</p>
              <p className="font-ui text-[10px] text-[#3A3A3E] mt-0.5">Drag tasks onto the grid</p>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">

              {/* ── This Week ── */}
              <div className="p-2 space-y-1.5">
                {thisWeekTasks.length === 0 ? (
                  <div className="px-2 py-5 text-center">
                    <p className="font-ui text-[11px] text-[#3A3A3E]">Nothing due this week</p>
                  </div>
                ) : (
                  thisWeekTasks.map((t) => (
                    <UnscheduledChip key={t._id} task={t} areaColor={areaMap[t.areaId]?.color} />
                  ))
                )}
              </div>

              {/* ── Backlog (collapsible) ── */}
              {backlogTasks.length > 0 && (
                <div className="border-t border-[#1E1E21]">
                  <button
                    onClick={() => setBacklogOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#111113] transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-ui text-[10px] uppercase tracking-[0.12em] text-[#3A3A3E] font-medium">
                        Backlog
                      </span>
                      <span className="font-ui text-[10px] text-[#3A3A3E] tabular-nums">
                        {backlogTasks.length}
                      </span>
                    </div>
                    <ChevronDown
                      size={11}
                      className={cn("text-[#3A3A3E] transition-transform", backlogOpen && "rotate-180")}
                    />
                  </button>
                  {backlogOpen && (
                    <div className="px-2 pb-2 space-y-1.5">
                      {backlogTasks.map((t) => (
                        <UnscheduledChip key={t._id} task={t} areaColor={areaMap[t.areaId]?.color} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Completed this week (collapsible) ── */}
              {doneTasks.length > 0 && (
                <div className="border-t border-[#1E1E21]">
                  <button
                    onClick={() => setCompletedOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#111113] transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-ui text-[10px] uppercase tracking-[0.12em] text-[#3A3A3E] font-medium">
                        Done
                      </span>
                      <span className="font-ui text-[10px] text-[#3A3A3E] tabular-nums">
                        {doneTasks.length}
                      </span>
                    </div>
                    <ChevronDown
                      size={11}
                      className={cn("text-[#3A3A3E] transition-transform", completedOpen && "rotate-180")}
                    />
                  </button>
                  {completedOpen && (
                    <div className="px-2 pb-2 space-y-1">
                      {doneTasks.map((t) => (
                        <div
                          key={t._id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded border border-[#1E1E21] bg-[#111113]"
                        >
                          <Check size={10} className="text-[#3A7D44] shrink-0" />
                          <span className="font-ui text-[11px] text-[#3A3A3E] line-through truncate flex-1">
                            {t.title}
                          </span>
                          <button
                            onClick={() => updateStatus({ id: t._id, status: "todo" })}
                            className="font-ui text-[10px] text-[#3A3A3E] hover:text-[#6B6760] shrink-0 transition-colors"
                            title="Mark as todo"
                          >
                            Undo
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

          {/* Week grid */}
          <div className="flex-1 overflow-auto min-h-0">

            {/* Day headers */}
            <div className="sticky top-0 z-20 bg-[#0A0A0B] border-b border-[#2A2A2E] flex">
              <div className="w-12 shrink-0" />
              {weekDays.map((day, i) => {
                const isToday = format(day, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
                return (
                  <div key={i} className="flex-1 min-w-[100px] px-2 py-2.5 border-l border-[#2A2A2E] text-center">
                    <p className={cn("font-ui text-[11px] uppercase tracking-[0.1em]", isToday ? "text-[#C9A84C]" : "text-[#3A3A3E]")}>
                      {format(day, "EEE")}
                    </p>
                    <p className={cn("font-ui text-[16px] font-semibold mt-0.5 tabular-nums", isToday ? "text-[#C9A84C]" : "text-[#6B6760]")}>
                      {format(day, "d")}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Grid body */}
            <div className="flex">
              {/* Hour labels */}
              <div className="w-12 shrink-0">
                {HOURS.map((h) => (
                  <div key={h} className="flex items-start justify-end pr-2" style={{ height: CELL_HEIGHT }}>
                    <span className="font-ui text-[10px] text-[#3A3A3E] tabular-nums mt-px">
                      {format(setHours(new Date(), h), "ha").toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map((day, dayIdx) => {
                const isToday = format(day, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
                return (
                  <div
                    key={dayIdx}
                    className={cn("flex-1 min-w-[100px] border-l border-[#2A2A2E] relative", isToday && "bg-[#C9A84C04]")}
                    style={{ height: HOURS.length * CELL_HEIGHT }}
                  >
                    {/* Static grid lines + drop zones — memo'd, never re-renders */}
                    <DayColumnGrid dayIdx={dayIdx} />

                    {/* GCal events (pure GCal — task-linked ones filtered out) */}
                    {gcalByDay[dayIdx].map((ev) => (
                      <GCalEventBlock
                        key={ev.id}
                        event={ev}
                        onDelete={handleDeleteGcalEvent}
                      />
                    ))}

                    {/* Scheduled task blocks */}
                    {tasksByDay[dayIdx].map((t) => (
                      <ScheduledTaskBlock
                        key={t._id}
                        task={t}
                        onUnschedule={handleUnschedule}
                        onComplete={handleComplete}
                        onUndone={handleUndone}
                      />
                    ))}

                    {/* Current time indicator */}
                    {isToday && (() => {
                      const now = new Date();
                      const h   = now.getHours() + now.getMinutes() / 60;
                      if (h < HOUR_START || h > HOUR_END) return null;
                      return (
                        <div
                          className="absolute w-full flex items-center z-20 pointer-events-none"
                          style={{ top: (h - HOUR_START) * CELL_HEIGHT }}
                        >
                          <div className="w-2 h-2 rounded-full bg-[#E85538] shrink-0 -ml-1" />
                          <div className="flex-1 border-t border-[#E85538]" />
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeTask && <DragOverlayChip title={activeTask.title} />}
      </DragOverlay>
    </DndContext>
  );
}
