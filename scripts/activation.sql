-- T6: activation + time-to-first-log queries (Phase 2/3 gate inputs).
-- Activation gate (plan v1.2): >=25% of new users log >=3 brews in their
-- first 7 days. Run against the live DB via the Management API SQL endpoint
-- or psql. Seeded fake data verification: create users + backdated brews,
-- run, expect correct counts, clean up.

-- Per-user funnel inputs
select
  u.id as user_id,
  u.created_at as signed_up_at,
  count(b.id) filter (where b.created_at <= u.created_at + interval '7 days') as logs_in_first_7d,
  extract(epoch from (min(b.created_at) - u.created_at)) as seconds_to_first_log
from auth.users u
left join brew_logs b on b.user_id = u.id
group by u.id, u.created_at
order by u.created_at;

-- Activation rate (gate: >=25%)
with funnel as (
  select
    u.id as user_id,
    count(b.id) filter (where b.created_at <= u.created_at + interval '7 days') as logs_in_first_7d
  from auth.users u
  left join brew_logs b on b.user_id = u.id
  group by u.id
)
select
  count(*) as new_users,
  count(*) filter (where logs_in_first_7d >= 3) as activated,
  round(100.0 * count(*) filter (where logs_in_first_7d >= 3) / nullif(count(*), 0), 1) as activation_pct
from funnel;
