"use client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { UserButton } from "@clerk/nextjs";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { user, userId } = useCurrentUser();
  const resetUserData = useMutation(api.admin.resetUserData);
  const seedDemoData  = useMutation(api.seed.seedDemoData);
  const router = useRouter();

  const [confirming,       setConfirming]       = useState(false);
  const [resetting,        setResetting]        = useState(false);
  const [done,             setDone]             = useState(false);
  const [seedingDemo,      setSeedingDemo]      = useState(false);
  const [demoConfirming,   setDemoConfirming]   = useState(false);
  const [demoDone,         setDemoDone]         = useState(false);

  async function handleReset() {
    if (!userId) return;
    setResetting(true);
    await resetUserData({ userId });
    setResetting(false);
    setConfirming(false);
    setDone(true);
  }

  async function handleSeedDemo() {
    if (!userId) return;
    setSeedingDemo(true);
    await seedDemoData({ userId, force: true });
    setSeedingDemo(false);
    setDemoConfirming(false);
    setDemoDone(true);
    setTimeout(() => router.push("/today"), 800);
  }

  return (
    <div className="p-8 max-w-2xl mx-auto" style={{ backgroundColor: "#FAFAF5", minHeight: "100%" }}>
      <div className="mb-8">
        {/* Kicker label */}
        <p className="font-ui text-[11px] tracking-[0.25em] uppercase text-[#999990] mb-2">
          Configuration
        </p>
        <h1
          className="text-[48px] font-bold uppercase leading-none text-[#0D0D0D] mb-1"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Settings
        </h1>
        <p className="font-ui text-sm text-[#555550] mt-2">
          Account and preferences
        </p>
      </div>

      {/* Account */}
      <section className="mb-8">
        <h2 className="font-ui text-[11px] tracking-[0.2em] uppercase text-[#999990] mb-3">
          Account
        </h2>
        <div className="border border-[#CCCCBC] p-4 bg-[#FFFFFF] flex items-center gap-4">
          <UserButton />
          <div>
            <p className="font-ui text-sm text-[#0D0D0D]">
              {user?.fullName ?? "User"}
            </p>
            <p className="font-ui text-xs text-[#555550]">
              {user?.emailAddresses[0]?.emailAddress}
            </p>
          </div>
        </div>
      </section>

      {/* System */}
      <section className="mb-8">
        <h2 className="font-ui text-[11px] tracking-[0.2em] uppercase text-[#999990] mb-3">
          System
        </h2>
        <div className="border border-[#CCCCBC] p-4 bg-[#FFFFFF]">
          <p className="font-ui text-[13px] text-[#0D0D0D] mb-1">
            Newspaper Editorial — Life OS
          </p>
          <p className="font-ui text-xs text-[#555550]">
            Editorial print design system · Inter + Playfair Display
          </p>
        </div>
      </section>

      {/* Demo Data */}
      <section className="mb-8">
        <h2 className="font-ui text-[11px] tracking-[0.2em] uppercase text-[#999990] mb-3">
          Demo Data
        </h2>
        <div className="border border-[#CCCCBC] p-4 bg-[#FFFFFF]">
          <p className="font-ui text-[13px] text-[#0D0D0D] mb-1">Reload showcase data</p>
          <p className="font-ui text-xs text-[#555550] mb-4">
            Replaces all your data with a curated demo set — streaks, goal progress, area health scores, and this week's wins. Redirects to Today when done.
          </p>

          {demoDone ? (
            <p className="font-ui text-[12px] text-[#3A7D44]">Demo data loaded — redirecting…</p>
          ) : demoConfirming ? (
            <div className="flex items-center gap-3">
              <button
                onClick={handleSeedDemo}
                disabled={seedingDemo}
                className="px-4 py-1.5 bg-[#0D0D0D] hover:bg-[#2A2A2A] font-ui text-[12px] text-white font-semibold transition-colors disabled:opacity-50"
              >
                {seedingDemo ? "Loading…" : "Yes, reload demo data"}
              </button>
              <button
                onClick={() => setDemoConfirming(false)}
                className="font-ui text-[12px] text-[#555550] hover:text-[#0D0D0D] transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDemoConfirming(true)}
              className="px-4 py-1.5 border border-[#0D0D0D] font-ui text-[12px] text-[#0D0D0D] hover:bg-[#0D0D0D] hover:text-white transition-colors"
            >
              Reload demo data
            </button>
          )}
        </div>
      </section>

      {/* Danger zone */}
      <section>
        <h2 className="font-ui text-[11px] tracking-[0.2em] uppercase text-[#999990] mb-3">
          Danger Zone
        </h2>
        <div className="border border-[#C41E3A] border-opacity-20 p-4 bg-[#FFFFFF]">
          <p className="font-ui text-[13px] text-[#0D0D0D] mb-1">Reset all data</p>
          <p className="font-ui text-xs text-[#555550] mb-4">
            Permanently deletes all your areas, goals, tasks, habits, and history. Cannot be undone.
          </p>

          {done ? (
            <p className="font-ui text-[12px] text-[#4CAF6B]">All data cleared. Start fresh!</p>
          ) : confirming ? (
            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                disabled={resetting}
                className="px-4 py-1.5 bg-[#C41E3A] hover:bg-[#A01830] font-ui text-[12px] text-white font-semibold transition-colors disabled:opacity-50"
              >
                {resetting ? "Clearing…" : "Yes, delete everything"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="font-ui text-[12px] text-[#555550] hover:text-[#0D0D0D] transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="px-4 py-1.5 border border-[#C41E3A] font-ui text-[12px] text-[#C41E3A] hover:bg-[#C41E3A] hover:text-white transition-colors"
            >
              Reset all data
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
