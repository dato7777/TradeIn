"""PostgreSQL database access."""

from __future__ import annotations

import json
from contextlib import contextmanager
from typing import Any, Generator, Optional
from uuid import UUID

import psycopg
from psycopg.rows import dict_row

from app.config import get_settings


@contextmanager
def get_connection() -> Generator[psycopg.Connection, None, None]:
    settings = get_settings()
    conn = psycopg.connect(settings.database_url, row_factory=dict_row)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def fetch_all(query: str, params: tuple | dict | None = None) -> list[dict[str, Any]]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params or ())
            return list(cur.fetchall())


def fetch_one(query: str, params: tuple | dict | None = None) -> Optional[dict[str, Any]]:
    rows = fetch_all(query, params)
    return rows[0] if rows else None


def execute(query: str, params: tuple | dict | None = None) -> None:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params or ())


def execute_returning(query: str, params: tuple | dict | None = None) -> Optional[dict[str, Any]]:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params or ())
            return cur.fetchone()


def get_company_by_slug(slug: str) -> Optional[dict[str, Any]]:
    return fetch_one("SELECT * FROM companies WHERE slug = %s", (slug,))


def get_all_companies() -> list[dict[str, Any]]:
    return fetch_all("SELECT * FROM companies ORDER BY name")


def get_company_last_updated(company_id: UUID) -> Any:
    row = fetch_one(
        """
        SELECT GREATEST(MAX(scraped_at), MAX(uploaded_at)) AS last_updated
        FROM company_prices
        WHERE company_id = %s
        """,
        (str(company_id),),
    )
    return row["last_updated"] if row else None


def get_all_companies_last_updated() -> dict[str, Any]:
    rows = fetch_all(
        """
        SELECT co.slug,
               GREATEST(MAX(cp.scraped_at), MAX(cp.uploaded_at)) AS last_updated
        FROM companies co
        LEFT JOIN company_prices cp ON cp.company_id = co.id
        GROUP BY co.slug, co.name
        ORDER BY co.name
        """
    )
    return {r["slug"]: r["last_updated"] for r in rows if r.get("last_updated")}


def delete_company_prices(company_id: UUID) -> None:
    execute("DELETE FROM company_prices WHERE company_id = %s", (str(company_id),))


def dedupe_price_rows(rows: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[str]]:
    """Keep one row per (normalized_name, grade); later rows win."""
    deduped: dict[tuple[str, str], dict[str, Any]] = {}
    warnings: list[str] = []
    for row in rows:
        key = (row["normalized_name"], row["grade"])
        if key in deduped:
            previous = deduped[key]
            warnings.append(
                f"Duplicate {row['normalized_name']} grade {row['grade']}: "
                f"keeping {row['price']}, dropped {previous['price']}"
            )
        deduped[key] = row
    return list(deduped.values()), warnings


def bulk_replace_company_prices(
    company_id: UUID,
    rows: list[dict[str, Any]],
    *,
    uploaded_at=None,
    scraped_at=None,
    job_id: Optional[UUID] = None,
) -> int:
    """Replace all prices for a company in a single transaction."""
    rows, _ = dedupe_price_rows(rows)
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM company_prices WHERE company_id = %s", (str(company_id),))
            for r in rows:
                cur.execute(
                    """
                    INSERT INTO company_prices (
                        company_id, raw_device_name, normalized_name, brand, model,
                        storage_gb, grade, price, scraped_at, uploaded_at, job_id
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        str(company_id),
                        r["raw_device_name"],
                        r["normalized_name"],
                        r["brand"],
                        r["model"],
                        r["storage_gb"],
                        r["grade"],
                        r["price"],
                        scraped_at,
                        uploaded_at,
                        str(job_id) if job_id else None,
                    ),
                )
    return len(rows)


def upsert_company_price(
    company_id: UUID,
    raw_device_name: str,
    normalized_name: str,
    brand: str,
    model: str,
    storage_gb: str,
    grade: str,
    price: int,
    *,
    scraped_at=None,
    uploaded_at=None,
    job_id: Optional[UUID] = None,
) -> None:
    execute(
        """
        INSERT INTO company_prices (
            company_id, raw_device_name, normalized_name, brand, model,
            storage_gb, grade, price, scraped_at, uploaded_at, job_id
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (company_id, normalized_name, grade)
        DO UPDATE SET
            raw_device_name = EXCLUDED.raw_device_name,
            price = EXCLUDED.price,
            scraped_at = COALESCE(EXCLUDED.scraped_at, company_prices.scraped_at),
            uploaded_at = COALESCE(EXCLUDED.uploaded_at, company_prices.uploaded_at),
            job_id = COALESCE(EXCLUDED.job_id, company_prices.job_id)
        """,
        (
            str(company_id),
            raw_device_name,
            normalized_name,
            brand,
            model,
            storage_gb,
            grade,
            price,
            scraped_at,
            uploaded_at,
            str(job_id) if job_id else None,
        ),
    )


def grade_columns_list(company: dict) -> list[dict]:
    cols = company.get("grade_columns")
    if isinstance(cols, str):
        return json.loads(cols)
    return cols or []
