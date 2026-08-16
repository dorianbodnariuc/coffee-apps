# T25 — Autocomplete inputs (type-ahead + free-type create)

Goal: a reusable type-ahead input for bean name / origin / roaster in the bean
form (and the brew form's bean picker), with a free-type "Add new" fallback.

## Context
- Builds on T24 (catalog API). D-033: type-ahead + free-type create.
- Suggestion sources: bean name → the user's own beans (+ origins); origin →
  `origins` table; roaster → `roasters` table.
- Selecting a row fills the field AND sets the FK (`roaster_id`/`origin_id`);
  "Add new" creates a name-only global row via T24 `getOrCreate`.

## Tasks
1. `src/components/autocomplete-input.tsx`: a `TextInput` with a dropdown of
   matches filtered from a passed `options` list as the user types. Tap a
   suggestion → `onSelect(option)`. When `allowCreate` is set and the typed
   text has no exact match, show an "Add 'X'" row → `onCreate(text)`. 44px
   targets (D-009). Dismiss on blur/backdrop; do not steal focus.
2. Wire into `bean-form-modal.tsx`: name, origin, roaster fields become
   autocomplete inputs. On select, set the field text + capture the FK id;
   on "Add new", call the catalog mutation and set the FK. Clearing the field
   clears the FK.
3. Extend `bean-schema`/`BeanInput` and `beans-api` row mapping for
   `roaster_id`/`origin_id` (the cellar bean stores the soft links).
4. Bean-name suggestions in the brew form's `bean-picker-modal.tsx` reuse the
   same catalog data where it lists beans (skip if out of scope this pass).

## Acceptance criteria
- Typing filters suggestions; selecting fills the field and sets the FK.
- Typing an unseen origin/roaster and choosing "Add new" creates a global row
  and links it (dedup via T24 `getOrCreate`).
- Free text stays editable; clearing a field clears its FK; the snapshot text
  is always saved (D-001).
- Targets ≥44px; save/error behavior unchanged (D-010).

## Verification
`npm run typecheck && npm run lint && npx vitest run`; on-device: add a bean,
use autocomplete for origin + roaster, then type a brand-new roaster via
"Add new" and confirm it links.

## Out of scope
- Roaster directory UI + paid-field rendering (D-030/D-031, deferred).
