"""Scrape job orchestration."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from app.database import execute, execute_returning, fetch_one, get_company_by_slug
from app.scrapers.companies.ksp import run_ksp_scrape


def create_job(company_slug: str, created_by: Optional[str] = None) -> dict:
    company = get_company_by_slug(company_slug)
    if not company:
        raise ValueError(f"Unknown company: {company_slug}")
    if company["source_type"] != "scraper":
        raise ValueError(f"{company_slug} is not a scraper company")
    return execute_returning(
        """
        INSERT INTO scrape_jobs (company_id, status, created_by, started_at)
        VALUES (%s, 'pending', %s, %s)
        RETURNING *
        """,
        (str(company["id"]), created_by, datetime.now(timezone.utc)),
    )


def update_job(job_id: UUID, **fields) -> None:
    allowed = {"status", "progress_current", "progress_total", "error_message", "started_at", "finished_at"}
    sets = []
    params = []
    for k, v in fields.items():
        if k in allowed:
            sets.append(f"{k} = %s")
            params.append(v)
    if not sets:
        return
    params.append(str(job_id))
    execute(f"UPDATE scrape_jobs SET {', '.join(sets)} WHERE id = %s", tuple(params))


def get_job(job_id: UUID) -> Optional[dict]:
    return fetch_one("SELECT * FROM scrape_jobs WHERE id = %s", (str(job_id),))


async def run_job(job_id: UUID) -> None:
    job = get_job(job_id)
    if not job:
        return
    company = fetch_one("SELECT * FROM companies WHERE id = %s", (str(job["company_id"]),))
    if not company:
        update_job(job_id, status="failed", error_message="Company not found", finished_at=datetime.now(timezone.utc))
        return
    update_job(job_id, status="running", started_at=datetime.now(timezone.utc))
    try:
        slug = company["slug"]
        if slug == "ksp":
            count = await run_ksp_scrape(job_id=job_id)
            update_job(
                job_id,
                status="completed",
                progress_current=count,
                progress_total=count,
                finished_at=datetime.now(timezone.utc),
            )
        elif slug == "pelephone":
            from app.scrapers.companies.pelephone_runner import run_pelephone_scrape

            count = await run_pelephone_scrape(job_id=job_id, progress_callback=lambda c, t: update_job(job_id, progress_current=c, progress_total=t))
            update_job(
                job_id,
                status="completed",
                progress_current=count,
                progress_total=count,
                finished_at=datetime.now(timezone.utc),
            )
        else:
            raise RuntimeError(f"No scraper for {slug}")
    except Exception as exc:
        update_job(job_id, status="failed", error_message=str(exc), finished_at=datetime.now(timezone.utc))


async def run_job_background(job_id: UUID) -> None:
    """Run scrape job (intended for FastAPI BackgroundTasks)."""
    await run_job(job_id)
