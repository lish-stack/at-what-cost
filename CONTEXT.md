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
- **AWC remembers so humans don't have to.**

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

If campaign exists we funnel individuals there, if not then we generate script for individuals to take action (email/phone) as the stopgap.

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

### Scraping
aggregated feed -> trigger -> scraping API -> retrieve the list of campiagns -> LLM sees if it relevant and is it new -> add to db

## Innoreader
recommended newsfeed aggregator to scrape from. 

---

## Current Phase

### Phase A — Commitment Intelligence Layer (IN PROGRESS)

#### Implemented ✅
- Commitment schema + SQLAlchemy models
- Deadline tracking
- Compliance states
- Evidence storage + endpoint
- Event lifecycle model
- `GET /commitments` — list all with lifecycle phase
- `GET /commitments/{id}` — detail with events + evidence
- `POST /commitments` — create commitment + auto-anchor deadline event
- `POST /commitments/{id}/events` — manual event insertion
- `POST /commitments/{id}/evidence` — attach evidence sources
- `POST /internal/process-deadlines` — automation trigger (n8n calls this daily)
- n8n daily cron workflow wired to deadline processor

#### Bug Fixes Applied ✅
- `get_commitment` now properly raises HTTP 404 instead of returning error dict
- Duplicate lifecycle/days logic extracted into shared helpers (`compute_days_remaining`, `derive_lifecycle_phase`)
- `derive_lifecycle_phase` now respects `compliant` status — compliant companies no longer show as overdue
- `serialize_commitment` helper used consistently across all GET endpoints

#### Next Focus
- Frontend wired to live API
- n8n notification node (Slack/email) on overdue events
- Scraping pipeline for cage-free data ingestion

---

## PostgreSQL Schema (v1 — locked)

### Enums
```sql
commitment_type_enum: 'cage_free_eggs'
compliance_status_enum: 'compliant' | 'partial' | 'non_compliant' | 'unknown'
event_type_enum: 'pre_deadline' | 'deadline' | 'post_deadline'
source_type_enum: 'report' | 'news' | 'company_statement'
```

### Tables

#### companies
* id, name, website, industry, created_at

#### commitments
* id, company_id, commitment_type, public_statement_url, commitment_text, announced_date, deadline_date, current_status, created_at

#### compliance_events
* id, commitment_id, event_type, event_date, status, created_at

#### evidence
* id, commitment_id, source_url, source_type, summary, created_at

#### decision_makers (optional v1)
* id, company_id, name, role, contact_url, created_at

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
RUN apt-get update && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
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

### Completed ✅
* Repo connected to VS Code
* Docker + docker-compose setup
* PostgreSQL schema defined
* Backend + frontend containers defined
* Architectural decisions locked
* Full ingestion pipeline: POST /commitments → company upsert → commitment → anchor event
* Evidence endpoint live
* Automation trigger endpoint live (`/internal/process-deadlines`)
* n8n daily cron wired to trigger Python
* Bug fixes: 404 handling, lifecycle logic deduplication, compliant status respected

### In Progress
* Frontend wired to live API data
* n8n notification node (Slack/email) when overdue events are created

---

## API Surface (Current)

| Method | Path | Purpose |
|--------|------|---------|
| GET | /commitments | List all commitments with lifecycle phase |
| GET | /commitments/{id} | Commitment detail with events + evidence |
| POST | /commitments | Create commitment (upserts company, anchors event) |
| POST | /commitments/{id}/events | Add manual compliance event |
| POST | /commitments/{id}/evidence | Attach evidence source |
| POST | /internal/process-deadlines | n8n trigger — auto-creates lifecycle events |

---

## Schemas

```python
class CommitmentType(str, Enum):
    cage_free_eggs = "cage_free_eggs"

class ComplianceStatus(str, Enum):
    compliant = "compliant"
    partial = "partial"
    non_compliant = "non_compliant"
    unknown = "unknown"

class EventType(str, Enum):
    pre_deadline = "pre_deadline"
    deadline = "deadline"
    post_deadline = "post_deadline"

class SourceType(str, Enum):
    report = "report"
    news = "news"
    company_statement = "company_statement"

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

class ComplianceEventCreate(BaseModel):
    event_type: EventType
    event_date: date
    status: ComplianceStatus
    update_commitment_status: Optional[bool] = False

class EvidenceCreate(BaseModel):
    source_url: str
    source_type: SourceType
    summary: str
```

