# Dictionary sync — coffee-apps ⇄ coffee-dictionary.com

The WordPress site is the storage; its sitemap + per-ID REST is the API. No
seo-app dependency, no third-party service, no cost. Supabase remains the app's
runtime (fast reads, offline caching).

```
coffee-dictionary.com (WordPress — source of truth, 440+ term pages)
  │  wp-sitemap.xml → post/page sitemaps → term URLs + lastmod
  │  changed/new pages → per-ID WP REST JSON (title.rendered = clean term
  │  name, slug, status, category ids, content.rendered); new URLs pay one
  │  HTML fetch for <link rel="alternate"> → exact REST URL
  ▼
coffee-apps CI · .github/workflows/dictionary-sync.yml (daily 06:17 UTC)
  scripts/dictionary/sync_from_site.py
  → page cache in data/dictionary/.sync_state.json (lastmod → unchanged
    pages are not refetched; steady-state runs take seconds)
  → quality gate (aborts with no PR on sitemap failure, dupes, a >10%
    count drop vs live, or >5% empty definitions)
  → data/dictionary/glossary_normalized.json (snapshot, hash-checked)
  → supabase/migrations/<ts>_glossary_sync.sql (idempotent upsert; only when
    the term set changed; stamp always sorts after existing migrations)
  → opens/updates ONE rolling PR (branch dictionary-sync/site)
       ── merge ──▶ supabase-migrate.yml: supabase db push --db-url
                       ▼
          glossary_terms in the live app
```

## Why not the WP REST LIST endpoints

The host's cache layer (Cloudflare + LiteSpeed) freezes REST LIST endpoints —
pagination returns the same page forever, categories returns one entry, even
when authenticated. Per-ID REST (`/wp-json/wp/v2/posts/<id>`) and the sitemap
are reliable and fresh. LIST endpoints are never used.

## Why not raw HTML parsing (v1, abandoned)

v1 regex-parsed the public HTML and took the term name from `<title>` — which
carries SEO suffixes ("Melya: Coffee Variety Definition | Coffee Dictionary").
Per-ID REST `title.rendered` is the clean on-page name, and categories come
from per-ID category fetches (id → name, cached). The v1 scrape produced 531
rows vs the curated 449 with ~60 duplicate term keys — the quality gate now
blocks that class of failure from ever becoming a PR.

## Cache-frozen URLs: two-layer fetch

Cloudflare ignores query strings in cache keys, so a URL once fetched with a
`_fields=` filter can serve that frozen partial object forever (and the
bourbon/typica/catimor/sidra draft-window 404s persist until purged). The sync
therefore treats every URL as two independent layers: REST first, HTML
fallback (H1 `.entry-title`, never the SEO `<title>`). A page counts as
"gone" only when BOTH layers fail; a page present in the sitemap is never
retired even then — retires require sitemap absence AND verified-gone.

## Safety rules

- RETIRE only when a page is verified gone (HTTP 404/410 or redirect away) —
  never on a fetch error, never on sitemap absence alone. Retires cascade to
  saved_terms, so they must be intentional.
- RENAME keys on source_url: a site title change updates the term in place,
  keeping the row id (and users' saved_terms) intact.
- Records are deduped on `term` before SQL generation (ON CONFLICT DO UPDATE
  aborts with SQLSTATE 21000 on duplicate keys in one statement).
- supabase-migrate.yml retries only connection errors; SQLSTATE fails fast.

## Pull: publishing a term reaches the app automatically

On coffee-dictionary.com (from any machine): publish the term post. Next daily
sync updates the rolling PR with the new term; merge it (usually a one-click
review) and supabase-migrate applies it. Nothing else to run.

## Push: users propose new dictionary terms

```
app user → glossary_proposals table (RLS: own rows only)
  └── weekly CI (Mondays 05:23 UTC): dictionary-proposals.yml
        scripts/dictionary/export_proposals_to_issue.py (direct DB connection)
        → issue in THIS repo, label `dictionary-proposal`
        → reviewer publishes accepted terms on the site
        → daily site sync brings them into the app
```

There is intentionally NO anon-readable export path on the proposals table
(migration 20260906 dropped the export view + mark/expire RPCs — granted to
anon, they let any user read and flush the queue). CI connects with
SUPABASE_DB_URL as postgres.

Full loop: user proposes → reviewer publishes → term in app ≈ 1 day + review.

## Required secrets (Settings → Secrets → Actions)

| Secret | Value |
|---|---|
| `SUPABASE_DB_URL` | pooler URL with URL-encoded password (set) — migrations + proposals export |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | app project values (set) — live-row reads for rename/retire diffing |

(`GITHUB_TOKEN` covers PR + issue creation inside this repo. The old
SEO_APP_* secrets are no longer needed by any workflow.)

## Notes

- Throttle: 1 req/s against the site. First run (cold cache) ≈ 460 pages ×
  1–2 requests ≈ 15–20 min; steady-state runs fetch the sitemap + changed
  pages only (seconds to a minute).
- Categories: WP category names with <10 terms fold into "General Terms"
  (same rule as the previous ETL's normalize step).
- Definitions = the site's first paragraph (the app convention, D-001/D-002).
- Rollback = revert the sync PR; previous full-seed migration stays in history.
