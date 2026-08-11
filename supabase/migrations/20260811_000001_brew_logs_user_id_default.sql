-- T3b fix: brew_logs.user_id must default to the session user.
-- The client never sends user_id (canonical Supabase pattern); RLS
-- with-check (auth.uid() = user_id) then passes on insert. Without the
-- default, inserts fail RLS (NULL user_id) — this broke the API layer and
-- the local-brews sync path.
alter table public.brew_logs
  alter column user_id set default auth.uid();
