import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    timezone: v.optional(v.string()),
    createdAt: v.number(),
    // Google Calendar
    gcalRefreshToken: v.optional(v.string()),
    gcalConnected: v.optional(v.boolean()),
  }).index("by_clerk_id", ["clerkId"]),

  areas: defineTable({
    userId: v.string(),
    name: v.string(),
    color: v.string(),
    icon: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    order: v.number(),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  goals: defineTable({
    userId: v.string(),
    areaId: v.id("areas"),
    parentGoalId: v.optional(v.id("goals")),
    timeframe: v.optional(v.union(
      v.literal("yearly"),
      v.literal("quarterly"),
      v.literal("monthly"),
      v.literal("weekly"),
    )),
    title: v.string(),
    description: v.optional(v.string()),
    targetMetric: v.optional(v.string()),
    targetValue: v.optional(v.number()),
    currentValue: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("achieved"), v.literal("paused"), v.literal("abandoned")),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_area", ["areaId"])
    .index("by_parent", ["parentGoalId"]),

  projects: defineTable({
    userId: v.string(),
    areaId: v.id("areas"),
    goalId: v.optional(v.id("goals")),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("completed"), v.literal("paused")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_area", ["areaId"]),

  tasks: defineTable({
    userId: v.string(),
    areaId: v.id("areas"),
    projectId: v.optional(v.id("projects")),
    goalId: v.optional(v.id("goals")),
    parentTaskId: v.optional(v.id("tasks")),
    title: v.string(),
    description: v.optional(v.string()),
    status: v.union(
      v.literal("backlog"),
      v.literal("todo"),
      v.literal("in_progress"),
      v.literal("blocked"),
      v.literal("done")
    ),
    priority: v.union(v.literal("urgent"), v.literal("high"), v.literal("medium"), v.literal("low")),
    energyTag: v.optional(v.union(v.literal("deep_work"), v.literal("quick_win"), v.literal("creative"), v.literal("admin"))),
    dueDate: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    blockedReason: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    order: v.optional(v.number()),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    // Calendar scheduling
    scheduledStart: v.optional(v.number()),  // Unix ms
    scheduledEnd: v.optional(v.number()),    // Unix ms
    gcalEventId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_area", ["areaId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_due", ["userId", "dueDate"]),

  habits: defineTable({
    userId: v.string(),
    areaId: v.id("areas"),
    title: v.string(),
    // Cadence — daily/weekly are true habits; monthly/quarterly/yearly are rituals/reviews
    frequency: v.union(
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("yearly"),
    ),
    // Scheduling
    targetDaysPerWeek: v.optional(v.number()),    // daily: 7, weekly: 1-7
    timeOfDay: v.optional(v.union(                // daily/weekly anchor time
      v.literal("morning"), v.literal("midday"),
      v.literal("evening"), v.literal("anytime")
    )),
    dayOfWeek: v.optional(v.number()),            // weekly: 0=Mon..6=Sun
    dayOfMonth: v.optional(v.number()),           // monthly: 1-31
    monthOfQuarter: v.optional(v.number()),       // quarterly: 1, 2, or 3
    month: v.optional(v.number()),                // yearly: 1-12
    // Behavioral research fields (onboarding wizard)
    identityStatement: v.optional(v.string()),    // Clear (2018): "I am someone who..."
    anchor: v.optional(v.string()),               // Fogg (2020): "After I [X], I will..."
    obstacle: v.optional(v.string()),             // WOOP: most likely obstacle
    ifThenPlan: v.optional(v.string()),           // Gollwitzer (1999): "If [X], then..."
    minimumVersion: v.optional(v.string()),       // Fogg (2020): worst-day fallback
    // Streaks
    currentStreak: v.number(),
    longestStreak: v.number(),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_area", ["areaId"]),

  habitCompletions: defineTable({
    userId: v.string(),
    habitId: v.id("habits"),
    completedDate: v.string(), // YYYY-MM-DD
    createdAt: v.number(),
  })
    .index("by_habit", ["habitId"])
    .index("by_habit_date", ["habitId", "completedDate"]),

  taskCompletions: defineTable({
    userId: v.string(),
    taskId: v.id("tasks"),
    completedDate: v.string(), // YYYY-MM-DD
    createdAt: v.number(),
  })
    .index("by_task", ["taskId"])
    .index("by_task_date", ["taskId", "completedDate"])
    .index("by_user_date", ["userId", "completedDate"]),

  healthScores: defineTable({
    userId: v.string(),
    areaId: v.id("areas"),
    score: v.number(),
    calculatedAt: v.number(),
  })
    .index("by_area", ["areaId"])
    .index("by_user", ["userId"]),

  weeklyReviews: defineTable({
    userId: v.string(),
    weekOf: v.string(), // YYYY-MM-DD (Monday)
    content: v.string(),
    wins: v.optional(v.string()),
    improvements: v.optional(v.string()),
    tasksCompleted: v.number(),
    tasksMissed: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_week", ["userId", "weekOf"]),

  notes: defineTable({
    userId: v.string(),
    content: v.string(),
    pinned: v.optional(v.boolean()),
    taskId: v.optional(v.id("tasks")), // linked task
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_task", ["taskId"]),
});
