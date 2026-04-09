# Lead Generation Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python agent that scrapes South African businesses from Google Places, filters for no-website/high-rating ones, generates AI-personalized cold emails with Claude, and sends exactly 100/day via Microsoft Outlook — with full SQLite tracking.

**Architecture:** A sequential pipeline (`scraper → qualifier → composer → mailer`) orchestrated by `main.py`, triggered daily at 8 AM via cron. Each module has a single responsibility and communicates through plain Python dicts. SQLite via `db.py` is the shared state layer.

**Tech Stack:** Python 3.11+, `googlemaps`, `anthropic`, `msal`, `requests`, `pyyaml`, `pytest`, `pytest-mock`, `sqlite3` (stdlib)

> **Important note on email addresses:** Google Places API does not reliably return email addresses for businesses. Leads without an email address will be stored in the DB but skipped by the mailer. This is expected — many leads will be phone-only. The daily send count will reflect only leads that had an email on Google.

---

## File Map

| File | Responsibility |
|---|---|
| `lead-agent/db.py` | SQLite init, all queries (insert/read leads & emails) |
| `lead-agent/scraper.py` | Google Places Text Search + Place Details calls |
| `lead-agent/qualifier.py` | Filter raw places: no website, rating, reviews, dedup |
| `lead-agent/composer.py` | Claude API: generate personalized email subject + body |
| `lead-agent/mailer.py` | Microsoft Graph API: OAuth2 token + send email |
| `lead-agent/main.py` | Pipeline orchestrator + logging setup |
| `lead-agent/config.yaml` | All configuration (API keys, agency brief, search params) |
| `lead-agent/requirements.txt` | Python dependencies |
| `lead-agent/logs/.gitkeep` | Ensure logs/ directory exists in git |
| `lead-agent/tests/test_db.py` | DB module tests (in-memory SQLite) |
| `lead-agent/tests/test_qualifier.py` | Qualifier filter logic tests |
| `lead-agent/tests/test_composer.py` | Composer prompt + output parsing tests |
| `lead-agent/tests/test_mailer.py` | Mailer token fetch + send tests |

---

## Task 1: Project Scaffold

**Files:**
- Create: `lead-agent/requirements.txt`
- Create: `lead-agent/config.yaml`
- Create: `lead-agent/logs/.gitkeep`
- Create: `lead-agent/tests/__init__.py`

- [ ] **Step 1: Create the project directory structure**

```bash
mkdir -p lead-agent/logs lead-agent/tests
touch lead-agent/logs/.gitkeep lead-agent/tests/__init__.py
```

- [ ] **Step 2: Write `requirements.txt`**

```
googlemaps==4.10.0
anthropic==0.28.0
msal==1.29.0
requests==2.32.3
pyyaml==6.0.2
pytest==8.2.2
pytest-mock==3.14.0
```

- [ ] **Step 3: Write `config.yaml`**

```yaml
google_places:
  api_key: "YOUR_GOOGLE_API_KEY"
  min_rating: 4.0
  min_reviews: 10
  request_delay_seconds: 0.5
  industries:
    - restaurant
    - hair salon
    - plumber
    - mechanic
    - electrician
    - cleaning service
    - gym
    - bakery
  cities:
    - Johannesburg
    - Cape Town
    - Durban
    - Pretoria
    - Port Elizabeth
    - Bloemfontein
    - East London
    - Polokwane
    - Nelspruit
    - Kimberley

anthropic:
  api_key: "YOUR_ANTHROPIC_API_KEY"
  model: "claude-opus-4-6"

microsoft:
  client_id: "YOUR_CLIENT_ID"
  client_secret: "YOUR_CLIENT_SECRET"
  tenant_id: "YOUR_TENANT_ID"
  sender_email: "hello.launchpadstudio@outlook.com"

agency:
  name: "Launchpad Studio"
  website: "https://launchpadstudio.shop"
  tone: "friendly and professional"
  services: "affordable, modern websites for local businesses"
  cta: "Reply to this email to book a free consultation"

database:
  path: "lead-agent/leads.db"
```

- [ ] **Step 4: Install dependencies**

```bash
cd lead-agent && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
```

Expected: All packages install without errors.

- [ ] **Step 5: Commit**

```bash
git add lead-agent/
git commit -m "chore: scaffold lead-agent project structure"
```

---

## Task 2: Database Module

**Files:**
- Create: `lead-agent/db.py`
- Create: `lead-agent/tests/test_db.py`

