import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByArea = query({
  args: { areaId: v.id("areas"), userId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("tasks")
      .withIndex("by_area", (q) => q.eq("areaId", args.areaId))
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.eq(q.field("archivedAt"), undefined),
          q.eq(q.field("parentTaskId"), undefined)
        )
      )
      .collect();
  },
});

export const listByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("archivedAt"), undefined),
          q.eq(q.field("parentTaskId"), undefined)
        )
      )
      .collect();
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    areaId: v.id("areas"),
    projectId: v.optional(v.id("projects")),
    goalId: v.optional(v.id("goals")),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.union(v.literal("urgent"), v.literal("high"), v.literal("medium"), v.literal("low")),
    energyTag: v.optional(v.union(v.literal("deep_work"), v.literal("quick_win"), v.literal("creative"), v.literal("admin"))),
    dueDate: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("tasks", {
      ...args,
      status: "todo",
      createdAt: Date.now(),
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("tasks"),
    status: v.union(
      v.literal("backlog"),
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("blocked"),
      v.literal("done")
    ),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, unknown> = { status: args.status };
    if (args.status === "done") {
      updates.completedAt = Date.now();
    }
    await ctx.db.patch(args.id, updates);
  },
});

export const update = mutation({
  args: {
    id: v.id("tasks"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(v.union(v.literal("urgent"), v.literal("high"), v.literal("medium"), v.literal("low"))),
    dueDate: v.optional(v.number()),
    energyTag: v.optional(v.union(v.literal("deep_work"), v.literal("quick_win"), v.literal("creative"), v.literal("admin"))),
    goalId: v.optional(v.id("goals")),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const archive = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { archivedAt: Date.now() });
  },
});

export const getTodayPriorities = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("archivedAt"), undefined),
          q.neq(q.field("status"), "done")
        )
      )
      .collect();

    // Score tasks: urgent due today = highest, then high priority, then habit-linked
    const scored = tasks
      .map((t) => {
        let score = 0;
        if (t.priority === "urgent") score += 100;
        else if (t.priority === "high") score += 50;
        else if (t.priority === "medium") score += 20;
        if (t.dueDate && t.dueDate <= todayEnd.getTime()) score += 80;
        if (t.dueDate && t.dueDate < now) score += 40; // overdue
        if (t.status === "in_progress") score += 30;
        return { ...t, _score: score };
      })
      .sort((a, b) => b._score - a._score)
      .slice(0, 3);

    return scored;
  },
});

export const scheduleTask = mutation({
  args: {
    id:             v.id("tasks"),
    scheduledStart: v.number(),
    scheduledEnd:   v.number(),
    gcalEventId:    v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Only patch gcalEventId if explicitly provided — patching with undefined
    // would delete the field, wiping a previously-stored event ID and causing
    // a duplicate GCal event on the next move.
    const patch: Record<string, unknown> = {
      scheduledStart: args.scheduledStart,
      scheduledEnd:   args.scheduledEnd,
    };
    if (args.gcalEventId !== undefined) {
      patch.gcalEventId = args.gcalEventId;
    }
    await ctx.db.patch(args.id, patch);
  },
});

export const unscheduleTask = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, {
      scheduledStart: undefined,
      scheduledEnd:   undefined,
      gcalEventId:    undefined,
    });
  },
});

export const listScheduledForWeek = query({
  args: { userId: v.string(), weekStart: v.number(), weekEnd: v.number() },
  handler: async (ctx, { userId, weekStart, weekEnd }) => {
    return ctx.db
      .query("tasks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("archivedAt"), undefined),
          q.neq(q.field("scheduledStart"), undefined),
          q.gte(q.field("scheduledStart"), weekStart),
          q.lte(q.field("scheduledStart"), weekEnd)
        )
      )
      .collect();
  },
});

export const listUnscheduled = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    return ctx.db
      .query("tasks")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "todo"))
      .filter((q) =>
        q.and(
          q.eq(q.field("archivedAt"), undefined),
          q.eq(q.field("scheduledStart"), undefined)
        )
      )
      .collect();
  },
});

export const listDoneForWeek = query({
  args: { userId: v.string(), weekStart: v.number(), weekEnd: v.number() },
  handler: async (ctx, { userId, weekStart, weekEnd }) => {
    return ctx.db
      .query("tasks")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "done"))
      .filter((q) =>
        q.and(
          q.eq(q.field("archivedAt"), undefined),
          q.gte(q.field("completedAt"), weekStart),
          q.lte(q.field("completedAt"), weekEnd)
        )
      )
      .collect();
  },
});
