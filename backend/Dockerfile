# CPU-only backend image.
#
# Deliberately CPU-only: the default PyTorch wheel pulls in ~1.2 GB of CUDA
# libraries that never execute on a host without a GPU, and the models run at
# 0.37x realtime on 2 vCPUs, which is fine for push-to-talk. See
# backend/README.md for the measured numbers and the memory budget.
#
# ffmpeg is NOT installed: it is only needed by scripts/smoke_pipeline.py, which
# converts Google TTS output to WAV for local checks. The running service never
# touches it (TTS returns MP3, which the browser plays directly).

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    # Keep the model cache where compose mounts a volume. Without this a
    # rebuild re-downloads 3.6 GB.
    HF_HOME=/models \
    TOKENIZERS_PARALLELISM=false

WORKDIR /app

# Requirements first: this layer is cached across source edits.
COPY requirements.txt .
RUN pip install --upgrade pip \
 && pip install --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

COPY . .

# The service writes only to the model cache and (optionally) the turn-audio
# directory, so it does not need to own the code.
RUN useradd --create-home --uid 10001 talkflow \
 && mkdir -p /tmp/talkflow_audio /models \
 && chown -R talkflow:talkflow /app /models /tmp/talkflow_audio
USER talkflow

EXPOSE 8000

# One worker on purpose: each worker would load its own copy of both models, and
# the models are multi-GB. Scale by instance, not by worker count.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
