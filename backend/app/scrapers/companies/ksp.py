"""KSP bulk API client."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

import httpx

from app.config import get_settings
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


def resolve_ksp_proxy(https_proxy: str = "", scraper_api_key: str = "") -> str | None:
    """Return outbound proxy URL for KSP when cloud/datacenter IPs are blocked."""
    explicit = https_proxy.strip()
    if explicit:
        return explicit
    api_key = scraper_api_key.strip()
    if api_key:
        return f"http://scraperapi:{api_key}@proxy-server.scraperapi.com:8001"
    return None


def _ksp_api_headers() -> dict[str, str]:
    """Headers matching KSP trade-in XHR."""
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


def _ksp_client_kwargs() -> dict[str, Any]:
    settings = get_settings()
    kwargs: dict[str, Any] = {"timeout": 90.0, "follow_redirects": True}
    proxy = resolve_ksp_proxy(settings.ksp_https_proxy, settings.ksp_scraper_api_key)
    if proxy:
        kwargs["proxy"] = proxy
    return kwargs


def _raise_ksp_http_error(exc: httpx.HTTPStatusError) -> None:
    if exc.response.status_code == 403:
        raise RuntimeError(
            "KSP blocked this server (403). On Render/cloud hosting, set "
            "KSP_SCRAPER_API_KEY (free tier at https://www.scraperapi.com) or "
            "KSP_HTTPS_PROXY to a residential proxy URL."
        ) from exc
    raise exc


async def fetch_ksp_raw() -> dict[str, Any]:
    async with httpx.AsyncClient(**_ksp_client_kwargs()) as client:
        response = await client.post(KSP_API_URL, json={}, headers=_ksp_api_headers())
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            _raise_ksp_http_error(exc)
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
