"""Tests for KSP API response parsing."""

from app.scrapers.companies.ksp import parse_ksp_prices

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
