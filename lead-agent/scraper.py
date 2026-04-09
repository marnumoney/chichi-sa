import time
import logging
import googlemaps
from datetime import date

logger = logging.getLogger(__name__)


def scrape_businesses(config: dict) -> list[dict]:
    """Search Google Places for businesses in SA cities and return place dicts.

    Each returned dict has keys: place_id, business_name, industry, city,
    phone, email, rating, review_count, website, found_date.
    email is always None (Google Places does not return email addresses).
    """
    api_key = config.get("api_key")
    if not api_key:
        raise ValueError("google_places config missing 'api_key'")
    industries = config.get("industries", [])
    cities = config.get("cities", [])
    if not industries or not cities:
        raise ValueError("google_places config missing 'industries' or 'cities'")

    client = googlemaps.Client(key=api_key)
    delay = float(config.get("request_delay_seconds", 0.5))
    seen_ids: set[str] = set()
    results: list[dict] = []
    found_date = str(date.today())

    for industry in industries:
        for city in cities:
            query = f"{industry} in {city}, South Africa"
            logger.info("Searching: %s", query)
            page_token = None
            while True:
                try:
                    if page_token:
                        search = client.places(query=query, page_token=page_token)
                    else:
                        search = client.places(query=query)
                    time.sleep(delay)
                except Exception as e:
                    logger.error("Error in text search for '%s': %s", query, e)
                    break

                for item in search.get("results", []):
                    place_id = item.get("place_id")
                    if not place_id or place_id in seen_ids:
                        continue
                    seen_ids.add(place_id)
                    try:
                        details = client.place(
                            place_id=place_id,
                            fields=["place_id", "name", "rating", "user_ratings_total",
                                    "formatted_phone_number", "website", "vicinity"],
                        )
                        time.sleep(delay)
                        result = details.get("result", {})
                        results.append({
                            "place_id": result.get("place_id", place_id),
                            "business_name": result.get("name", item.get("name", "")),
                            "industry": industry,
                            "city": city,
                            "phone": result.get("formatted_phone_number"),
                            "email": None,
                            "rating": result.get("rating"),
                            "review_count": result.get("user_ratings_total"),
                            "website": result.get("website"),
                            "found_date": found_date,
                        })
                    except Exception as e:
                        logger.error("Error fetching details for place_id %s: %s", place_id, e)

                page_token = search.get("next_page_token")
                if not page_token:
                    break
                # Google requires a short wait before next_page_token is usable
                time.sleep(2)

    return results
