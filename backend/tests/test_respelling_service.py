import pytest
from app.services.phoneme_respelling_service import phoneme_respelling_service

@pytest.mark.anyio
async def test_predefined_words_indian_english():
    # Naturally
    res_nat = await phoneme_respelling_service.get_dialect_respelling("naturally", "en-IN")
    assert len(res_nat) == 4
    assert res_nat[0]["display"] == "na"
    assert res_nat[0]["stressed"] is True
    assert res_nat[1]["display"] == "choo"
    assert res_nat[1]["stressed"] is False

    # English
    res_eng = await phoneme_respelling_service.get_dialect_respelling("english", "en-IN")
    assert len(res_eng) == 2
    assert res_eng[0]["display"] == "ingg"
    assert res_eng[0]["stressed"] is True
    assert res_eng[1]["display"] == "lish"
    assert res_eng[1]["stressed"] is False

@pytest.mark.anyio
async def test_predefined_words_american_english():
    # Naturally
    res_nat = await phoneme_respelling_service.get_dialect_respelling("naturally", "en-US")
    assert len(res_nat) == 4
    assert res_nat[0]["display"] == "na"
    assert res_nat[0]["stressed"] is True
    assert res_nat[1]["display"] == "chuh"
    assert res_nat[1]["stressed"] is False

@pytest.mark.anyio
async def test_predefined_words_british_english():
    # Pronunciation
    res_pron = await phoneme_respelling_service.get_dialect_respelling("pronunciation", "en-GB")
    assert len(res_pron) == 5
    assert res_pron[0]["display"] == "pruh"
    assert res_pron[0]["stressed"] is False
    assert res_pron[3]["display"] == "ay"
    assert res_pron[3]["stressed"] is True

@pytest.mark.anyio
async def test_unknown_word_fallback():
    # Fallback uses the local G2P + pyphen analyzer
    res = await phoneme_respelling_service.get_dialect_respelling("hello", "en-US")
    assert len(res) > 0
    assert any(s["display"] for s in res)