- [ ] **Step 1: Write the failing tests**

Create `lead-agent/tests/test_db.py`:

```python
import sqlite3
import pytest
from datetime import date
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from db import init_db, lead_exists, insert_lead, get_uncontacted_leads, insert_email, get_daily_sent_count


@pytest.fixture
def conn():
    c = init_db(":memory:")
    yield c
    c.close()


def test_init_db_creates_tables(conn):
    tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    names = {t[0] for t in tables}
    assert "leads" in names
    assert "emails" in names


def test_lead_exists_false_when_empty(conn):
    assert lead_exists(conn, "some_place_id") is False


def test_insert_and_find_lead(conn):
    lead = {
        "place_id": "abc123",
        "business_name": "Joe's Plumbing",
        "industry": "plumber",
        "city": "Durban",
        "phone": "0311234567",
        "email": "joe@example.com",
        "rating": 4.5,
        "review_count": 42,
        "found_date": str(date.today()),
    }
    insert_lead(conn, lead)
    assert lead_exists(conn, "abc123") is True


def test_insert_lead_duplicate_ignored(conn):
    lead = {
        "place_id": "abc123", "business_name": "Joe's Plumbing",
        "industry": "plumber", "city": "Durban", "phone": None,
        "email": None, "rating": 4.5, "review_count": 42,
        "found_date": str(date.today()),
    }
    insert_lead(conn, lead)
    insert_lead(conn, lead)  # second insert should not raise
    count = conn.execute("SELECT COUNT(*) FROM leads").fetchone()[0]
    assert count == 1


def test_get_uncontacted_leads_returns_leads_with_email(conn):
    for i in range(5):
        lead = {
            "place_id": f"place_{i}", "business_name": f"Biz {i}",
            "industry": "gym", "city": "Joburg", "phone": None,
            "email": f"biz{i}@example.com", "rating": 4.2,
            "review_count": 20, "found_date": str(date.today()),
        }
        insert_lead(conn, lead)
    leads = get_uncontacted_leads(conn, limit=3)
    assert len(leads) == 3
    assert all(l["email"] for l in leads)


def test_get_uncontacted_leads_skips_no_email(conn):
    lead_no_email = {
        "place_id": "no_email", "business_name": "No Email Biz",
        "industry": "gym", "city": "Joburg", "phone": None,
        "email": None, "rating": 4.2, "review_count": 20,
        "found_date": str(date.today()),
    }
    insert_lead(conn, lead_no_email)
    leads = get_uncontacted_leads(conn, limit=10)
    assert len(leads) == 0


def test_get_uncontacted_leads_skips_already_emailed(conn):
    lead = {
        "place_id": "emailed_one", "business_name": "Already Emailed",
        "industry": "bakery", "city": "Cape Town", "phone": None,
        "email": "done@example.com", "rating": 4.8, "review_count": 30,
        "found_date": str(date.today()),
    }
    lead_id = insert_lead(conn, lead)
    insert_email(conn, {
        "lead_id": lead_id, "sent_at": "2026-04-09 08:00:00",
        "status": "sent", "subject": "Hi", "body": "Hello",
        "outlook_message_id": "msg_001",
    })
    leads = get_uncontacted_leads(conn, limit=10)
    assert len(leads) == 0


def test_get_daily_sent_count(conn):
    lead = {
        "place_id": "p1", "business_name": "Biz", "industry": "gym",
        "city": "Durban", "phone": None, "email": "x@x.com",
        "rating": 4.0, "review_count": 11, "found_date": str(date.today()),
    }
    lead_id = insert_lead(conn, lead)
    insert_email(conn, {
        "lead_id": lead_id, "sent_at": "2026-04-09 08:01:00",
        "status": "sent", "subject": "Hi", "body": "Body",
        "outlook_message_id": "msg_002",
    })
    assert get_daily_sent_count(conn) == 1
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd lead-agent && source venv/bin/activate && pytest tests/test_db.py -v
```

Expected: `ModuleNotFoundError: No module named 'db'`

- [ ] **Step 3: Implement `db.py`**

Create `lead-agent/db.py`:

