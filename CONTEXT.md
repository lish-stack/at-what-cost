# At What Cost — Project Summary & Current State

## Project Overview

**At What Cost (AWC)** is an animal-focused accountability and mobilization platform that tracks public commitments made by corporations and institutions, monitors whether they are fulfilled, and creates durable public accountability records when deadlines are reached.

Built on a neutral commitment-tracking core, the platform mobilizes individuals around verified failures and aligns their actions with coordinated efforts led by advocacy organizations.

By anchoring campaigns, individual action, and institutional pressure to a shared accountability record, At What Cost enables sustained, collective pressure—especially after traditional campaigns conclude.

---

## Product Philosophy

### Core Principles

- **Commitments are the atomic unit**, not campaigns.
- **Time is the differentiator**: pre-deadline pressure, deadline escalation, post-deadline follow-up.
- **No separation between orgs and individuals** at the data layer.
- **Non-invasive org involvement**: ingest public commitments and campaigns; do not require org adoption.
- **Individuals act most effectively at the right moment**, not continuously.
- **AWC remembers so humans don’t have to.**

---

## Project Vision
We're building an app that makes corporate accountability as easy as ordering takeout.

## Design Principles
- **Action-first**: Every feature should drive user action
- **Honest metrics**: No vanity metrics or false impact claims
- **Non-preachy**: Appeal to non-vegans through corporate accountability angle
- **Mobile-first**: Optimized for quick actions on mobile

## Target Users (TBD)

### Primary
- Animal advocacy organizations
- Campaigners
- Researchers / analysts

### Secondary
- Ethically motivated individuals / consumers
- 18-34 years old
- Urban, conscious consumers
- Care about corporate ethics
- Want quick, meaningful actions

Organizations generate commitments and campaigns.  
AWC ensures those commitments are:
- structured
- remembered
- resurfaced
- mobilized against at the right time

If campaign exists we funnel individuals there, if not then we genertate script for indivudals to take action (email/phone) as the stopgap. 

---

## In-Scope vs Out-of-Scope

### In Scope
- Public commitments and deadlines
- Public campaigns (if they exist)
- Time-based alerts and resurfacing
- Accountability reports
- Positive reinforcement for compliant companies
- Individual mobilization via scripts when no campaign exists

### Out of Scope (for now)
- Internal NGO dashboards
- Campaign management tooling
- Private org-only scheduling systems
- Certification workflows (e.g. hospital/school programs)
- NGO operational tooling
- WhatsApp-based internal coordination tools

If future research shows strong demand for internal org tooling, scope may be revisited.

---

## High-Level System Architecture

### Stack
- **Frontend**: JavaScript (Vite / React)
- **Backend**: Python (FastAPI)
- **Orchestration**: n8n
- **Database**: PostgreSQL
- **Infra**: Docker + docker-compose

### Responsibility Split

| Component | Responsibility |
|---------|----------------|
| PostgreSQL | Source of truth |
| Python backend | Business logic, parsing, classification |
| n8n | Scheduling, triggers, integrations |
| Frontend | Read-only presentation + calls to action |

---

## Python vs n8n Decision Rule

### Use Python when:
- Logic evolves over time
- Judgement or classification is involved
- Code needs testing
- Business rules exist
- Confidence or scoring is needed

### Use n8n when:
- Scheduling or cron-like behavior
- Integrations across services
- Web scraping coordination
- Triggering alerts
- Calling APIs (including Python service)

**n8n orchestrates. Python decides.**

---

## Current Phase

### Phase A — Commitment Intelligence Layer (IN PROGRESS)

#### Implemented / Designed
- Commitment schema
- Deadline tracking
- Compliance states
- Evidence storage
- Event lifecycle model

#### Next Focus
- Time-based triggers
- Automated resurfacing
- Pre-/post-deadline pressure

---

## PostgreSQL Schema (v1 — locked)

