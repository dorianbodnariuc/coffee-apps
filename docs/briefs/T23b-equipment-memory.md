# T23b — Equipment memory (last-used prefill)

Goal: remember the user's last grinder/dripper/machine/temp per method so the
next log is "dose + setting" only. Removes two fields every morning and protects
the share card (D-028 item 2; Product Advisor "should").

## Context
- Builds on T23 (METHOD_SPECS + the new columns). Do not build before T23 lands.
- No schema change — pure client persistence.

## Task
1. `src/lib/brew-prefs.ts`: load/save a `brew_prefs` object in AsyncStorage:
   `{ [method]: { grinder?, grind_size?, dripper?, filter?, machine?,
   orientation?, water_temp_c? } }`.
2. `brew-log-form.tsx`: on method selection, read `brew_prefs[method]` and
   prefill grinder/grind_size/dripper/filter/machine/orientation/water_temp_c
   (only fields the user hasn't already typed). On successful save, merge the
   current values back into `brew_prefs[method]`.
3. Per-method scoping (espresso grinder ≠ pour-over grinder). No global defaults.

## Acceptance criteria
- Selecting a method prefills equipment from the last log of that method;
  switching method swaps the prefill.
- Prefs survive app restart and are per-method.
- Typing overrides a prefill (doesn't get clobbered on save).

## Out of scope
- Grinder catalog / shared equipment profiles (deferred).
- Cloud sync of prefs (local-only for now; account sync is a later ticket).
