"""Tests for KSP API response parsing."""

from app.scrapers.companies.ksp import (
    KSP_API_URL,
    _ksp_api_headers,
    build_scraper_api_job_payload,
    extract_ksp_catalog,
    parse_ksp_prices,
    resolve_ksp_proxy,
)

SAMPLE_CATALOG = {
    "catalog": {
        "Apple": {
            "iPhone 11 (2019)": {
                "128 GB": [
                    {
                        "row_id": 1,
                        "price_row_id": 2,
                        "supplier_id": 2,
                        "Model": "iPhone 11 (2019)",
                        "Storage": "128 GB",
                        "Manufacturer": "Apple",
                        "prices": {
                            "A": {"full": 391, "clean_price": 407},
                            "B": {"full": 349, "clean_price": 364},
                            "C": {"full": 134, "clean_price": 140},
                            "D": {"full": 134, "clean_price": 140},
                        },
                    }
                ]
            }
        },
        "Google": {
            "Pixel 8": {
                "128 GB": [
                    {
                        "price_row_id": 999,
                        "Model": "Pixel 8",
                        "Storage": "128 GB",
                        "prices": {"A": {"full": 100}},
                    }
                ]
            }
        },
    }
}

SAMPLE_LEGACY = {
    "status": True,
    "data": {
        "Phones": {
            "Apple": {
                "iPhone 11 (2019)": {
                    "128 GB": [
                        {
                            "price_row_id": "1",
                            "Model": "iPhone 11 (2019)",
                            "Storage": "128 GB",
                            "Manufacturer": "Apple",
                            "prices": {
                                "A": {"full": 461, "clean_price": "407"},
                                "B": {"full": 412, "clean_price": "364"},
                                "C": {"full": 159, "clean_price": "140"},
                                "D": {"full": 159, "clean_price": "140"},
                            },
                        }
                    ]
                }
            }
        }
    },
}


def test_extract_ksp_catalog_current():
    catalog = extract_ksp_catalog(SAMPLE_CATALOG)
    assert "Apple" in catalog
    assert "Google" in catalog


def test_extract_ksp_catalog_legacy():
    catalog = extract_ksp_catalog(SAMPLE_LEGACY)
    assert "Apple" in catalog
    assert catalog.get("Apple") is not None


def test_ksp_iphone_11_128gb_full_prices_catalog():
    records = parse_ksp_prices(SAMPLE_CATALOG)
    by_grade = {r["grade"]: r for r in records if r["normalized_name"] == "iPhone 11 128GB"}
    assert by_grade["a"]["price"] == 391
    assert by_grade["b"]["price"] == 349
    assert by_grade["c"]["price"] == 134
    assert by_grade["d"]["price"] == 134


def test_ksp_ignores_non_allowed_manufacturers():
    records = parse_ksp_prices(SAMPLE_CATALOG)
    assert all(r["brand"] in ("apple", "samsung") for r in records)
    assert not any("Pixel" in r["normalized_name"] for r in records)


def test_ksp_uses_full_not_clean():
    records = parse_ksp_prices(SAMPLE_CATALOG)
    for r in records:
        assert r["price"] != 407


def test_ksp_legacy_format_still_parses():
    records = parse_ksp_prices(SAMPLE_LEGACY)
    by_grade = {r["grade"]: r for r in records if r["normalized_name"] == "iPhone 11 128GB"}
    assert by_grade["a"]["price"] == 461


def test_ksp_api_headers_mimic_browser():
    headers = _ksp_api_headers()
    assert "Mozilla" in headers["User-Agent"]
    assert headers["Referer"].startswith("https://ksp.co.il/kspTradeIn")
    assert headers["Origin"] == "https://ksp.co.il"
    assert "Content-Type" not in headers


def test_resolve_ksp_proxy_explicit():
    proxy = resolve_ksp_proxy(https_proxy="http://user:pass@proxy.example:8080")
    assert proxy == "http://user:pass@proxy.example:8080"


def test_resolve_ksp_proxy_none_without_config():
    assert resolve_ksp_proxy() is None


def test_build_scraper_api_job_payload():
    payload = build_scraper_api_job_payload("my-key")
    assert payload["apiKey"] == "my-key"
    assert payload["url"] == KSP_API_URL
    assert payload["method"] == "GET"
    assert "body" not in payload
    assert payload["apiParams"]["country_code"] == "il"
    assert payload["apiParams"]["keep_headers"] is True
    assert payload["headers"]["Origin"] == "https://ksp.co.il"
