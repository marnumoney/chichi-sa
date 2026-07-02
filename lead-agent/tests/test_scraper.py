import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import pytest
from unittest.mock import MagicMock, patch
from scraper import scrape_businesses


MOCK_SEARCH_RESULT = {
    "results": [
        {"place_id": "abc123", "name": "Joe Plumbing"},
    ]
}

MOCK_DETAILS_WITH_WEBSITE = {
    "result": {
        "place_id": "abc123",
        "name": "Joe Plumbing",
        "rating": 4.5,
        "user_ratings_total": 30,
        "formatted_phone_number": "+1 555 111 2222",
        "website": "https://joeplumbing.com",
        "types": ["plumber"],
        "vicinity": "Austin",
    }
}

MOCK_DETAILS_NO_WEBSITE = {
    "result": {
        "place_id": "abc123",
        "name": "Joe Plumbing",
        "rating": 4.5,
        "user_ratings_total": 30,
        "formatted_phone_number": "+1 555 111 2222",
        "types": ["plumber"],
        "vicinity": "Austin",
    }
}


def make_config():
    return {
        "api_key": "TEST_KEY",
        "min_rating": 4.0,
        "min_reviews": 10,
        "request_delay_seconds": 0,
        "industries": ["plumber"],
        "cities": ["Austin"],
    }


def test_scraper_returns_places(mocker):
    mock_client = MagicMock()
    mocker.patch("scraper.googlemaps.Client", return_value=mock_client)
    mock_client.places.return_value = MOCK_SEARCH_RESULT
    mock_client.place.return_value = MOCK_DETAILS_NO_WEBSITE

    results = scrape_businesses(make_config())
    assert len(results) == 1
    assert results[0]["place_id"] == "abc123"
    assert results[0]["business_name"] == "Joe Plumbing"
    assert results[0]["website"] is None


def test_scraper_includes_website_when_present(mocker):
    mock_client = MagicMock()
    mocker.patch("scraper.googlemaps.Client", return_value=mock_client)
    mock_client.places.return_value = MOCK_SEARCH_RESULT
    mock_client.place.return_value = MOCK_DETAILS_WITH_WEBSITE

    results = scrape_businesses(make_config())
    assert len(results) == 1
    assert results[0]["website"] == "https://joeplumbing.com"


def test_scraper_handles_empty_results(mocker):
    mock_client = MagicMock()
    mocker.patch("scraper.googlemaps.Client", return_value=mock_client)
    mock_client.places.return_value = {"results": []}

    results = scrape_businesses(make_config())
    assert results == []


def test_scraper_deduplicates_place_ids(mocker):
    mock_client = MagicMock()
    mocker.patch("scraper.googlemaps.Client", return_value=mock_client)
    # Same place_id returned for both industry+city combos
    mock_client.places.return_value = MOCK_SEARCH_RESULT
    mock_client.place.return_value = MOCK_DETAILS_NO_WEBSITE

    config = make_config()
    config["cities"] = ["Austin", "New York"]  # two queries, same result
    results = scrape_businesses(config)
    assert len(results) == 1  # deduplicated
