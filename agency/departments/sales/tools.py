import re
import time
import logging
import imaplib
import email as email_lib
from datetime import date
from email.header import decode_header

import googlemaps
import requests
from ddgs import DDGS

logger = logging.getLogger(__name__)

EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}")
SKIP_EMAIL_DOMAINS = {
    "sentry.io", "example.com", "wixpress.com", "squarespace.com", "wordpress.com",
    "googletagmanager.com", "facebook.com", "instagram.com", "w3.org", "schema.org",
    "amazonaws.com", "cloudfront.net", "google.com", "gstatic.com", "googleapis.com",
    "doubleclick.net", "twitter.com", "youtube.com", "tiktok.com", "whatsapp.com",
    "linkedin.com", "apple.com", "microsoft.com", "yahoo.com", "hotmail.com", "outlook.com",
}
SKIP_URL_DOMAINS = {
    "tripadvisor.com", "yelp.com", "zomato.com", "foursquare.com", "yellowpages.co.za",
    "cylex.co.za", "trovit.co.za", "businessinsider.com", "wikimedia.org", "wikipedia.org",
}
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept-Language": "en-ZA,en;q=0.9",
}


def scrape_businesses(config: dict) -> list[dict]:
    client = googlemaps.Client(key=config["api_key"])
    delay = float(config.get("request_delay_seconds", 0.5))
    seen_ids: set = set()
    results = []
    found_date = str(date.today())
    for industry in config.get("industries", []):
        for city in config.get("cities", []):
            query = f"{industry} in {city}, South Africa"
            page_token = None
            while True:
                try:
                    search = (client.places(query=query, page_token=page_token)
                              if page_token else client.places(query=query))
                    time.sleep(delay)
                except Exception as e:
                    logger.error("Places search error '%s': %s", query, e)
                    break
                for item in search.get("results", []):
                    pid = item.get("place_id")
                    if not pid or pid in seen_ids:
                        continue
                    seen_ids.add(pid)
                    try:
                        det = client.place(
                            place_id=pid,
                            fields=["place_id", "name", "rating", "user_ratings_total",
                                    "formatted_phone_number", "website", "vicinity"])
                        time.sleep(delay)
                        r = det.get("result", {})
                        results.append({
                            "place_id": r.get("place_id", pid),
                            "business_name": r.get("name", item.get("name", "")),
                            "industry": industry, "city": city,
                            "phone": r.get("formatted_phone_number"), "email": None,
                            "rating": r.get("rating"),
                            "review_count": r.get("user_ratings_total"),
                            "website": r.get("website"), "found_date": found_date,
                        })
                    except Exception as e:
                        logger.error("Details error for %s: %s", pid, e)
                page_token = search.get("next_page_token")
                if not page_token:
                    break
                time.sleep(2)
    return results


def qualify(places: list[dict], conn, config: dict) -> list[dict]:
    from shared.db import lead_exists
    min_rating = config.get("min_rating", 4.0)
    min_reviews = config.get("min_reviews", 10)
    qualified = []
    for p in places:
        if not p.get("place_id"):
            continue
        if p.get("website"):
            continue
        if (p.get("rating") or 0) < min_rating:
            continue
        if (p.get("review_count") or 0) < min_reviews:
            continue
        if lead_exists(conn, p["place_id"]):
            continue
        qualified.append({k: v for k, v in p.items() if k != "website"})
    return qualified


def _valid_email(email: str) -> bool:
    domain = email.split("@")[-1].lower()
    return domain not in SKIP_EMAIL_DOMAINS and not any(
        domain.endswith(ext) for ext in (".png", ".jpg", ".gif", ".svg", ".css", ".js")
    )


def _score_email(email: str) -> int:
    domain = email.split("@")[-1].lower()
    if domain.endswith(".co.za") or domain.endswith(".za"):
        return 3
    if email.startswith(("info@", "contact@", "hello@", "admin@", "enquiries@")):
        return 2
    return 1


def find_email(lead: dict) -> str | None:
    name = lead.get("business_name", "")
    city = lead.get("city", "")
    candidates: dict[str, int] = {}
    for query in [f'"{name}" {city} email contact', f'"{name}" South Africa email']:
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=5))
            for r in results:
                url = r.get("href", "")
                if not url or any(d in url for d in SKIP_URL_DOMAINS):
                    continue
                try:
                    resp = requests.get(url, headers=HEADERS, timeout=8)
                    for m in EMAIL_RE.findall(resp.text):
                        m = m.lower()
                        if _valid_email(m):
                            candidates[m] = max(candidates.get(m, 0), _score_email(m))
                except Exception:
                    pass
            time.sleep(1)
        except Exception as e:
            logger.warning("Email search failed: %s", e)
    if not candidates:
        return None
    return max(candidates, key=lambda e: candidates[e])


