"use client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { redirect } from "next/navigation";
import Masthead from "@/components/layout/Masthead";
import { useIsMobile } from "@/hooks/useIsMobile";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId, isLoaded, isSignedIn } = useCurrentUser();
  const isMobile = useIsMobile();

  if (isLoaded && !isSignedIn) {
    redirect("/sign-in");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF5" }}>
      <Masthead userId={userId ?? ""} />
      {/* paddingBottom clears fixed bottom nav on mobile */}
      <main style={{ paddingBottom: isMobile ? "60px" : 0 }}>{children}</main>
    </div>
  );
}
