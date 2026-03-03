"""
Inoreader Webhook Listener + Full-Page Scraper + LLM Structured Extraction

Pipeline: webhook trigger -> fetch full page -> LLM extracts structured data -> store

Usage:
    pip install fastapi uvicorn anthropic beautifulsoup4 python-dotenv requests
    uvicorn scraping.rss.webhook_listener:app --reload --port 8001
"""

from __future__ import annotations

import json
import re
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Tuple

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

try:
    import anthropic
except ImportError:
    anthropic = None

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env", override=True)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="At What Cost — Scraping Pipeline")

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
INOREADER_WEBHOOK_SECRET = os.getenv("INOREADER_WEBHOOK_SECRET", "")
LLM_MODEL = os.getenv("LLM_MODEL", "claude-haiku-4-5-20241022")
RELEVANCE_THRESHOLD = 50

RESULTS_FILE = REPO_ROOT / "data" / "webhook_results.json"

FETCH_TIMEOUT = 15
FETCH_USER_AGENT = "Mozilla/5.0 (compatible; AWCBot/1.0; +https://github.com/lish-stack/at-what-cost)"
MAX_ARTICLE_LENGTH = 8000
JINA_API_KEY = os.getenv("JINA_API_KEY", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

try:
    from supabase import create_client
except ImportError:
    create_client = None

def _get_supabase():
    if not create_client or not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        return None
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


# --- Jina AI Article Fetcher ---

def fetch_article_text(url: str) -> Tuple[Optional[str], dict]:
    """
    Fetch full article via Jina AI Reader (r.jina.ai/{url}).
    Handles JS-rendered pages natively. Same key used by Open Paws.
    """
    metadata = {
        "url": url, "status_code": None, "extraction_method": "jina_ai",
        "content_length": 0, "truncated": False, "error": None,
    }
    jina_url = f"https://r.jina.ai/{url}"
    headers = {"User-Agent": FETCH_USER_AGENT}
    if JINA_API_KEY:
        headers["Authorization"] = f"Bearer {JINA_API_KEY}"
    try:
        resp = requests.get(jina_url, headers=headers, timeout=FETCH_TIMEOUT)
        resp.raise_for_status()
        metadata["status_code"] = resp.status_code
        text = resp.text.strip()
        if len(text) > MAX_ARTICLE_LENGTH:
            text = text[:MAX_ARTICLE_LENGTH]
            metadata["truncated"] = True
        metadata["content_length"] = len(text)
        if not text:
            metadata["error"] = "Jina returned empty content"
            return None, metadata
        return text, metadata
    except requests.Timeout:
        metadata["error"] = "Jina timed out"
        return None, metadata
    except requests.HTTPError as e:
        metadata["error"] = f"Jina HTTP {e.response.status_code if e.response else 'err'}"
        return None, metadata
    except Exception as e:
        metadata["error"] = f"Unexpected: {str(e)[:100]}"
        return None, metadata

# --- LLM Structured Extraction ---

SYSTEM_PROMPT = """\
You are an animal welfare commitment analyst for the At What Cost accountability platform.
Given a news article, press release, or campaign page, analyze it and return a JSON object.

Return ONLY valid JSON with these fields:

1. "relevance" (integer 0-100):
   80-100: Directly about a specific company making, breaking, or updating an animal welfare commitment
   50-79: About animal welfare in a corporate context but not a specific commitment
   20-49: Tangentially related (general animal welfare news)
   0-19: Not relevant

2. "is_new" (boolean): Is this genuinely new information, or a rehash/opinion piece?

3. "alert_priority": one of ["critical", "high", "medium", "low", "none"]
   - critical: Company breaks/abandons commitment, major investigation expose
   - high: New commitment, commitment fulfilled, deadline extended
   - medium: Progress update, campaign launch
   - low: Tangentially related news
   - none: Not relevant

4. "company" (object or null): Extracted company data
   {
     "name": "official company name",
     "website": "company website URL or null",
     "industry": "retail, food_service, hospitality, food_manufacturing, or null"
   }

5. "commitment" (object or null): Extracted commitment details
   {
     "commitment_type": one of ["cage_free_eggs", "better_chicken_commitment",
       "gestation_crate_free", "broiler_welfare", "aquatic_welfare",
       "slaughter_standards", "deforestation_free", "other"],
     "commitment_text": "the actual pledge or a faithful summary",
     "announced_date": "YYYY-MM-DD or null",
     "deadline_date": "YYYY-MM-DD or null",
     "current_status": one of ["compliant", "partial", "non_compliant", "unknown"],
     "species": one of ["chicken-layers", "chicken-broilers", "pigs", "cattle",
       "dairy-cows", "fish", "turkey", "multiple", "other"] or null,
     "scope": one of ["global", "US-only", "EU-only", "multi-region"] or null,
     "progress_pct": integer 0-100 or null (if a specific percentage is mentioned)
   }

6. "evidence" (object): Evidence metadata for this source
   {
     "source_type": one of ["report", "news", "company_statement"],
     "summary": "1-2 sentence summary of what this source proves or claims"
   }

7. "campaign" (object or null): If this describes a campaign or action
   {
     "summary": "2-3 sentence description of the campaign action",
     "tactic": one of ["protest", "report", "petition", "legal", "shareholder", "media", "other"],
     "cta": "call to action for supporters",
     "score": {
       "value": integer 1-5 (1=low urgency, 5=critical),
       "rationale": "why this score"
     }
   }

8. "decision_makers" (array or empty): Key people mentioned
   [{"name": "string", "role": "string", "contact_url": "string or null"}]

Rules:
- If the article is not about a specific company commitment, set "company" and "commitment" to null.
- Extract dates in YYYY-MM-DD format when possible.
- The "commitment_text" should be the most specific statement you can find.
- For "evidence.summary", write what the article proves, not what the article is about.
- Respond with valid JSON only. No markdown fences, no commentary."""


def build_user_prompt(
    title: str,
    content: Optional[str],
    feed_title: Optional[str],
    categories: List[str],
    full_article_text: Optional[str] = None,
) -> str:
    parts = [f"Title: {title}"]
    if feed_title:
        parts.append(f"Source Feed: {feed_title}")
    if categories:
        parts.append(f"Tags: {', '.join(categories)}")
    if full_article_text:
        parts.append(f"\nFull Article Text:\n{full_article_text[:MAX_ARTICLE_LENGTH]}")
    elif content:
        parts.append(f"\nSnippet (truncated, full page unavailable):\n{content[:3000]}")
    return "\n".join(parts)


def evaluate_relevance(
    title: str,
    content: Optional[str] = None,
    feed_title: Optional[str] = None,
    categories: Optional[List[str]] = None,
    full_article_text: Optional[str] = None,
) -> dict:
    if not OPENROUTER_API_KEY:
        logger.warning("No OPENROUTER_API_KEY — returning fallback result")
        return _fallback_result()

    user_prompt = build_user_prompt(title, content, feed_title, categories or [], full_article_text)

    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": LLM_MODEL,
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                "max_tokens": 1024,
            },
            timeout=30,
        )
        response.raise_for_status()
        raw_text = response.json()["choices"][0]["message"]["content"].strip()
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1]
        if raw_text.endswith("```"):
            raw_text = raw_text[:raw_text.rfind("```")]
        return _validate_result(json.loads(raw_text))
    except (json.JSONDecodeError, KeyError, IndexError) as exc:
        logger.error(f"LLM evaluation failed: {exc}")
        return _fallback_result()
    except Exception as exc:
        logger.error(f"LLM API error: {exc}")
        return _fallback_result()


