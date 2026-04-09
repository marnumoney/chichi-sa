# Lead Generation Agent — Design Spec
**Date:** 2026-04-09  
**Project:** Web Design Agency Lead Agent  
**Status:** Approved

---

## Overview

A Python-based AI agent that runs daily, finds new local South African businesses with no website but strong Google ratings, generates personalized cold emails using Claude AI, and sends them via Microsoft Outlook. All leads and email history are tracked in a SQLite database.

---

## Goals

- Find 100+ qualified leads per day across South Africa
- Send exactly 100 personalized cold emails per day via Outlook
- Never contact the same business twice
- Track all leads and email outcomes in a local database
- Run fully automated on a daily cron schedule

---

## Qualification Criteria

A business qualifies as a lead if it meets ALL of the following:
1. Located in South Africa
2. Has no website listed on Google
3. Google rating ≥ 4.0 (configurable)
4. Review count ≥ 10 (configurable — signals established reputation)
5. Not already in the database (deduplicated by Google `place_id`)

---

## Architecture

Four core modules run in sequence, orchestrated by `main.py`:

```
[Cron @ 8:00 AM daily]
  → scraper.py       — Google Places API: discover SA businesses
  → qualifier.py     — Filter: no website, rating, reviews, dedup
  → composer.py      — Claude API: write personalized cold email
  → mailer.py        — Microsoft Graph API: send via Outlook (max 100/day)
  → db.py            — SQLite: persist leads and email history
```

---

## Data Model (SQLite)

### `leads` table
Stores only qualified businesses (no website, high rating). Businesses with a website are never inserted.

| Column | Type | Description |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| place_id | TEXT UNIQUE | Google Places unique ID (dedup key) |
| business_name | TEXT | Business name |
| industry | TEXT | e.g. restaurant, plumber |
| city | TEXT | SA city |
| phone | TEXT | Phone number if available |
| email | TEXT | Email if available |
| rating | REAL | Google rating |
| review_count | INTEGER | Number of Google reviews |
| found_date | DATE | Date first discovered |

### `emails` table
One row per email send attempt.

| Column | Type | Description |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| lead_id | INTEGER FK | References leads.id |
| sent_at | DATETIME | Timestamp of send |
| status | TEXT | sent / failed / bounced |
| subject | TEXT | Email subject |
| body | TEXT | Full email body |
| outlook_message_id | TEXT | Graph API message ID for tracking |

---

## Scraper

**API:** Google Places API — Text Search + Place Details

**Search strategy:** Iterate over a configurable list of industries combined with major SA cities to form queries like `"plumber in Durban"`. Cities covered include Johannesburg, Cape Town, Durban, Pretoria, Port Elizabeth, Bloemfontein, East London, Polokwane, Nelspruit, and Kimberley.

**Qualification check order:**
1. No `website` field in Place Details response → discard if website exists
2. Rating ≥ threshold → discard if below
3. Review count ≥ threshold → discard if below
4. `place_id` not in DB → skip if already known

**Rate limiting:** Configurable delay between requests. Daily quota cap respected. All raw API responses logged for debugging.

---

## Email Composer

**API:** Anthropic Claude API

**Inputs per email:**
- Business name, industry, city
- Google rating and review count
- Agency brief from `config.yaml` (agency name, tone, services, CTA)

**Email content (AI-generated):**
- Opens by acknowledging the business's strong reputation (references rating/reviews)
- Points out the missed opportunity of having no website
- Introduces the agency as the solution
- Closes with a clear call to action (e.g. "Reply to this email to book a free consultation")

The agency brief in `config.yaml` keeps every email on-brand while each email is uniquely personalized to the recipient business.

---

## Mailer

**API:** Microsoft Graph API (OAuth2 with refresh token — no SMTP)

**Daily send cap:** Exactly 100 emails per day, hard-coded.
- If fewer than 100 qualified leads are available, sends what's available.
- If more than 100 are available, the remainder are queued (left in DB with no `emails` record) and eligible for the next day's run.

After each send, the `outlook_message_id` is written back to the `emails` table for tracking.

---

## Scheduling

System cron job — runs at 8:00 AM daily:

```cron
0 8 * * * /path/to/venv/bin/python /path/to/lead-agent/main.py
```

---

## Project Structure

```
lead-agent/
├── main.py              — orchestrates the full pipeline
├── scraper.py           — Google Places API calls
├── qualifier.py         — filtering & deduplication logic
├── composer.py          — Claude API email generation
├── mailer.py            — Microsoft Graph API sending
├── db.py                — SQLite setup & all queries
├── config.yaml          — API keys, agency brief, search params
├── requirements.txt     — Python dependencies
└── logs/
    └── agent.log        — daily run logs
```

---

## Configuration (`config.yaml`)

```yaml
google_places:
  api_key: "YOUR_KEY"
  min_rating: 4.0
  min_reviews: 10
  industries:
    - restaurant
    - hair salon
    - plumber
    - mechanic
    - electrician
    - cleaning service
    - gym
    - bakery

anthropic:
  api_key: "YOUR_KEY"

microsoft:
  client_id: "YOUR_CLIENT_ID"
  client_secret: "YOUR_CLIENT_SECRET"
  tenant_id: "YOUR_TENANT_ID"
  sender_email: "you@yourdomain.com"

agency:
  name: "Your Agency Name"
  tone: "friendly and professional"
  services: "affordable, modern websites for local businesses"
  cta: "Reply to this email to book a free consultation"

# daily_limit is hard-coded to 100 in mailer.py — not configurable
```

---

## Logging

Each daily run logs:
- Number of businesses scraped
- Number qualified (passed all filters)
- Number of emails sent
- Any API errors or failures

Logs written to `logs/agent.log` with timestamps.

---

## Dependencies

- `googlemaps` — Google Places API client
- `anthropic` — Claude API client
- `msal` — Microsoft Authentication Library for Graph API OAuth2
- `requests` — HTTP calls to Graph API
- `pyyaml` — config parsing
- `sqlite3` — built-in Python, no install needed
- `schedule` or system cron — task scheduling
