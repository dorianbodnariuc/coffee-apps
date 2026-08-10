# CONVENTIONS.md — Coffee App

Single source of truth for how this repo is built. Every ticket brief references
this file; if something here is wrong, fix this file and the briefs follow.

## Tech stack
- **Framework:** React Native via Expo (SDK 57), TypeScript (strict).
- **Navigation:** expo-router (file-based), tab layout in `src/app/_layout.tsx`.
- **State/data:** React Query for server state (ticket T3+), Zustand for
  client-only state when needed. Supabase backend (tickets T2+).
- **Auth:** Supabase Auth (soft wall — first brew log allowed pre-signup).
- **Formatting/linting:** ESLint (eslint-config-expo) + Prettier.

## Folder structure (`src/`)
- `src/app/` — expo-router routes only (thin route files; no logic).
- `src/screens/` — screen components (one per route, `-screen` suffix).
- `src/components/` — reusable UI components.
- `src/lib/` — non-UI code: clients, utils, pure logic (e.g., ratio math in T5).
- `src/hooks/` — custom hooks.
- `src/constants/` — ALL shared enums/thresholds (single home; no magic strings).
- `src/types/` — shared TypeScript types.

## Naming
- Components: PascalCase (`LogScreen`, `RatingPicker`), file name = component name.
- Functions/variables/files: camelCase (`brewLog`, `lib/ratio.ts`).
- Constants/enums: UPPER_SNAKE (`BREW_METHODS`, `PHOTO_CAPS`).
- Types: PascalCase (`BrewMethod`, `BrewLogInput`).
- Routes: lowercase kebab-case files in `src/app/`.

## TypeScript rules
- `strict: true`, `noUnusedLocals: true` — keep both on.
- No `any` in new code; prefer `unknown` + narrowing.
- `as const` for enum arrays; derive types with `(typeof X)[number]`.

## Commits
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `style:`, `refactor:`,
  `test:`.
- One logical change per commit; commit after each task (ticket granularity).
- Never commit secrets (`.env*` are gitignored), `node_modules/`, or build output.

## Verification (run before finishing a ticket)
- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm run format` — applied (Prettier)
- Ticket-specific acceptance criteria — all met (ticket partition doc)
