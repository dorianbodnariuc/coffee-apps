import { supabase } from "@/lib/supabase";
import type { Origin, Roaster } from "@/types/catalog";

/**
 * Roaster/origin catalog API (T24, D-029..D-033). Both tables are GLOBAL and
 * publicly readable; the app only inserts name-only rows (the "add new" flow)
 * via `getOrCreate*`. Paid fields + `subscribed` are service-role-only.
 */

/** Matches the DB generated column `lower(trim(name))` — the dedup key. */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function requireClient() {
  if (!supabase) throw new Error("Backend not configured");
  return supabase;
}

type OriginRow = {
  id: string;
  name: string;
  country: string | null;
  region: string | null;
  created_at: string;
};

type RoasterRow = {
  id: string;
  name: string;
  country: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  bean_link: string | null;
  subscribed: boolean;
  subscribed_until: string | null;
  created_at: string;
};

function rowToOrigin(row: OriginRow): Origin {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    region: row.region,
    createdAt: row.created_at,
  };
}

function rowToRoaster(row: RoasterRow): Roaster {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    city: row.city,
    address: row.address,
    phone: row.phone,
    website: row.website,
    beanLink: row.bean_link,
    subscribed: row.subscribed,
    subscribedUntil: row.subscribed_until,
    createdAt: row.created_at,
  };
}

export async function listOrigins(): Promise<Origin[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("origins")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToOrigin);
}

export async function listRoasters(): Promise<Roaster[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("roasters")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToRoaster);
}

/**
 * getOrCreate* are idempotent: return the existing row whose normalized name
 * matches, otherwise insert a name-only row. On a unique-violation race the
 * insert is retried as a read so concurrent callers converge on one row.
 */
export async function getOrCreateOrigin(name: string): Promise<Origin> {
  const client = requireClient();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Origin name is required");
  const normalized = normalizeName(trimmed);

  const existing = await client
    .from("origins")
    .select("*")
    .eq("normalized_name", normalized)
    .maybeSingle();
  if (existing.data) return rowToOrigin(existing.data);

  const { data, error } = await client
    .from("origins")
    .insert({ name: trimmed })
    .select()
    .single();
  if (!error) return rowToOrigin(data);

  const again = await client
    .from("origins")
    .select("*")
    .eq("normalized_name", normalized)
    .maybeSingle();
  if (again.data) return rowToOrigin(again.data);
  throw new Error(error.message);
}

export async function getOrCreateRoaster(name: string): Promise<Roaster> {
  const client = requireClient();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Roaster name is required");
  const normalized = normalizeName(trimmed);

  const existing = await client
    .from("roasters")
    .select("*")
    .eq("normalized_name", normalized)
    .maybeSingle();
  if (existing.data) return rowToRoaster(existing.data);

  const { data, error } = await client
    .from("roasters")
    .insert({ name: trimmed })
    .select()
    .single();
  if (!error) return rowToRoaster(data);

  const again = await client
    .from("roasters")
    .select("*")
    .eq("normalized_name", normalized)
    .maybeSingle();
  if (again.data) return rowToRoaster(again.data);
  throw new Error(error.message);
}
