"""Tests for device name normalizer."""

import pytest

from app.services.normalizer import normalize_device_name


@pytest.mark.parametrize(
    "raw,manufacturer,expected",
    [
        ("iPhone 11 128GB", None, "iPhone 11 128GB"),
        ("iPhone 11 64", None, "iPhone 11 64GB"),
        ("iPhone 11 (2019) 128 GB", "Apple", "iPhone 11 128GB"),
        ("A72 256 GB", "Samsung", "Samsung Galaxy A72 256GB"),
        (
            "בהחזרת מכשיר תקין חלקית  iPhone 15 Pro 512GB Black Titanium",
            None,
            "iPhone 15 Pro 512GB",
        ),
        (
            "iPhone 14 Plus 128GB Starlight",
            None,
            "iPhone 14 Plus 128GB",
        ),
        ("Samsung Galaxy A07 Light Violet 128GB", "Samsung", "Samsung Galaxy A07 128GB"),
        ("Samsung Galaxy A31 Black נתיב 128GB", "Samsung", "Samsung Galaxy A31 128GB"),
        ("Samsung Galaxy Note 10 Plus Silver P 256GB", "Samsung", "Samsung Galaxy Note 10 Plus 256GB"),
        ("Samsung Galaxy S24 Ultra 5G 256GB", "Samsung", "Samsung Galaxy S24 Ultra 256GB"),
        ("Samsung Galaxy A52 (2021) 128GB", "Samsung", "Samsung Galaxy A52 128GB"),
        ("Samsung Galaxy S22 Ultra Burgundy 256GB", "Samsung", "Samsung Galaxy S22 Ultra 256GB"),
        ("Samsung Galaxy S23 FE Graphith 128GB", "Samsung", "Samsung Galaxy S23 FE 128GB"),
        ("Samsung Galaxy S24 Cobalt 256GB", "Samsung", "Samsung Galaxy S24 256GB"),
        ("Samsung Galaxy S24 Plus Marbel 256GB", "Samsung", "Samsung Galaxy S24 Plus 256GB"),
        ("Samsung Galaxy S25 Edge Icyblue 256GB", "Samsung", "Samsung Galaxy S25 Edge 256GB"),
        ("Samsung Galaxy S6 Edge 128GB", "Samsung", "Samsung Galaxy S6 Edge 128GB"),
        ("Samsung Galaxy Flip6 shadow 256GB", "Samsung", "Samsung Galaxy Z Flip 6 256GB"),
        ("Samsung Galaxy Flip7 Jet 256GB", "Samsung", "Samsung Galaxy Z Flip 7 256GB"),
        ("Samsung Galaxy Z Fold 5 256GB", "Samsung", "Samsung Galaxy Z Fold 5 256GB"),
        ("Samsung Galaxy Fold5 256GB", "Samsung", "Samsung Galaxy Z Fold 5 256GB"),
        ("iPhone 12 Pro Pacific 512GB", None, "iPhone 12 Pro 512GB"),
        ("iPhone 16 Plus Ultramarine 512GB", None, "iPhone 16 Plus 512GB"),
        ("iPhone 16 Pro Desert 1TB", None, "iPhone 16 Pro 1TB"),
        ("iPhone 17 Mist 256GB", None, "iPhone 17 256GB"),
        ("iPhone 17e Soft 256GB", None, "iPhone 17e 256GB"),
        ("iPhone 15 128GB 3G", None, "iPhone 15 128GB"),
        ("Samsung Galaxy S21 5G 128GB Demo", "Samsung", "Samsung Galaxy S21 128GB"),
        ("iPhone 14 Sky 128GB", None, "iPhone 14 128GB"),
        ("Samsung Galaxy A54 3rd gen 128GB", "Samsung", "Samsung Galaxy A54 128GB"),
        ("Samsung Galaxy J4 2018 32GB", "Samsung", "Samsung Galaxy J4 32GB"),
        ("Samsung Galaxy A52 2021 128GB", "Samsung", "Samsung Galaxy A52 128GB"),
        ("Samsung Galaxy A30 64GB", "Samsung", "Samsung Galaxy A30 64GB"),
        ("Samsung Galaxy A30s 64GB", "Samsung", "Samsung Galaxy A30s 64GB"),
        ("Samsung Galaxy A52s 128GB", "Samsung", "Samsung Galaxy A52s 128GB"),
        ("iPhone 12 mini 128GB", None, "iPhone 12 mini 128GB"),
        ("iPhone 12 Mini 128GB", None, "iPhone 12 mini 128GB"),
        ("iPhone 13 mini 64GB", None, "iPhone 13 mini 64GB"),
        ("iPhone 13 Mini 64GB", None, "iPhone 13 mini 64GB"),
        ("iPhone 14 Pro Max 256GB", None, "iPhone 14 Pro Max 256GB"),
        ("iPhone 14 pro max 256GB", None, "iPhone 14 Pro Max 256GB"),
    ],
)
def test_normalize(raw, manufacturer, expected):
    result = normalize_device_name(raw, manufacturer=manufacturer)
    assert result is not None
    assert result.normalized_name == expected
