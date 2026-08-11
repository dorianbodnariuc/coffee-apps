#!/usr/bin/env node
/**
 * T2 RLS + schema verification against a live Supabase project.
 * Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... [SUPABASE_SERVICE_KEY=...] node scripts/verify-rls.mjs
 *
 * Checks (ticket T2 acceptance criteria):
 *  1. ratio write rejected: inserting a brew_log with an explicit `ratio` fails.
 *  2. zero-guard: dose = 0 => stored ratio is NULL.
 *  3. RLS isolation: user B cannot read or update user A's rows (anon key only).
 *  4. delete_account: removing user A cascades A's rows (needs service key).
 *
 * Exits non-zero on the first failed check. Test users are created via
 * signUp; if email confirmation is enabled this prints a hint instead of
 * failing (create the project with confirmations disabled for dev, or
 * confirm the users in the dashboard first).
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!url || !anonKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(2);
}

const anon = createClient(url, anonKey, { auth: { persistSession: false } });
const admin = serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null;

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

const stamp = Date.now();
const emailA = `t2-user-a-${stamp}@example.com`;
const emailB = `t2-user-b-${stamp}@example.com`;
const password = 'test-pass-123';

const signInOrUp = async (email) => {
  const { data, error } = await anon.auth.signUp({ email, password });
  if (error) throw error;
  if (!data.session) {
    console.log(`HINT: signUp for ${email} returned no session (email confirmation on?). Confirm the user in the dashboard, or disable confirmations for dev.`);
    return null;
  }
  return data.session;
};

try {
  const sessionA = await signInOrUp(emailA);
  const sessionB = await signInOrUp(emailB);
  if (!sessionA || !sessionB) {
    console.log('SKIP: cannot run RLS checks without two confirmed sessions.');
    process.exit(failures > 0 ? 1 : 0);
  }

  // 1. Client write to `ratio` must be rejected (generated column).
  const badInsert = await anon
    .from('brew_logs')
    .insert({ user_id: sessionA.user.id, brewed_at: new Date().toISOString(), method: 'pour-over', dose_g: 20, water_g: 300, ratio: 15 });
  check('ratio write rejected', !!badInsert.error, badInsert.error?.message ?? 'unexpectedly allowed');

  // 2. Zero-guard: dose = 0 => ratio NULL, insert succeeds.
  const zeroDose = await anon
    .from('brew_logs')
    .insert({ user_id: sessionA.user.id, brewed_at: new Date().toISOString(), method: 'pour-over', dose_g: 0, water_g: 300 })
    .select('ratio');
  check('dose 0 => NULL ratio', !zeroDose.error && zeroDose.data?.[0]?.ratio === null, JSON.stringify(zeroDose.data?.[0] ?? zeroDose.error));

  // Seed A's readable row.
  const seedA = await anon
    .from('brew_logs')
    .insert({ user_id: sessionA.user.id, brewed_at: new Date().toISOString(), method: 'espresso', dose_g: 20, water_g: 300 })
    .select('id, ratio');
  check('A can insert + read own row', !seedA.error && seedA.data?.[0]?.ratio === 15, JSON.stringify(seedA.data?.[0] ?? seedA.error));
  const rowIdA = seedA.data?.[0]?.id;

  // 3. RLS isolation: B sees nothing, cannot update A's row.
  if (rowIdA) {
    await anon.auth.setSession(sessionB);
    const { data: asB, error: selErr } = await anon.from('brew_logs').select('id');
    check('B cannot read A rows', !selErr && (asB ?? []).length === 0, `saw ${asB?.length ?? 'error'} rows`);

    const { error: updErr } = await anon.from('brew_logs').update({ tasting_notes: 'hacked' }).eq('id', rowIdA);
    check('B cannot update A rows', !!updErr, updErr?.message ?? 'unexpectedly allowed');
  }

  // 4. delete_account cascades (service role verification).
  if (admin && sessionA.user.id) {
    await anon.auth.setSession(sessionA);
    const { error: delErr } = await anon.rpc('delete_account');
    check('delete_account RPC succeeds', !delErr, delErr?.message ?? '');

    const { data: leftover, error: leftoverErr } = await admin
      .from('brew_logs')
      .select('id')
      .eq('user_id', sessionA.user.id);
    check('A rows cascade-deleted', !leftoverErr && (leftover ?? []).length === 0, `found ${leftover?.length ?? 'error'} rows`);
  } else if (!admin) {
    console.log('SKIP: delete_account cascade check needs SUPABASE_SERVICE_KEY.');
  }

  // Cleanup B.
  if (admin && sessionB.user.id) {
    await admin.auth.admin.deleteUser(sessionB.user.id);
  }
} catch (err) {
  console.error('ERROR:', err.message);
  failures += 1;
}

process.exit(failures > 0 ? 1 : 0);