```python
import sqlite3
from datetime import date


def init_db(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS leads (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            place_id TEXT UNIQUE NOT NULL,
            business_name TEXT NOT NULL,
            industry TEXT,
            city TEXT,
            phone TEXT,
            email TEXT,
            rating REAL,
            review_count INTEGER,
            found_date DATE
        );
        CREATE TABLE IF NOT EXISTS emails (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lead_id INTEGER NOT NULL REFERENCES leads(id),
            sent_at DATETIME,
            status TEXT,
            subject TEXT,
            body TEXT,
            outlook_message_id TEXT
        );
    """)
    conn.commit()
    return conn


def lead_exists(conn: sqlite3.Connection, place_id: str) -> bool:
    row = conn.execute(
        "SELECT 1 FROM leads WHERE place_id = ?", (place_id,)
    ).fetchone()
    return row is not None


def insert_lead(conn: sqlite3.Connection, lead: dict) -> int:
    try:
        cur = conn.execute(
            """INSERT OR IGNORE INTO leads
               (place_id, business_name, industry, city, phone, email, rating, review_count, found_date)
               VALUES (:place_id, :business_name, :industry, :city, :phone, :email, :rating, :review_count, :found_date)""",
            lead,
        )
        conn.commit()
        if cur.lastrowid:
            return cur.lastrowid
        return conn.execute(
            "SELECT id FROM leads WHERE place_id = ?", (lead["place_id"],)
        ).fetchone()[0]
    except sqlite3.IntegrityError:
        return conn.execute(
            "SELECT id FROM leads WHERE place_id = ?", (lead["place_id"],)
        ).fetchone()[0]


def get_uncontacted_leads(conn: sqlite3.Connection, limit: int) -> list[dict]:
    rows = conn.execute(
        """SELECT l.* FROM leads l
           WHERE l.email IS NOT NULL AND l.email != ''
           AND l.id NOT IN (SELECT lead_id FROM emails)
           LIMIT ?""",
        (limit,),
    ).fetchall()
    return [dict(row) for row in rows]


def insert_email(conn: sqlite3.Connection, email_record: dict) -> None:
    conn.execute(
        """INSERT INTO emails (lead_id, sent_at, status, subject, body, outlook_message_id)
           VALUES (:lead_id, :sent_at, :status, :subject, :body, :outlook_message_id)""",
        email_record,
    )
    conn.commit()


def get_daily_sent_count(conn: sqlite3.Connection) -> int:
    today = str(date.today())
    row = conn.execute(
        "SELECT COUNT(*) FROM emails WHERE DATE(sent_at) = ? AND status = 'sent'",
        (today,),
    ).fetchone()
    return row[0]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_db.py -v
```

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lead-agent/db.py lead-agent/tests/test_db.py
git commit -m "feat: add SQLite database module with lead and email tracking"
```

---

## Task 3: Qualifier Module

**Files:**
- Create: `lead-agent/qualifier.py`
- Create: `lead-agent/tests/test_qualifier.py`

- [ ] **Step 1: Write the failing tests**

Create `lead-agent/tests/test_qualifier.py`:

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import pytest
from db import init_db, insert_lead
from qualifier import qualify
from datetime import date


@pytest.fixture
def conn():
    c = init_db(":memory:")
    yield c
    c.close()


CONFIG = {"min_rating": 4.0, "min_reviews": 10}


def make_place(**overrides):
    base = {
        "place_id": "p1",
        "business_name": "Good Biz",
        "industry": "plumber",
        "city": "Durban",
        "phone": "0311112222",
        "email": "good@biz.com",
        "rating": 4.5,
        "review_count": 25,
        "website": None,
        "found_date": str(date.today()),
    }
    base.update(overrides)
    return base


def test_qualifies_valid_business(conn):
    places = [make_place()]
    result = qualify(places, conn, CONFIG)
    assert len(result) == 1
    assert result[0]["business_name"] == "Good Biz"


def test_rejects_business_with_website(conn):
    places = [make_place(website="https://example.com")]
    result = qualify(places, conn, CONFIG)
    assert result == []


def test_rejects_low_rating(conn):
    places = [make_place(rating=3.9)]
    result = qualify(places, conn, CONFIG)
    assert result == []


def test_rejects_too_few_reviews(conn):
    places = [make_place(review_count=5)]
    result = qualify(places, conn, CONFIG)
    assert result == []


def test_rejects_already_in_db(conn):
    lead = make_place()
    insert_lead(conn, lead)
    places = [make_place()]
    result = qualify(places, conn, CONFIG)
    assert result == []


def test_filters_mixed_list(conn):
    places = [
        make_place(place_id="good1", business_name="Good One"),
        make_place(place_id="has_web", website="https://site.com"),
        make_place(place_id="low_rating", rating=2.0),
        make_place(place_id="few_reviews", review_count=3),
    ]
    result = qualify(places, conn, CONFIG)
    assert len(result) == 1
    assert result[0]["place_id"] == "good1"


def test_website_field_stripped_from_output(conn):
    places = [make_place()]
    result = qualify(places, conn, CONFIG)
    assert "website" not in result[0]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_qualifier.py -v
```

