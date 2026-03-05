# At What Cost — Project Context
> Single source of truth. README.md covers setup only. All other MD files deprecated.

---

github: https://github.com/lish-stack/at-what-cost

## One-Line Summary
At What Cost turns forgotten animal welfare commitments into living accountability records — and gives advocacy organizations deep, structured intelligence on the companies they're pressuring.

---

## Product Vision
We're building an app that makes corporate accountability as easy as ordering takeout.

Corporate commitments get made, deadlines pass, and nothing happens. AWC closes that loop — publicly for consumers, and with serious depth for organizations running campaigns.

---

## Design Principles
- **Action-first**: Every feature should drive user action
- **Honest metrics**: No vanity metrics or false impact claims
- **Non-preachy**: Appeal to non-vegans through corporate accountability angle
- **Mobile-first**: Optimized for quick actions on mobile

---

## Two Audiences, One Codebase

### Public / Individual Users
- Browse commitments and company accountability scores
- Click through to a basic company profile
- See urgency signals (upcoming deadlines, broken promises)
- Take one-tap actions (email/call scripts) when campaigns exist

### Org Users (authenticated)
- Same base experience as public, but scoped to their **saved companies**
- Company page = shared public view + **org-only panel** (additive, not separate)
- Org panel includes: leadership profiles, corporate structure, court cases, legislation, OSINT report, decision-maker contacts
- Home shows stats scoped to their own campaigns, not global
- Orgs hold **long-lived API keys** for programmatic access

The org panel data is never visible to the company being researched. Supabase Row Level Security enforces this at the database layer.

---

## Core Concept
- **Commitments are the atomic unit** — not campaigns, not companies
- **Company database is the central value prop** — rich, structured intelligence that compounds over time
- **Time-based triggers exist but are deprioritized** — every org manages schedules differently; robotic alerts reduce effectiveness. Background feature, not core loop.
- AWC remembers so humans don't have to

---

## Four App Sections

| # | Section | Public | Org |
|---|---------|--------|-----|
| 1 | **Home** | Urgent actions, global stats, spotlight companies | Same layout, stats scoped to saved companies + their campaigns |
| 2 | **Brands** | Full directory — search, filter, accountability scores | Saved companies only — same cards, deeper dossier on click |
| 3 | **Act** | Available actions (email/call scripts) | — |
| 4 | **Give** | Donation options | — |

> **Act** and **Give** are out of scope for MVP.

---

## MVP Stack (Locked)

| Layer | Tool |
|-------|------|
| Commitment ingestion | **Inoreader** (RSS) → keyword filter → webhook → Jina AI fetch → Claude Haiku extraction |
| Article fetching | **Jina AI Reader** (`r.jina.ai/` prefix) — handles JS-rendered pages, clean markdown output |
| Company OSINT | **Open Paws API** (n8n workflow — CourtListener, LegiScan, DocumentCloud, Serper + Jina AI) |
| LLM | **Claude/OpenRouter** (Haiku for extraction, Sonnet for synthesis/reports) |
| Database + Auth | **Supabase** (Postgres + RLS + Auth + encryption) |
| Orchestration | **n8n** |
| Backend | **Python / FastAPI** |
| Frontend | **React (Vite)** — web first, React Native later |
| Infra | **Docker + docker-compose** |

---

## Open Paws API — What It Does

Multi-phase OSINT agent that builds deep company profiles from public sources:

1. **Discovery** — CourtListener (court cases), LegiScan (legislation), DocumentCloud (gov docs), Serper (news/web)
2. **Verification** — confirms records actually relate to the target company (avoids false positives from similar names)
3. **Prioritization** — scores and selects most relevant items
4. **Retrieval** — fetches full text of opinions, bills, documents
5. **Analysis** — synthesizes findings into strategic insights
6. **Verification** — checks final report against sources

Input: `{ companyName, companyDomain, reportGoal }`
Output: Structured strategic report — stored in Supabase, visible only to orgs with access.

Required API keys: CourtListener, LegiScan, Serper, Jina AI, OpenRouter.

---

## Data Tiers & Supabase RLS

