"""
backend/app/main.py

FastAPI app — Supabase client replaces SQLAlchemy ORM.
- Public endpoints use service-role client (reads public tables)
- Org endpoints use user-scoped client (RLS enforced)
- Ingestion writes use service-role client
"""

from datetime import date
from typing import Optional

from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from supabase import Client

from .db import get_db, get_user_db
from .schemas import CommitmentCreate, ComplianceEventCreate, EvidenceCreate

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Auth Helpers ───────────────────────────────────────────

def require_jwt(authorization: Optional[str] = Header(None)) -> str:
    """Extract and validate Bearer token from Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    return authorization.split(" ", 1)[1]


def require_org(authorization: Optional[str] = Header(None)) -> tuple[str, Client]:
    """
    Validates the user is authenticated as an org.
    Returns (jwt, user_scoped_db).
    """
    jwt = require_jwt(authorization)
    db = get_user_db(jwt)

    user = db.auth.get_user(jwt)
    if not user or not user.user:
        raise HTTPException(status_code=401, detail="Invalid token")

    profile = db.table("profiles").select("role").eq("id", user.user.id).single().execute()
    if not profile.data or profile.data.get("role") != "org":
        raise HTTPException(status_code=403, detail="Org account required")

    return jwt, db


# ─── Shared Helpers ─────────────────────────────────────────

def compute_days_remaining(deadline_date: Optional[str]) -> Optional[int]:
    if not deadline_date:
        return None
    deadline = date.fromisoformat(deadline_date)
    return (deadline - date.today()).days


def derive_lifecycle_phase(days_remaining: Optional[int], current_status: str) -> str:
    if current_status == "compliant":
        return "compliant"
    if days_remaining is None:
        return "unknown"
    if days_remaining > 30:
        return "pre_deadline"
    if 0 <= days_remaining <= 30:
        return "at_risk"
    return "overdue"


def serialize_commitment(c: dict, include_events: bool = False) -> dict:
    days_remaining = compute_days_remaining(c.get("deadline_date"))
    lifecycle_phase = derive_lifecycle_phase(days_remaining, c.get("current_status", "unknown"))

    result = {
        "id": c["id"],
        "company_id": c.get("company_id"),
        "company": c.get("companies"),  # joined from Supabase select
        "commitment_type": c.get("commitment_type"),
        "commitment_text": c.get("commitment_text"),
        "announced_date": c.get("announced_date"),
        "deadline_date": c.get("deadline_date"),
        "public_statement_url": c.get("public_statement_url"),
        "current_status": c.get("current_status"),
        "days_remaining": days_remaining,
        "lifecycle_phase": lifecycle_phase,
    }

    if include_events:
        result["compliance_events"] = c.get("compliance_events", [])
        result["evidence"] = c.get("evidence", [])

    return result


# ─── Public: Commitments ────────────────────────────────────

@app.get("/commitments")
def list_commitments():
    db = get_db()
    res = db.table("commitments").select("*, companies(name, website, industry)").execute()
    return [serialize_commitment(c) for c in res.data]


@app.get("/commitments/{commitment_id}")
def get_commitment(commitment_id: str):
    db = get_db()
    res = (
        db.table("commitments")
        .select("*, companies(name, website, industry), compliance_events(*), evidence(*)")
        .eq("id", commitment_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Commitment not found")
    return serialize_commitment(res.data, include_events=True)


@app.post("/commitments", status_code=201)
def create_commitment(payload: CommitmentCreate):
    db = get_db()

    # Upsert company by name
    existing = db.table("companies").select("id").eq("name", payload.company.name).execute()
    if existing.data:
        company_id = existing.data[0]["id"]
    else:
        company_res = db.table("companies").insert({
            "name": payload.company.name,
            "website": payload.company.website,
            "industry": payload.company.industry,
        }).execute()
        company_id = company_res.data[0]["id"]

    # Create commitment
    commitment_res = db.table("commitments").insert({
        "company_id": company_id,
        "commitment_type": payload.commitment_type,
        "commitment_text": payload.commitment_text,
        "announced_date": payload.announced_date.isoformat() if payload.announced_date else None,
        "deadline_date": payload.deadline_date.isoformat() if payload.deadline_date else None,
        "public_statement_url": payload.public_statement_url,
        "current_status": "unknown",
    }).execute()
    commitment_id = commitment_res.data[0]["id"]

    # Anchor: seed the deadline event to start the lifecycle
    db.table("compliance_events").insert({
        "commitment_id": commitment_id,
        "event_type": "deadline",
        "event_date": payload.deadline_date.isoformat(),
        "status": "unknown",
    }).execute()

    return {
        "commitment_id": commitment_id,
        "company_id": company_id,
        "message": "Commitment created and lifecycle anchored.",
    }


# ─── Public: Compliance Events ──────────────────────────────

@app.post("/commitments/{commitment_id}/events", status_code=201)
def add_compliance_event(commitment_id: str, payload: ComplianceEventCreate):
    db = get_db()

    existing = db.table("commitments").select("id, current_status").eq("id", commitment_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Commitment not found")

    event_res = db.table("compliance_events").insert({
        "commitment_id": commitment_id,
        "event_type": payload.event_type,
        "event_date": payload.event_date.isoformat(),
        "status": payload.status,
    }).execute()

    if payload.update_commitment_status:
        db.table("commitments").update({"current_status": payload.status}).eq("id", commitment_id).execute()

    return {
        "event_id": event_res.data[0]["id"],
        "commitment_id": commitment_id,
        "updated_commitment_status": payload.update_commitment_status,
    }


# ─── Public: Evidence ───────────────────────────────────────

@app.post("/commitments/{commitment_id}/evidence", status_code=201)
def add_evidence(commitment_id: str, payload: EvidenceCreate):
    db = get_db()

    existing = db.table("commitments").select("id").eq("id", commitment_id).single().execute()
    if not existing.data:
        raise HTTPException(status_code=404, detail="Commitment not found")

    evidence_res = db.table("evidence").insert({
        "commitment_id": commitment_id,
        "source_url": payload.source_url,
        "source_type": payload.source_type,
        "summary": payload.summary,
    }).execute()

    return {
        "evidence_id": evidence_res.data[0]["id"],
        "commitment_id": commitment_id,
    }


# ─── Org: Saved Companies ───────────────────────────────────

@app.get("/org/saved-companies")
def get_saved_companies(authorization: Optional[str] = Header(None)):
    jwt, db = require_org(authorization)
    user = db.auth.get_user(jwt).user

    res = (
        db.table("org_saved_companies")
        .select("saved_at, companies(*, commitments(*))")
        .eq("org_id", user.id)
        .execute()
    )
    return res.data


@app.post("/org/saved-companies/{company_id}", status_code=201)
def save_company(company_id: str, authorization: Optional[str] = Header(None)):
    """
    Save a company to the org's list.
    Triggers Open Paws OSINT report generation via n8n webhook.
    """
    jwt, db = require_org(authorization)
    user = db.auth.get_user(jwt).user

    # Save the company
    db.table("org_saved_companies").insert({
        "org_id": user.id,
        "company_id": company_id,
    }).execute()

    # Trigger Open Paws via n8n webhook (non-blocking)
    _trigger_open_paws(company_id, user.id)

    return {"message": "Company saved. OSINT report generation started."}


@app.delete("/org/saved-companies/{company_id}", status_code=204)
def unsave_company(company_id: str, authorization: Optional[str] = Header(None)):
    jwt, db = require_org(authorization)
    user = db.auth.get_user(jwt).user

    db.table("org_saved_companies").delete().eq("org_id", user.id).eq("company_id", company_id).execute()
    return


# ─── Org: Company Reports (OSINT dossier) ───────────────────

@app.get("/org/companies/{company_id}/report")
def get_company_report(company_id: str, authorization: Optional[str] = Header(None)):
    """Returns the Open Paws OSINT report for this company (org only)."""
    jwt, db = require_org(authorization)
    user = db.auth.get_user(jwt).user

    res = (
        db.table("company_reports")
        .select("*")
        .eq("company_id", company_id)
        .eq("org_id", user.id)
        .order("generated_at", desc=True)
        .limit(1)
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="No report found. Save this company to trigger generation.")

    return res.data[0]


# ─── Org: Notes ─────────────────────────────────────────────

@app.get("/org/companies/{company_id}/notes")
def get_notes(company_id: str, authorization: Optional[str] = Header(None)):
    jwt, db = require_org(authorization)
    user = db.auth.get_user(jwt).user

    res = (
        db.table("org_company_notes")
        .select("*")
        .eq("org_id", user.id)
        .eq("company_id", company_id)
        .execute()
    )
    return res.data[0] if res.data else {}


@app.put("/org/companies/{company_id}/notes", status_code=200)
def upsert_notes(company_id: str, notes: dict, authorization: Optional[str] = Header(None)):
    jwt, db = require_org(authorization)
    user = db.auth.get_user(jwt).user

    db.table("org_company_notes").upsert({
        "org_id": user.id,
        "company_id": company_id,
        "notes": notes.get("notes"),
        "tags": notes.get("tags", []),
        "updated_at": date.today().isoformat(),
    }).execute()

    return {"message": "Notes saved."}


# ─── Internal: Deadline Processor (n8n daily cron) ──────────

@app.post("/internal/process-deadlines")
def process_deadlines():
    """
    Called daily by n8n. Scans all non-compliant commitments and
    auto-creates lifecycle events for overdue and at-risk deadlines.
    """
    db = get_db()
    today = date.today()

    res = db.table("commitments").select("*, compliance_events(event_type)").neq("current_status", "compliant").execute()
    commitments = res.data or []

    created_events = []
    skipped = []

    for c in commitments:
        if not c.get("deadline_date"):
            continue

        days_remaining = (date.fromisoformat(c["deadline_date"]) - today).days
        existing_types = {e["event_type"] for e in c.get("compliance_events", [])}

        if days_remaining < 0 and "post_deadline" not in existing_types:
            db.table("compliance_events").insert({
                "commitment_id": c["id"],
                "event_type": "post_deadline",
                "event_date": today.isoformat(),
                "status": c["current_status"],
            }).execute()
            created_events.append({
                "commitment_id": c["id"],
                "event_type": "post_deadline",
                "days_overdue": abs(days_remaining),
            })

        elif days_remaining in (30, 7):
            db.table("compliance_events").insert({
                "commitment_id": c["id"],
                "event_type": "pre_deadline",
                "event_date": today.isoformat(),
                "status": c["current_status"],
            }).execute()
            created_events.append({
                "commitment_id": c["id"],
                "event_type": "pre_deadline",
                "days_remaining": days_remaining,
            })
        else:
            skipped.append(c["id"])

    return {
        "processed_at": today.isoformat(),
        "events_created": len(created_events),
        "detail": created_events,
        "skipped_commitment_ids": skipped,
    }


# ─── Public: Campaigns & Action Scripts ─────────────────────

@app.get("/companies/{company_id}/campaigns")
def get_campaigns(company_id: str):
    db = get_db()
    res = (
        db.table("campaigns")
        .select("*")
        .eq("company_id", company_id)
        .eq("is_active", True)
        .order("created_at")
        .execute()
    )
    return res.data


@app.get("/commitments/{commitment_id}/action-script")
def get_action_script(commitment_id: str, type: str = "email"):
    db = get_db()
    res = (
        db.table("action_scripts")
        .select("*")
        .eq("commitment_id", commitment_id)
        .eq("script_type", type)
        .order("generated_at", desc=True)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


@app.post("/commitments/{commitment_id}/action-script")
def generate_action_script(commitment_id: str, type: str = "email"):
    import os, requests as req
    db = get_db()

    # Return cached script if available
    cached = (
        db.table("action_scripts")
        .select("*")
        .eq("commitment_id", commitment_id)
        .eq("script_type", type)
        .order("generated_at", desc=True)
        .limit(1)
        .execute()
    )
    if cached.data:
        return cached.data[0]

    # Fetch commitment details
    c_res = (
        db.table("commitments")
        .select("*, companies(name, website)")
        .eq("id", commitment_id)
        .single()
        .execute()
    )
    if not c_res.data:
        raise HTTPException(status_code=404, detail="Commitment not found")
    c = c_res.data
    company_name = (c.get("companies") or {}).get("name", "this company")

    days = compute_days_remaining(c.get("deadline_date"))
    phase = derive_lifecycle_phase(days, c.get("current_status", "unknown"))
    overdue_note = f" — {abs(days)} days overdue" if days is not None and days < 0 else ""
    commitment_desc = c.get("commitment_type", "animal welfare commitment").replace("_", " ")

    if type == "email":
        prompt = (
            f"{company_name} made a public commitment to {commitment_desc} "
            f"by {c.get('deadline_date', 'their stated deadline')}. "
            f"They are currently {phase.replace('_', ' ')}{overdue_note}.\n\n"
            f"Their public commitment: \"{c.get('commitment_text', '')}\"\n\n"
            f"Write a concise, polite but firm email (150-200 words) from a concerned consumer to "
            f"{company_name}'s leadership urging them to follow through on this commitment. "
            f"Include a subject line. Write it ready to send — no placeholder text."
        )
    else:
        prompt = (
            f"{company_name} made a public commitment to {commitment_desc} "
            f"by {c.get('deadline_date', 'their stated deadline')} and is currently "
            f"{phase.replace('_', ' ')}{overdue_note}.\n\n"
            f"Their public commitment: \"{c.get('commitment_text', '')}\"\n\n"
            f"Write a phone call script (3-5 sentences) for a consumer calling {company_name}'s "
            f"customer service to express concern and urge follow-through on this commitment. "
            f"Include what to say when someone answers. Keep it calm, clear, and direct."
        )

    api_key = os.getenv("OPENROUTER_API_KEY")
    model = os.getenv("LLM_MODEL", "anthropic/claude-haiku-4-5")
    if not api_key:
        raise HTTPException(status_code=503, detail="LLM not configured")

    resp = req.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"model": model, "messages": [{"role": "user", "content": prompt}]},
        timeout=30,
    )
    resp.raise_for_status()
    script_text = resp.json()["choices"][0]["message"]["content"].strip()

    db.table("action_scripts").insert({
        "commitment_id": commitment_id,
        "script_type": type,
        "script_text": script_text,
    }).execute()

    return {"commitment_id": commitment_id, "script_type": type, "script_text": script_text}


# ─── Open Paws Trigger ──────────────────────────────────────

def _trigger_open_paws(company_id: str, org_id: str) -> None:
    """
    Fire-and-forget: hit the n8n webhook that kicks off Open Paws.
    n8n fetches the company details and posts the report back to
    POST /internal/reports once complete.
    """
    import os, requests as req
    webhook_url = os.getenv("N8N_OPEN_PAWS_WEBHOOK_URL")
    if not webhook_url:
        return
    try:
        req.post(webhook_url, json={"company_id": company_id, "org_id": org_id}, timeout=5)
    except Exception:
        pass  # Non-blocking — report generation failure shouldn't break the save


@app.post("/internal/reports", status_code=201)
def receive_open_paws_report(payload: dict):
    """
    n8n calls this endpoint once Open Paws finishes.
    Stores the OSINT report in company_reports.
    """
    db = get_db()
    db.table("company_reports").insert({
        "company_id": payload["company_id"],
        "org_id": payload["org_id"],
        "report_json": payload["report"],
    }).execute()
    return {"message": "Report stored."}