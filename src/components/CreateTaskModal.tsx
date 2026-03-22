"use client";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { X } from "lucide-react";

type Area = { _id: Id<"areas">; name: string; color: string };

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
  areas: Area[];
  defaultAreaId?: Id<"areas">;
}

const PRIORITIES = [
  { value: "urgent", label: "Urgent", color: "#E85538" },
  { value: "high", label: "High", color: "#E8A838" },
  { value: "medium", label: "Medium", color: "#2383E2" },
  { value: "low", label: "Low", color: "#9B9A97" },
] as const;

const STATUSES = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
] as const;

export default function CreateTaskModal({ open, onClose, userId, areas, defaultAreaId }: Props) {
  const createTask = useMutation(api.tasks.create);
  const updateStatus = useMutation(api.tasks.updateStatus);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [areaId, setAreaId] = useState<Id<"areas"> | "">(defaultAreaId ?? (areas[0]?._id ?? ""));
  const [priority, setPriority] = useState<"urgent" | "high" | "medium" | "low">("medium");
  const [status, setStatus] = useState<"backlog" | "todo" | "in_progress">("todo");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !areaId || !userId) return;
    setSaving(true);
    try {
      const id = await createTask({
        userId,
        areaId: areaId as Id<"areas">,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
      });
      if (status !== "todo") {
        await updateStatus({ id, status });
      }
      setTitle("");
      setDescription("");
      setDueDate("");
      setPriority("medium");
      setStatus("todo");
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <form
        onSubmit={handleSubmit}
        className="relative w-[520px] bg-[#F7F7F5] border border-[#E3E3E1] rounded-md shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E3E3E1]">
          <span className="font-ui text-[13px] font-medium text-[#191919]">Create task</span>
          <button
            type="button"
            onClick={onClose}
            className="text-[#9B9A97] hover:text-[#191919] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Title */}
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            required
            className="w-full bg-transparent font-ui text-[15px] text-[#191919] placeholder:text-[#C4C4C2] outline-none border-b border-[#E3E3E1] pb-2 focus:border-[#2383E2] transition-colors"
          />

          {/* Description */}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add a description…"
            rows={2}
            className="w-full bg-[#F0F0EE] border border-[#E3E3E1] rounded px-3 py-2 font-ui text-[13px] text-[#191919] placeholder:text-[#C4C4C2] outline-none focus:border-[#D5D5D3] transition-colors resize-none"
          />

          {/* Meta row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Area */}
            <div>
              <label className="block text-[#9B9A97] font-ui text-[11px] tracking-[0.12em] uppercase mb-1.5">Area</label>
              <select
                value={areaId}
                onChange={(e) => setAreaId(e.target.value as Id<"areas">)}
                className="w-full bg-[#F0F0EE] border border-[#E3E3E1] rounded px-2.5 py-1.5 font-ui text-[13px] text-[#191919] outline-none appearance-none cursor-pointer"
              >
                {areas.map((a) => (
                  <option key={a._id} value={a._id}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-[#9B9A97] font-ui text-[11px] tracking-[0.12em] uppercase mb-1.5">Priority</label>
              <div className="flex gap-1.5">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className="flex-1 py-1.5 rounded border font-ui text-[11px] transition-colors"
                    style={{
                      borderColor: priority === p.value ? p.color : "#E3E3E1",
                      color: priority === p.value ? p.color : "#9B9A97",
                      backgroundColor: priority === p.value ? `${p.color}18` : "transparent",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Status */}
            <div>
              <label className="block text-[#9B9A97] font-ui text-[11px] tracking-[0.12em] uppercase mb-1.5">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className="w-full bg-[#F0F0EE] border border-[#E3E3E1] rounded px-2.5 py-1.5 font-ui text-[13px] text-[#191919] outline-none appearance-none cursor-pointer"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Due date */}
            <div>
              <label className="block text-[#9B9A97] font-ui text-[11px] tracking-[0.12em] uppercase mb-1.5">Due date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-[#F0F0EE] border border-[#E3E3E1] rounded px-2.5 py-1.5 font-ui text-[13px] text-[#191919] outline-none [color-scheme:light] cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#E3E3E1]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 font-ui text-[13px] text-[#9B9A97] hover:text-[#191919] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!title.trim() || !areaId || saving}
            className="px-4 py-1.5 bg-[#2383E2] rounded font-ui text-[13px] font-medium text-[#FFFFFF] hover:bg-[#1a73d1] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Creating…" : "Create task"}
          </button>
        </div>
      </form>
    </div>
  );
}
