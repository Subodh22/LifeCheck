// GET /api/calendar/callback — Google OAuth callback, stores refresh token in Convex
import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code    = searchParams.get("code");
  const clerkId = searchParams.get("state"); // passed via state param
  const error   = searchParams.get("error");

  if (error || !code || !clerkId) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/schedule?gcal=error`
    );
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/callback`,
      grant_type:    "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/schedule?gcal=error`
    );
  }

  const tokens = await tokenRes.json();
  const refreshToken = tokens.refresh_token as string;

  if (!refreshToken) {
    // No refresh token — user may have already connected; redirect to success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/schedule?gcal=connected`
    );
  }

  // Store refresh token in Convex
  await convex.mutation(api.users.setGcalToken, {
    clerkId,
    gcalRefreshToken: refreshToken,
    gcalConnected:    true,
  });

  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL}/schedule?gcal=connected`
  );
}
