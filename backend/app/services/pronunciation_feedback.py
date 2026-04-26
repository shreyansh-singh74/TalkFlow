from __future__ import annotations

from typing import List


def generate_feedback(opcodes: List[dict]) -> List[str]:
    out: List[str] = []
    for op in opcodes:
        tag = op.get("op", "")
        exp = (op.get("expected") or "").strip()
        act = (op.get("actual") or "").strip()
        if tag == "replace" and (exp or act):
            out.append(f"Expected {exp!r} but heard {act!r}.")
        elif tag == "delete" and exp:
            out.append(f"Sound missing: {exp!r}.")
        elif tag == "insert" and act:
            out.append(f"Extra sound: {act!r}.")
    return out
