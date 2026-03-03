#!/usr/bin/env python3
"""
Test runner for the At What Cost scraping pipeline.

No Docker, no PostgreSQL, no Inoreader required. Imports directly from
webhook_listener.py so there is zero code duplication.

Usage:
    # Test page fetching only (free, no API key needed)
    python scraping/rss/test_pipeline.py --fetch-only URL

    # Full pipeline test (needs ANTHROPIC_API_KEY in .env)
    python scraping/rss/test_pipeline.py URL1 URL2

    # Batch from file (one URL per line)
    python scraping/rss/test_pipeline.py --file urls.txt

    # Save JSON output
    python scraping/rss/test_pipeline.py --output results.json URL

    # Verbose mode — print extracted article text preview
    python scraping/rss/test_pipeline.py --fetch-only --verbose URL
"""

from __future__ import annotations

import argparse
import json
import sys
import textwrap
from pathlib import Path

# Ensure the repo root is on sys.path so imports work when run as a script
REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from scraping.rss.webhook_listener import fetch_article_text, evaluate_relevance  # noqa: E402


# ── Colours (ANSI) ──────────────────────────────────────────────────────

class C:
    """ANSI colour helpers — degrade gracefully in dumb terminals."""
    BOLD  = "\033[1m"
    DIM   = "\033[2m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED   = "\033[91m"
    CYAN  = "\033[96m"
    MAGENTA = "\033[95m"
    RESET = "\033[0m"


def _label(label: str, value, colour: str = "") -> str:
    return f"  {C.DIM}{label}:{C.RESET} {colour}{value}{C.RESET}"


# ── Pretty Printers ─────────────────────────────────────────────────────

def print_fetch_result(url: str, text: str | None, meta: dict, verbose: bool = False) -> None:
    print(f"\n{C.BOLD}{'─' * 70}{C.RESET}")
    print(f"{C.BOLD}URL:{C.RESET} {url}")

    if text:
        print(_label("Status", f"{meta.get('status_code', '?')} OK", C.GREEN))
        print(_label("Method", meta.get("extraction_method", "?")))
        print(_label("Length", f"{meta.get('content_length', 0):,} chars"))
        if meta.get("truncated"):
            print(_label("Truncated", "Yes (8000 char limit)", C.YELLOW))
        if verbose:
            preview = textwrap.shorten(text, width=500, placeholder=" [...]")
            print(f"\n  {C.DIM}── Article Preview ──{C.RESET}")
            for line in textwrap.wrap(preview, width=68):
                print(f"  {line}")
    else:
        error_msg = meta.get("error") or "Unknown error"
        print(_label("Fetch Failed", error_msg, C.RED))
        if "JavaScript" in error_msg:
            print(f"  {C.DIM}Tip: This site is a JS SPA. The spider approach (Playwright) can handle it.{C.RESET}")


def _priority_colour(priority: str) -> str:
    return {
        "critical": C.RED,
        "high": C.MAGENTA,
        "medium": C.YELLOW,
        "low": C.DIM,
        "none": C.DIM,
    }.get(priority, "")


def print_llm_result(url: str, result: dict) -> None:
    relevance = result.get("relevance", 0)
    priority = result.get("alert_priority", "none")
    pc = _priority_colour(priority)

    rel_colour = C.GREEN if relevance >= 80 else C.YELLOW if relevance >= 50 else C.RED
    print(f"\n  {C.BOLD}── LLM Analysis ──{C.RESET}")
    print(_label("Relevance", f"{relevance}/100", rel_colour))
    print(_label("Priority", priority.upper(), pc))
    print(_label("Is New", result.get("is_new", False)))

    # Company
    company = result.get("company")
    if company:
        print(f"\n  {C.CYAN}Company:{C.RESET}")
        print(_label("  Name", company.get("name", "?")))
        if company.get("website"):
            print(_label("  Website", company["website"]))
        if company.get("industry"):
            print(_label("  Industry", company["industry"]))

    # Commitment
    commitment = result.get("commitment")
    if commitment:
        print(f"\n  {C.CYAN}Commitment:{C.RESET}")
        print(_label("  Type", commitment.get("commitment_type", "?")))
        text_val = commitment.get("commitment_text", "")
        if text_val:
            short = textwrap.shorten(text_val, width=80, placeholder="...")
            print(_label("  Text", short))
        if commitment.get("announced_date"):
            print(_label("  Announced", commitment["announced_date"]))
        if commitment.get("deadline_date"):
            print(_label("  Deadline", commitment["deadline_date"]))
        if commitment.get("current_status"):
            print(_label("  Status", commitment["current_status"]))
        if commitment.get("species"):
            print(_label("  Species", commitment["species"]))
        if commitment.get("scope"):
            print(_label("  Scope", commitment["scope"]))
        if commitment.get("progress_pct") is not None:
            print(_label("  Progress", f"{commitment['progress_pct']}%"))

    # Evidence
    evidence = result.get("evidence")
    if evidence and evidence.get("summary"):
        print(f"\n  {C.CYAN}Evidence:{C.RESET}")
        print(_label("  Source Type", evidence.get("source_type", "?")))
        print(_label("  Summary", textwrap.shorten(evidence["summary"], width=80, placeholder="...")))

    # Campaign
    campaign = result.get("campaign")
    if campaign:
        print(f"\n  {C.CYAN}Campaign:{C.RESET}")
        if campaign.get("summary"):
            print(_label("  Summary", textwrap.shorten(campaign["summary"], width=80, placeholder="...")))
        if campaign.get("tactic"):
            print(_label("  Tactic", campaign["tactic"]))
        if campaign.get("cta"):
            print(_label("  CTA", textwrap.shorten(campaign["cta"], width=80, placeholder="...")))
        score = campaign.get("score")
        if score:
            print(_label("  Score", f"{score.get('value', '?')}/5 — {score.get('rationale', '')}"))

    # Decision Makers
    dms = result.get("decision_makers", [])
    if dms:
        print(f"\n  {C.CYAN}Decision Makers:{C.RESET}")
        for dm in dms:
            parts = [dm.get("name", "?")]
            if dm.get("role"):
                parts.append(f"({dm['role']})")
            if dm.get("contact_url"):
                parts.append(f"— {dm['contact_url']}")
            print(f"    • {' '.join(parts)}")


# ── Main Logic ───────────────────────────────────────────────────────────

def process_url(url: str, fetch_only: bool = False, verbose: bool = False) -> dict:
    """Process a single URL through the pipeline. Returns result dict."""
    # Step 1: Fetch full page
    article_text, fetch_meta = fetch_article_text(url)
    print_fetch_result(url, article_text, fetch_meta, verbose=verbose)

    result_entry = {
        "url": url,
        "fetch_metadata": fetch_meta,
        "article_text_length": len(article_text) if article_text else 0,
        "fetch_success": article_text is not None,
    }

    if fetch_only:
        return result_entry

    # Step 2: LLM structured extraction
    # Extract a title from the URL (best-effort)
    title_guess = url.rstrip("/").split("/")[-1].replace("-", " ").title()

    llm_result = evaluate_relevance(
        title=title_guess,
        full_article_text=article_text,
    )

    print_llm_result(url, llm_result)
    result_entry["llm_result"] = llm_result
    return result_entry


def main():
    parser = argparse.ArgumentParser(
        description="Test the At What Cost scraping pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=textwrap.dedent("""\
            Examples:
              # Free test (no API key needed)
              python scraping/rss/test_pipeline.py --fetch-only --verbose \\
                https://thehumaneleague.org/article/choice-hotels-protest

              # Full pipeline (needs ANTHROPIC_API_KEY in .env)
              python scraping/rss/test_pipeline.py \\
                https://thehumaneleague.org/article/subway-100-cage-free

              # Batch from file
              python scraping/rss/test_pipeline.py --file urls.txt --output results.json
        """),
    )
    parser.add_argument("urls", nargs="*", help="URLs to process")
    parser.add_argument("--fetch-only", action="store_true", help="Only test page fetching (no LLM, free)")
    parser.add_argument("--verbose", "-v", action="store_true", help="Print extracted article text preview")
    parser.add_argument("--file", "-f", type=str, help="Read URLs from a text file (one per line)")
    parser.add_argument("--output", "-o", type=str, help="Save JSON results to file")

    args = parser.parse_args()

    # Collect URLs
    urls: list[str] = list(args.urls)
    if args.file:
        file_path = Path(args.file)
        if not file_path.exists():
            print(f"{C.RED}Error: File not found: {args.file}{C.RESET}", file=sys.stderr)
            sys.exit(1)
        for line in file_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                urls.append(line)

    if not urls:
        parser.print_help()
        print(f"\n{C.YELLOW}No URLs provided. Pass URLs as arguments or use --file.{C.RESET}")
        sys.exit(1)

    # Header
    mode = "FETCH-ONLY" if args.fetch_only else "FULL PIPELINE"
    print(f"\n{C.BOLD}{'═' * 70}{C.RESET}")
    print(f"{C.BOLD}  At What Cost — Pipeline Test ({mode}){C.RESET}")
    print(f"{C.BOLD}  {len(urls)} URL(s) to process{C.RESET}")
    print(f"{C.BOLD}{'═' * 70}{C.RESET}")

    # Process
    results = []
    for url in urls:
        entry = process_url(url, fetch_only=args.fetch_only, verbose=args.verbose)
        results.append(entry)

    # Summary
    fetch_ok = sum(1 for r in results if r.get("fetch_success"))
    fetch_fail = len(results) - fetch_ok

    print(f"\n{C.BOLD}{'═' * 70}{C.RESET}")
    print(f"{C.BOLD}  Summary{C.RESET}")
    print(f"  URLs processed:   {len(results)}")
    print(f"  Fetch succeeded:  {C.GREEN}{fetch_ok}{C.RESET}")
    if fetch_fail:
        print(f"  Fetch failed:     {C.RED}{fetch_fail}{C.RESET}")

    if not args.fetch_only:
        relevant = sum(
            1 for r in results
            if r.get("llm_result", {}).get("relevance", 0) >= 50
        )
        print(f"  Relevant (≥50):   {C.CYAN}{relevant}{C.RESET}")
        high_priority = sum(
            1 for r in results
            if r.get("llm_result", {}).get("alert_priority") in ("critical", "high")
        )
        if high_priority:
            print(f"  High/Critical:    {C.MAGENTA}{high_priority}{C.RESET}")

    print(f"{C.BOLD}{'═' * 70}{C.RESET}")

    # Save JSON output
    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(results, indent=2, default=str))
        print(f"\n{C.GREEN}Results saved to {args.output}{C.RESET}")


if __name__ == "__main__":
    main()
