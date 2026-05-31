"""Tests for Excel import column detection."""

import io

import pytest
from openpyxl import Workbook

from app.services.excel_io import parse_company_excel


def _xlsx_bytes(*rows: tuple) -> bytes:
    wb = Workbook()
    ws = wb.active
    for row in rows:
        ws.append(list(row))
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_dynamica_standard_headers():
    data = _xlsx_bytes(
        ("דגם", "A תקין", "B תקין", "C שבור / סדוק", "D תקול"),
        ("iPhone 11 128GB", 450, 220, 130, 80),
    )
    rows, errors = parse_company_excel(data, "dynamica")
    assert not errors
    assert len(rows) == 4
    assert rows[0]["normalized_name"] == "iPhone 11 128GB"
    assert rows[0]["grade"] == "a"
    assert rows[0]["price"] == 450


def test_dynamica_reversed_grade_headers():
    data = _xlsx_bytes(
        ("Dynamica", None, None, None, None),
        ("דגם", "תקין A", "תקין B", "שבור/סדוק C", "תקול D"),
        ("iPhone 11 128GB", "₪450", "₪220", "₪130", "₪80"),
    )
    rows, errors = parse_company_excel(data, "dynamica")
    assert not errors
    assert len(rows) == 4


def test_device_column_name():
    data = _xlsx_bytes(
        ("Device", "A תקין", "B תקין", "C שבור/סדוק", "D תקול"),
        ("iPhone 11 128GB", 450, 220, 130, 80),
    )
    rows, errors = parse_company_excel(data, "dynamica")
    assert not errors
    assert len(rows) == 4


def test_duplicate_rows_deduped():
    data = _xlsx_bytes(
        ("דגם", "A תקין", "B תקין", "C שבור / סדוק", "D תקול"),
        ("Samsung Galaxy A30 64GB", 100, 80, 60, 40),
        ("Samsung Galaxy A30s 64GB", 110, 85, 65, 45),
    )
    rows, errors = parse_company_excel(data, "dynamica")
    assert len(rows) == 8
    assert not any("Duplicate" in err for err in errors)
    names = {r["normalized_name"] for r in rows if r["grade"] == "a"}
    assert names == {"Samsung Galaxy A30 64GB", "Samsung Galaxy A30s 64GB"}


def test_dynamica_dash_in_c_header():
    data = _xlsx_bytes(
        ("דגם", "A תקין", "B תקין", "C - שבור / סדוק", "D תקול"),
        ("iPhone 11 128GB", 450, 220, 130, 80),
    )
    rows, errors = parse_company_excel(data, "dynamica")
    assert not errors
    assert len(rows) == 4
    assert any(r["grade"] == "c" and r["price"] == 130 for r in rows)


def test_partner_price_first_columns():
    """Partner sheets often put price in col A and device in col B (RTL)."""
    data = _xlsx_bytes(
        ("תקין", "דגם"),
        (260, "iPhone 11 64"),
        (370, "iPhone 11 128"),
        (320, "iPhone 11 Pro 64"),
    )
    rows, errors = parse_company_excel(data, "partner")
    assert not errors, errors
    assert len(rows) == 3
    by_name = {r["normalized_name"]: r["price"] for r in rows}
    assert by_name["iPhone 11 64GB"] == 260
    assert by_name["iPhone 11 128GB"] == 370
    assert by_name["iPhone 11 Pro 64GB"] == 320


def test_partner_misaligned_columns():
    wb = Workbook()
    ws = wb.active
    ws.sheet_view.rightToLeft = True
    ws.append([None, "דגם", "תקין"])
    ws.append(["iPhone 11 64", 260])
    ws.append(["iPhone 11 128", 370])
    buf = io.BytesIO()
    wb.save(buf)
    rows, errors = parse_company_excel(buf.getvalue(), "partner")
    assert not errors, errors
    assert len(rows) == 2
    assert rows[0]["price"] == 260
    assert rows[0]["normalized_name"] == "iPhone 11 64GB"
    assert rows[1]["price"] == 370


def test_partner_standard_layout():
    data = _xlsx_bytes(
        ("דגם", "תקין"),
        ("iPhone 11 Pro 64", 320),
        ("iPhone 11 Pro 256", 470),
    )
    rows, errors = parse_company_excel(data, "partner")
    assert not errors
    assert len(rows) == 2
    assert rows[0]["price"] == 320
    assert rows[1]["price"] == 470


def test_missing_model_column_reports_found_headers():
    data = _xlsx_bytes(
        ("Product", "A תקין", "B תקין"),
        ("iPhone 11 128GB", 450, 220),
    )
    rows, errors = parse_company_excel(data, "dynamica")
    assert rows == []
    assert len(errors) == 1
    assert "Found headers" in errors[0]
