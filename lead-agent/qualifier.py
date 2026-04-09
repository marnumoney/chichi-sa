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
