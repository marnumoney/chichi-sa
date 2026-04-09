import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import pytest
from db import init_db, insert_lead
from qualifier import qualify
from datetime import date


@pytest.fixture
def conn():
    c = init_db(":memory:")
    yield c
    c.close()


CONFIG = {"min_rating": 4.0, "min_reviews": 10}


def make_place(**overrides):
    base = {
        "place_id": "p1",
        "business_name": "Good Biz",
        "industry": "plumber",
        "city": "Durban",
        "phone": "0311112222",
        "email": "good@biz.com",
        "rating": 4.5,
        "review_count": 25,
        "website": None,
        "found_date": str(date.today()),
    }
    base.update(overrides)
    return base


def test_qualifies_valid_business(conn):
    places = [make_place()]
    result = qualify(places, conn, CONFIG)
    assert len(result) == 1
    assert result[0]["business_name"] == "Good Biz"


def test_rejects_business_with_website(conn):
    places = [make_place(website="https://example.com")]
    result = qualify(places, conn, CONFIG)
    assert result == []


def test_rejects_low_rating(conn):
    places = [make_place(rating=3.9)]
    result = qualify(places, conn, CONFIG)
    assert result == []


def test_rejects_too_few_reviews(conn):
    places = [make_place(review_count=5)]
    result = qualify(places, conn, CONFIG)
    assert result == []


def test_rejects_already_in_db(conn):
    lead = make_place()
    insert_lead(conn, lead)
    places = [make_place()]
    result = qualify(places, conn, CONFIG)
    assert result == []


def test_filters_mixed_list(conn):
    places = [
        make_place(place_id="good1", business_name="Good One"),
        make_place(place_id="has_web", website="https://site.com"),
        make_place(place_id="low_rating", rating=2.0),
        make_place(place_id="few_reviews", review_count=3),
    ]
    result = qualify(places, conn, CONFIG)
    assert len(result) == 1
    assert result[0]["place_id"] == "good1"


def test_website_field_stripped_from_output(conn):
    places = [make_place()]
    result = qualify(places, conn, CONFIG)
    assert "website" not in result[0]
