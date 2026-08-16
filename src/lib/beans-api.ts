import type { BeanInput } from "@/lib/bean-schema";
import { supabase } from "@/lib/supabase";
import type { Bean } from "@/types/bean";

/** Row shape as PostgREST returns it (snake_case). */
type BeanRow = {
  id: string;
  name: string;
  roaster: string | null;
  origin: string | null;
  roast_date: string | null;
  created_at: string;
};

/** camelCase input -> snake_case columns. id/createdAt excluded (DB-generated). */
function toBeanRow(input: BeanInput): Record<string, unknown> {
  return {
    name: input.name,
    roaster: input.roaster || null,
    origin: input.origin || null,
    roast_date: input.roastDate || null,
  };
}

/** DB row -> Bean (nulls -> empty strings; roastDate stays null or the date). */
function rowToBean(row: BeanRow): Bean {
  return {
    id: row.id,
    name: row.name,
    roaster: row.roaster ?? "",
    origin: row.origin ?? "",
    roastDate: row.roast_date ?? null,
    createdAt: row.created_at,
  };
}

function requireClient() {
  if (!supabase) throw new Error("Backend not configured");
  return supabase;
}

export async function listBeans(): Promise<Bean[]> {
  const client = requireClient();
  const { data, error } = await client
    .from("beans")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToBean);
}

export async function createBean(input: BeanInput): Promise<Bean> {
  const client = requireClient();
  const { data, error } = await client
    .from("beans")
    .insert(toBeanRow(input))
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToBean(data);
}

export async function updateBean(id: string, input: BeanInput): Promise<Bean> {
  const client = requireClient();
  const { data, error } = await client
    .from("beans")
    .update(toBeanRow(input))
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToBean(data);
}

export async function deleteBean(id: string): Promise<void> {
  const client = requireClient();
  const { error } = await client.from("beans").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
