"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { format } from "date-fns";
import { useState } from "react";
import { Settings, Flame } from "lucide-react";
import CreateTaskModal from "@/components/CreateTaskModal";

const NAV_ITEMS = [
  { href: "/today",    label: "Today"    },
  { href: "/backlog",  label: "Backlog"  },
  { href: "/goals",    label: "Goals"    },
  { href: "/areas",    label: "Areas"    },
  { href: "/schedule", label: "Schedule" },
];

const INK       = "#0D0D0D";
const INK_MID   = "#2A2A2A";
const INK_LIGHT = "#555550";
const INK_FAINT = "#999990";
const RED       = "#C41E3A";
const RULE_L    = "#CCCCBC";

export default function Masthead({ userId }: { userId: string }) {
  const pathname  = usePathname();
  const areas     = useQuery(api.areas.list, userId ? { userId } : "skip") ?? [];
  const streakData = useQuery(api.tasks.getStreak, userId ? { userId } : "skip");
  const [open, setOpen] = useState(false);

  const streak         = streakData?.streak ?? 0;
  const completedToday = streakData?.completedToday ?? false;

  const todayStr  = format(new Date(), "EEEE, MMMM d, yyyy");
  const weekOfYear = format(new Date(), "w");
  const quarter   = `Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;

  return (
    <>
      <header style={{
        background: "#FFFFFF",
        borderBottom: `1px solid ${INK}`,
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        {/* Main masthead row */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 64px",
          height: "56px",
          borderBottom: `1px solid ${RULE_L}`,
          position: "relative",
        }}>
          {/* Logo */}
          <div style={{
            fontFamily: "'Playfair Display SC', Georgia, serif",
            fontWeight: 700,
            fontSize: "20px",
            letterSpacing: "1px",
            color: INK,
            textTransform: "uppercase",
            lineHeight: 1,
            userSelect: "none",
          }}>
            Life <span style={{ color: RED }}>OS</span>
          </div>

          {/* Center nav */}
          <nav style={{
            display: "flex",
            alignItems: "center",
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "11px",
            fontWeight: 600,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: INK_MID,
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
          }}>
            {NAV_ITEMS.map((item, i) => {
              const active = pathname === item.href || (item.href === "/today" && pathname === "/");
              return (
                <div key={item.href} style={{ display: "flex", alignItems: "center" }}>
                  <Link
                    href={item.href}
                    style={{
                      textDecoration: "none",
                      color: active ? RED : "inherit",
                      padding: "0 18px",
                      transition: "color 0.15s",
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = RED; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "inherit"; }}
                  >
                    {item.label}
                  </Link>
                  {i < NAV_ITEMS.length - 1 && (
                    <span style={{ color: RULE_L, fontWeight: 300, fontSize: "14px", userSelect: "none" }}>|</span>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Right: date + settings + new task */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <span style={{
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: "11px",
              color: INK_LIGHT,
              letterSpacing: "0.5px",
            }}>
              {todayStr}
            </span>
            {/* Streak */}
            {streak > 0 && (
              <div
                title={completedToday ? `${streak}-day streak` : `${streak}-day streak — complete a task to keep it alive!`}
                style={{
                  display: "flex", alignItems: "center", gap: "4px",
                  padding: "4px 8px",
                  border: `1px solid ${completedToday ? "#B08A4E" : RED}`,
                  background: completedToday ? "rgba(176,138,78,0.08)" : "rgba(196,30,58,0.06)",
                }}
              >
                <Flame
                  size={12}
                  color={completedToday ? "#B08A4E" : RED}
                  fill={completedToday ? "#B08A4E" : "none"}
                />
                <span style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize: "11px", fontWeight: 700,
                  color: completedToday ? "#B08A4E" : RED,
                  letterSpacing: "0.5px",
                }}>
                  {streak}
                </span>
                {!completedToday && (
                  <span style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: "9px", color: RED, letterSpacing: "0.5px",
                  }}>
                    ends tonight
                  </span>
                )}
              </div>
            )}

            <Link
              href="/settings"
              style={{
                color: pathname === "/settings" ? RED : INK_FAINT,
                display: "flex", alignItems: "center",
                transition: "color 0.15s",
              }}
              onMouseEnter={e => { if (pathname !== "/settings") (e.currentTarget as HTMLElement).style.color = INK; }}
              onMouseLeave={e => { if (pathname !== "/settings") (e.currentTarget as HTMLElement).style.color = INK_FAINT; }}
            >
              <Settings size={15} />
            </Link>
            <button
              onClick={() => setOpen(true)}
              style={{
                fontFamily: "'Inter', system-ui, sans-serif",
                fontSize: "11px",
                fontWeight: 600,
                letterSpacing: "1px",
                textTransform: "uppercase",
                color: "#FFFFFF",
                background: INK,
                border: "none",
                cursor: "pointer",
                padding: "7px 14px",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = RED}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = INK}
            >
              + New Task
            </button>
          </div>
        </div>

        {/* Edition bar */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "5px 64px",
          background: "#FFFFFF",
        }}>
          <span style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "10px",
            color: INK_FAINT,
            letterSpacing: "0.5px",
          }}>
            Personal Edition &nbsp;·&nbsp; Est. 2024
          </span>
          <span style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "10px",
            color: INK_FAINT,
            letterSpacing: "0.5px",
          }}>
            Week {weekOfYear} &nbsp;·&nbsp; {quarter} {new Date().getFullYear()}
          </span>
        </div>
      </header>

      <CreateTaskModal
        open={open}
        onClose={() => setOpen(false)}
        userId={userId}
        areas={areas}
      />
    </>
  );
}
