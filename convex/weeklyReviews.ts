import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("weeklyReviews")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const getByWeek = query({
  args: { userId: v.string(), weekOf: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("weeklyReviews")
      .withIndex("by_user_week", (q) =>
        q.eq("userId", args.userId).eq("weekOf", args.weekOf)
      )
      .first();
  },
});

export const upsert = mutation({
  args: {
    userId: v.string(),
    weekOf: v.string(),
    content: v.string(),
    wins: v.optional(v.string()),
    improvements: v.optional(v.string()),
    tasksCompleted: v.number(),
    tasksMissed: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("weeklyReviews")
      .withIndex("by_user_week", (q) =>
        q.eq("userId", args.userId).eq("weekOf", args.weekOf)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        content: args.content,
        wins: args.wins,
        improvements: args.improvements,
        tasksCompleted: args.tasksCompleted,
        tasksMissed: args.tasksMissed,
      });
      return existing._id;
    }

    return ctx.db.insert("weeklyReviews", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
