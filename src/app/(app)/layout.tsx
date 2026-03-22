"use client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { redirect } from "next/navigation";
import Masthead from "@/components/layout/Masthead";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { userId, isLoaded, isSignedIn } = useCurrentUser();

  if (isLoaded && !isSignedIn) {
    redirect("/sign-in");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAF5" }}>
      <Masthead userId={userId ?? ""} />
      <main>{children}</main>
    </div>
  );
}
