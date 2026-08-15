import { z } from "zod";

import { BREW_METHODS, RATING_SCALE } from "@/constants";
import { METHOD_SPECS, type MethodParam } from "@/constants/method-specs";

/**
 * Validation rules for a brew log entry (plan v1.2 / ticket T3, revised T23).
 *
 * Design notes:
 * - Bean fields are free-text snapshots (bean_name/roaster/origin copied onto
 *   the log; a P2 `bean_id` soft link never mutates history).
 * - `ratio` is NOT part of the input: it is a STORED generated column
 *   (yield/dose for espresso, water/dose otherwise — D-028), read-only.
 * - dose/water/yield are optional and zero is allowed, matching the DB rule
 *   "dose = 0 / blank liquid ⇒ insert succeeds with NULL ratio".
 * - `method_params` is an open record validated in `superRefine` against
 *   `METHOD_SPECS[method]` — unknown keys rejected, numbers range-checked,
 *   enums must be in options. Registry keys are append-only.
 * - Only `method` is required; every other field is optional (D-028 item 5).
 */

export const brewLogSchema = z
  .object({
    /** ISO-8601 timestamp. */
    brewedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
      message: "Invalid date/time",
    }),
    beanName: z.string().max(120, "Bean name is too long (max 120 chars)"),
    roaster: z.string().max(120, "Roaster is too long (max 120 chars)"),
    origin: z.string().max(120, "Origin is too long (max 120 chars)"),
    method: z.enum(BREW_METHODS, { message: "Choose a brew method" }),
    grinder: z.string().max(120, "Grinder is too long (max 120 chars)"),
    grindSize: z.string().max(60, "Grind size is too long (max 60 chars)"),
    doseG: z.number().min(0, "Dose can't be negative").nullable(),
    waterG: z.number().min(0, "Water can't be negative").nullable(),
    yieldG: z.number().min(0, "Yield can't be negative").nullable(),
    waterTempC: z
      .number()
      .min(0, "Temperature can't be below 0 °C")
      .max(100, "Temperature can't be above 100 °C")
      .nullable(),
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
    methodParams: z.record(z.string(), z.unknown()),
  })
  .superRefine((value, ctx) => {
    validateMethodParams(value.method, value.methodParams, ctx);
  });

function validateMethodParams(
  method: (typeof BREW_METHODS)[number],
  params: Record<string, unknown>,
  ctx: z.RefinementCtx,
): void {
  const spec = METHOD_SPECS[method];
  const known = new Map(spec.params.map((p) => [p.key, p]));
  for (const [key, raw] of Object.entries(params)) {
    if (raw === undefined || raw === null || raw === "") continue;
    const param = known.get(key);
    if (!param) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `"${key}" is not a parameter for ${spec.label}`,
        path: ["methodParams", key],
      });
      continue;
    }
    checkParam(param, raw, ctx);
  }
}

function checkParam(
  param: MethodParam,
  raw: unknown,
  ctx: z.RefinementCtx,
): void {
  const { spec } = param;

  if (spec.kind === "enum") {
    if (typeof raw !== "string" || !spec.options.includes(raw)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${param.label} must be one of: ${spec.options.join(", ")}`,
        path: ["methodParams", param.key],
      });
    }
    return;
  }

  if (spec.kind === "text") {
    if (typeof raw !== "string") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${param.label} must be text`,
        path: ["methodParams", param.key],
      });
    } else if (spec.maxLength != null && raw.length > spec.maxLength) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${param.label} is too long (max ${spec.maxLength} chars)`,
        path: ["methodParams", param.key],
      });
    }
    return;
  }

  // number
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${param.label} must be a number`,
      path: ["methodParams", param.key],
    });
    return;
  }
  if (spec.min != null && raw < spec.min) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${param.label} can't be below ${spec.min}`,
      path: ["methodParams", param.key],
    });
  }
  if (spec.max != null && raw > spec.max) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `${param.label} can't be above ${spec.max}`,
      path: ["methodParams", param.key],
    });
  }
}

export type BrewLogInput = z.infer<typeof brewLogSchema>;
