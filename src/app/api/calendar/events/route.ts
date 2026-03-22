// POST /api/calendar/events — create, update, delete GCal events
// GET  /api/calendar/events?weekStart=&weekEnd= — list events for a week
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// ── Token helpers ─────────────────────────────────────────────────────────────

async function getAccessToken(refreshToken: string): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type:    "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token as string ?? null;
}

async function getUser(clerkId: string) {
  return convex.query(api.users.getByClerkId, { clerkId });
}

// ── GET — list events for a week ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const weekStart = searchParams.get("weekStart");
    const weekEnd   = searchParams.get("weekEnd");

    const user = await getUser(userId);
    if (!user?.gcalRefreshToken) {
      return NextResponse.json({ events: [], connected: false });
    }

    const accessToken = await getAccessToken(user.gcalRefreshToken);
    if (!accessToken) return NextResponse.json({ events: [], connected: false });

    const params = new URLSearchParams({
      timeMin:      weekStart ?? new Date().toISOString(),
      timeMax:      weekEnd   ?? new Date(Date.now() + 7 * 864e5).toISOString(),
      singleEvents: "true",
      orderBy:      "startTime",
      maxResults:   "100",
    });

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) return NextResponse.json({ events: [], connected: true });

    const data = await res.json();
    return NextResponse.json({ events: data.items ?? [], connected: true });
  } catch (err) {
    console.error("[calendar/events GET]", err);
    return NextResponse.json({ events: [], connected: false });
  }
}

// ── POST — create / update / delete ─────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { action, taskId, title, description, start, end, gcalEventId, colorId } = body;

  const user = await getUser(userId);
  if (!user?.gcalRefreshToken) {
    return NextResponse.json({ error: "Google Calendar not connected" }, { status: 400 });
  }

  const accessToken = await getAccessToken(user.gcalRefreshToken);
  if (!accessToken) {
    return NextResponse.json({ error: "Could not refresh token" }, { status: 401 });
  }

  const BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

  if (action === "delete" && gcalEventId) {
    await fetch(`${BASE}/${gcalEventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return NextResponse.json({ success: true });
  }

  const event = {
    summary:     title,
    description: description ?? "",
    start:       { dateTime: new Date(start).toISOString(), timeZone: "UTC" },
    end:         { dateTime: new Date(end).toISOString(),   timeZone: "UTC" },
    colorId:     colorId ?? "7", // 7 = peacock (blue)
    source: {
      title: "Life OS",
      url:   process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
    },
  };

  if (action === "update" && gcalEventId) {
    const res = await fetch(`${BASE}/${gcalEventId}`, {
      method:  "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body:    JSON.stringify(event),
    });
    const data = await res.json();
    return NextResponse.json({ eventId: data.id });
  }

  // create
  const res = await fetch(BASE, {
    method:  "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body:    JSON.stringify(event),
  });
  const data = await res.json();
  return NextResponse.json({ eventId: data.id });
}
