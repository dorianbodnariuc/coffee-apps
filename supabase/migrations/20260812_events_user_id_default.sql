-- T6 fix: events.user_id defaults to the session user (same pattern as
-- brew_logs). The track() helper never sends user_id; RLS with-check
-- (auth.uid() = user_id) then passes on insert.
alter table public.events
  alter column user_id set default auth.uid();
