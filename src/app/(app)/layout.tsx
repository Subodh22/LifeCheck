"use client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId, isLoaded, isSignedIn } = useCurrentUser();

  if (isLoaded && !isSignedIn) {
    redirect("/sign-in");
  }

  return (
    <div className="flex h-screen bg-[#F7F8FA] overflow-hidden">
      <Sidebar userId={userId ?? ""} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
