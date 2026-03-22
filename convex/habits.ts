import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// ── Habits ────────────────────────────────────────────────────────────────────

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return ctx.db
      .query("habits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .collect();
  },
});

export const create = mutation({
  args: {
    userId:            v.string(),
    areaId:            v.id("areas"),
    title:             v.string(),
    frequency:         v.union(
      v.literal("daily"), v.literal("weekly"),
      v.literal("monthly"), v.literal("quarterly"), v.literal("yearly"),
    ),
    // Scheduling
    targetDaysPerWeek: v.optional(v.number()),
    timeOfDay:         v.optional(v.union(
      v.literal("morning"), v.literal("midday"),
      v.literal("evening"), v.literal("anytime"),
    )),
    dayOfWeek:         v.optional(v.number()),   // weekly: 0=Mon..6=Sun
    dayOfMonth:        v.optional(v.number()),   // monthly: 1-31
    monthOfQuarter:    v.optional(v.number()),   // quarterly: 1, 2, or 3
    month:             v.optional(v.number()),   // yearly: 1-12
    // Behavioral (onboarding wizard — Clear 2018, Fogg 2020, Gollwitzer 1999, WOOP)
    identityStatement: v.optional(v.string()),
    anchor:            v.optional(v.string()),
    obstacle:          v.optional(v.string()),
    ifThenPlan:        v.optional(v.string()),
    minimumVersion:    v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("habits", {
      userId:            args.userId,
      areaId:            args.areaId,
      title:             args.title,
      frequency:         args.frequency,
      targetDaysPerWeek: args.targetDaysPerWeek ?? (args.frequency === "daily" ? 7 : args.frequency === "weekly" ? 3 : undefined),
      timeOfDay:         args.timeOfDay,
      dayOfWeek:         args.dayOfWeek,
      dayOfMonth:        args.dayOfMonth,
      monthOfQuarter:    args.monthOfQuarter,
      month:             args.month,
      identityStatement: args.identityStatement,
      anchor:            args.anchor,
      obstacle:          args.obstacle,
      ifThenPlan:        args.ifThenPlan,
      minimumVersion:    args.minimumVersion,
      currentStreak:     0,
      longestStreak:     0,
      createdAt:         Date.now(),
    });
  },
});

export const archive = mutation({
  args: { id: v.id("habits") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { archivedAt: Date.now() });
  },
});

// ── Habit completions ─────────────────────────────────────────────────────────

export const getHabitCompletionsForWeek = query({
  args: { userId: v.string(), weekStart: v.string(), weekEnd: v.string() },
  handler: async (ctx, { userId, weekStart, weekEnd }) => {
    const habits = await ctx.db
      .query("habits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const result: { habitId: string; completedDate: string }[] = [];
    for (const h of habits) {
      const rows = await ctx.db
        .query("habitCompletions")
        .withIndex("by_habit_date", (q) =>
          q.eq("habitId", h._id).gte("completedDate", weekStart).lte("completedDate", weekEnd)
        )
        .collect();
      result.push(...rows.map((r) => ({ habitId: h._id as string, completedDate: r.completedDate })));
    }
    return result;
  },
});

export const getHabitCompletionsForYear = query({
  args: { userId: v.string(), yearStart: v.string(), yearEnd: v.string() },
  handler: async (ctx, { userId, yearStart, yearEnd }) => {
    const habits = await ctx.db
      .query("habits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const result: { habitId: string; completedDate: string }[] = [];
    for (const h of habits) {
      const rows = await ctx.db
        .query("habitCompletions")
        .withIndex("by_habit_date", (q) =>
          q.eq("habitId", h._id).gte("completedDate", yearStart).lte("completedDate", yearEnd)
        )
        .collect();
      result.push(...rows.map((r) => ({ habitId: h._id as string, completedDate: r.completedDate })));
    }
    return result;
  },
});

export const toggleHabitCompletion = mutation({
  args: { habitId: v.id("habits"), userId: v.string(), date: v.string() },
  handler: async (ctx, { habitId, userId, date }) => {
    const existing = await ctx.db
      .query("habitCompletions")
      .withIndex("by_habit_date", (q) => q.eq("habitId", habitId).eq("completedDate", date))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }
    await ctx.db.insert("habitCompletions", { userId, habitId, completedDate: date, createdAt: Date.now() });
    return true;
  },
});

// ── Task completions (recurring tasks from onboarding) ────────────────────────

export const getTaskCompletionsForWeek = query({
  args: { userId: v.string(), weekStart: v.string(), weekEnd: v.string() },
  handler: async (ctx, { userId, weekStart, weekEnd }) => {
    return ctx.db
      .query("taskCompletions")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.gte(q.field("completedDate"), weekStart),
          q.lte(q.field("completedDate"), weekEnd)
        )
      )
      .collect();
  },
});

export const toggleTaskCompletion = mutation({
  args: { taskId: v.id("tasks"), userId: v.string(), date: v.string() },
  handler: async (ctx, { taskId, userId, date }) => {
    const existing = await ctx.db
      .query("taskCompletions")
      .withIndex("by_task_date", (q) => q.eq("taskId", taskId).eq("completedDate", date))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }
    await ctx.db.insert("taskCompletions", { userId, taskId, completedDate: date, createdAt: Date.now() });
    return true;
  },
});
