"use client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { format } from "date-fns";
import { Zap, ArrowUp, Minus, Search, ChevronDown, Plus, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import CreateTaskModal from "@/components/CreateTaskModal";

const STATUS_META: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  backlog:     { label: "Backlog",     dot: "#94A3B8", bg: "#94A3B818", text: "#94A3B8" },
  todo:        { label: "To Do",       dot: "#4A9EE0", bg: "#4A9EE018", text: "#4A9EE0" },
  in_progress: { label: "In Progress", dot: "#2563EB", bg: "#2563EB18", text: "#2563EB" },
  blocked:     { label: "Blocked",     dot: "#E85538", bg: "#E8553818", text: "#E85538" },
  done:        { label: "Done",        dot: "#4CAF6B", bg: "#4CAF6B18", text: "#4CAF6B" },
};

const PRIORITY_META = {
  urgent: { icon: <Zap size={11} />,    color: "#E85538", label: "Urgent" },
  high:   { icon: <ArrowUp size={11} />, color: "#E8A838", label: "High"   },
  medium: { icon: <Minus size={11} />,   color: "#2563EB", label: "Medium" },
  low:    { icon: <Minus size={11} />,   color: "#64748B", label: "Low"    },
} as const;

type Priority = keyof typeof PRIORITY_META;
type Status   = keyof typeof STATUS_META;

function issueKey(areaName: string, taskId: string) {
  const prefix = areaName.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X");
  return `${prefix}-${taskId.slice(-4).toUpperCase()}`;
}

