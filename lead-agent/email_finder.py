import re
import time
import logging
import requests
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from ddgs import DDGS

logger = logging.getLogger(__name__)

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")

# Domains that are never real business contact emails
SKIP_EMAIL_DOMAINS = {
    "sentry.io", "example.com", "wixpress.com", "squarespace.com",
    "wordpress.com", "googletagmanager.com", "facebook.com",
    "instagram.com", "w3.org", "schema.org", "amazonaws.com",
    "cloudfront.net", "google.com", "gstatic.com", "googleapis.com",
    "doubleclick.net", "twitter.com", "youtube.com", "tiktok.com",
    "whatsapp.com", "linkedin.com", "apple.com", "microsoft.com",
    "yahoo.com", "hotmail.com", "outlook.com",
}

# URL domains to skip when visiting pages (review sites, news, aggregators)
SKIP_URL_DOMAINS = {
    "tripadvisor.com", "yelp.com", "zomato.com", "foursquare.com",
    "yellowpages.com", "whitepages.com", "superpages.com",
    "expressen.se", "dailymail.co.uk", "news24.com",
    "businessinsider.com", "wikimedia.org", "wikipedia.org",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en,en-US;q=0.9",
}


def _is_valid_email(email: str) -> bool:
    domain = email.split("@")[-1].lower()
    if domain in SKIP_EMAIL_DOMAINS:
        return False
    if any(domain.endswith(ext) for ext in (".png", ".jpg", ".gif", ".svg", ".css", ".js")):
        return False
    return True


def _score_email(email: str) -> int:
    """Higher score = more likely to be a real business email."""
    if email.startswith(("info@", "contact@", "hello@", "admin@", "enquiries@")):
        return 3
    if "." in email.split("@")[-1]:
        return 2
    return 1


def _extract_emails(html: str) -> list[str]:
    """Extract email addresses from HTML, prioritising mailto: links."""
    soup = BeautifulSoup(html, "lxml")
    emails = []
    # mailto: links first — most reliable
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("mailto:"):
            email = href[7:].split("?")[0].strip().lower()
            if email and _is_valid_email(email):
                emails.append(email)
    # regex on visible text second
    text = soup.get_text(separator=" ")
    for email in EMAIL_RE.findall(text):
        email = email.lower()
        if _is_valid_email(email) and email not in emails:
            emails.append(email)
    # Sort by score: contact@ prefixes and mailto: links first
    emails.sort(key=_score_email, reverse=True)
    return emails


def _search_urls(business_name: str, city: str) -> list[str]:
    """Search DuckDuckGo for the business and return top result URLs."""
    query = f'"{business_name}" {city} contact email'
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=8))
        urls = []
        for r in results:
            href = r.get("href", "")
            if not href:
                continue
            domain = urlparse(href).netloc.lower().replace("www.", "")
            if domain not in SKIP_URL_DOMAINS:
                urls.append(href)
        return urls[:5]
    except Exception as e:
        logger.warning("DDG search failed for '%s': %s", business_name, e)
        return []


def _scrape_page(url: str) -> list[str]:
    """Fetch a URL and extract email addresses from its content."""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=8, allow_redirects=True)
        if resp.status_code != 200:
            return []
        return _extract_emails(resp.text)
    except Exception as e:
        logger.debug("Failed to scrape %s: %s", url, e)
        return []


def find_email(lead: dict, delay: float = 1.0) -> str | None:
    """Search the web for a business email address.

    Searches DuckDuckGo for the business, visits top result pages,
    and extracts email addresses — prioritising contact@ prefixes and mailto: links
    and mailto: links over regex matches.

    Args:
        lead: dict with 'business_name' and 'city' keys
        delay: seconds to wait between HTTP requests

    Returns:
        Best found email address, or None if not found
    """
    business_name = lead.get("business_name", "")
    city = lead.get("city", "")
    if not business_name:
        return None

    logger.info("Finding email for: %s, %s", business_name, city)

    urls = _search_urls(business_name, city)
    if not urls:
        return None

    all_emails: list[tuple[int, str]] = []  # (score, email)

    for url in urls:
        time.sleep(delay)
        emails = _scrape_page(url)
        for email in emails:
            all_emails.append((_score_email(email), email))

    if not all_emails:
        logger.info("No email found for %s", business_name)
        return None

    # Return the highest-scoring email
    all_emails.sort(key=lambda x: x[0], reverse=True)
    best = all_emails[0][1]
    logger.info("Found email %s for %s", best, business_name)
    return best
