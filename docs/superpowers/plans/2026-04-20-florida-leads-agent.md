# Florida Leads Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone on-demand Python agent that scrapes Florida local businesses (landscaping, HVAC, plumbers, restaurants) with no website and 4.0+ stars from Google Places, enriches with owner/email via DuckDuckGo scraping, and exports to a dated CSV.

**Architecture:** `scraper.py` queries Google Places API → `finder.py` searches DuckDuckGo per business for contact info → `exporter.py` deduplicates and writes CSV → `main.py` orchestrates all three.

**Tech Stack:** Python 3.12, `googlemaps`, `duckduckgo-search`, `python-dotenv`, `pytest`

---

## File Map

| Path | Responsibility |
|------|---------------|
| `florida-leads-agent/main.py` | Entry point — loads env, calls pipeline, logs progress |
| `florida-leads-agent/scraper.py` | Google Places text search + place details, filters no-website + 4.0+ |
| `florida-leads-agent/finder.py` | DuckDuckGo search per business, regex extracts email + owner name |
| `florida-leads-agent/exporter.py` | Deduplicates by `place_id`, writes dated CSV |
| `florida-leads-agent/requirements.txt` | Python dependencies |
| `florida-leads-agent/.env` | `GOOGLE_PLACES_API_KEY` (not committed) |
| `florida-leads-agent/.gitignore` | Ignores `.env`, `__pycache__`, `*.csv` |
| `florida-leads-agent/tests/test_exporter.py` | Unit tests for CSV export + dedup |
| `florida-leads-agent/tests/test_scraper.py` | Unit tests for Places filtering logic |
| `florida-leads-agent/tests/test_finder.py` | Unit tests for regex email + owner extraction |
| `florida-leads-agent/tests/test_main.py` | Integration smoke tests for the pipeline |

---

## Task 1: Project scaffold

**Files:**
- Create: `florida-leads-agent/requirements.txt`
- Create: `florida-leads-agent/.gitignore`
- Create: `florida-leads-agent/.env` (template only)

- [ ] **Step 1: Create the project directory**

```bash
mkdir -p /home/marnu/florida-leads-agent/tests
touch /home/marnu/florida-leads-agent/tests/__init__.py
```

- [ ] **Step 2: Write requirements.txt**

```
googlemaps==4.10.0
duckduckgo-search==6.3.7
python-dotenv==1.0.1
pytest==8.1.1
```

- [ ] **Step 3: Write .gitignore**

```
.env
__pycache__/
*.pyc
*.csv
venv/
.pytest_cache/
```

- [ ] **Step 4: Write .env template**

```
GOOGLE_PLACES_API_KEY=your_key_here
```

- [ ] **Step 5: Create the venv and install dependencies**

```bash
cd /home/marnu/florida-leads-agent
python3 -m venv venv
venv/bin/pip install -r requirements.txt
```

Expected: all packages install without errors.

- [ ] **Step 6: Commit**

```bash
cd /home/marnu/florida-leads-agent
git -C /home/marnu add florida-leads-agent/
git -C /home/marnu commit -m "feat: scaffold florida-leads-agent project"
```

---

## Task 2: exporter.py

**Files:**
- Create: `florida-leads-agent/exporter.py`
- Create: `florida-leads-agent/tests/test_exporter.py`

- [ ] **Step 1: Write the failing tests**

