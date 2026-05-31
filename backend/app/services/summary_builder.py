"""Build tier-grouped summary from company_prices."""

from __future__ import annotations

from collections import defaultdict
from typing import Any

from app.config import load_companies_config
from app.database import fetch_all, get_all_companies, grade_columns_list

COMPANY_COLUMN_ORDER = ["ksp", "partner", "dynamica", "pelephone"]


def _sort_company_slugs(slugs: list[str]) -> list[str]:
    order = {slug: i for i, slug in enumerate(COMPANY_COLUMN_ORDER)}
    return sorted(slugs, key=lambda s: order.get(s, 99))


def build_summary(brand_filter: str | None = None, search: str | None = None) -> dict[str, Any]:
    companies = get_all_companies()
    config = load_companies_config()
    company_cfg = config.get("companies", {})
    tier_meta = config.get("summary_tiers", [])

    slug_to_grades: dict[str, list[dict]] = {}
    slug_to_name: dict[str, str] = {}
    slug_to_color: dict[str, str] = {}
    for c in companies:
        slug = c["slug"]
        slug_to_grades[slug] = grade_columns_list(c)
        slug_to_name[slug] = c["name"]
        slug_to_color[slug] = c.get("color") or company_cfg.get(slug, {}).get("color", "#ccc")

    query = """
        SELECT cp.*, co.slug AS company_slug, co.name AS company_name
        FROM company_prices cp
        JOIN companies co ON co.id = cp.company_id
        WHERE 1=1
    """
    params: list[Any] = []
    if brand_filter:
        query += " AND cp.brand = %s"
        params.append(brand_filter.lower())
    if search:
        query += " AND cp.normalized_name ILIKE %s"
        params.append(f"%{search}%")
    query += " ORDER BY cp.normalized_name"
    rows = fetch_all(query, tuple(params))

    devices: dict[str, dict] = {}

    for row in rows:
        norm = row["normalized_name"]
        if norm not in devices:
            devices[norm] = {
                "normalized_name": norm,
                "brand": row["brand"],
                "model": row["model"],
                "storage_gb": row["storage_gb"],
                "tiers": defaultdict(dict),
            }
        slug = row["company_slug"]
        grade = row["grade"]
        grade_info = next((g for g in slug_to_grades[slug] if g["key"] == grade), None)
        if not grade_info:
            continue
        tier = grade_info.get("summary_tier", 1)
        devices[norm]["tiers"][tier][slug] = {
            "company": slug,
            "company_name": row["company_name"],
            "grade_key": grade,
            "grade_label": grade_info["label"],
            "price": row["price"],
            "color": slug_to_color.get(slug),
        }

    tier_config = []
    for t in tier_meta:
        tier_num = t["tier"]
        companies_in_tier = _sort_company_slugs(
            [
                slug
                for slug, grades in slug_to_grades.items()
                if any(g.get("summary_tier") == tier_num for g in grades)
            ]
        )
        tier_config.append(
            {
                "tier": tier_num,
                "label": t.get("label", f"Tier {tier_num}"),
                "companies": companies_in_tier,
            }
        )

    device_list = []
    for norm in sorted(devices.keys()):
        d = devices[norm]
        tiers_out = []
        for tier_num in sorted(d["tiers"].keys()):
            prices = []
            for slug in tier_config[tier_num - 1]["companies"] if tier_num <= len(tier_config) else []:
                if slug in d["tiers"][tier_num]:
                    prices.append(d["tiers"][tier_num][slug])
            tiers_out.append({"tier": tier_num, "prices": prices})
        device_list.append(
            {
                "normalized_name": d["normalized_name"],
                "brand": d["brand"],
                "model": d["model"],
                "storage_gb": d["storage_gb"],
                "tiers": tiers_out,
            }
        )

    return {
        "tier_config": tier_config,
        "companies": [
            {
                "slug": c["slug"],
                "name": c["name"],
                "color": slug_to_color.get(c["slug"]),
                "grades": slug_to_grades[c["slug"]],
            }
            for c in companies
        ],
        "devices": device_list,
    }
