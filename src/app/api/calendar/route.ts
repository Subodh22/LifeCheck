// GET /api/calendar — initiate Google OAuth
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({ error: "GOOGLE_CLIENT_ID not set" }, { status: 500 });
    }

    const origin      = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? request.nextUrl.origin;
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
  } catch (err) {
    console.error("[/api/calendar] error:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
