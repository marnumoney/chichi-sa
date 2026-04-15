# Launchpad Studio — Agency OS Design

**Date:** 2026-04-15  
**Status:** Approved  
**Goal:** A fully automated agency operating system where a self-learning CEO agent orchestrates 11 department agents to run Launchpad Studio and generate revenue.

---

## Overview

A single `agency/` project replaces and absorbs the existing `lead-agent` and `blog-agent`. A CEO agent runs daily, reads its accumulated strategy memory, decides what each department should focus on, executes all department agents, measures outcomes against predictions, and rewrites its own strategy document to get smarter every day.

---

## Directory Structure

```
agency/
├── ceo.py                        # CEO orchestrator
├── config.yaml                   # Agency-wide non-secret config
├── .env                          # All secrets (gitignored)
├── requirements.txt
├── shared/
│   ├── base_agent.py             # BaseAgent class
│   ├── db.py                     # Central DB access
│   ├── mailer.py                 # Shared email (Gmail SMTP + Microsoft Graph)
│   └── notifier.py               # Shared ntfy with retry
├── departments/
│   ├── sales/
│   │   ├── agent.py              # SalesAgent(BaseAgent)
│   │   ├── prompts.py
│   │   └── tools.py              # Scraping, email finding, outreach
│   ├── account_mgmt/
│   │   ├── agent.py
│   │   ├── prompts.py
│   │   └── tools.py
│   ├── project_mgmt/
│   │   ├── agent.py
│   │   ├── prompts.py
│   │   └── tools.py
│   ├── design/
│   │   ├── agent.py
│   │   ├── prompts.py
│   │   └── tools.py
│   ├── development/
│   │   ├── agent.py
│   │   ├── prompts.py
│   │   └── tools.py
│   ├── content/
│   │   ├── agent.py              # Absorbs blog-agent
│   │   ├── prompts.py
│   │   └── tools.py
│   ├── marketing/
│   │   ├── agent.py
│   │   ├── prompts.py
│   │   └── tools.py
│   ├── strategy/
│   │   ├── agent.py
│   │   ├── prompts.py
│   │   └── tools.py
│   ├── finance/
│   │   ├── agent.py
│   │   ├── prompts.py
│   │   └── tools.py
│   ├── hr/
│   │   ├── agent.py
│   │   ├── prompts.py
│   │   └── tools.py
│   └── qa/
│       ├── agent.py
│       ├── prompts.py
│       └── tools.py
├── memory/
│   ├── strategy.md               # Living strategy doc — CEO rewrites daily
│   └── journal/                  # YYYY-MM-DD.md retrospectives
├── outputs/                      # YYYY-MM-DD/<dept>/ — daily deliverables
│   └── .gitkeep
├── data/
│   └── agency.db                 # Central SQLite database
└── logs/
    ├── agency.log
    └── health.log
```

---

## CEO Agent — Self-Learning Loop

The CEO runs daily at **06:00 SAST (04:00 UTC)** in four phases:

### Phase 1: Read & Remember
- Load `memory/strategy.md` — the CEO's accumulated intelligence
- Load the last 7 journal entries from `memory/journal/`
- Read key business metrics from `agency.db`:
  - Lead pipeline: total leads, reply rate (7-day), conversion rate
  - Revenue: total invoiced, paid, outstanding
  - Active clients and projects
  - Department output counts from the last 7 days

### Phase 2: Decide
Claude reasons over strategy + metrics and produces a `DailyDirective` — a structured JSON object with a priority and specific instruction per department:

```json
{
  "date": "YYYY-MM-DD",
  "business_context": "Brief CEO assessment of current state",
  "departments": {
    "sales": {
      "priority": "high|medium|low|skip",
      "instruction": "Specific directive for today"
    },
    ...
  }
}
```

Priority determines execution order: `high` departments run first. `skip` departments are not called today.

### Phase 3: Execute
The CEO calls each department's `run(directive)` in priority order (high → medium → low). Each call returns a `DepartmentReport`:

```python
@dataclass
class DepartmentReport:
    dept: str
    status: str          # "success" | "partial" | "failed" | "skipped"
    actions_taken: list[str]
    files_created: list[str]
    emails_sent: int
    metrics: dict        # dept-specific numbers
    error: str | None
```

### Phase 4: Reflect & Learn
After all departments complete, Claude performs a retrospective:

1. Compares `DailyDirective` (what was planned) against `DepartmentReport` results (what happened)
2. Evaluates business metric movement vs predictions
3. Writes a dated journal entry to `memory/journal/YYYY-MM-DD.md`:
   - What worked
   - What underperformed
   - Surprises or anomalies
   - Hypotheses for tomorrow
4. **Rewrites `memory/strategy.md`** from scratch using all journal evidence — not an append. The strategy doc is the CEO's distilled, evolving intelligence.
5. Stores the directive + outcomes JSON in `ceo_directives` table for long-term tracking
6. Sends a CEO briefing via ntfy (high priority) and email to `main.launchpadstudio@outlook.com`

---

## BaseAgent Interface

All 11 department agents extend `BaseAgent`:

```python
class BaseAgent:
    def __init__(self, config: dict, db: sqlite3.Connection, mailer, notifier)
    def run(self, directive: Directive) -> DepartmentReport
    def _get_context(self) -> dict       # reads dept-relevant DB data
    def _execute(self, directive) -> list[Action]  # core department logic
    def _report(self, actions: list[Action]) -> DepartmentReport
```

---

## Department Agents

### Sales (refactored lead-agent)
- **Daily job:** Scrape Google Places for new leads, qualify them, find emails via web search, send personalised outreach, process day-3 and day-7 follow-ups
- **Outputs:** Emails sent to prospects
- **Key metrics:** `leads_scraped`, `emails_found`, `emails_sent`, `reply_rate_7d`
- **CEO can instruct:** change city/industry focus, adjust email tone, increase/decrease volume