Expected: `ModuleNotFoundError: No module named 'qualifier'`

- [ ] **Step 3: Implement `qualifier.py`**

Create `lead-agent/qualifier.py`:

```python
import sqlite3
from db import lead_exists


def qualify(places: list[dict], conn: sqlite3.Connection, config: dict) -> list[dict]:
    """Filter raw place dicts to only qualified leads. Returns lead dicts (no 'website' key)."""
    min_rating = config["min_rating"]
    min_reviews = config["min_reviews"]
    qualified = []
    for place in places:
        if place.get("website"):
            continue
        if (place.get("rating") or 0) < min_rating:
            continue
        if (place.get("review_count") or 0) < min_reviews:
            continue
        if lead_exists(conn, place["place_id"]):
            continue
        lead = {k: v for k, v in place.items() if k != "website"}
        qualified.append(lead)
    return qualified
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_qualifier.py -v
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lead-agent/qualifier.py lead-agent/tests/test_qualifier.py
git commit -m "feat: add qualifier module with all filter rules"
```

---

## Task 4: Scraper Module

**Files:**
- Create: `lead-agent/scraper.py`
- Create: `lead-agent/tests/test_scraper.py`

- [ ] **Step 1: Write the failing tests**

Create `lead-agent/tests/test_scraper.py`:

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import pytest
from unittest.mock import MagicMock, patch
from scraper import scrape_businesses


MOCK_SEARCH_RESULT = {
    "results": [
        {"place_id": "abc123", "name": "Joe Plumbing"},
    ]
}

MOCK_DETAILS_WITH_WEBSITE = {
    "result": {
        "place_id": "abc123",
        "name": "Joe Plumbing",
        "rating": 4.5,
        "user_ratings_total": 30,
        "formatted_phone_number": "031 111 2222",
        "website": "https://joeplumbing.co.za",
        "types": ["plumber"],
        "vicinity": "Durban",
    }
}

MOCK_DETAILS_NO_WEBSITE = {
    "result": {
        "place_id": "abc123",
        "name": "Joe Plumbing",
        "rating": 4.5,
        "user_ratings_total": 30,
        "formatted_phone_number": "031 111 2222",
        "types": ["plumber"],
        "vicinity": "Durban",
    }
}


def make_config():
    return {
        "api_key": "TEST_KEY",
        "min_rating": 4.0,
        "min_reviews": 10,
        "request_delay_seconds": 0,
        "industries": ["plumber"],
        "cities": ["Durban"],
    }


def test_scraper_returns_places(mocker):
    mock_client = MagicMock()
    mocker.patch("scraper.googlemaps.Client", return_value=mock_client)
    mock_client.places.return_value = MOCK_SEARCH_RESULT
    mock_client.place.return_value = MOCK_DETAILS_NO_WEBSITE

    results = scrape_businesses(make_config())
    assert len(results) == 1
    assert results[0]["place_id"] == "abc123"
    assert results[0]["business_name"] == "Joe Plumbing"
    assert results[0]["website"] is None


def test_scraper_includes_website_when_present(mocker):
    mock_client = MagicMock()
    mocker.patch("scraper.googlemaps.Client", return_value=mock_client)
    mock_client.places.return_value = MOCK_SEARCH_RESULT
    mock_client.place.return_value = MOCK_DETAILS_WITH_WEBSITE

    results = scrape_businesses(make_config())
    assert len(results) == 1
    assert results[0]["website"] == "https://joeplumbing.co.za"


def test_scraper_handles_empty_results(mocker):
    mock_client = MagicMock()
    mocker.patch("scraper.googlemaps.Client", return_value=mock_client)
    mock_client.places.return_value = {"results": []}

    results = scrape_businesses(make_config())
    assert results == []


