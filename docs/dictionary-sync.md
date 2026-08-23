# Dictionary sync — coffee-apps ⇄ coffee-dictionary.com

The WordPress site is the storage; its public HTML is the API. No seo-app
dependency, no third-party service, no cost. Supabase remains the app's
runtime (fast reads, offline caching).

```
coffee-dictionary.com (WordPress — source of truth, 440+ term pages)
  │  wp-sitemap.xml → post/page sitemaps → term URLs (public GETs)
  │  each page: postid, title, lead (= app definition), cat-links,
  │             outgoing term links (= related_terms cross-link graph)
  ▼
coffee-apps CI · .github/workflows/dictionary-sync.yml (daily 06:17 UTC)
  scripts/dictionary/sync_from_site.py
  → data/dictionary/glossary_normalized.json (snapshot, hash-checked)
  → supabase/migrations/<ts>_glossary_sync.sql (idempotent upsert; only when
    the term set changed; stamp always sorts after existing migrations)
  → opens a PR ── merge ──▶ supabase-migrate.yml: supabase db push --db-url
                             ▼
                glossary_terms in the live app
```

## Why site-HTML instead of the WP REST API

The host's cache layer (Cloudflare + LiteSpeed) freezes REST LIST endpoints —
pagination returns the same page forever, categories returns one entry, even
when authenticated. Per-ID REST and public page HTML are reliable. The sitemap
is the canonical enumeration of live (published) term URLs — drafts never
appear. Everything the sync needs is in the public HTML.

## Pull: publishing a term reaches the app automatically

On coffee-dictionary.com (from any machine): publish the term post. Next daily
sync opens a PR with the new term; merge it (usually a one-click review) and
supabase-migrate applies it. Nothing else to run.

## Push: users propose new dictionary terms

```
app user → glossary_proposals table (RLS: own rows only)
  └── weekly CI (Mondays 05:23 UTC): dictionary-proposals.yml
        scripts/dictionary/export_proposals_to_issue.py
        → issue in THIS repo, label `dictionary-proposal`
        → reviewer publishes accepted terms on the site
        → daily site sync brings them into the app
```

Full loop: user proposes → reviewer publishes → term in app ≈ 1 day + review.

## Required secrets (Settings → Secrets → Actions)

| Secret | Value |
|---|---|
| `SUPABASE_DB_URL` | pooler URL with URL-encoded password (set) |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | app project values (set) |

(`GITHUB_TOKEN` covers PR + issue creation inside this repo. The old
SEO_APP_* secrets are no longer needed by any workflow.)

## Notes

- Throttle: 1 req/s against the site; a full sync is ~460 pages ≈ 8–13 min,
  inside the workflow's 30-min timeout.
- Categories: WP category names with <10 terms fold into "General Terms"
  (same rule as the previous ETL's normalize step).
- Definitions = the site's first paragraph (the app convention, D-001/D-002).
- Rollback = revert the sync PR; previous full-seed migration stays in history.
