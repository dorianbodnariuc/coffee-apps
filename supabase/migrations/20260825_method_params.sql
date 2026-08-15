-- T23 — method-centric brew log (D-028)
-- Adds method-specific structured parameters + grinder/yield/temp columns.
-- Single transaction: the ratio rework rewrites the table (test against a
-- row-bearing copy before running in production).

alter table public.brew_logs
  add column grinder text,
  add column yield_g numeric,
  add column water_temp_c numeric(4,1) check (water_temp_c between 0 and 100),
  add column method_params jsonb not null default '{}'::jsonb;

-- Backfill: the old generic "water" field for espresso held the shot output,
-- so carry it into yield_g to keep existing espresso ratios meaningful.
update public.brew_logs set yield_g = water_g where method = 'espresso';

-- Rework ratio: yield/dose for espresso, water/dose for everything else.
alter table public.brew_logs drop column ratio;
alter table public.brew_logs add column ratio numeric generated always as (
  case
    when dose_g > 0 and method = 'espresso' then yield_g / dose_g
    when dose_g > 0 then water_g / dose_g
    else null
  end
) stored;
