"use client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { UserButton } from "@clerk/nextjs";

export default function SettingsPage() {
  const { user } = useCurrentUser();

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="font-display text-3xl italic text-[#F2EEE8] mb-1">
          Settings
        </h1>
        <p className="text-[#6B6760] font-ui text-sm">
          Account and preferences
        </p>
      </div>

      {/* Account */}
      <section className="mb-8">
        <h2 className="text-[#6B6760] font-ui text-[11px] tracking-[0.2em] uppercase mb-3">
          Account
        </h2>
        <div className="border border-[#2A2A2E] rounded p-4 bg-[#111113] flex items-center gap-4">
          <UserButton />
          <div>
            <p className="font-ui text-sm text-[#F2EEE8]">
              {user?.fullName ?? "User"}
            </p>
            <p className="font-ui text-xs text-[#6B6760]">
              {user?.emailAddresses[0]?.emailAddress}
            </p>
          </div>
        </div>
      </section>

      {/* Design system note */}
      <section>
        <h2 className="text-[#6B6760] font-ui text-[11px] tracking-[0.2em] uppercase mb-3">
          System
        </h2>
        <div className="border border-[#2A2A2E] rounded p-4 bg-[#111113]">
          <p className="font-ui text-[13px] text-[#F2EEE8] mb-1">
            Pulse Dark — Life OS
          </p>
          <p className="font-ui text-xs text-[#6B6760]">
            Dark luxury design system · Cormorant Garamond + Outfit
          </p>
        </div>
      </section>
    </div>
  );
}
