-- T8: full category list per term (a term appears under every WP category it
-- belongs to). `category` stays as the primary/specific label for compact
-- display. Populated by the 20260821 full seed.
alter table public.glossary_terms add column if not exists categories text[] not null default '{}';
