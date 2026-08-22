# Dictionary sync — coffee-apps ⇄ seo-app-v2

The two repos live on different computers. GitHub is the transport; Supabase is
the app's runtime. No machine needs access to the other's filesystem.

```
seo-app-v2 (dictionary work, other computer)
  └── dictionary-import/data/glossary_normalized.json   (source of truth)
        │  raw.githubusercontent.com (authenticated)
        ▼
coffee-apps (this repo, CI on GitHub Actions)
  scripts/dictionary/fetch_and_generate.py   daily 06:17 UTC
  → generates supabase/migrations/<ts>_glossary_sync.sql (idempotent upsert)
  → opens a PR (review gate) ── merge ──▶ supabase-migrate.yml
                                           supabase db push --db-url (live DB)
                                           ▼
                             glossary_terms in the app (449 → grows)
```

## Pull: new dictionary data flows to the app automatically

- Workflow: `.github/workflows/dictionary-sync.yml` (daily + manual dispatch).
- The script is a no-op until the export hash changes (`data/dictionary/.sync_state.json`).
- A PR is opened only when something actually changed; merging it applies the
  migration automatically via `supabase-migrate.yml`.
- Rollback = revert the PR; the previous full-seed migration remains in history.

## Push: users propose new dictionary terms

```
app user → glossary_proposals table (RLS: own rows only)
  └── weekly CI (Mondays 05:23 UTC): dictionary-proposals.yml
        scripts/dictionary/export_proposals_to_issue.py
        → GitHub issue on seo-app-v2, label `dictionary-proposal`
        → dictionary team reviews/publishes on coffee-dictionary.com
        → next daily sync PR brings the new term into the app
```

The full loop (user proposes → term published → appears in their app) takes at
most one review cycle + one day.

## Required secrets (Settings → Secrets → Actions)

| Secret | Value / scope |
|---|---|
| `SEO_APP_READ_TOKEN` | PAT that can READ seo-app-v2 (it's private) |
| `SEO_APP_ISSUE_TOKEN` | PAT that can open issues on seo-app-v2 |
| `SUPABASE_DB_URL` | `postgresql://postgres:<url-encoded-password>@aws-0-us-east-1.pooler.supabase.com:5432/postgres` |
| `SUPABASE_URL` | `https://kxrktrgoqpfhilijykmr.supabase.co` |
| `SUPABASE_ANON_KEY` | the app's anon/publishable key |

Note: the DB password must be URL-encoded in `SUPABASE_DB_URL` (it contains
URL-special characters — supabase CLI fails to parse it raw).

## seo-app-v2 side (dictionary team conventions)

- After publishing terms on coffee-dictionary.com, re-run the ETL
  (`dictionary-import/scripts/fetch_full_glossary.py --merge-only` →
  `normalize.py`) and COMMIT `glossary_normalized.json`. That commit is the
  release signal — the next daily sync picks it up.
- Proposals arrive as issues labeled `dictionary-proposal`; the review workflow
  (drafts → validate → publish → ETL) is documented in
  `dictionary-import/tasks/` and the `coffee-dictionary-content` skill.
