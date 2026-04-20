# Florida Leads Agent — Design Spec

**Date:** 2026-04-20
**Status:** Approved

## Purpose

A standalone, on-demand Python agent that finds local Florida businesses with no website and a 4.0+ star rating, then collects full contact information (phone, address, owner name, email) and exports everything to a dated CSV file.

Completely independent — no shared code, database, or config with lead-agent or agency OS.

## Target Businesses

- **Niches:** Landscaping, HVAC, Plumbers, Restaurants
- **Location:** Florida — 10 major cities: Miami, Orlando, Tampa, Jacksonville, Fort Lauderdale, St. Petersburg, Hialeah, Tallahassee, Cape Coral, Gainesville
- **Filters:** No website + Google rating ≥ 4.0

## Architecture

Four modules, one entry point:

| File | Responsibility |
|------|---------------|
| `main.py` | Entry point — orchestrates pipeline, prints progress, saves CSV |
| `scraper.py` | Google Places API — searches each niche × city, filters no-website + 4.0+ stars |
| `finder.py` | DuckDuckGo scraping — finds owner name and email per business via regex |
| `exporter.py` | Deduplicates by `place_id`, writes dated CSV |

## Data Flow

1. `scraper.py` runs 40 searches (4 niches × 10 cities), returning raw Places results.
2. Each result filtered: `website` field absent + `rating >= 4.0`.
3. `finder.py` fires one DuckDuckGo search per business: `"[name] [city] Florida owner email phone"`, scrapes HTML for emails (regex) and owner name (patterns: "Owner:", "Founder:", name near "owner of").
4. `exporter.py` merges all results, deduplicates by `place_id`, writes `florida_leads_YYYY-MM-DD.csv`.

**Estimated output:** 50–300 leads per run.

## CSV Schema

| Column | Source |
|--------|--------|
| `business_name` | Google Places |
| `category` | Niche searched (landscaping, HVAC, etc.) |
| `city` | City searched |
| `address` | Google Places |
| `phone` | Google Places |
| `rating` | Google Places |
| `review_count` | Google Places |
| `email` | DuckDuckGo scrape (blank if not found) |
| `owner_name` | DuckDuckGo scrape (blank if not found) |

## Error Handling

- **Google Places rate limit:** 1 req/sec sleep between calls.
- **DuckDuckGo failures:** Skip business silently, log to console — run continues.
- **Missing email/owner:** Fields left blank — lead still included (phone + address are valuable).
- **Partial run:** CSV saved on completion with whatever was collected — no crash on mid-run DuckDuckGo block.

## Configuration

- `.env` file in agent directory: `GOOGLE_PLACES_API_KEY=...`
- No other secrets required.
- No database, no cron, no email sending.

## Running

```bash
cd /home/marnu/florida-leads-agent
python main.py
# Outputs: florida_leads_2026-04-20.csv
```
