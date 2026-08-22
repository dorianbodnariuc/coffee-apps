-- Dictionary term proposals submitted by app users.
-- Sync contract: coffee-apps exports pending proposals weekly to a seo-app-v2
-- issue (scripts/dictionary/export_proposals_to_issue.py); the dictionary
-- team reviews/edits/publishes; new terms flow back via glossary_normalized.json.

create table if not exists public.glossary_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  term text not null,
  context text,                -- where the user encountered it (optional)
  note text,                   -- free-form user note (optional)
  status text not null default 'pending'
    check (status in ('pending', 'exported', 'accepted', 'declined', 'expired')),
  exported_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.glossary_proposals enable row level security;

-- Users see and submit their own proposals only.
create policy "users read own proposals"
  on public.glossary_proposals for select
  using (auth.uid() = user_id);

create policy "users insert own proposals"
  on public.glossary_proposals for insert
  with check (auth.uid() = user_id);

create policy "users update own proposals"
  on public.glossary_proposals for update
  using (auth.uid() = user_id);

create policy "users delete own proposals"
  on public.glossary_proposals for delete
  using (auth.uid() = user_id);

-- One open proposal per term per user (pending ones are unique).
create unique index if not exists glossary_proposals_open_term
  on public.glossary_proposals (user_id, term)
  where status in ('pending', 'exported');

-- Retention: pending/exported proposals older than 90 days expire.
-- (Enforced by the weekly export script; index supports the scan.)
create index if not exists glossary_proposals_status_created
  on public.glossary_proposals (status, created_at);

-- Aggregated export view + RPCs for the weekly CI export (anon key auth).
-- SECURITY DEFINER so the CI export can read/mark ACROSS users without a
-- service key; the view exposes only pending rows with no user identifiers.
create or replace view public.glossary_proposals_export
with (security_invoker = false) as
  select term, context, note, created_at
  from public.glossary_proposals
  where status = 'pending';

grant select on public.glossary_proposals_export to anon, authenticated;

create or replace function public.mark_proposal_exported(p_term text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.glossary_proposals
  set status = 'exported', exported_at = now()
  where term = p_term and status = 'pending';
$$;

create or replace function public.expire_proposal(p_term text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.glossary_proposals
  set status = 'expired'
  where term = p_term and status in ('pending', 'exported')
    and created_at < now() - interval '90 days';
$$;

grant execute on function public.mark_proposal_exported(text) to anon, authenticated;
grant execute on function public.expire_proposal(text) to anon, authenticated;
