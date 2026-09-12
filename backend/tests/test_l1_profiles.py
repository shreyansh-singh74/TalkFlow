"""L1 interference profiles.

Two properties matter: the table resolves the spellings a browser will actually
send, and the profiles bias *content and coaching only* -- nothing here may
change a score.
"""

import unittest

from app.services.l1_profiles import (
    L1_PROFILES,
    get_l1_profile,
    interference_note,
    l1_choices,
    merge_focus_sounds,
    resolve_l1_code,
    weak_phones_for,
)


class L1ResolutionTests(unittest.TestCase):
    def test_canonical_codes_survive(self):
        for code in L1_PROFILES:
            self.assertEqual(resolve_l1_code(code), code)

    def test_bcp47_and_english_names_resolve(self):
        self.assertEqual(resolve_l1_code("ja-JP"), "ja")
        self.assertEqual(resolve_l1_code("Japanese"), "ja")
        self.assertEqual(resolve_l1_code("zh-CN"), "zh")
        self.assertEqual(resolve_l1_code("pt-BR"), "pt")
        self.assertEqual(resolve_l1_code("es_MX"), "es")

    def test_unknown_or_absent_resolves_to_nothing(self):
        self.assertIsNone(resolve_l1_code(None))
        self.assertIsNone(resolve_l1_code(""))
        self.assertIsNone(resolve_l1_code("klingon"))
        self.assertIsNone(get_l1_profile("klingon"))

    def test_every_profile_has_a_label_and_is_picker_ready(self):
        for choice in l1_choices():
            self.assertTrue(choice["code"] and choice["label"])
            self.assertLessEqual(len(choice["weak_phones"]), 6)

    def test_declared_weak_phones_are_non_empty_for_real_languages(self):
        for code, profile in L1_PROFILES.items():
            if code == "other":
                self.assertEqual(list(profile.weak_phones), [])
                continue
            self.assertTrue(list(profile.weak_phones), f"{code} has no weak phones")


class FocusSoundMergeTests(unittest.TestCase):
    def test_coach_focus_sounds_outrank_the_l1_prediction(self):
        merged = merge_focus_sounds(["θ", "ð"], ["r", "l", "v"], limit=3)
        self.assertEqual(merged, ["θ", "ð", "r"])

    def test_duplicates_are_dropped(self):
        self.assertEqual(merge_focus_sounds(["r"], ["r", "l"]), ["r", "l"])

    def test_l1_prediction_is_capped_for_a_prompt_sized_list(self):
        self.assertLessEqual(len(weak_phones_for("es")), 6)
        self.assertEqual(weak_phones_for("klingon"), [])
        self.assertEqual(merge_focus_sounds(None, weak_phones_for("ja"), limit=4)[:4],
                         weak_phones_for("ja", limit=4))

    def test_blank_entries_are_ignored(self):
        self.assertEqual(merge_focus_sounds(["", "  "], ["", "l"]), ["l"])


class InterferenceNoteTests(unittest.TestCase):
    def test_note_names_the_language_and_the_sounds(self):
        note = interference_note("ja")
        self.assertIn("Japanese", note)
        self.assertIn("/r/", note)
        self.assertIn("/l/", note)

    def test_note_is_a_hint_or_nothing_never_a_placeholder(self):
        # "Other / prefer not to say" must produce no note at all, so the coach
        # prompt never claims knowledge the learner did not give it.
        self.assertIsNone(interference_note("other"))
        self.assertIsNone(interference_note(None))
        self.assertIsNone(interference_note("klingon"))


if __name__ == "__main__":
    unittest.main()
