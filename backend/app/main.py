# backend/app/main.py

from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date
from .db import SessionLocal
from . import models
from .schemas import CommitmentCreate, ComplianceEventCreate, EvidenceCreate

app = FastAPI()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─── Shared Helpers ────────────────────────────────────────────────────────────

def compute_days_remaining(deadline_date):
    if not deadline_date:
        return None
    return (deadline_date - date.today()).days


def derive_lifecycle_phase(days_remaining: int | None, current_status: str) -> str:
    if current_status == "compliant":
        return "compliant"
    if days_remaining is None:
        return "unknown"
    if days_remaining > 30:
        return "pre_deadline"
    if 0 <= days_remaining <= 30:
        return "at_risk"
    return "overdue"


def serialize_commitment(c, include_events=False):
    days_remaining = compute_days_remaining(c.deadline_date)
    lifecycle_phase = derive_lifecycle_phase(days_remaining, c.current_status)

    result = {
        "id": c.id,
        "company": {
            "name": c.company.name,
            "website": c.company.website,
            "industry": c.company.industry,
        },
        "commitment_type": c.commitment_type,
        "commitment_text": c.commitment_text,
        "announced_date": c.announced_date,
        "deadline_date": c.deadline_date,
        "public_statement_url": c.public_statement_url,
        "current_status": c.current_status,
        "days_remaining": days_remaining,
        "lifecycle_phase": lifecycle_phase,
    }

    if include_events:
        result["compliance_events"] = [
            {
                "id": e.id,
                "event_type": e.event_type,
                "event_date": e.event_date,
                "status": e.status,
                "created_at": e.created_at,
            }
            for e in c.events
        ]
        result["evidence"] = [
            {
                "id": ev.id,
                "source_url": ev.source_url,
                "source_type": ev.source_type,
                "summary": ev.summary,
                "created_at": ev.created_at,
            }
            for ev in c.evidence_items
        ]

    return result


# ─── Commitments ───────────────────────────────────────────────────────────────

@app.get("/commitments")
def list_commitments(db: Session = Depends(get_db)):
    commitments = db.query(models.Commitment).all()
    return [serialize_commitment(c) for c in commitments]


@app.get("/commitments/{commitment_id}")
def get_commitment(commitment_id: int, db: Session = Depends(get_db)):
    commitment = db.query(models.Commitment).filter(models.Commitment.id == commitment_id).first()
    if not commitment:
        raise HTTPException(status_code=404, detail="Commitment not found")
    return serialize_commitment(commitment, include_events=True)


@app.post("/commitments", status_code=201)
def create_commitment(payload: CommitmentCreate, db: Session = Depends(get_db)):
    # Upsert company by name (non-invasive: don't create duplicates)
    company = db.query(models.Company).filter(models.Company.name == payload.company.name).first()
    if not company:
        company = models.Company(
            name=payload.company.name,
            website=payload.company.website,
            industry=payload.company.industry,
        )
        db.add(company)
        db.flush()  # get company.id without committing

    # Create commitment
    commitment = models.Commitment(
        company_id=company.id,
        commitment_type=payload.commitment_type,
        commitment_text=payload.commitment_text,
        announced_date=payload.announced_date,
        deadline_date=payload.deadline_date,
        public_statement_url=payload.public_statement_url,
        current_status="unknown",
    )
    db.add(commitment)
    db.flush()

    # Auto-anchor: create the initial deadline event to seed the lifecycle
    anchor_event = models.ComplianceEvent(
        commitment_id=commitment.id,
        event_type="deadline",
        event_date=payload.deadline_date,
        status="unknown",
    )
    db.add(anchor_event)
    db.commit()

    return {
        "commitment_id": commitment.id,
        "company_id": company.id,
        "message": "Commitment created and lifecycle anchored."
    }


# ─── Compliance Events ─────────────────────────────────────────────────────────

@app.post("/commitments/{commitment_id}/events", status_code=201)
def add_compliance_event(
    commitment_id: int,
    payload: ComplianceEventCreate,
    db: Session = Depends(get_db)
):
    commitment = db.query(models.Commitment).filter(models.Commitment.id == commitment_id).first()
    if not commitment:
        raise HTTPException(status_code=404, detail="Commitment not found")

    event = models.ComplianceEvent(
        commitment_id=commitment.id,
        event_type=payload.event_type,
        event_date=payload.event_date,
        status=payload.status,
    )
    db.add(event)

    if payload.update_commitment_status:
        commitment.current_status = payload.status

    db.commit()

    return {
        "event_id": event.id,
        "commitment_id": commitment.id,
        "updated_commitment_status": payload.update_commitment_status,
    }


# ─── Evidence ──────────────────────────────────────────────────────────────────

@app.post("/commitments/{commitment_id}/evidence", status_code=201)
def add_evidence(
    commitment_id: int,
    payload: EvidenceCreate,
    db: Session = Depends(get_db)
):
    commitment = db.query(models.Commitment).filter(models.Commitment.id == commitment_id).first()
    if not commitment:
        raise HTTPException(status_code=404, detail="Commitment not found")

    evidence = models.Evidence(
        commitment_id=commitment.id,
        source_url=payload.source_url,
        source_type=payload.source_type,
        summary=payload.summary,
    )
    db.add(evidence)
    db.commit()

    return {
        "evidence_id": evidence.id,
        "commitment_id": commitment.id,
    }


# ─── Automation Trigger (called by n8n on a daily cron) ───────────────────────

@app.post("/internal/process-deadlines")
def process_deadlines(db: Session = Depends(get_db)):
    """
    Called daily by n8n. Scans all commitments and auto-creates
    lifecycle events for overdue and at-risk deadlines.
    Returns a summary of what was processed.
    """
    today = date.today()
    commitments = db.query(models.Commitment).all()

    created_events = []
    skipped = []

    for c in commitments:
        if not c.deadline_date:
            continue
        if c.current_status == "compliant":
            continue  # already resolved, skip

        days_remaining = (c.deadline_date - today).days
        existing_types = {e.event_type for e in c.events}

        # Auto-create post_deadline event if overdue and not already present
        if days_remaining < 0 and "post_deadline" not in existing_types:
            event = models.ComplianceEvent(
                commitment_id=c.id,
                event_type="post_deadline",
                event_date=today,
                status=c.current_status,
            )
            db.add(event)
            created_events.append({
                "commitment_id": c.id,
                "company": c.company.name,
                "event_type": "post_deadline",
                "days_overdue": abs(days_remaining),
            })

        # Auto-create pre_deadline event at T-30 and T-7
        elif days_remaining in (30, 7):
            event = models.ComplianceEvent(
                commitment_id=c.id,
                event_type="pre_deadline",
                event_date=today,
                status=c.current_status,
            )
            db.add(event)
            created_events.append({
                "commitment_id": c.id,
                "company": c.company.name,
                "event_type": "pre_deadline",
                "days_remaining": days_remaining,
            })
        else:
            skipped.append(c.id)

    db.commit()

    return {
        "processed_at": today.isoformat(),
        "events_created": len(created_events),
        "detail": created_events,
        "skipped_commitment_ids": skipped,
    }