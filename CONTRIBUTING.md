# Contributing to At What Cost

> Read CONTEXT.md first. It has all architecture decisions, stack choices, and build status.

---


## Project Vision
We're building an app that makes corporate accountability as easy as ordering takeout.

## Design Principles
- **Action-first**: Every feature should drive user action
- **Honest metrics**: No vanity metrics or false impact claims
- **Non-preachy**: Appeal to non-vegans through corporate accountability angle
- **Mobile-first**: Optimized for quick actions on mobile

---

## Stack Decisions (Locked)

| Decision | Choice | Why |
|----------|--------|-----|
| Database + Auth | Supabase | RLS for org/public data tiers, built-in auth, encryption |
| Article fetching | Jina AI Reader | Handles JS-rendered pages; same key used by Open Paws |
| Ingestion filter | Inoreader keyword rules then Claude Haiku relevance score | Free gate before any API spend |
| OSINT | Open Paws API via n8n | CourtListener + LegiScan + DocumentCloud + Serper in one workflow |
| Orchestration | n8n | Schedules, triggers, API calls. Python handles logic. |
| Frontend | React + Vite web first | React Native post-MVP |

---

## How to Contribute
1. Check existing issues or create a new one
2. Fork the repo
3. Create a feature branch
4. Submit a PR with clear description

## Questions?
[Contact info]