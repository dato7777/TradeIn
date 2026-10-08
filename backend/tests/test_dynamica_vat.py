from app.services.dynamica_vat import apply_dynamica_vat_price, maybe_apply_dynamica_vat


def test_round_to_nearest_10_recovers_typical_vat_prices():
    # 600 / 1.18 → 508 stored; 508 * 1.18 = 599.44 → 600
    assert apply_dynamica_vat_price(508) == 600
    # 1500 / 1.18 → 1271 stored; 1271 * 1.18 = 1499.78 → 1500
    assert apply_dynamica_vat_price(1271) == 1500
    # 1550 / 1.18 → 1314 stored; 1314 * 1.18 = 1550.52 → 1550
    assert apply_dynamica_vat_price(1314) == 1550


def test_leaves_price_unchanged_when_vat_off():
    assert apply_dynamica_vat_price(508, include_vat=False) == 508


def test_maybe_apply_only_dynamica():
    assert maybe_apply_dynamica_vat("dynamica", 508, True) == 600
    assert maybe_apply_dynamica_vat("ksp", 508, True) == 508
    assert maybe_apply_dynamica_vat("dynamica", 508, False) == 508
    assert maybe_apply_dynamica_vat("dynamica", None, True) is None
