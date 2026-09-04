"""Tests for the phonetic respelling shown on the pronunciation card.

Regression cover for the splitter that produced these rows. The previous
implementation hyphenated the *spelling* with pyphen and then cut the *phoneme*
list at character-proportional offsets — two representations that do not line
up, so the boundaries obeyed no phonological constraint. It shipped
``ser · kuhmst · ans · uhz`` for ``circumstances`` and a vowel-less ``y`` for
``particularly``.

Note the old version of this module held a single bare ``def test_...``. The
suite runs under ``unittest discover``, which only collects ``TestCase``
subclasses, so it was never executed — which is part of why the boundary bug
went unnoticed.
"""

import unittest

from app.utils.pronunciation_reference import (
    allocate_phoneme_indices,
    build_syllable_rows,
)


def displays(word: str, tokens: str) -> list[str]:
    return [row["display"] for row in build_syllable_rows(word, tokens.split())]


class SyllableRowShapeTests(unittest.TestCase):
    def test_row_keys(self):
        rows = build_syllable_rows("accident", "AE1 K S IH0 D AH0 N T".split())
        self.assertEqual(len(rows), 3)
        for row in rows:
            self.assertEqual(
                set(row), {"phones", "display", "stressed", "stress_level"}
            )
            self.assertTrue(row["display"].strip())
            self.assertTrue(row["phones"].strip())

    def test_stress_on_first_vowel(self):
        rows = build_syllable_rows("accident", "AE1 K S IH0 D AH0 N T".split())
        self.assertIs(rows[0]["stressed"], True)
        self.assertEqual(rows[0]["stress_level"], 1)

    def test_hello_stress_is_on_the_second_syllable(self):
        rows = build_syllable_rows("hello", "HH AH0 L OW1".split())
        self.assertEqual([r["display"] for r in rows], ["huh", "loh"])
        self.assertIs(rows[0]["stressed"], False)
        self.assertIs(rows[1]["stressed"], True)


class RespellingWorkedExamplesTests(unittest.TestCase):
    def test_circumstances(self):
        """The word from the bug report; Google renders it the same way."""
        self.assertEqual(
            displays("circumstances", "S ER1 K AH0 M S T AE2 N S AH0 Z"),
            ["ser", "kuhm", "stan", "suhz"],
        )

    def test_naturally(self):
        self.assertEqual(
            displays("naturally", "N AE1 CH ER0 AH0 L IY0"),
            ["na", "cher", "uh", "lee"],
        )

    def test_particularly_has_no_vowelless_syllable(self):
        """``kyuh`` used to come out as a bare ``y`` — a syllable with no nucleus."""
        rows = displays("particularly", "P AA2 R T IH1 K Y AH0 L ER0 L IY0")
        self.assertEqual(rows, ["pahr", "ti", "kyuh", "ler", "lee"])
        self.assertNotIn("y", rows)

    def test_comfortable(self):
        self.assertEqual(
            displays("comfortable", "K AH1 M F ER0 T AH0 B AH0 L"),
            ["kuhm", "fer", "tuh", "buhl"],
        )

    def test_monosyllable_stays_whole(self):
        self.assertEqual(displays("strengths", "S T R EH1 NG K TH S"), ["strengkths"])
        self.assertEqual(displays("think", "TH IH1 NG K"), ["thingk"])


class PrimaryStressTests(unittest.TestCase):
    def test_secondary_stress_is_not_bolded(self):
        """``particularly`` carries both levels; only the primary may be bold.

        ``stressed`` was previously ``bool(stress)``, which marked the secondary
        syllable too and told the learner to emphasise two syllables equally.
        """
        rows = build_syllable_rows(
            "particularly", "P AA2 R T IH1 K Y AH0 L ER0 L IY0".split()
        )
        self.assertEqual([r["stress_level"] for r in rows], [2, 1, 0, 0, 0])
        self.assertEqual([r["stressed"] for r in rows], [False, True, False, False, False])

    def test_circumstances_stress_levels(self):
        rows = build_syllable_rows(
            "circumstances", "S ER1 K AH0 M S T AE2 N S AH0 Z".split()
        )
        self.assertEqual([r["stress_level"] for r in rows], [1, 0, 2, 0])
        self.assertEqual(sum(r["stressed"] for r in rows), 1)


class AllocatePhonemeIndicesTests(unittest.TestCase):
    """``allocate_phoneme_indices`` is what gives each phone its syllable index."""

    def test_indices_partition_the_token_list(self):
        tokens = "S ER1 K AH0 M S T AE2 N S AH0 Z".split()
        groups = allocate_phoneme_indices(tokens)
        self.assertEqual(
            [i for group in groups for i in group], list(range(len(tokens)))
        )

    def test_groups_match_the_rendered_rows(self):
        tokens = "N AE1 CH ER0 AH0 L IY0".split()
        self.assertEqual(
            len(allocate_phoneme_indices(tokens)),
            len(build_syllable_rows("naturally", tokens)),
        )

    def test_empty_input(self):
        self.assertEqual(allocate_phoneme_indices([]), [])


if __name__ == "__main__":
    unittest.main()
