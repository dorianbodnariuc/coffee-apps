#!/usr/bin/env python3
"""Sync the app glossary DIRECTLY from coffee-dictionary.com (site as storage).

No seo-app dependency. Chain (all public, cache-friendly GETs):
  wp-sitemap.xml → post-sitemap1.xml + page-sitemap1.xml → term URLs
  each term page (HTML) → postid, title, lead paragraph (= app definition),
  cat-links block (= categories), outgoing links to other term URLs
  (= related_terms — the site's cross-link graph)

Then reuse fetch_and_generate's machinery: hash → idempotent Supabase
migration when the term set changed.

Category consolidation mirrors the previous ETL (normalize.py): WP category
names with fewer than MIN_CATEGORY_TERMS terms fold into "General Terms".

Usage:
  python3 scripts/dictionary/sync_from_site.py [--limit N] [--no-migration]
Prints "CHANGED <path>" / "UNCHANGED" as the last line for CI.
"""
from __future__ import annotations

import argparse
import hashlib
import html as html_mod
import json
import os
import re
import sys
import time
import urllib.request
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from fetch_and_generate import MIGRATIONS, STATE, LOCAL_COPY, build_migration  # noqa: E402

SITE = "https://coffee-dictionary.com"
UA = {"User-Agent": "coffee-apps-site-sync/1.0"}
THROTTLE_S = 1.0
SKIP_SUBSTR = ("/blog", "/about", "/contact", "/privacy", "/shop", "/category", "/tag", "/author", "/glossary", "/general-coffee-terms-glossary", "/us/")
MIN_CATEGORY_TERMS = 10
CATCHALL = "General Terms"