def _validate_result(result: dict) -> dict:
    return {
        "relevance": int(result.get("relevance", 0)),
        "is_new": bool(result.get("is_new", False)),
        "alert_priority": result.get("alert_priority", "none"),
        "company": result.get("company"),
        "commitment": result.get("commitment"),
        "evidence": result.get("evidence") or {},
        "campaign": result.get("campaign"),
        "decision_makers": result.get("decision_makers") or [],
    }


def _fallback_result() -> dict:
    return {
        "relevance": 0,
        "is_new": False,
        "alert_priority": "none",
        "company": None,
        "commitment": None,
        "evidence": {},
        "campaign": None,
        "decision_makers": [],
    }


# --- Storage ---

def _load_results() -> list:
    if RESULTS_FILE.exists():
        return json.loads(RESULTS_FILE.read_text())
    return []


def _store_to_supabase(supabase, result: dict, source_url: str) -> None:
    try:
        cd = result.get("company")
        cm = result.get("commitment")
        if not cd or not cm:
            logger.info("No company/commitment extracted - skipping write")
            return
        # Upsert company
        ex = supabase.table("companies").select("id").eq("name", cd["name"]).execute()
        company_id = ex.data[0]["id"] if ex.data else \
            supabase.table("companies").insert({
                "name": cd.get("name"), "website": cd.get("website"), "industry": cd.get("industry"),
            }).execute().data[0]["id"]
        # Insert commitment
        commitment_id = supabase.table("commitments").insert({
            "company_id": company_id,
            "commitment_type": cm.get("commitment_type", "other"),
            "commitment_text": cm.get("commitment_text"),
            "announced_date": cm.get("announced_date"),
            "deadline_date": cm.get("deadline_date"),
            "current_status": cm.get("current_status", "unknown"),
            "public_statement_url": source_url,
        }).execute().data[0]["id"]
        # Anchor deadline event
        if cm.get("deadline_date"):
            supabase.table("compliance_events").insert({
                "commitment_id": commitment_id, "event_type": "deadline",
                "event_date": cm["deadline_date"],
                "status": cm.get("current_status", "unknown"),
            }).execute()
        # Evidence
        ev = result.get("evidence", {})
        if ev:
            supabase.table("evidence").insert({
                "commitment_id": commitment_id, "source_url": source_url,
                "source_type": ev.get("source_type", "news"), "summary": ev.get("summary"),
            }).execute()
        # Decision makers
        for dm in result.get("decision_makers", []):
            supabase.table("decision_makers").insert({
                "company_id": company_id, "name": dm.get("name"),
                "role": dm.get("role"), "contact_url": dm.get("contact_url"),
            }).execute()
        logger.info(f"Stored to Supabase: {cd['name']}, commitment={commitment_id}")
    except Exception as e:
        logger.error(f"Supabase write failed: {e}")


