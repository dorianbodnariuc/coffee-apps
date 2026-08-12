#!/usr/bin/env node
/**
 * T6 acceptance: the activation metric returns correct counts against seeded
 * fake data. Creates two fake users (signUp, autoconfirm on), backdates them,
 * seeds brew_logs via the Management SQL endpoint (postgres role), runs the
 * activation + time-to-first-log queries, asserts expected numbers, cleans up.
 *
 * Usage: SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_ACCESS_TOKEN=... \
 *        SUPABASE_PROJECT_REF=<ref> node scripts/verify-activation.mjs
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;

if (!url || !anonKey || !token || !ref) {
  console.error('Missing env: SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF');
  process.exit(2);
}

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`SQL ${res.status}: ${await res.text()}`);
  return res.json();
}

try {
  // 1. Two fake users via signUp (email autoconfirm is ON in dev).
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const stamp = Date.now();
  const [userA, userB] = [];
  const userIds = [];
  for (const tag of ['a', 'b']) {
    const { data, error } = await anon.auth.signUp({
      email: `t6-fake-${tag}-${stamp}@example.com`,
      password: 'test-pass-123',
    });
    if (error || !data.session) throw new Error(`signup ${tag}: ${error?.message ?? 'no session'}`);
    userIds.push(data.user.id);
  }
  const [idA, idB] = userIds;

  // 2. Backdate signups; seed brews (created_at drives the 7-day window).
  await sql(`update auth.users set created_at = now() - interval '10 days' where id = '${idA}';
             update auth.users set created_at = now() - interval '3 days' where id = '${idB}';`);
  // A: brews 9,6,4,2 days ago -> 3 inside first 7 days -> ACTIVATED.
  // B: brew 2 days ago (signup 3 days ago) -> 1 -> not activated.
  for (const [uid, days] of [
    [idA, 9],
    [idA, 6],
    [idA, 4],
    [idA, 2],
    [idB, 2],
  ]) {
    await sql(
      `insert into brew_logs (user_id, brewed_at, method, created_at) values ('${uid}', now() - interval '${days} days', 'pour-over', now() - interval '${days} days');`,
    );
  }

  // 3. Activation query.
  const [activation] = await sql(
    `with funnel as (
       select u.id as user_id,
         count(b.id) filter (where b.created_at <= u.created_at + interval '7 days') as logs_in_first_7d
       from auth.users u left join brew_logs b on b.user_id = u.id
       group by u.id
     )
     select count(*) as new_users,
       count(*) filter (where logs_in_first_7d >= 3) as activated,
       round(100.0 * count(*) filter (where logs_in_first_7d >= 3) / nullif(count(*), 0), 1) as activation_pct
     from funnel
     where user_id in ('${idA}', '${idB}');`,
  );
  check(
    'activation counts (2 new users, 1 activated, 50%)',
    activation.new_users === 2 && activation.activated === 1 && Number(activation.activation_pct) === 50,
    JSON.stringify(activation),
  );

  // 4. Time-to-first-log: A's first brew is 9 days ago (signup 10 days ago) -> 1 day.
  const [ttfl] = await sql(
    `select extract(epoch from (min(b.created_at) - u.created_at)) / 86400.0 as days_to_first_log
     from auth.users u join brew_logs b on b.user_id = u.id
     where u.id = '${idA}' group by u.id, u.created_at;`,
  );
  check('time_to_first_log ~1 day for A', ttfl && Math.abs(ttfl.days_to_first_log - 1) < 0.05, JSON.stringify(ttfl));

  // 5. Cleanup: deleting the users cascades their brews.
  await sql(`delete from auth.users where id in ('${idA}', '${idB}');`);
  const [leftovers] = await sql(
    `select count(*) as n from brew_logs where user_id in ('${idA}', '${idB}');`,
  );
  check('cascade cleanup (0 leftover brews)', leftovers.n === 0, JSON.stringify(leftovers));
} catch (err) {
  console.error('ERROR:', err.message);
  failures += 1;
}

process.exit(failures > 0 ? 1 : 0);
