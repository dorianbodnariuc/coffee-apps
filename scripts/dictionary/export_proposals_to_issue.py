#!/usr/bin/env python3
"""Export pending glossary term proposals to a seo-app-v2 GitHub issue.

Reads pending proposals from the Supabase REST API (service path is not needed:
we use the anon key + an RPC that only exposes aggregated pending rows — see
glossary_proposals_export_view), marks them exported, and files one weekly
issue on seo-app-v2 titled "Dictionary proposals — <date>".

If there are no pending proposals, exits 0 silently (no issue).

Env:
  SUPABASE_URL, SUPABASE_ANON_KEY   — the app's project
  SEO_APP_ISSUE_TOKEN               — PAT with repo access to seo-app-v2
"""
from __future__ import annotations

import datetime as dt
import json
import os
import sys
import urllib.request

PROPOSALS_VIEW = "glossary_proposals_export"


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
    sb_url = os.environ["SUPABASE_URL"].rstrip("/")
    sb_key = os.environ["SUPABASE_ANON_KEY"]
    gh_token = os.environ["SEO_APP_ISSUE_TOKEN"]
    sb_headers = {"apikey": sb_key, "Authorization": f"Bearer {sb_key}"}

    rows = http_json(
        f"{sb_url}/rest/v1/{PROPOSALS_VIEW}?select=term,context,note,created_at"
        "&order=created_at.asc&limit=200",
        headers=sb_headers,
    )
    if not isinstance(rows, list):
        raise SystemExit(f"unexpected proposals response: {rows}")

    # expire stale proposals (>90 days)
    cutoff = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=90)).isoformat()
    stale = [r for r in rows if r["created_at"] < cutoff]
    fresh = [r for r in rows if r["created_at"] >= cutoff]
    for r in stale:
        http_json(
            f"{sb_url}/rest/v1/rpc/expire_proposal",
            method="POST",
            body={"p_term": r["term"]},
            headers=sb_headers,
        )

    if not fresh:
        print("no pending proposals; nothing to export")
        return 0

    today = dt.date.today().isoformat()
    lines = [
        f"Dictionary proposals from the coffee app — {today}",
        "",
        "Submitted by app users via the glossary proposals feature.",
        "Review each: publish on coffee-dictionary.com (write-path rules) then",
        "the daily dictionary-sync PR in coffee-apps picks it up automatically.",
        "",
    ]
    for i, r in enumerate(fresh, 1):
        lines.append(f"## {i}. {r['term']}")
        if r.get("context"):
            lines.append(f"- Encountered in: {r['context']}")
        if r.get("note"):
            lines.append(f"- Note: {r['note']}")
        lines.append(f"- Submitted: {r['created_at'][:10]}")
        lines.append("")

    body = "\n".join(lines)
    issue = http_json(
        "https://api.github.com/repos/dorianbodnariuc/seo-app-v2/issues",
        method="POST",
        body={"title": f"Dictionary proposals — {today}", "body": body,
              "labels": ["dictionary-proposal"]},
        headers={
            "Authorization": f"Bearer {gh_token}",
            "Accept": "application/vnd.github+json",
        },
    )
    print(f"filed issue #{issue.get('number')}: {issue.get('html_url')}")

    # mark exported (only the fresh ones)
    for r in fresh:
        http_json(
            f"{sb_url}/rest/v1/rpc/mark_proposal_exported",
            method="POST",
            body={"p_term": r["term"]},
            headers=sb_headers,
        )
    print(f"marked {len(fresh)} proposals exported; expired {len(stale)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