def get(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def term_urls_from_sitemap() -> dict[str, str]:
    """{url: lastmod} for all term pages (posts + pages sitemaps)."""
    idx = get(f"{SITE}/wp-sitemap.xml")
    maps = re.findall(r"<loc>([^<]+)</loc>", idx)
    out: dict[str, str] = {}
    for m in maps:
        if not ("post-sitemap" in m or "page-sitemap" in m):
            continue
        xml = get(m)
        for loc, lastmod in re.findall(
            r"<loc>([^<]+)</loc>\s*(?:<lastmod>([^<]+)</lastmod>)?", xml
        ):
            if any(s in loc for s in SKIP_SUBSTR):
                continue
            out[loc] = lastmod or ""
    return out


def clean_term_name(raw: str) -> str:
    """Normalize an SEO-optimized <title> into a dictionary term name."""
    name = html_mod.unescape(raw).strip()
    # drop site suffix first ("- Coffee Dictionary", "| Coffee")
    name = re.sub(r"\s*[-|–]\s*Coffee Dictionary\s*$", "", name).strip()
    # drop SEO title suffixes: ": Definition", ": Definition & Process",
    # ": Person Definition", ": Brewing Guide | Coffee", "– Definition & Process"…
    name = re.sub(
        r"\s*[:–-]\s*(Person |Process |Ingredient |Brewing |Cupping )?(Definition|Def\b)"
        r"(\s*[&|]\s*[A-Za-z ]+)?\s*(\|\s*\w+)?\s*$",
        "",
        name,
        flags=re.I,
    ).strip()
    # trailing " | anything" leftovers
    name = re.sub(r"\s*\|\s*[^|]*$", "", name).strip()
    return name


def build_sync_migration(records: list[dict]) -> str:
    """Mirror migration: renames → retires → upserts.

    - RENAME: live rows whose source_url is in the snapshot but whose term
      differs get updated in place (keeps id → users' saved_terms survive).
    - RETIRE: live rows whose source_url is NOT in the snapshot are deleted
      (saved_terms cascade).
    - UPSERT: the full snapshot (definitions/categories/related refresh).
    Requires SUPABASE_URL + SUPABASE_ANON_KEY to read live rows; without them
    falls back to upsert-only (never deletes blind).
    """
    upsert = build_migration(records)
    renames_sql, retires_sql = "", ""

    sb_url = os.environ.get("SUPABASE_URL")
    sb_key = os.environ.get("SUPABASE_ANON_KEY")
    if sb_url and sb_key:
        import urllib.request as _rq
        req = _rq.Request(
            f"{sb_url.rstrip('/')}/rest/v1/glossary_terms?select=term,slug,source_url&limit=1000",
            headers={"apikey": sb_key, "Authorization": f"Bearer {sb_key}"},
        )
        with _rq.urlopen(req, timeout=60) as r:
            live = json.loads(r.read().decode())
        snap_by_src = {r["source_url"]: r for r in records}
        snap_srcs = set(snap_by_src)

        renames = [
            (snap_by_src[row["source_url"]]["term"], row["source_url"])
            for row in live
            if row.get("source_url") in snap_srcs
            and row["term"] != snap_by_src[row["source_url"]]["term"]
        ]
        if renames:
            vals = ",\n".join(f"  ({q}, {v})" for q, v in
                              ((f"$glossary${t}$glossary$", f"$glossary${u}$glossary$") for t, u in renames))
            renames_sql = f"""
-- renames: site title changed; keep the row (id, saved_terms) intact
update public.glossary_terms t
set term = v.new_term
from (values
{vals}
) as v(new_term, src)
where t.source_url = v.src;
"""

        retired = sorted({row["source_url"] for row in live if row.get("source_url")} - snap_srcs)
        if retired:
            vals = ",\n".join(f"$glossary${u}$glossary$" for u in retired)
            retires_sql = f"""
-- retired: pages no longer on the site (saved_terms cascade)
delete from public.glossary_terms
where source_url in (
{vals}
);
"""

    return (
        f"-- Site sync mirror — {len(records)} terms from coffee-dictionary.com\n"
        f"-- (renames → retires → upsert), generated by sync_from_site.py\n"
        + renames_sql + retires_sql + "\n" + upsert
    )


def parse_term_page(url: str) -> dict | None:
    html = get(url)
    if "Redirect to " in html[:20000] and re.search(
        r'<title>Redirect to [^<]+</title>', html
    ):
        return None
    pid = re.search(r"postid-(\d+)", html) or re.search(r"page-id-(\d+)", html)
    title = re.search(r"<title>([^<]*)</title>", html)
    if not pid or not title:
        return None
    name = clean_term_name(title.group(1))
    if not name or name.lower().startswith("redirect"):
        return None

    m = re.search(
        r'<div class="entry-content"[^>]*>(.*?)</div>\s*</div>', html, re.S
    ) or re.search(r'<div class="entry-content"[^>]*>(.*?)</article>', html, re.S)
    body_html = m.group(1) if m else ""
    paras = re.findall(r"<p[^>]*>(.*?)</p>", body_html, re.S)

    def textify(s: str) -> str:
        return re.sub(r"\s+", " ", html_mod.unescape(re.sub(r"<[^>]+>", " ", s))).strip()

    lead = ""
    for p in paras:
        t = textify(p)
        if len(t) >= 40:
            lead = t
            break

    cat_m = re.search(r'class="cat-links">.*?Categories\s*</span>(.*?)</span>', html, re.S)
    cats = []
    if cat_m:
        for a in re.findall(r"<a[^>]*>([^<]+)</a>", cat_m.group(1), re.S):
            n = html_mod.unescape(re.sub(r"<[^>]+>", "", a)).strip()
            if n:
                cats.append(n)

    links = {
        u.rstrip("/") + "/"
        for u in re.findall(r'href="(https://coffee-dictionary\.com/[^"#?]+/)"', body_html)
    }

    return {
        "url": url,
        "postid": int(pid.group(1)),
        "term": name,
        "definition": lead,
        "categories": cats,
        "links": links,
    }


def consolidate(records: list[dict]) -> None:
    counts: Counter[str] = Counter()
    for r in records:
        for c in r["categories"]:
            counts[c] += 1
    for r in records:
        cats, seen = [], set()
        for c in r["categories"]:
            mapped = c if counts[c] >= MIN_CATEGORY_TERMS else CATCHALL
            if mapped not in seen:
                seen.add(mapped)
                cats.append(mapped)
        r["categories"] = cats or [CATCHALL]
        r["category"] = r["categories"][0]


def live_db_source_urls() -> set[str]:
    """Source URLs of terms already in the live app DB (empty without creds).

    Pages can be live but missing from the sitemap (e.g. noindex posts), so
    the crawl unions these in and verifies each — a page is retired only when
    it really is gone (404/redirect), never just because the sitemap omitted it.
    """
    sb_url = os.environ.get("SUPABASE_URL")
    sb_key = os.environ.get("SUPABASE_ANON_KEY")
    if not (sb_url and sb_key):
        return set()
    import urllib.request as _rq
    req = _rq.Request(
        f"{sb_url.rstrip('/')}/rest/v1/glossary_terms?select=source_url&limit=1000",
        headers={"apikey": sb_key, "Authorization": f"Bearer {sb_key}"},
    )
    with _rq.urlopen(req, timeout=60) as r:
        rows = json.loads(r.read().decode())
    return {row["source_url"] for row in rows if row.get("source_url")}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="debug: only first N pages")
    ap.add_argument("--no-migration", action="store_true")
    args = ap.parse_args()

    urls = term_urls_from_sitemap()
    known = live_db_source_urls()
    extra = known - set(urls)
    if extra:
        print(f"sitemap: {len(urls)} term urls (+{len(extra)} live-DB-only pages to verify)")
    urls.update({u: "" for u in extra})
    print(f"crawling {len(urls)} urls total")
    todo = list(urls.items())[: args.limit] if args.limit else list(urls.items())

    pages = []
    for i, (url, _lastmod) in enumerate(todo, 1):
        try:
            rec = parse_term_page(url)
        except Exception as e:
            print(f"[{i}/{len(todo)}] {url}: FETCH FAIL {e}")
            rec = None
        if rec is None:
            print(f"[{i}/{len(todo)}] {url}: no postid/title — skipped")
        else:
            pages.append(rec)
            if i % 50 == 0:
                print(f"[{i}/{len(todo)}] parsed…")
        time.sleep(THROTTLE_S)

    print(f"parsed pages: {len(pages)}")
    consolidate(pages)

    # related_terms from the cross-link graph (only links to other term pages)
    url_set = {r["url"] for r in pages}
    by_url = {r["url"]: r for r in pages}
    for r in pages:
        related = sorted({by_url[u]["term"] for u in (r["links"] & url_set) if u != r["url"]})
        r["related_terms"] = related[:25]

    records = [
        {
            "term": r["term"],
            "slug": r["url"].rstrip("/").rsplit("/", 1)[-1],
            "definition": r["definition"] or f"{r['term']} — see the full article.",
            "category": r["category"],
            "categories": r["categories"],
            "related_terms": r["related_terms"],
            "source_url": r["url"],
            "postid": r["postid"],
        }
        for r in pages
    ]
    records.sort(key=lambda r: r["term"].lower())

    payload = json.dumps(records, sort_keys=True, ensure_ascii=False)
    new_hash = hashlib.sha256(payload.encode()).hexdigest()
    LOCAL_COPY.parent.mkdir(parents=True, exist_ok=True)
    LOCAL_COPY.write_text(json.dumps(records, indent=2, ensure_ascii=False) + "\n")

    state = json.loads(STATE.read_text()) if STATE.exists() else {}
    if state.get("hash") == new_hash:
        print("UNCHANGED")
        return 0

    print(f"terms: {len(records)} | with defs: {sum(1 for r in records if not r['definition'].startswith(r['term'] + ' —'))}")

    if args.no_migration:
        print("CHANGED (migration skipped)")
        return 0

    import datetime as dt
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d%H%M%S")
    MIGRATIONS.mkdir(parents=True, exist_ok=True)
    stems = [m.group(1) for p in MIGRATIONS.glob("*.sql") if (m := re.match(r"(\d+)", p.stem))]
    if stems and stamp <= max(stems):
        stamp = str(int(max(stems)) + 1)
    path = MIGRATIONS / f"{stamp}_glossary_sync.sql"
    path.write_text(build_sync_migration(records))
    STATE.write_text(json.dumps({
        "hash": new_hash, "terms": len(records), "migration": path.name,
        "source": "coffee-dictionary.com", "synced_at": dt.datetime.now(dt.timezone.utc).isoformat(),
    }, indent=1) + "\n")
    print(f"CHANGED {path.relative_to(MIGRATIONS.parents[1])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