def test_scraper_deduplicates_place_ids(mocker):
    mock_client = MagicMock()
    mocker.patch("scraper.googlemaps.Client", return_value=mock_client)
    # Same place_id returned for both industry+city combos
    mock_client.places.return_value = MOCK_SEARCH_RESULT
    mock_client.place.return_value = MOCK_DETAILS_NO_WEBSITE

    config = make_config()
    config["cities"] = ["Durban", "Joburg"]  # two queries, same result
    results = scrape_businesses(config)
    assert len(results) == 1  # deduplicated
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_scraper.py -v
```

Expected: `ModuleNotFoundError: No module named 'scraper'`

- [ ] **Step 3: Implement `scraper.py`**

Create `lead-agent/scraper.py`:

```python
import time
import logging
import googlemaps
from datetime import date

logger = logging.getLogger(__name__)


def scrape_businesses(config: dict) -> list[dict]:
    """Search Google Places for businesses in SA cities. Returns raw place dicts."""
    client = googlemaps.Client(key=config["api_key"])
    delay = config.get("request_delay_seconds", 0.5)
    seen_ids: set[str] = set()
    results: list[dict] = []

    for industry in config["industries"]:
        for city in config["cities"]:
            query = f"{industry} in {city}, South Africa"
            logger.info(f"Searching: {query}")
            try:
                search = client.places(query=query)
                for item in search.get("results", []):
                    place_id = item["place_id"]
                    if place_id in seen_ids:
                        continue
                    seen_ids.add(place_id)
                    time.sleep(delay)
                    details = client.place(
                        place_id=place_id,
                        fields=["place_id", "name", "rating", "user_ratings_total",
                                "formatted_phone_number", "website", "types", "vicinity"],
                    )
                    result = details.get("result", {})
                    results.append({
                        "place_id": result.get("place_id", place_id),
                        "business_name": result.get("name", item.get("name", "")),
                        "industry": industry,
                        "city": city,
                        "phone": result.get("formatted_phone_number"),
                        "email": None,  # Google Places does not return email
                        "rating": result.get("rating"),
                        "review_count": result.get("user_ratings_total"),
                        "website": result.get("website"),
                        "found_date": str(date.today()),
                    })
            except Exception as e:
                logger.error(f"Error searching '{query}': {e}")
    return results
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_scraper.py -v
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lead-agent/scraper.py lead-agent/tests/test_scraper.py
git commit -m "feat: add Google Places scraper module"
```

---

## Task 5: Composer Module

**Files:**
- Create: `lead-agent/composer.py`
- Create: `lead-agent/tests/test_composer.py`

- [ ] **Step 1: Write the failing tests**

Create `lead-agent/tests/test_composer.py`:

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import pytest
from unittest.mock import MagicMock
from composer import compose_email


AGENCY = {
    "name": "Launchpad Studio",
    "website": "https://launchpadstudio.shop",
    "tone": "friendly and professional",
    "services": "affordable, modern websites for local businesses",
    "cta": "Reply to this email to book a free consultation",
}

LEAD = {
    "business_name": "Joe's Plumbing",
    "industry": "plumber",
    "city": "Durban",
    "rating": 4.7,
    "review_count": 58,
    "email": "joe@example.com",
}


def test_compose_email_returns_subject_and_body(mocker):
    mock_client = MagicMock()
    mocker.patch("composer.anthropic.Anthropic", return_value=mock_client)
    mock_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text="SUBJECT: Great website opportunity\nBODY: Hello Joe...")]
    )
    result = compose_email(LEAD, AGENCY, mock_client)
    assert "subject" in result
    assert "body" in result
    assert len(result["subject"]) > 0
    assert len(result["body"]) > 0


def test_compose_email_subject_stripped(mocker):
    mock_client = MagicMock()
    mock_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text="SUBJECT: Great website opportunity\nBODY: Hello Joe, your plumbing business is amazing.")]
    )
    result = compose_email(LEAD, AGENCY, mock_client)
    assert result["subject"] == "Great website opportunity"
    assert "SUBJECT:" not in result["subject"]


def test_compose_email_body_contains_business_name(mocker):
    mock_client = MagicMock()
    mock_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text="SUBJECT: Hi Joe\nBODY: Joe's Plumbing is fantastic!")]
    )
    result = compose_email(LEAD, AGENCY, mock_client)
    assert "Joe's Plumbing" in result["body"]


def test_compose_email_calls_claude_with_lead_data(mocker):
    mock_client = MagicMock()
    mock_client.messages.create.return_value = MagicMock(
        content=[MagicMock(text="SUBJECT: Hi\nBODY: Hello")]
    )
    compose_email(LEAD, AGENCY, mock_client)
    call_kwargs = mock_client.messages.create.call_args
    prompt = str(call_kwargs)
    assert "Joe's Plumbing" in prompt
    assert "Durban" in prompt
    assert "Launchpad Studio" in prompt
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_composer.py -v
```

