import logging
logger = logging.getLogger(__name__)


def compose_checkin_email(client, model: str, client_data: dict, agency: dict) -> dict:
    prompt = f"""Write a warm client check-in email from {agency['name']}.
Client: {client_data['name']} (joined: {client_data.get('joined_at', 'unknown')})
Notes: {client_data.get('notes', 'none')}
Tone: {agency['tone']}. Keep under 150 words. Ask if they need any updates or new work.
CTA: reply to this email.
Format: SUBJECT: <subject>\\nBODY: <body>"""
    resp = client.messages.create(model=model, max_tokens=400,
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
