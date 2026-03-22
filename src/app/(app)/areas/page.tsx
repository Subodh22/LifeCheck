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
import { cn } from "@/lib/utils";
import CreateAreaModal from "@/components/CreateAreaModal";

const TEMPLATES = [
  { id: "work",          icon: "💼", name: "Work & Career",   description: "Projects and career goals",   color: "#4A9EE0" },
  { id: "health",        icon: "🏃", name: "Health & Fitness", description: "Workouts, habits, wellness", color: "#4CAF6B" },
  { id: "creative",      icon: "🎸", name: "Creative",         description: "Music, art, writing",        color: "#2563EB" },
  { id: "finance",       icon: "💰", name: "Finance",          description: "Budget and investments",     color: "#E8A838" },
  { id: "learning",      icon: "📚", name: "Learning",         description: "Courses and skills",         color: "#9B59B6" },
  { id: "travel",        icon: "✈️", name: "Travel",           description: "Trips and adventures",      color: "#E85538" },
  { id: "relationships", icon: "🤝", name: "Relationships",    description: "Family and friends",         color: "#E8538A" },
  { id: "home",          icon: "🏠", name: "Home & Life",      description: "Household and admin",        color: "#64748B" },
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

  const seedDemo  = useMutation(api.seed.seedDemoData);

  const [search,         setSearch]         = useState("");
  const [showTemplates,  setShowTemplates]  = useState(false);
  const [createOpen,     setCreateOpen]     = useState(false);
  const [starredSet,     setStarredSet]     = useState<Set<string>>(new Set());
  const [seeding,        setSeeding]        = useState(false);

  // Redirect new users to onboarding
  useEffect(() => {
    if (areas !== undefined && areas.length === 0 && userId) {
      const onboarded = localStorage.getItem("onboarded");
      if (!onboarded) {
        router.replace("/onboarding");
      }
    }
  }, [areas, userId, router]);

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
    <div className="h-full flex flex-col bg-[#FFFFFF]">
      {/* Page header */}
      <div className="px-7 py-5 border-b border-[#E2E8F0] shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-ui text-[22px] font-semibold text-[#0F172A]">Spaces</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTemplates((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 border rounded font-ui text-[13px] transition-colors",
                showTemplates
                  ? "border-[#2563EB] text-[#2563EB] bg-[#2563EB10]"
                  : "border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1]"
              )}
            >
              <LayoutGrid size={13} />
              Templates
            </button>
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4A9EE0] rounded font-ui text-[13px] font-medium text-white hover:bg-[#5AAFF0] transition-colors"
            >
              <Plus size={13} />
              Create space
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 bg-[#FFFFFF] border border-[#E2E8F0] rounded px-3 py-2 w-80 mb-3">
          <Search size={13} className="text-[#94A3B8] shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search spaces"
            className="bg-transparent font-ui text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] outline-none w-full"
          />
        </div>

        {/* Filter row */}
        <div className="relative inline-block">
          <select className="appearance-none bg-[#FFFFFF] border border-[#E2E8F0] rounded px-3 py-1.5 font-ui text-[12px] text-[#64748B] outline-none cursor-pointer pr-7">
            <option>Filter by category</option>
            {[...new Set(areas.map((a) => a.category).filter(Boolean))].map((cat) => (
              <option key={cat}>{cat}</option>
            ))}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
        </div>
      </div>

      <div className={cn("flex-1 flex overflow-hidden")}>
        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {/* Table header */}
          <div className="grid grid-cols-[32px_1fr_80px_120px_80px_80px_80px_40px] gap-4 px-7 py-2 border-b border-[#E2E8F0] bg-[#FFFFFF] sticky top-0 z-10">
            <div />
            <button className="flex items-center gap-1 font-ui text-[11px] tracking-[0.12em] uppercase text-[#64748B] hover:text-[#475569] transition-colors text-left">
              Name <ChevronDown size={10} className="ml-0.5" />
            </button>
            <span className="font-ui text-[11px] tracking-[0.12em] uppercase text-[#94A3B8]">Key</span>
            <span className="font-ui text-[11px] tracking-[0.12em] uppercase text-[#94A3B8]">Category</span>
            <span className="font-ui text-[11px] tracking-[0.12em] uppercase text-[#94A3B8]">Health</span>
            <span className="font-ui text-[11px] tracking-[0.12em] uppercase text-[#94A3B8]">Tasks</span>
            <span className="font-ui text-[11px] tracking-[0.12em] uppercase text-[#94A3B8]">Created</span>
            <div />
          </div>

          {filtered.length === 0 && (
            <div className="px-7 py-20 text-center">
              <LayoutGrid size={28} className="text-[#94A3B8] mx-auto mb-4" />
              <p className="font-ui text-[15px] text-[#64748B] mb-1">
                {search ? "No spaces match your search." : "No spaces yet."}
              </p>
              {!search && (
                <>
                  <p className="font-ui text-[12px] text-[#94A3B8] mb-6">
                    Create your first space or load demo data to explore the app.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={() => setCreateOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-[#4A9EE0] rounded font-ui text-[13px] font-medium text-white hover:bg-[#5AAFF0] transition-colors"
                    >
                      <Plus size={13} />
                      Create first space
                    </button>
                    <button
                      onClick={handleSeed}
                      disabled={seeding}
                      className="flex items-center gap-2 px-4 py-2 border border-[#E2E8F0] rounded font-ui text-[13px] text-[#64748B] hover:text-[#0F172A] hover:border-[#CBD5E1] disabled:opacity-40 transition-colors"
                    >
                      <Sparkles size={13} />
                      {seeding ? "Loading demo…" : "Load demo data"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {filtered.map((area) => {
            const score      = (healthScores as Record<string, number>)[area._id] ?? 50;
            const hColor     = healthColor(score);
            const taskCount  = taskCountByArea[area._id] ?? 0;
            const isStarred  = starredSet.has(area._id);

            return (
              <div
                key={area._id}
                className="grid grid-cols-[32px_1fr_80px_120px_80px_80px_80px_40px] gap-4 px-7 py-3 border-b border-[#E2E8F0] hover:bg-[#FFFFFF] transition-colors items-center group"
              >
                {/* Star */}
                <button
                  onClick={() => toggleStar(area._id)}
                  className={cn(
                    "flex items-center justify-center transition-colors",
                    isStarred ? "text-[#2563EB]" : "text-[#E2E8F0] hover:text-[#94A3B8]"
                  )}
                >
                  <Star size={14} fill={isStarred ? "currentColor" : "none"} />
                </button>

                {/* Name */}
                <Link href={`/area/${area._id}`} className="flex items-center gap-3 min-w-0 group/link">
                  <div
                    className="w-7 h-7 rounded flex items-center justify-center shrink-0 text-[15px]"
                    style={{ backgroundColor: `${area.color}22` }}
                  >
                    {area.icon || (
                      <span className="font-ui text-[11px] font-bold" style={{ color: area.color }}>
                        {areaKey(area.name).slice(0, 2)}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-ui text-[13px] font-medium text-[#4A9EE0] group-hover/link:underline truncate">
                      {area.name}
                    </p>
                    {area.description && (
                      <p className="font-ui text-[11px] text-[#64748B] truncate">{area.description}</p>
                    )}
                  </div>
                </Link>

                {/* Key */}
                <span className="font-ui text-[12px] text-[#64748B] tracking-[0.05em]">
                  {areaKey(area.name)}
                </span>

                {/* Category */}
                {area.category ? (
                  <span className="font-ui text-[11px] text-[#64748B] bg-[#F1F5F9] border border-[#E2E8F0] px-2 py-0.5 rounded truncate">
                    {area.category}
                  </span>
                ) : (
                  <span className="font-ui text-[11px] text-[#94A3B8]">—</span>
                )}

                {/* Health score */}
                <div className="flex items-center gap-2">
                  <div className="w-10 h-1.5 bg-[#E2E8F0] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${score}%`, backgroundColor: hColor }}
                    />
                  </div>
                  <span className="font-ui text-[11px] tabular-nums" style={{ color: hColor }}>{score}</span>
                </div>

                {/* Task count */}
                <div className="flex items-center gap-1.5">
                  <CheckSquare size={12} className="text-[#94A3B8]" />
                  <span className="font-ui text-[12px] text-[#64748B]">{taskCount}</span>
                </div>

                {/* Created */}
                <span className="font-ui text-[11px] text-[#94A3B8]">
                  {format(new Date(area.createdAt), "d MMM yy")}
                </span>

                {/* Actions */}
                <button className="opacity-0 group-hover:opacity-100 flex items-center justify-center text-[#64748B] hover:text-[#0F172A] transition-all">
                  <MoreHorizontal size={14} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Templates panel */}
        {showTemplates && (
          <div className="w-[300px] border-l border-[#E2E8F0] bg-[#FFFFFF] flex flex-col shrink-0">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
              <div>
                <p className="font-ui text-[13px] font-medium text-[#0F172A]">Templates</p>
                <p className="font-ui text-[11px] text-[#64748B] mt-0.5">Pick a template for your next space</p>
              </div>
              <button
                onClick={() => setShowTemplates(false)}
                className="text-[#64748B] hover:text-[#0F172A] transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setCreateOpen(true); setShowTemplates(false); }}
                  className="w-full flex items-start gap-3 px-5 py-3 hover:bg-[#FFFFFF] transition-colors text-left"
                >
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center text-[16px] shrink-0"
                    style={{ backgroundColor: `${t.color}22` }}
                  >
                    {t.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="font-ui text-[13px] text-[#0F172A]">{t.name}</p>
                    <p className="font-ui text-[11px] text-[#64748B] mt-0.5">{t.description}</p>
                  </div>
                </button>
              ))}

              <div className="px-5 pt-3 border-t border-[#E2E8F0] mt-1">
                <button
                  onClick={() => { setCreateOpen(true); setShowTemplates(false); }}
                  className="font-ui text-[12px] text-[#4A9EE0] hover:text-[#5AAFF0] transition-colors"
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