Expected: `ModuleNotFoundError: No module named 'composer'`

- [ ] **Step 3: Implement `composer.py`**

Create `lead-agent/composer.py`:

```python
import anthropic
import logging

logger = logging.getLogger(__name__)

PROMPT_TEMPLATE = """You are writing a cold outreach email on behalf of {agency_name}, a web design agency.

Business details:
- Name: {business_name}
- Industry: {industry}
- City: {city}
- Google Rating: {rating} stars
- Number of Google Reviews: {review_count}

Agency details:
- Agency: {agency_name}
- Website: {agency_website}
- Services: {services}
- Tone: {tone}

Write a personalized cold email to this business. The email should:
1. Open by acknowledging their strong reputation on Google (reference their exact rating and review count)
2. Point out that they are missing out on customers because they have no website
3. Introduce {agency_name} as the solution ({services})
4. Include the agency website: {agency_website}
5. Close with this exact call to action: "{cta}"
6. Sign off with "Best regards, The {agency_name} Team"

Format your response EXACTLY as:
SUBJECT: <email subject line>
BODY: <full email body>

Keep the email concise (under 200 words), {tone}."""


def compose_email(lead: dict, agency: dict, client) -> dict:
    """Generate a personalized cold email for a lead. Returns dict with 'subject' and 'body'."""
    prompt = PROMPT_TEMPLATE.format(
        business_name=lead["business_name"],
        industry=lead["industry"],
        city=lead["city"],
        rating=lead["rating"],
        review_count=lead["review_count"],
        agency_name=agency["name"],
        agency_website=agency["website"],
        services=agency["services"],
        tone=agency["tone"],
        cta=agency["cta"],
    )
    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text
    subject = ""
    body = ""
    for line in raw.split("\n"):
        if line.startswith("SUBJECT:"):
            subject = line.replace("SUBJECT:", "").strip()
        elif line.startswith("BODY:"):
            body = line.replace("BODY:", "").strip()
        elif body:
            body += "\n" + line
    logger.info(f"Composed email for {lead['business_name']} — subject: {subject}")
    return {"subject": subject, "body": body.strip()}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_composer.py -v
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lead-agent/composer.py lead-agent/tests/test_composer.py
git commit -m "feat: add Claude-powered email composer module"
```

---

## Task 6: Mailer Module

**Files:**
- Create: `lead-agent/mailer.py`
- Create: `lead-agent/tests/test_mailer.py`

- [ ] **Step 1: Write the failing tests**

Create `lead-agent/tests/test_mailer.py`:

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import pytest
from unittest.mock import MagicMock, patch
from mailer import get_access_token, send_email


MICROSOFT_CONFIG = {
    "client_id": "fake_client_id",
    "client_secret": "fake_secret",
    "tenant_id": "fake_tenant",
    "sender_email": "hello.launchpadstudio@outlook.com",
}


def test_get_access_token_returns_token(mocker):
    mock_app = MagicMock()
    mock_app.acquire_token_for_client.return_value = {"access_token": "tok_abc123"}
    mocker.patch("mailer.msal.ConfidentialClientApplication", return_value=mock_app)
    token = get_access_token(MICROSOFT_CONFIG)
    assert token == "tok_abc123"


def test_get_access_token_raises_on_failure(mocker):
    mock_app = MagicMock()
    mock_app.acquire_token_for_client.return_value = {"error": "invalid_client"}
    mocker.patch("mailer.msal.ConfidentialClientApplication", return_value=mock_app)
    with pytest.raises(RuntimeError, match="Failed to acquire token"):
        get_access_token(MICROSOFT_CONFIG)


def test_send_email_returns_message_id(mocker):
    mock_post = mocker.patch("mailer.requests.post")
    mock_post.return_value = MagicMock(
        status_code=202,
        headers={"x-ms-request-id": "msg_xyz789"},
    )
    msg_id = send_email(
        token="tok_abc123",
        sender="hello.launchpadstudio@outlook.com",
        to_email="target@business.com",
        subject="Great opportunity",
        body="Hello, we noticed you have no website...",
    )
    assert msg_id == "msg_xyz789"
    assert mock_post.called


