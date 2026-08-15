import type { BrewMethod } from "@/constants";

/**
 * Method-specific parameter registry (D-028 / T23). The single source of truth
 * for which structured parameters each brew method has, their types, units, and
 * options. The log form renders fields from here; zod validates `method_params`
 * against it. Adding a method or a parameter is a registry change, not a
 * migration. Keys are append-only (never rename/remove).
 *
 * `measures` tells the ratio whether to use beverage-out (espresso) or water-in
 * (everything else). dose / water / yield / time / grinder / grind_size are
 * COLUMNS, not registry params — the registry only holds the collapsed
 * "Recipe details" extras.
 */

export type ParamSpec =
  | { kind: "number"; unit?: string; step?: number; min?: number; max?: number }
  | { kind: "text"; maxLength?: number }
  | { kind: "enum"; options: readonly string[] };

export type MethodParam = {
  key: string;
  label: string;
  spec: ParamSpec;
};

export type MethodSpec = {
  label: string;
  measures: "water_in" | "yield_out";
  params: MethodParam[];
};

export const METHOD_SPECS: Record<BrewMethod, MethodSpec> = {
  espresso: {
    label: "Espresso",
    measures: "yield_out",
    params: [
      { key: "basket_size_g", label: "Basket size (g)", spec: { kind: "number", unit: "g", min: 0 } },
      { key: "machine", label: "Machine", spec: { kind: "text", maxLength: 80 } },
      { key: "pressure_bar", label: "Pressure (bar)", spec: { kind: "number", unit: "bar", step: 0.5, min: 0 } },
      { key: "pre_infusion_s", label: "Pre-infusion (s)", spec: { kind: "number", unit: "s", min: 0 } },
    ],
  },
  "pour-over": {
    label: "Pour Over",
    measures: "water_in",
    params: [
      { key: "dripper", label: "Dripper", spec: { kind: "enum", options: ["V60", "Kalita Wave", "Chemex", "Melitta", "Clever", "Other"] } },
      { key: "filter", label: "Filter", spec: { kind: "enum", options: ["paper", "metal", "cloth"] } },
      { key: "bloom_g", label: "Bloom water (g)", spec: { kind: "number", unit: "g", min: 0 } },
      { key: "bloom_s", label: "Bloom time (s)", spec: { kind: "number", unit: "s", min: 0 } },
      { key: "pours", label: "Number of pours", spec: { kind: "number", min: 0, max: 10 } },
    ],
  },
  aeropress: {
    label: "AeroPress",
    measures: "water_in",
    params: [
      { key: "orientation", label: "Orientation", spec: { kind: "enum", options: ["standard", "inverted"] } },
      { key: "filter", label: "Filter", spec: { kind: "enum", options: ["paper", "metal"] } },
      { key: "press_s", label: "Press time (s)", spec: { kind: "number", unit: "s", min: 0 } },
    ],
  },
  "french-press": {
    label: "French Press",
    measures: "water_in",
    params: [],
  },
  "cold-brew": {
    label: "Cold Brew",
    measures: "water_in",
    params: [
      { key: "immersion_h", label: "Immersion (h)", spec: { kind: "number", unit: "h", step: 0.5, min: 0 } },
      { key: "filter", label: "Filter", spec: { kind: "enum", options: ["paper", "metal", "cloth"] } },
    ],
  },
  "moka-pot": {
    label: "Moka Pot",
    measures: "water_in",
    params: [],
  },
  "drip-machine": {
    label: "Drip Machine",
    measures: "water_in",
    params: [
      { key: "machine", label: "Machine", spec: { kind: "text", maxLength: 80 } },
      { key: "filter", label: "Filter", spec: { kind: "enum", options: ["paper", "metal"] } },
    ],
  },
  other: {
    label: "Other",
    measures: "water_in",
    params: [
      { key: "method_name", label: "Method name", spec: { kind: "text", maxLength: 60 } },
    ],
  },
};

/** Human-readable method label ("espresso" -> "Espresso"). */
export function methodLabel(method: BrewMethod): string {
  return METHOD_SPECS[method]?.label ?? method;
}
