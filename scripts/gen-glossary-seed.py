#!/usr/bin/env python3
"""T7: generate the glossary stub seed from the real 101-term dataset.

Reads ~/coffee-dictionary-import/lib/dictionary_terms_data.json, filters to a
curated subset, and writes:
  - src/fixtures/glossary-terms.json   (checked-in subset, app-agnostic)
  - supabase/migrations/20260813_glossary_seed.sql  (idempotent seed)

Field mapping (plan v1.2 / T10): term->term, category->category,
long_definition->definition, related_terms->related_terms[].
"""
import json
import re

DATASET = "/Users/dbodnariuc/coffee-dictionary-import/lib/dictionary_terms_data.json"
FIXTURES = "src/fixtures/glossary-terms.json"
MIGRATION = "supabase/migrations/20260813_glossary_seed.sql"

# Curated subset: tasting-note vocabulary + process + common methods.
WANT = {
    "pour-over", "french press", "cold brew", "espresso", "moka pot",
    "washed process", "natural process", "honey process", "fermentation",
    "acidity", "body", "brightness", "crema", "extraction", "aftertaste",
    "mouthfeel", "medium roast", "arabica",
}

def esc(value: str) -> str:
    return value.replace("'", "''")

def main() -> None:
    with open(DATASET, encoding="utf-8") as fh:
        data = json.load(fh)

    picked = []
    for item in data:
        if item["term"].strip().lower() in WANT:
            picked.append(item)
    picked.sort(key=lambda it: it["term"].lower())

    if len(picked) != len(WANT):
        missing = WANT - {it["term"].strip().lower() for it in picked}
        raise SystemExit(f"missing terms: {sorted(missing)}")

    fixtures = [
        {
            "term": it["term"],
            "category": it["category"],
            "definition": it["long_definition"],
            "related_terms": it.get("related_terms") or [],
        }
        for it in picked
    ]
    with open(FIXTURES, "w", encoding="utf-8") as fh:
        json.dump(fixtures, fh, indent=2, ensure_ascii=False)
        fh.write("\n")

    rows = []
    for it in picked:
        related = ", ".join(f"'{esc(r)}'" for r in (it.get("related_terms") or []))
        rows.append(
            f"  ('{esc(it['term'])}', '{esc(it['long_definition'])}', "
            f"'{esc(it['category'])}', ARRAY[{related}]::text[])"
        )
    rows_joined = ",\n".join(rows)
    sql = f"""-- T7: glossary stub seed — {len(picked)} terms from the real dataset
-- (dictionary_terms_data.json subset, plan v1.2). Idempotent: unique term
-- index + ON CONFLICT DO NOTHING, so T10's full import can replace rows later.

create unique index if not exists glossary_terms_term_key
  on public.glossary_terms (term);

insert into public.glossary_terms (term, definition, category, related_terms)
values
{rows_joined}
on conflict (term) do nothing;
"""
    with open(MIGRATION, "w", encoding="utf-8") as fh:
        fh.write(sql)

    print(f"wrote {len(fixtures)} terms -> {FIXTURES}")
    print(f"wrote migration -> {MIGRATION} ({len(sql)} bytes)")

if __name__ == "__main__":
    main()
