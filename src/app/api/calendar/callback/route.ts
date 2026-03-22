// GET /api/calendar/callback — Google OAuth callback, stores refresh token in Convex
import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code    = searchParams.get("code");
  const clerkId = searchParams.get("state");
  const error   = searchParams.get("error");

  // Use x-forwarded-host if available (Vercel sets this to the public domain)
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;

  if (error || !code || !clerkId) {
    return NextResponse.redirect(`${origin}/schedule?gcal=error`);
  }

  // redirect_uri must exactly match what was sent in the auth request
  const redirectUri = `${origin}/api/calendar/callback`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri:  redirectUri,
      grant_type:    "authorization_code",
    }),
  });

  if (!tokenRes.ok) {
    console.error("[gcal callback] token exchange failed", await tokenRes.text());
    return NextResponse.redirect(`${origin}/schedule?gcal=error`);
  }

  const tokens = await tokenRes.json();
  const refreshToken = tokens.refresh_token as string;

  if (!refreshToken) {
    // No refresh token — user already connected; treat as success
    return NextResponse.redirect(`${origin}/schedule?gcal=connected`);
  }

  await convex.mutation(api.users.setGcalToken, {
    clerkId,
    gcalRefreshToken: refreshToken,
    gcalConnected:    true,
  });

  return NextResponse.redirect(`${origin}/schedule?gcal=connected`);
}
