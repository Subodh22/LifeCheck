import { v } from "convex/values";
import { mutation } from "./_generated/server";

// Wipes all user data across every table. Irreversible.
export const resetUserData = mutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    // Tables with by_user index
    const byUserTables = [
      "tasks",
      "goals",
      "projects",
      "habits",
      "healthScores",
      "weeklyReviews",
      "areas",
    ] as const;

    for (const table of byUserTables) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const row of rows) {
        await ctx.db.delete(row._id);
      }
    }

    // taskCompletions — has by_user_date index
    const taskCompletions = await ctx.db
      .query("taskCompletions")
      .withIndex("by_user_date", (q) => q.eq("userId", userId))
      .collect();
    for (const row of taskCompletions) {
      await ctx.db.delete(row._id);
    }

    // habitCompletions — no by_user index, filter by userId
    const habitCompletions = await ctx.db
      .query("habitCompletions")
      .filter((q) => q.eq(q.field("userId"), userId))
      .collect();
    for (const row of habitCompletions) {
      await ctx.db.delete(row._id);
    }
  },
});
