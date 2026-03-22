"use client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { UserButton } from "@clerk/nextjs";
import { useState } from "react";

export default function SettingsPage() {
  const { user, userId } = useCurrentUser();
  const resetUserData = useMutation(api.admin.resetUserData);

  const [confirming, setConfirming] = useState(false);
  const [resetting,  setResetting]  = useState(false);
  const [done,       setDone]       = useState(false);

  async function handleReset() {
    if (!userId) return;
    setResetting(true);
    await resetUserData({ userId });
    setResetting(false);
    setConfirming(false);
    setDone(true);
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-semibold text-[#111827] mb-1">
          Settings
        </h1>
        <p className="text-[#6B7280] font-ui text-sm">
          Account and preferences
        </p>
      </div>

      {/* Account */}
      <section className="mb-8">
        <h2 className="text-[#6B7280] font-ui text-[11px] tracking-[0.2em] uppercase mb-3">
          Account
        </h2>
        <div className="border border-[#E2E8F0] rounded p-4 bg-[#FFFFFF] flex items-center gap-4">
          <UserButton />
          <div>
            <p className="font-ui text-sm text-[#111827]">
              {user?.fullName ?? "User"}
            </p>
            <p className="font-ui text-xs text-[#6B7280]">
              {user?.emailAddresses[0]?.emailAddress}
            </p>
          </div>
        </div>
      </section>

      {/* System */}
      <section className="mb-8">
        <h2 className="text-[#6B7280] font-ui text-[11px] tracking-[0.2em] uppercase mb-3">
          System
        </h2>
        <div className="border border-[#E2E8F0] rounded p-4 bg-[#FFFFFF]">
          <p className="font-ui text-[13px] text-[#111827] mb-1">
            Notion-style Light — Life OS
          </p>
          <p className="font-ui text-xs text-[#6B7280]">
            Clean light design system · Inter + Outfit
          </p>
        </div>
      </section>

      {/* Danger zone */}
      <section>
        <h2 className="text-[#6B7280] font-ui text-[11px] tracking-[0.2em] uppercase mb-3">
          Danger Zone
        </h2>
        <div className="border border-[#E8553820] rounded p-4 bg-[#FFFFFF]">
          <p className="font-ui text-[13px] text-[#111827] mb-1">Reset all data</p>
          <p className="font-ui text-xs text-[#6B7280] mb-4">
            Permanently deletes all your areas, goals, tasks, habits, and history. Cannot be undone.
          </p>

          {done ? (
            <p className="font-ui text-[12px] text-[#4CAF6B]">All data cleared. Start fresh!</p>
          ) : confirming ? (
            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                disabled={resetting}
                className="px-4 py-1.5 rounded bg-[#E85538] hover:bg-[#D04428] font-ui text-[12px] text-white font-semibold transition-colors disabled:opacity-50"
              >
                {resetting ? "Clearing…" : "Yes, delete everything"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="font-ui text-[12px] text-[#6B7280] hover:text-[#111827] transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="px-4 py-1.5 rounded border border-[#E8553840] font-ui text-[12px] text-[#E85538] hover:bg-[#E8553810] transition-colors"
            >
              Reset all data
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
