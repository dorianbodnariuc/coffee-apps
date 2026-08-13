# Coffee App — T8 QA Checklist (Android / Expo Go)

> Run this on your Android phone via Expo Go. Start the dev server (`npx expo
> start`, port 8081) and open the app. Tick each item pass (✓) or fail (✗) and
> note anything odd. iOS is out of scope for this pass (no iOS device) — it
> stays "smoke only" until one is available.

## 0. Boot & navigation
- [ ] App loads without a red screen or crash splash (also verified headlessly:
      `npx expo export --platform android` bundles clean).
- [ ] Three tabs render: Log, History, Dictionary.
- [ ] Tapping each tab switches screens instantly.
- [ ] Gear icon (⚙) appears top-right on History and opens Settings.

## 1. Log form (create)
- [ ] Fill bean name, method, dose 20 / water 300 → ratio shows 15.0.
- [ ] Blank dose or water → ratio stays blank; brew still saves (NULL ratio).
- [ ] "Calculate ratio" widget expands; fill any two of dose/water/ratio → the
      third computes live. Presets 1:15 / 1:16 / 1:17 prefill ratio.
- [ ] Calculator works with device in airplane mode (it's pure local math — no
      network). Toggle airplane mode, compute, confirm no error.
- [ ] Rating chips step 0.5 (1.0 … 5.0). Empty method + Save → validation error
      banner and field message; no crash.
- [ ] Signed out: save a brew → footer shows "1 brew logged"; save a 2nd → soft
      wall "Keep your brews safe" appears with Sign up.

## 2. Save failure (new — verify this fix)
- [ ] Signed in, turn off Wi-Fi/data, save a brew → footer shows "Couldn't save
      your brew — check your connection and try again." and your input is STILL
      in the form (not wiped). Reconnect, tap Save again → it saves.

## 3. History
- [ ] Summary header shows brew count, avg rating (★), streak.
- [ ] Method / rating / date-range filters return only matching rows.
- [ ] Filter to an empty set → "No brews match these filters." + Clear filters.
- [ ] Empty history (new account) → "No brews yet — log your first brew."
- [ ] Tap a row → detail shows all fields. Edit changes persist. Delete removes
      it after confirm.

## 4. Dictionary (search regression pass — T11c)
- [ ] "pourover" finds "Pour Over".
- [ ] "water temperature" finds "Coffee Brewing Temperature".
- [ ] "steamed milk" finds "Cappuccino".
- [ ] "brew temperature" finds "Coffee Brewing Temperature".
- [ ] "espresso golden" finds "Crema".
- [ ] "brew" finds "Coffee Brewing Temperature".
- [ ] "AA" finds "AA Coffee Grading".
- [ ] "of the" returns NO results (stopword fix — was returning spurious hits).
- [ ] "a" returns NO results.
- [ ] Exact-term hits rank above definition-only hits for the same query.
- [ ] Tap a term → modal shows definition/category; related terms are tappable
      and swap the modal without losing your search text.

## 5. Settings / account
- [ ] Signed out → shows "Signed out" + sign-in prompt.
- [ ] Sign out → returns to signed-out state, History shows the sign-in prompt.
- [ ] Delete account → confirm dialog; account + all brews removed; re-signup
      with same email starts clean (only run this on a throwaway test account).

## 6. No red screens / rejections
- [ ] Entire pass above produces no red error screens and no unhandled promise
      warnings in the Metro console.

## Notes / failures found
<!-- e.g. "Dictionary: 'X' query returned unexpected term 'Y'" -->
