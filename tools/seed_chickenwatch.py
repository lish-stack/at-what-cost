#!/usr/bin/env python3
"""
seed_chickenwatch.py — One-time seed from ChickenWatch Google Sheet JSON.

Usage:
    python tools/seed_chickenwatch.py <path-to-json-file>

The JSON file is the raw gviz/tq response saved from:
    https://docs.google.com/spreadsheets/d/1GcOfjaHy0xTPluZKUkxyNH8u0_qE7T6tdUpeUg7GEyI/gviz/tq?tqx=out:json

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (or environment).
Run from the at-what-cost/ directory:
    python tools/seed_chickenwatch.py ~/Downloads/chickenwatch.json.txt
"""

import sys
import json
import re
import os
from pathlib import Path
from datetime import date
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).parent.parent / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

# ── Column indices (0-based, matching ChickenWatch sheet) ─────────────────────
COL_NAME        = 0   # Account Name
COL_DESCRIPTION = 2   # ChickenWatch Description
COL_COMMIT_DATE = 4   # Commitment Date — "Date(YYYY,M,D)" (month is 0-indexed)
COL_TIMELINE    = 5   # Timeline — deadline year (float)
COL_POLICY_LINK = 7   # ChickenWatch Policy Link
COL_COUNTRY     = 9   # ChickenWatch Country Rollup
COL_SECTOR      = 10  # Sector
COL_POLICY_TYPE = 12  # Policy Type — "Cage-Free" | "Broiler"
COL_CW_OVERVIEW = 18  # CW Policy Overview — drives current_status

POLICY_TYPE_MAP = {"Cage-Free": "cage_free_eggs", "Broiler": "broiler_welfare"}

# ── Helpers ────────────────────────────────────────────────────────────────────

def get_cell(row, idx):
    cells = row.get("c", [])
    if idx >= len(cells) or cells[idx] is None:
        return None
    return cells[idx].get("v")

def parse_gsheets_date(v):
    """Convert 'Date(2022,9,28)' → '2022-10-28' (month is 0-indexed in gviz)."""
    if not v or not isinstance(v, str):
        return None
    m = re.match(r"Date\((\d+),(\d+),(\d+)\)", v)
    if not m:
        return None
    year, month0, day = int(m.group(1)), int(m.group(2)), int(m.group(3))
    return date(year, month0 + 1, day).isoformat()

def map_status(cw_overview):
    return {
        "Reporting Fulfilled": "compliant",
        "Reporting":           "partial",
        "Dialogue":            "unknown",
        "Campaign":            "non_compliant",
    }.get(cw_overview or "", "unknown")

def sector_to_industry(sector):
    if not sector:
        return None
    return sector.strip().lower().replace(" & ", "_and_").replace(" ", "_")

# ── Load + parse gviz JSON ─────────────────────────────────────────────────────

if len(sys.argv) < 2:
    print("Usage: python tools/seed_chickenwatch.py <path-to-json-file>")
    sys.exit(1)

raw = Path(sys.argv[1]).read_text(encoding="utf-8")
match = re.search(r"google\.visualization\.Query\.setResponse\((.*)\)\s*;?\s*$", raw, re.DOTALL)
data = json.loads(match.group(1) if match else raw)

rows = data["table"]["rows"]
print(f"Loaded {len(rows)} rows from sheet.")

# ── Parse all rows locally first (no DB calls yet) ────────────────────────────

# company_name → {industry}  (last write wins for industry)
companies_to_seed = {}
# list of commitment dicts, each with 'company_name' key
commitments_to_seed = []
skipped_type = 0
skipped_no_name = 0

