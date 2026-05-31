"""Tests for Pelephone TradeSearch API parsing."""

from app.scrapers.companies.pelephone import (
    dedupe_catalog_devices,
    parse_trade_search_prices,
)

SAMPLE_CATALOG = {
    "controlId": 20553,
    "types": [
        {
            "type": "Devices",
            "models": [
                {
                    "manufacturerName": "Apple",
                    "models": [
                        {
                            "name": "iPhone 14 Plus 128GB Starlight",
                            "modelCode": "MQ4Y3HX/A",
                            "makatId": "1.1.010.716.01",
                        },
                        {
                            "name": "iPhone 14 Plus 128GB Midnight",
                            "modelCode": "MQ4X3HX/A",
                            "makatId": "1.1.010.715.01",
                        },
                    ],
                },
                {
                    "manufacturerName": "Samsung",
                    "models": [
                        {
                            "name": "Samsung Galaxy A72 256 GB",
                            "modelCode": "SM-A725FZ/A",
                            "makatId": "1.2.001.001.01",
                        },
                    ],
                },
            ],
        }
    ],
}

SAMPLE_TRADE_SEARCH = {
    "discountAmount": "610.2",
    "discountAmountVat": "721",
    "reducedDiscountAmount": "101.7",
    "reducedDiscountAmountVat": "120",
    "partialDiscountAmount": "237.3",
    "partialDiscountAmountVat": "281",
}


def test_dedupe_catalog_devices_by_normalized_name():
    devices = dedupe_catalog_devices(SAMPLE_CATALOG)
    names = {d["normalized_name"] for d in devices}
    assert names == {"iPhone 14 Plus 128GB", "Samsung Galaxy A72 256GB"}
    assert len(devices) == 2


def test_parse_trade_search_prices():
    device = dedupe_catalog_devices(SAMPLE_CATALOG)[0]
    records = parse_trade_search_prices(SAMPLE_TRADE_SEARCH, device)
    by_grade = {r["grade"]: r for r in records}
    assert by_grade["a"]["price"] == 721
    assert by_grade["b"]["price"] == 281
    assert by_grade["c"]["price"] == 120
    assert by_grade["a"]["normalized_name"] == "iPhone 14 Plus 128GB"
