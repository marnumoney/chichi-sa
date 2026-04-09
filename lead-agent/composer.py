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
    body_lines: list[str] = []
    in_body = False
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
        logger.warning(
            "Malformed Claude response for %s — subject=%r body_len=%d raw=%r",
            lead["business_name"], subject, len(body), raw[:200],
        )
        raise ValueError(f"Claude returned malformed email for {lead['business_name']!r}: subject={subject!r}, body empty={not body}")
    logger.info("Composed email for %s — subject: %s", lead["business_name"], subject)
    return {"subject": subject, "body": body}
