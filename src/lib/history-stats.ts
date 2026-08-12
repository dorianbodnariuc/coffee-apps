import type { BrewLog } from "@/types/brew-log";

/**
 * History filtering + summary stats (ticket T4). Pure functions so the
 * acceptance criteria (method/rating/date filters, header numbers) are unit
 * testable. All date math is inclusive on the lower bound.
 */

export type HistoryFilters = {
  /** null = all methods */
  method: BrewLog["method"] | null;
  /** null = all ratings */
  rating: number | null;
  /** null = all time; otherwise only brews within the last N days */
  sinceDays: number | null;
};

export function filterBrews(
  brews: BrewLog[],
  filters: HistoryFilters,
): BrewLog[] {
  const cutoff =
    filters.sinceDays != null
      ? Date.now() - filters.sinceDays * 86_400_000
      : null;
  return brews.filter((brew) => {
    if (filters.method && brew.method !== filters.method) return false;
    if (filters.rating != null && brew.rating !== filters.rating) return false;
    if (cutoff != null) {
      const time = new Date(brew.brewedAt).getTime();
      if (Number.isNaN(time) || time < cutoff) return false;
    }
    return true;
  });
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** Consecutive days with >= 1 brew, ending today (or yesterday if none today). */
export function computeStreak(brews: BrewLog[]): number {
  const days = new Set<string>();
  for (const brew of brews) {
    const date = new Date(brew.brewedAt);
    if (!Number.isNaN(date.getTime())) days.add(dayKey(date));
  }
  if (days.size === 0) return 0;

  const cursor = new Date();
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export type HistoryStats = {
  count: number;
  /** Mean of non-null ratings, 1 decimal; null when nothing rated. */
  avgRating: number | null;
  streak: number;
};

export function computeHistoryStats(brews: BrewLog[]): HistoryStats {
  const rated = brews.filter((brew) => brew.rating != null);
  const avgRating =
    rated.length > 0
      ? Math.round(
          (rated.reduce((sum, brew) => sum + (brew.rating ?? 0), 0) /
            rated.length) *
            10,
        ) / 10
      : null;
  return { count: brews.length, avgRating, streak: computeStreak(brews) };
}