| Data | Visible To | Stored In |
|------|-----------|-----------|
| Commitments, scores, basic company info | Everyone | `companies`, `commitments` tables |
| Active org campaigns (GoCageFree, MFA, AE, etc.) | Everyone | `campaigns` (public read) |
| Generated action scripts | Everyone | `action_scripts` (public read, cached) |
| OSINT reports, court cases, legislation | Org users only | `company_reports` (RLS: org_id match) |
| Saved company lists | Org users only | `org_saved_companies` (RLS) |
| Decision-maker contacts | Org users only | `decision_makers` (RLS) |

Auth: Supabase Auth handles login, roles (`public`, `org`), and session management. Orgs can hold long-lived API keys for programmatic/n8n access.

---

## Company Page Structure

### Public layer (everyone sees this)
- Commitment status + history
- Accountability score
- Deadline tracking
- Evidence sources
- Existing public campaigns + CTA

### Org panel (bolted on, auth-gated)

> **MVP behavior**: Open Paws runs automatically when an org saves a company. Data populates once and is static until manually re-triggered. No refresh buttons in MVP.

> **Post-MVP — Refresh-by-section**: Each section will have a button that triggers a lightweight, scoped workflow (truncated n8n or dedicated endpoint) that refetches and overwrites only that section's data. changedetection.io slots into Signals & Triggers here. Implementation approach TBD.

#### Commitment & Compliance
- Cage-free / broiler commitment status
- Progress reports and filings
- ESG / CSR disclosures
- Annual AGM outcomes
- Progress in other markets ("they did it in Europe, why not here")

#### Company Structure
- Leadership profile + corporate hierarchy
- Executive changes (triggers updated call sheets)
- Board memberships + overlapping affiliations
- Franchising structure + key partners

#### Signals & Triggers
- Website headline or page changes *(changedetection.io — post-MVP, self-hosted Docker)*
- New public documents or reports
- Financial reports + IPO activity
- Social media changes
- Google News / press mentions

#### People to Target or Leverage
- Executive public statements usable for social media
- Brand ambassadors
- Internal advocates (vocal influencers on the inside)
- Decision-maker contact info

#### Legal & Legislative (via Open Paws API)
- Court cases + legal history (CourtListener)
- Related legislation across states (LegiScan)
- Government documents + reports (DocumentCloud)
- OSINT synthesis report

#### Internal (org-specific, never shared)
- Notes, tags, campaign linkage

---

## Design System

- **Logo**: at-what-cost-logo
- **Font**: Reddit Mono (12–20px; line-height = font-size + 8px)
- **Brand colors**: Burgundy `#660033`, Tiber `#0A3345`
- **Accent colors**: Vegan Cream `#FAF7F2`, Soft Gray `#E8E8E8`
- **Icons**: Google Material Icons (Apache 2.0)
- Clean, minimal aesthetic

---

## Commitment Ingestion Pipeline

```
Inoreader RSS feeds (Google News, NGO blogs, etc.)
    ↓
Keyword rules — cheap first filter, costs nothing
(e.g. "cage-free", "broiler", "animal welfare commitment")
Tighten rules here before touching the API layer
    ↓
Webhook → webhook_listener.py
    ↓
1. Jina AI Reader fetches full article (r.jina.ai/{url})
   — handles JS-rendered pages, returns clean markdown
   — same Jina key already used by Open Paws
2. OpenRouter → structured extraction + relevance score
3. Relevance score >= 50 + is_new → store to Supabase
```

**On filtering**: Inoreader keyword rules are the free gate — no LLM runs until a rule matches. OpenRouter's relevance score (≥50) is the second gate, catching noise that slips through. No LLM pre-filter needed before Inoreader; tightening keyword combinations is more cost-effective.

### LLM Extracts
- Company (name, website, industry)
- Commitment (type, text, dates, status, species, scope, progress %)
- Evidence (source type, summary)
- Campaign (summary, tactic, CTA, urgency score)
- Decision makers (name, role, contact URL)

---

## PostgreSQL Schema (via Supabase)

### Enums
```sql
commitment_type_enum: 'cage_free_eggs' | 'broiler_welfare'
compliance_status_enum: 'compliant' | 'partial' | 'non_compliant' | 'unknown'
event_type_enum: 'pre_deadline' | 'deadline' | 'post_deadline'
source_type_enum: 'report' | 'news' | 'company_statement'
```