`florida-leads-agent/tests/test_exporter.py`:
```python
import csv
import pytest
from exporter import export_leads

def _make_lead(place_id, name, category, city, email="", owner=""):
    return {
        "place_id": place_id,
        "business_name": name,
        "category": category,
        "city": city,
        "address": "1 Main St",
        "phone": "305-555-0001",
        "rating": 4.5,
        "review_count": 20,
        "email": email,
        "owner_name": owner,
    }

def test_export_writes_csv_with_correct_headers(tmp_path):
    leads = [_make_lead("a", "A Lawn", "landscaping", "Miami")]
    path = export_leads(leads, str(tmp_path))
    with open(path) as f:
        reader = csv.DictReader(f)
        assert reader.fieldnames == [
            "business_name", "category", "city", "address",
            "phone", "rating", "review_count", "email", "owner_name"
        ]

def test_export_deduplicates_by_place_id(tmp_path):
    leads = [
        _make_lead("abc", "A Lawn", "landscaping", "Miami"),
        _make_lead("abc", "A Lawn", "landscaping", "Miami"),  # duplicate
        _make_lead("xyz", "B Plumbing", "plumbers", "Orlando", email="bob@example.com", owner="Bob Smith"),
    ]
    path = export_leads(leads, str(tmp_path))
    with open(path) as f:
        rows = list(csv.DictReader(f))
    assert len(rows) == 2

def test_export_preserves_email_and_owner(tmp_path):
    leads = [_make_lead("a", "Joe AC", "HVAC", "Tampa", email="joe@joeac.net", owner="Joe Doe")]
    path = export_leads(leads, str(tmp_path))
    with open(path) as f:
        rows = list(csv.DictReader(f))
    assert rows[0]["email"] == "joe@joeac.net"
    assert rows[0]["owner_name"] == "Joe Doe"

def test_export_filename_contains_today(tmp_path):
    from datetime import date
    leads = [_make_lead("a", "X", "restaurants", "Miami")]
    path = export_leads(leads, str(tmp_path))
    assert str(date.today()) in path
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/marnu/florida-leads-agent
venv/bin/pytest tests/test_exporter.py -v
```

Expected: `ModuleNotFoundError: No module named 'exporter'`

- [ ] **Step 3: Write exporter.py**

`florida-leads-agent/exporter.py`:
```python
import csv
from datetime import date

FIELDNAMES = [
    "business_name", "category", "city", "address",
    "phone", "rating", "review_count", "email", "owner_name",
]

def export_leads(leads: list[dict], output_dir: str = ".") -> str:
    seen = set()
    unique = []
    for lead in leads:
        pid = lead.get("place_id") or lead["business_name"]
        if pid not in seen:
            seen.add(pid)
            unique.append(lead)

    filename = f"{output_dir}/florida_leads_{date.today()}.csv"
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(unique)
    return filename
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/marnu/florida-leads-agent
venv/bin/pytest tests/test_exporter.py -v
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git -C /home/marnu add florida-leads-agent/exporter.py florida-leads-agent/tests/test_exporter.py
git -C /home/marnu commit -m "feat: add exporter with dedup and CSV output"
```

---

## Task 3: scraper.py

**Files:**
- Create: `florida-leads-agent/scraper.py`
- Create: `florida-leads-agent/tests/test_scraper.py`

- [ ] **Step 1: Write the failing tests**

