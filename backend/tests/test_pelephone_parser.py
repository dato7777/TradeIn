"""Tests for Pelephone HTML parser."""

from app.scrapers.companies.pelephone import parse_pelephone_html

SAMPLE_HTML = """
<div class="result">
  <div class="content price">
    <div> בהחזרת מכשיר <span class="blue">תקין</span>&nbsp;
      <span class="br_mob">iPhone 14 Plus 128GB Starlight</span></div>
    <div class="discounts">
      <div class="discount">
        <span class="blue"><span dir="rtl">721</span>₪ </span>
        <span class="vat">כולל מע"מ </span>
      </div>
      <div class="discount">
        <span class="blue"><span dir="rtl">610.2</span>₪ </span>
        <span class="vat">לפני מע"מ ובאילת</span>
      </div>
    </div>
  </div>
  <div class="content price">
    <div> בהחזרת מכשיר <span class="blue">תקין חלקית</span>&nbsp;
      <span class="br_mob">iPhone 14 Plus 128GB Starlight</span></div>
    <div class="discounts">
      <div class="discount">
        <span class="blue"><span dir="rtl">281</span>₪ </span>
        <span class="vat">כולל מע"מ </span>
      </div>
    </div>
  </div>
  <div class="content price">
    <div> בהחזרת מכשיר <span class="blue">תקול</span>&nbsp;
      <span class="br_mob">iPhone 14 Plus 128GB Starlight</span></div>
    <div class="discounts">
      <div class="discount">
        <span class="blue"><span dir="rtl">120</span>₪ </span>
        <span class="vat">כולל מע"מ </span>
      </div>
    </div>
  </div>
</div>
"""


def test_pelephone_parser():
    records = parse_pelephone_html(SAMPLE_HTML)
    by_grade = {r["grade"]: r for r in records}
    assert by_grade["a"]["price"] == 721
    assert by_grade["b"]["price"] == 281
    assert by_grade["c"]["price"] == 120
    assert by_grade["a"]["normalized_name"] == "iPhone 14 Plus 128GB"
