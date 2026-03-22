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
  { id: "in_progress", label: "In Progress", dot: "#2563EB", badge: "bg-[#2563EB18] text-[#2563EB] border-[#2563EB40]" },
  { id: "todo",        label: "To Do",       dot: "#4A9EE0", badge: "bg-[#4A9EE018] text-[#4A9EE0] border-[#4A9EE040]" },
  { id: "blocked",     label: "Blocked",     dot: "#E85538", badge: "bg-[#E8553818] text-[#E85538] border-[#E8553840]" },
  { id: "backlog",     label: "Backlog",     dot: "#94A3B8", badge: "bg-[#94A3B818] text-[#64748B] border-[#94A3B840]" },
  { id: "done",        label: "Done",        dot: "#4CAF6B", badge: "bg-[#4CAF6B18] text-[#4CAF6B] border-[#4CAF6B40]" },
] as const;

type Status   = (typeof GROUPS)[number]["id"];
type Priority = "urgent" | "high" | "medium" | "low";

const PRIORITY_META: Record<Priority, { icon: React.ReactNode; color: string; label: string }> = {
  urgent: { icon: <Zap size={11} />,     color: "#E85538", label: "Urgent" },
  high:   { icon: <ArrowUp size={11} />, color: "#E8A838", label: "High"   },
  medium: { icon: <Minus size={11} />,   color: "#2563EB", label: "Medium" },
  low:    { icon: <Minus size={11} />,   color: "#64748B", label: "Low"    },
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
        "grid grid-cols-[32px_1fr_160px_120px_90px_36px] gap-2 px-4 py-2 border-b border-[#E2E8F0] items-center cursor-pointer transition-colors group",
        isSelected ? "bg-[#EFF6FF]" : "hover:bg-[#FFFFFF]"
      )}
    >
      {/* Checkbox */}
      <div
        onClick={(e) => { e.stopPropagation(); onStatusChange(task.status === "done" ? "todo" : "done"); }}
        className="flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] transition-colors"
      >
        {task.status === "done"
          ? <CheckSquare size={14} className="text-[#4CAF6B]" />
          : <Square size={14} />
        }
      </div>

      {/* Key + title */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-ui text-[11px] text-[#94A3B8] tracking-[0.05em] shrink-0 w-[72px]">
          {issueKey(areaName, task._id)}
        </span>
        <span className={cn(
          "font-ui text-[13px] truncate",
          task.status === "done" ? "text-[#94A3B8] line-through" : "text-[#0F172A]"
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
        isOverdue ? "text-[#E85538]" : "text-[#64748B]"
      )}>
        {task.dueDate ? format(new Date(task.dueDate), "d MMM") : "—"}
      </span>

      {/* More */}
      <button
        onClick={(e) => e.stopPropagation()}
        className="opacity-0 group-hover:opacity-100 flex items-center justify-center text-[#64748B] hover:text-[#0F172A] transition-all"
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
    <div className="w-[340px] border-l border-[#E2E8F0] bg-[#FFFFFF] flex flex-col shrink-0 overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0] shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-ui text-[11px] text-[#94A3B8] tracking-[0.05em]">{issueKey(areaName, task._id)}</span>
          <button className="text-[#94A3B8] hover:text-[#64748B] transition-colors">
            <ExternalLink size={12} />
          </button>
        </div>
        <button onClick={onClose} className="text-[#64748B] hover:text-[#0F172A] transition-colors">
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
              className="w-full bg-transparent font-ui text-[18px] font-semibold text-[#0F172A] outline-none resize-none"
            />
          ) : (
            <h2
              onClick={() => setEditingTitle(true)}
              className="font-ui text-[18px] font-semibold text-[#0F172A] cursor-text hover:text-white leading-snug"
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
            className="appearance-none bg-[#F1F5F9] border border-[#E2E8F0] rounded px-2.5 py-1.5 font-ui text-[11px] text-[#64748B] outline-none cursor-pointer"
          >
            {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label} priority</option>)}
          </select>
        </div>

        <div className="border-t border-[#E2E8F0] mx-5 mb-4" />

        {/* Description */}
        <div className="px-5 mb-5">
          <p className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#94A3B8] mb-2">Description</p>
          {editingDesc ? (
            <textarea
              ref={descRef}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onBlur={saveDesc}
              onKeyDown={(e) => { if (e.key === "Escape") { setDesc(task.description ?? ""); setEditingDesc(false); } }}
              rows={4}
              placeholder="Add a description…"
              className="w-full bg-[#F1F5F9] border border-[#E2E8F0] rounded px-3 py-2 font-ui text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none focus:border-[#CBD5E1] resize-none transition-colors"
            />
          ) : (
            <p
              onClick={() => setEditingDesc(true)}
              className={cn(
                "font-ui text-[13px] leading-relaxed cursor-text rounded px-1 py-1 -mx-1 hover:bg-[#F1F5F9] transition-colors",
                desc ? "text-[#475569]" : "text-[#94A3B8] italic"
              )}
            >
              {desc || "Add a description…"}
            </p>
          )}
        </div>

        <div className="border-t border-[#E2E8F0] mx-5 mb-4" />

        {/* Details */}
        <div className="px-5 space-y-3 mb-6">
          <p className="font-ui text-[11px] uppercase tracking-[0.12em] text-[#94A3B8] mb-3">Details</p>

          {/* Area */}
          <div className="grid grid-cols-[100px_1fr] items-center gap-2">
            <span className="font-ui text-[12px] text-[#64748B]">Area</span>
            <span
              className="font-ui text-[12px] px-2 py-0.5 rounded w-fit"
              style={{ color: areaColor, backgroundColor: `${areaColor}18` }}
            >
              {areaName}
            </span>
          </div>

          {/* Priority */}
          <div className="grid grid-cols-[100px_1fr] items-center gap-2">
            <span className="font-ui text-[12px] text-[#64748B]">Priority</span>
            <span className="flex items-center gap-1.5 font-ui text-[12px]" style={{ color: pri.color }}>
              {pri.icon} {pri.label}
            </span>
          </div>

          {/* Due date */}
          <div className="grid grid-cols-[100px_1fr] items-center gap-2">
            <span className="font-ui text-[12px] text-[#64748B]">Due date</span>
            <input
              type="date"
              value={task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""}
              onChange={(e) => updateTask({ id: task._id, dueDate: e.target.value ? new Date(e.target.value).getTime() : undefined })}
              className={cn(
                "bg-transparent font-ui text-[12px] outline-none cursor-pointer [color-scheme:light] w-fit",
                isOverdue ? "text-[#E85538]" : "text-[#64748B]"
              )}
            />
          </div>

          {/* Created */}
          <div className="grid grid-cols-[100px_1fr] items-center gap-2">
            <span className="font-ui text-[12px] text-[#64748B]">Created</span>
            <span className="font-ui text-[12px] text-[#64748B]">
              {format(new Date(task.createdAt), "d MMM yyyy")}
            </span>
          </div>

          {task.completedAt && (
            <div className="grid grid-cols-[100px_1fr] items-center gap-2">
              <span className="font-ui text-[12px] text-[#64748B]">Completed</span>
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
            className="font-ui text-[11px] text-[#94A3B8] hover:text-[#E85538] transition-colors"
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
      <div className="px-5 py-2.5 border-b border-[#E2E8F0] flex items-center gap-2 shrink-0">
        <div className="w-6 h-6 rounded flex items-center justify-center text-[14px]" style={{ backgroundColor: `${area?.color ?? "#333"}22` }}>
          {area?.icon || <span className="font-ui text-[9px] font-bold" style={{ color: area?.color }}>
            {area?.name.slice(0,2).toUpperCase()}
          </span>}
        </div>
        <span className="font-ui text-[14px] font-semibold text-[#0F172A]">{area?.name ?? "…"}</span>
        <MoreHorizontal size={14} className="text-[#94A3B8] ml-1" />
      </div>

      {/* Tab bar */}
      <div className="px-5 border-b border-[#E2E8F0] flex items-center gap-1 shrink-0">
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
                : "border-transparent text-[#64748B] hover:text-[#475569]"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="px-5 py-2 border-b border-[#E2E8F0] flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-2 bg-[#FFFFFF] border border-[#E2E8F0] rounded px-2.5 py-1.5 w-48">
          <Search size={12} className="text-[#94A3B8] shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issues…"
            className="bg-transparent font-ui text-[12px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none w-full"
          />
        </div>
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 border border-[#E2E8F0] rounded font-ui text-[12px] text-[#64748B] hover:text-[#0F172A] transition-colors">
          <Filter size={12} />
          Filter
        </button>
        <button
          onClick={() => setShowDone((v) => !v)}
          className={cn(
            "px-2.5 py-1.5 border rounded font-ui text-[12px] transition-colors",
            showDone ? "border-[#4CAF6B] text-[#4CAF6B]" : "border-[#E2E8F0] text-[#94A3B8] hover:text-[#64748B]"
          )}
        >
          {showDone ? "Hide done" : "Show done"}
        </button>
        <div className="ml-auto flex items-center gap-2">
          <span className="font-ui text-[11px] text-[#94A3B8]">{filtered.length} issues</span>
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
            <div className="grid grid-cols-[32px_1fr_160px_120px_90px_36px] gap-2 px-4 py-2 border-b border-[#E2E8F0] bg-[#FFFFFF] sticky top-0 z-10">
              <div />
              <div className="flex items-center gap-2">
                <span className="font-ui text-[11px] uppercase tracking-[0.15em] text-[#94A3B8] ml-[88px]">Issue</span>
              </div>
              <span className="font-ui text-[11px] uppercase tracking-[0.15em] text-[#94A3B8]">Status</span>
              <span className="font-ui text-[11px] uppercase tracking-[0.15em] text-[#94A3B8]">Priority</span>
              <span className="font-ui text-[11px] uppercase tracking-[0.15em] text-[#94A3B8]">Due</span>
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
                    className="flex items-center gap-2 px-4 py-2.5 bg-[#FFFFFF] border-b border-[#E2E8F0] cursor-pointer hover:bg-[#F1F5F9] transition-colors sticky top-[37px] z-[9]"
                    onClick={() => toggleGroup(group.id)}
                  >
                    {isOpen
                      ? <ChevronDown size={13} className="text-[#64748B] shrink-0" />
                      : <ChevronRight size={13} className="text-[#64748B] shrink-0" />
                    }
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: group.dot }} />
                    <span className="font-ui text-[13px] font-semibold text-[#0F172A]">{group.label}</span>
                    <span className="font-ui text-[12px] text-[#94A3B8]">({groupTasks.length} {groupTasks.length === 1 ? "item" : "items"})</span>

                    {/* Mini stat pills */}
                    <div className="ml-auto flex items-center gap-1.5">
                      {group.id !== "done" && (
                        <>
                          <span className="font-ui text-[11px] text-[#94A3B8] bg-[#F1F5F9] border border-[#E2E8F0] px-1.5 py-0.5 rounded">{doneCount}</span>
                          <span className="font-ui text-[11px] text-[#4A9EE0] bg-[#4A9EE018] border border-[#4A9EE040] px-1.5 py-0.5 rounded">{inProgCount}</span>
                          <span className="font-ui text-[11px] text-[#94A3B8] bg-[#F1F5F9] border border-[#E2E8F0] px-1.5 py-0.5 rounded">{groupTasks.length - doneCount - inProgCount}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Tasks */}
                  {isOpen && (
                    <>
                      {groupTasks.length === 0 ? (
                        <div className="px-16 py-4 border border-dashed border-[#E2E8F0] mx-4 my-2 rounded text-center">
                          <p className="font-ui text-[12px] text-[#94A3B8]">No issues in {group.label}</p>
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
                        className="flex items-center gap-2 px-4 py-2 w-full font-ui text-[12px] text-[#94A3B8] hover:text-[#64748B] hover:bg-[#FFFFFF] transition-colors border-b border-[#E2E8F0]"
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
                      <span className="font-ui text-[11px] font-medium text-[#475569] uppercase tracking-[0.1em]">{col.label}</span>
                      <span className="ml-auto font-ui text-[11px] text-[#94A3B8] bg-[#F1F5F9] px-1.5 py-0.5 rounded-full">{colTasks.length}</span>
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
                              "bg-[#FFFFFF] border border-[#E2E8F0] rounded hover:border-[#CBD5E1] transition-colors cursor-pointer relative overflow-hidden",
                              selectedId === task._id && "border-[#4A9EE0]"
                            )}
                            style={{ borderLeft: `3px solid ${pri.color}` }}
                          >
                            <div className="px-3 pt-2.5 pb-1">
                              <span className="font-ui text-[11px] text-[#94A3B8]">{issueKey(area?.name ?? "", task._id)}</span>
                            </div>
                            <p className="font-ui text-[13px] text-[#0F172A] px-3 pb-2.5 leading-snug">{task.title}</p>
                            {task.dueDate && (
                              <div className="flex items-center gap-1.5 px-3 pb-2.5 border-t border-[#E2E8F0] pt-1.5">
                                <span className="font-ui text-[11px]" style={{ color: pri.color }}>{pri.label}</span>
                                <span className={cn("ml-auto font-ui text-[11px]", isOverdue ? "text-[#E85538]" : "text-[#64748B]")}>
                                  {format(new Date(task.dueDate), "d MMM")}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <button onClick={() => setCreateOpen(true)} className="mt-2 flex items-center gap-1.5 px-2 py-1.5 rounded font-ui text-[12px] text-[#94A3B8] hover:text-[#64748B] hover:bg-[#FFFFFF] transition-colors">
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
