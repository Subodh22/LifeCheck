"use client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useState, use, useRef, useEffect } from "react";
import { format } from "date-fns";
import {
  Plus, Search, Filter, Kanban, List, Zap, ArrowUp, Minus,
  ChevronDown, ChevronRight, X, Calendar, Tag, MoreHorizontal,
  ExternalLink, CheckSquare, Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import CreateTaskModal from "@/components/CreateTaskModal";

// ── Constants ────────────────────────────────────────────────────────────────

const GROUPS = [
  { id: "in_progress", label: "In Progress", dot: "#2383E2", badge: "bg-[#2383E218] text-[#2383E2] border-[#2383E240]" },
  { id: "todo",        label: "To Do",       dot: "#4A9EE0", badge: "bg-[#4A9EE018] text-[#4A9EE0] border-[#4A9EE040]" },
  { id: "blocked",     label: "Blocked",     dot: "#E85538", badge: "bg-[#E8553818] text-[#E85538] border-[#E8553840]" },
  { id: "backlog",     label: "Backlog",     dot: "#C4C4C2", badge: "bg-[#C4C4C218] text-[#9B9A97] border-[#C4C4C240]" },
  { id: "done",        label: "Done",        dot: "#4CAF6B", badge: "bg-[#4CAF6B18] text-[#4CAF6B] border-[#4CAF6B40]" },
] as const;

type Status   = (typeof GROUPS)[number]["id"];
type Priority = "urgent" | "high" | "medium" | "low";

const PRIORITY_META: Record<Priority, { icon: React.ReactNode; color: string; label: string }> = {
  urgent: { icon: <Zap size={11} />,     color: "#E85538", label: "Urgent" },
  high:   { icon: <ArrowUp size={11} />, color: "#E8A838", label: "High"   },
  medium: { icon: <Minus size={11} />,   color: "#2383E2", label: "Medium" },
  low:    { icon: <Minus size={11} />,   color: "#9B9A97", label: "Low"    },
};

function issueKey(areaName: string, taskId: string) {
  return `${areaName.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X")}-${taskId.slice(-4).toUpperCase()}`;
}

// ── Task row ─────────────────────────────────────────────────────────────────

type Task = {
  _id: Id<"tasks">;
  title: string;
  status: string;
  priority: string;
  dueDate?: number;
  description?: string;
  createdAt: number;
  completedAt?: number;
};

interface RowProps {
  task: Task;
  areaName: string;
  isSelected: boolean;
  onSelect: () => void;
  onStatusChange: (s: Status) => void;
}

function TaskRow({ task, areaName, isSelected, onSelect, onStatusChange }: RowProps) {
  const pri     = PRIORITY_META[task.priority as Priority] ?? PRIORITY_META.medium;
  const group   = GROUPS.find((g) => g.id === task.status);
  const isOverdue = task.dueDate && task.dueDate < Date.now() && task.status !== "done";

  return (
    <div
      onClick={onSelect}
      className={cn(
        "grid grid-cols-[32px_1fr_160px_120px_90px_36px] gap-2 px-4 py-2 border-b border-[#E8E8E6] items-center cursor-pointer transition-colors group",
        isSelected ? "bg-[#E8E8E6]" : "hover:bg-[#F7F7F5]"
      )}
    >
      {/* Checkbox */}
      <div
        onClick={(e) => { e.stopPropagation(); onStatusChange(task.status === "done" ? "todo" : "done"); }}
        className="flex items-center justify-center text-[#C4C4C2] hover:text-[#9B9A97] transition-colors"
      >
        {task.status === "done"
          ? <CheckSquare size={14} className="text-[#4CAF6B]" />
          : <Square size={14} />
        }
      </div>

      {/* Key + title */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-ui text-[11px] text-[#C4C4C2] tracking-[0.05em] shrink-0 w-[72px]">
          {issueKey(areaName, task._id)}
        </span>
        <span className={cn(
          "font-ui text-[13px] truncate",
          task.status === "done" ? "text-[#C4C4C2] line-through" : "text-[#191919]"
        )}>
          {task.title}
        </span>
      </div>

      {/* Status badge */}
      <div onClick={(e) => e.stopPropagation()}>
        <select
          value={task.status}
          onChange={(e) => onStatusChange(e.target.value as Status)}
          className={cn(
            "appearance-none w-full rounded px-2.5 py-1 font-ui text-[11px] outline-none cursor-pointer border text-center",
            group?.badge ?? ""
          )}
        >
          {GROUPS.map((g) => (
            <option key={g.id} value={g.id}>{g.label}</option>
          ))}
        </select>
      </div>

      {/* Priority */}
      <div className="flex items-center gap-1.5" style={{ color: pri.color }}>
        {pri.icon}
        <span className="font-ui text-[11px]">{pri.label}</span>
      </div>

      {/* Due date */}
      <span className={cn(
        "font-ui text-[11px]",
        isOverdue ? "text-[#E85538]" : "text-[#9B9A97]"
      )}>
        {task.dueDate ? format(new Date(task.dueDate), "d MMM") : "—"}
      </span>

      {/* More */}
      <button
        onClick={(e) => e.stopPropagation()}
        className="opacity-0 group-hover:opacity-100 flex items-center justify-center text-[#9B9A97] hover:text-[#191919] transition-all"
      >
        <MoreHorizontal size={13} />
      </button>
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

interface DetailPanelProps {
  task: Task;
  areaName: string;
  areaColor: string;
  onClose: () => void;
}

function DetailPanel({ task, areaName, areaColor, onClose }: DetailPanelProps) {
  const updateTask   = useMutation(api.tasks.update);
  const updateStatus = useMutation(api.tasks.updateStatus);
  const archiveTask  = useMutation(api.tasks.archive);

  const [title, setTitle]       = useState(task.title);
  const [desc,  setDesc]        = useState(task.description ?? "");
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc,  setEditingDesc]  = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const descRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setTitle(task.title); setDesc(task.description ?? ""); }, [task._id]);
  useEffect(() => { if (editingTitle) titleRef.current?.focus(); }, [editingTitle]);
  useEffect(() => { if (editingDesc)  descRef.current?.focus();  }, [editingDesc]);

  const saveTitle = async () => {
    if (title.trim() && title.trim() !== task.title) {
      await updateTask({ id: task._id, title: title.trim() });
    }
    setEditingTitle(false);
  };

  const saveDesc = async () => {
    await updateTask({ id: task._id, description: desc.trim() || undefined });
    setEditingDesc(false);
  };

  const group = GROUPS.find((g) => g.id === task.status);
  const pri   = PRIORITY_META[task.priority as Priority] ?? PRIORITY_META.medium;
  const isOverdue = task.dueDate && task.dueDate < Date.now() && task.status !== "done";

  return (
    <div className="w-[340px] border-l border-[#E3E3E1] bg-[#F7F7F5] flex flex-col shrink-0 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E3E3E1] shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-ui text-[11px] text-[#C4C4C2] tracking-[0.05em]">{issueKey(areaName, task._id)}</span>
          <button className="text-[#C4C4C2] hover:text-[#9B9A97] transition-colors">
            <ExternalLink size={12} />
          </button>
        </div>
        <button onClick={onClose} className="text-[#9B9A97] hover:text-[#191919] transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Panel body */}
      <div className="flex-1 overflow-y-auto">
        {/* Title */}
        <div className="px-5 pt-5 pb-3">
          {editingTitle ? (
            <textarea
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveTitle(); } if (e.key === "Escape") { setTitle(task.title); setEditingTitle(false); } }}
              rows={2}
              className="w-full bg-transparent font-ui text-[18px] font-semibold text-[#191919] outline-none resize-none"
            />
          ) : (
            <h2
              onClick={() => setEditingTitle(true)}
              className="font-ui text-[18px] font-semibold text-[#191919] cursor-text hover:text-white leading-snug"
            >
              {task.title}
            </h2>
          )}
        </div>

        {/* Status + actions */}
        <div className="px-5 pb-4 flex items-center gap-2 flex-wrap">
          <select
            value={task.status}
            onChange={(e) => updateStatus({ id: task._id, status: e.target.value as Status })}
            className={cn("appearance-none rounded px-3 py-1.5 font-ui text-[12px] font-medium outline-none cursor-pointer border", group?.badge ?? "")}
          >
            {GROUPS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
          </select>
          <select
            value={task.priority}
            onChange={(e) => updateTask({ id: task._id, priority: e.target.value as Priority })}
            className="appearance-none bg-[#F0F0EE] border border-[#E3E3E1] rounded px-2.5 py-1.5 font-ui text-[11px] text-[#9B9A97] outline-none cursor-pointer"
          >
            {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label} priority</option>)}
          </select>
        </div>

        <div className="border-t border-[#E3E3E1] mx-5 mb-4" />

        {/* Description */}
        <div className="px-5 mb-5">
          <p className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#C4C4C2] mb-2">Description</p>
          {editingDesc ? (
            <textarea
              ref={descRef}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onBlur={saveDesc}
              onKeyDown={(e) => { if (e.key === "Escape") { setDesc(task.description ?? ""); setEditingDesc(false); } }}
              rows={4}
              placeholder="Add a description…"
              className="w-full bg-[#F0F0EE] border border-[#E3E3E1] rounded px-3 py-2 font-ui text-[13px] text-[#191919] placeholder:text-[#C4C4C2] outline-none focus:border-[#D5D5D3] resize-none transition-colors"
            />
          ) : (
            <p
              onClick={() => setEditingDesc(true)}
              className={cn(
                "font-ui text-[13px] leading-relaxed cursor-text rounded px-1 py-1 -mx-1 hover:bg-[#F0F0EE] transition-colors",
                desc ? "text-[#6F6E69]" : "text-[#C4C4C2] italic"
              )}
            >
              {desc || "Add a description…"}
            </p>
          )}
        </div>

        <div className="border-t border-[#E3E3E1] mx-5 mb-4" />

        {/* Details */}
        <div className="px-5 space-y-3 mb-6">
          <p className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#C4C4C2] mb-3">Details</p>

          {/* Area */}
          <div className="grid grid-cols-[100px_1fr] items-center gap-2">
            <span className="font-ui text-[12px] text-[#9B9A97]">Area</span>
            <span
              className="font-ui text-[12px] px-2 py-0.5 rounded w-fit"
              style={{ color: areaColor, backgroundColor: `${areaColor}18` }}
            >
              {areaName}
            </span>
          </div>

          {/* Priority */}
          <div className="grid grid-cols-[100px_1fr] items-center gap-2">
            <span className="font-ui text-[12px] text-[#9B9A97]">Priority</span>
            <span className="flex items-center gap-1.5 font-ui text-[12px]" style={{ color: pri.color }}>
              {pri.icon} {pri.label}
            </span>
          </div>

          {/* Due date */}
          <div className="grid grid-cols-[100px_1fr] items-center gap-2">
            <span className="font-ui text-[12px] text-[#9B9A97]">Due date</span>
            <input
              type="date"
              value={task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""}
              onChange={(e) => updateTask({ id: task._id, dueDate: e.target.value ? new Date(e.target.value).getTime() : undefined })}
              className={cn(
                "bg-transparent font-ui text-[12px] outline-none cursor-pointer [color-scheme:light] w-fit",
                isOverdue ? "text-[#E85538]" : "text-[#9B9A97]"
              )}
            />
          </div>

          {/* Created */}
          <div className="grid grid-cols-[100px_1fr] items-center gap-2">
            <span className="font-ui text-[12px] text-[#9B9A97]">Created</span>
            <span className="font-ui text-[12px] text-[#9B9A97]">
              {format(new Date(task.createdAt), "d MMM yyyy")}
            </span>
          </div>

          {task.completedAt && (
            <div className="grid grid-cols-[100px_1fr] items-center gap-2">
              <span className="font-ui text-[12px] text-[#9B9A97]">Completed</span>
              <span className="font-ui text-[12px] text-[#4CAF6B]">
                {format(new Date(task.completedAt), "d MMM yyyy")}
              </span>
            </div>
          )}
        </div>

        {/* Archive */}
        <div className="px-5 pb-6">
          <button
            onClick={() => { archiveTask({ id: task._id }); onClose(); }}
            className="font-ui text-[11px] text-[#C4C4C2] hover:text-[#E85538] transition-colors"
          >
            Archive issue
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AreaBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id }    = use(params);
  const { userId } = useCurrentUser();
  const areaId     = id as Id<"areas">;

  const areas        = useQuery(api.areas.list,       userId ? { userId } : "skip");
  const tasks        = useQuery(api.tasks.listByArea, userId ? { areaId, userId } : "skip") ?? [];
  const updateStatus = useMutation(api.tasks.updateStatus);

  const area = areas?.find((a) => a._id === areaId);

  const [view,        setView]        = useState<"backlog" | "board">("backlog");
  const [search,      setSearch]      = useState("");
  const [createOpen,  setCreateOpen]  = useState(false);
  const [selectedId,  setSelectedId]  = useState<Id<"tasks"> | null>(null);
  const [collapsed,   setCollapsed]   = useState<Set<string>>(new Set());
  const [showDone,    setShowDone]    = useState(true);

  const filtered = tasks.filter((t) =>
    !search || t.title.toLowerCase().includes(search.toLowerCase())
  );

  const selectedTask = tasks.find((t) => t._id === selectedId) ?? null;

  const toggleGroup = (id: string) =>
    setCollapsed((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const handleStatusChange = async (taskId: Id<"tasks">, status: Status) => {
    await updateStatus({ id: taskId, status });
  };

  const visibleGroups = GROUPS.filter((g) => showDone || g.id !== "done");

  return (
    <div className="h-full flex flex-col bg-[#FFFFFF]">

      {/* Area header */}
      <div className="px-5 py-2.5 border-b border-[#E3E3E1] flex items-center gap-2 shrink-0">
        <div className="w-6 h-6 rounded flex items-center justify-center text-[14px]" style={{ backgroundColor: `${area?.color ?? "#333"}22` }}>
          {area?.icon || <span className="font-ui text-[9px] font-bold" style={{ color: area?.color }}>
            {area?.name.slice(0,2).toUpperCase()}
          </span>}
        </div>
        <span className="font-ui text-[14px] font-semibold text-[#191919]">{area?.name ?? "…"}</span>
        <MoreHorizontal size={14} className="text-[#C4C4C2] ml-1" />
      </div>

      {/* Tab bar */}
      <div className="px-5 border-b border-[#E3E3E1] flex items-center gap-1 shrink-0">
        {[
          { id: "backlog", label: "Backlog", icon: <List size={13} /> },
          { id: "board",   label: "Board",   icon: <Kanban size={13} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id as "backlog" | "board")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 font-ui text-[13px] border-b-2 transition-colors",
              view === tab.id
                ? "border-[#4A9EE0] text-[#4A9EE0]"
                : "border-transparent text-[#9B9A97] hover:text-[#6F6E69]"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="px-5 py-2 border-b border-[#E3E3E1] flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-2 bg-[#F7F7F5] border border-[#E3E3E1] rounded px-2.5 py-1.5 w-48">
          <Search size={12} className="text-[#C4C4C2] shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issues…"
            className="bg-transparent font-ui text-[12px] text-[#191919] placeholder:text-[#C4C4C2] outline-none w-full"
          />
        </div>
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 border border-[#E3E3E1] rounded font-ui text-[12px] text-[#9B9A97] hover:text-[#191919] transition-colors">
          <Filter size={12} />
          Filter
        </button>
        <button
          onClick={() => setShowDone((v) => !v)}
          className={cn(
            "px-2.5 py-1.5 border rounded font-ui text-[12px] transition-colors",
            showDone ? "border-[#4CAF6B] text-[#4CAF6B]" : "border-[#E3E3E1] text-[#C4C4C2] hover:text-[#9B9A97]"
          )}
        >
          {showDone ? "Hide done" : "Show done"}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className="font-ui text-[11px] text-[#C4C4C2]">{filtered.length} issues</span>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4A9EE0] rounded font-ui text-[12px] font-medium text-white hover:bg-[#5AAFF0] transition-colors"
          >
            <Plus size={12} />
            Create
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Backlog view ────────────────────────────────────────────────── */}
        {view === "backlog" && (
          <div className="flex-1 overflow-y-auto">
            {/* Table column headers */}
            <div className="grid grid-cols-[32px_1fr_160px_120px_90px_36px] gap-2 px-4 py-2 border-b border-[#E3E3E1] bg-[#F7F7F5] sticky top-0 z-10">
              <div />
              <div className="flex items-center gap-2">
                <span className="font-ui text-[11px] uppercase tracking-[0.15em] text-[#C4C4C2] ml-[88px]">Issue</span>
              </div>
              <span className="font-ui text-[11px] uppercase tracking-[0.15em] text-[#C4C4C2]">Status</span>
              <span className="font-ui text-[11px] uppercase tracking-[0.15em] text-[#C4C4C2]">Priority</span>
              <span className="font-ui text-[11px] uppercase tracking-[0.15em] text-[#C4C4C2]">Due</span>
              <div />
            </div>

            {visibleGroups.map((group) => {
              const groupTasks = filtered.filter((t) => t.status === group.id);
              const isOpen     = !collapsed.has(group.id);
              const doneCount  = groupTasks.filter((t) => t.status === "done").length;
              const inProgCount = groupTasks.filter((t) => t.status === "in_progress").length;

              return (
                <div key={group.id} className="mb-1">
                  {/* Group header */}
                  <div
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#F7F7F5] border-b border-[#E3E3E1] cursor-pointer hover:bg-[#F0F0EE] transition-colors sticky top-[37px] z-[9]"
                    onClick={() => toggleGroup(group.id)}
                  >
                    {isOpen
                      ? <ChevronDown size={13} className="text-[#9B9A97] shrink-0" />
                      : <ChevronRight size={13} className="text-[#9B9A97] shrink-0" />
                    }
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: group.dot }} />
                    <span className="font-ui text-[13px] font-semibold text-[#191919]">{group.label}</span>
                    <span className="font-ui text-[12px] text-[#C4C4C2]">({groupTasks.length} {groupTasks.length === 1 ? "item" : "items"})</span>

                    {/* Mini stat pills */}
                    <div className="ml-auto flex items-center gap-1.5">
                      {group.id !== "done" && (
                        <>
                          <span className="font-ui text-[11px] text-[#C4C4C2] bg-[#F0F0EE] border border-[#E3E3E1] px-1.5 py-0.5 rounded">{doneCount}</span>
                          <span className="font-ui text-[11px] text-[#4A9EE0] bg-[#4A9EE018] border border-[#4A9EE040] px-1.5 py-0.5 rounded">{inProgCount}</span>
                          <span className="font-ui text-[11px] text-[#C4C4C2] bg-[#F0F0EE] border border-[#E3E3E1] px-1.5 py-0.5 rounded">{groupTasks.length - doneCount - inProgCount}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Tasks */}
                  {isOpen && (
                    <>
                      {groupTasks.length === 0 ? (
                        <div className="px-16 py-4 border border-dashed border-[#E3E3E1] mx-4 my-2 rounded text-center">
                          <p className="font-ui text-[12px] text-[#C4C4C2]">No issues in {group.label}</p>
                        </div>
                      ) : (
                        groupTasks.map((task) => (
                          <TaskRow
                            key={task._id}
                            task={task}
                            areaName={area?.name ?? ""}
                            isSelected={selectedId === task._id}
                            onSelect={() => setSelectedId(selectedId === task._id ? null : task._id)}
                            onStatusChange={(s) => handleStatusChange(task._id, s)}
                          />
                        ))
                      )}

                      {/* + Create */}
                      <button
                        onClick={() => setCreateOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 w-full font-ui text-[12px] text-[#C4C4C2] hover:text-[#9B9A97] hover:bg-[#F7F7F5] transition-colors border-b border-[#E8E8E6]"
                      >
                        <Plus size={12} />
                        Create issue
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Board view ──────────────────────────────────────────────────── */}
        {view === "board" && (
          <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
            <div className="flex gap-3 h-full min-w-max">
              {GROUPS.filter((g) => g.id !== "done" || showDone).map((col) => {
                const colTasks = filtered.filter((t) => t.status === col.id);
                return (
                  <div key={col.id} className="w-[260px] flex flex-col shrink-0">
                    <div className="flex items-center gap-2 px-2 py-2 mb-1">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: col.dot }} />
                      <span className="font-ui text-[11px] font-medium text-[#6F6E69] uppercase tracking-[0.1em]">{col.label}</span>
                      <span className="ml-auto font-ui text-[11px] text-[#C4C4C2] bg-[#F0F0EE] px-1.5 py-0.5 rounded-full">{colTasks.length}</span>
                    </div>
                    <div className="h-px mb-2" style={{ backgroundColor: col.dot + "30" }} />
                    <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                      {colTasks.map((task) => {
                        const pri = PRIORITY_META[task.priority as Priority] ?? PRIORITY_META.medium;
                        const isOverdue = task.dueDate && task.dueDate < Date.now() && task.status !== "done";
                        return (
                          <div
                            key={task._id}
                            onClick={() => setSelectedId(selectedId === task._id ? null : task._id)}
                            className={cn(
                              "bg-[#F7F7F5] border border-[#E3E3E1] rounded hover:border-[#D5D5D3] transition-colors cursor-pointer relative overflow-hidden",
                              selectedId === task._id && "border-[#4A9EE0]"
                            )}
                            style={{ borderLeft: `3px solid ${pri.color}` }}
                          >
                            <div className="px-3 pt-2.5 pb-1">
                              <span className="font-ui text-[11px] text-[#C4C4C2]">{issueKey(area?.name ?? "", task._id)}</span>
                            </div>
                            <p className="font-ui text-[13px] text-[#191919] px-3 pb-2.5 leading-snug">{task.title}</p>
                            {task.dueDate && (
                              <div className="flex items-center gap-1.5 px-3 pb-2.5 border-t border-[#E8E8E6] pt-1.5">
                                <span className="font-ui text-[11px]" style={{ color: pri.color }}>{pri.label}</span>
                                <span className={cn("ml-auto font-ui text-[11px]", isOverdue ? "text-[#E85538]" : "text-[#9B9A97]")}>
                                  {format(new Date(task.dueDate), "d MMM")}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <button onClick={() => setCreateOpen(true)} className="mt-2 flex items-center gap-1.5 px-2 py-1.5 rounded font-ui text-[12px] text-[#C4C4C2] hover:text-[#9B9A97] hover:bg-[#F7F7F5] transition-colors">
                      <Plus size={12} />Add issue
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Detail panel ────────────────────────────────────────────────── */}
        {selectedTask && area && (
          <DetailPanel
            task={selectedTask}
            areaName={area.name}
            areaColor={area.color}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      <CreateTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        userId={userId ?? ""}
        areas={areas ?? []}
        defaultAreaId={areaId}
      />
    </div>
  );
}
