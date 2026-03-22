"use client";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { X, Check } from "lucide-react";

const TEMPLATES = [
  {
    id: "work",
    name: "Work & Career",
    description: "Projects, tasks, career goals",
    icon: "💼",
    color: "#4A9EE0",
    category: "Work",
  },
  {
    id: "health",
    name: "Health & Fitness",
    description: "Workouts, habits, wellness",
    icon: "🏃",
    color: "#4CAF6B",
    category: "Health",
  },
  {
    id: "creative",
    name: "Creative",
    description: "Music, art, writing, hobbies",
    icon: "🎸",
    color: "#2383E2",
    category: "Creative",
  },
  {
    id: "finance",
    name: "Finance",
    description: "Budget, savings, investments",
    icon: "💰",
    color: "#E8A838",
    category: "Finance",
  },
  {
    id: "learning",
    name: "Learning",
    description: "Courses, books, skill-building",
    icon: "📚",
    color: "#9B59B6",
    category: "Learning",
  },
  {
    id: "travel",
    name: "Travel",
    description: "Trips, adventures, planning",
    icon: "✈️",
    color: "#E85538",
    category: "Travel",
  },
  {
    id: "relationships",
    name: "Relationships",
    description: "Family, friends, social goals",
    icon: "🤝",
    color: "#E8538A",
    category: "Relationships",
  },
  {
    id: "home",
    name: "Home & Life",
    description: "Household, admin, personal",
    icon: "🏠",
    color: "#9B9A97",
    category: "Home",
  },
];

const COLORS = [
  "#4A9EE0", "#4CAF6B", "#2383E2", "#E8A838",
  "#E85538", "#9B59B6", "#E8538A", "#9B9A97",
  "#2ECC71", "#3498DB", "#E67E22", "#1ABC9C",
];

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
}

