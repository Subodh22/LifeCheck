"use client";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
  X, Check,
  Briefcase, Activity, Palette, TrendingUp,
  BookOpen, Plane, Heart, Home,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const INK       = "#0D0D0D";
const INK_LIGHT = "#555550";
const INK_FAINT = "#999990";
const RED       = "#C41E3A";
const RULE_L    = "#CCCCBC";
const NEWSPRINT = "#FAFAF5";
const WHITE     = "#FFFFFF";

type Template = {
  id: string;
  name: string;
  description: string;
  Icon: LucideIcon;
  color: string;
  category: string;
};

const TEMPLATES: Template[] = [
  { id: "work",          name: "Work & Career",   description: "Projects, tasks, career goals",   Icon: Briefcase,   color: "#0D0D0D", category: "Work"          },
  { id: "health",        name: "Health & Fitness", description: "Workouts, habits, wellness",      Icon: Activity,    color: "#3A7D44", category: "Health"        },
  { id: "creative",      name: "Creative",         description: "Music, art, writing, hobbies",    Icon: Palette,     color: "#C41E3A", category: "Creative"      },
  { id: "finance",       name: "Finance",          description: "Budget, savings, investments",    Icon: TrendingUp,  color: "#B08A4E", category: "Finance"       },
  { id: "learning",      name: "Learning",         description: "Courses, books, skill-building",  Icon: BookOpen,    color: "#555550", category: "Learning"      },
  { id: "travel",        name: "Travel",           description: "Trips, adventures, planning",     Icon: Plane,       color: "#2A5F8F", category: "Travel"        },
  { id: "relationships", name: "Relationships",    description: "Family, friends, social goals",   Icon: Heart,       color: "#8F3A2A", category: "Relationships" },
  { id: "home",          name: "Home & Life",      description: "Household, admin, personal",      Icon: Home,        color: "#2A7A7A", category: "Home"          },
];

const COLORS = [
  "#0D0D0D", "#3A7D44", "#C41E3A", "#B08A4E",
  "#2A5F8F", "#555550", "#8F3A2A", "#2A7A7A",
];

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
}