### Enums
```sql
commitment_type_enum: 'cage_free_eggs'
compliance_status_enum: 'compliant' | 'partial' | 'non_compliant' | 'unknown'
event_type_enum: 'pre_deadline' | 'deadline' | 'post_deadline'
source_type_enum: 'report' | 'news' | 'company_statement'
````

### Tables

#### companies

* id
* name
* website
* industry
* created_at

#### commitments

* id
* company_id
* commitment_type
* public_statement_url
* commitment_text
* announced_date
* deadline_date
* current_status
* created_at

#### compliance_events

* id
* commitment_id
* event_type
* event_date
* status
* created_at

#### evidence

* id
* commitment_id
* source_url
* source_type
* summary
* created_at

#### decision_makers (optional v1)

* id
* company_id
* name
* role
* contact_url
* created_at

---

## Docker Architecture

### Services

* postgres
* backend (python)
* n8n
* frontend

### Version Pinning (Intentional)

* Python: `python:3.12-slim-bookworm`
* Node: `node:22-slim`

---

## Dockerfiles

### Backend (`backend/Dockerfile`)

```dockerfile
FROM python:3.12-slim-bookworm
# system deps
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*
# working directory
WORKDIR /app
# install deps first (better caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
# copy app
COPY . .
# expose port
EXPOSE 8000
# run server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

