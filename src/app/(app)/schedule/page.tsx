"use client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useState, useCallback, useEffect, useMemo, memo, useRef } from "react";
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
  X,
  Clock,
  StickyNote,
  Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";

// ── Constants ──────────────────────────────────────────────────────────────────

const HOUR_START  = 6;
const HOUR_END    = 22;
const HOURS       = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const CELL_HEIGHT = 80; // px per hour
const SNAP_MINS   = 15;

// ── Types ──────────────────────────────────────────────────────────────────────

type Task = {
  _id: Id<"tasks">;
  title: string;
  status: string;
  priority: string;
  areaId: Id<"areas">;
  goalId?: Id<"goals">;
  description?: string;
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
  if (p === "urgent") return "#C41E3A";
  if (p === "high")   return "#B08A4E";
  if (p === "medium") return "#0D0D0D";
  return "#999990";
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
  task, areaColor, onDelete, onSelect,
}: { task: Task; areaColor?: string; onDelete: (id: Id<"tasks">) => void; onSelect: (task: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `unscheduled-${task._id}`,
    data: { taskId: task._id, type: "unscheduled" },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => { if (!isDragging) onSelect(task); }}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center gap-2 px-3 py-2 bg-[#FAFAF5] border border-[#CCCCBC] cursor-grab hover:border-[#999990] transition-colors group"
    >
      <GripVertical size={11} className="text-[#999990] shrink-0" />
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: priorityColor(task.priority) }} />
      {areaColor && <span className="w-1.5 h-1.5 shrink-0" style={{ backgroundColor: areaColor }} />}
      <span className="font-ui text-[12px] text-[#2A2A2A] leading-snug flex-1 min-w-0 break-words">
        {task.title}
      </span>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onDelete(task._id); }}
        className="opacity-0 group-hover:opacity-100 text-[#999990] hover:text-[#C41E3A] transition-all shrink-0"
        title="Delete task"
      >
        <Trash2 size={10} />
      </button>
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
      className={cn("absolute w-full", isOver && "bg-[#C41E3A0A]")}
      style={{
        top:    (hour - HOUR_START + minute / 60) * CELL_HEIGHT,
        height: (SNAP_MINS / 60) * CELL_HEIGHT,
      }}
    />
  );
});

const ScheduledTaskBlock = memo(function ScheduledTaskBlock({
  task, onUnschedule, onComplete, onUndone, onSelect,
}: {
  task: Task;
  onUnschedule: (id: Id<"tasks">) => void;
  onComplete:   (id: Id<"tasks">) => void;
  onUndone:     (id: Id<"tasks">) => void;
  onSelect:     (task: Task) => void;
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
      onClick={() => onSelect(task)}
      style={{
        transform: CSS.Translate.toString(transform),
        top: topPx, height: heightPx, opacity: isDragging ? 0.5 : 1,
        borderLeft: done ? `3px solid #CCCCBC` : `3px solid #0D0D0D`,
        backgroundColor: done ? "#F5F5F0" : "#FFFFFF",
      }}
      className={cn(
        "absolute left-1 right-1 px-2 py-1 z-10 group overflow-hidden border border-[#CCCCBC]",
        done ? "cursor-default" : "cursor-grab"
      )}
    >
      <p className={cn(
        "font-display text-[12px] font-bold leading-tight truncate pr-8",
        done ? "line-through text-[#999990]" : "text-[#0D0D0D]"
      )}>
        {task.title}
      </p>
      <p className={cn("font-ui text-[10px] tabular-nums mt-0.5", done ? "text-[#CCCCBC]" : "text-[#555550]")}>
        {fmtTime(start)} – {fmtTime(end)}
      </p>

      {/* Action buttons — visible on hover */}
      <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
        {done ? (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onUndone(task._id); }}
            className="text-[#4CAF6B] hover:text-[#999990] transition-colors"
            title="Mark undone"
          >
            <Check size={9} />
          </button>
        ) : (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onComplete(task._id); }}
            className="text-[#999990] hover:text-[#4CAF6B] transition-colors"
            title="Mark done"
          >
            <Check size={9} />
          </button>
        )}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onUnschedule(task._id); }}
          className="text-[#999990] hover:text-[#C41E3A] transition-colors"
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
      style={{ top: topPx, height: heightPx, borderLeftColor: color, backgroundColor: `${color}0F` }}
      className="absolute left-1 right-1 border-l-[3px] border border-[#CCCCBC] px-2 py-1 overflow-hidden pointer-events-auto group z-5"
    >
      <p className="font-display text-[12px] font-bold leading-tight truncate pr-8" style={{ color }}>{event.summary}</p>
      <p className="font-ui text-[10px] tabular-nums mt-0.5" style={{ color: `${color}99` }}>
        {fmtTime(start)} – {fmtTime(end)}
      </p>
      <div className="absolute top-0.5 right-0.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {event.htmlLink && (
          <a
            href={event.htmlLink}
            target="_blank"
            rel="noreferrer"
            onPointerDown={(e) => e.stopPropagation()}
            className="p-0.5 hover:bg-white/10 transition-colors"
            style={{ color }}
          >
            <ExternalLink size={9} />
          </a>
        )}
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onDelete(event.id)}
          className="p-0.5 hover:bg-white/10 transition-colors text-[#C41E3A]"
        >
          <Trash2 size={9} />
        </button>
      </div>
    </div>
  );
});