### Tables
- **companies** — id, name, website, industry, created_at
- **commitments** — id, company_id, commitment_type, public_statement_url, commitment_text, announced_date, deadline_date, current_status, created_at
- **compliance_events** — id, commitment_id, event_type, event_date, status, created_at
- **evidence** — id, commitment_id, source_url, source_type, summary, created_at
- **campaigns** — id, company_id, org_name, campaign_url, campaign_title, is_active, created_at *(public read)*
- **action_scripts** — id, commitment_id, script_type (email|phone), script_text, generated_at *(public read, cached)*
- **decision_makers** — id, company_id, name, role, contact_url, created_at *(org-only via RLS)*
- **company_reports** — id, company_id, report_json, generated_at, org_id *(org-only via RLS)*
- **org_saved_companies** — org_id, company_id *(org-only via RLS)*

---

## API Surface (Current)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/commitments` | List all with lifecycle phase |
| GET | `/commitments/{id}` | Detail with events + evidence |
| POST | `/commitments` | Create (upserts company, anchors event) |
| POST | `/commitments/{id}/events` | Add manual compliance event |
| POST | `/commitments/{id}/evidence` | Attach evidence source |
| GET | `/commitments/{id}/action-script?type=email\|phone` | Return cached generated script |
| POST | `/commitments/{id}/action-script?type=email\|phone` | Generate + cache LLM script (OpenRouter) |
| GET | `/companies/{id}/campaigns` | Active org campaigns for a company |
| GET | `/org/saved-companies` | Org's saved companies with commitments |
| POST | `/org/saved-companies/{id}` | Save company + trigger Open Paws |
| DELETE | `/org/saved-companies/{id}` | Unsave company |
| GET | `/org/companies/{id}/report` | OSINT report (org-only) |
| GET | `/org/companies/{id}/notes` | Org notes (org-only) |
| PUT | `/org/companies/{id}/notes` | Upsert org notes |
| POST | `/internal/process-deadlines` | n8n trigger — auto lifecycle events *(deprioritized)* |
| POST | `/internal/reports` | Receive Open Paws report from n8n |

---

## Frontend Components (Current)

```
components/
  HomePage.jsx          — stats, urgent actions, spotlight; org view scoped to saved companies
  CommitmentCard.jsx
  CommitmentDetail.jsx  — includes TakeAction at bottom
  CommitmentList.jsx
  CompanyList.jsx       — brand directory, search, groups by company
  CompanyCard.jsx       — per-brand card with worst lifecycle phase
  CompanyDetail.jsx     — all commitments for a company + OrgPanel
  LifecycleBadge.jsx    — handles all backend phases (compliant, at_risk, overdue, unknown)
  TakeAction.jsx        — campaigns first; generated email/phone script as fallback
  OrgPanel.jsx          — 6 section skeletons (Open Paws data when available)
  AuthPage.jsx
App.jsx                 — routes: / /commitments/:id /companies /companies/:name /auth
```


## Hosting Architecture

'''
watchdog.masonstahl.com       → Cloudflare Tunnel → NAS port 3000 (frontend)
api.watchdog.masonstahl.com   → Cloudflare Tunnel → NAS port 8000 (backend)
awc.masonstahl.com            → Cloudflare Tunnel → NAS port 8001 (Inoreader webhook)
'''

---

## Build Status