def compose_email(lead: dict, agency: dict, client, model: str) -> dict:
    prompt = f"""Write a cold email for {agency['name']}, a web design agency.
Business: {lead['business_name']}, {lead['industry']}, {lead['city']}
Rating: {lead['rating']} stars, {lead.get('review_count')} reviews
Services: {agency['services']}
Tone: {agency['tone']}
CTA: {agency['cta']}
Rules: mention their exact rating, point out missing website, keep under 200 words.
Format: SUBJECT: <subject>\nBODY: <body>"""
    resp = client.messages.create(model=model, max_tokens=512,
                                   messages=[{"role": "user", "content": prompt}])
    raw = resp.content[0].text
    subject, body_lines, in_body = "", [], False
    for line in raw.split("\n"):
        if line.startswith("SUBJECT:"):
            subject = line.removeprefix("SUBJECT:").strip()
        elif line.startswith("BODY:"):
            in_body = True
            first = line.removeprefix("BODY:").strip()
            if first:
                body_lines.append(first)
        elif in_body:
            body_lines.append(line)
    body = "\n".join(body_lines).strip()
    if not subject or not body:
        raise ValueError(f"Malformed Claude response for {lead['business_name']}")
    return {"subject": subject, "body": body}


def compose_followup(lead: dict, agency: dict, client, model: str, follow_up_number: int) -> dict:
    day = 3 if follow_up_number == 1 else 7
    prompt = f"""Write a short follow-up email (follow-up #{follow_up_number}, day {day}) for {agency['name']}.
Business: {lead['business_name']}, {lead['city']}
Keep it under 100 words. Friendly, not pushy. Reference no response to previous email.
CTA: {agency['cta']}
Format: SUBJECT: <subject>\nBODY: <body>"""
    resp = client.messages.create(model=model, max_tokens=300,
                                   messages=[{"role": "user", "content": prompt}])
    raw = resp.content[0].text
    subject, body_lines, in_body = "", [], False
    for line in raw.split("\n"):
        if line.startswith("SUBJECT:"):
            subject = line.removeprefix("SUBJECT:").strip()
        elif line.startswith("BODY:"):
            in_body = True
            first = line.removeprefix("BODY:").strip()
            if first:
                body_lines.append(first)
        elif in_body:
            body_lines.append(line)
    return {"subject": subject, "body": "\n".join(body_lines).strip()}


def check_replies(gmail_config: dict, conn) -> list[dict]:
    """Check Gmail IMAP for new replies. Returns list of reply dicts."""
    from shared.db import get_contacted_emails, insert_reply, reply_already_seen
    new_replies = []
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(gmail_config["sender_email"], gmail_config["app_password"])
        mail.select("INBOX")
        _, msg_ids = mail.search(None, "UNSEEN")
        contacted = get_contacted_emails(conn)
        for uid in (msg_ids[0].split() if msg_ids[0] else []):
            uid_str = uid.decode()
            if reply_already_seen(conn, uid_str):
                continue
            _, data = mail.fetch(uid, "(RFC822)")
            msg = email_lib.message_from_bytes(data[0][1])
            from_raw = msg.get("From", "")
            from_email = re.search(r"[\w.+-]+@[\w.-]+", from_raw)
            from_email = from_email.group(0).lower() if from_email else ""
            if from_email not in contacted:
                continue
            subject_parts = decode_header(msg.get("Subject", ""))
            subject = "".join(
                p.decode(enc or "utf-8") if isinstance(p, bytes) else p
                for p, enc in subject_parts
            )
            body = ""
            if msg.is_multipart():
                for part in msg.walk():
                    if part.get_content_type() == "text/plain":
                        body = part.get_payload(decode=True).decode("utf-8", errors="replace")
                        break
            else:
                body = msg.get_payload(decode=True).decode("utf-8", errors="replace")
            lead = contacted[from_email]
            insert_reply(conn, {
                "lead_id": lead["id"], "received_at": msg.get("Date"),
                "from_email": from_email, "subject": subject,
                "body": body[:2000], "gmail_uid": uid_str, "notified": 0,
            })
            new_replies.append({"business_name": lead["business_name"], "subject": subject})
        mail.logout()
    except Exception as e:
        logger.error("Reply check failed: %s", e)
    return new_replies
