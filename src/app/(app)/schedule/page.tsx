"use client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useState, useCallback, useEffect } from "react";
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
  Clock,
  ExternalLink,
} from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────

const HOUR_START  = 6;   // 6am
const HOUR_END    = 22;  // 10pm
const HOURS       = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const CELL_HEIGHT = 64;  // px per hour
const SNAP_MINS   = 15;  // snap to 15-minute increments

// ── Types ──────────────────────────────────────────────────────────────────────

type Task = {
  _id: Id<"tasks">;
  title: string;
  status: string;
  priority: string;
  areaId: Id<"areas">;
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

// Map a timestamp to vertical offset (pixels from top of day column)
function tsToOffset(ts: number): number {
  const d = new Date(ts);
  const h = d.getHours() + d.getMinutes() / 60;
  return (h - HOUR_START) * CELL_HEIGHT;
}

// ── Draggable unscheduled task chip ───────────────────────────────────────────

function UnscheduledChip({ task, areaColor }: { task: Task; areaColor?: string }) {
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
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ backgroundColor: priorityColor(task.priority) }}
      />
      {areaColor && <span className="w-1.5 h-1.5 rounded-sm shrink-0" style={{ backgroundColor: areaColor }} />}
      <span className="font-ui text-[12px] text-[#C4C0BA] leading-snug flex-1 min-w-0 truncate">
        {task.title}
      </span>
    </div>
  );
}

// ── Droppable time slot cell ───────────────────────────────────────────────────

function TimeSlotCell({
  dayIdx, hour, minute = 0,
}: { dayIdx: number; hour: number; minute?: number }) {
  const id = `slot-${dayIdx}-${hour}-${minute}`;
  const { isOver, setNodeRef } = useDroppable({ id, data: { dayIdx, hour, minute } });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute w-full",
        isOver && "bg-[#C9A84C0A]",
      )}
      style={{
        top:    ((hour - HOUR_START + minute / 60) * CELL_HEIGHT),
        height: (SNAP_MINS / 60) * CELL_HEIGHT,
      }}
    />
  );
}

// ── Scheduled task block ───────────────────────────────────────────────────────

function ScheduledTaskBlock({
  task,
  onUnschedule,
}: {
  task: Task;
  onUnschedule: () => void;
}) {
  const start = task.scheduledStart!;
  const end   = task.scheduledEnd!;
  const topPx = tsToOffset(start);
  const heightPx = Math.max((durationMins(start, end) / 60) * CELL_HEIGHT, 24);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `scheduled-${task._id}`,
    data: { taskId: task._id, type: "scheduled", originalStart: start, originalEnd: end },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: CSS.Translate.toString(transform),
        top:    topPx,
        height: heightPx,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="absolute left-0.5 right-0.5 rounded bg-[#4A9EE018] border border-[#4A9EE040] px-2 py-1 cursor-grab z-10 group overflow-hidden"
    >
      <p className="font-ui text-[11px] font-medium text-[#4A9EE0] leading-tight truncate">{task.title}</p>
      <p className="font-ui text-[10px] text-[#4A9EE060] tabular-nums">
        {fmtTime(start)} – {fmtTime(end)}
      </p>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onUnschedule}
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-[#3A3A3E] hover:text-[#E85538] transition-all"
      >
        <Unlink size={9} />
      </button>
    </div>
  );
}

// ── GCal event block ───────────────────────────────────────────────────────────

function GCalEventBlock({
  event,
}: {
  event: GCalEvent;
}) {
  const startStr = event.start.dateTime ?? event.start.date;
  const endStr   = event.end.dateTime   ?? event.end.date;
  if (!startStr || !endStr) return null;

  const start = new Date(startStr).getTime();
  const end   = new Date(endStr).getTime();
  const topPx    = tsToOffset(start);
  const heightPx = Math.max((durationMins(start, end) / 60) * CELL_HEIGHT, 20);
  const color    = gcalColor(event.colorId);

  return (
    <div
      style={{
        top: topPx, height: heightPx,
        borderLeftColor: color,
        backgroundColor: `${color}12`,
      }}
      className="absolute left-0.5 right-0.5 rounded border-l-2 border border-transparent px-2 py-0.5 overflow-hidden pointer-events-auto group z-5"
    >
      <p className="font-ui text-[11px] leading-tight truncate" style={{ color }}>{event.summary}</p>
      <p className="font-ui text-[10px] tabular-nums" style={{ color: `${color}80` }}>
        {fmtTime(start)} – {fmtTime(end)}
      </p>
      {event.htmlLink && (
        <a
          href={event.htmlLink}
          target="_blank"
          rel="noreferrer"
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color }}
        >
          <ExternalLink size={9} />
        </a>
      )}
    </div>
  );
}

// ── Drag overlay chip ──────────────────────────────────────────────────────────

