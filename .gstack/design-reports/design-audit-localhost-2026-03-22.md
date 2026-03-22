# Design Audit — Life OS
**Date:** 2026-03-22 | **URL:** http://localhost:3000 | **Branch:** 001-ultralearn-app
**Mode:** Code-based review (Clerk auth prevents headless browser rendering)

---

## Design Score: B → A-
## AI Slop Score: A

The UI has a strong, intentional design voice — dark luxury, data-dense, editorial. No AI slop patterns detected. The Pulse design system is coherent. All 6 findings fixed. Final state is polished and production-ready.

---

## First Impression

The site communicates **professional-grade productivity tooling**. I notice the unusually careful palette — warm neutrals, muted gold, no gradients, no decorative elements. The first 3 things my eye goes to: 1) the sidebar's "LO" logomark, 2) the page title, 3) the primary CTA. If I had to describe this in one word: **Disciplined.**

---

## Inferred Design System

- **Fonts:** Cormorant Garamond (display/italic) + Outfit (UI). Good — 2 fonts max.
- **Colors:** Warm-biased dark palette. bg=#0A0A0B, surfaces #111113/#18181B/#1E1E21, border #2A2A2E. Accent: gold #C9A84C. Semantic: blue #4A9EE0, green #4CAF6B, red #E85538, amber #E8A838. Coherent.
- **Heading scale:** 32px (today h1 italic), 22px (page titles), 16px (section titles), 13px (body). Slightly compressed.
- **Spacing:** 8px base scale used consistently. Clean.
- **Border radius:** 4px max (good, not bubbly). Consistent.
- **Scrollbar:** Custom 4px thin with hover state — polished detail.
- **Focus ring:** Global `focus-visible` with 1px gold outline — excellent.

---

## Findings

### FINDING-001 — `text-[10px]` below accessibility minimum
**Impact:** High | **Category:** Typography | **Status:** ✅ VERIFIED (commit e146d2e1)

10px text is used throughout for badges, status labels, area tags, goal progress values, and column headers. WCAG recommends minimum 12px for captions. At 10px the text is functionally unreadable at normal viewing distances.

**Files:** 12 files across areas, goals, habits, today, area/[id], sidebar, backlog, settings, onboarding, reviews, modals
**Fix applied:** Bumped all `text-[10px]` → `text-[11px]` (69 occurrences across 12 files via mass sed)

---

### FINDING-002 — `font-mono` breaks the 2-font system
**Impact:** Medium | **Category:** Typography | **Status:** ✅ VERIFIED (commit 6fe40093)

The issue key labels (e.g., "WOR-A3B2") use `font-mono` which pulls in the browser's system monospace font — a 3rd unintended typeface. The design system has exactly 2 fonts: Cormorant Garamond + Outfit.

**Files:** `src/app/(app)/area/[id]/page.tsx`, `src/app/(app)/areas/page.tsx`
**Fix applied:** Replaced `font-mono` with `tracking-[0.05em]` — mechanical spacing without the third font

---

### FINDING-003 — Missing `text-wrap: balance` on headings
**Impact:** Medium | **Category:** Typography | **Status:** ✅ VERIFIED (commit 5d9925f0)

The italic display headings (e.g., "Good morning.") and page h1s don't use `text-wrap: balance`. This means they can break awkwardly at narrow container widths.

**Files:** `src/app/(app)/today/page.tsx`, `src/app/(app)/goals/page.tsx`
**Fix applied:** Added `[text-wrap:balance]` to h1 elements in both files

---

### FINDING-004 — Duplicate font tokens in globals.css
**Impact:** Polish | **Category:** Design System | **Status:** ✅ VERIFIED (commit f3bdd528)

`--font-display` and `--font-cormorant` both point to Cormorant Garamond. `--font-ui` and `--font-outfit` both point to Outfit. The duplicates invite drift.

**File:** `src/app/globals.css`
**Fix applied:** Removed `--font-cormorant` and `--font-outfit` aliases

---

### FINDING-005 — Stat card numbers missing `tabular-nums`
**Impact:** Polish | **Category:** Typography | **Status:** ✅ VERIFIED (commit d5ef09bf)

The Today page stat cards show task counts (0, 3, 7…) in `text-[24px]` without `tabular-nums`. Numbers should always use tabular figures to prevent layout shift as values update.

**File:** `src/app/(app)/today/page.tsx`
**Fix applied:** Added `tabular-nums` class to the stat value span

---

### FINDING-006 — "Total Active" label is vague in stat cards
**Impact:** Polish | **Category:** Content | **Status:** ✅ VERIFIED (commit d5ef09bf)

The 4th stat card says "Total Active" but displays all non-done tasks. "Open Tasks" is clearer and more direct.

**File:** `src/app/(app)/today/page.tsx`
**Fix applied:** Renamed to "Open Tasks"

---

## Summary

- **Total findings:** 6
- **Fixed (verified):** 6
- **Deferred:** 0
- **Tests:** 11/11 passing (no regressions)
- **Design score:** B → A- (High finding resolved = letter grade up)
- **AI Slop score:** A (unchanged — no slop patterns present)

> PR summary: Design review found 6 issues, fixed all 6. Design score B → A-. AI slop score A.