def test_send_email_raises_on_non_202(mocker):
    mock_post = mocker.patch("mailer.requests.post")
    mock_post.return_value = MagicMock(status_code=400, text="Bad Request")
    with pytest.raises(RuntimeError, match="Failed to send email"):
        send_email(
            token="tok_abc123",
            sender="hello.launchpadstudio@outlook.com",
            to_email="target@business.com",
            subject="Hi",
            body="Hello",
        )
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/test_mailer.py -v
```

Expected: `ModuleNotFoundError: No module named 'mailer'`

- [ ] **Step 3: Implement `mailer.py`**

Create `lead-agent/mailer.py`:

```python
import msal
import requests
import logging

logger = logging.getLogger(__name__)

DAILY_SEND_LIMIT = 100
GRAPH_SEND_URL = "https://graph.microsoft.com/v1.0/users/{sender}/sendMail"
SCOPES = ["https://graph.microsoft.com/.default"]


def get_access_token(config: dict) -> str:
    """Acquire an OAuth2 access token from Microsoft using client credentials."""
    app = msal.ConfidentialClientApplication(
        client_id=config["client_id"],
        client_credential=config["client_secret"],
        authority=f"https://login.microsoftonline.com/{config['tenant_id']}",
    )
    result = app.acquire_token_for_client(scopes=SCOPES)
    if "access_token" not in result:
        raise RuntimeError(f"Failed to acquire token: {result.get('error_description', result)}")
    return result["access_token"]


def send_email(token: str, sender: str, to_email: str, subject: str, body: str) -> str:
    """Send an email via Microsoft Graph API. Returns the outlook_message_id."""
    url = GRAPH_SEND_URL.format(sender=sender)
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {
        "message": {
            "subject": subject,
            "body": {"contentType": "Text", "content": body},
            "toRecipients": [{"emailAddress": {"address": to_email}}],
        },
        "saveToSentItems": True,
    }
    response = requests.post(url, headers=headers, json=payload)
    if response.status_code != 202:
        raise RuntimeError(f"Failed to send email to {to_email}: {response.status_code} {response.text}")
    msg_id = response.headers.get("x-ms-request-id", "")
    logger.info(f"Email sent to {to_email} — message_id: {msg_id}")
    return msg_id
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/test_mailer.py -v
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lead-agent/mailer.py lead-agent/tests/test_mailer.py
git commit -m "feat: add Microsoft Graph API mailer module"
```

---

## Task 7: Main Orchestrator

**Files:**
- Create: `lead-agent/main.py`

- [ ] **Step 1: Implement `main.py`**

Create `lead-agent/main.py`:

```python
import logging
import os
import yaml
import anthropic
from datetime import datetime

from db import init_db, insert_lead, get_uncontacted_leads, insert_email, get_daily_sent_count
from scraper import scrape_businesses
from qualifier import qualify
from composer import compose_email
from mailer import get_access_token, send_email, DAILY_SEND_LIMIT

LOG_PATH = os.path.join(os.path.dirname(__file__), "logs", "agent.log")
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.yaml")


def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.FileHandler(LOG_PATH),
            logging.StreamHandler(),
        ],
    )


