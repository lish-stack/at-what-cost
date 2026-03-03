# RSS Webhook Pipeline

Automated pipeline that monitors RSS feeds via Inoreader, fetches full articles, and uses Claude Haiku to extract structured animal welfare commitment data.

## How It Works

```
Inoreader RSS feeds (Google News, NGO blogs, etc.)
    |
    v
Keyword rule matches (e.g. "cage-free")
    |
    v
Webhook fires to our endpoint
    |
    v
webhook_listener.py receives it
    |
    v
1. Fetch full article page (BeautifulSoup)
2. Send to Claude Haiku for structured extraction
3. Store relevant results to data/webhook_results.json
```

The LLM extracts structured data matching our database schema:
- **Company** (name, website, industry)
- **Commitment** (type, text, dates, status, species, scope, progress %)
- **Evidence** (source type, summary)
- **Campaign** (summary, tactic, call-to-action, urgency score)
- **Decision Makers** (name, role, contact URL)

Each article gets a relevance score (0-100). Only articles scoring >= 50 with new information are stored.

## Files

| File | Purpose |
|------|---------|
| `webhook_listener.py` | FastAPI server: webhook endpoint + page fetcher + LLM extraction |
| `test_pipeline.py` | CLI tool to test the pipeline without Inoreader |

## Quick Start

### 1. Install dependencies

```bash
pip install fastapi uvicorn anthropic beautifulsoup4 python-dotenv requests
```

### 2. Set environment variables

Create a `.env` file in the repo root:

```
ANTHROPIC_API_KEY=sk-ant-...     # Required
INOREADER_WEBHOOK_SECRET=        # Optional shared secret
LLM_MODEL=claude-haiku-4-5-20251001
```

### 3. Test locally (no Inoreader needed)

```bash
# Free test - just page fetching, no API key needed
python scraping/rss/test_pipeline.py --fetch-only --verbose \
  https://mercyforanimals.org/blog/

# Full pipeline test (uses ~$0.002 of API credits per URL)
python scraping/rss/test_pipeline.py --verbose \
  https://mercyforanimals.org/blog/

# Batch from file
python scraping/rss/test_pipeline.py --file urls.txt --output results.json
```

### 4. Run the webhook server

```bash
# Start the server
uvicorn scraping.rss.webhook_listener:app --reload --port 8001

# Test with curl
curl -X POST http://localhost:8001/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"title":"Subway goes 100% cage-free","link":"https://mercyforanimals.org/blog/"}'

# Check stored results
curl http://localhost:8001/results
```

### 5. Connect to Inoreader (live mode)

Inoreader can't reach localhost, so you need a tunnel:

```bash
# Terminal 1: Start server
uvicorn scraping.rss.webhook_listener:app --reload --port 8001

# Terminal 2: Start tunnel (requires ngrok account)
ngrok http 8001
# Copy the https://xxx.ngrok-free.app URL
```

Then in Inoreader Pro:
1. Subscribe to RSS feeds (Google News cage-free, MFA, ACE, etc.)
2. Create a Rule: keyword match -> trigger webhook
3. Webhook URL: `https://YOUR_NGROK_URL/webhook/inoreader`
4. Click "Run rule" to test against existing articles

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/webhook/inoreader` | Receives real Inoreader webhooks (items array format) |
| `POST` | `/webhook/test` | Simple test endpoint (`{title, link, content}`) |
| `GET` | `/results` | Returns all stored results |

## Page Fetcher

The pipeline fetches the full article before sending to the LLM. Extraction cascade:

1. `<article>` tag (best signal)
2. CSS selectors: `.article-body`, `.post-content`, `.entry-content`, `main`
3. `<body>` fallback

JS-rendered SPAs (e.g. thehumaneleague.org) return empty bodies with plain HTTP. For those, the spider approach with Playwright is needed (see `scraping/spiders/`).

## LLM Output Format

```json
{
  "relevance": 85,
  "is_new": true,
  "alert_priority": "high",
  "company": {
    "name": "Subway",
    "website": "subway.com",
    "industry": "food_service"
  },
  "commitment": {
    "commitment_type": "cage_free_eggs",
    "commitment_text": "100% cage-free eggs across all US and Canada locations",
    "announced_date": "2025-11-17",
    "deadline_date": null,
    "current_status": "compliant",
    "species": "chicken-layers",
    "scope": "US-only",
    "progress_pct": 100
  },
  "evidence": {
    "source_type": "news",
    "summary": "Subway confirmed full transition to cage-free eggs in all North American locations."
  },
  "campaign": {
    "summary": "Campaign achieved Subway's commitment to 100% cage-free eggs.",
    "tactic": "other",
    "cta": "Support similar campaigns for other companies.",
    "score": {"value": 4, "rationale": "High impact on hen welfare across major chain."}
  },
  "decision_makers": []
}
```

## Cost

- **Claude Haiku API**: ~$0.002 per article (~$2-3/month at 50 articles/day)
- **Inoreader Pro**: $7.50/month (required for webhooks)
- **ngrok**: Free tier works for testing
