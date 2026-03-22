import { v } from "convex/values";
import { mutation } from "./_generated/server";

const taskShape = v.object({
  title:     v.string(),
  priority:  v.union(v.literal("urgent"), v.literal("high"), v.literal("medium"), v.literal("low")),
  frequency: v.union(v.literal("daily"), v.literal("weekly"), v.literal("once")),
  status:    v.union(v.literal("backlog"), v.literal("todo"), v.literal("in_progress"), v.literal("blocked"), v.literal("done")),
});

const areaShape = v.object({
  name:         v.string(),
  color:        v.string(),
  icon:         v.optional(v.string()),
  category:     v.optional(v.string()),
  description:  v.optional(v.string()),
  goal:         v.string(),
  metric:       v.string(),
  currentValue: v.number(),
  targetValue:  v.number(),
  deadline:     v.optional(v.number()),
  tasks:        v.array(taskShape),
});

export const setupWorkspace = mutation({
  args: {
    userId: v.string(),
    areas:  v.array(areaShape),
  },
  handler: async (ctx, { userId, areas }) => {
    const now = Date.now();
    let order = 0;

    for (const a of areas) {
      // Create area
      const areaId = await ctx.db.insert("areas", {
        userId,
        name:        a.name,
        color:       a.color,
        icon:        a.icon,
        category:    a.category,
        description: a.description,
        order:       order++,
        createdAt:   now,
      });

      // Create goal
      await ctx.db.insert("goals", {
        userId,
        areaId,
        title:        a.goal,
        targetMetric: a.metric,
        targetValue:  a.targetValue,
        currentValue: a.currentValue,
        dueDate:      a.deadline,
        status:       "active",
        createdAt:    now,
      });

      // Create initial health score
      await ctx.db.insert("healthScores", {
        userId,
        areaId,
        score:        50,
        calculatedAt: now,
      });

      // Create tasks, tagged by frequency
      for (const t of a.tasks) {
        await ctx.db.insert("tasks", {
          userId,
          areaId,
          title:     t.title,
          status:    t.status,
          priority:  t.priority,
          tags:      [t.frequency],
          createdAt: now,
        });
      }
    }

    return { ok: true };
  },
});
