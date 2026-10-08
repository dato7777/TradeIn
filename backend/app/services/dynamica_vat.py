"""Display/export helper: restore 18% VAT on Dynamica catalog prices."""

DYNAMICA_SLUG = "dynamica"
DYNAMICA_VAT_RATE = 0.18


def apply_dynamica_vat_price(price: int | float, include_vat: bool = True) -> int:
    """
    Dynamica stores VAT-exclusive integers (original / 1.18, then rounded).
    Multiplying back by 1.18 yields values like 599 / 1501; round to nearest 10
    to recover typical VAT-inclusive prices (600, 1500, 1550).
    """
    if not include_vat:
        return int(price)
    restored = price * (1 + DYNAMICA_VAT_RATE)
    return int(round(restored / 10.0) * 10)


def maybe_apply_dynamica_vat(slug: str, price: int | float | None, include_vat: bool) -> int | None:
    if price is None:
        return None
    if include_vat and slug == DYNAMICA_SLUG:
        return apply_dynamica_vat_price(price, True)
    return int(price)
