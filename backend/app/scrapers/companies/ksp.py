"""KSP bulk API client."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

import httpx

from app.database import bulk_replace_company_prices, get_company_by_slug
from app.services.normalizer import normalize_device_name

KSP_TRADE_IN_URL = "https://ksp.co.il/kspTradeIn/"
KSP_API_URL = "https://ksp.co.il/kspTradeIn/server/actions.php?action=get-new-data"
KSP_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
ALLOWED_MANUFACTURERS = {"Apple", "Samsung"}
GRADE_API_KEYS = ["A", "B", "C", "D"]
GRADE_TO_KEY = {"A": "a", "B": "b", "C": "c", "D": "d"}


def _ksp_page_headers() -> dict[str, str]:
    return {
        "User-Agent": KSP_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
    }


def _ksp_api_headers() -> dict[str, str]:
    """Headers matching KSP trade-in XHR; blocks curl/python default UAs without Referer."""
    return {
        "User-Agent": KSP_USER_AGENT,
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
        "Content-Type": "application/json",
        "Origin": "https://ksp.co.il",
        "Referer": KSP_TRADE_IN_URL,
        "X-Requested-With": "XMLHttpRequest",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
    }


async def fetch_ksp_raw() -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        # Warm session like the browser page load before the XHR.
        page = await client.get(KSP_TRADE_IN_URL, headers=_ksp_page_headers())
        page.raise_for_status()

        response = await client.post(KSP_API_URL, json={}, headers=_ksp_api_headers())
        response.raise_for_status()
        data = response.json()

    if not data.get("status"):
        raise RuntimeError(data.get("error_msg") or "KSP API returned status=false")
    return data


def parse_ksp_prices(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Parse KSP JSON into price records using prices.*.full."""
    phones = data.get("data", {}).get("Phones", {})
    records: dict[tuple[str, str, str], dict] = {}

    for manufacturer, models in phones.items():
        if manufacturer not in ALLOWED_MANUFACTURERS:
            continue
        for model_name, storages in models.items():
            for storage_key, entries in storages.items():
                if not isinstance(entries, list):
                    continue
                for entry in entries:
                    row_id = int(entry.get("price_row_id") or entry.get("row_id") or 0)
                    raw_name = f"{entry.get('Model') or model_name} {entry.get('Storage') or storage_key}"
                    norm = normalize_device_name(raw_name, manufacturer=manufacturer)
                    if not norm:
                        continue
                    prices = entry.get("prices") or {}
                    for api_grade in GRADE_API_KEYS:
                        grade_data = prices.get(api_grade) or {}
                        full = grade_data.get("full")
                        if full is None:
                            continue
                        price = int(full)
                        grade_key = GRADE_TO_KEY[api_grade]
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


async def run_ksp_scrape(job_id: Optional[UUID] = None) -> int:
    company = get_company_by_slug("ksp")
    if not company:
        raise RuntimeError("KSP company not found in database")
    data = await fetch_ksp_raw()
    records = parse_ksp_prices(data)
    now = datetime.now(timezone.utc)
    bulk_replace_company_prices(
        company["id"],
        records,
        scraped_at=now,
        job_id=job_id,
    )
    return len(records)
