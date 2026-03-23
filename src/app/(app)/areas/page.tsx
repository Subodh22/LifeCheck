"use client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { healthColor } from "@/constants/colors";
import { format } from "date-fns";
import {
  Star, Search, Plus, LayoutGrid, ChevronDown,
  CheckSquare, MoreHorizontal, X, Sparkles,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CreateAreaModal from "@/components/CreateAreaModal";

const INK       = "#0D0D0D";
const INK_LIGHT = "#555550";
const INK_FAINT = "#999990";
const RED       = "#C41E3A";
const RULE_L    = "#CCCCBC";
const NEWSPRINT = "#FAFAF5";
const WHITE     = "#FFFFFF";

const TEMPLATES = [
  { id: "work",          icon: "💼", name: "Work & Career",   description: "Projects and career goals",   color: "#2A5F8F" },
  { id: "health",        icon: "🏃", name: "Health & Fitness", description: "Workouts, habits, wellness", color: "#3A7D44" },
  { id: "creative",      icon: "🎸", name: "Creative",         description: "Music, art, writing",        color: "#C41E3A" },
  { id: "finance",       icon: "💰", name: "Finance",          description: "Budget and investments",     color: "#B08A4E" },
  { id: "learning",      icon: "📚", name: "Learning",         description: "Courses and skills",         color: "#7A3D6B" },
  { id: "travel",        icon: "✈️", name: "Travel",           description: "Trips and adventures",      color: "#8F3A2A" },
  { id: "relationships", icon: "🤝", name: "Relationships",    description: "Family and friends",         color: "#2A7A7A" },
  { id: "home",          icon: "🏠", name: "Home & Life",      description: "Household and admin",        color: "#555550" },
];

function areaKey(name: string) {
  return name.slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "X");
}

