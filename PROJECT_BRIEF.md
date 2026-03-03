# Project Brief

> This file covers design system and screen structure. See [CONTEXT.md](CONTEXT.md) for full product and architecture context.

---

## Target Users

### Public / Individual
- 18-34 years old
- Urban, conscious consumers
- Care about corporate ethics but want quick, meaningful actions — not lectures
- Non-vegans welcome; corporate accountability angle is the entry point

### Organizations (authenticated)
- Animal advocacy orgs and campaigners
- Researchers and analysts
- Need deep, fast company intelligence — especially before or during meetings

---

## Key Screens
1. **Home**: Urgent actions, stats, spotlight
2. **Brands**: Search, filter, scores
3. **Act**: Available actions
4. **Give**: Donation options

## Four App Sections

| # | Section | MVP? |
|---|---------|------|
| 1 | **Home** | Yes |
| 2 | **Brands** | Yes |
| 3 | **Act** | Post-MVP |
| 4 | **Give** | Post-MVP |

### Home
- **Public**: Urgent actions, global stats, spotlight companies
- **Org**: Same layout, stats scoped to their saved companies and campaigns

### Brands
- **Public**: Full directory — search, filter, accountability scores. Click through to basic company profile.
- **Org**: Saved companies only — same cards, but company page includes the full org-only dossier panel

---


## Company Page Structure

### Public layer (everyone)
- Commitment status + history
- Accountability score
- Deadline tracking
- Evidence sources
- Public campaigns + CTA (or generated contact script if no campaign exists)

### Org panel (additive, auth-gated)
Populated automatically via Open Paws API when company is saved. Sections:
- Commitment & Compliance (ESG, AGM outcomes, progress in other markets)
- Company Structure (leadership, hierarchy, board, franchising)
- Signals & Triggers (news, financial reports, social media)
- People to Target (executives, brand ambassadors, decision-maker contacts)
- Legal & Legislative (court cases, legislation, OSINT report)
- Internal (org notes, tags, campaign linkage)

---


## Data Needs
- Company database with scores
- Action templates
- Response tracking
- User engagement metrics

```

## Data Needs

| Data | Tier | Source |
|------|------|--------|
| Commitments + compliance status | Public | Inoreader + Claude Haiku |
| Accountability scores | Public | Derived from commitment data |
| Basic company profiles | Public | Ingestion pipeline |
| OSINT dossiers | Org only | Open Paws API |
| Decision-maker contacts | Org only | Open Paws API |
| Org notes + saved companies | Org only | User-generated |# Project Brief



