-- T17 — saved terms (bookmarks): account-gated personal state.
-- A signed-in user saves glossary terms to a persistent "Saved" list.
-- RLS: owner-only (select/insert/delete). Term deletion and account deletion
-- both cascade. user_id defaults to auth.uid() so clients never send it
-- (same fix as brew_logs in 20260811).

create table public.saved_terms (
  user_id    uuid not null default auth.uid()
             references auth.users (id) on delete cascade,
  term_id    uuid not null references public.glossary_terms (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, term_id)
);

create index saved_terms_user_idx on public.saved_terms (user_id);

alter table public.saved_terms enable row level security;

-- Owner-only. No update policy (a save is insert/delete only).
create policy "saved_terms_select_own" on public.saved_terms
  for select using (auth.uid() = user_id);
create policy "saved_terms_insert_own" on public.saved_terms
  for insert with check (auth.uid() = user_id);
create policy "saved_terms_delete_own" on public.saved_terms
  for delete using (auth.uid() = user_id);
