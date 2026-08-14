# Design Review — 2026-08-14

Reviewer: Design Reviewer advisor (`.hermes/agents/design-reviewer.md`), model
kimi-k2.6 / kimi-coding. Code-level audit of the current UI source (15 files).
This is the starting fix-list for T22 (design system + visual polish).

## Verdict
**polish-needed**

## Blockers
1. `theme.ts` — missing semantic tokens (primary, accent, danger, border,
   success, disabled) — add `primary`, `danger`, `dangerText`, `border`,
   `success`, `disabled` to Colors.light/dark.
2. `chip-select.tsx` — chip `paddingVertical: 6` ≈ 30px height — set
   `minHeight: 44`, `paddingVertical: 10`.
3. `themed-text.tsx` — `title` 48px is a template leftover — change to
   `fontSize: 28`, `lineHeight: 34`.
4. `brew-log-form.tsx` — input `paddingVertical: 10` ≈ 38px fields — set
   `minHeight: 44`, `paddingVertical: 12`.
5. `ratio-calculator.tsx` — inputs/chips too small — input `minHeight: 44`;
   chip `minHeight: 40`, `paddingVertical: 10`.

## Major
6. `_layout.tsx` — header buttons hardcode `#ffffff`/`#000000`; emoji ⚙ used as
   settings icon — use theme tokens + a real icon + `hitSlop={12}`.
7. `brew-detail-screen.tsx` — hardcoded danger `#3D1A1A`/`#E57373` — use
   `theme.danger`/`theme.dangerText`.
8. `settings-screen.tsx` — same hardcoded danger hexes; row `paddingVertical: 8`
   ≈ 32px — tokens + `minHeight: 44`.
9. `auth-screen.tsx` — error `#C0392B` hardcoded; `KeyboardAvoidingView`
   `behavior` undefined on Android — use `theme.danger`; set `behavior="height"`.
10. `history-screen.tsx`, `dictionary-screen.tsx`, `auth-screen.tsx`,
    `settings-screen.tsx` — empty/error/signed-out states top-aligned — wrap
    `messageBox` in `flex:1` + center.
11. `chip-select.tsx` — no pressed feedback — add `pressed` opacity state.
12. `history-screen.tsx` — summary labels uppercase 11px too small/low contrast;
    primary button `paddingVertical: 10` ≈ 35px — 12px labels; `minHeight: 44`.

## Minor
13. `themed-text.tsx` — `linkPrimary` hardcodes `#3c87f7` — move to
    `theme.primary`.
14. `themed-view.tsx` — `lightColor`/`darkColor` props destructured but unused —
    remove or wire.
15. `themed-text.tsx` — `code` `fontWeight` Android-only — add iOS/default.
16. `theme.ts` — no radius/elevation tokens — add `Radius` + `Elevation` tokens;
    refactor ad-hoc 8/10/14/16/18/20 values.

## Design-system gaps
- Missing `primary`, `accent`, `danger`, `dangerText`, `border`, `success`,
  `disabled`, `overlay` tokens.
- Missing unified `Typography` type scale (caption/body/headline/title).
- No `Button`, `Input`, `Chip`, `Icon` primitives — every screen reinvents them.
- No elevation/shadow tokens.

## Quick wins (low effort, high impact)
1. `minHeight: 44` on all chips and inputs.
2. Reduce `ThemedText` title 48px → 28px.
3. Center all empty/error/signed-out message boxes.
4. Replace hardcoded danger/error hexes with `theme.danger`.
5. Add `minHeight: 44` + pressed opacity to `ChipSelect`.

## On-device visual check (still needs a human eyeball on Android)
- Empty/signed-out/error states on a small screen (centered vs top-aligned).
- Chip/input touch target sizes with a thumb.
- 48px title rendering in Log/Auth headers.
- Danger button contrast in light + dark mode.
- Keyboard pushing form fields up on Android.
- Modal backdrop + card height on 5-inch screens.
