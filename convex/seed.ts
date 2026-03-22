import { v } from "convex/values";
import { mutation } from "./_generated/server";

const DAY = 24 * 60 * 60 * 1000;
const now = () => Date.now();

export const seedDemoData = mutation({
  args: { userId: v.string(), force: v.optional(v.boolean()) },
  handler: async (ctx, { userId, force }) => {
    // Don't double-seed unless forced
    const existing = await ctx.db
      .query("areas")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (existing && !force) return { skipped: true };

    // Clear existing data if forced
    if (existing && force) {
      const areas    = await ctx.db.query("areas").withIndex("by_user", q => q.eq("userId", userId)).collect();
      const tasks    = await ctx.db.query("tasks").withIndex("by_user", q => q.eq("userId", userId)).collect();
      const goals    = await ctx.db.query("goals").withIndex("by_user", q => q.eq("userId", userId)).collect();
      const habits   = await ctx.db.query("habits").withIndex("by_user", q => q.eq("userId", userId)).collect();
      const scores   = await ctx.db.query("healthScores").withIndex("by_user", q => q.eq("userId", userId)).collect();
      const reviews  = await ctx.db.query("weeklyReviews").withIndex("by_user", q => q.eq("userId", userId)).collect();
      for (const r of [...areas, ...tasks, ...goals, ...habits, ...scores, ...reviews]) {
        await ctx.db.delete(r._id);
      }
    }

    // ── 1. AREAS ──────────────────────────────────────────────────────────────
    const areaDefs = [
      { name: "Work & Career",    color: "#0D0D0D", category: "Work",     description: "Professional projects, deliverables, career growth", order: 0 },
      { name: "Health & Fitness", color: "#3A7D44", category: "Health",   description: "Gym, nutrition, sleep, wellness habits",             order: 1 },
      { name: "Guitar",           color: "#B08A4E", category: "Creative", description: "Practice sessions, songs to learn, music theory",   order: 2 },
      { name: "Finance",          color: "#2A5F8F", category: "Finance",  description: "Budget, savings goals, investments",                 order: 3 },
      { name: "Learning",         color: "#8F3A2A", category: "Learning", description: "Courses, books, skills to develop",                  order: 4 },
      { name: "Travel",           color: "#2A7A7A", category: "Travel",   description: "Upcoming trips, planning, bucket list",              order: 5 },
    ];

    const areaIds: Record<string, string> = {};
    for (const a of areaDefs) {
      const id = await ctx.db.insert("areas", { userId, createdAt: now(), ...a });
      areaIds[a.name] = id;
    }

    const work    = areaIds["Work & Career"]    as any;
    const health  = areaIds["Health & Fitness"] as any;
    const guitar  = areaIds["Guitar"]           as any;
    const finance = areaIds["Finance"]          as any;
    const learn   = areaIds["Learning"]         as any;
    const travel  = areaIds["Travel"]           as any;

    // ── 2. TASKS ──────────────────────────────────────────────────────────────
    // Tasks completed THIS WEEK (for "Won This Week" + streak days)
    // Spread completedAt across Mon→today to show a 5-day streak
    const thisMonday = (() => {
      const d = new Date(); d.setHours(0,0,0,0);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return d.getTime();
    })();

    const wonThisWeek = [
      { areaId: work,    title: "Set up weekly 1:1 schedule",          completedAt: thisMonday + 0.3 * DAY },
      { areaId: health,  title: "Upper body push session",             completedAt: thisMonday + 0.5 * DAY },
      { areaId: work,    title: "Ship v2 onboarding flow to staging",  completedAt: thisMonday + 1.2 * DAY },
      { areaId: finance, title: "Monthly spending review",             completedAt: thisMonday + 1.4 * DAY },
      { areaId: learn,   title: "Finish TypeScript generics section",  completedAt: thisMonday + 2.1 * DAY },
      { areaId: work,    title: "Update competitor analysis doc",      completedAt: thisMonday + 2.3 * DAY },
      { areaId: health,  title: "10 000 steps — day 3",               completedAt: thisMonday + 3.1 * DAY },
      { areaId: learn,   title: "React 19 — module 7 complete",       completedAt: thisMonday + 3.5 * DAY },
      { areaId: work,    title: "Review PRs from team",               completedAt: thisMonday + 4.0 * DAY },
      { areaId: finance, title: "Move $2k to high-interest savings",  completedAt: thisMonday + 4.2 * DAY },
    ];

    for (const t of wonThisWeek) {
      await ctx.db.insert("tasks", {
        userId, areaId: t.areaId, title: t.title,
        status: "done", priority: "medium",
        completedAt: Math.round(t.completedAt),
        createdAt: Math.round(t.completedAt) - DAY,
      });
    }

    // Active + backlog tasks (mix of statuses)
    const activeTasks = [
      { areaId: work,    title: "Finalise Q2 product roadmap",              status: "in_progress", priority: "urgent", dueDate: now() + 2 * DAY,  description: "Align with eng and design on priorities" },
      { areaId: work,    title: "Prep slides for investor update",           status: "todo",        priority: "high",   dueDate: now() + 5 * DAY },
      { areaId: work,    title: "Write job description for senior dev",      status: "backlog",     priority: "medium" },
      { areaId: work,    title: "Audit cloud spend — reduce by 20%",         status: "blocked",     priority: "high",   description: "Waiting on Finance sign-off" },
      { areaId: work,    title: "Kick off Q3 planning session",              status: "todo",        priority: "high",   dueDate: now() + 8 * DAY },

      { areaId: health,  title: "Book physio for lower back",                status: "todo",        priority: "high",   dueDate: now() + 3 * DAY },
      { areaId: health,  title: "Log meals in MyFitnessPal this week",       status: "in_progress", priority: "medium" },
      { areaId: health,  title: "Sleep by 10:30 PM for 7 days",              status: "in_progress", priority: "medium" },
      { areaId: health,  title: "Schedule annual health check",              status: "todo",        priority: "high",   dueDate: now() + 14 * DAY },
      { areaId: health,  title: "Order new protein powder",                  status: "backlog",     priority: "low" },

      // Guitar — stale area (no recent activity, shows decay)
      { areaId: guitar,  title: "Learn Comfortably Numb solo — section 1",  status: "in_progress", priority: "medium" },
      { areaId: guitar,  title: "Practice Dm pentatonic scale — 30 min",    status: "backlog",     priority: "medium" },
      { areaId: guitar,  title: "Transcribe Hendrix Voodoo Chile riff",      status: "backlog",     priority: "low" },
      { areaId: guitar,  title: "Record first cover and upload",             status: "backlog",     priority: "medium" },

      { areaId: finance, title: "Review and cancel unused subscriptions",    status: "todo",        priority: "medium", dueDate: now() + 3 * DAY },
      { areaId: finance, title: "Set up automated ETF — $500/mo",            status: "in_progress", priority: "high" },
      { areaId: finance, title: "File quarterly tax return",                 status: "todo",        priority: "urgent", dueDate: now() + 6 * DAY },
      { areaId: finance, title: "Rebalance investment portfolio",            status: "backlog",     priority: "medium" },

      { areaId: learn,   title: "Complete React 19 deep-dive course",        status: "in_progress", priority: "high",   description: "On module 8 of 14" },
      { areaId: learn,   title: "Read chapter 3 — The Lean Startup",        status: "todo",        priority: "medium", dueDate: now() + 2 * DAY },
      { areaId: learn,   title: "Watch 3Blue1Brown linear algebra series",   status: "backlog",     priority: "low" },
      { areaId: learn,   title: "Anki deck — 20 cards per day",              status: "todo",        priority: "medium" },

      // Travel — stale area
      { areaId: travel,  title: "Book flights to Japan — Oct window",        status: "todo",        priority: "urgent", dueDate: now() + 4 * DAY },
      { areaId: travel,  title: "Research Kyoto + Osaka itinerary",          status: "in_progress", priority: "high" },
      { areaId: travel,  title: "Get travel insurance",                      status: "backlog",     priority: "high" },
      { areaId: travel,  title: "Apply for Japan tourist visa",              status: "backlog",     priority: "high",   dueDate: now() + 30 * DAY },

      // Overdue tasks — loss aversion
      { areaId: work,    title: "Send contract to new contractor",            status: "todo",        priority: "high",   dueDate: now() - 3 * DAY },
      { areaId: health,  title: "Renew gym membership",                      status: "todo",        priority: "medium", dueDate: now() - 1 * DAY },
    ];

    for (const t of activeTasks) {
      await ctx.db.insert("tasks", {
        userId, areaId: t.areaId, title: t.title,
        status: t.status as any, priority: t.priority as any,
        description: (t as any).description,
        dueDate:     (t as any).dueDate,
        createdAt:   now() - Math.floor(Math.random() * 14) * DAY,
      });
    }

    // ── 3. GOALS ──────────────────────────────────────────────────────────────
    // Varied progress to show goal gradient effect at different stages
    const goals = [
      // Work — near completion (goal gradient kicks in at 70%+)
      { areaId: work,    title: "Hit $50k MRR",                        targetMetric: "MRR ($)",        targetValue: 50000, currentValue: 39200, dueDate: now() + 90 * DAY },
      { areaId: work,    title: "Grow team to 8 engineers",            targetMetric: "engineers",      targetValue: 8,     currentValue: 6,     dueDate: now() + 120 * DAY },
      { areaId: work,    title: "Ship 3 major features this quarter",  targetMetric: "features",       targetValue: 3,     currentValue: 2,     dueDate: now() + 45 * DAY },

      // Health — mid-progress (amber zone)
      { areaId: health,  title: "Bench press 100kg",                   targetMetric: "kg",             targetValue: 100,   currentValue: 78,    dueDate: now() + 90 * DAY },
      { areaId: health,  title: "Run 5km in under 25 minutes",        targetMetric: "min (target)",   targetValue: 25,    currentValue: 27,    dueDate: now() + 60 * DAY },

      // Guitar — low progress (red zone, stale area)
      { areaId: guitar,  title: "Learn 10 complete songs",             targetMetric: "songs",          targetValue: 10,    currentValue: 3,     dueDate: now() + 180 * DAY },

      // Finance — near goal
      { areaId: finance, title: "Save $20k emergency fund",            targetMetric: "$ saved",        targetValue: 20000, currentValue: 16800, dueDate: now() + 150 * DAY },
      { areaId: finance, title: "Invest $12k this year",               targetMetric: "$ invested",     targetValue: 12000, currentValue: 4500,  dueDate: now() + 270 * DAY },

      // Learning — good progress
      { areaId: learn,   title: "Read 12 books this year",             targetMetric: "books",          targetValue: 12,    currentValue: 9,     dueDate: now() + 270 * DAY },
      { areaId: learn,   title: "Complete 4 online courses this year", targetMetric: "courses",        targetValue: 4,     currentValue: 2,     dueDate: now() + 270 * DAY },

      // Travel
      { areaId: travel,  title: "Visit 5 new countries this year",     targetMetric: "countries",      targetValue: 5,     currentValue: 2,     dueDate: now() + 270 * DAY },
    ];

    for (const g of goals) {
      await ctx.db.insert("goals", {
        userId, areaId: g.areaId, title: g.title,
        targetMetric: g.targetMetric, targetValue: g.targetValue, currentValue: g.currentValue,
        dueDate: g.dueDate, status: "active",
        createdAt: now() - Math.floor(Math.random() * 30) * DAY,
      });
    }

    // ── 4. HABITS ─────────────────────────────────────────────────────────────
    const habits = [
      { areaId: health, title: "Morning workout",          frequency: "daily",  currentStreak: 5, longestStreak: 14 },
      { areaId: health, title: "10 000 steps",             frequency: "daily",  currentStreak: 12, longestStreak: 23 },
      { areaId: learn,  title: "Read 20 pages",            frequency: "daily",  currentStreak: 3, longestStreak: 8 },
      { areaId: guitar, title: "30 min practice",          frequency: "daily",  currentStreak: 0, longestStreak: 7 },
      { areaId: work,   title: "Weekly review",            frequency: "weekly", currentStreak: 4, longestStreak: 4 },
    ];

    for (const h of habits) {
      await ctx.db.insert("habits", {
        userId, areaId: h.areaId as any, title: h.title,
        frequency: h.frequency as any,
        currentStreak: h.currentStreak, longestStreak: h.longestStreak,
        createdAt: now() - 30 * DAY,
      });
    }

    // ── 5. HEALTH SCORES ──────────────────────────────────────────────────────
    const scores: Record<string, number> = {
      "Work & Career":    74,
      "Health & Fitness": 68,
      "Guitar":           31,  // Low — stale, no recent activity
      "Finance":          71,
      "Learning":         82,
      "Travel":           28,  // Low — stale
    };
    for (const [aName, score] of Object.entries(scores)) {
      const aId = areaIds[aName];
      if (aId) {
        await ctx.db.insert("healthScores", {
          userId, areaId: aId as any, score, calculatedAt: now(),
        });
      }
    }

    // ── 6. WEEKLY REVIEW ──────────────────────────────────────────────────────
    const monday = new Date();
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const weekOf = monday.toISOString().split("T")[0];

    await ctx.db.insert("weeklyReviews", {
      userId, weekOf,
      content: "Solid week overall. Shipped the new onboarding flow to staging and got good feedback from the team. Missed the gym twice but kept nutrition mostly on track. Squeezed in 3 guitar sessions. Falling a bit behind on the Japan trip planning — need to block time this weekend.",
      wins: "Onboarding flow shipped to staging\nGot investor deck 80% done\nHit step goal 5/7 days\nFinance: $2k moved to savings",
      improvements: "Book Japan flights — prices going up\nNeed to do the physio booking\nSleep schedule slipped — averaging 11:30 PM instead of 10:30 PM",
      tasksCompleted: 10,
      tasksMissed: 2,
      createdAt: now() - 2 * DAY,
    });

    return { skipped: false, areas: areaDefs.length, tasks: wonThisWeek.length + activeTasks.length, goals: goals.length };
  },
});
