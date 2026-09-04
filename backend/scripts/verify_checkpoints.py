#!/usr/bin/env python3
"""Verify a checkpoint's weights match the class we will actually load it into.

Why this exists. `asr.py` and `phoneme_recognizer.py` load through
``AutoModelForCTC``, which dispatches on ``config.model_type`` -- *not* on the
``architectures`` field. So a repo can be perfectly self-consistent and still be
the wrong thing to load:

  * ``microsoft/wavlm-base`` / ``-base-plus`` / ``-large`` are ``WavLMModel``
    (feature-extraction). ``AutoModelForCTC`` happily builds ``WavLMForCTC``
    from them and **randomly initialises the missing LM head** -- output is
    pure noise, with no error. The HF WavLM docs page's own ``WavLMForCTC``
    example does exactly this.
  * ``speech31/wavlm-large-english-phoneme`` is named for WavLM but its config
    says ``model_type: wav2vec2`` and ``transformers_version: 4.11.3``, which
    predates WavLM. It is wav2vec2-large wearing a WavLM name. Nothing about the
    config is inconsistent -- only the name misleads -- so this script reports
    ``model_type`` explicitly rather than trusting the repo id.

The check costs nothing (no weights are allocated):

  1. Resolve the class ``AutoModelForCTC`` would build, instantiate it on
     ``torch.device("meta")``, and count its ``state_dict()`` keys -- how many
     tensors that class needs.
  2. Count the tensors the weights file actually holds, by reading only its
     index: the zip central directory for ``.bin``, the JSON header for
     ``.safetensors``. A Range request, not a download.

Fewer tensors present than needed means parameters will be invented at load
time. Abort rather than ship.

Usage:
    python scripts/verify_checkpoints.py                    # the configured models
    python scripts/verify_checkpoints.py <repo_id> [...]    # arbitrary repos

Exits non-zero if any checkpoint fails.
"""

from __future__ import annotations

import json
import os
import struct
import sys

# Run from anywhere: make `app` importable.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Enough to cover a central directory of several thousand entries (~66 B each)
# without pulling any actual tensor data.
_TAIL_BYTES = 512 * 1024
_CD_SIGNATURE = b"PK\x01\x02"


def _meta_tensor_count(cls, config) -> int:
    """Tensors a class needs, counted on the meta device (no memory allocated)."""
    import torch

    with torch.device("meta"):
        model = cls(config)
    return len(model.state_dict())


def _inspect_config(repo_id: str):
    """Resolve what the config declares and what AutoModelForCTC would build."""
    import transformers
    from transformers import AutoConfig
    from transformers.models.auto.modeling_auto import MODEL_FOR_CTC_MAPPING_NAMES

    config = AutoConfig.from_pretrained(repo_id)

    declared_name = (getattr(config, "architectures", None) or [None])[0]
    declared_cls = getattr(transformers, declared_name, None) if declared_name else None

    # This is the class production actually gets: AutoModelForCTC keys off
    # model_type, ignoring `architectures` entirely.
    ctc_name = MODEL_FOR_CTC_MAPPING_NAMES.get(config.model_type)
    ctc_cls = getattr(transformers, ctc_name, None) if ctc_name else None

    return config, declared_name, declared_cls, ctc_name, ctc_cls


def _weights_file(repo_id: str) -> str:
    """Prefer safetensors; fall back to the pickle .bin."""
    from huggingface_hub import HfApi

    files = {s.rfilename for s in HfApi().model_info(repo_id).siblings}
    for name in ("model.safetensors", "pytorch_model.bin"):
        if name in files:
            return name
    sharded = sorted(
        f for f in files if f.endswith((".safetensors", ".bin")) and "model" in f
    )
    if sharded:
        raise SystemExit(
            f"{repo_id}: only sharded weights found ({sharded[0]}, ...); "
            "this script handles single-file checkpoints only"
        )
    raise SystemExit(f"{repo_id}: no weights file found")


