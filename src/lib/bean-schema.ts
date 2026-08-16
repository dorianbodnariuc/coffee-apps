import { z } from "zod";

/**
 * Bean cellar entry (T9). Only `name` is required; roaster/origin/roastDate
 * are optional. roastDate is a "YYYY-MM-DD" string or null (empty -> null).
 */
export const beanSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Bean name is required")
    .max(120, "Bean name is too long (max 120 chars)"),
  roaster: z.string().max(120, "Roaster is too long (max 120 chars)"),
  origin: z.string().max(120, "Origin is too long (max 120 chars)"),
  roastDate: z
    .string()
    .nullable()
    .refine(
      (value) =>
        value == null ||
        value === "" ||
        /^\d{4}-\d{2}-\d{2}$/.test(value),
      { message: "Invalid roast date" },
    ),
});

export type BeanInput = z.infer<typeof beanSchema>;
