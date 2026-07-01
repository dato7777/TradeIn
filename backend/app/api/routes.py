"""API route handlers."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response

from app.auth.jwt import get_current_user, require_admin
from app.database import (
    bulk_replace_company_prices,
    execute_returning,
    fetch_all,
    get_all_companies,
    get_all_companies_last_updated,
    get_company_by_slug,
    get_company_last_updated,
    grade_columns_list,
)
from app.scrapers.orchestrator import create_job, get_job, run_job_background
from app.services.excel_io import export_company_excel, export_summary_excel, parse_company_excel, preview_import
from app.services.summary_builder import build_summary

router = APIRouter()


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/auth/me")
def auth_me(user: dict = Depends(get_current_user)):
    return user


@router.get("/companies")
def list_companies(_user: dict = Depends(get_current_user)):
    companies = get_all_companies()
    updated_map = get_all_companies_last_updated()
    result = []
    for c in companies:
        count_row = fetch_all(
            "SELECT COUNT(DISTINCT normalized_name) AS cnt FROM company_prices WHERE company_id = %s",
            (str(c["id"]),),
        )
        result.append(
            {
                "slug": c["slug"],
                "name": c["name"],
                "source_type": c["source_type"],
                "grades": grade_columns_list(c),
                "color": c.get("color"),
                "device_count": count_row[0]["cnt"] if count_row else 0,
                "price_updated_at": updated_map.get(c["slug"]),
            }
        )
    return result


@router.get("/companies/{slug}/prices")
def company_prices(
    slug: str,
    search: str | None = None,
    brand: str | None = None,
    limit: int = 100,
    offset: int = 0,
    _user: dict = Depends(get_current_user),
):
    company = get_company_by_slug(slug)
    if not company:
        raise HTTPException(404, "Company not found")
    grades = grade_columns_list(company)
    query = """
        SELECT normalized_name, brand, model, storage_gb, grade, price
        FROM company_prices WHERE company_id = %s
    """
    params: list = [str(company["id"])]
    if search:
        query += " AND normalized_name ILIKE %s"
        params.append(f"%{search}%")
    if brand:
        query += " AND brand = %s"
        params.append(brand.lower())
    query += " ORDER BY normalized_name, grade"
    rows = fetch_all(query, tuple(params))

    pivot: dict[str, dict] = {}
    for r in rows:
        n = r["normalized_name"]
        if n not in pivot:
            pivot[n] = {
                "normalized_name": n,
                "brand": r["brand"],
                "model": r["model"],
                "storage_gb": r["storage_gb"],
                "grades": {},
            }
        pivot[n]["grades"][r["grade"]] = r["price"]

    devices = sorted(pivot.values(), key=lambda x: x["normalized_name"])
    return {
        "company": {
            "slug": slug,
            "name": company["name"],
            "grades": grades,
            "color": company.get("color"),
            "price_updated_at": get_company_last_updated(company["id"]),
        },
        "total": len(devices),
        "devices": devices[offset : offset + limit],
    }


@router.get("/summary")
def summary(
    search: str | None = None,
    brand: str | None = None,
    _user: dict = Depends(get_current_user),
):
    return build_summary(brand_filter=brand, search=search)


@router.get("/export/company/{slug}")
def export_company(slug: str, _user: dict = Depends(get_current_user)):
    try:
        data = export_company_excel(slug)
    except ValueError as e:
        raise HTTPException(404, str(e)) from e
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{slug}.xlsx"'},
    )


@router.get("/export/summary")
def export_summary(_user: dict = Depends(get_current_user)):
    data = export_summary_excel()
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="summary.xlsx"'},
    )


@router.post("/import/{slug}/preview")
async def import_preview(
    slug: str,
    file: UploadFile = File(...),
    _admin: dict = Depends(require_admin),
):
    content = await file.read()
    return preview_import(content, slug)


@router.post("/import/{slug}")
async def import_commit(
    slug: str,
    file: UploadFile = File(...),
    admin: dict = Depends(require_admin),
):
    company = get_company_by_slug(slug)
    if not company or company["source_type"] != "upload":
        raise HTTPException(400, "Only upload companies support Excel import")
    content = await file.read()
    rows, errors = parse_company_excel(content, slug)
    if errors and not rows:
        raise HTTPException(400, {"errors": errors})
    now = datetime.now(timezone.utc)
    bulk_replace_company_prices(company["id"], rows, uploaded_at=now)
    execute_returning(
        """
        INSERT INTO upload_history (company_id, file_name, row_count, uploaded_by)
        VALUES (%s, %s, %s, %s) RETURNING id
        """,
        (str(company["id"]), file.filename or "upload.xlsx", len(rows), admin.get("user_id")),
    )
    return {"imported": len(rows), "errors": errors}


@router.post("/scrape/{slug}")
async def start_scrape(
    slug: str,
    background_tasks: BackgroundTasks,
    admin: dict = Depends(require_admin),
):
    try:
        job = create_job(slug, created_by=admin.get("user_id"))
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    background_tasks.add_task(run_job_background, UUID(str(job["id"])))
    return job


@router.get("/scrape/jobs/{job_id}")
def scrape_job_status(job_id: UUID, _admin: dict = Depends(require_admin)):
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job