function DragOverlayChip({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[#1E1E21] border border-[#C9A84C] rounded shadow-xl cursor-grabbing">
      <GripVertical size={11} className="text-[#C9A84C]" />
      <span className="font-ui text-[12px] text-[#F2EEE8]">{title}</span>
    </div>
  );
}

// ── Schedule page ──────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const { userId } = useCurrentUser();
  const areas = useQuery(api.areas.list, userId ? { userId } : "skip") ?? [];

  const [weekDate,   setWeekDate]   = useState(() => new Date());
  const [gcalEvents, setGcalEvents] = useState<GCalEvent[]>([]);
  const [gcalConnected, setGcalConnected] = useState<boolean | null>(null);
  const [activeId,   setActiveId]   = useState<string | null>(null);
  const [connectingGcal, setConnectingGcal] = useState(false);

  const scheduleTask   = useMutation(api.tasks.scheduleTask);
  const unscheduleTask = useMutation(api.tasks.unscheduleTask);

  const weekStart = startOfWeek(weekDate, { weekStartsOn: 1 }); // Mon
  const weekEnd   = endOfWeek(weekDate,   { weekStartsOn: 1 }); // Sun
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const weekStartParam = weekStart.toISOString();
  const weekEndParam   = weekEnd.toISOString();

  const scheduledTasks   = useQuery(
    api.tasks.listScheduledForWeek,
    userId ? { userId, weekStart: weekStart.getTime(), weekEnd: weekEnd.getTime() } : "skip"
  ) ?? [];

  const unscheduledTasks = useQuery(
    api.tasks.listUnscheduled,
    userId ? { userId } : "skip"
  ) ?? [];

  const areaMap = Object.fromEntries(areas.map((a) => [a._id, a]));

  // ── Load GCal events ──
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/calendar/events?weekStart=${encodeURIComponent(weekStartParam)}&weekEnd=${encodeURIComponent(weekEndParam)}`)
      .then((r) => r.json())
      .then((d) => {
        setGcalConnected(d.connected ?? false);
        setGcalEvents(d.events ?? []);
      })
      .catch(() => setGcalConnected(false));
  }, [userId, weekStartParam, weekEndParam]);

  // Handle ?gcal=connected query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gcal") === "connected") {
      setGcalConnected(true);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // ── Sensors ──
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const activeTask = activeId
    ? [...scheduledTasks, ...unscheduledTasks].find((t) =>
        activeId === `scheduled-${t._id}` || activeId === `unscheduled-${t._id}`
      )
    : null;

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd   = useCallback(async (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || !userId) return;

    const taskData = active.data.current as {
      taskId: Id<"tasks">; type: string; originalStart?: number; originalEnd?: number;
    };
    const slotData = over.data.current as { dayIdx: number; hour: number; minute: number } | undefined;
    if (!slotData) return;

    const { dayIdx, hour, minute } = slotData;
    const slotDate = addDays(weekStart, dayIdx);
    const startTs  = setMinutes(setHours(slotDate, hour), minute).getTime();
    const durationMs = taskData.originalStart && taskData.originalEnd
      ? taskData.originalEnd - taskData.originalStart
      : 60 * 60 * 1000; // default 1 hour
    const endTs = startTs + durationMs;

    const gcalEventIdToUpdate = taskData.type === "scheduled"
      ? scheduledTasks.find((t) => t._id === taskData.taskId)?.gcalEventId
      : undefined;

    // Update Convex
    await scheduleTask({
      id:             taskData.taskId,
      scheduledStart: startTs,
      scheduledEnd:   endTs,
    });

    // Sync to GCal
    if (gcalConnected) {
      const task = [...scheduledTasks, ...unscheduledTasks].find((t) => t._id === taskData.taskId);
      if (task) {
        const payload = {
          action:      gcalEventIdToUpdate ? "update" : "create",
          taskId:      task._id,
          title:       task.title,
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
            if (d.eventId) {
              scheduleTask({ id: taskData.taskId, scheduledStart: startTs, scheduledEnd: endTs, gcalEventId: d.eventId });
            }
          })
          .catch(() => {/* silent — task is scheduled in Convex either way */});
      }
    }
  }, [userId, weekStart, scheduledTasks, unscheduledTasks, scheduleTask, gcalConnected]);

  const handleUnschedule = async (task: Task) => {
    if (task.gcalEventId && gcalConnected) {
      fetch("/api/calendar/events", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "delete", gcalEventId: task.gcalEventId }),
      }).catch(() => {});
    }
    await unscheduleTask({ id: task._id });
  };

  // Group scheduled tasks by day
  const tasksByDay = Array.from({ length: 7 }, (_, i) => {
    const dayStart = addDays(weekStart, i).getTime();
    const dayEnd   = dayStart + 86400000;
    return scheduledTasks.filter((t) => t.scheduledStart! >= dayStart && t.scheduledStart! < dayEnd);
  });

  // Group GCal events by day
  const gcalByDay = Array.from({ length: 7 }, (_, i) => {
    const dayStart = addDays(weekStart, i).setHours(0, 0, 0, 0);
    const dayEnd   = dayStart + 86400000;
    return gcalEvents.filter((ev) => {
      const s = ev.start.dateTime ? new Date(ev.start.dateTime).getTime() : new Date(ev.start.date!).getTime();
      return s >= dayStart && s < dayEnd;
    });
  });

  const today = new Date();

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-full flex flex-col bg-[#0A0A0B]">

        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2A2A2E] shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="font-ui text-[20px] font-semibold text-[#F2EEE8]">Schedule</h1>
            {/* Week nav */}
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

          {/* GCal connect */}
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

          {/* ── Unscheduled sidebar ── */}
          <div className="w-[220px] shrink-0 border-r border-[#2A2A2E] flex flex-col overflow-hidden">
            <div className="px-3 py-2.5 border-b border-[#2A2A2E] shrink-0">
              <p className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#3A3A3E] font-medium">
                Unscheduled
              </p>
              <p className="font-ui text-[10px] text-[#3A3A3E] mt-0.5">Drag tasks onto the grid</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {unscheduledTasks.length === 0 ? (
                <div className="px-2 py-6 text-center">
                  <p className="font-ui text-[11px] text-[#3A3A3E]">All tasks scheduled</p>
                </div>
              ) : (
                unscheduledTasks.map((t) => (
                  <UnscheduledChip
                    key={t._id}
                    task={t}
                    areaColor={areaMap[t.areaId]?.color}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── Week grid ── */}
          <div className="flex-1 overflow-auto min-h-0">

            {/* Day headers */}
            <div className="sticky top-0 z-20 bg-[#0A0A0B] border-b border-[#2A2A2E] flex">
              {/* Time gutter */}
              <div className="w-12 shrink-0" />
              {weekDays.map((day, i) => {
                const isToday = format(day, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex-1 min-w-[100px] px-2 py-2.5 border-l border-[#2A2A2E] text-center",
                    )}
                  >
                    <p className={cn(
                      "font-ui text-[11px] uppercase tracking-[0.1em]",
                      isToday ? "text-[#C9A84C]" : "text-[#3A3A3E]"
                    )}>
                      {format(day, "EEE")}
                    </p>
                    <p className={cn(
                      "font-ui text-[16px] font-semibold mt-0.5 tabular-nums",
                      isToday ? "text-[#C9A84C]" : "text-[#6B6760]"
                    )}>
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
                  <div
                    key={h}
                    className="flex items-start justify-end pr-2"
                    style={{ height: CELL_HEIGHT }}
                  >
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
                    className={cn(
                      "flex-1 min-w-[100px] border-l border-[#2A2A2E] relative",
                      isToday && "bg-[#C9A84C04]"
                    )}
                    style={{ height: HOURS.length * CELL_HEIGHT }}
                  >
                    {/* Hour grid lines */}
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        className="absolute w-full border-t border-[#1A1A1D]"
                        style={{ top: (h - HOUR_START) * CELL_HEIGHT }}
                      />
                    ))}

                    {/* 30-min half-hour lines */}
                    {HOURS.map((h) => (
                      <div
                        key={`${h}-half`}
                        className="absolute w-full border-t border-dashed border-[#16161A]"
                        style={{ top: (h - HOUR_START + 0.5) * CELL_HEIGHT }}
                      />
                    ))}

                    {/* Droppable slots (15-min increments) */}
                    {HOURS.flatMap((h) =>
                      [0, 15, 30, 45].map((m) => (
                        <TimeSlotCell key={`${h}-${m}`} dayIdx={dayIdx} hour={h} minute={m} />
                      ))
                    )}

                    {/* GCal background events */}
                    {gcalByDay[dayIdx].map((ev) => (
                      <GCalEventBlock key={ev.id} event={ev} />
                    ))}

                    {/* Scheduled task blocks */}
                    {tasksByDay[dayIdx].map((t) => (
                      <ScheduledTaskBlock
                        key={t._id}
                        task={t}
                        onUnschedule={() => handleUnschedule(t)}
                      />
                    ))}

                    {/* Current time indicator */}
                    {isToday && (() => {
                      const now  = new Date();
                      const h    = now.getHours() + now.getMinutes() / 60;
                      const top  = (h - HOUR_START) * CELL_HEIGHT;
                      if (h < HOUR_START || h > HOUR_END) return null;
                      return (
                        <div
                          className="absolute w-full flex items-center z-20 pointer-events-none"
                          style={{ top }}
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

      {/* Drag overlay */}
      <DragOverlay>
        {activeTask && <DragOverlayChip title={activeTask.title} />}
      </DragOverlay>
    </DndContext>
  );
}
