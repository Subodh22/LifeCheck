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
      <aside
        className="w-[220px] h-full flex flex-col shrink-0 select-none"
        style={{ background: "#F5F5F7", borderRight: "1px solid #E5E5EA" }}
      >
        {/* Logo */}
        <div className="px-4 h-14 flex items-center gap-2 shrink-0">
          <div
            className="w-5 h-5 rounded flex items-center justify-center shrink-0"
            style={{ background: "#1C72C4" }}
          >
            <span style={{ color: "#fff", fontSize: "9px", fontWeight: 700, letterSpacing: "-0.02em" }}>LO</span>
          </div>
          <span style={{ fontSize: "14px", fontWeight: 600, color: "#1C1C1E", letterSpacing: "-0.01em" }}>
            Life OS
          </span>
        </div>

        {/* New task button */}
        <div className="px-3 pb-3 shrink-0">
          <button
            onClick={() => setCreateOpen(true)}
            className="w-full flex items-center gap-2 h-8 px-3 rounded transition-colors"
            style={{ background: "#EBEBF0", color: "#6B6B6B", fontSize: "13px" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#E0E0E5"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#EBEBF0"}
          >
            <Plus size={13} strokeWidth={2} />
            New task
          </button>
        </div>

        {/* Nav */}
        <nav className="px-2 flex flex-col gap-px shrink-0">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 px-3 h-9 rounded transition-colors"
                style={active
                  ? { background: "#E8F0FA", color: "#1C72C4", fontSize: "13px", fontWeight: 500 }
                  : { color: "#6B6B6B", fontSize: "13px", fontWeight: 400 }
                }
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "#EBEBF0";
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "";
                }}
              >
                <Icon
                  size={14}
                  strokeWidth={active ? 2 : 1.5}
                  style={{ color: active ? "#1C72C4" : "#8E8E93" }}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mx-3 my-3 shrink-0" style={{ borderTop: "1px solid #E5E5EA" }} />

        {/* Areas */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-5 mb-1">
            <span style={{ fontSize: "10px", fontWeight: 600, color: "#AEAEB2", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Areas
            </span>
          </div>

          <div className="px-2 flex flex-col gap-px">
            {areas.map((area) => {
              const score    = (healthScores as Record<string, number>)[area._id] ?? 50;
              const isActive = pathname.startsWith(`/area/${area._id}`);
              return (
                <Link
                  key={area._id}
                  href={`/area/${area._id}`}
                  className="flex items-center gap-2.5 px-3 h-9 rounded transition-colors"
                  style={isActive
                    ? { background: "#E8F0FA", color: "#1C72C4", fontSize: "13px", fontWeight: 500 }
                    : { color: "#6B6B6B", fontSize: "13px", fontWeight: 400 }
                  }
                  onMouseEnter={e => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = "#EBEBF0";
                  }}
                  onMouseLeave={e => {
                    if (!isActive) (e.currentTarget as HTMLElement).style.background = "";
                  }}
                >
                  {area.icon ? (
                    <span style={{ fontSize: "13px", lineHeight: 1, flexShrink: 0 }}>{area.icon}</span>
                  ) : (
                    <span
                      className="shrink-0"
                      style={{ width: "8px", height: "8px", borderRadius: "50%", background: area.color }}
                    />
                  )}
                  <span className="flex-1 truncate">{area.name}</span>
                  <span
                    style={{ width: "6px", height: "6px", borderRadius: "50%", background: healthColor(score), flexShrink: 0 }}
                    title={`Health: ${score}`}
                  />
                </Link>
              );
            })}

            <button
              onClick={() => setAreaOpen(true)}
              className="flex items-center gap-2.5 px-3 h-9 rounded w-full transition-colors"
              style={{ color: "#AEAEB2", fontSize: "13px", fontWeight: 400 }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "#EBEBF0";
                (e.currentTarget as HTMLElement).style.color = "#6B6B6B";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "";
                (e.currentTarget as HTMLElement).style.color = "#AEAEB2";
              }}
            >
              <Plus size={13} strokeWidth={1.5} />
              Add area
            </button>
          </div>
        </div>

        {/* Settings */}
        <div className="px-2 py-2 shrink-0" style={{ borderTop: "1px solid #E5E5EA" }}>
          <Link
            href="/settings"
            className="flex items-center gap-2.5 px-3 h-9 rounded transition-colors"
            style={{ color: "#6B6B6B", fontSize: "13px" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#EBEBF0"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ""}
          >
            <Settings size={14} strokeWidth={1.5} style={{ color: "#8E8E93" }} />
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
