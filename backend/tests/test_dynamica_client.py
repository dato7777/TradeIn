"""Tests for Dynamica API response parsing."""

from app.scrapers.companies.dynamica import (
    DYNAMICA_API_URL,
    extract_dynamica_rows,
    normalize_dynamica_storage,
    parse_dynamica_prices,
)

SAMPLE_CATALOG = {
    "tradeinRe": [
        {
            "id": 2,
            "brand": "Apple",
            "model": "iPhone 11",
            "storage": "64GB",
            "topUp": None,
            "likeNew": 347,
            "likeNew2": 169,
            "looksGood": 85,
            "faulty": 51,
        },
        {
            "id": 20,
            "brand": "Apple",
            "model": "iPhone 12 Pro Max",
            "storage": "1T",
            "topUp": None,
            "likeNew": 763,
            "likeNew2": 492,
            "looksGood": 297,
            "faulty": 127,
        },
        {
            "id": 56,
            "brand": "Apple",
            "model": "iPhone16e",
            "storage": "128GB",
            "topUp": None,
            "likeNew": 839,
            "likeNew2": 678,
            "looksGood": 339,
            "faulty": 127,
        },
        {
            "id": 94,
            "brand": "Samsung",
            "model": "Samsung Galaxy A55",
            "storage": "128GB",
            "topUp": 1,
            "likeNew": 314,
            "likeNew2": 254,
            "looksGood": 127,
            "faulty": 42,
        },
        {
            "id": 100,
            "brand": "Samsung",
            "model": "Samsung Galaxy A55",
            "storage": "128GB",
            "topUp": 1,
            "likeNew": 314,
            "likeNew2": 254,
            "looksGood": 127,
            "faulty": 28,
        },
        {
            "id": 999,
            "brand": "Google",
            "model": "Pixel 8",
            "storage": "128GB",
            "topUp": None,
            "likeNew": 100,
            "likeNew2": 80,
            "looksGood": 50,
            "faulty": 20,
        },
    ]
}


def test_extract_wrapped_catalog():
    rows = extract_dynamica_rows(SAMPLE_CATALOG)
    assert len(rows) == 6
    assert rows[0]["model"] == "iPhone 11"


def test_extract_raw_list():
    rows = extract_dynamica_rows(SAMPLE_CATALOG["tradeinRe"])
    assert len(rows) == 6


def test_normalize_storage_tb_shorthand():
    assert normalize_dynamica_storage("1T") == "1TB"
    assert normalize_dynamica_storage("2T") == "2TB"
    assert normalize_dynamica_storage("64GB") == "64GB"
    assert normalize_dynamica_storage("1TB") == "1TB"


def test_parse_iphone_11_grades():
    records = parse_dynamica_prices(SAMPLE_CATALOG)
    by_grade = {r["grade"]: r for r in records if r["normalized_name"] == "iPhone 11 64GB"}
    assert by_grade["a"]["price"] == 347
    assert by_grade["b"]["price"] == 169
    assert by_grade["c"]["price"] == 85
    assert by_grade["d"]["price"] == 51


def test_parse_1t_storage_and_iphone16e():
    records = parse_dynamica_prices(SAMPLE_CATALOG)
    names = {r["normalized_name"] for r in records}
    assert "iPhone 12 Pro Max 1TB" in names
    assert "iPhone 16e 128GB" in names


def test_ignores_non_allowed_brands_and_topup():
    records = parse_dynamica_prices(SAMPLE_CATALOG)
    assert all(r["brand"] in ("apple", "samsung") for r in records)
    assert not any("Pixel" in r["normalized_name"] for r in records)
    assert all(r["grade"] in ("a", "b", "c", "d") for r in records)


def test_duplicate_keeps_later_id():
    records = parse_dynamica_prices(SAMPLE_CATALOG)
    a55 = {r["grade"]: r for r in records if r["normalized_name"] == "Samsung Galaxy A55 128GB"}
    assert a55["d"]["price"] == 28
    assert a55["d"]["row_id"] == 100


def test_api_url_is_public_get():
    assert DYNAMICA_API_URL.endswith("/tradeinRe")
    assert "sheets-api.konimbo.co.il" in DYNAMICA_API_URL