`florida-leads-agent/tests/test_scraper.py`:
```python
from unittest.mock import MagicMock
from scraper import _search_places, _get_lead

def test_search_places_filters_below_min_rating():
    gmaps = MagicMock()
    gmaps.places.return_value = {
        "results": [
            {"place_id": "a", "rating": 4.5},
            {"place_id": "b", "rating": 3.8},
            {"place_id": "c", "rating": 4.0},
            {"place_id": "d", "rating": 2.9},
        ]
    }
    ids = _search_places(gmaps, "landscaping in Miami, Florida")
    assert ids == ["a", "c"]

def test_search_places_excludes_missing_rating():
    gmaps = MagicMock()
    gmaps.places.return_value = {
        "results": [
            {"place_id": "a", "rating": 4.2},
            {"place_id": "b"},  # no rating field
        ]
    }
    ids = _search_places(gmaps, "HVAC in Tampa, Florida")
    assert ids == ["a"]

def test_get_lead_returns_none_when_website_present():
    gmaps = MagicMock()
    gmaps.place.return_value = {"result": {
        "place_id": "abc", "name": "Bob's Lawn",
        "formatted_address": "1 Main St, Miami, FL",
        "formatted_phone_number": "305-555-0001",
        "rating": 4.5, "user_ratings_total": 50,
        "website": "https://bobslawn.com",
    }}
    assert _get_lead(gmaps, "abc", "landscaping", "Miami") is None

def test_get_lead_returns_lead_without_website():
    gmaps = MagicMock()
    gmaps.place.return_value = {"result": {
        "place_id": "xyz", "name": "Joe's AC",
        "formatted_address": "2 Oak Ave, Tampa, FL",
        "formatted_phone_number": "813-555-0002",
        "rating": 4.2, "user_ratings_total": 30,
    }}
    lead = _get_lead(gmaps, "xyz", "HVAC", "Tampa")
    assert lead is not None
    assert lead["business_name"] == "Joe's AC"
    assert lead["category"] == "HVAC"
    assert lead["city"] == "Tampa"
    assert lead["email"] == ""
    assert lead["owner_name"] == ""

def test_get_lead_handles_missing_phone():
    gmaps = MagicMock()
    gmaps.place.return_value = {"result": {
        "place_id": "p1", "name": "Bob Plumbing",
        "formatted_address": "3 River Rd, Orlando, FL",
        "rating": 4.1, "user_ratings_total": 8,
    }}
    lead = _get_lead(gmaps, "p1", "plumbers", "Orlando")
    assert lead["phone"] == ""
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/marnu/florida-leads-agent
venv/bin/pytest tests/test_scraper.py -v
```

Expected: `ModuleNotFoundError: No module named 'scraper'`

- [ ] **Step 3: Write scraper.py**

`florida-leads-agent/scraper.py`:
```python
import time
import logging
import googlemaps

logger = logging.getLogger(__name__)

NICHES = ["landscaping", "HVAC", "plumbers", "restaurants"]
CITIES = [
    "Miami", "Orlando", "Tampa", "Jacksonville", "Fort Lauderdale",
    "St. Petersburg", "Hialeah", "Tallahassee", "Cape Coral", "Gainesville",
]
MIN_RATING = 4.0


def scrape_leads(api_key: str) -> list[dict]:
    gmaps = googlemaps.Client(key=api_key)
    leads = []
    for niche in NICHES:
        for city in CITIES:
            query = f"{niche} in {city}, Florida"
            logger.info("Searching: %s", query)
            try:
                place_ids = _search_places(gmaps, query)
                for place_id in place_ids:
                    lead = _get_lead(gmaps, place_id, niche, city)
                    if lead:
                        leads.append(lead)
                    time.sleep(0.2)
            except Exception as e:
                logger.error("Search failed for %s in %s: %s", niche, city, e)
            time.sleep(1.0)
    return leads


def _search_places(gmaps, query: str) -> list[str]:
    response = gmaps.places(query=query)
    ids = []
    for r in response.get("results", []):
        if r.get("rating", 0) >= MIN_RATING:
            ids.append(r["place_id"])
    while "next_page_token" in response:
        time.sleep(2)
        response = gmaps.places(query=query, page_token=response["next_page_token"])
        for r in response.get("results", []):
            if r.get("rating", 0) >= MIN_RATING:
                ids.append(r["place_id"])
    return ids


def _get_lead(gmaps, place_id: str, niche: str, city: str) -> dict | None:
    details = gmaps.place(
        place_id=place_id,
        fields=["name", "formatted_address", "formatted_phone_number",
                "rating", "user_ratings_total", "website", "place_id"],
    )
    r = details.get("result", {})
    if r.get("website"):
        return None
    return {
        "place_id": r.get("place_id", place_id),
        "business_name": r.get("name", ""),
        "category": niche,
        "city": city,
        "address": r.get("formatted_address", ""),
        "phone": r.get("formatted_phone_number", ""),
        "rating": r.get("rating", ""),
        "review_count": r.get("user_ratings_total", ""),
        "email": "",
        "owner_name": "",
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/marnu/florida-leads-agent
venv/bin/pytest tests/test_scraper.py -v
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git -C /home/marnu add florida-leads-agent/scraper.py florida-leads-agent/tests/test_scraper.py
git -C /home/marnu commit -m "feat: add Google Places scraper with website + rating filter"
```

