"""Pelephone scraper — HTTP catalog + TradeSearch API (no Playwright)."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Callable, Optional
from uuid import UUID

import httpx

from app.database import bulk_replace_company_prices, get_company_by_slug
from app.scrapers.companies.pelephone import (
    dedupe_catalog_devices,
    fetch_trade_in_catalog,
    fetch_trade_search_prices,
)

MAX_CONCURRENT_REQUESTS = 8


async def run_pelephone_scrape(
    job_id: Optional[UUID] = None,
    progress_callback: Optional[Callable[[int, int], None]] = None,
    max_devices: Optional[int] = None,
) -> int:
    """
    Scrape Pelephone trade-in prices via embedded catalog + RepairServicesApi/TradeSearch.
    One catalog GET, then one JSON POST per unique normalized device (colors deduped).
    """
    company = get_company_by_slug("pelephone")
    if not company:
        raise RuntimeError("Pelephone company not found")

    now = datetime.now(timezone.utc)
    all_records: dict[tuple[str, str], dict] = {}

    async with httpx.AsyncClient(follow_redirects=True) as client:
        catalog = await fetch_trade_in_catalog(client)
        control_id = int(catalog["controlId"])
        devices = dedupe_catalog_devices(catalog)
        if max_devices:
            devices = devices[:max_devices]

        total = len(devices) or 1
        if progress_callback:
            progress_callback(0, total)

        semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
        completed = 0
        lock = asyncio.Lock()

        async def scrape_device(device: dict) -> list[dict]:
            nonlocal completed
            async with semaphore:
                try:
                    records = await fetch_trade_search_prices(
                        client,
                        model_code=device["model_code"],
                        control_id=control_id,
                        device=device,
                    )
                except httpx.HTTPError:
                    records = []
                async with lock:
                    completed += 1
                    if progress_callback:
                        progress_callback(completed, total)
                return records

        batches = await asyncio.gather(*(scrape_device(d) for d in devices))
        for records in batches:
            for rec in records:
                key = (rec["normalized_name"], rec["grade"])
                all_records[key] = rec

    records_list = list(all_records.values())
    if not records_list:
        raise RuntimeError(
            "No Pelephone prices fetched. The TradeSearch API or catalog format may have changed."
        )

    bulk_replace_company_prices(
        company["id"],
        records_list,
        scraped_at=now,
        job_id=job_id,
    )
    return len(records_list)