export default function CreateAreaModal({ open, onClose, userId }: Props) {
  const createArea = useMutation(api.areas.create);

  const [step,        setStep]        = useState<"template" | "configure">("template");
  const [name,        setName]        = useState("");
  const [description, setDescription] = useState("");
  const [color,       setColor]       = useState(COLORS[0]);
  const [category,    setCategory]    = useState("");
  const [saving,      setSaving]      = useState(false);

  if (!open) return null;

  const selectTemplate = (t: Template) => {
    setName(t.name);
    setColor(t.color);
    setCategory(t.category);
    setDescription(t.description);
    setStep("configure");
  };

  const startBlank = () => {
    setName(""); setColor(COLORS[0]); setCategory(""); setDescription("");
    setStep("configure");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !userId) return;
    setSaving(true);
    try {
      await createArea({
        userId,
        name:        name.trim(),
        color,
        icon:        undefined,
        description: description.trim() || undefined,
        category:    category || undefined,
      });
      onClose();
      setStep("template");
      setName(""); setDescription(""); setColor(COLORS[0]); setCategory("");
    } finally { setSaving(false); }
  };

  const areaKey = name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X") || "KEY";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)" }} onClick={onClose} />

      <div style={{ position: "relative", width: "540px", background: WHITE, border: `1px solid ${INK}`, overflow: "hidden" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: `1px solid ${RULE_L}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {step === "configure" && (
              <button
                type="button"
                onClick={() => setStep("template")}
                style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "12px", color: INK_LIGHT, background: "none", border: "none", cursor: "pointer" }}
              >
                ← Back
              </button>
            )}
            <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "16px", fontWeight: 700, color: INK }}>
              {step === "template" ? "Create area" : "Configure area"}
            </span>
          </div>
          <button type="button" onClick={onClose} style={{ color: INK_LIGHT, background: "none", border: "none", cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        {/* ── Template picker ── */}
        {step === "template" && (
          <div style={{ padding: "20px" }}>
            <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "11px", color: INK_LIGHT, marginBottom: "16px", letterSpacing: "0.3px" }}>
              Choose a template to get started, or create a blank area.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
              {TEMPLATES.map((t) => {
                const Icon = t.Icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => selectTemplate(t)}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: "12px",
                      padding: "12px 14px", border: `1px solid ${RULE_L}`,
                      background: WHITE, cursor: "pointer", textAlign: "left",
                      transition: "all 0.1s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = INK; (e.currentTarget as HTMLElement).style.background = NEWSPRINT; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = RULE_L; (e.currentTarget as HTMLElement).style.background = WHITE; }}
                  >
                    <div style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `1px solid ${RULE_L}` }}>
                      <Icon size={15} color={t.color} strokeWidth={1.5} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "13px", fontWeight: 600, color: INK, marginBottom: "2px" }}>{t.name}</p>
                      <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "10px", color: INK_FAINT, lineHeight: 1.4 }}>{t.description}</p>
                    </div>
                    <span style={{ width: "6px", height: "6px", flexShrink: 0, marginTop: "4px", backgroundColor: t.color }} />
                  </button>
                );
              })}
            </div>
            <button
              onClick={startBlank}
              style={{
                width: "100%", padding: "10px",
                border: `1px dashed ${RULE_L}`, background: "none",
                fontFamily: "'Inter', system-ui, sans-serif", fontSize: "11px",
                fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase",
                color: INK_FAINT, cursor: "pointer", transition: "all 0.1s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = INK; (e.currentTarget as HTMLElement).style.color = INK; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = RULE_L; (e.currentTarget as HTMLElement).style.color = INK_FAINT; }}
            >
              + Start blank
            </button>
          </div>
        )}

        {/* ── Configure form ── */}
        {step === "configure" && (
          <form onSubmit={handleSubmit}>
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>

              {/* Preview */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", background: NEWSPRINT, border: `1px solid ${RULE_L}` }}>
                <div style={{ width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: `1px solid ${RULE_L}`, backgroundColor: `${color}18` }}>
                  <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "11px", fontWeight: 700, color }}>{areaKey.slice(0, 2)}</span>
                </div>
                <div>
                  <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "14px", fontWeight: 700, color: INK }}>{name || "Area name"}</p>
                  <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "10px", color: INK_FAINT, letterSpacing: "1px", textTransform: "uppercase" }}>Key: {areaKey}</p>
                </div>
                {category && (
                  <span style={{ marginLeft: "auto", fontFamily: "'Inter', system-ui, sans-serif", fontSize: "10px", color: INK_LIGHT, border: `1px solid ${RULE_L}`, padding: "2px 8px", letterSpacing: "0.5px" }}>
                    {category}
                  </span>
                )}
              </div>

              {/* Name */}
              <div>
                <label style={{ display: "block", fontFamily: "'Inter', system-ui, sans-serif", fontSize: "10px", letterSpacing: "1.5px", textTransform: "uppercase", color: INK_LIGHT, marginBottom: "6px" }}>
                  Area name <span style={{ color: RED }}>*</span>
                </label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Work & Career"
                  required
                  style={{ width: "100%", background: NEWSPRINT, border: `1px solid ${RULE_L}`, padding: "8px 12px", fontFamily: "'Inter', system-ui, sans-serif", fontSize: "13px", color: INK, outline: "none", boxSizing: "border-box" }}
                  onFocus={e => (e.target as HTMLElement).style.borderColor = INK}
                  onBlur={e => (e.target as HTMLElement).style.borderColor = RULE_L}
                />
              </div>

              {/* Description */}
              <div>
                <label style={{ display: "block", fontFamily: "'Inter', system-ui, sans-serif", fontSize: "10px", letterSpacing: "1.5px", textTransform: "uppercase", color: INK_LIGHT, marginBottom: "6px" }}>
                  Description
                </label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this area track?"
                  style={{ width: "100%", background: NEWSPRINT, border: `1px solid ${RULE_L}`, padding: "8px 12px", fontFamily: "'Inter', system-ui, sans-serif", fontSize: "13px", color: INK, outline: "none", boxSizing: "border-box" }}
                  onFocus={e => (e.target as HTMLElement).style.borderColor = INK}
                  onBlur={e => (e.target as HTMLElement).style.borderColor = RULE_L}
                />
              </div>

              {/* Category */}
              <div>
                <label style={{ display: "block", fontFamily: "'Inter', system-ui, sans-serif", fontSize: "10px", letterSpacing: "1.5px", textTransform: "uppercase", color: INK_LIGHT, marginBottom: "6px" }}>
                  Category
                </label>
                <input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. Work, Health…"
                  style={{ width: "100%", background: NEWSPRINT, border: `1px solid ${RULE_L}`, padding: "8px 12px", fontFamily: "'Inter', system-ui, sans-serif", fontSize: "13px", color: INK, outline: "none", boxSizing: "border-box" }}
                  onFocus={e => (e.target as HTMLElement).style.borderColor = INK}
                  onBlur={e => (e.target as HTMLElement).style.borderColor = RULE_L}
                />
              </div>

              {/* Color */}
              <div>
                <label style={{ display: "block", fontFamily: "'Inter', system-ui, sans-serif", fontSize: "10px", letterSpacing: "1.5px", textTransform: "uppercase", color: INK_LIGHT, marginBottom: "8px" }}>
                  Accent color
                </label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      style={{
                        width: "28px", height: "28px",
                        backgroundColor: c,
                        border: color === c ? `2px solid ${INK}` : "2px solid transparent",
                        outline: color === c ? `1px solid ${RULE_L}` : "none",
                        cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.1s",
                      }}
                    >
                      {color === c && <Check size={11} color={c === "#0D0D0D" ? WHITE : WHITE} strokeWidth={2.5} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", padding: "12px 20px", borderTop: `1px solid ${RULE_L}` }}>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: "7px 16px", fontFamily: "'Inter', system-ui, sans-serif", fontSize: "12px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", color: INK_LIGHT, background: "none", border: `1px solid ${RULE_L}`, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || saving}
                style={{
                  padding: "7px 16px",
                  fontFamily: "'Inter', system-ui, sans-serif", fontSize: "12px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase",
                  color: WHITE, background: saving || !name.trim() ? INK_FAINT : INK,
                  border: "none", cursor: !name.trim() || saving ? "not-allowed" : "pointer",
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => { if (name.trim() && !saving) (e.currentTarget as HTMLElement).style.background = RED; }}
                onMouseLeave={e => { if (name.trim() && !saving) (e.currentTarget as HTMLElement).style.background = INK; }}
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