---

## Task 4: finder.py

**Files:**
- Create: `florida-leads-agent/finder.py`
- Create: `florida-leads-agent/tests/test_finder.py`

- [ ] **Step 1: Write the failing tests**

`florida-leads-agent/tests/test_finder.py`:
```python
from finder import _extract_email, _extract_owner

def test_extract_email_finds_valid_email():
    text = "For bookings contact info@joesplumbing.com or call us"
    assert _extract_email(text) == "info@joesplumbing.com"

def test_extract_email_filters_example_com():
    text = "Email us at test@example.com for help"
    assert _extract_email(text) == ""

def test_extract_email_filters_platform_domains():
    text = "Powered by wix.com, contact noreply@wix.com"
    assert _extract_email(text) == ""

def test_extract_email_returns_empty_string_when_none():
    assert _extract_email("no contact info here at all") == ""

def test_extract_email_returns_first_valid_match():
    text = "Contact first@bizA.com or second@bizB.com"
    assert _extract_email(text) == "first@bizA.com"

def test_extract_owner_finds_owner_colon_pattern():
    text = "Owner: John Smith has run this shop since 2005"
    assert _extract_owner(text) == "John Smith"

def test_extract_owner_finds_founder_pattern():
    text = "Founder: Maria Garcia started the company in Orlando"
    assert _extract_owner(text) == "Maria Garcia"

def test_extract_owner_returns_empty_when_no_match():
    assert _extract_owner("great service, highly recommended") == ""
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/marnu/florida-leads-agent
venv/bin/pytest tests/test_finder.py -v
```

Expected: `ModuleNotFoundError: No module named 'finder'`

- [ ] **Step 3: Write finder.py**

`florida-leads-agent/finder.py`:
```python
import re
import logging
from duckduckgo_search import DDGS

logger = logging.getLogger(__name__)

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[a-z]{2,}", re.IGNORECASE)
OWNER_RE = re.compile(
    r"(?:owner|founder|proprietor)[:\s,]+([A-Z][a-z]+ [A-Z][a-z]+)",
    re.IGNORECASE,
)
_NOISE_DOMAINS = {"example.com", "wix.com", "squarespace.com", "sentry.io", "godaddy.com"}


def find_contact_info(business_name: str, city: str) -> dict:
    query = f'"{business_name}" {city} Florida owner email phone'
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=5))
        text = " ".join(r.get("body", "") + " " + r.get("title", "") for r in results)
        return {
            "email": _extract_email(text),
            "owner_name": _extract_owner(text),
        }
    except Exception as e:
        logger.warning("DDG search failed for %s: %s", business_name, e)
        return {"email": "", "owner_name": ""}


def _extract_email(text: str) -> str:
    for match in EMAIL_RE.finditer(text):
        email = match.group(0)
        domain = email.split("@", 1)[1].lower()
        if domain not in _NOISE_DOMAINS:
            return email
    return ""


def _extract_owner(text: str) -> str:
    match = OWNER_RE.search(text)
    return match.group(1) if match else ""
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/marnu/florida-leads-agent
venv/bin/pytest tests/test_finder.py -v
```

Expected: 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git -C /home/marnu add florida-leads-agent/finder.py florida-leads-agent/tests/test_finder.py
git -C /home/marnu commit -m "feat: add DuckDuckGo finder with email and owner extraction"
```

---

## Task 5: main.py

**Files:**
- Create: `florida-leads-agent/main.py`
- Create: `florida-leads-agent/tests/test_main.py`

- [ ] **Step 1: Write the failing tests**

`florida-leads-agent/tests/test_main.py`:
```python
import pytest
from unittest.mock import patch, MagicMock

