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

const NAV_ITEMS = [
  { href: "/today",    label: "Today",    icon: LayoutDashboard },
  { href: "/backlog",  label: "Backlog",  icon: ListTodo },
  { href: "/goals",    label: "Goals",    icon: Target },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
];

export default function Sidebar({ userId }: { userId: string }) {
  const pathname = usePathname();
  const areas        = useQuery(api.areas.list,              userId ? { userId } : "skip") ?? [];
  const healthScores = useQuery(api.healthScores.getByUser,  userId ? { userId } : "skip") ?? {};

  const [areasOpen,  setAreasOpen]  = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [areaOpen,   setAreaOpen]   = useState(false);

  return (
    <>
      <aside className="w-[220px] h-full bg-[#18181B] flex flex-col shrink-0 select-none">

        {/* Logo */}
        <div className="px-4 h-12 flex items-center gap-2.5 shrink-0">
          <div className="w-6 h-6 rounded-md bg-[#8B5CF6] flex items-center justify-center shrink-0">
            <span className="font-ui font-bold text-[10px] text-white tracking-tight">LO</span>
          </div>
          <span className="font-ui text-[14px] font-semibold text-[#FAFAFA]">Life OS</span>
        </div>

        {/* Create button */}
        <div className="px-3 pb-3 shrink-0">
          <button
            onClick={() => setCreateOpen(true)}
            className="w-full flex items-center gap-2 h-8 px-3 rounded-md bg-[#27272A] text-[#A1A1AA] font-ui text-[13px] hover:bg-[#3F3F46] hover:text-[#D4D4D8] transition-colors"
          >
            <Plus size={13} />
            New task
          </button>
        </div>

        {/* Nav */}
        <nav className="px-2 space-y-0.5 shrink-0">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-ui transition-colors",
                pathname === href
                  ? "bg-[#3F3F46] text-[#FAFAFA]"
                  : "text-[#71717A] hover:bg-[#27272A] hover:text-[#D4D4D8]"
              )}
            >
              <Icon size={14} strokeWidth={1.5} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-[#27272A] mx-3 my-2 shrink-0" />

        {/* Areas */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <button
            onClick={() => setAreasOpen((v) => !v)}
            className="flex items-center gap-1.5 px-4 py-1.5 w-full text-left"
          >
            <ChevronDown
              size={10}
              className={cn("text-[#52525B] transition-transform", !areasOpen && "-rotate-90")}
            />
            <span className="text-[#52525B] text-[10px] font-ui tracking-[0.14em] uppercase font-semibold">
              Areas
            </span>
          </button>

          {areasOpen && (
            <div className="px-2 pb-2 space-y-0.5">
              {areas.map((area) => {
                const score    = (healthScores as Record<string, number>)[area._id] ?? 50;
                const isActive = pathname.startsWith(`/area/${area._id}`);
                return (
                  <Link
                    key={area._id}
                    href={`/area/${area._id}`}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-ui transition-colors",
                      isActive
                        ? "bg-[#3F3F46] text-[#FAFAFA]"
                        : "text-[#71717A] hover:bg-[#27272A] hover:text-[#D4D4D8]"
                    )}
                  >
                    {area.icon ? (
                      <span className="text-[13px] shrink-0 leading-none">{area.icon}</span>
                    ) : (
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: area.color }} />
                    )}
                    <span className="flex-1 truncate">{area.name}</span>
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: healthColor(score) }}
                      title={`Health: ${score}`}
                    />
                  </Link>
                );
              })}
              <button
                onClick={() => setAreaOpen(true)}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[12px] font-ui text-[#52525B] hover:text-[#71717A] hover:bg-[#27272A] w-full transition-colors"
              >
                <Plus size={12} />
                Add area
              </button>
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="border-t border-[#27272A] px-2 py-2 shrink-0">
          <Link
            href="/settings"
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-ui text-[#71717A] hover:bg-[#27272A] hover:text-[#D4D4D8] transition-colors"
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
