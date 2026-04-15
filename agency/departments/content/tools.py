import logging
import random
from ddgs import DDGS

logger = logging.getLogger(__name__)

FALLBACK_TOPICS = [
    "Why every South African restaurant needs a website in 2026",
    "5 ways a website helps local tradespeople get more customers",
    "How small businesses in Johannesburg can compete online",
    "Web design trends South African businesses should know about",
    "Why your Google Business profile isn't enough — you need a real website",
]


def find_topic(instruction: str = "") -> str:
    queries = [instruction] if instruction else [
        "South African small business website tips 2026",
        "web design trends South Africa local business 2026",
    ]
    for query in queries:
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=5))
            topics = [f"{r['title']}: {r['body']}" for r in results if r.get("title") and r.get("body")]
            if topics:
                return topics[0]
        except Exception as e:
            logger.warning("DDG search failed: %s", e)
    return random.choice(FALLBACK_TOPICS)


def write_blog_post(topic: str, agency: dict, client, model: str) -> dict:
    prompt = f"""You are a content writer for {agency['name']}, a South African web design agency.
Write a blog post about: "{topic}"
Audience: SA small business owners. Length: 600-900 words. Tone: {agency['tone']}.
Mention {agency['name']} ({agency['website']}) once near the end. End with a CTA to visit the site.
Format EXACTLY: TITLE: [title]\\n\\n[full body]"""
    resp = client.messages.create(model=model, max_tokens=2000,
                                   messages=[{"role": "user", "content": prompt}])
    raw = resp.content[0].text.strip()
    lines = raw.split("\n", 2)
    title, body = "", raw
    if lines[0].startswith("TITLE:"):
        title = lines[0][6:].strip()
        body = "\n".join(lines[1:]).strip()
    return {"title": title, "body": body}