def test_run_exits_when_api_key_missing(caplog):
    import logging
    caplog.set_level(logging.ERROR)
    with patch("main.load_dotenv"), \
         patch.dict("os.environ", {}, clear=True):
        from main import run
        run()
    assert "GOOGLE_PLACES_API_KEY not set" in caplog.text

def test_run_calls_full_pipeline(monkeypatch):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "fake-key")
    mock_leads = [{
        "place_id": "a", "business_name": "Test Biz", "category": "HVAC",
        "city": "Miami", "address": "1 Main", "phone": "305-555-0001",
        "rating": 4.5, "review_count": 10, "email": "", "owner_name": "",
    }]
    with patch("main.load_dotenv"), \
         patch("main.scrape_leads", return_value=mock_leads) as mock_scrape, \
         patch("main.find_contact_info", return_value={"email": "t@t.com", "owner_name": "Jane"}) as mock_find, \
         patch("main.export_leads", return_value="/tmp/leads.csv") as mock_export:
        from importlib import reload
        import main
        reload(main)
        main.run()
    mock_scrape.assert_called_once_with("fake-key")
    mock_find.assert_called_once_with("Test Biz", "Miami")
    mock_export.assert_called_once()
    assert mock_leads[0]["email"] == "t@t.com"
    assert mock_leads[0]["owner_name"] == "Jane"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/marnu/florida-leads-agent
venv/bin/pytest tests/test_main.py -v
```

Expected: `ModuleNotFoundError: No module named 'main'`

- [ ] **Step 3: Write main.py**

`florida-leads-agent/main.py`:
```python
import logging
import os
from dotenv import load_dotenv
from scraper import scrape_leads
from finder import find_contact_info
from exporter import export_leads


def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )


def run():
    setup_logging()
    logger = logging.getLogger("main")
    load_dotenv()

    api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not api_key:
        logger.error("GOOGLE_PLACES_API_KEY not set in .env")
        return

    logger.info("=== Florida Leads Agent starting ===")

    logger.info("Scraping Google Places...")
    leads = scrape_leads(api_key)
    logger.info("Found %d businesses (no website, 4.0+ stars)", len(leads))

    logger.info("Searching for owner names and emails...")
    for i, lead in enumerate(leads, 1):
        info = find_contact_info(lead["business_name"], lead["city"])
        lead.update(info)
        if i % 10 == 0:
            logger.info("  %d/%d processed", i, len(leads))

    path = export_leads(leads)
    logger.info("=== Done: %d leads saved to %s ===", len(leads), path)


if __name__ == "__main__":
    run()
```

- [ ] **Step 4: Run all tests**

```bash
cd /home/marnu/florida-leads-agent
venv/bin/pytest tests/ -v
```

Expected: all tests PASS (17 total).

- [ ] **Step 5: Commit**

```bash
git -C /home/marnu add florida-leads-agent/main.py florida-leads-agent/tests/test_main.py
git -C /home/marnu commit -m "feat: add main.py pipeline orchestrator"
```

---

## Task 6: Smoke test with real API key

> Run this only once you have the real `GOOGLE_PLACES_API_KEY` set in `.env`.

- [ ] **Step 1: Set your API key**

Edit `florida-leads-agent/.env`:
```
GOOGLE_PLACES_API_KEY=your_real_key_here
```

- [ ] **Step 2: Run the agent**

```bash
cd /home/marnu/florida-leads-agent
venv/bin/python main.py
```

Expected output ends with:
```
=== Done: N leads saved to florida_leads_2026-04-20.csv ===
```

- [ ] **Step 3: Verify the CSV**

```bash
head -5 florida_leads_$(date +%Y-%m-%d).csv
```

Expected: header row + business rows, email/owner_name columns present (may be blank for some rows).

- [ ] **Step 4: Final commit**

```bash
git -C /home/marnu add florida-leads-agent/
git -C /home/marnu commit -m "feat: complete florida-leads-agent — scrape, enrich, export CSV"
```
