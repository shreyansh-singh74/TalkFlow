from app.utils.pronunciation_reference import build_syllable_rows


def test_build_syllable_rows_stress_on_first_vowel():
    rows = build_syllable_rows("accident", ["AE1", "K", "S", "IH0", "D", "AH0", "N", "T"])
    assert len(rows) == 3
    assert rows[0]["stressed"] is True
    assert "display" in rows[0] and rows[0]["display"]
    assert "phones" in rows[0]
