import sqlite3
from db import lead_exists


def qualify(places: list[dict], conn: sqlite3.Connection, config: dict) -> list[dict]:
    """Filter raw place dicts to only qualified leads. Returns lead dicts (no 'website' key)."""
    min_rating = config.get("min_rating", 4.0)
    min_reviews = config.get("min_reviews", 10)
    qualified = []
    for place in places:
        if not place.get("place_id"):
            continue
        if place.get("website"):
            continue
        if (place.get("rating") or 0) < min_rating:
            continue
        if (place.get("review_count") or 0) < min_reviews:
            continue
        if lead_exists(conn, place.get("place_id")):
            continue
        lead = {k: v for k, v in place.items() if k != "website"}
        qualified.append(lead)
    return qualified
