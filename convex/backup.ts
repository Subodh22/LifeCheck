import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// ─── EXPORT ──────────────────────────────────────────────────────────────────
// Returns a full snapshot of all user data (areas, tasks, goals, projects,
// habits, completions, health scores, weekly reviews).
// The client can JSON.stringify this and save it as a file.
export const exportUserData = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const areas = await ctx.db
      .query("areas")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const goals = await ctx.db
      .query("goals")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const habits = await ctx.db
      .query("habits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // habitCompletions has no by_user index — fetch per-habit
    const habitCompletions: (typeof habits[number] extends { _id: Id<"habits"> }
      ? Awaited<ReturnType<typeof ctx.db.query>>
      : never)[] = [];
    const allHabitCompletions = [];
    for (const h of habits) {
      const completions = await ctx.db
        .query("habitCompletions")
        .withIndex("by_habit", (q) => q.eq("habitId", h._id))
        .collect();
      allHabitCompletions.push(...completions);
    }

    const taskCompletions = await ctx.db
      .query("taskCompletions")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .collect();

    const healthScores = await ctx.db
      .query("healthScores")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const weeklyReviews = await ctx.db
      .query("weeklyReviews")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return {
      exportedAt: Date.now(),
      userId,
      areas,
      goals,
      projects,
      tasks,
      habits,
      habitCompletions: allHabitCompletions,
      taskCompletions,
      healthScores,
      weeklyReviews,
    };
  },
});

