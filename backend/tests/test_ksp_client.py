"""Tests for KSP API response parsing."""

from app.scrapers.companies.ksp import (
    KSP_API_URL,
    _ksp_api_headers,
    build_scraper_api_job_payload,
    parse_ksp_prices,
    resolve_ksp_proxy,
)

SAMPLE = {
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


def test_ksp_iphone_11_128gb_full_prices():
    records = parse_ksp_prices(SAMPLE)
    by_grade = {r["grade"]: r for r in records if r["normalized_name"] == "iPhone 11 128GB"}
    assert by_grade["a"]["price"] == 461
    assert by_grade["b"]["price"] == 412
    assert by_grade["c"]["price"] == 159
    assert by_grade["d"]["price"] == 159


def test_ksp_uses_full_not_clean():
    records = parse_ksp_prices(SAMPLE)
    for r in records:
        assert r["price"] != 407


def test_ksp_api_headers_mimic_browser():
    headers = _ksp_api_headers()
    assert "Mozilla" in headers["User-Agent"]
    assert headers["Referer"].startswith("https://ksp.co.il/kspTradeIn")
    assert headers["Origin"] == "https://ksp.co.il"
    assert headers["X-Requested-With"] == "XMLHttpRequest"


def test_resolve_ksp_proxy_explicit():
    proxy = resolve_ksp_proxy(https_proxy="http://user:pass@proxy.example:8080")
    assert proxy == "http://user:pass@proxy.example:8080"


def test_resolve_ksp_proxy_none_without_config():
    assert resolve_ksp_proxy() is None


def test_build_scraper_api_job_payload():
    payload = build_scraper_api_job_payload("my-key")
    assert payload["apiKey"] == "my-key"
    assert payload["url"] == KSP_API_URL
    assert payload["method"] == "POST"
    assert payload["body"] == "{}"
    assert payload["apiParams"]["country_code"] == "il"
    assert payload["apiParams"]["keep_headers"] is True
    assert payload["headers"]["Origin"] == "https://ksp.co.il"