### Done ✅
- Commitment schema + SQLAlchemy models
- Deadline tracking + compliance states
- Evidence storage + endpoint
- Event lifecycle model
- All core GET/POST commitment endpoints
- `POST /internal/process-deadlines` automation trigger
- n8n daily cron wired to deadline processor
- Bug fixes: 404 handling, lifecycle deduplication, compliant status respected
- RSS webhook pipeline (Inoreader → OpenRouter → JSON)
- Supabase schema + RLS
- Backend API (FastAPI + Supabase)
- Scraping pipeline (Inoreader → Jina → OpenRouter → Supabase)
- Frontend wired to live API (CommitmentList + CommitmentDetail pulling from Supabase)
- CORS configured on backend
- Vite port aligned to docker-compose (3000)
- Supabase service role key + RLS insert policy on companies table fixed
- Brands/Companies page — CompanyList, CompanyCard, CompanyDetail; groups `GET /commitments` by company client-side; worst `lifecycle_phase` as accountability signal; client-side search; routes `/companies` and `/companies/:name`
- Org auth layer — Supabase Auth, AuthContext, login/signup page, role fetch from `profiles` table, `user_role_enum` ('public' | 'org')
- Org panel — OrgPanel rebuilt with 6 section skeletons (Commitment & Compliance, Company Structure, Signals & Triggers, People to Target, Legal & Legislative, Internal Notes); skeleton state shows structure before Open Paws data; pending state shows warm placeholder when saved but no report yet
- Org RLS — policies on `profiles`, `org_saved_companies`, `company_reports`, `org_company_notes`; signup trigger auto-creates profile with 'public' role
- Nav bar — auth state (email, Org badge, Sign Out); `/auth` route
- Inoreader pipeline live — Cloudflare Tunnel (awc-dev.masonstahl.com → port 8001); Inoreader rule triggers `POST /webhook/inoreader`; pipeline tested end-to-end with live article
- `VITE_API_URL` env var — all `localhost:8000` hardcodes replaced; dev=`http://localhost:8000`, prod=`https://api.watchdog.masonstahl.com`
- Home page — public: urgent actions (overdue/at_risk), global stats (companies, total, % compliant), spotlight (fully compliant companies); org view scoped to saved companies with banner
- LifecycleBadge — updated to handle all backend phases (`compliant`, `at_risk`, `unknown`)
- Take Action — `campaigns` + `action_scripts` tables; `GET /companies/{id}/campaigns` + `GET|POST /commitments/{id}/action-script`; `TakeAction.jsx` at bottom of CommitmentDetail; shows org campaigns first (additive), falls back to LLM-generated email/phone script with copy button; scripts cached in Supabase
- ChickenWatch seed — `tools/seed_chickenwatch.py` imports Google Sheet via `gviz/tq?tqx=out:json`; seeded 2801 companies + 3298 commitments (cage-free + broiler) from ChickenWatch.org tracker (sheet ID: `1GcOfjaHy0xTPluZKUkxyNH8u0_qE7T6tdUpeUg7GEyI`)
- `commitment_type_enum` expanded — `broiler_welfare` added via `ALTER TYPE commitment_type_enum ADD VALUE 'broiler_welfare'`
- `GET /commitments` pagination — loops `.range(offset, offset+999)` to bypass Supabase 1000-row default limit; returns all 3298 commitments

### Next Up
- Accountability score on CompanyCard (derived from worstPhase — label or letter grade)
- Synology NAS deployment — docker-compose on NAS, Cloudflare Tunnel (watchdog.masonstahl.com → frontend, api.watchdog.masonstahl.com → backend, awc.masonstahl.com → webhook); update backend CORS for production origin
- Open Paws API integration (n8n webhook trigger wired to `POST /org/saved-companies/:id` already exists — needs N8N_OPEN_PAWS_WEBHOOK_URL in .env; waiting on Open Paws API access)
- Org onboarding UX — currently manual SQL to upgrade role; decide if self-serve or keep manual for MVP

### Deprioritized (not dropped)
- Time-based notification system (n8n Slack/email on overdue)
- Refresh-by-section org panel (scoped n8n workflows or dedicated endpoints per section; changedetection.io slots into Signals & Triggers here)
- Act section (action templates, email/call execution)
- Give section (donation options)
- React Native / mobile app

---

## Open Questions

- ~~**Company dossier trigger**~~ — Resolved: Open Paws runs automatically when a company is saved.
- **Org onboarding**: Self-serve signup implemented (anyone can create account); role upgrade to 'org' is currently manual SQL. Decide if this stays manual for MVP or needs a request/approval flow.
- ~~**Score methodology**~~ — MVP approach: derive from worst `lifecycle_phase` across a company's commitments (overdue > at_risk > pre_deadline > compliant). Computed client-side from `GET /commitments` grouped by company. Numeric score system (like index.html) is post-MVP.
- **Private commitment data**: Do orgs ever contribute non-public commitment data, or is AWC purely ingestive?
- ~~**Take Action flow**~~ — Resolved: surface org campaigns first (additive, all shown); generated email/phone script as fallback when no campaigns exist.

---

## In Scope vs Out of Scope

### In Scope
- Public commitment tracking + company profiles
- Org-authenticated deep dossiers (via Open Paws)
- Scraping pipeline (Inoreader + OpenRouter)
- Time-based triggers (background, deprioritized)
- Individual mobilization via scripts when no campaign exists
- Positive reinforcement for compliant companies

### Out of Scope (for now)
- Internal NGO dashboards / campaign management tooling
- Certification workflows
- WhatsApp-based coordination
- Private org-only scheduling systems
- React Native app (web first)