def _read(repo_id: str, filename: str, start: int, length: int) -> bytes:
    """Byte range from the Hub, served from the local cache when present."""
    from huggingface_hub import hf_hub_url, try_to_load_from_cache

    cached = try_to_load_from_cache(repo_id, filename)
    if isinstance(cached, str) and os.path.exists(cached):
        with open(cached, "rb") as fh:
            fh.seek(start)
            return fh.read(length)

    import requests

    end = start + length - 1
    resp = requests.get(
        hf_hub_url(repo_id, filename),
        headers={"Range": f"bytes={start}-{end}"},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.content


def _file_size(repo_id: str, filename: str) -> int:
    from huggingface_hub import get_hf_file_metadata, hf_hub_url, try_to_load_from_cache

    cached = try_to_load_from_cache(repo_id, filename)
    if isinstance(cached, str) and os.path.exists(cached):
        return os.path.getsize(cached)
    size = get_hf_file_metadata(hf_hub_url(repo_id, filename)).size
    if size is None:
        raise SystemExit(f"{repo_id}: could not determine size of {filename}")
    return size


def _actual_tensor_count(repo_id: str, filename: str) -> int:
    """Tensors physically present in the weights file, read from its index."""
    if filename.endswith(".safetensors"):
        # Layout: u64 header length (LE), then that many bytes of JSON. One key
        # per tensor, plus an optional __metadata__ entry.
        (header_len,) = struct.unpack("<Q", _read(repo_id, filename, 0, 8))
        header = json.loads(_read(repo_id, filename, 8, header_len))
        return len([k for k in header if k != "__metadata__"])

    # torch.save writes a zip. Each tensor's storage is one `archive/data/<n>`
    # member; the central directory at the tail lists them all by name.
    size = _file_size(repo_id, filename)
    start = max(0, size - _TAIL_BYTES)
    tail = _read(repo_id, filename, start, size - start)

    count = 0
    pos = tail.find(_CD_SIGNATURE)
    while pos != -1:
        # Central directory record: filename length at +28, name at +46.
        name_len = struct.unpack_from("<H", tail, pos + 28)[0]
        name = tail[pos + 46 : pos + 46 + name_len].decode("utf-8", "replace")
        # ".../data/<digits>" -- the tensor storages, not data.pkl or version.
        parts = name.split("/")
        if len(parts) >= 2 and parts[-2] == "data" and parts[-1].isdigit():
            count += 1
        pos = tail.find(_CD_SIGNATURE, pos + 1)

    if count == 0:
        raise SystemExit(
            f"{repo_id}: found no tensor entries in the last {_TAIL_BYTES // 1024} KiB "
            f"of {filename} -- the central directory may be larger than the tail read"
        )
    return count


def verify(repo_id: str) -> bool:
    print(f"\n{repo_id}")
    config, declared_name, declared_cls, ctc_name, ctc_cls = _inspect_config(repo_id)
    filename = _weights_file(repo_id)
    actual = _actual_tensor_count(repo_id, filename)

    print(f"  model_type            : {config.model_type}")
    print(f"  config architectures  : {declared_name or '(none declared)'}")
    print(f"  AutoModelForCTC builds: {ctc_name or '(no CTC class for this model_type)'}")
    print(f"  weights file          : {filename}")
    print(f"  tensors present       : {actual}")

    ok = True

    # The repo id is not evidence. Say so out loud when it disagrees with the
    # config, because that is exactly how speech31/wavlm-* misleads.
    for hint in ("wavlm", "wav2vec2", "hubert", "whisper"):
        if hint in repo_id.lower() and config.model_type != hint:
            print(
                f"  !! name contains {hint!r} but model_type is "
                f"{config.model_type!r} -- the name is not what you are loading"
            )

    if ctc_cls is None:
        print(
            f"  -> FAIL: no CTC class registered for model_type "
            f"{config.model_type!r}; AutoModelForCTC cannot load this."
        )
        return False

    needed = _meta_tensor_count(ctc_cls, config)
    print(f"  tensors {ctc_name} needs: {needed}")

    if needed > actual:
        print(
            f"  -> FAIL: {needed - actual} tensor(s) missing. {ctc_name} would\n"
            f"     invent them at load time -- typically the CTC head, giving a\n"
            f"     randomly initialised LM head and pure noise, with no error."
        )
        ok = False
    elif needed < actual:
        print(
            f"  -> WARN: {actual - needed} extra tensor(s) in the checkpoint.\n"
            f"     Usually harmless (optimizer/quantization leftovers), but the\n"
            f"     weights were not saved from {ctc_name}."
        )

    # A declared architecture that disagrees with the weights means the config
    # is wrong about itself, even if the CTC class happens to fit.
    if declared_cls is not None and declared_name != ctc_name:
        declared_needs = _meta_tensor_count(declared_cls, config)
        print(f"  tensors {declared_name} needs: {declared_needs}")
        if declared_needs != actual:
            print(
                f"  !! config declares {declared_name} ({declared_needs} tensors) "
                f"but the file holds {actual} -- the config misdescribes itself"
            )
    elif declared_name and declared_cls is None:
        print(
            f"  !! config declares {declared_name}, which does not exist in "
            f"this transformers version"
        )

    if ok:
        print("  -> PASS")
    return ok


def main(argv: list[str]) -> int:
    if argv:
        repos = argv
    else:
        from app.core.config import settings

        repos = [settings.ASR_MODEL_ID, settings.ACOUSTIC_PHONEME_MODEL_ID]

    results = [verify(r) for r in repos]
    failed = results.count(False)
    print(f"\n{len(results) - failed}/{len(results)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
