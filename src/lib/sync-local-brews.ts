import type { BrewLog } from "@/types/brew-log";
import { supabase } from "@/lib/supabase";

/**
 * Maps a local BrewLog (camelCase) to brew_logs DB columns (snake_case).
 * `id`, `createdAt`, and `ratio` are deliberately excluded: id and createdAt
 * are DB-generated, ratio is a STORED generated column (water/dose).
 */
function toRow(log: BrewLog) {
  return {
    brewed_at: log.brewedAt,
    bean_name: log.beanName,
    roaster: log.roaster,
    origin: log.origin,
    method: log.method,
    grinder: log.grinder,
    grind_size: log.grindSize,
    dose_g: log.doseG,
    water_g: log.waterG,
    yield_g: log.yieldG,
    water_temp_c: log.waterTempC,
    method_params: log.methodParams,
    brew_time_seconds: log.brewTimeSeconds,
    tasting_notes: log.tastingNotes,
    rating: log.rating,
  };
}

/**
 * Uploads session-local brews to the signed-in account's brew_logs table.
 * Returns the number of rows inserted, or an error message on failure.
 */
export async function syncLocalBrews(
  brews: BrewLog[],
): Promise<{ inserted: number; error: string | null }> {
  if (!supabase || brews.length === 0) {
    return { inserted: 0, error: null };
  }

  const { error } = await supabase.from("brew_logs").insert(brews.map(toRow));

  if (error) {
    return { inserted: 0, error: error.message };
  }

  return { inserted: brews.length, error: null };
}