function DragOverlayChip({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-[#FAFAF5] border border-[#C41E3A] cursor-grabbing">
      <GripVertical size={11} className="text-[#C41E3A]" />
      <span className="font-ui text-[12px] text-[#0D0D0D]">{title}</span>
    </div>
  );
}

// Static grid background — rendered once per column, no React re-renders
const DayColumnGrid = memo(function DayColumnGrid({ dayIdx }: { dayIdx: number }) {
  return (
    <>
      {HOURS.map((h) => (
        <div key={h} className="absolute w-full border-t border-[#CCCCBC]" style={{ top: (h - HOUR_START) * CELL_HEIGHT }} />
      ))}
      {HOURS.map((h) => (
        <div key={`${h}-h`} className="absolute w-full border-t border-dotted border-[#E8E8E0]" style={{ top: (h - HOUR_START + 0.5) * CELL_HEIGHT }} />
      ))}
      {HOURS.flatMap((h) =>
        [0, 15, 30, 45].map((m) => (
          <TimeSlotCell key={`${h}-${m}`} dayIdx={dayIdx} hour={h} minute={m} />
        ))
      )}
    </>
  );
});

// ── Task Edit Panel ────────────────────────────────────────────────────────────

const DURATION_PRESETS = [
  { label: "15m", mins: 15 },
  { label: "30m", mins: 30 },
  { label: "45m", mins: 45 },
  { label: "1h",  mins: 60 },
  { label: "1.5h", mins: 90 },
  { label: "2h",  mins: 120 },
  { label: "3h",  mins: 180 },
];

const PRIORITY_OPTIONS = [
  { value: "urgent", label: "Urgent", color: "#C41E3A" },
  { value: "high",   label: "High",   color: "#B08A4E" },
  { value: "medium", label: "Medium", color: "#0D0D0D" },
  { value: "low",    label: "Low",    color: "#999990" },
] as const;

function tsToTimeStr(ts: number) {
  return format(new Date(ts), "HH:mm");
}

function TaskEditPanel({
  task,
  area,
  goal,
  onClose,
  onSchedule,
  onUpdate,
  onDelete,
}: {
  task: Task;
  area?: { name: string; color?: string };
  goal?: { title: string };
  onClose: () => void;
  onSchedule: (id: Id<"tasks">, start: number, end: number) => void;
  onUpdate: (id: Id<"tasks">, fields: { title?: string; priority?: string; description?: string }) => void;
  onDelete: (id: Id<"tasks">) => void;
}) {
  const { userId } = useCurrentUser();
  const router = useRouter();
  const linkedNotes = useQuery(api.notes.listByTask, { taskId: task._id }) ?? [];
  const createNote  = useMutation(api.notes.create);

  const isScheduled = !!task.scheduledStart && !!task.scheduledEnd;
  const start = task.scheduledStart ?? 0;
  const end   = task.scheduledEnd ?? 0;

  const [title,        setTitle]        = useState(task.title);
  const [startStr,     setStartStr]     = useState(isScheduled ? tsToTimeStr(start) : "");
  const [endStr,       setEndStr]       = useState(isScheduled ? tsToTimeStr(end) : "");
  const [priority,     setPriority]     = useState(task.priority);
  const [description,  setDescription]  = useState((task as Task & { description?: string }).description ?? "");
  const [addingNote,   setAddingNote]   = useState(false);
  const [noteContent,  setNoteContent]  = useState("");

  // Keep local state in sync if task prop changes (e.g. optimistic update settles)
  useEffect(() => {
    setTitle(task.title);
    setStartStr(task.scheduledStart ? tsToTimeStr(task.scheduledStart) : "");
    setEndStr(task.scheduledEnd ? tsToTimeStr(task.scheduledEnd) : "");
    setPriority(task.priority);
    setDescription((task as Task & { description?: string }).description ?? "");
  }, [task._id]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyTime(newStartStr: string, newEndStr: string) {
    const base = new Date(start);
    const [sh, sm] = newStartStr.split(":").map(Number);
    const [eh, em] = newEndStr.split(":").map(Number);
    const s = new Date(base); s.setHours(sh, sm, 0, 0);
    const e = new Date(base); e.setHours(eh, em, 0, 0);
    if (e > s) onSchedule(task._id, s.getTime(), e.getTime());
  }

  function applyDuration(mins: number) {
    const base = new Date(start);
    const [sh, sm] = startStr.split(":").map(Number);
    const s = new Date(base); s.setHours(sh, sm, 0, 0);
    const e = new Date(s.getTime() + mins * 60000);
    const newEnd = format(e, "HH:mm");
    setEndStr(newEnd);
    onSchedule(task._id, s.getTime(), e.getTime());
  }

  function save() {
    if (isScheduled) applyTime(startStr, endStr);
    onUpdate(task._id, { title, priority, description });
    onClose();
  }

  const currentDurationMins = Math.round((end - start) / 60000);

  return (
    <div className="w-[280px] shrink-0 border-l border-[#CCCCBC] flex flex-col bg-[#FAFAF5] overflow-y-auto">
      {/* Panel header */}
      <div className="px-4 py-3 border-b border-[#CCCCBC] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Clock size={13} className="text-[#555550]" />
          <span className="font-ui text-[12px] text-[#555550]">Edit Task</span>
        </div>
        <button onClick={onClose} className="text-[#999990] hover:text-[#0D0D0D] transition-colors">
          <X size={14} />
        </button>
      </div>

      <div className="flex-1 p-4 space-y-5">

        {/* Title */}
        <div className="space-y-1.5">
          <label className="font-ui text-[10px] uppercase tracking-[0.12em] text-[#999990]">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-[#FAFAF5] border border-[#CCCCBC] px-3 py-2 font-ui text-[13px] text-[#0D0D0D] placeholder-[#999990] focus:outline-none focus:border-[#0D0D0D] transition-colors"
          />
        </div>

        {/* Contributes to */}
        {(area || goal) && (
          <div className="space-y-1.5">
            <label className="font-ui text-[10px] uppercase tracking-[0.12em] text-[#999990]">Contributes to</label>
            <div className="border border-[#CCCCBC] divide-y divide-[#CCCCBC]">
              {area && (
                <div className="flex items-center gap-2 px-3 py-2">
                  {area.color && (
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: area.color }} />
                  )}
                  <span className="font-ui text-[12px] text-[#0D0D0D] flex-1">{area.name}</span>
                  <span className="font-ui text-[10px] text-[#999990]">area</span>
                </div>
              )}
              {goal && (
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="w-2 h-2 shrink-0 border border-[#999990] rotate-45" />
                  <span className="font-ui text-[12px] text-[#0D0D0D] flex-1">{goal.title}</span>
                  <span className="font-ui text-[10px] text-[#999990]">goal</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Time — only for scheduled tasks */}
        {isScheduled && (
        <div className="space-y-1.5">
          <label className="font-ui text-[10px] uppercase tracking-[0.12em] text-[#999990]">Time</label>
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={startStr}
              onChange={(e) => setStartStr(e.target.value)}
              onBlur={() => applyTime(startStr, endStr)}
              className="flex-1 bg-[#FAFAF5] border border-[#CCCCBC] px-2 py-1.5 font-ui text-[12px] text-[#0D0D0D] focus:outline-none focus:border-[#0D0D0D] transition-colors tabular-nums"
            />
            <span className="font-ui text-[11px] text-[#999990]">→</span>
            <input
              type="time"
              value={endStr}
              onChange={(e) => setEndStr(e.target.value)}
              onBlur={() => applyTime(startStr, endStr)}
              className="flex-1 bg-[#FAFAF5] border border-[#CCCCBC] px-2 py-1.5 font-ui text-[12px] text-[#0D0D0D] focus:outline-none focus:border-[#0D0D0D] transition-colors tabular-nums"
            />
          </div>
        </div>
        )}

        {/* Duration presets — only for scheduled tasks */}
        {isScheduled && (
        <div className="space-y-1.5">
          <label className="font-ui text-[10px] uppercase tracking-[0.12em] text-[#999990]">Duration</label>
          <div className="flex flex-wrap gap-1.5">
            {DURATION_PRESETS.map(({ label, mins }) => (
              <button
                key={mins}
                onClick={() => applyDuration(mins)}
                className={cn(
                  "px-2.5 py-1 border font-ui text-[11px] transition-colors",
                  currentDurationMins === mins
                    ? "border-[#0D0D0D] text-[#0D0D0D] bg-[#0D0D0D18]"
                    : "border-[#CCCCBC] text-[#555550] hover:border-[#0D0D0D40] hover:text-[#0D0D0D]"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        )}

        {/* Priority */}
        <div className="space-y-1.5">
          <label className="font-ui text-[10px] uppercase tracking-[0.12em] text-[#999990]">Priority</label>
          <div className="flex gap-1.5">
            {PRIORITY_OPTIONS.map(({ value, label, color }) => (
              <button
                key={value}
                onClick={() => setPriority(value)}
                style={priority === value ? { borderColor: color, color, backgroundColor: `${color}18` } : {}}
                className={cn(
                  "flex-1 py-1 border font-ui text-[11px] transition-colors",
                  priority === value ? "" : "border-[#CCCCBC] text-[#999990] hover:text-[#555550]"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label className="font-ui text-[10px] uppercase tracking-[0.12em] text-[#999990]">Notes</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Add notes…"
            className="w-full bg-[#FAFAF5] border border-[#CCCCBC] px-3 py-2 font-ui text-[12px] text-[#0D0D0D] placeholder-[#999990] focus:outline-none focus:border-[#0D0D0D] transition-colors resize-none"
          />
        </div>

        {/* Linked Notepad Notes */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="font-ui text-[10px] uppercase tracking-[0.12em] text-[#999990] flex items-center gap-1">
              <StickyNote size={10} />
              Notepad
            </label>
            <button
              onClick={() => router.push("/notepad")}
              className="font-ui text-[10px] text-[#555550] hover:text-[#C41E3A] transition-colors"
            >
              Open Notepad →
            </button>
          </div>

          {linkedNotes.length > 0 && (
            <div className="border border-[#CCCCBC] divide-y divide-[#CCCCBC]">
              {linkedNotes.map((note) => (
                <div key={note._id} className="px-3 py-2">
                  <p className="font-ui text-[11px] text-[#0D0D0D] leading-snug line-clamp-2 whitespace-pre-wrap">
                    {note.content}
                  </p>
                  <p className="font-ui text-[10px] text-[#999990] mt-0.5">
                    {format(new Date(note.updatedAt), "MMM d, h:mm a")}
                  </p>
                </div>
              ))}
            </div>
          )}

          {addingNote ? (
            <div className="space-y-1.5">
              <textarea
                autoFocus
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    if (userId && noteContent.trim()) {
                      createNote({ userId, content: noteContent.trim(), taskId: task._id })
                        .then(() => { setNoteContent(""); setAddingNote(false); });
                    }
                  }
                  if (e.key === "Escape") { setNoteContent(""); setAddingNote(false); }
                }}
                rows={3}
                placeholder="Type note… (⌘Enter to save)"
                className="w-full bg-[#FAFAF5] border border-[#CCCCBC] px-2 py-1.5 font-ui text-[11px] text-[#0D0D0D] placeholder-[#999990] focus:outline-none focus:border-[#0D0D0D] transition-colors resize-none"
              />
              <div className="flex gap-1.5 justify-end">
                <button
                  onClick={() => { setNoteContent(""); setAddingNote(false); }}
                  className="px-2.5 py-1 border border-[#CCCCBC] font-ui text-[10px] text-[#999990] hover:text-[#555550] transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={!noteContent.trim()}
                  onClick={async () => {
                    if (!userId || !noteContent.trim()) return;
                    await createNote({ userId, content: noteContent.trim(), taskId: task._id });
                    setNoteContent("");
                    setAddingNote(false);
                  }}
                  className="px-2.5 py-1 bg-[#0D0D0D] font-ui text-[10px] text-white transition-colors disabled:opacity-40"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAddingNote(true)}
              className="w-full py-1.5 border border-dashed border-[#CCCCBC] font-ui text-[11px] text-[#999990] hover:text-[#555550] hover:border-[#999990] transition-colors flex items-center justify-center gap-1"
            >
              <Plus size={10} />
              Add note to Notepad
            </button>
          )}
        </div>
      </div>

      {/* Save + Delete */}
      <div className="px-4 py-3 border-t border-[#CCCCBC] shrink-0 space-y-2">
        <button
          onClick={save}
          className="w-full py-2 bg-[#0D0D0D] hover:bg-[#C41E3A] font-ui text-[12px] text-[#FFFFFF] font-semibold transition-colors"
        >
          Save
        </button>
        <button
          onClick={() => { onDelete(task._id); onClose(); }}
          className="w-full py-1.5 border border-[#CCCCBC] font-ui text-[11px] text-[#999990] hover:border-[#C41E3A] hover:text-[#C41E3A] transition-colors"
        >
          Delete task
        </button>
      </div>
    </div>
  );
}

// ── Schedule page ──────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const { userId } = useCurrentUser();
  const areas = useQuery(api.areas.list, userId ? { userId } : "skip") ?? [];
  const goals = useQuery(api.goals.listByUser, userId ? { userId } : "skip") ?? [];

  const [weekDate,      setWeekDate]      = useState(() => new Date());
  const [gcalEvents,    setGcalEvents]    = useState<GCalEvent[]>([]);
  const [gcalConnected, setGcalConnected] = useState<boolean | null>(null);
  const [activeId,      setActiveId]      = useState<string | null>(null);
  const [connectingGcal, setConnectingGcal] = useState(false);
  const [backlogOpen,    setBacklogOpen]    = useState(false);
  const [completedOpen,  setCompletedOpen]  = useState(false);
  const [selectedTask,   setSelectedTask]   = useState<Task | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Optimistic moves: taskId → pending {scheduledStart, scheduledEnd}
  // Applied immediately on drop so the block moves without waiting for Convex
  const [pendingMoves, setPendingMoves] = useState<Map<string, PendingMove>>(new Map());

  const scheduleTask   = useMutation(api.tasks.scheduleTask);
  const unscheduleTask = useMutation(api.tasks.unscheduleTask);
  const updateStatus   = useMutation(api.tasks.updateStatus);
  const updateTask     = useMutation(api.tasks.update);
  const archiveTask    = useMutation(api.tasks.archive);

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

  const goalMap = useMemo(
    () => Object.fromEntries(goals.map((g) => [g._id, g])),
    [goals]
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

  // Scroll to 8am on mount and whenever the week changes
  useEffect(() => {
    if (!gridRef.current) return;
    const scrollTarget = (8 - HOUR_START) * CELL_HEIGHT;
    gridRef.current.scrollTo({ top: scrollTarget, behavior: "smooth" });
  }, [weekStartMs]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const handleSelectTask = useCallback((task: Task) => {
    setSelectedTask(task);
  }, []);

  const handlePanelSchedule = useCallback((id: Id<"tasks">, start: number, end: number) => {
    scheduleTask({ id, scheduledStart: start, scheduledEnd: end });
    setSelectedTask((prev) => prev && prev._id === id ? { ...prev, scheduledStart: start, scheduledEnd: end } : prev);
  }, [scheduleTask]);

  const handlePanelUpdate = useCallback((id: Id<"tasks">, fields: { title?: string; priority?: string; description?: string }) => {
    updateTask({ id, ...fields as { priority?: "urgent" | "high" | "medium" | "low" } });
    setSelectedTask((prev) => prev && prev._id === id ? { ...prev, ...fields } : prev);
  }, [updateTask]);

  const handleDeleteTask = useCallback((id: Id<"tasks">) => {
    archiveTask({ id });
    setSelectedTask((prev) => prev?._id === id ? null : prev);
  }, [archiveTask]);

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
      <div className="h-full flex flex-col" style={{ background: "#FAFAF5" }}>

        {/* Header — newspaper style */}
        <div style={{ padding: "24px 64px 20px", borderBottom: "2px solid #0D0D0D", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", color: "#C41E3A", marginBottom: "6px" }}>Weekly Planner</div>
            <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 900, fontSize: "48px", lineHeight: 0.95, letterSpacing: "-1.5px", textTransform: "uppercase", color: "#0D0D0D" }}>Schedule</h1>
          </div>
          <div className="flex items-center gap-4" style={{ paddingBottom: "6px" }}>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWeekDate((d) => subWeeks(d, 1))}
                style={{ padding: "4px", cursor: "pointer", background: "transparent", border: "1px solid #CCCCBC", color: "#999990" }}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setWeekDate(new Date())}
                style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", padding: "4px 12px", border: "1px solid #CCCCBC", background: "transparent", color: "#555550", cursor: "pointer" }}
              >
                Today
              </button>
              <button
                onClick={() => setWeekDate((d) => addWeeks(d, 1))}
                style={{ padding: "4px", cursor: "pointer", background: "transparent", border: "1px solid #CCCCBC", color: "#999990" }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
            <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "12px", color: "#555550" }}>
              {format(weekStart, "d MMM")} – {format(weekEnd, "d MMM yyyy")}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingBottom: "6px" }}>
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
                className="flex items-center gap-1.5 px-3 py-1.5 border border-[#CCCCBC] font-ui text-[12px] text-[#555550] hover:text-[#0D0D0D] hover:border-[#999990] transition-colors disabled:opacity-40"
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
          <div className="w-[200px] shrink-0 border-r border-[#CCCCBC] flex flex-col overflow-hidden">

            {/* Header */}
            <div className="px-3 py-3 border-b-2 border-[#0D0D0D] shrink-0">
              <p className="font-display text-[14px] font-bold text-[#0D0D0D] uppercase" style={{ letterSpacing: "0.5px" }}>This Week</p>
              <p className="font-ui text-[10px] text-[#999990] mt-0.5">Drag tasks onto the grid</p>
            </div>

            <div className="flex-1 overflow-y-auto min-h-0">

              {/* ── This Week ── */}
              <div className="p-2 space-y-1.5">
                {thisWeekTasks.length === 0 ? (
                  <div className="px-2 py-5 text-center">
                    <p className="font-ui text-[11px] text-[#999990]">Nothing due this week</p>
                  </div>
                ) : (
                  thisWeekTasks.map((t) => (
                    <UnscheduledChip key={t._id} task={t} areaColor={areaMap[t.areaId]?.color} onDelete={handleDeleteTask} onSelect={handleSelectTask} />
                  ))
                )}
              </div>

              {/* ── Backlog (collapsible) ── */}
              {backlogTasks.length > 0 && (
                <div className="border-t border-[#CCCCBC]">
                  <button
                    onClick={() => setBacklogOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#FAFAF5] transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-ui text-[10px] uppercase tracking-[0.12em] text-[#999990] font-medium">
                        Backlog
                      </span>
                      <span className="font-ui text-[10px] text-[#999990] tabular-nums">
                        {backlogTasks.length}
                      </span>
                    </div>
                    <ChevronDown
                      size={11}
                      className={cn("text-[#999990] transition-transform", backlogOpen && "rotate-180")}
                    />
                  </button>
                  {backlogOpen && (
                    <div className="px-2 pb-2 space-y-1.5">
                      {backlogTasks.map((t) => (
                        <UnscheduledChip key={t._id} task={t} areaColor={areaMap[t.areaId]?.color} onDelete={handleDeleteTask} onSelect={handleSelectTask} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Completed this week (collapsible) ── */}
              {doneTasks.length > 0 && (
                <div className="border-t border-[#CCCCBC]">
                  <button
                    onClick={() => setCompletedOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-[#FAFAF5] transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-ui text-[10px] uppercase tracking-[0.12em] text-[#999990] font-medium">
                        Done
                      </span>
                      <span className="font-ui text-[10px] text-[#999990] tabular-nums">
                        {doneTasks.length}
                      </span>
                    </div>
                    <ChevronDown
                      size={11}
                      className={cn("text-[#999990] transition-transform", completedOpen && "rotate-180")}
                    />
                  </button>
                  {completedOpen && (
                    <div className="px-2 pb-2 space-y-1">
                      {doneTasks.map((t) => (
                        <div
                          key={t._id}
                          className="flex items-center gap-2 px-2 py-1.5 border border-[#CCCCBC] bg-[#FAFAF5]"
                        >
                          <Check size={10} className="text-[#3A7D44] shrink-0" />
                          <span className="font-ui text-[11px] text-[#999990] line-through truncate flex-1">
                            {t.title}
                          </span>
                          <button
                            onClick={() => updateStatus({ id: t._id, status: "todo" })}
                            className="font-ui text-[10px] text-[#999990] hover:text-[#555550] shrink-0 transition-colors"
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
          <div ref={gridRef} className="flex-1 overflow-auto min-h-0">

            {/* Day headers */}
            <div className="sticky top-0 z-20 bg-[#FAFAF5] border-b-2 border-[#0D0D0D] flex">
              <div className="w-14 shrink-0" />
              {weekDays.map((day, i) => {
                const isToday = format(day, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
                return (
                  <div key={i} className="flex-1 min-w-[100px] px-2 py-3 border-l border-[#CCCCBC] text-center">
                    <p className={cn("font-ui text-[9px] uppercase tracking-[0.18em] font-semibold", isToday ? "text-[#C41E3A]" : "text-[#999990]")}>
                      {format(day, "EEE")}
                    </p>
                    <p className={cn("font-display text-[22px] font-bold mt-0.5 tabular-nums leading-none", isToday ? "text-[#C41E3A]" : "text-[#0D0D0D]")}>
                      {format(day, "d")}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Grid body */}
            <div className="flex">
              {/* Hour labels */}
              <div className="w-14 shrink-0">
                {HOURS.map((h) => (
                  <div key={h} className="flex items-start justify-end pr-3" style={{ height: CELL_HEIGHT }}>
                    <span className="font-ui text-[10px] text-[#999990] tabular-nums font-medium" style={{ marginTop: "-6px" }}>
                      {format(setHours(new Date(), h), "h")}
                      <span style={{ fontSize: "8px", letterSpacing: "0.5px" }}>
                        {format(setHours(new Date(), h), "a").toLowerCase()}
                      </span>
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
                    className={cn("flex-1 min-w-[100px] border-l border-[#CCCCBC] relative", isToday && "bg-[#FFFEF8]")}
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
                        onSelect={handleSelectTask}
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
                          <div className="w-2.5 h-2.5 bg-[#C41E3A] shrink-0 -ml-1.5" style={{ clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }} />
                          <div className="flex-1 border-t-2 border-[#C41E3A]" />
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Task edit panel */}
          {selectedTask && (
            <TaskEditPanel
              task={selectedTask}
              area={areaMap[selectedTask.areaId]}
              goal={selectedTask.goalId ? goalMap[selectedTask.goalId] : undefined}
              onClose={() => setSelectedTask(null)}
              onSchedule={handlePanelSchedule}
              onUpdate={handlePanelUpdate}
              onDelete={handleDeleteTask}
            />
          )}
        </div>
      </div>

      <DragOverlay>
        {activeTask && <DragOverlayChip title={activeTask.title} />}
      </DragOverlay>
    </DndContext>
  );
}