def _save_result(entry: dict) -> None:
    supabase = _get_supabase()
    if supabase:
        _store_to_supabase(supabase, entry, entry.get("link", ""))
    else:
        # Dev fallback - local JSON if Supabase not configured
        RESULTS_FILE.parent.mkdir(parents=True, exist_ok=True)
        results = _load_results()
        results.append(entry)
        RESULTS_FILE.write_text(json.dumps(results, indent=2, default=str))
        logger.info("Stored to local JSON (Supabase not configured)")

# --- Schemas ---

# Inoreader's actual webhook payload structure
class InoreaderItemSummary(BaseModel):
    content: Optional[str] = None
    direction: Optional[str] = None

class InoreaderItemCanonical(BaseModel):
    href: str

class InoreaderItemOrigin(BaseModel):
    title: Optional[str] = None
    streamId: Optional[str] = None

class InoreaderRuleInfo(BaseModel):
    name: Optional[str] = None
    matchesToday: Optional[int] = None
    matchesTotal: Optional[int] = None

class InoreaderItem(BaseModel):
    id: Optional[str] = None
    title: str = ""
    author: Optional[str] = None
    published: Optional[int] = None  # Unix timestamp
    summary: Optional[InoreaderItemSummary] = None
    canonical: List[InoreaderItemCanonical] = []
    alternate: List[dict] = []
    categories: List[str] = []
    origin: Optional[InoreaderItemOrigin] = None

class InoreaderWebhookPayload(BaseModel):
    rule: Optional[InoreaderRuleInfo] = None
    items: List[InoreaderItem] = []

# Simple payload for manual curl testing
class TestWebhookPayload(BaseModel):
    title: str
    link: str
    content: Optional[str] = None
    feed_title: Optional[str] = None
    categories: List[str] = []


