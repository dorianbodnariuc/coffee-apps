import type { BrewLogInput } from "@/lib/brew-log-schema";

/**
 * Persisted brew log shape. `ratio` mirrors the DB's STORED generated column
 * (water/dose, NULL when dose <= 0) — read-only, never sent on write.
 */
export type BrewLog = BrewLogInput & {
  id: string;
  createdAt: string;
  ratio: number | null;
};