export default function AreasPage() {
  const { userId } = useCurrentUser();
  const router = useRouter();
  const areas        = useQuery(api.areas.list,              userId ? { userId } : "skip") ?? [];
  const allTasks     = useQuery(api.tasks.listByUser,        userId ? { userId } : "skip") ?? [];
  const healthScores = useQuery(api.healthScores.getByUser,  userId ? { userId } : "skip") ?? {};

  const seedDemo   = useMutation(api.seed.seedDemoData);
  const archiveArea = useMutation(api.areas.archive);

  const [search,        setSearch]        = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [createOpen,    setCreateOpen]    = useState(false);
  const [starredSet,    setStarredSet]    = useState<Set<string>>(new Set());
  const [seeding,       setSeeding]       = useState(false);
  const [menuOpenId,    setMenuOpenId]    = useState<string | null>(null);

  useEffect(() => {
    if (areas !== undefined && areas.length === 0 && userId) {
      const onboarded = localStorage.getItem("onboarded");
      if (!onboarded) {
        router.replace("/onboarding");
      }
    }
  }, [areas, userId, router]);

  useEffect(() => {
    if (!menuOpenId) return;
    const close = () => setMenuOpenId(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpenId]);

  const handleSeed = async () => {
    if (!userId || seeding) return;
    setSeeding(true);
    try { await seedDemo({ userId }); } finally { setSeeding(false); }
  };

  const taskCountByArea = allTasks.reduce((acc, t) => {
    if (t.status !== "done") acc[t.areaId] = (acc[t.areaId] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filtered = areas.filter((a) =>
    !search || a.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleStar = (id: string) => {
    setStarredSet((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div style={{ minHeight: "calc(100vh - 72px)", background: NEWSPRINT, display: "flex", flexDirection: "column" }}>

      {/* ── Page Hero ── */}
      <div style={{ padding: "36px 64px 24px", borderBottom: `2px solid ${INK}` }}>
        <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "10px", fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", color: RED, marginBottom: "8px" }}>
          Life Spaces
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
            Areas
          </h1>
          <div style={{ display: "flex", gap: "32px", alignItems: "flex-end", paddingBottom: "4px" }}>
            {[
              { label: "Spaces", value: areas.length },
              { label: "Active Tasks", value: Object.values(taskCountByArea).reduce((a, b) => a + b, 0) },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "24px", fontWeight: 700, color: INK, lineHeight: 1 }}>
                  {s.value}
                </div>
                <div style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "9px", fontWeight: 600, letterSpacing: "2px", textTransform: "uppercase", color: INK_FAINT, marginTop: "2px" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Controls row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Search */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", border: `1px solid ${RULE_L}`, background: WHITE, padding: "6px 12px", width: "240px" }}>
              <Search size={12} color={INK_FAINT} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search spaces…"
                style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize: "11px", color: INK,
                  background: "transparent", border: "none", outline: "none", width: "100%",
                }}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => setShowTemplates((v) => !v)}
              style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: "11px", fontWeight: 600, letterSpacing: "1px",
                textTransform: "uppercase",
                display: "flex", alignItems: "center", gap: "6px",
                padding: "7px 14px",
                border: `1px solid ${showTemplates ? INK : RULE_L}`,
                background: showTemplates ? INK : "transparent",
                color: showTemplates ? WHITE : INK_FAINT,
                cursor: "pointer", transition: "all 0.15s",
              }}
            >
              <LayoutGrid size={11} />
              Templates
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: "11px", fontWeight: 600, letterSpacing: "1px",
                textTransform: "uppercase",
                display: "flex", alignItems: "center", gap: "6px",
                padding: "7px 14px",
                background: INK, border: "none", color: WHITE,
                cursor: "pointer", transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = RED}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = INK}
            >
              <Plus size={11} />
              New Space
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Main content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* Table header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "32px 1fr 80px 120px 100px 80px 90px 40px",
            gap: "16px",
            padding: "10px 64px",
            borderBottom: `1px solid ${RULE_L}`,
            background: NEWSPRINT,
            position: "sticky", top: 0, zIndex: 10,
          }}>
            <div />
            {["Name", "Key", "Category", "Health", "Tasks", "Created", ""].map((col) => (
              <span key={col} style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: "9px", fontWeight: 700, letterSpacing: "2px",
                textTransform: "uppercase", color: INK_FAINT,
              }}>
                {col}
              </span>
            ))}
          </div>

          {filtered.length === 0 && (
            <div style={{ padding: "64px", textAlign: "center" }}>
              <LayoutGrid size={28} color={INK_FAINT} style={{ margin: "0 auto 16px" }} />
              <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontStyle: "italic", fontSize: "18px", color: INK_LIGHT, marginBottom: "6px" }}>
                {search ? "No spaces match your search." : "No spaces yet."}
              </p>
              {!search && (
                <>
                  <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "11px", color: INK_FAINT, marginBottom: "24px" }}>
                    Create your first space or load demo data to explore the app.
                  </p>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px" }}>
                    <button
                      onClick={() => setCreateOpen(true)}
                      style={{
                        fontFamily: "'Inter', system-ui, sans-serif",
                        fontSize: "11px", fontWeight: 600, letterSpacing: "1px",
                        textTransform: "uppercase",
                        display: "flex", alignItems: "center", gap: "6px",
                        padding: "8px 16px", background: INK, border: "none",
                        color: WHITE, cursor: "pointer",
                      }}
                    >
                      <Plus size={11} /> Create first space
                    </button>
                    <button
                      onClick={handleSeed}
                      disabled={seeding}
                      style={{
                        fontFamily: "'Inter', system-ui, sans-serif",
                        fontSize: "11px", fontWeight: 600, letterSpacing: "1px",
                        textTransform: "uppercase",
                        display: "flex", alignItems: "center", gap: "6px",
                        padding: "8px 16px", border: `1px solid ${RULE_L}`,
                        background: "transparent", color: INK_LIGHT,
                        cursor: seeding ? "not-allowed" : "pointer",
                        opacity: seeding ? 0.5 : 1,
                      }}
                    >
                      <Sparkles size={11} />
                      {seeding ? "Loading demo…" : "Load demo data"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {filtered.map((area) => {
            const score     = (healthScores as Record<string, number>)[area._id] ?? 50;
            const hColor    = healthColor(score);
            const taskCount = taskCountByArea[area._id] ?? 0;
            const isStarred = starredSet.has(area._id);

            return (
              <div
                key={area._id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "32px 1fr 80px 120px 100px 80px 90px 40px",
                  gap: "16px",
                  padding: "13px 64px",
                  borderBottom: `1px solid ${RULE_L}`,
                  alignItems: "center",
                  cursor: "pointer",
                  transition: "background 0.08s",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.02)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              >
                {/* Star */}
                <button
                  onClick={() => toggleStar(area._id)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "none", border: "none", cursor: "pointer",
                    color: isStarred ? RED : RULE_L,
                    transition: "color 0.15s",
                  }}
                >
                  <Star size={14} fill={isStarred ? "currentColor" : "none"} />
                </button>

                {/* Name */}
                <Link href={`/area/${area._id}`} style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, textDecoration: "none" }}>
                  <div
                    style={{
                      width: "28px", height: "28px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, fontSize: "15px",
                      backgroundColor: `${area.color}22`,
                    }}
                  >
                    {area.icon || (
                      <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "11px", fontWeight: 700, color: area.color }}>
                        {areaKey(area.name).slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{
                      fontFamily: "'Playfair Display', Georgia, serif",
                      fontSize: "14px", fontWeight: 700, color: INK,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      marginBottom: area.description ? "1px" : 0,
                    }}>
                      {area.name}
                    </p>
                    {area.description && (
                      <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "10px", color: INK_FAINT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {area.description}
                      </p>
                    )}
                  </div>
                </Link>

                {/* Key */}
                <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "11px", color: INK_FAINT, letterSpacing: "0.05em" }}>
                  {areaKey(area.name)}
                </span>

                {/* Category */}
                {area.category ? (
                  <span style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: "10px", fontWeight: 600, letterSpacing: "1px",
                    textTransform: "uppercase", color: INK_LIGHT,
                    border: `1px solid ${RULE_L}`, padding: "2px 7px",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    display: "inline-block",
                  }}>
                    {area.category}
                  </span>
                ) : (
                  <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "11px", color: INK_FAINT }}>—</span>
                )}

                {/* Health score */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "36px", height: "4px", background: RULE_L, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${score}%`, background: hColor, transition: "width 0.3s" }} />
                  </div>
                  <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "11px", color: hColor, fontVariantNumeric: "tabular-nums" }}>{score}</span>
                </div>

                {/* Task count */}
                <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <CheckSquare size={11} color={INK_FAINT} />
                  <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "12px", color: INK_LIGHT }}>{taskCount}</span>
                </div>

                {/* Created */}
                <span style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "11px", color: INK_FAINT }}>
                  {format(new Date(area.createdAt), "d MMM yy")}
                </span>

                {/* Actions */}
                <div style={{ position: "relative" }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === area._id ? null : area._id); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: INK_FAINT, display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  {menuOpenId === area._id && (
                    <div
                      style={{
                        position: "absolute", right: 0, top: "100%", zIndex: 50,
                        background: WHITE, border: `1px solid ${RULE_L}`,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        minWidth: "130px",
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          archiveArea({ id: area._id });
                          setMenuOpenId(null);
                        }}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", gap: "8px",
                          padding: "8px 14px", background: "none", border: "none",
                          cursor: "pointer", color: RED, textAlign: "left",
                          fontFamily: "'Inter', system-ui, sans-serif",
                          fontSize: "11px", fontWeight: 600,
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = `${RED}11`}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "none"}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Templates panel */}
        {showTemplates && (
          <div style={{ width: "280px", borderLeft: `1px solid ${RULE_L}`, background: WHITE, display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `1px solid ${RULE_L}` }}>
              <div>
                <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "16px", fontWeight: 700, color: INK }}>Templates</p>
                <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "10px", color: INK_FAINT, marginTop: "2px" }}>Pick a template to get started</p>
              </div>
              <button
                onClick={() => setShowTemplates(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: INK_FAINT }}
              >
                <X size={14} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setCreateOpen(true); setShowTemplates(false); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "flex-start", gap: "12px",
                    padding: "10px 20px", background: "none", border: "none", cursor: "pointer",
                    textAlign: "left", transition: "background 0.08s",
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = NEWSPRINT}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                >
                  <div style={{ width: "30px", height: "30px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", flexShrink: 0, backgroundColor: `${t.color}22` }}>
                    {t.icon}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "12px", fontWeight: 600, color: INK }}>{t.name}</p>
                    <p style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "10px", color: INK_FAINT, marginTop: "2px" }}>{t.description}</p>
                  </div>
                </button>
              ))}

              <div style={{ padding: "12px 20px", borderTop: `1px solid ${RULE_L}`, marginTop: "4px" }}>
                <button
                  onClick={() => { setCreateOpen(true); setShowTemplates(false); }}
                  style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "11px", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", color: RED, background: "none", border: "none", cursor: "pointer" }}
                >
                  + Create blank space
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <CreateAreaModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        userId={userId ?? ""}
      />
    </div>
  );
}
