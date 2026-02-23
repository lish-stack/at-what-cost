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
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
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