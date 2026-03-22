# Testing — Life OS

> 100% test coverage is the key to great vibe coding. Tests let you move fast, trust your instincts, and ship with confidence — without them, vibe coding is just yolo coding. With tests, it's a superpower.

## Framework

- **Unit/Integration:** Vitest v4 + @testing-library/react + jsdom
- **E2E:** Playwright (Chromium)

## Running Tests

```bash
# Unit tests (run once)
npm test

# Unit tests (watch mode)
npm run test:watch

# E2E tests (requires `npm run dev` running)
npm run test:e2e
```

## Test Layers

| Layer | What | Where | When |
|-------|------|-------|------|
| Unit | Pure helpers, utilities, hooks | `src/__tests__/` | Always — fast, no deps |
| Integration | React components with mocked Convex | `src/__tests__/` | Component logic and rendering |
| E2E | Full user flows in a real browser | `e2e/` | Critical paths before shipping |

## Conventions

- Files: `*.test.ts` / `*.test.tsx` inside `src/__tests__/`
- Assertions: use `expect(x).toBe(y)` / `toBeInTheDocument()` — never just `toBeDefined()`
- Setup: `src/test/setup.ts` imports `@testing-library/jest-dom`
- Convex queries/mutations: mock via `vi.mock` — don't hit real backend in unit tests
