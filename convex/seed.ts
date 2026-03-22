import { v } from "convex/values";
import { mutation } from "./_generated/server";

const DAY = 24 * 60 * 60 * 1000;
const now = () => Date.now();

export const seedDemoData = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    // Don't double-seed
    const existing = await ctx.db
      .query("areas")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing) return { skipped: true };

    // ── 1. AREAS ──────────────────────────────────────────────────────────────
    const areaDefs = [
      { name: "Work & Career",    color: "#4A9EE0", icon: "💼", category: "Work",          description: "Professional projects, deliverables, career growth", order: 0 },
      { name: "Health & Fitness", color: "#4CAF6B", icon: "🏃", category: "Health",         description: "Gym, nutrition, sleep, wellness habits",             order: 1 },
      { name: "Guitar",           color: "#C9A84C", icon: "🎸", category: "Creative",       description: "Practice sessions, songs to learn, music theory",   order: 2 },
      { name: "Travel",           color: "#E85538", icon: "✈️", category: "Travel",         description: "Upcoming trips, planning, bucket list destinations", order: 3 },
      { name: "Finance",          color: "#E8A838", icon: "💰", category: "Finance",         description: "Budget, savings goals, investments",                 order: 4 },
      { name: "Learning",         color: "#9B59B6", icon: "📚", category: "Learning",       description: "Courses, books, skills to develop",                  order: 5 },
    ];

    const areaIds: Record<string, string> = {};
    for (const a of areaDefs) {
      const id = await ctx.db.insert("areas", { userId, createdAt: now(), ...a });
      areaIds[a.name] = id;
    }

    const work    = areaIds["Work & Career"]    as any;
    const health  = areaIds["Health & Fitness"] as any;
    const guitar  = areaIds["Guitar"]           as any;
    const travel  = areaIds["Travel"]           as any;
    const finance = areaIds["Finance"]          as any;
    const learn   = areaIds["Learning"]         as any;

    // ── 2. TASKS ──────────────────────────────────────────────────────────────
    const tasks = [
      // Work
      { areaId: work,    title: "Finalise Q2 product roadmap",           status: "in_progress", priority: "urgent", dueDate: now() + 2 * DAY,  description: "Align with eng and design on priorities" },
      { areaId: work,    title: "Review PRs from the team",              status: "todo",        priority: "high",   dueDate: now() + DAY },
      { areaId: work,    title: "Prep slides for investor update",        status: "todo",        priority: "high",   dueDate: now() + 5 * DAY },
      { areaId: work,    title: "Write job description for senior dev",   status: "backlog",     priority: "medium" },
      { areaId: work,    title: "Set up weekly 1:1 schedule",             status: "done",        priority: "medium", completedAt: now() - DAY },
      { areaId: work,    title: "Update competitor analysis doc",         status: "backlog",     priority: "low" },
      { areaId: work,    title: "Audit cloud spend — reduce by 20%",      status: "blocked",     priority: "high",   description: "Waiting on Finance approval" },
      { areaId: work,    title: "Ship v2 onboarding flow",               status: "in_progress", priority: "urgent", dueDate: now() + 7 * DAY },

      // Health
      { areaId: health,  title: "Upper body push — chest, shoulders, tris", status: "todo",     priority: "medium", dueDate: now() },
      { areaId: health,  title: "Log meals for the week in MyFitnessPal",   status: "in_progress", priority: "medium" },
      { areaId: health,  title: "Book physio for lower back",               status: "todo",     priority: "high",   dueDate: now() + 3 * DAY },
      { areaId: health,  title: "10 000 steps — daily streak",             status: "done",     priority: "low",    completedAt: now() - DAY },
      { areaId: health,  title: "Sleep by 10:30 PM for 7 days",            status: "in_progress", priority: "medium" },
      { areaId: health,  title: "Order new protein powder",                status: "backlog",   priority: "low" },
      { areaId: health,  title: "Schedule annual health check",            status: "todo",     priority: "high",   dueDate: now() + 14 * DAY },

      // Guitar
      { areaId: guitar,  title: "Learn Comfortably Numb solo — section 1", status: "in_progress", priority: "medium" },
      { areaId: guitar,  title: "Practice Dm pentatonic scale — 30 min",   status: "todo",     priority: "medium", dueDate: now() },
      { areaId: guitar,  title: "Transcribe Hendrix Voodoo Chile riff",    status: "backlog",  priority: "low" },
      { areaId: guitar,  title: "Record first cover and upload to SoundCloud", status: "backlog", priority: "medium" },
      { areaId: guitar,  title: "Work through Justin Guitar beginner module 5", status: "done", priority: "medium", completedAt: now() - 3 * DAY },
      { areaId: guitar,  title: "Fix intonation on acoustic",              status: "todo",     priority: "low" },

      // Travel
      { areaId: travel,  title: "Book flights to Japan — Oct window",     status: "todo",     priority: "urgent", dueDate: now() + 4 * DAY,  description: "Prices spike after Golden Week" },
      { areaId: travel,  title: "Research Kyoto + Osaka 5-day itinerary", status: "in_progress", priority: "high" },
      { areaId: travel,  title: "Get travel insurance",                   status: "backlog",  priority: "high" },
      { areaId: travel,  title: "Apply for Japan tourist visa",           status: "backlog",  priority: "high",   dueDate: now() + 30 * DAY },
      { areaId: travel,  title: "Find Airbnb in Shinjuku for 3 nights",  status: "todo",     priority: "medium" },
      { areaId: travel,  title: "Learn 50 essential Japanese phrases",    status: "backlog",  priority: "low" },
      { areaId: travel,  title: "Budget spreadsheet for Japan trip",      status: "done",     priority: "medium", completedAt: now() - 2 * DAY },

      // Finance
      { areaId: finance, title: "Move $2k to high-interest savings",      status: "todo",     priority: "high",   dueDate: now() + DAY },
      { areaId: finance, title: "Review and cancel unused subscriptions", status: "todo",     priority: "medium", dueDate: now() + 3 * DAY },
      { areaId: finance, title: "Set up automated ETF investment — $500/mo", status: "in_progress", priority: "high" },
      { areaId: finance, title: "File quarterly tax return",              status: "todo",     priority: "urgent", dueDate: now() + 6 * DAY },
      { areaId: finance, title: "Rebalance investment portfolio",         status: "backlog",  priority: "medium" },
      { areaId: finance, title: "Emergency fund — top up to 6 months",   status: "backlog",  priority: "medium" },
      { areaId: finance, title: "Monthly spending review — Feb",          status: "done",     priority: "medium", completedAt: now() - 5 * DAY },

      // Learning
      { areaId: learn,   title: "Complete React 19 deep-dive course",     status: "in_progress", priority: "high",  description: "Currently on module 7 of 14" },
      { areaId: learn,   title: "Read chapter 3 — The Lean Startup",     status: "todo",     priority: "medium", dueDate: now() + 2 * DAY },
      { areaId: learn,   title: "Finish TypeScript generics section",     status: "done",     priority: "medium", completedAt: now() - DAY },
      { areaId: learn,   title: "Watch 3Blue1Brown linear algebra series", status: "backlog", priority: "low" },
      { areaId: learn,   title: "Build a small side project using Convex", status: "in_progress", priority: "high" },
      { areaId: learn,   title: "Anki deck — 20 cards per day",           status: "todo",     priority: "medium" },
      { areaId: learn,   title: "Take notes on Deep Work book",           status: "done",     priority: "medium", completedAt: now() - 4 * DAY },
    ];

    for (const t of tasks) {
      await ctx.db.insert("tasks", {
        userId,
        areaId:      t.areaId,
        title:       t.title,
        status:      t.status as any,
        priority:    t.priority as any,
        description: (t as any).description,
        dueDate:     (t as any).dueDate,
        completedAt: (t as any).completedAt,
        createdAt:   now() - Math.floor(Math.random() * 14) * DAY,
      });
    }

    // ── 3. GOALS ──────────────────────────────────────────────────────────────
    const goals = [
      // Work
      { areaId: work,    title: "Ship 3 major product features this quarter", targetMetric: "features shipped", targetValue: 3,   currentValue: 1,  dueDate: now() + 75 * DAY },
      { areaId: work,    title: "Grow team to 8 engineers",                  targetMetric: "headcount",        targetValue: 8,   currentValue: 5,  dueDate: now() + 90 * DAY },
      { areaId: work,    title: "Hit $50k MRR",                              targetMetric: "MRR ($)",          targetValue: 50000, currentValue: 31400, dueDate: now() + 120 * DAY },
      // Health
      { areaId: health,  title: "Bench press 100kg",                         targetMetric: "kg",               targetValue: 100, currentValue: 82, dueDate: now() + 90 * DAY },
      { areaId: health,  title: "Run 5km in under 25 minutes",               targetMetric: "time (min)",       targetValue: 25,  currentValue: 28, dueDate: now() + 60 * DAY },
      { areaId: health,  title: "Lose 5kg body weight",                      targetMetric: "kg lost",          targetValue: 5,   currentValue: 2,  dueDate: now() + 90 * DAY },
      // Guitar
      { areaId: guitar,  title: "Learn 10 complete songs",                   targetMetric: "songs",            targetValue: 10,  currentValue: 3,  dueDate: now() + 180 * DAY },
      { areaId: guitar,  title: "Practice 30 min every day for 90 days",    targetMetric: "days streak",      targetValue: 90,  currentValue: 23, dueDate: now() + 67 * DAY },
      // Travel
      { areaId: travel,  title: "Visit 5 new countries this year",           targetMetric: "countries",        targetValue: 5,   currentValue: 2,  dueDate: now() + 270 * DAY },
      // Finance
      { areaId: finance, title: "Save $20k emergency fund",                  targetMetric: "$ saved",          targetValue: 20000, currentValue: 13500, dueDate: now() + 150 * DAY },
      { areaId: finance, title: "Invest $12k this year",                     targetMetric: "$ invested",       targetValue: 12000, currentValue: 4500,  dueDate: now() + 270 * DAY },
      // Learning
      { areaId: learn,   title: "Complete 4 online courses this year",       targetMetric: "courses",          targetValue: 4,   currentValue: 1,  dueDate: now() + 270 * DAY },
      { areaId: learn,   title: "Read 12 books this year",                   targetMetric: "books",            targetValue: 12,  currentValue: 3,  dueDate: now() + 270 * DAY },
    ];

    for (const g of goals) {
      await ctx.db.insert("goals", {
        userId,
        areaId:        g.areaId,
        title:         g.title,
        targetMetric:  g.targetMetric,
        targetValue:   g.targetValue,
        currentValue:  g.currentValue,
        dueDate:       g.dueDate,
        status:        "active",
        createdAt:     now() - Math.floor(Math.random() * 30) * DAY,
      });
    }

    // ── 4. HEALTH SCORES ──────────────────────────────────────────────────────
    const scores: Record<string, number> = {
      "Work & Career":    72,
      "Health & Fitness": 61,
      "Guitar":           44,
      "Travel":           55,
      "Finance":          68,
      "Learning":         78,
    };
    for (const [aName, score] of Object.entries(scores)) {
      const aId = areaIds[aName];
      if (aId) {
        await ctx.db.insert("healthScores", {
          userId,
          areaId: aId as any,
          score,
          calculatedAt: now(),
        });
      }
    }

    // ── 5. WEEKLY REVIEW ─────────────────────────────────────────────────────
    const monday = new Date();
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const weekOf = monday.toISOString().split("T")[0];

    await ctx.db.insert("weeklyReviews", {
      userId,
      weekOf,
      content: "Solid week overall. Shipped the new onboarding flow to staging and got good feedback from the team. Missed the gym twice but kept nutrition mostly on track. Squeezed in 3 guitar sessions which felt like real progress on the Comfortably Numb solo. Falling a bit behind on the Japan trip planning — need to block time this weekend.",
      wins: "Onboarding flow shipped to staging\nGot investor deck 80% done\n3 guitar sessions completed\nHit step goal 5/7 days",
      improvements: "Book Japan flights — prices going up\nNeed to do the physio booking\nSleep schedule slipped — averaging 11:30 PM instead of 10:30 PM",
      tasksCompleted: 7,
      tasksMissed: 2,
      createdAt: now() - 2 * DAY,
    });

    return { skipped: false, areas: areaDefs.length, tasks: tasks.length, goals: goals.length };
  },
});