### Frontend (`frontend/Dockerfile`)

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host"]
```

---

## Current Technical Status

### Completed

* Repo connected to VS Code
* Docker + docker-compose setup
* PostgreSQL schema defined
* Backend + frontend containers defined
* Architectural decisions locked

### Actively Debugging / Finalizing

---

## Immediate Next Steps (Execution)

### Backend

1. Implement SQLAlchemy models
2. Create endpoint:

   ```
   POST /commitments/parse
   ```
3. Write commitments + events to Postgres

### n8n

1. Scheduled workflow:

   * scrape cage-free source
   * call Python endpoint
   * persist normalized data
2. Time-based triggers:

   * T-30
   * T-7
   * T-0
   * T+30

### Frontend

1. Read-only commitment list
2. Status badges
3. Deadline countdown
4. CTA links (campaign or generated scripts)

---

## Strategic Direction (Locked for Now)

* Build **Layer 1 (Commitment Intelligence)** regardless of downstream pivots.
* Continue org interviews focused on:

  * how commitments are tracked
  * when mobilization helps or hurts

* Treat scraping + synthesis as default; revisit manual uploads only if strongly demanded.

* Optimize for **persistent memory + timing**, not dashboards.

---


## Open Questions & Active Discovery

This project is intentionally being developed alongside user research. Several aspects of positioning and value are **deliberately not locked yet** and are being validated in parallel with technical development.

### Target Market (In Discovery)

Current working assumption:
- Advocacy organizations are the *primary source* of commitments and campaigns.
- Individuals are a *secondary audience* activated through time-based resurfacing.

However, the exact balance between:
- org-facing value (research, accountability, coordination)
- individual-facing value (awareness, mobilization, ethical decision-making)

is still being tested through interviews and observation.

The system is being designed so that this balance can shift **without architectural rewrites**.

---

### Mobilization Effectiveness (In Discovery)

It is not yet fully established:
- when individual actions materially contribute to campaign outcomes
- when they introduce noise or fatigue
- how pre-deadline pressure compares to post-deadline escalation

The current hypothesis is:
- individuals are most effective at *specific moments* in the commitment lifecycle
- time-based activation is more valuable than continuous engagement

This hypothesis is guiding design, but is not yet proven.

---

### Organizational Workflows (In Discovery)

Preliminary signals suggest:
- most animal welfare commitments originate from org pressure
- commitments and campaigns are usually public
- many orgs already track deadlines, but lack structured follow-up

Open questions include:
- whether orgs want to contribute private commitment data
- whether internal scheduling tools are a common unmet need
- whether AWC should remain purely ingestive or support limited uploads

Until validated, AWC defaults to:
- scraping + synthesis
- zero required org adoption
- non-invasive integration

---

### Scope Guardrails During Discovery

To prevent premature expansion:
- internal NGO tooling is explicitly out of scope
- campaign management features are excluded
- the system is constrained to commitments, time, and accountability events

Discovery will influence:
- prioritization
- presentation
- activation strategies

Discovery will *not* derail:
- the commitment intelligence layer
- the time-based trigger system
- the core data model

---

### Why This Is Acceptable

Layer 1 (Commitment Intelligence) is valuable regardless of:
- final target audience
- mobilization strategy
- org adoption depth

By building the infrastructure first and validating downstream use, AWC avoids locking into assumptions while still making irreversible technical progress.

### One-Line Summary

At What Cost is building time-aware infrastructure that turns forgotten animal welfare commitments into living accountability events—so pressure compounds instead of resetting.




## Verified Working Vertical Slice

FastAPI → SQLAlchemy → Postgres → JSON response

The system can now:

* Accept structured commitment payloads
* Insert company + commitment records
* Enforce enum constraints
* Persist data reliably
* Automatically insert `ComplianceEvent` upon commitment creation to anchor deadline lifecycle.
* Begin time-based querying and trigger logic.
* Anchored lifecycle events
* Manual event insertion

---

Current status: Core ingestion pipeline operational. Foundation for Commitment Intelligence layer established.


## Schemas

class CommitmentType(str, Enum):
    cage_free_eggs = "cage_free_eggs"


class CompanyCreate(BaseModel):
    name: str
    website: Optional[str] = None
    industry: Optional[str] = None


class CommitmentCreate(BaseModel):
    company: CompanyCreate
    commitment_type: CommitmentType
    commitment_text: str
    announced_date: date
    deadline_date: date
    public_statement_url: Optional[str] = None
    

class ComplianceStatus(str, Enum):
    compliant = "compliant"
    partial = "partial"
    non_compliant = "non_compliant"
    unknown = "unknown"


class EventType(str, Enum):
    pre_deadline = "pre_deadline"
    deadline = "deadline"
    post_deadline = "post_deadline"


class ComplianceEventCreate(BaseModel):
    event_type: EventType
    event_date: date
    status: ComplianceStatus
    update_commitment_status: Optional[bool] = False

## Models


commitment_type_enum = ENUM(
    'cage_free_eggs',
    name='commitment_type_enum',
    create_type=False
)

compliance_status_enum = ENUM(
    'compliant', 'partial', 'non_compliant', 'unknown',
    name='compliance_status_enum',
    create_type=False
)

event_type_enum = ENUM(
    'pre_deadline', 'deadline', 'post_deadline',
    name='event_type_enum',
    create_type=False
)

source_type_enum = ENUM(
    'report', 'news', 'company_statement',
    name='source_type_enum',
    create_type=False
)

class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False)
    website = Column(Text)
    industry = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())

    commitments = relationship("Commitment", back_populates="company")


class Commitment(Base):
    __tablename__ = "commitments"

    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, ForeignKey("companies.id"))
    commitment_type = Column(commitment_type_enum, nullable=False)
    public_statement_url = Column(Text)
    commitment_text = Column(Text)
    announced_date = Column(Date)
    deadline_date = Column(Date)
    current_status = Column(compliance_status_enum, default="unknown")
    created_at = Column(TIMESTAMP, server_default=func.now())

    company = relationship("Company", back_populates="commitments")
    events = relationship("ComplianceEvent", back_populates="commitment")
    evidence_items = relationship("Evidence", back_populates="commitment")


class ComplianceEvent(Base):
    __tablename__ = "compliance_events"

    id = Column(Integer, primary_key=True)
    commitment_id = Column(Integer, ForeignKey("commitments.id"))
    event_type = Column(event_type_enum, nullable=False)
    event_date = Column(Date, nullable=False)
    status = Column(compliance_status_enum, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    commitment = relationship("Commitment", back_populates="events")


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(Integer, primary_key=True)
    commitment_id = Column(Integer, ForeignKey("commitments.id"))
    source_url = Column(Text)
    source_type = Column(source_type_enum)
    summary = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())

    commitment = relationship("Commitment", back_populates="evidence_items")

## main.py

from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import date
from .db import SessionLocal
from . import models

from .schemas import CommitmentCreate, ComplianceEventCreate

app = FastAPI()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()




@app.get("/commitments")
def list_commitments(db: Session = Depends(get_db)):

    commitments = db.query(models.Commitment).all()

    results = []

    today = date.today()

    for c in commitments:

        # --- Compute days remaining ---
        if c.deadline_date:
            days_remaining = (c.deadline_date - today).days
        else:
            days_remaining = None

        # --- Derive lifecycle phase ---
        if days_remaining is None:
            lifecycle_phase = "unknown"
        elif days_remaining > 30:
            lifecycle_phase = "pre_deadline"
        elif 0 <= days_remaining <= 30:
            lifecycle_phase = "at_risk"
        else:
            lifecycle_phase = "overdue"

        results.append({
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
            "lifecycle_phase": lifecycle_phase
        })

    return results


@app.get("/commitments/{commitment_id}")
def get_commitment(commitment_id: int, db: Session = Depends(get_db)):

    commitment = (
        db.query(models.Commitment)
        .filter(models.Commitment.id == commitment_id)
        .first()
    )

    if not commitment:
        return {"error": "Commitment not found"}

    today = date.today()

    # --- Compute days remaining ---
    if commitment.deadline_date:
        days_remaining = (commitment.deadline_date - today).days
    else:
        days_remaining = None

    # --- Derive lifecycle phase ---
    if days_remaining is None:
        lifecycle_phase = "unknown"
    elif days_remaining > 30:
        lifecycle_phase = "pre_deadline"
    elif 0 <= days_remaining <= 30:
        lifecycle_phase = "at_risk"
    else:
        lifecycle_phase = "overdue"

    # --- Fetch compliance events ---
    events = (
        db.query(models.ComplianceEvent)
        .filter(models.ComplianceEvent.commitment_id == commitment.id)
        .all()
    )

    event_list = [
        {
            "id": e.id,
            "event_type": e.event_type,
            "event_date": e.event_date,
            "status": e.status,
            "created_at": e.created_at,
        }
        for e in events
    ]

    return {
        "id": commitment.id,
        "company": {
            "name": commitment.company.name,
            "website": commitment.company.website,
            "industry": commitment.company.industry,
        },
        "commitment_type": commitment.commitment_type,
        "commitment_text": commitment.commitment_text,
        "announced_date": commitment.announced_date,
        "deadline_date": commitment.deadline_date,
        "public_statement_url": commitment.public_statement_url,
        "current_status": commitment.current_status,
        "days_remaining": days_remaining,
        "lifecycle_phase": lifecycle_phase,
        "compliance_events": event_list
    }



@app.post("/commitments/{commitment_id}/events")
def add_compliance_event(
    commitment_id: int,
    payload: ComplianceEventCreate,
    db: Session = Depends(get_db)
):

    commitment = (
        db.query(models.Commitment)
        .filter(models.Commitment.id == commitment_id)
        .first()
    )

    if not commitment:
        raise HTTPException(status_code=404, detail="Commitment not found")

    # Create new event
    event = models.ComplianceEvent(
        commitment_id=commitment.id,
        event_type=payload.event_type,
        event_date=payload.event_date,
        status=payload.status
    )

    db.add(event)

    # Optionally update commitment current_status
    if payload.update_commitment_status:
        commitment.current_status = payload.status

    db.commit()

    return {
        "event_id": event.id,
        "commitment_id": commitment.id,
        "updated_commitment_status": payload.update_commitment_status
    }

## Frontend

components/
CommitmentCard.jsx
CommitmnetDetail.jsx
CommitmentList.jsx
LifecycleBadge.jsx

App.jsx

## Next Steps

Next Logical Evolution

You now choose one direction:

### Option A — Automation Layer

Auto-create:

deadline events when deadline_date == today

post_deadline events when overdue

This enables n8n triggers.

### Option B — Evidence Layer

Build:

POST /commitments/{id}/evidence

Attach supporting documents and sources.

You are now past structural setup.
From here forward, you are building intelligence or automation.