export default function CreateAreaModal({ open, onClose, userId }: Props) {
  const createArea = useMutation(api.areas.create);

  const [step, setStep] = useState<"template" | "configure">("template");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const selectTemplate = (t: typeof TEMPLATES[0]) => {
    setName(t.name);
    setColor(t.color);
    setIcon(t.icon);
    setCategory(t.category);
    setDescription(t.description);
    setStep("configure");
  };

  const startBlank = () => {
    setName("");
    setColor(COLORS[0]);
    setIcon("");
    setCategory("");
    setDescription("");
    setStep("configure");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !userId) return;
    setSaving(true);
    try {
      await createArea({
        userId,
        name: name.trim(),
        color,
        icon: icon || undefined,
        description: description.trim() || undefined,
        category: category || undefined,
      });
      onClose();
      setStep("template");
      setName(""); setDescription(""); setColor(COLORS[0]); setIcon(""); setCategory("");
    } finally {
      setSaving(false);
    }
  };

  const areaKey = name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X") || "KEY";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-[580px] bg-[#F7F7F5] border border-[#E3E3E1] rounded-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E3E3E1]">
          <div className="flex items-center gap-3">
            {step === "configure" && (
              <button
                type="button"
                onClick={() => setStep("template")}
                className="font-ui text-[12px] text-[#9B9A97] hover:text-[#191919] transition-colors"
              >
                ← Back
              </button>
            )}
            <span className="font-ui text-[13px] font-medium text-[#191919]">
              {step === "template" ? "Create area" : "Configure area"}
            </span>
          </div>
          <button type="button" onClick={onClose} className="text-[#9B9A97] hover:text-[#191919] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Template picker */}
        {step === "template" && (
          <div className="p-5">
            <p className="font-ui text-[12px] text-[#9B9A97] mb-4">
              Choose a template to get started, or create a blank area.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTemplate(t)}
                  className="flex items-start gap-3 p-3 rounded border border-[#E3E3E1] bg-[#F7F7F5] hover:bg-[#F0F0EE] hover:border-[#D5D5D3] transition-colors text-left"
                >
                  <span className="text-[18px] shrink-0 mt-0.5">{t.icon}</span>
                  <div className="min-w-0">
                    <p className="font-ui text-[13px] font-medium text-[#191919]">{t.name}</p>
                    <p className="font-ui text-[11px] text-[#9B9A97] mt-0.5">{t.description}</p>
                  </div>
                  <span
                    className="ml-auto w-2 h-2 rounded-full shrink-0 mt-1"
                    style={{ backgroundColor: t.color }}
                  />
                </button>
              ))}
            </div>
            <button
              onClick={startBlank}
              className="w-full py-2 border border-dashed border-[#E3E3E1] rounded font-ui text-[12px] text-[#9B9A97] hover:text-[#191919] hover:border-[#D5D5D3] transition-colors"
            >
              Start blank
            </button>
          </div>
        )}

        {/* Configure form */}
        {step === "configure" && (
          <form onSubmit={handleSubmit}>
            <div className="p-5 space-y-4">
              {/* Preview */}
              <div className="flex items-center gap-3 p-3 bg-[#F7F7F5] border border-[#E3E3E1] rounded">
                <div
                  className="w-8 h-8 rounded flex items-center justify-center text-[18px] shrink-0"
                  style={{ backgroundColor: `${color}22` }}
                >
                  {icon || <span className="font-ui text-[11px] font-bold" style={{ color }}>{areaKey.slice(0,2)}</span>}
                </div>
                <div>
                  <p className="font-ui text-[13px] font-medium text-[#191919]">{name || "Area name"}</p>
                  <p className="font-ui text-[11px] text-[#C4C4C2]">Key: {areaKey}</p>
                </div>
                {category && (
                  <span className="ml-auto font-ui text-[11px] text-[#9B9A97] bg-[#F0F0EE] border border-[#E3E3E1] px-2 py-0.5 rounded">
                    {category}
                  </span>
                )}
              </div>

              {/* Name */}
              <div>
                <label className="block font-ui text-[11px] tracking-[0.12em] uppercase text-[#9B9A97] mb-1.5">
                  Area name <span className="text-[#E85538]">*</span>
                </label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Work & Career"
                  required
                  className="w-full bg-[#F0F0EE] border border-[#E3E3E1] rounded px-3 py-2 font-ui text-[13px] text-[#191919] placeholder:text-[#C4C4C2] outline-none focus:border-[#2383E2] transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block font-ui text-[11px] tracking-[0.12em] uppercase text-[#9B9A97] mb-1.5">
                  Description
                </label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this area track?"
                  className="w-full bg-[#F0F0EE] border border-[#E3E3E1] rounded px-3 py-2 font-ui text-[13px] text-[#191919] placeholder:text-[#C4C4C2] outline-none focus:border-[#D5D5D3] transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Category */}
                <div>
                  <label className="block font-ui text-[11px] tracking-[0.12em] uppercase text-[#9B9A97] mb-1.5">
                    Category
                  </label>
                  <input
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. Work, Health…"
                    className="w-full bg-[#F0F0EE] border border-[#E3E3E1] rounded px-3 py-2 font-ui text-[13px] text-[#191919] placeholder:text-[#C4C4C2] outline-none focus:border-[#D5D5D3] transition-colors"
                  />
                </div>

                {/* Icon */}
                <div>
                  <label className="block font-ui text-[11px] tracking-[0.12em] uppercase text-[#9B9A97] mb-1.5">
                    Icon (emoji)
                  </label>
                  <input
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    placeholder="💼"
                    className="w-full bg-[#F0F0EE] border border-[#E3E3E1] rounded px-3 py-2 font-ui text-[13px] text-[#191919] placeholder:text-[#C4C4C2] outline-none focus:border-[#D5D5D3] transition-colors"
                  />
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block font-ui text-[11px] tracking-[0.12em] uppercase text-[#9B9A97] mb-1.5">
                  Color
                </label>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className="w-6 h-6 rounded-sm border-2 transition-all flex items-center justify-center"
                      style={{
                        backgroundColor: c,
                        borderColor: color === c ? "#191919" : "transparent",
                      }}
                    >
                      {color === c && <Check size={10} className="text-white" />}
                    </button>
                  ))}
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
                disabled={!name.trim() || saving}
                className="px-4 py-1.5 bg-[#2383E2] rounded font-ui text-[13px] font-medium text-[#FFFFFF] hover:bg-[#1a73d1] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Creating…" : "Create area"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
