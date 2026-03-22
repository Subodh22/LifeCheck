"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { healthColor } from "@/constants/colors";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ListTodo,
  Target,
  CalendarDays,
  Plus,
  Settings,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import CreateTaskModal from "@/components/CreateTaskModal";
import CreateAreaModal from "@/components/CreateAreaModal";

// GTD-informed nav: Today (do) · Backlog (capture) · Goals (plan) · Reviews (reflect)
// Areas are contexts shown in the sidebar — not a nav destination (PARA method)
// Routines = full 5-cadence management (daily/weekly/monthly/quarterly/yearly)
// Daily habit toggling surfaces on Today (Fogg: prompts at the daily anchor point)
const NAV_ITEMS = [
  { href: "/today",    label: "Today",    icon: LayoutDashboard },
  { href: "/backlog",  label: "Backlog",  icon: ListTodo },
  { href: "/goals",    label: "Goals",    icon: Target },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
];

export default function Sidebar({ userId }: { userId: string }) {
  const pathname = usePathname();
  const areas       = useQuery(api.areas.list,              userId ? { userId } : "skip") ?? [];
  const healthScores = useQuery(api.healthScores.getByUser, userId ? { userId } : "skip") ?? {};

  const [areasOpen,   setAreasOpen]   = useState(true);
  const [createOpen,  setCreateOpen]  = useState(false);
  const [areaOpen,    setAreaOpen]    = useState(false);

  return (
    <>
      <aside className="w-[220px] h-full border-r border-[#E3E3E1] bg-[#F7F7F5] flex flex-col shrink-0 select-none">
        {/* Logo */}
        <div className="px-4 h-11 border-b border-[#E3E3E1] flex items-center gap-2.5 shrink-0">
          <div className="w-5 h-5 rounded bg-[#2383E2] flex items-center justify-center shrink-0">
            <span className="font-ui font-medium text-[11px] text-[#FFFFFF]">LO</span>
          </div>
          <span className="font-ui text-[13px] font-medium text-[#191919]">Life OS</span>
        </div>

        {/* Create button */}
        <div className="px-3 py-2.5 border-b border-[#E3E3E1] shrink-0">
          <button
            onClick={() => setCreateOpen(true)}
            className="w-full flex items-center justify-center gap-2 h-7 rounded border border-[#2383E2] text-[#2383E2] font-ui text-[12px] hover:bg-[rgba(35,131,226,0.10)] transition-colors"
          >
            <Plus size={12} />
            Create
          </button>
        </div>

        {/* Nav */}
        <nav className="px-2 py-1.5 shrink-0">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-2 py-1.5 rounded text-[13px] font-ui transition-colors",
                pathname === href
                  ? "bg-[#E8E8E6] text-[#191919]"
                  : "text-[#9B9A97] hover:text-[#6F6E69] hover:bg-[#F0F0EE]"
              )}
            >
              <Icon size={14} strokeWidth={1.5} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-[#E3E3E1] mx-3 mt-1" />

        {/* Areas */}
        <div className="flex-1 overflow-y-auto">
          <button
            onClick={() => setAreasOpen((v) => !v)}
            className="flex items-center gap-1.5 px-4 py-2 w-full text-left"
          >
            <ChevronDown
              size={11}
              className={cn("text-[#C4C4C2] transition-transform", !areasOpen && "-rotate-90")}
            />
            <span className="text-[#C4C4C2] text-[11px] font-ui tracking-[0.12em] uppercase font-medium">
              Areas
            </span>
          </button>

          {areasOpen && (
            <div className="px-2 pb-1 space-y-0.5">
              {areas.map((area) => {
                const score    = (healthScores as Record<string, number>)[area._id] ?? 50;
                const isActive = pathname.startsWith(`/area/${area._id}`);
                return (
                  <Link
                    key={area._id}
                    href={`/area/${area._id}`}
                    className={cn(
                      "flex items-center gap-2.5 px-2 py-1.5 rounded text-[13px] font-ui transition-colors group",
                      isActive
                        ? "bg-[#E8E8E6] text-[#191919]"
                        : "text-[#9B9A97] hover:text-[#6F6E69] hover:bg-[#F0F0EE]"
                    )}
                  >
                    {area.icon ? (
                      <span className="text-[13px] shrink-0 leading-none">{area.icon}</span>
                    ) : (
                      <span
                        className="w-2 h-2 rounded-sm shrink-0"
                        style={{ backgroundColor: area.color }}
                      />
                    )}
                    <span className="flex-1 truncate">{area.name}</span>
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0 opacity-70"
                      style={{ backgroundColor: healthColor(score) }}
                      title={`Health: ${score}`}
                    />
                  </Link>
                );
              })}
              <button
                onClick={() => setAreaOpen(true)}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded text-[12px] font-ui text-[#C4C4C2] hover:text-[#9B9A97] w-full transition-colors"
              >
                <Plus size={12} />
                Add area
              </button>
            </div>
          )}
        </div>

        {/* Bottom */}
        <div className="border-t border-[#E3E3E1] px-2 py-1.5 shrink-0">
          <Link
            href="/settings"
            className="flex items-center gap-2.5 px-2 py-1.5 rounded text-[13px] font-ui text-[#9B9A97] hover:text-[#6F6E69] hover:bg-[#F0F0EE] transition-colors"
          >
            <Settings size={14} strokeWidth={1.5} />
            Settings
          </Link>
        </div>
      </aside>

      <CreateTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        userId={userId}
        areas={areas}
      />

      <CreateAreaModal
        open={areaOpen}
        onClose={() => setAreaOpen(false)}
        userId={userId}
      />
    </>
  );
}
