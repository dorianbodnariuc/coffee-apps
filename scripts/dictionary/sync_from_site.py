#!/usr/bin/env python3
"""Sync the app glossary DIRECTLY from coffee-dictionary.com (site as storage).

No seo-app dependency. Fetch layer (v2, structured REST instead of HTML parsing):

  wp-sitemap.xml → post/page sitemaps → {term URL: lastmod}
  URL unchanged (lastmod match in .sync_state.json page cache) → reuse record
  new/changed URL → per-ID WP REST JSON (cache-frozen LIST endpoints avoided):
      new URLs: one HTML fetch for <link rel="alternate"> → exact REST URL
      known URLs: cached REST URL fetched directly
  REST gives clean structured fields: title.rendered (the on-page term name,
  NOT the SEO <title>), slug, status, category ids, content.rendered.

Safety rules (learned from the 2026-08-22/23 failures):
  - RETIRE only when a live-DB page is verified gone (HTTP 404/410 or a
    redirect away). Fetch errors never retire and never drop a cached record.
  - Records are deduped on `term` before SQL generation (ON CONFLICT DO UPDATE
    dies with SQLSTATE 21000 if one statement touches a row twice).
  - A quality gate aborts the run (no migration, no PR) on sitemap failure,
    a mass count drop vs the live DB, or widespread empty definitions.
  - Category names come from per-ID category fetches (LIST is cache-frozen),
    cached in .sync_state.json.

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
import urllib.error
import urllib.request
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from fetch_and_generate import MIGRATIONS, STATE, LOCAL_COPY, build_migration  # noqa: E402

SITE = "https://coffee-dictionary.com"
UA = {"User-Agent": "coffee-apps-site-sync/2.0"}
THROTTLE_S = 1.0
SKIP_SUBSTR = ("/blog", "/about", "/contact", "/privacy", "/shop", "/category", "/tag", "/author", "/glossary", "/general-coffee-terms-glossary", "/us/")
MIN_CATEGORY_TERMS = 10
CATCHALL = "General Terms"

# Quality gate thresholds
MIN_TERMS_FLOOR = 100        # sitemap scrape yielded almost nothing → site broken
MAX_COUNT_DROP_RATIO = 0.10  # abort if records < 90% of the live DB count
MAX_EMPTY_DEF_RATIO = 0.05   # abort if >5% of records have no real definition
MAX_DUPES = 20               # abort if title collisions look structural


class Gone(Exception):
    """The page is definitively gone (404/410)."""


class Redirected(Gone):
    """The page redirects elsewhere — a deliberate editorial move (unlike the
    proven cache-frozen-404 artifact). The old URL is safe to retire; the
    redirect target is the canonical page."""

    def __init__(self, target: str):
        super().__init__(f"redirected to {target}")
        self.target = target


class PartialREST(Exception):
    """The REST body is a cache-frozen partial (CF ignores query strings in
    cache keys, so a once-frozen `_fields=` response poisons the bare URL).
    Caller falls back to parsing the page HTML."""


def get(url: str, allow_redirect: bool = False) -> tuple[str, str]:
    """GET url → (final_url, body). Raises Gone on 404/410, and on redirect-away
    unless allow_redirect (term-page redirects mean the term is gone; the
    sitemap index legitimately redirects, e.g. wp-sitemap.xml → sitemaps.xml)."""
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            final = r.geturl()
            if not allow_redirect and final.rstrip("/") != url.rstrip("/"):
                raise Redirected(final)
            return final, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        if e.code in (404, 410):
            raise Gone(f"HTTP {e.code}")
        raise


def get_json(url: str) -> dict:
    _, body = get(url)
    return json.loads(body)


def term_urls_from_sitemap() -> dict[str, str]:
    """{url: lastmod} for all term pages. Raises on any fetch/parse failure —
    a partial sitemap must never reach the retire logic.

    POST sitemap only: every live glossary term is a WP post. The page-sitemap
    carries category-hub pages ("Coffee Origins Dictionary"), legal pages and
    the homepage — v1 leaked all of them into the glossary."""
    _, idx = get(f"{SITE}/wp-sitemap.xml", allow_redirect=True)
    maps = re.findall(r"<loc>([^<]+)</loc>", idx)
    sub = [m for m in maps if "post-sitemap" in m]
    if not sub:
        raise RuntimeError("sitemap index has no post sitemap")
    out: dict[str, str] = {}
    for m in sub:
        _, xml = get(m, allow_redirect=True)
        for loc, lastmod in re.findall(
            r"<loc>([^<]+)</loc>\s*(?:<lastmod>([^<]+)</lastmod>)?", xml
        ):
            if any(s in loc for s in SKIP_SUBSTR):
                continue
            out[loc] = lastmod or ""
    if len(out) < MIN_TERMS_FLOOR:
        raise RuntimeError(f"sitemap yielded only {len(out)} urls — aborting")
    return out


def rest_url_from_html(url: str) -> tuple[str, int, str]:
    """One HTML fetch for a NEW url: exact REST URL + post id + the HTML
    itself (reused by the HTML fallback if REST returns a frozen partial)."""
    _, html = get(url)
    alt = re.search(
        r'<link rel="alternate"[^>]*type="application/json"[^>]*href="([^"]+)"', html
    ) or re.search(
        r'<link[^>]*href="([^"]+)"[^>]*type="application/json"', html
    )
    pid = re.search(r"postid-(\d+)", html) or re.search(r"page-id-(\d+)", html)
    if not alt or not pid:
        raise RuntimeError("no rel=alternate/postid in HTML")
    return html_mod.unescape(alt.group(1)), int(pid.group(1)), html


def cat_name(cid: int, cats_cache: dict[str, str]) -> str | None:
    """Category id → name via per-ID REST (LIST endpoint is cache-frozen)."""
    key = str(cid)
    if key not in cats_cache:
        try:
            d = get_json(f"{SITE}/wp-json/wp/v2/categories/{cid}?_fields=id,name")
            cats_cache[key] = html_mod.unescape(d.get("name", "")).strip()
            time.sleep(THROTTLE_S)
        except Exception as e:
            print(f"  category {cid}: fetch failed ({e}) — skipped")
            return None
    return cats_cache.get(key) or None


def textify(s: str) -> str:
    return re.sub(r"\s+", " ", html_mod.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def record_from_rest(url: str, rest_url: str, postid: int, cats_cache: dict[str, str]) -> dict | None:
    """Build a term record from structured WP REST JSON.

    Raises PartialREST when the body is a cache-frozen partial object (no
    title/content) so the caller can fall back to the page HTML. Returns None
    (skip, never retire) for non-publish statuses."""
    try:
        d = get_json(rest_url)
    except Gone:
        raise PartialREST("REST URL 404s — trying HTML before believing it")
    if not isinstance(d.get("title"), dict) or "rendered" not in d.get("content", {}):
        raise PartialREST(f"frozen partial object ({len(d)} keys)")
    if d.get("status") != "publish":
        print(f"  {url}: status={d.get('status')} — skipped (not retired)")
        return None
    name = textify(d.get("title", {}).get("rendered", ""))
    if not name or name.lower().startswith("redirect"):
        return None
    body = d.get("content", {}).get("rendered", "") or ""

    lead = ""
    for p in re.findall(r"<p[^>]*>(.*?)</p>", body, re.S):
        t = textify(p)
        if len(t) >= 40:
            lead = t
            break

    cats = []
    for cid in d.get("categories") or []:
        n = cat_name(int(cid), cats_cache)
        if n:
            cats.append(n)

    links = {
        u.rstrip("/") + "/"
        for u in re.findall(r'href="(https://coffee-dictionary\.com/[^"#?]+/)"?', body)
    }
    return {
        "url": url,
        "postid": postid,
        "term": name,
        "slug": d.get("slug") or url.rstrip("/").rsplit("/", 1)[-1],
        "definition": lead,
        "categories": cats,
        "links": sorted(links),
    }


def record_from_html(url: str, postid: int, html: str) -> dict | None:
    """Fallback for cache-frozen REST: parse the public page. Term name comes
    from the on-page H1 (.entry-title) — NEVER the SEO <title>."""
    h1 = re.search(r'<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>(.*?)</h1>', html, re.S) or re.search(
        r"<h1[^>]*>(.*?)</h1>", html, re.S
    )
    if not h1:
        return None
    name = textify(h1.group(1))
    if not name or name.lower().startswith("redirect"):
        return None

    m = re.search(r'<div class="entry-content"[^>]*>(.*?)</div>\s*</div>', html, re.S) or re.search(
        r'<div class="entry-content"[^>]*>(.*?)</article>', html, re.S
    )
    body_html = m.group(1) if m else ""
    lead = ""
    for p in re.findall(r"<p[^>]*>(.*?)</p>", body_html, re.S):
        t = textify(p)
        if len(t) >= 40:
            lead = t
            break

    cats = []
    cat_m = re.search(r'class="cat-links">.*?Categories\s*</span>(.*?)</span>', html, re.S)
    if cat_m:
        for a in re.findall(r"<a[^>]*>([^<]+)</a>", cat_m.group(1), re.S):
            n = textify(a)
            if n:
                cats.append(n)

    links = {
        u.rstrip("/") + "/"
        for u in re.findall(r'href="(https://coffee-dictionary\.com/[^"#?]+/)"?', body_html)
    }
    return {
        "url": url,
        "postid": postid,
        "term": name,
        "slug": url.rstrip("/").rsplit("/", 1)[-1],
        "definition": lead,
        "categories": cats,
        "links": sorted(links),
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


def dedupe_records(records: list[dict]) -> tuple[list[dict], int]:
    """One row per term (upsert conflict key). Keeps the lowest post id —
    the oldest, usually canonical page. Collisions are logged, never fatal
    here; the quality gate bounds how many are acceptable."""
    by_term: dict[str, dict] = {}
    dupes: Counter[str] = Counter()
    for r in sorted(records, key=lambda r: r["postid"]):
        key = r["term"].strip().lower()
        if key in by_term:
            dupes[r["term"]] += 1
            # a name-locked record (live app name) wins over a scraped H1 name
            if r.get("name_locked") and not by_term[key].get("name_locked"):
                by_term[key] = r
            continue
        by_term[key] = r
    for term, n in sorted(dupes.items()):
        print(f"  dupe term dropped ({n}x): {term}")
    return list(by_term.values()), len(dupes)


def live_db_rows() -> list[dict]:
    """Live glossary rows (term, slug, source_url). Empty without creds."""
    sb_url = os.environ.get("SUPABASE_URL")
    sb_key = os.environ.get("SUPABASE_ANON_KEY")
    if not (sb_url and sb_key):
        return []
    req = urllib.request.Request(
        f"{sb_url.rstrip('/')}/rest/v1/glossary_terms?select=term,slug,source_url&limit=2000",
        headers={"apikey": sb_key, "Authorization": f"Bearer {sb_key}"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode())


def build_sync_migration(records: list[dict], retire_urls: list[str], renames: list[tuple[str, str]]) -> str:
    """Mirror migration: renames → retires → upserts.

    - RENAME: (new_term, source_url) pairs computed by the caller — live rows
      whose term differs from the snapshot get updated in place (keeps id →
      users' saved_terms survive).
    - RETIRE: only URLs verified gone by the caller (404/410/redirect-away).
      Fetch failures never reach this list, so scraper bugs can't cascade
      into saved_terms.
    - UPSERT: the full snapshot (definitions/categories/related refresh).
    """
    upsert = build_migration(records)
    renames_sql, retires_sql = "", ""

    if renames:
        vals = ",\n".join(
            f"  ($glossary${t}$glossary$, $glossary${u}$glossary$)" for t, u in renames
        )
        renames_sql = f"""
-- renames: site title changed; keep the row (id, saved_terms) intact
update public.glossary_terms t
set term = v.new_term
from (values
{vals}
) as v(new_term, src)
where t.source_url = v.src;
"""

    if retire_urls:
        vals = ",\n".join(f"$glossary${u}$glossary$" for u in sorted(retire_urls))
        retires_sql = f"""
-- retired: pages verified gone from the site (404/410/redirect; saved_terms cascade)
delete from public.glossary_terms
where source_url in (
{vals}
);
"""

    return (
        f"-- Site sync mirror — {len(records)} terms from coffee-dictionary.com\n"
        f"-- (renames → retires → upsert), generated by sync_from_site.py v2\n"
        + renames_sql + retires_sql + "\n" + upsert
    )


def load_state() -> dict:
    if STATE.exists():
        try:
            return json.loads(STATE.read_text())
        except Exception:
            pass
    return {}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="debug: only first N pages")
    ap.add_argument("--no-migration", action="store_true")
    args = ap.parse_args()

    state = load_state()
    pages_cache: dict = state.get("pages", {})  # url -> {lastmod, rest, postid, record}
    cats_cache: dict = state.get("cats", {})

    # 1. Sitemap (any failure aborts — a partial sitemap must not drive retires)
    urls = term_urls_from_sitemap()
    print(f"sitemap: {len(urls)} term urls")

    # 2. Live-DB rows; pages in the DB but absent from the sitemap get verified
    live = live_db_rows()
    extra = sorted({row["source_url"] for row in live if row.get("source_url")} - set(urls))
    retire_urls: list[str] = []
    if extra:
        print(f"verifying {len(extra)} live-DB pages missing from the sitemap")

    records_by_url: dict[str, dict] = {}
    failures = 0

    def crawl(url: str, lastmod: str, i: int, total: int) -> None:
        """Fetch one term page. Raises Gone only when BOTH the REST body and
        the HTML page are gone/unusable — a single cache-frozen layer (CF
        poisons individual URLs) never counts as gone."""
        nonlocal failures
        cached = pages_cache.get(url)
        if cached and cached.get("lastmod") == lastmod and lastmod and cached.get("record"):
            records_by_url[url] = cached["record"]  # unchanged — no fetch, no throttle
            return
        try:
            html = None
            if cached and cached.get("rest"):
                rest_url, postid = cached["rest"], cached["postid"]
            else:
                rest_url, postid, html = rest_url_from_html(url)
                time.sleep(THROTTLE_S)
            try:
                rec = record_from_rest(url, rest_url, postid, cats_cache)
            except PartialREST as p:
                print(f"[{i}/{total}] {url}: REST unusable ({p}) — HTML fallback")
                if html is None:
                    try:
                        _, html = get(url)
                    except Gone:
                        rec = None
                        raise  # both layers gone → genuinely Gone
                    time.sleep(THROTTLE_S)
                rec = record_from_html(url, postid, html)
            if rec:
                records_by_url[url] = rec
                pages_cache[url] = {
                    "lastmod": lastmod, "rest": rest_url, "postid": postid, "record": rec,
                }
            elif cached and cached.get("record"):
                records_by_url[url] = cached["record"]  # unparsable now — keep last good
        except Gone as g:
            print(f"[{i}/{total}] {url}: GONE ({g})")
            pages_cache.pop(url, None)
            raise
        except Exception as e:
            failures += 1
            print(f"[{i}/{total}] {url}: FETCH FAIL ({e}) — keeping live row as-is")
            if cached and cached.get("record"):
                records_by_url[url] = cached["record"]  # stale cache beats nothing
        finally:
            time.sleep(THROTTLE_S)

    todo = list(urls.items())
    if args.limit:
        todo = todo[: args.limit]
    sitemap_gone = 0
    redirect_targets: list[str] = []
    for i, (url, lastmod) in enumerate(todo, 1):
        try:
            crawl(url, lastmod, i, len(todo))
        except Redirected as r:
            # Deliberate site move: retire the old URL and make sure the
            # canonical target gets crawled too (a frozen sitemap may not
            # list it yet).
            retire_urls.append(url)
            sitemap_gone += 1
            tgt = r.target.rstrip("/") + "/"
            if tgt not in urls and not any(s in tgt for s in SKIP_SUBSTR):
                redirect_targets.append(tgt)
        except Gone:
            # In the sitemap but 404/410 in both layers: drop from the
            # snapshot but do NOT retire — frozen-404 artifacts (the
            # bourbon/typica/catimor/sidra episode) must not delete rows
            # (retire cascades to saved_terms).
            sitemap_gone += 1
        if i % 50 == 0:
            print(f"[{i}/{len(todo)}] crawled…")

    for i, url in enumerate(extra, 1):
        try:
            crawl(url, "", i, len(extra))
        except Redirected as r:
            retire_urls.append(url)
            tgt = r.target.rstrip("/") + "/"
            if tgt not in urls and not any(s in tgt for s in SKIP_SUBSTR):
                redirect_targets.append(tgt)
        except Gone:
            # Live-DB page absent from the sitemap AND verified gone — a real
            # unpublish. Safe to retire.
            retire_urls.append(url)

    for i, url in enumerate(redirect_targets, 1):
        try:
            crawl(url, "", i, len(redirect_targets))
        except Gone:
            pass

    print(f"fetched/cached: {len(records_by_url)} | sitemap-gone: {sitemap_gone} | "
          f"retired (verified): {len(retire_urls)} | fetch failures (kept): {failures}")

    pages = list(records_by_url.values())

    # Name lock: terms already in the app keep their LIVE names. Term names are
    # app identifiers (saved_terms and related_terms key on them); site H1s are
    # sometimes SEO-tuned ("Briny – Coffee Taste and Flavor Descriptors") and
    # must not rename curated app terms. The site stays source of truth for
    # CONTENT (definitions, categories, links); H1 names apply to NEW pages.
    live_name_by_src = {row["source_url"]: row["term"] for row in live if row.get("source_url")}
    locked = 0
    for r in pages:
        ln = live_name_by_src.get(r["url"])
        if ln and ln != r["term"]:
            r["term"] = ln
            r["name_locked"] = True
            locked += 1
    if locked:
        print(f"name lock: kept {locked} live term names (site H1 title ignored)")

    consolidate(pages)

    # related_terms from the cross-link graph (only links to other term pages)
    url_set = set(records_by_url)
    for r in pages:
        related = sorted({
            records_by_url[u]["term"]
            for u in (set(r["links"]) & url_set)
            if u != r["url"]
        })
        r["related_terms"] = related[:25]

    records, ndupes = dedupe_records([
        {
            "term": r["term"],
            "slug": r["slug"],
            "definition": r["definition"] or f"{r['term']} — see the full article.",
            "category": r["category"],
            "categories": r["categories"],
            "related_terms": r.get("related_terms", []),
            "source_url": r["url"],
            "postid": r["postid"],
        }
        for r in pages
    ])
    records.sort(key=lambda r: r["term"].lower())

    # 3. Quality gate — a bad scrape must never become a migration.
    # (Skipped for --limit debug runs, which are intentionally partial.)
    live_count = len(live)
    empty = sum(1 for r in records if r["definition"].startswith(r["term"] + " —"))
    problems = []
    if not args.limit:
        if len(records) < MIN_TERMS_FLOOR:
            problems.append(f"only {len(records)} records (< {MIN_TERMS_FLOOR})")
        if live_count and len(records) < live_count * (1 - MAX_COUNT_DROP_RATIO):
            problems.append(f"count {len(records)} vs live {live_count} (> {int(MAX_COUNT_DROP_RATIO*100)}% drop)")
        if records and empty / len(records) > MAX_EMPTY_DEF_RATIO:
            problems.append(f"{empty}/{len(records)} empty definitions (> {int(MAX_EMPTY_DEF_RATIO*100)}%)")
        if ndupes > MAX_DUPES:
            problems.append(f"{ndupes} duplicate terms (> {MAX_DUPES})")
    if problems:
        print("QUALITY GATE FAILED — no migration, no PR:")
        for p in problems:
            print(f"  - {p}")
        return 1
    print(f"terms: {len(records)} (dupes dropped: {ndupes}) | live: {live_count} | "
          f"empty defs: {empty} | gate: OK")

    # 4. Hash compare → write snapshot + migration only on change.
    # The hash covers records AND the pending renames/retires: those are part
    # of what the migration must encode (a code/logic fix can change them
    # while records stay identical).
    snap_by_src = {r["source_url"]: r for r in records}
    renames = sorted(
        (snap_by_src[row["source_url"]]["term"], row["source_url"])
        for row in live
        if row.get("source_url") in snap_by_src
        and row["term"] != snap_by_src[row["source_url"]]["term"]
    )
    if renames:
        print(f"renames pending: {len(renames)}")
        for t, u in renames[:10]:
            print(f"  rename: {u} → {t!r}")
    payload = json.dumps(
        {"records": records, "retire": sorted(retire_urls), "renames": renames},
        sort_keys=True, ensure_ascii=False,
    )
    new_hash = hashlib.sha256(payload.encode()).hexdigest()
    LOCAL_COPY.parent.mkdir(parents=True, exist_ok=True)
    LOCAL_COPY.write_text(json.dumps(records, indent=2, ensure_ascii=False) + "\n")

    new_state = {
        "hash": new_hash, "terms": len(records),
        "source": "coffee-dictionary.com",
        "pages": pages_cache, "cats": cats_cache,
    }
    if state.get("hash") == new_hash:
        new_state["migration"] = state.get("migration")
        new_state["synced_at"] = state.get("synced_at")
        STATE.write_text(json.dumps(new_state, indent=1, ensure_ascii=False) + "\n")
        print("UNCHANGED")
        return 0

    if args.no_migration:
        STATE.write_text(json.dumps(new_state, indent=1, ensure_ascii=False) + "\n")
        print("CHANGED (migration skipped)")
        return 0

    import datetime as dt
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d%H%M%S")
    MIGRATIONS.mkdir(parents=True, exist_ok=True)
    stems = [m.group(1) for p in MIGRATIONS.glob("*.sql") if (m := re.match(r"(\d+)", p.stem))]
    if stems and stamp <= max(stems):
        stamp = str(int(max(stems)) + 1)
    path = MIGRATIONS / f"{stamp}_glossary_sync.sql"
    path.write_text(build_sync_migration(records, retire_urls, renames))
    new_state["migration"] = path.name
    new_state["synced_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
    STATE.write_text(json.dumps(new_state, indent=1, ensure_ascii=False) + "\n")
    print(f"CHANGED {path.relative_to(MIGRATIONS.parents[1])}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
