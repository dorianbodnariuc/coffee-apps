-- T8: carry the canonical coffee-dictionary.com URL for link-out from the
-- term modal ("Read the full article"). Populated by the 20260818 full seed.
alter table public.glossary_terms add column if not exists source_url text;