for row in rows:
    name = get_cell(row, COL_NAME)
    if not name or not name.strip():
        skipped_no_name += 1
        continue
    name = name.strip()

    policy_type = get_cell(row, COL_POLICY_TYPE)
    commitment_type = POLICY_TYPE_MAP.get(policy_type)
    if not commitment_type:
        skipped_type += 1
        continue

    industry = sector_to_industry(get_cell(row, COL_SECTOR))
    country = get_cell(row, COL_COUNTRY)
    companies_to_seed[name] = {"name": name, "industry": industry, "country": country}

    timeline_yr = get_cell(row, COL_TIMELINE)
    commitments_to_seed.append({
        "company_name":     name,
        "commitment_type":  commitment_type,
        "commitment_text":  get_cell(row, COL_DESCRIPTION),
        "public_statement_url": get_cell(row, COL_POLICY_LINK),
        "announced_date":   parse_gsheets_date(get_cell(row, COL_COMMIT_DATE)),
        "deadline_date":    f"{int(timeline_yr)}-12-31" if timeline_yr else None,
        "current_status":   map_status(get_cell(row, COL_CW_OVERVIEW)),
    })

print(f"Parsed: {len(companies_to_seed)} unique companies, {len(commitments_to_seed)} commitments")
print(f"Skipped: {skipped_type} unrecognised type, {skipped_no_name} no name")

# ── Supabase ──────────────────────────────────────────────────────────────────

db = create_client(SUPABASE_URL, SUPABASE_KEY)

# 1. Fetch all existing companies (name → id)
print("\nFetching existing companies...")
existing_companies = {}
offset = 0
while True:
    res = db.table("companies").select("id,name").range(offset, offset + 999).execute()
    for c in res.data:
        existing_companies[c["name"]] = c["id"]
    if len(res.data) < 1000:
        break
    offset += 1000
print(f"  Found {len(existing_companies)} existing companies in DB")

# 2. Insert new companies (those not already in DB)
new_companies = [v for k, v in companies_to_seed.items() if k not in existing_companies]
print(f"  Inserting {len(new_companies)} new companies...")
BATCH = 100
for i in range(0, len(new_companies), BATCH):
    batch = new_companies[i:i + BATCH]
    res = db.table("companies").insert(batch).execute()
    for c in res.data:
        existing_companies[c["name"]] = c["id"]
print(f"  Done. Total companies known: {len(existing_companies)}")

# 3. Fetch existing commitments to avoid duplicates (company_id + type + deadline)
print("\nFetching existing commitments...")
existing_commitments = set()
offset = 0
while True:
    res = db.table("commitments").select("company_id,commitment_type,deadline_date").range(offset, offset + 999).execute()
    for c in res.data:
        existing_commitments.add((c["company_id"], c["commitment_type"], c["deadline_date"]))
    if len(res.data) < 1000:
        break
    offset += 1000
print(f"  Found {len(existing_commitments)} existing commitments in DB")

# 4. Build and batch-insert new commitments
new_commitments = []
skipped_dup = 0
skipped_no_company = 0
for c in commitments_to_seed:
    company_id = existing_companies.get(c["company_name"])
    if not company_id:
        skipped_no_company += 1
        continue
    key = (company_id, c["commitment_type"], c["deadline_date"])
    if key in existing_commitments:
        skipped_dup += 1
        continue
    existing_commitments.add(key)  # prevent duplicates within this batch
    new_commitments.append({
        "company_id":           company_id,
        "commitment_type":      c["commitment_type"],
        "commitment_text":      c["commitment_text"],
        "public_statement_url": c["public_statement_url"],
        "announced_date":       c["announced_date"],
        "deadline_date":        c["deadline_date"],
        "current_status":       c["current_status"],
    })

print(f"  Inserting {len(new_commitments)} new commitments (skipped {skipped_dup} duplicates)...")
errors = []
for i in range(0, len(new_commitments), BATCH):
    batch = new_commitments[i:i + BATCH]
    try:
        db.table("commitments").insert(batch).execute()
    except Exception as e:
        errors.append(f"Batch {i//BATCH}: {e}")

# ── Summary ───────────────────────────────────────────────────────────────────

print(f"\nDone.")
print(f"  Companies inserted:    {len(new_companies)}")
print(f"  Commitments inserted:  {len(new_commitments)}")
print(f"  Skipped (duplicates):  {skipped_dup}")
if errors:
    print(f"\n  Errors ({len(errors)}):")
    for e in errors:
        print(f"    {e}")
