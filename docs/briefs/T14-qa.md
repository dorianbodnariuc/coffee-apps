# T14 — Phase 2 QA / polish

Goal: verify cellar + content + photos end-to-end after T9/T13/T18/T19/T22/T23
land. Not a build ticket — a verification pass against the live app.

## Scope (regression checklist — see `docs/qa-checklist.md`)
- Every Phase 1 flow still green: log a brew (now method-first), history list +
  detail + filters, glossary browse/search, saved terms.
- New Phase 2 flows: bean cellar CRUD + freshness badges, photo upload/delete,
  "Your terms" (signed-in), personal notes, method-specific params (T23).
- States: empty/loading/error/signed-out on every screen.
- Auth: soft wall, contextual sign-in (save/your-terms), account deletion.

## Task
1. Run `docs/qa-checklist.md` on device (Android primary, iOS smoke).
2. Fix found issues; re-run failing checks.
3. Design Reviewer sign-off (T22) must already be green.

## Acceptance criteria
- QA checklist green; no regressions in Phase 1 flows.
- No unhandled rejections / red screens in the QA session.

## Verification
On-device (user runs Expo Go); headless typecheck/lint/tests green.
