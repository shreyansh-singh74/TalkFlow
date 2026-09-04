import unittest

from app.utils.syllabify import (
    VOWEL_BASES,
    base_phone,
    is_vowel,
    syllabify,
    syllable_stress,
)


def phones(tokens, groups):
    """Render a syllabification as ``["S ER", "K AH M", ...]`` for readable asserts."""
    return [" ".join(base_phone(tokens[i]) for i in group) for group in groups]


class SyllabifyWorkedExamplesTests(unittest.TestCase):
    """The boundaries the previous pyphen-proportional splitter got wrong.

    ``circumstances`` is the word from the bug report — Google renders it
    ``suh · kuhm · stan · suhz``, and the old code cut the phone list at
    character-proportional offsets taken from the *spelling*, which produced
    syllables with no vowel and clusters split across the wrong boundary.
    """

    def test_circumstances(self):
        tokens = "S ER1 K AH0 M S T AE2 N S AH0 Z".split()
        groups = syllabify(tokens)
        self.assertEqual(
            phones(tokens, groups), ["S ER", "K AH M", "S T AE N", "S AH Z"]
        )

    def test_naturally(self):
        tokens = "N AE1 CH ER0 AH0 L IY0".split()
        self.assertEqual(
            phones(tokens, syllabify(tokens)), ["N AE", "CH ER", "AH", "L IY"]
        )

    def test_comfortable(self):
        tokens = "K AH1 M F ER0 T AH0 B AH0 L".split()
        self.assertEqual(
            phones(tokens, syllabify(tokens)),
            ["K AH M", "F ER", "T AH", "B AH L"],
        )

    def test_instructions_keeps_str_cluster_as_onset(self):
        """Maximum onset: /str/ is a legal English onset, so it all goes right."""
        tokens = "IH0 N S T R AH1 K SH AH0 N Z".split()
        self.assertEqual(
            phones(tokens, syllabify(tokens)),
            ["IH N", "S T R AH K", "SH AH N Z"],
        )

    def test_ng_never_starts_a_syllable(self):
        """/ŋ/ is a legal coda but an illegal onset, so it stays left."""
        tokens = "S IH1 NG ER0".split()
        self.assertEqual(phones(tokens, syllabify(tokens)), ["S IH NG", "ER"])

    def test_onsetless_syllable(self):
        tokens = "EY0 AO1 R T AH0".split()
        groups = syllabify(tokens)
        self.assertEqual(phones(tokens, groups), ["EY", "AO R", "T AH"])


class SyllabifyInvariantTests(unittest.TestCase):
    """Properties that must hold for *every* word, not just the worked ones.

    These are the guarantees the old character-proportional splitter could not
    make, and their absence is what let a vowel-less syllable reach the card.
    """

    WORDS = [
        "S ER1 K AH0 M S T AE2 N S AH0 Z",
        "P AA0 R T IH1 K Y AH0 L ER0 L IY0",
        "HH AH0 L OW1",
        "AE1 K S IH0 D AH0 N T",
        "B Y UW1 T AH0 F AH0 L",
        "S T R EH1 NG K TH S",
        "R IH0 D IH1 K Y AH0 L AH0 S",
        "AH0 M EH1 R IH0 K AH0",
        "K AA1 N SH AH0 S N AH0 S",
        "W ER1 L D",
    ]

    def test_partition_is_contiguous_and_exhaustive(self):
        for word in self.WORDS:
            tokens = word.split()
            with self.subTest(word=word):
                flat = [i for group in syllabify(tokens) for i in group]
                self.assertEqual(flat, list(range(len(tokens))))

    def test_no_empty_syllable(self):
        for word in self.WORDS:
            tokens = word.split()
            with self.subTest(word=word):
                for group in syllabify(tokens):
                    self.assertTrue(group)

    def test_every_syllable_has_exactly_one_vowel(self):
        """The invariant that makes a vowel-less respelling impossible."""
        for word in self.WORDS:
            tokens = word.split()
            with self.subTest(word=word):
                for group in syllabify(tokens):
                    nuclei = [i for i in group if is_vowel(tokens[i])]
                    self.assertEqual(len(nuclei), 1, msg=f"{word} -> {group}")

    def test_syllable_count_equals_vowel_count(self):
        for word in self.WORDS:
            tokens = word.split()
            with self.subTest(word=word):
                vowels = sum(1 for t in tokens if is_vowel(t))
                self.assertEqual(len(syllabify(tokens)), vowels)


class SyllableStressTests(unittest.TestCase):
    def test_at_most_one_primary_stress(self):
        """``particularly`` carries both primary and secondary stress.

        The card bolds the primary syllable. Collapsing the two levels with
        ``bool(stress)`` bolded two syllables and told the learner to emphasise
        both.
        """
        tokens = "P AA2 R T IH1 K Y AH0 L ER0 L IY0".split()
        groups = syllabify(tokens)
        levels = [syllable_stress(tokens, g) for g in groups]
        self.assertEqual(levels, [2, 1, 0, 0, 0])
        self.assertEqual(levels.count(1), 1)

    def test_primary_beats_secondary_within_one_syllable(self):
        tokens = "AE2 K S AH1".split()
        # Contrived: two vowels in one word, one syllable each.
        groups = syllabify(tokens)
        self.assertEqual([syllable_stress(tokens, g) for g in groups], [2, 1])

    def test_unstressed_word(self):
        tokens = "DH AH0".split()
        groups = syllabify(tokens)
        self.assertEqual([syllable_stress(tokens, g) for g in groups], [0])


class SyllabifyDegenerateInputTests(unittest.TestCase):
    def test_empty(self):
        self.assertEqual(syllabify([]), [])

    def test_no_vowel_yields_one_group(self):
        """``hmm`` and friends must not crash or drop phones."""
        tokens = "HH M".split()
        groups = syllabify(tokens)
        self.assertEqual([i for g in groups for i in g], [0, 1])

    def test_single_vowel(self):
        self.assertEqual(syllabify(["AH0"]), [[0]])

    def test_base_phone_strips_stress_digits(self):
        self.assertEqual(base_phone("AE1"), "AE")
        self.assertEqual(base_phone("ae0"), "AE")
        self.assertEqual(base_phone("NG"), "NG")

    def test_vowel_bases_are_all_recognised(self):
        for base in VOWEL_BASES:
            with self.subTest(base=base):
                self.assertTrue(is_vowel(f"{base}1"))
                self.assertTrue(is_vowel(base))


if __name__ == "__main__":
    unittest.main()
