"""Dynamica bulk trade-in API client (Konimbo sheets JSON)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

import certifi
import httpx

from app.database import bulk_replace_company_prices, get_company_by_slug
from app.services.normalizer import normalize_device_name

DYNAMICA_TRADE_IN_URL = "https://www.dynamica.co.il/pages/47738-tradein"
DYNAMICA_API_URL = "https://sheets-api.konimbo.co.il/v1/trade-in-dynamica-b2OsUy/tradeinRe"
DYNAMICA_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
ALLOWED_BRANDS = {"Apple", "Samsung"}
GRADE_FIELDS = {
    "likeNew": "a",
    "likeNew2": "b",
    "looksGood": "c",
    "faulty": "d",
}


def _dynamica_headers() -> dict[str, str]:
    return {
        "User-Agent": DYNAMICA_USER_AGENT,
        "Accept": "*/*",
        "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
        "Origin": "https://www.dynamica.co.il",
        "Referer": "https://www.dynamica.co.il/",
    }


def extract_dynamica_rows(data: Any) -> list[dict[str, Any]]:
    """Return the device list from the wrapped catalog or a raw array."""
    if isinstance(data, list):
        return [row for row in data if isinstance(row, dict)]
    if isinstance(data, dict):
        rows = data.get("tradeinRe")
        if isinstance(rows, list):
            return [row for row in rows if isinstance(row, dict)]
    return []


def normalize_dynamica_storage(storage: str) -> str:
    """Map catalog tokens like 1T/2T to 1TB/2TB; leave 64GB as-is."""
    s = (storage or "").strip().upper().replace(" ", "")
    if s.endswith("T") and not s.endswith("TB") and not s.endswith("GB"):
        return f"{s}B"
    return s


def parse_dynamica_prices(data: Any) -> list[dict[str, Any]]:
    """Parse Dynamica JSON into price records using likeNew/likeNew2/looksGood/faulty."""
    records: dict[tuple[str, str], dict] = {}

    for entry in extract_dynamica_rows(data):
        brand = str(entry.get("brand") or "").strip()
        if brand not in ALLOWED_BRANDS:
            continue
        model = str(entry.get("model") or "").strip()
        storage = normalize_dynamica_storage(str(entry.get("storage") or ""))
        if not model or not storage:
            continue
        row_id = int(entry.get("id") or 0)
        raw_name = f"{model} {storage}"
        norm = normalize_device_name(raw_name, manufacturer=brand)
        if not norm:
            continue
        for field, grade_key in GRADE_FIELDS.items():
            value = entry.get(field)
            if value is None:
                continue
            try:
                price = int(value)
            except (TypeError, ValueError):
                continue
            dedup_key = (norm.normalized_name, grade_key)
            existing = records.get(dedup_key)
            if existing and existing["row_id"] >= row_id:
                continue
            records[dedup_key] = {
                "raw_device_name": raw_name,
                "normalized_name": norm.normalized_name,
                "brand": norm.brand,
                "model": norm.model,
                "storage_gb": norm.storage_gb,
                "grade": grade_key,
                "price": price,
                "row_id": row_id,
            }
    return list(records.values())


async def fetch_dynamica_raw() -> Any:
    async with httpx.AsyncClient(
        timeout=60.0,
        follow_redirects=True,
        verify=certifi.where(),
    ) as client:
        try:
            response = await client.get(DYNAMICA_API_URL, headers=_dynamica_headers())
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPError as exc:
            raise RuntimeError(f"Dynamica fetch failed: {exc}") from exc

    if not extract_dynamica_rows(data):
        raise RuntimeError("Dynamica response missing tradeinRe catalog data")
    return data


async def run_dynamica_scrape(job_id: Optional[UUID] = None) -> int:
    company = get_company_by_slug("dynamica")
    if not company:
        raise RuntimeError("Dynamica company not found in database")
    data = await fetch_dynamica_raw()
    records = parse_dynamica_prices(data)
    if not records:
        raise RuntimeError("Dynamica catalog parsed but no Apple/Samsung price records found")
    now = datetime.now(timezone.utc)
    bulk_replace_company_prices(
        company["id"],
        records,
        scraped_at=now,
        job_id=job_id,
    )
    return len(records)