### Account Management
- **Daily job:** Scan `clients` table for clients due a check-in (no contact in 30+ days), draft and send personalised relationship emails
- **Outputs:** Check-in emails sent
- **Key metrics:** `clients_contacted`, `renewals_due`, `clients_at_risk`
- **CEO can instruct:** prioritise specific clients, trigger renewal conversations

### Project Management
- **Daily job:** Scan `projects` and `tasks` for overdue or at-risk items, generate a status report, email it to Marnu
- **Outputs:** Status report `.md` file, email alert if projects are overdue
- **Key metrics:** `projects_active`, `tasks_overdue`, `projects_on_track`

### Design
- **Daily job:** For any new project in the DB without a design brief, generate a structured design brief using Claude
- **Outputs:** Design brief `.md` files in `outputs/YYYY-MM-DD/design/`
- **Key metrics:** `briefs_generated`

### Development
- **Daily job:** For any new project without a tech spec, generate a technical specification document
- **Outputs:** Tech spec `.md` files
- **Key metrics:** `specs_generated`

### Content (refactored blog-agent)
- **Daily job:** Research a relevant topic for Launchpad Studio's target market (SA small businesses), write a blog post, notify via ntfy
- **Outputs:** Blog post `.md` file
- **Key metrics:** `posts_written`
- **CEO can instruct:** focus topic area, increase/decrease frequency

### Marketing
- **Daily job:** Draft a case study from a recently completed project, or write agency promotional content (LinkedIn post, email newsletter snippet)
- **Outputs:** Marketing content `.md` files
- **Key metrics:** `assets_created`

### Strategy/Discovery
- **Daily job:** Run a competitive analysis scan (search web for competitor pricing/positioning), generate a brief insight report
- **Outputs:** Strategy report `.md` file
- **Key metrics:** `reports_generated`

### Finance/Admin
- **Daily job:** Scan for completed projects without an invoice, generate invoice documents; flag overdue payments
- **Outputs:** Invoice `.md` files, overdue payment alerts
- **Key metrics:** `invoices_generated`, `payments_overdue`, `revenue_outstanding`

### HR
- **Daily job:** If the CEO directive flags a hiring need, draft a job post; otherwise generate onboarding documentation for new hires
- **Outputs:** HR docs `.md` files
- **Key metrics:** `docs_generated`

### QA/Testing
- **Daily job:** For active projects nearing completion, generate a QA checklist covering browser testing, accessibility, and performance
- **Outputs:** QA checklist `.md` files
- **Key metrics:** `checklists_generated`

---

## Central Database Schema (agency.db)

```sql
-- Existing (migrated from lead-agent)
leads      (id, business_name, city, industry, phone, email, rating, reviews, scraped_at, contacted, website)
emails     (id, lead_id, sent_at, status, subject, body, outlook_message_id, follow_up_number)
replies    (id, lead_id, from_email, subject, body, received_at, handled)

-- New
clients    (id, name, email, phone, status, joined_at, revenue_total, last_contact_at, notes)
projects   (id, client_id, name, status, budget, deadline, dept, description, created_at)
tasks      (id, project_id, dept, description, status, due_date, created_at, completed_at)
invoices   (id, client_id, project_id, amount, status, issued_at, due_date, paid_at, notes)
ceo_directives (id, date, directive_json, outcomes_json, strategy_version, created_at)
```

---

## Output Files

All department deliverables land in `agency/outputs/YYYY-MM-DD/<dept>/`. Files are committed to git at end of each CEO run, creating a full audit trail of everything the agency produced.

---

## Cron Schedule

| UTC Time | SAST | Job |
|----------|------|-----|
| `0 4 * * *` | 06:00 | CEO full daily run |
| `0 6 * * *` | 08:00 | Sales standalone (outreach volume) |
| `0 5,7,9,11,13,15,17,19 * * *` | Even hours | Reply checker |
| `0 3 * * *` | 05:00 | Daily report |
| `0 5 * * *` | 07:00 | Health check |

---

## Secrets (.env)

All secrets shared across departments via a single `agency/.env`:
- `ANTHROPIC_API_KEY`
- `GOOGLE_PLACES_API_KEY`
- `GMAIL_SENDER_EMAIL`, `GMAIL_APP_PASSWORD`
- `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID`, `MICROSOFT_SENDER_EMAIL`
- `SMTP_PASSWORD`

---

## Error Handling

- Each department agent catches its own exceptions and returns `status: "failed"` — the CEO run never crashes due to one department failing
- The CEO logs all department failures and includes them in the briefing
- If the CEO's own Claude call fails, it falls back to last run's directive (stored in DB)
- ntfy notifications use existing 3-attempt retry logic

---

## CEO Day-1 Bootstrap

On first run, `memory/strategy.md` is seeded with a starter strategy covering known context: Launchpad Studio is a web agency targeting SA small businesses, starter sites from $200, current focus is converting leads to first paying client. The CEO evolves this from day 1 forward.

---

## Migration

1. `agency/data/agency.db` — migrate existing `leads`, `emails`, `replies` tables from `lead-agent/leads.db`
2. `agency/departments/sales/` — refactor `lead-agent` code into `SalesAgent(BaseAgent)`
3. `agency/departments/content/` — refactor `blog-agent` code into `ContentAgent(BaseAgent)`
4. Update crontab: add CEO at `0 4 * * *`, remove old `lead-agent` and `blog-agent` entries
5. Retire `lead-agent/`, `blog-agent/`, `daily_report.py` — CEO briefing (Phase 4) replaces the daily report
6. Remove health check and daily report cron entries — replace with a single `agency/health_check.py`
