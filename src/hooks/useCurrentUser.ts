"use client";
import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect } from "react";

export function useCurrentUser() {
  const { user, isLoaded, isSignedIn } = useUser();
  const upsertUser = useMutation(api.users.upsertUser);

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      upsertUser({
        clerkId: user.id,
        email: user.emailAddresses[0]?.emailAddress ?? "",
        name: user.fullName ?? undefined,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
    }
  }, [isLoaded, isSignedIn, user, upsertUser]);

  return {
    userId: user?.id ?? null,
    user,
    isLoaded,
    isSignedIn,
  };
}
