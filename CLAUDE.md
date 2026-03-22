# Life OS — Personal Life Tracker

## Stack
- Next.js 16 (App Router, TypeScript, Tailwind v4)
- Convex (real-time DB + backend functions)
- Clerk (auth)
- Shadcn/ui + custom Pulse dark design system

## Design System — Pulse Dark
- **Colors:** Import `P` from `src/constants/colors.ts` — NEVER hardcode hex values
- **Fonts:** `font-display` (Cormorant Garamond) for headings/italic, `font-ui` (Outfit) for all UI text
- **Rules:** 1px borders only · no shadows · no gradients · max 4px border-radius · gold ≤8× per screen
- Tailwind v4: theme tokens defined in `src/app/globals.css` via `@theme inline` (no tailwind.config.ts)

## Dev Commands
```bash
# Start Next.js
npm run dev

# Start Convex (separate terminal — generates _generated/ dir)
npx convex dev
```

## Key Env Vars
- `NEXT_PUBLIC_CONVEX_URL` — from Convex dashboard
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` — from Clerk dashboard
- `CLERK_SECRET_KEY` — from Clerk dashboard
## Architecture
- Convex handles DB, real-time queries, and mutations
- All queries/mutations scope by `userId` (from Clerk)
- Health scores calculated from task completion + goal progress + recency
- Weekly reviews are written manually by the user

## Important: Convex _generated/
Run `npx convex dev` before first use — it generates `convex/_generated/api.ts` and `dataModel.ts`
which are imported throughout the app.

## Route Structure
- `/today` — dashboard with today's focus, area health, AI coach
- `/backlog` — flat task list sorted by due date
- `/goals` — goals grouped by area with progress bars
- `/area/[id]` — kanban board per life area
- `/timeline` — project milestones (stub)
- `/reviews` — weekly AI-generated reviews
- `/settings` — account + preferences
- `/sign-in` — Clerk auth page

## Testing

- **Run:** `npm test` (unit) · `npm run test:e2e` (E2E)
- **Docs:** See `TESTING.md`
- Write a test for every new function, bug fix, and both paths of every conditional
- Never commit code that makes existing tests fail

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
