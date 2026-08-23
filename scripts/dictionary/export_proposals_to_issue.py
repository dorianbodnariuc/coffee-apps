#!/usr/bin/env python3
"""Export pending glossary term proposals to a coffee-apps GitHub issue.

Connects DIRECTLY to Supabase Postgres (SUPABASE_DB_URL) — no anon-key surface:
the export view / mark / expire RPCs were dropped (20260906 lockdown) because
anon grants let any user read and flush the pending queue.

Flow: expire stale (>90d) → file ONE issue for fresh pending proposals → mark
them exported. Idempotent per day: if an open issue with today's title already
exists, proposals are marked without double-filing.

Env: SUPABASE_DB_URL (postgres connection string), GH_ISSUE_TOKEN (issues: write).
"""
from __future__ import annotations

import datetime as dt
import json
import os
import sys
import urllib.request

REPO = os.environ.get("PROPOSALS_REPO", "dorianbodnariuc/coffee-apps")


def http_json(url: str, method: str = "GET", body=None, headers=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(req, timeout=60) as r:
        text = r.read().decode()
        return json.loads(text) if text else {}


def main() -> int:
    import psycopg

    db_url = os.environ["SUPABASE_DB_URL"]
    gh_token = os.environ["GH_ISSUE_TOKEN"]
    gh_headers = {"Authorization": f"Bearer {gh_token}",
                  "Accept": "application/vnd.github+json"}

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            # Expire stale proposals (>90 days pending/exported)
            cur.execute(
                """update public.glossary_proposals
                   set status = 'expired'
                   where status in ('pending', 'exported')
                     and created_at < now() - interval '90 days'"""
            )
            expired = cur.rowcount
            cur.execute(
                """select term, context, note, created_at
                   from public.glossary_proposals
                   where status = 'pending'
                   order by created_at asc
                   limit 200"""
            )
            rows = cur.fetchall()

    if not rows:
        print(f"no pending proposals; expired {expired}")
        return 0

    today = dt.date.today().isoformat()
    title = f"Dictionary proposals — {today}"

    # Idempotency: today's issue already open → mark exported, don't re-file
    open_issues = http_json(
        f"https://api.github.com/repos/{REPO}/issues?labels=dictionary-proposal&state=open&per_page=50",
        headers=gh_headers,
    )
    existing = next(
        (i for i in open_issues if isinstance(i, dict) and i.get("title") == title),
        None,
    )
    if existing:
        print(f"issue already open: #{existing['number']} — marking exported only")
    else:
        lines = [
            f"Dictionary proposals from the coffee app — {today}",
            "",
            "Submitted by app users via the glossary proposals feature.",
            "Review each: if accepted, publish on coffee-dictionary.com using the",
            "standard term workflow — the daily site sync picks it up automatically",
            "and the term reaches app users. Then close this issue.",
            "",
        ]
        for i, (term, context, note, created_at) in enumerate(rows, 1):
            lines.append(f"## {i}. {term}")
            if context:
                lines.append(f"- Encountered in: {context}")
            if note:
                lines.append(f"- Note: {note}")
            lines.append(f"- Submitted: {str(created_at)[:10]}")
            lines.append("")

        issue = http_json(
            f"https://api.github.com/repos/{REPO}/issues",
            method="POST",
            body={"title": title, "body": "\n".join(lines),
                  "labels": ["dictionary-proposal"]},
            headers=gh_headers,
        )
        print(f"filed issue #{issue.get('number')}: {issue.get('html_url')}")

    terms = [r[0] for r in rows]
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """update public.glossary_proposals
                   set status = 'exported', exported_at = now()
                   where status = 'pending' and term = any(%s)""",
                (terms,),
            )
            marked = cur.rowcount
    print(f"marked {marked} proposals exported; expired {expired}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