---

## Frontend Components

```
components/
  CommitmentCard.jsx
  CommitmentDetail.jsx   (note: was misspelled "CommitmnetDetail")
  CommitmentList.jsx
  LifecycleBadge.jsx

App.jsx
```

---

## Immediate Next Steps (Execution)

### Backend — DONE ✅
All core endpoints implemented. Automation trigger live.

### n8n — PARTIALLY DONE
- [x] Daily cron → `/internal/process-deadlines`
- [ ] Wire IF node to Slack/email notification on overdue events
- [ ] Build cage-free scraping workflow → `POST /commitments`

### Frontend — TODO
1. Wire `CommitmentList` to `GET /commitments`
2. Wire `CommitmentDetail` to `GET /commitments/{id}`
3. `LifecycleBadge` should reflect: `compliant` | `pre_deadline` | `at_risk` | `overdue`
4. Deadline countdown from `days_remaining` field
5. CTA: if `public_statement_url` exists → link; else → generated contact script

---

## Automation Logic (in Python, called by n8n)

`POST /internal/process-deadlines` runs daily and:
- Skips commitments with no deadline or `compliant` status
- Creates `post_deadline` event when overdue and no post_deadline event exists yet
- Creates `pre_deadline` event at exactly T-30 and T-7
- Returns summary of what was created (n8n can branch on `events_created > 0`)

---

## Strategic Direction (Locked for Now)

* Build **Layer 1 (Commitment Intelligence)** regardless of downstream pivots.
* Continue org interviews focused on:
  * how commitments are tracked
  * when mobilization helps or hurts
* Treat scraping + synthesis as default; revisit manual uploads only if strongly demanded.

---

## Open Questions & Active Discovery

### Target Market (In Discovery)
- Advocacy organizations are the *primary source* of commitments and campaigns. Both campaigns and commitments are found through scraping. 
- Individuals are a *secondary audience* activated through time-based resurfacing.

### Target Market Differences in Tooling
- Individual and public-facing company dossier should have non-intensive tracking, perhaps general sustainability-focused information or commitment history. The organization's dashboard should have much more in-depth information that we would not want the company to see themselves or know about.   

### Organizational Workflows (In Discovery)
- Whether orgs want to contribute private commitment data.
- Whether AWC should remain purely ingestive or support limited uploads.
- Default: scraping + synthesis, zero required org adoption.

### Organzization's Problems

- Dashboard and internal tool fatigue.
- Lack of consistency/organization within Google Sheets/Excel
- Manual research of company is the most important yet most time-consuming/intensive.
- Google alerts flood inbox, especially for large comapny. 
- Researching company needs to be as easy as possible. Would want to check in on the company information before (or even during) a meeting
 

## Company Profile Database / Dossier
* still figuring how to build in a way that an organization can save specific companies they are researching, and prove their account, without making a whole other tool to integrate with...

* also in a way that filters the most useful information without overflowing, searchable definetely. 

### Useful Organization Information to track of company

Commitment & Compliance

- Cage-free / broiler commitment status
- Progress reports and filings
- ESG / CSR disclosures
- Annual AGM outcomes
- Progress made in other markets ("they did it in Europe, why not here")

Company Structure

- Leadership profile and corporate hierarchy
- Executive changes (triggers updated call sheets)
- Board memberships and overlapping affiliations
- Franchising structure and key partners
 
Signals & Triggers

- Website headline or page changes
- New public documents or reports
- Financial reports and IPO activity
- Social media changes
- Google News / press mentions
 
People to Target or Leverage

- Executive public statements usable for social media
- Brand ambassadors
- Internal advocates ("vocal influencers on the inside")
- Decision-maker contact info

---

## One-Line Summary

At What Cost is building time-aware infrastructure that turns forgotten animal welfare commitments into living accountability events—so pressure compounds instead of resetting.