import type { BrewLogInput } from "@/lib/brew-log-schema";
import { supabase } from "@/lib/supabase";
import type { BrewLog } from "@/types/brew-log";

/**
 * brew_logs CRUD against Supabase (ticket T3b). RLS scopes every query to the
 * signed-in user; the client must have a session (AuthProvider handles it).
 *
 * PostgREST returns numeric columns as strings — rowToBrewLog coerces them.
 */

/** Row shape as PostgREST returns it (snake_case). */
type BrewLogRow = {
  id: string;
  brewed_at: string;
  bean_name: string | null;
  roaster: string | null;
  origin: string | null;
  method: string;
  grind_size: string | null;
  dose_g: number | string | null;
  water_g: number | string | null;
  ratio: number | string | null;
  brew_time_seconds: number | null;
  tasting_notes: string | null;
  rating: number | string | null;
  created_at: string;
};

/** camelCase input -> snake_case columns. id/createdAt/ratio excluded (DB-generated). */
export function toBrewLogRow(input: BrewLogInput): Record<string, unknown> {
  return {
    brewed_at: input.brewedAt,
    bean_name: input.beanName || null,
    roaster: input.roaster || null,
    origin: input.origin || null,
    method: input.method,
    grind_size: input.grindSize || null,
    dose_g: input.doseG,
    water_g: input.waterG,
    brew_time_seconds: input.brewTimeSeconds,
    tasting_notes: input.tastingNotes || null,
    rating: input.rating,
  };
}

function toNum(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** DB row -> BrewLog (coerce numeric strings; nulls -> empty strings). */
export function rowToBrewLog(row: BrewLogRow): BrewLog {
  return {
    id: row.id,
    brewedAt: row.brewed_at,
    beanName: row.bean_name ?? "",
    roaster: row.roaster ?? "",
    origin: row.origin ?? "",
    method: row.method as BrewLog["method"],
    grindSize: row.grind_size ?? "",
    doseG: toNum(row.dose_g),
    waterG: toNum(row.water_g),
    ratio: toNum(row.ratio),
    brewTimeSeconds: row.brew_time_seconds,
    tastingNotes: row.tasting_notes ?? "",
    rating: toNum(row.rating),
    createdAt: row.created_at,
  };
}

function requireClient() {
  if (!supabase) throw new Error("Backend not configured");
  return supabase;
}

export async function listBrewLogs(): Promise<BrewLog[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("brew_logs")
    .select("*")
    .order("brewed_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToBrewLog);
}

export async function createBrewLog(input: BrewLogInput): Promise<BrewLog> {
  const client = requireClient();
  const { data, error } = await client
    .from("brew_logs")
    .insert(toBrewLogRow(input))
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToBrewLog(data);
}

export async function updateBrewLog(
  id: string,
  input: BrewLogInput,
): Promise<BrewLog> {
  const client = requireClient();
  const { data, error } = await client
    .from("brew_logs")
    .update(toBrewLogRow(input))
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToBrewLog(data);
}

export async function deleteBrewLog(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("brew_logs").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