def load_config(path: str) -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def run():
    setup_logging()
    logger = logging.getLogger("main")
    logger.info("=== Lead Agent starting ===")

    config = load_config(CONFIG_PATH)
    conn = init_db(config["database"]["path"])

    # --- Scrape ---
    logger.info("Scraping Google Places...")
    raw_places = scrape_businesses(config["google_places"])
    logger.info(f"Scraped {len(raw_places)} raw places")

    # --- Qualify & store new leads ---
    new_leads = qualify(raw_places, conn, config["google_places"])
    logger.info(f"Qualified {len(new_leads)} new leads")
    for lead in new_leads:
        insert_lead(conn, lead)

    # --- Check daily cap ---
    already_sent_today = get_daily_sent_count(conn)
    remaining = DAILY_SEND_LIMIT - already_sent_today
    if remaining <= 0:
        logger.info("Daily send limit of 100 already reached. Exiting.")
        return

    # --- Get uncontacted leads with emails ---
    leads_to_email = get_uncontacted_leads(conn, limit=remaining)
    logger.info(f"Found {len(leads_to_email)} leads to email today (cap: {remaining})")

    if not leads_to_email:
        logger.info("No leads with email addresses available today.")
        return

    # --- Auth ---
    try:
        token = get_access_token(config["microsoft"])
    except RuntimeError as e:
        logger.error(f"Auth failed: {e}")
        return

    # --- Compose & Send ---
    anthropic_client = anthropic.Anthropic(api_key=config["anthropic"]["api_key"])
    sent_count = 0
    failed_count = 0

    for lead in leads_to_email:
        try:
            email = compose_email(lead, config["agency"], anthropic_client)
            msg_id = send_email(
                token=token,
                sender=config["microsoft"]["sender_email"],
                to_email=lead["email"],
                subject=email["subject"],
                body=email["body"],
            )
            insert_email(conn, {
                "lead_id": lead["id"],
                "sent_at": datetime.utcnow().isoformat(sep=" ", timespec="seconds"),
                "status": "sent",
                "subject": email["subject"],
                "body": email["body"],
                "outlook_message_id": msg_id,
            })
            sent_count += 1
        except Exception as e:
            logger.error(f"Failed for lead {lead['business_name']}: {e}")
            insert_email(conn, {
                "lead_id": lead["id"],
                "sent_at": datetime.utcnow().isoformat(sep=" ", timespec="seconds"),
                "status": "failed",
                "subject": "",
                "body": "",
                "outlook_message_id": "",
            })
            failed_count += 1

    logger.info(f"=== Done: {sent_count} sent, {failed_count} failed ===")
    conn.close()


if __name__ == "__main__":
    run()
```

- [ ] **Step 2: Run the full test suite to verify nothing is broken**

```bash
pytest tests/ -v
```

Expected: All tests PASS (no regressions).

- [ ] **Step 3: Commit**

```bash
git add lead-agent/main.py
git commit -m "feat: add main pipeline orchestrator"
```

---

## Task 8: Cron Setup & Final Wiring

**Files:**
- No new files — cron is a system config

- [ ] **Step 1: Find the absolute path to the project and venv**

```bash
echo "$(pwd)/lead-agent" && echo "$(pwd)/lead-agent/venv/bin/python"
```

Note the output — you'll use these in the cron entry.

- [ ] **Step 2: Add the cron job**

```bash
(crontab -l 2>/dev/null; echo "0 8 * * * cd /home/marnu/lead-agent && /home/marnu/lead-agent/venv/bin/python /home/marnu/lead-agent/main.py >> /home/marnu/lead-agent/logs/agent.log 2>&1") | crontab -
```

- [ ] **Step 3: Verify cron was registered**

```bash
crontab -l
```

Expected: Entry for `0 8 * * *` is shown.

- [ ] **Step 4: Do a dry-run to verify the pipeline works end-to-end**

```bash
cd /home/marnu/lead-agent && source venv/bin/activate && python main.py
```

Expected: Logs appear in terminal and in `logs/agent.log`. The agent will fail on real API calls until you add your keys to `config.yaml` — that is expected. Look for the auth/API key errors, not Python errors.

- [ ] **Step 5: Fill in real API keys in `config.yaml`**

Open `lead-agent/config.yaml` and replace:
- `YOUR_GOOGLE_API_KEY` — from Google Cloud Console (enable Places API)
- `YOUR_ANTHROPIC_API_KEY` — from console.anthropic.com
- `YOUR_CLIENT_ID`, `YOUR_CLIENT_SECRET`, `YOUR_TENANT_ID` — from Azure AD app registration for `hello.launchpadstudio@outlook.com` with `Mail.Send` permission

- [ ] **Step 6: Run final test with real keys**

```bash
python main.py
```

Check `logs/agent.log` for:
- Number of places scraped
- Number of leads qualified
- Emails sent or errors

- [ ] **Step 7: Final commit**

```bash
git add lead-agent/
git commit -m "chore: finalize cron setup and confirm pipeline end-to-end"
```

---

## API Keys Setup Guide

### Google Places API
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → Enable **Places API**
3. Create an API key under Credentials
4. Restrict the key to Places API only

### Anthropic API
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. API Keys → Create Key

### Microsoft Graph API (Outlook)
1. Go to [portal.azure.com](https://portal.azure.com) → Azure Active Directory → App registrations → New registration
2. Name: "Launchpad Lead Agent", Account type: "Single tenant"
3. After creation: go to **API Permissions** → Add `Mail.Send` (Application permission, not Delegated)
4. Click **Grant admin consent**
5. Go to **Certificates & secrets** → New client secret → copy value
6. Copy the **Application (client) ID** and **Directory (tenant) ID** from the Overview page
