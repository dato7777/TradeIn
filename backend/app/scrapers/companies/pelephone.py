"""Pelephone trade-in data: HTML parser, catalog extraction, and TradeSearch API."""

from __future__ import annotations

import json
import re
from typing import Any, Optional

import httpx
from bs4 import BeautifulSoup

from app.services.normalizer import normalize_device_name

TRADE_IN_URL = "https://www.pelephone.co.il/ds/heb/eshop/trade-in/"
TRADE_SEARCH_URL = (
    "https://www.pelephone.co.il/ds/RepairServicesApi/TradeSearch/"
    "?boneId=11812&nsId=6&ObjId=11774&lcId=1037"
)
ALLOWED_MANUFACTURERS = frozenset({"Apple", "Samsung"})

DEVICE_TRADE_RE = re.compile(r"datasource\['deviceTrade'\]=(\{.+?\});", re.DOTALL)

VAT_INCLUDED = "כולל מע"
GRADE_MAP = {
    "תקין": "a",
    "תקין חלקית": "b",
    "תקול": "c",
}
GRADE_API_FIELDS: dict[str, tuple[str, str]] = {
    "a": ("discountAmountVat", "תקין"),
    "b": ("partialDiscountAmountVat", "תקין חלקית"),
    "c": ("reducedDiscountAmountVat", "תקול"),
}


def parse_device_trade_catalog(html: str) -> dict[str, Any]:
    """Extract embedded deviceTrade JSON from the trade-in page HTML."""
    match = DEVICE_TRADE_RE.search(html)
    if not match:
        raise RuntimeError("Pelephone deviceTrade catalog not found in trade-in page HTML")
    return json.loads(match.group(1))


def iter_catalog_variants(catalog: dict[str, Any]):
    """Yield (manufacturer, variant dict) for Apple/Samsung device variants."""
    for device_type in catalog.get("types") or []:
        if device_type.get("type") != "Devices":
            continue
        for group in device_type.get("models") or []:
            manufacturer = group.get("manufacturerName")
            if manufacturer not in ALLOWED_MANUFACTURERS:
                continue
            for item in group.get("models") or []:
                if item.get("name") and item.get("modelCode"):
                    yield manufacturer, item


def dedupe_catalog_devices(catalog: dict[str, Any]) -> list[dict[str, Any]]:
    """One entry per normalized device name (skips duplicate color variants)."""
    seen: dict[str, dict[str, Any]] = {}
    for manufacturer, item in iter_catalog_variants(catalog):
        norm = normalize_device_name(item["name"], manufacturer=manufacturer)
        if not norm:
            continue
        if norm.normalized_name in seen:
            continue
        seen[norm.normalized_name] = {
            "raw_device_name": item["name"],
            "normalized_name": norm.normalized_name,
            "brand": norm.brand,
            "model": norm.model,
            "storage_gb": norm.storage_gb,
            "model_code": item["modelCode"],
        }
    return list(seen.values())


def parse_trade_search_prices(
    payload: dict[str, Any],
    device: dict[str, Any],
) -> list[dict[str, Any]]:
    """Convert TradeSearch API JSON into price records (VAT-included prices)."""
    records: list[dict[str, Any]] = []
    for grade_key, (field, grade_label) in GRADE_API_FIELDS.items():
        raw_value = payload.get(field)
        if raw_value is None or str(raw_value).strip() == "":
            continue
        price = int(float(str(raw_value).replace(",", "")))
        records.append(
            {
                "raw_device_name": device["raw_device_name"],
                "normalized_name": device["normalized_name"],
                "brand": device["brand"],
                "model": device["model"],
                "storage_gb": device["storage_gb"],
                "grade": grade_key,
                "grade_label": grade_label,
                "price": price,
            }
        )
    return records


async def fetch_trade_in_catalog(client: httpx.AsyncClient) -> dict[str, Any]:
    response = await client.get(TRADE_IN_URL, timeout=60.0)
    response.raise_for_status()
    return parse_device_trade_catalog(response.text)


async def fetch_trade_search_prices(
    client: httpx.AsyncClient,
    *,
    model_code: str,
    control_id: int,
    device: dict[str, Any],
) -> list[dict[str, Any]]:
    response = await client.post(
        TRADE_SEARCH_URL,
        json={"model": model_code, "controlId": control_id},
        headers={"Content-Type": "application/json;charset=UTF-8"},
        timeout=30.0,
    )
    response.raise_for_status()
    return parse_trade_search_prices(response.json(), device)


def parse_pelephone_html(html: str) -> list[dict[str, Any]]:
    """Parse Pelephone trade-in result HTML into price records."""
    soup = BeautifulSoup(html, "lxml")
    records: list[dict[str, Any]] = []

    for block in soup.select("div.content.price"):
        title_div = block.find("div", recursive=False)
        if not title_div:
            continue
        grade_span = title_div.find("span", class_="blue")
        device_span = title_div.find("span", class_="br_mob")
        if not grade_span or not device_span:
            continue
        grade_label = grade_span.get_text(strip=True)
        grade_key = GRADE_MAP.get(grade_label)
        if not grade_key:
            continue
        raw_device = device_span.get_text(strip=True)
        price = _extract_vat_included_price(block)
        if price is None:
            continue
        norm = normalize_device_name(raw_device)
        if not norm:
            continue
        records.append(
            {
                "raw_device_name": raw_device,
                "normalized_name": norm.normalized_name,
                "brand": norm.brand,
                "model": norm.model,
                "storage_gb": norm.storage_gb,
                "grade": grade_key,
                "grade_label": grade_label,
                "price": price,
            }
        )
    return records


def _extract_vat_included_price(block) -> Optional[int]:
    for discount in block.select("div.discount"):
        vat_span = discount.find("span", class_="vat")
        if not vat_span or VAT_INCLUDED not in vat_span.get_text():
            continue
        blue = discount.find("span", class_="blue")
        if not blue:
            continue
        text = blue.get_text(strip=True)
        match = re.search(r"[\d.]+", text.replace(",", ""))
        if match:
            return int(float(match.group()))
    return None
