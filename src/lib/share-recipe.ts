import type { BrewLog } from "@/types/brew-log";
import { METHOD_SPECS } from "@/constants/method-specs";

/**
 * Share/display helpers for a brew log (T23). Pure functions — no I/O.
 * The recipe string is method-aware: espresso shows "out" (yield), every other
 * method shows "in" (water).
 */

/** "12 on Eureka Mignon", or just the grinder / just the setting, or "". */
export function formatGrind(log: BrewLog): string {
  const g = log.grinder?.trim();
  const s = log.grindSize?.trim();
  if (g && s) return `${s} on ${g}`;
  return g || s || "";
}

/** "18g in / 36g out · 1:2", or "18g in / 300g in · 1:15", or "". */
export function describeRecipe(log: BrewLog): string {
  const liquid = log.method === "espresso" ? log.yieldG : log.waterG;
  const inOut = log.method === "espresso" ? "out" : "in";
  const parts: string[] = [];
  if (log.doseG != null && liquid != null) {
    parts.push(`${log.doseG}g in / ${liquid}g ${inOut}`);
  } else if (log.doseG != null) {
    parts.push(`${log.doseG}g in`);
  } else if (liquid != null) {
    parts.push(`${liquid}g ${inOut}`);
  }
  if (log.ratio != null) parts.push(`1:${log.ratio}`);
  return parts.join(" · ");
}

function fmtTime(seconds: number | null): string {
  if (seconds == null) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Up to 2 non-empty method-specific signatures, e.g. ["9bar", "18g basket"]. */
function signatures(log: BrewLog): string[] {
  const spec = METHOD_SPECS[log.method];
  const out: string[] = [];
  for (const p of spec.params) {
    const v = log.methodParams?.[p.key];
    if (v == null || v === "") continue;
    const unit = p.spec.kind === "number" ? p.spec.unit ?? "" : "";
    out.push(`${v}${unit}`);
    if (out.length === 2) break;
  }
  return out;
}

/**
 * 3-line plaintext recipe card (D-028 item 6), for the share sheet. Tasting
 * notes are deliberately excluded (personal). Empty lines are dropped.
 */
export function buildRecipeCard(log: BrewLog): string {
  const name = log.beanName || log.origin || "Untitled brew";
  const line1 = [
    METHOD_SPECS[log.method].label,
    name,
    describeRecipe(log),
  ]
    .filter(Boolean)
    .join(" · ");

  const time = fmtTime(log.brewTimeSeconds);
  const line2 = [formatGrind(log), time, ...signatures(log)]
    .filter(Boolean)
    .join(" · ");

  const line3 = log.rating != null ? `★ ${log.rating.toFixed(1)}/5` : "";

  return [line1, line2, line3].filter((l) => l !== "").join("\n");
}
