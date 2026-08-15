# Visual Review — 2026-08-14 (grok-4.6, native vision)

App rendered at 1512×736 via Expo web SPA (cloudflared tunnel). Review = pixels, not code.
Android will not show the full-bleed width stretch (#4); #1–2, #5–7 will still hurt on Android.

## Blockers
1. **[all / Dictionary term / Settings / Auth]** Red Expo overlay: `<button> cannot contain a nested <button>` sits on the tab bar and hides Log. Invalid-DOM crash on web. — Un-nest Pressable/`<button>` (term row + Save, tab button wrapping an icon button).
2. **[Log / signed-out]** Sticky "No brews logged yet this session." / "Session-only…" banner sits ON TOP of Brew time and Pressure (input y=646, banner y=648). — Give the session strip its own 48px slot above the tab bar; add 56px scroll padding-bottom.

## Major
3. **[all tabs, web]** Every tab icon renders as a ⏷ triangle (Log active=blue, rest gray). Vector icons failed on web. — Load `@expo/vector-icons` web font, or SVG fallbacks (plus/clock/book). 44×44 hit area per tab.
4. **[all screens, web]** Inputs, chip rows, Save, Sign in/out, term rows all stretch ~1465px. — Cap content `max-width: 430px; margin: 0 auto` (phone frame). Native unaffected.
5. **[Log]** Method chips 28×~80px, rating chips 28×44–46px, inputs 38px — all < 44px. — Chips `min-height: 44px; padding: 10px 14px`; inputs `height: 44px; padding: 12px 14px`.
6. **[Settings / signed-out]** Only action is a full-bleed gray "Sign out" (1464×46). "Sign in or create an account" is 13px caption, not a control. Header "settings" vs page "Settings". — Hide Sign out when signed out; sign-in = 48px primary; title-case header.
7. **[Log / Recipe details / Espresso]** Basket "0 g", Machine "0", Pressure "0 bar" look filled. Selected method chip vs idle `#E0E1E6` vs `#F0F0F3` (near-invisible). — Empty numeric = placeholder, not 0. Selected chip fill `#1C1C1E` / label `#FFF`.
8. **[Auth]** Route header "auth"; "Sign in" is a 1464px muted bar reading disabled; Email/Password 42px; ~230px empty above "Welcome back". — Header "Sign in"; primary `#007AFF`/`#1C1C1E` height 48; collapse spacer to 24px.

## Minor
9. **[Dictionary]** "General Terms" clipped off chip row; "377" ~11px baseline-misaligned; last row clipped by tabs. Term modal "diameter .", "peaberry )"; Close = 1464px gray slab. — Horizontal chip scroll + fade; count 13px centered; list `padding-bottom: 80px`; modal `max-width: 480px`; Close 48px.
10. **[History / signed-out]** Dual titles ("History" 18px + "Your history" 20px/700); filters absent (empty state only); gear 27×23. — One title; gear 44×44; empty state = 16px body + one 48px Sign-in.
11. **[Log chrome]** H1 "Log" 18px/500; section labels 12px/600 `#60646C`; Save brew 46px `#E0E1E6` = same mute as disabled. — H1 22–24px/700; primary save `#1C1C1E` / `#FFF`.

## Verdict
**polish-needed** (redesign-needed on web width + icons). Native may dodge #3–4; #1–2, #5–7 still hurt on Android.

## Design-system gaps (→ T22)
- No web `maxWidth`/phone-frame.
- No Chip size token (28 vs 44).
- No primary button token (everything is `#F0F0F3`/`#E0E1E6`).
- No icon fallback for web.
- No sheet/modal max-width.
- No sticky-footer offset.
- No empty-state component.
- Stack titles leak route slugs (`auth`, `settings`).

## Not reviewed
`/brew/[id]` — no saved brew in this session (needs a signed-in user with ≥1 logged brew).
