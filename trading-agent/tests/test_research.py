import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'scripts'))

from unittest.mock import patch, MagicMock
import pytest
from research import calculate_ma, get_bars, get_news


def test_calculate_ma_20_day():
    # Last 20 of 60 values (41-60), average = (41+60)/2 = 50.5
    bars = {"bars": [{"c": float(i)} for i in range(1, 61)]}
    assert calculate_ma(bars, 20) == 50.5


def test_calculate_ma_50_day():
    # Last 50 of 60 values (11-60), average = (11+60)/2 = 35.5
    bars = {"bars": [{"c": float(i)} for i in range(1, 61)]}
    assert calculate_ma(bars, 50) == 35.5


def test_calculate_ma_insufficient_data():
    bars = {"bars": [{"c": 100.0} for _ in range(10)]}
    assert calculate_ma(bars, 20) is None


def test_calculate_ma_exact_period():
    bars = {"bars": [{"c": 10.0} for _ in range(20)]}
    assert calculate_ma(bars, 20) == 10.0


def test_get_bars_returns_data():
    mock_response = MagicMock()
    mock_response.json.return_value = {"bars": [{"c": 100.0, "o": 99.0}]}
    with patch("requests.get", return_value=mock_response):
        result = get_bars("AAPL")
    assert "bars" in result


def test_get_news_returns_data():
    mock_response = MagicMock()
    mock_response.json.return_value = {"news": [{"headline": "Test headline"}]}
    with patch("requests.get", return_value=mock_response):
        result = get_news("AAPL")
    assert "news" in result
