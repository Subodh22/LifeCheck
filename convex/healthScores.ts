import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

export const getByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const scores = await ctx.db
      .query("healthScores")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    // Return map of areaId → score
    const map: Record<string, number> = {};
    scores.forEach((s) => { map[s.areaId] = s.score; });
    return map;
  },
});

export const recalculate = internalMutation({
  args: { userId: v.string(), areaId: v.id("areas") },
  handler: async (ctx, args) => {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_area", (q) => q.eq("areaId", args.areaId))
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .collect();

    const goals = await ctx.db
      .query("goals")
      .withIndex("by_area", (q) => q.eq("areaId", args.areaId))
      .filter((q) =>
        q.and(
          q.eq(q.field("archivedAt"), undefined),
          q.eq(q.field("status"), "active")
        )
      )
      .collect();

    if (tasks.length === 0 && goals.length === 0) {
      // New area — neutral
      const score = 50;
      await upsertScore(ctx, args.userId, args.areaId, score);
      return score;
    }

    // Completion ratio (last 7 days)
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentTasks = tasks.filter((t) => t.createdAt > weekAgo);
    const completedRecent = recentTasks.filter((t) => t.status === "done").length;
    const completionRatio = recentTasks.length > 0 ? completedRecent / recentTasks.length : 0.5;

    // Last activity (days since any task was touched)
    const lastCompleted = tasks
      .filter((t) => t.completedAt)
      .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0))[0];
    const daysSinceActivity = lastCompleted
      ? (Date.now() - (lastCompleted.completedAt ?? 0)) / (1000 * 60 * 60 * 24)
      : 30;
    const activityScore = Math.max(0, 1 - daysSinceActivity / 30);

    // Goal progress
    const goalScore = goals.length > 0
      ? goals.reduce((sum, g) => {
          if (g.targetValue && g.targetValue > 0 && g.currentValue !== undefined) {
            return sum + Math.min(1, g.currentValue / g.targetValue);
          }
          return sum + 0.5;
        }, 0) / goals.length
      : 0.5;

    const raw = completionRatio * 0.4 + activityScore * 0.4 + goalScore * 0.2;
    const score = Math.round(Math.max(1, Math.min(100, raw * 100)));

    await upsertScore(ctx, args.userId, args.areaId, score);
    return score;
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertScore(ctx: any, userId: string, areaId: any, score: number) {
  const existing = await ctx.db
    .query("healthScores")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .withIndex("by_area", (q: any) => q.eq("areaId", areaId))
    .first();
  if (existing) {
    await ctx.db.patch(existing._id, { score, calculatedAt: Date.now() });
  } else {
    await ctx.db.insert("healthScores", { userId, areaId, score, calculatedAt: Date.now() });
  }
}
