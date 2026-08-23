-- Lockdown: the weekly proposals export now connects DIRECTLY to the database
-- (SUPABASE_DB_URL, postgres role) instead of the anon key. The anon-readable
-- export view and the mark/expire RPCs are removed: granted to anon, they let
-- any app user read the whole pending-proposal queue and flush/expire it.
--
-- The app path (users insert/read their OWN rows via RLS on
-- glossary_proposals) is unchanged.

drop view if exists public.glossary_proposals_export;
drop function if exists public.mark_proposal_exported(text);
drop function if exists public.expire_proposal(text);
