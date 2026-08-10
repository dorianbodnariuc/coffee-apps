import { z } from "zod";

import { BREW_METHODS, RATING_SCALE } from "@/constants";

/**
 * Validation rules for a brew log entry (plan v1.2 / ticket T3).
 *
 * Design notes:
 * - Bean fields are free-text snapshots (bean_name/roaster/origin are copied
 *   onto the log; a P2 `bean_id` soft link never mutates history).
 * - `ratio` is NOT part of the input: it is a STORED generated column
 *   (water/dose, NULL when dose <= 0) — client read-only. The form displays it
 *   via the ratio calculator; the DB derives it on write.
 * - dose/water are optional and zero is allowed, matching the DB rule
 *   "dose = 0 / blank water ⇒ insert succeeds with NULL ratio".
 * - Validation must block: negative dose/water, rating outside 1.0–5.0 in
 *   0.5 steps, empty method, invalid date.
 */

export const brewLogSchema = z.object({
  /** ISO-8601 timestamp. */
  brewedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Invalid date/time",
  }),
  beanName: z.string().max(120, "Bean name is too long (max 120 chars)"),
  roaster: z.string().max(120, "Roaster is too long (max 120 chars)"),
  origin: z.string().max(120, "Origin is too long (max 120 chars)"),
  method: z.enum(BREW_METHODS, { message: "Choose a brew method" }),
  grindSize: z.string().max(60, "Grind size is too long (max 60 chars)"),
  doseG: z.number().min(0, "Dose can't be negative").nullable(),
  waterG: z.number().min(0, "Water can't be negative").nullable(),
  brewTimeSeconds: z
    .number()
    .int("Brew time must be whole seconds")
    .min(0, "Brew time can't be negative")
    .nullable(),
  tastingNotes: z.string().max(2000, "Notes are too long (max 2000 chars)"),
  rating: z
    .number()
    .refine((value) => (RATING_SCALE as readonly number[]).includes(value), {
      message: "Rating must be 1.0–5.0 in 0.5 steps",
    })
    .nullable(),
});

export type BrewLogInput = z.infer<typeof brewLogSchema>;