// ─── RESTORE ─────────────────────────────────────────────────────────────────
// Re-inserts a snapshot produced by exportUserData.
// Remaps all Convex IDs so foreign-key relationships stay intact.
// NOTE: Does NOT wipe existing data first. If you want a clean restore,
// call admin.resetUserData before running this.
export const restoreUserData = mutation({
  args: { snapshot: v.any() },
  handler: async (ctx, { snapshot }) => {
    const userId: string = snapshot.userId;

    // Old Convex _id → newly inserted _id
    const areaMap    = new Map<string, Id<"areas">>();
    const goalMap    = new Map<string, Id<"goals">>();
    const projectMap = new Map<string, Id<"projects">>();
    const taskMap    = new Map<string, Id<"tasks">>();
    const habitMap   = new Map<string, Id<"habits">>();

    // ── 1. Areas ──────────────────────────────────────────────────────────────
    for (const a of snapshot.areas ?? []) {
      const id = await ctx.db.insert("areas", {
        userId,
        name: a.name,
        color: a.color,
        icon: a.icon,
        description: a.description,
        category: a.category,
        order: a.order,
        archivedAt: a.archivedAt,
        createdAt: a.createdAt,
      });
      areaMap.set(a._id, id);
    }

    // ── 2. Goals — pass 1: insert without parentGoalId ────────────────────────
    for (const g of snapshot.goals ?? []) {
      const id = await ctx.db.insert("goals", {
        userId,
        areaId: (areaMap.get(g.areaId) ?? g.areaId) as Id<"areas">,
        title: g.title,
        timeframe: g.timeframe,
        description: g.description,
        targetMetric: g.targetMetric,
        targetValue: g.targetValue,
        currentValue: g.currentValue,
        dueDate: g.dueDate,
        status: g.status,
        archivedAt: g.archivedAt,
        createdAt: g.createdAt,
      });
      goalMap.set(g._id, id);
    }
    // pass 2: wire up parentGoalId now that all goal IDs exist
    for (const g of snapshot.goals ?? []) {
      if (g.parentGoalId) {
        const mapped = goalMap.get(g._id);
        const parent = (goalMap.get(g.parentGoalId) ?? g.parentGoalId) as Id<"goals">;
        if (mapped && parent) await ctx.db.patch(mapped, { parentGoalId: parent });
      }
    }

    // ── 3. Projects ───────────────────────────────────────────────────────────
    for (const p of snapshot.projects ?? []) {
      const id = await ctx.db.insert("projects", {
        userId,
        areaId: areaMap.get(p.areaId)!,
        goalId: p.goalId ? goalMap.get(p.goalId) : undefined,
        title: p.title,
        description: p.description,
        status: p.status,
        startDate: p.startDate,
        endDate: p.endDate,
        archivedAt: p.archivedAt,
        createdAt: p.createdAt,
      });
      projectMap.set(p._id, id);
    }

    // ── 4. Tasks — pass 1: insert without parentTaskId ────────────────────────
    for (const t of snapshot.tasks ?? []) {
      const id = await ctx.db.insert("tasks", {
        userId,
        areaId: (areaMap.get(t.areaId) ?? t.areaId) as Id<"areas">,
        projectId: t.projectId ? projectMap.get(t.projectId) : undefined,
        goalId: t.goalId ? ((goalMap.get(t.goalId) ?? t.goalId) as Id<"goals">) : undefined,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        energyTag: t.energyTag,
        dueDate: t.dueDate,
        completedAt: t.completedAt,
        blockedReason: t.blockedReason,
        tags: t.tags,
        order: t.order,
        archivedAt: t.archivedAt,
        createdAt: t.createdAt,
        scheduledStart: t.scheduledStart,
        scheduledEnd: t.scheduledEnd,
        gcalEventId: t.gcalEventId,
      });
      taskMap.set(t._id, id);
    }
    // pass 2: wire up parentTaskId
    for (const t of snapshot.tasks ?? []) {
      if (t.parentTaskId) {
        const mapped = taskMap.get(t._id);
        const parent = taskMap.get(t.parentTaskId);
        if (mapped && parent) await ctx.db.patch(mapped, { parentTaskId: parent });
      }
    }

    // ── 5. Habits ─────────────────────────────────────────────────────────────
    for (const h of snapshot.habits ?? []) {
      const id = await ctx.db.insert("habits", {
        userId,
        areaId: (areaMap.get(h.areaId) ?? h.areaId) as Id<"areas">,
        title: h.title,
        frequency: h.frequency,
        targetDaysPerWeek: h.targetDaysPerWeek,
        timeOfDay: h.timeOfDay,
        dayOfWeek: h.dayOfWeek,
        dayOfMonth: h.dayOfMonth,
        monthOfQuarter: h.monthOfQuarter,
        month: h.month,
        identityStatement: h.identityStatement,
        anchor: h.anchor,
        obstacle: h.obstacle,
        ifThenPlan: h.ifThenPlan,
        minimumVersion: h.minimumVersion,
        currentStreak: h.currentStreak,
        longestStreak: h.longestStreak,
        archivedAt: h.archivedAt,
        createdAt: h.createdAt,
      });
      habitMap.set(h._id, id);
    }

    // ── 6. Habit completions ──────────────────────────────────────────────────
    for (const hc of snapshot.habitCompletions ?? []) {
      const newHabitId = habitMap.get(hc.habitId);
      if (newHabitId) {
        await ctx.db.insert("habitCompletions", {
          userId,
          habitId: newHabitId,
          completedDate: hc.completedDate,
          createdAt: hc.createdAt,
        });
      }
    }

    // ── 7. Task completions ───────────────────────────────────────────────────
    for (const tc of snapshot.taskCompletions ?? []) {
      const newTaskId = taskMap.get(tc.taskId);
      if (newTaskId) {
        await ctx.db.insert("taskCompletions", {
          userId,
          taskId: newTaskId,
          completedDate: tc.completedDate,
          createdAt: tc.createdAt,
        });
      }
    }

    // ── 8. Health scores ──────────────────────────────────────────────────────
    for (const hs of snapshot.healthScores ?? []) {
      const newAreaId = areaMap.get(hs.areaId);
      if (newAreaId) {
        await ctx.db.insert("healthScores", {
          userId,
          areaId: newAreaId,
          score: hs.score,
          calculatedAt: hs.calculatedAt,
        });
      }
    }

    // ── 9. Weekly reviews ─────────────────────────────────────────────────────
    for (const wr of snapshot.weeklyReviews ?? []) {
      await ctx.db.insert("weeklyReviews", {
        userId,
        weekOf: wr.weekOf,
        content: wr.content,
        wins: wr.wins,
        improvements: wr.improvements,
        tasksCompleted: wr.tasksCompleted,
        tasksMissed: wr.tasksMissed,
        createdAt: wr.createdAt,
      });
    }

    return {
      restored: {
        areas:            areaMap.size,
        goals:            goalMap.size,
        projects:         projectMap.size,
        tasks:            taskMap.size,
        habits:           habitMap.size,
        habitCompletions: (snapshot.habitCompletions ?? []).length,
        taskCompletions:  (snapshot.taskCompletions  ?? []).length,
        healthScores:     (snapshot.healthScores     ?? []).length,
        weeklyReviews:    (snapshot.weeklyReviews    ?? []).length,
      },
    };
  },
});
