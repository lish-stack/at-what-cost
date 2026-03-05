#!/usr/bin/env python3
"""
update_company_countries.py — One-time backfill of country data for existing companies.

Reads the same ChickenWatch gviz/tq JSON used by seed_chickenwatch.py and
updates all companies in Supabase with the country value from column 9
("ChickenWatch Country Rollup").

Usage:
    python tools/update_company_countries.py <path-to-json-file>

Run from the at-what-cost/ directory after running:
    ALTER TABLE companies ADD COLUMN country text;
in the Supabase SQL editor.
"""

import sys
import json
import re
import os
from collections import defaultdict
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).parent.parent / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

COL_NAME    = 0
COL_COUNTRY = 9


def get_cell(row, idx):
    cells = row.get("c", [])
    if idx >= len(cells) or cells[idx] is None:
        return None
    return cells[idx].get("v")


if len(sys.argv) < 2:
    print("Usage: python tools/update_company_countries.py <path-to-json-file>")
    sys.exit(1)

raw = Path(sys.argv[1]).read_text(encoding="utf-8")
match = re.search(r"google\.visualization\.Query\.setResponse\((.*)\)\s*;?\s*$", raw, re.DOTALL)
data = json.loads(match.group(1) if match else raw)

rows = data["table"]["rows"]
print(f"Loaded {len(rows)} rows from sheet.")

# Build name → country mapping (last write wins if company appears multiple times)
name_to_country = {}
for row in rows:
    name = get_cell(row, COL_NAME)
    if not name or not name.strip():
        continue
    name_to_country[name.strip()] = get_cell(row, COL_COUNTRY)

print(f"Found {sum(1 for v in name_to_country.values() if v)} companies with country data.")

# Fetch all companies from DB
db = create_client(SUPABASE_URL, SUPABASE_KEY)
print("\nFetching companies from DB...")
existing = {}
offset = 0
while True:
    res = db.table("companies").select("id,name").range(offset, offset + 999).execute()
    for c in res.data:
        existing[c["name"]] = c["id"]
    if len(res.data) < 1000:
        break
    offset += 1000
print(f"  Found {len(existing)} companies in DB.")

# Group company IDs by country value — one UPDATE per country, not per row
by_country = defaultdict(list)
skipped_no_country = 0
for name, country in name_to_country.items():
    if name not in existing:
        continue
    if not country:
        skipped_no_country += 1
        continue
    by_country[country].append(existing[name])

print(f"  {len(by_country)} unique countries, {skipped_no_country} companies have no country data (skipped)")
print(f"  Updating...")

errors = []
total_updated = 0
for country_val, ids in sorted(by_country.items()):
    try:
        # .in_() has a practical limit; batch at 500 just in case
        for i in range(0, len(ids), 500):
            db.table("companies").update({"country": country_val}).in_("id", ids[i:i+500]).execute()
        total_updated += len(ids)
        print(f"    {country_val}: {len(ids)}")
    except Exception as e:
        errors.append(f"{country_val}: {e}")

print(f"\nDone. {total_updated} companies updated across {len(by_country)} countries.")
if errors:
    print(f"\nErrors ({len(errors)}):")
    for e in errors:
        print(f"  {e}")
