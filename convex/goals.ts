import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const timeframeV = v.optional(v.union(
  v.literal("yearly"),
  v.literal("quarterly"),
  v.literal("monthly"),
  v.literal("weekly"),
));

export const listByUser = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("goals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .collect();
  },
});

export const listByArea = query({
  args: { areaId: v.id("areas"), userId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("goals")
      .withIndex("by_area", (q) => q.eq("areaId", args.areaId))
      .filter((q) =>
        q.and(
          q.eq(q.field("userId"), args.userId),
          q.eq(q.field("archivedAt"), undefined)
        )
      )
      .collect();
  },
});

export const create = mutation({
  args: {
    userId:        v.string(),
    areaId:        v.id("areas"),
    parentGoalId:  v.optional(v.id("goals")),
    timeframe:     timeframeV,
    title:         v.string(),
    description:   v.optional(v.string()),
    targetMetric:  v.optional(v.string()),
    targetValue:   v.optional(v.number()),
    currentValue:  v.optional(v.number()),
    dueDate:       v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("goals", {
      ...args,
      status: "active",
      createdAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id:            v.id("goals"),
    title:         v.optional(v.string()),
    description:   v.optional(v.string()),
    targetMetric:  v.optional(v.string()),
    targetValue:   v.optional(v.number()),
    currentValue:  v.optional(v.number()),
    dueDate:       v.optional(v.number()),
    timeframe:     timeframeV,
    parentGoalId:  v.optional(v.id("goals")),
    status:        v.optional(v.union(v.literal("active"), v.literal("achieved"), v.literal("paused"), v.literal("abandoned"))),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    await ctx.db.patch(id, updates);
  },
});

export const updateProgress = mutation({
  args: { id: v.id("goals"), currentValue: v.number() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { currentValue: args.currentValue });
  },
});

export const archive = mutation({
  args: { id: v.id("goals") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, { archivedAt: Date.now() });
  },
});

export const listChildren = query({
  args: { parentGoalId: v.id("goals") },
  handler: async (ctx, { parentGoalId }) => {
    return ctx.db
      .query("goals")
      .withIndex("by_parent", (q) => q.eq("parentGoalId", parentGoalId))
      .filter((q) => q.eq(q.field("archivedAt"), undefined))
      .collect();
  },
});

// Creates a yearly goal + 4 quarterly milestones in one transaction.
// Rule-based suggestion: proportional metric split or template titles.
export const createCascade = mutation({
  args: {
    userId:       v.string(),
    areaId:       v.id("areas"),
    title:        v.string(),
    motivation:   v.optional(v.string()),
    constraint:   v.optional(v.string()),
    eightyPct:    v.optional(v.string()),
    targetMetric: v.optional(v.string()),
    targetValue:  v.optional(v.number()),
    currentValue: v.optional(v.number()),
    quarters: v.array(v.object({
      title:       v.string(),
      targetValue: v.optional(v.number()),
      dueDate:     v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const year = new Date().getFullYear();
    const yearEnd = new Date(year, 11, 31, 23, 59, 59).getTime();

    // Build description from interview answers
    const descParts: string[] = [];
    if (args.motivation) descParts.push(`Why it matters: ${args.motivation}`);
    if (args.eightyPct)  descParts.push(`80% version: ${args.eightyPct}`);
    if (args.constraint) descParts.push(`Biggest constraint: ${args.constraint}`);

    const yearlyId = await ctx.db.insert("goals", {
      userId:       args.userId,
      areaId:       args.areaId,
      timeframe:    "yearly",
      title:        args.title,
      description:  descParts.join("\n") || undefined,
      targetMetric: args.targetMetric,
      targetValue:  args.targetValue,
      currentValue: args.currentValue ?? 0,
      status:       "active",
      dueDate:      yearEnd,
      createdAt:    Date.now(),
    });

    for (const q of args.quarters) {
      await ctx.db.insert("goals", {
        userId:       args.userId,
        areaId:       args.areaId,
        parentGoalId: yearlyId,
        timeframe:    "quarterly",
        title:        q.title,
        targetMetric: args.targetMetric,
        targetValue:  q.targetValue,
        currentValue: 0,
        status:       "active",
        dueDate:      q.dueDate,
        createdAt:    Date.now(),
      });
    }

    return yearlyId;
  },
});
