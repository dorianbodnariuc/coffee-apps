# T22 — Design system completion + visual polish

Goal: make the app beautiful and pleasant, not just functional. The theme layer
is a partial Expo template. Fix list: `docs/reviews/design-review-2026-08-14.md`
(code-level) + `docs/reviews/visual-review-2026-08-14.md` (pixel-level, grok-4.6
vision — incl. web-only bugs).

## Context (read first)
- `src/constants/theme.ts` — only 5 semantic colors, no accent/danger/border, no
  radius/elevation tokens; `Spacing` exists but is underused.
- `src/components/themed-text.tsx` — 48px `title`, 32px `subtitle` (template
  cruft); hardcoded `#3c87f7` in `linkPrimary`.
- `src/components/themed-view.tsx` — `lightColor`/`darkColor` unused.
- Screens mix `ThemedText`/`ThemedView` with raw `useTheme()` + inline styles
  (`history-screen.tsx` is the worst).
- D-009: touch targets ≥44px interactive, ≥40px in modals.

## Task 1 — Complete the token layer (`src/constants/theme.ts`)
Add to BOTH `light` and `dark`: `primary` (warm coffee amber/brown — pick one,
e.g. light `#8B5E3C` / dark `#C68B59`), `danger`, `dangerText`, `border`,
`success`, `disabled`, `overlay`. Add `Radius = { sm: 8, md: 12, lg: 16 }` and an
`Elevation` (or shadow) token. Keep `ThemeColor` type = keys of light ∩ dark.

## Task 2 — Fix the type scale (`themed-text.tsx`)
Replace `title` 48px → 28px/34 lineHeight; `subtitle` 32px → 20px/26. Add a
`sectionTitle` (14px/600) and `caption` (12px) variant. Replace hardcoded
`#3c87f7` in `linkPrimary` with `theme.primary`.

## Task 3 — Unify components
- Every screen uses `ThemedText`/`ThemedView` (or the identical
  `useTheme()` + `StyleSheet` pattern). Reconcile `history-screen.tsx`.
- grep `#` for hex literals outside `theme.ts` — replace all with tokens
  (danger reds in `brew-detail-screen.tsx`, `settings-screen.tsx`,
  `auth-screen.tsx`; header button colors in `app/_layout.tsx`).

## Task 4 — Touch targets + spacing
- `chip-select.tsx`: `minHeight: 44`, `paddingVertical: 10`, add pressed-opacity
  feedback.
- Form inputs (`brew-log-form.tsx`, `ratio-calculator.tsx`): `minHeight: 44`.
- `settings-screen.tsx` rows: `minHeight: 44`.
- Replace ad-hoc numeric padding with `Spacing` tokens.

## Task 5 — State polish
Center empty/loading/error/signed-out message boxes
(`flex:1` + `justifyContent:'center'` + `alignItems:'center'`) on history,
dictionary, auth, settings. Give each a designed empty state (icon + copy), not
bare text. `_layout.tsx`: replace the emoji ⚙ with a real settings icon +
`hitSlop={12}`.

## Task 6 — Web + blocker fixes (from visual-review-2026-08-14.md)
- **Invalid DOM nesting** (blocker): un-nest Pressable/`<button>` in the term
  row + Save, and any tab button wrapping an icon button. This throws a red
  `<button> cannot contain a nested <button>` overlay on web.
- **Sticky session strip** (blocker): give "No brews logged yet this session"
  its own 48px slot above the tab bar; add 56px scroll padding-bottom so it
  doesn't overlay Brew time/Pressure.
- **Web width**: cap content `max-width: 430px; margin: 0 auto` (phone frame);
  modal/sheet `max-width: 480px`.
- **Icon fallback**: load `@expo/vector-icons` web font (or SVG fallbacks) — all
  tab icons currently render as ⏷ triangles on web.
- **Selected chip contrast**: selected = fill `#1C1C1E` / label `#FFF` (not
  `#E0E1E6` vs `#F0F0F3`).
- **Empty numeric fields**: placeholder, not `0` (Basket/Machine/Pressure show
  "0 g"/"0 bar" as if filled).
- Sign-out hidden when signed out; sign-in = 48px primary button.

## Task 7 — Sign-off
Run the Design Reviewer (`coffee-app-advisors` skill) on the diff AND the Visual
Reviewer (grok-4.6) on the served web build; verdict must be ships-as-is (all
blocker/major resolved). Android-first on-device check by the user.

## Acceptance criteria
- grep finds no raw hex outside `theme.ts` (except token definitions).
- No 48px titles remain; type scale used consistently.
- Interactive targets ≥44px (≥40px in modals).
- Every screen has a designed empty + loading + error state.

## Verification
`npm run typecheck && npm run lint && npm test`; Android export builds; on-device
visual pass.