# --- Shared Processing Logic ---

def _process_article(title: str, link: str, content: Optional[str], feed_title: Optional[str], categories: List[str]) -> dict:
    """Process a single article through the full pipeline: fetch -> LLM -> store."""
    # Step 1: Clean the webhook snippet (fallback if page fetch fails)
    clean_content = None
    if content:
        clean_content = re.sub(r"<[^>]+>", " ", content).strip()

    # Step 2: Fetch the full article text from the link
    full_article_text = None
    fetch_metadata = {}
    if link:
        full_article_text, fetch_metadata = fetch_article_text(link)
        if full_article_text:
            logger.info(
                f"Fetched {fetch_metadata.get('content_length', 0)} chars "
                f"from {link} via {fetch_metadata.get('extraction_method')}"
            )
        else:
            logger.warning(f"Page fetch failed for {link}: {fetch_metadata.get('error')}")

    # Step 3: LLM evaluation with full text (falls back to snippet)
    result = evaluate_relevance(
        title=title,
        content=clean_content,
        feed_title=feed_title,
        categories=categories,
        full_article_text=full_article_text,
    )

    # Step 4: Build response
    response = {
        "title": title,
        "link": link,
        "relevance": result["relevance"],
        "alert_priority": result["alert_priority"],
        "is_new": result["is_new"],
        "company": result.get("company"),
        "commitment": result.get("commitment"),
        "evidence": result.get("evidence"),
        "campaign": result.get("campaign"),
        "decision_makers": result.get("decision_makers"),
        "fetch_metadata": fetch_metadata,
        "stored": False,
    }

    # Store if relevant
    if result["relevance"] >= RELEVANCE_THRESHOLD and result["is_new"]:
        entry = {
            "title": title,
            "link": link,
            "feed_title": feed_title,
            "categories": categories,
            "received_at": datetime.now(timezone.utc).isoformat(),
            "fetch_metadata": fetch_metadata,
            **result,
        }
        _save_result(entry)
        response["stored"] = True
        company_name = result.get("company", {}).get("name", "N/A") if result.get("company") else "N/A"
        logger.info(
            f"RELEVANT [{result['relevance']}] {result['alert_priority'].upper()} "
            f"| {company_name}: {title}"
        )
    else:
        logger.info(f"SKIPPED  [{result['relevance']}]: {title}")

    return response


# --- Endpoints ---

@app.post("/webhook/inoreader")
async def receive_inoreader_webhook(
    payload: InoreaderWebhookPayload,
    x_webhook_secret: Optional[str] = Header(None),
):
    """Receive real Inoreader webhook (items array format)."""
    if INOREADER_WEBHOOK_SECRET and x_webhook_secret != INOREADER_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    if not payload.items:
        return {"results": [], "rule": payload.rule.name if payload.rule else None}

    rule_name = payload.rule.name if payload.rule else "unknown"
    logger.info(f"Inoreader webhook: rule='{rule_name}', items={len(payload.items)}")

    results = []
    for item in payload.items:
        # Extract fields from Inoreader's format
        link = item.canonical[0].href if item.canonical else (
            item.alternate[0].get("href", "") if item.alternate else ""
        )
        content = item.summary.content if item.summary else None
        feed_title = item.origin.title if item.origin else None
        categories = [c for c in item.categories if not c.startswith("user/")]

        result = _process_article(
            title=item.title,
            link=link,
            content=content,
            feed_title=feed_title,
            categories=categories,
        )
        results.append(result)

    return {"results": results, "rule": rule_name}


@app.post("/webhook/test")
async def receive_test_webhook(
    payload: TestWebhookPayload,
    x_webhook_secret: Optional[str] = Header(None),
):
    """Simple test endpoint for manual curl testing."""
    if INOREADER_WEBHOOK_SECRET and x_webhook_secret != INOREADER_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    return _process_article(
        title=payload.title,
        link=payload.link,
        content=payload.content,
        feed_title=payload.feed_title,
        categories=payload.categories,
    )


@app.get("/results")
async def get_results():
    results = _load_results()
    return {
        "total": len(results),
        "articles": results,
    }
