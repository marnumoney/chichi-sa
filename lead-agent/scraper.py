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
