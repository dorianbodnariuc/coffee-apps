import { FRESHNESS_THRESHOLDS } from "@/constants";

export type FreshnessLevel = "green" | "amber" | "red";

/** Parse a "YYYY-MM-DD" string as a LOCAL midnight Date (no TZ drift). */
function parseDateOnly(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Whole days between roast date and today (0 = today; clamped at 0). */
export function daysSinceRoast(roastDate: string): number {
  const roast = parseDateOnly(roastDate);
  if (!roast) return 0;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ms = today.getTime() - roast.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/**
 * Freshness bucket for a bean age in days.
 * Boundaries (acceptance criteria): 0–14 green, 15–30 amber, 31+ red.
 */
export function freshnessFor(days: number): FreshnessLevel {
  if (days <= FRESHNESS_THRESHOLDS.green.max) return "green";
  if (days <= FRESHNESS_THRESHOLDS.amber.max) return "amber";
  return "red";
}

/** Badge for a bean's roast date: level + short label ("Today" / "12d"). */
export function freshnessBadge(
  roastDate: string | null,
): { level: FreshnessLevel; label: string } | null {
  if (!roastDate) return null;
  const days = daysSinceRoast(roastDate);
  return { level: freshnessFor(days), label: days === 0 ? "Today" : `${days}d` };
}