export default function BacklogPage() {
  const { userId } = useCurrentUser();
  const tasks  = useQuery(api.tasks.listByUser, userId ? { userId } : "skip") ?? [];
  const areas  = useQuery(api.areas.list,       userId ? { userId } : "skip") ?? [];
  const updateStatus = useMutation(api.tasks.updateStatus);

  const areaMap = Object.fromEntries(areas.map((a) => [a._id, a]));

  const [search,         setSearch]         = useState("");
  const [statusFilter,   setStatusFilter]   = useState<Status | "">("");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "">("");
  const [areaFilter,     setAreaFilter]     = useState<string>("");
  const [showDone,       setShowDone]       = useState(false);
  const [createOpen,     setCreateOpen]     = useState(false);
  const [movingTask,     setMovingTask]     = useState<string | null>(null);

  const active = tasks.filter((t) => showDone ? true : t.status !== "done");

  const filtered = active.filter((t) => {
    if (search         && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter   && t.status   !== statusFilter)                            return false;
    if (priorityFilter && t.priority !== priorityFilter)                          return false;
    if (areaFilter     && t.areaId   !== areaFilter)                              return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const pa = ["urgent","high","medium","low"].indexOf(a.priority);
    const pb = ["urgent","high","medium","low"].indexOf(b.priority);
    if (pa !== pb) return pa - pb;
    return (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity);
  });

  const handleMove = async (taskId: Id<"tasks">, status: Status) => {
    setMovingTask(taskId);
    try {
      await updateStatus({ id: taskId, status: status as "backlog" | "todo" | "in_progress" | "blocked" | "done" });
    } finally {
      setMovingTask(null);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#F7F8FA]">
      {/* Page header */}
      <div className="px-6 py-3 border-b border-[#E2E8F0] bg-[#FFFFFF] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="font-ui text-[14px] font-medium text-[#0F172A]">Backlog</h1>
          <span className="font-ui text-[11px] text-[#94A3B8] bg-[#F1F5F9] border border-[#E2E8F0] px-2 py-0.5 rounded-full">
            {filtered.length} issues
          </span>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2563EB] rounded font-ui text-[12px] font-medium text-[#FFFFFF] hover:bg-[#1D4ED8] transition-colors"
        >
          <Plus size={12} />
          Create issue
        </button>
      </div>

      {/* Filter bar */}
      <div className="px-6 py-2.5 border-b border-[#E2E8F0] bg-[#FFFFFF] flex items-center gap-2.5 shrink-0 flex-wrap">
        {/* Search */}
        <div className="flex items-center gap-2 bg-[#F7F8FA] border border-[#E2E8F0] rounded px-2.5 py-1.5 w-56">
          <Search size={12} className="text-[#94A3B8] shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search issues…"
            className="bg-transparent font-ui text-[12px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none w-full"
          />
        </div>

        <Filter size={12} className="text-[#94A3B8]" />

        {/* Status filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Status | "")}
            className="appearance-none bg-[#F7F8FA] border border-[#E2E8F0] rounded px-2.5 py-1.5 font-ui text-[12px] text-[#64748B] outline-none cursor-pointer pr-7"
          >
            <option value="">Status</option>
            {Object.entries(STATUS_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
        </div>

        {/* Priority filter */}
        <div className="relative">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as Priority | "")}
            className="appearance-none bg-[#F7F8FA] border border-[#E2E8F0] rounded px-2.5 py-1.5 font-ui text-[12px] text-[#64748B] outline-none cursor-pointer pr-7"
          >
            <option value="">Priority</option>
            {Object.entries(PRIORITY_META).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
        </div>

        {/* Area filter */}
        {areas.length > 0 && (
          <div className="relative">
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="appearance-none bg-[#F7F8FA] border border-[#E2E8F0] rounded px-2.5 py-1.5 font-ui text-[12px] text-[#64748B] outline-none cursor-pointer pr-7"
            >
              <option value="">Area</option>
              {areas.map((a) => (
                <option key={a._id} value={a._id}>{a.name}</option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
          </div>
        )}

        {/* Show done toggle */}
        <button
          onClick={() => setShowDone((v) => !v)}
          className={cn(
            "px-2.5 py-1.5 border rounded font-ui text-[12px] transition-colors",
            showDone
              ? "border-[#4CAF6B] text-[#4CAF6B] bg-[#4CAF6B18]"
              : "border-[#E2E8F0] text-[#94A3B8] hover:text-[#64748B]"
          )}
        >
          {showDone ? "Hiding done" : "Show done"}
        </button>

        {/* Clear filters */}
        {(search || statusFilter || priorityFilter || areaFilter) && (
          <button
            onClick={() => { setSearch(""); setStatusFilter(""); setPriorityFilter(""); setAreaFilter(""); }}
            className="font-ui text-[11px] text-[#E85538] hover:text-[#F07060] transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto bg-[#FFFFFF]">
        {/* Column headers */}
        <div className="grid grid-cols-[20px_1fr_130px_110px_110px_90px] gap-4 px-6 py-2 border-b border-[#E2E8F0] bg-[#FFFFFF] sticky top-0 z-10">
          <div />
          <span className="font-ui text-[11px] tracking-[0.15em] uppercase text-[#94A3B8]">Issue</span>
          <span className="font-ui text-[11px] tracking-[0.15em] uppercase text-[#94A3B8]">Status</span>
          <span className="font-ui text-[11px] tracking-[0.15em] uppercase text-[#94A3B8]">Priority</span>
          <span className="font-ui text-[11px] tracking-[0.15em] uppercase text-[#94A3B8]">Area</span>
          <span className="font-ui text-[11px] tracking-[0.15em] uppercase text-[#94A3B8]">Due</span>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-ui text-sm text-[#64748B]">No issues match your filters.</p>
            <p className="font-ui text-xs text-[#94A3B8] mt-1">Try adjusting your filters or create a new issue.</p>
          </div>
        ) : (
          sorted.map((task) => {
            const pri    = PRIORITY_META[task.priority as Priority] ?? PRIORITY_META.medium;
            const status = STATUS_META[task.status] ?? STATUS_META.backlog;
            const taskArea = areaMap[task.areaId];
            const isOverdue = task.dueDate && task.dueDate < Date.now() && task.status !== "done";

            return (
              <div
                key={task._id}
                className="grid grid-cols-[20px_1fr_130px_110px_110px_90px] gap-4 px-6 py-2.5 border-b border-[#E2E8F0] hover:bg-[#F1F5F9] transition-colors cursor-pointer items-center group"
              >
                {/* Priority icon */}
                <span style={{ color: pri.color }} className="flex items-center justify-center">
                  {pri.icon}
                </span>

                {/* Issue title + key */}
                <div className="min-w-0">
                  <p className="font-ui text-[13px] text-[#0F172A] truncate leading-snug">{task.title}</p>
                  <p className="font-ui text-[11px] text-[#94A3B8] mt-0.5">
                    {taskArea ? issueKey(taskArea.name, task._id) : task._id.slice(-6).toUpperCase()}
                  </p>
                </div>

                {/* Status badge */}
                <div>
                  <select
                    value={task.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleMove(task._id, e.target.value as Status)}
                    disabled={movingTask === task._id}
                    className="appearance-none w-full rounded px-2 py-0.5 font-ui text-[11px] outline-none cursor-pointer border border-transparent hover:border-[#CBD5E1] transition-colors"
                    style={{ backgroundColor: status.bg, color: status.text }}
                  >
                    {Object.entries(STATUS_META).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <span className="flex items-center gap-1.5 font-ui text-[12px]" style={{ color: pri.color }}>
                  {pri.icon}
                  {pri.label}
                </span>

                {/* Area */}
                {taskArea ? (
                  <span
                    className="font-ui text-[11px] px-2 py-0.5 rounded truncate"
                    style={{ color: taskArea.color, backgroundColor: `${taskArea.color}18` }}
                  >
                    {taskArea.name}
                  </span>
                ) : (
                  <span className="font-ui text-[11px] text-[#94A3B8]">—</span>
                )}

                {/* Due date */}
                <span className={cn("font-ui text-[12px]", isOverdue ? "text-[#E85538]" : "text-[#64748B]")}>
                  {task.dueDate ? format(new Date(task.dueDate), "d MMM") : "—"}
                </span>
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
