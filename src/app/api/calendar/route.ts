// GET /api/calendar — initiate Google OAuth
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Google Calendar not configured" }, { status: 500 });
  }

  // Use x-forwarded-host if available (Vercel sets this to the public domain),
  // falling back to the host header, then request.nextUrl.origin.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${host}`;
  const redirectUri = `${origin}/api/calendar/callback`;

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope:         SCOPES,
    access_type:   "offline",
    prompt:        "consent",
    state:         userId,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
