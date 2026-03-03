# At What Cost

Corporate animal welfare commitments get made, deadlines pass, and nothing happens. At What Cost closes that loop — publicly for consumers, and with serious depth for advocacy organizations running campaigns.

> For full product context, architecture decisions, and build status see [CONTEXT.md](CONTEXT.md).

---

## What It Does

### Public
- Browse corporate animal welfare commitments and accountability scores
- See upcoming deadlines and broken promises
- Take one-tap actions (email/call scripts) when campaigns exist

### Organizations (authenticated)
- Deep company dossiers 
- Scoped to saved companies
- OSINT reports generated automatically 

---

## Tech Stack

| Layer | Tool |
|-------|------|
| Frontend | React + Vite (web first) |
| Backend | Python / FastAPI |
| Database + Auth | Supabase (Postgres + RLS + Auth) |
| Orchestration | n8n |
| Commitment ingestion | Inoreader + Jina AI + OpenRouter Claude Haiku |
| Company OSINT | Open Paws API (n8n workflow) |
| Infra | Docker + docker-compose |

---

## Project Structure

```
at-what-cost/
├── backend/          # FastAPI app, models, endpoints
├── frontend/         # React + Vite
├── scraping/
│   └── rss/          # Inoreader webhook listener + test pipeline
├── n8n/              # Workflow exports
├── designs/             # Design docs, user research
└── data/             # Sample data

---

## Local Setup

### Prerequisites
- Docker + docker-compose
- Node 22+
- Python 3.12+
- Supabase account
- API keys: Anthropic, Jina AI (others listed in .env.example)

### 1. Clone and configure

```bash
git clone https://github.com/your-org/at-what-cost.git
cd at-what-cost
cp .env.example .env
# Fill in your API keys and Supabase credentials
```

### 2. Start services

```bash
docker-compose up --build
```

### 3. Services

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| n8n | http://localhost:5678 |

### 4. Test the ingestion pipeline

```bash
# Fetch-only (no API key needed)
python scraping/rss/test_pipeline.py --fetch-only --verbose https://mercyforanimals.org/blog/

# Full pipeline (~$0.002 per URL)
python scraping/rss/test_pipeline.py --verbose https://mercyforanimals.org/blog/
```

---

## Environment Variables

```
# Required
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
JINA_API_KEY=

# Ingestion pipeline
INOREADER_WEBHOOK_SECRET=
LLM_MODEL=claude-haiku-4-5-20251001

# Open Paws / OSINT (org tier)
COURTLISTENER_API_KEY=
LEGISCAN_API_KEY=
SERPER_API_KEY=
OPENROUTER_API_KEY=
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).