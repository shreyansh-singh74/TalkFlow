# TalkFlow Backend

FastAPI service for realtime voice practice and pronunciation analysis.

## Runtime

- `/ws/voice`: WebSocket voice session. Receives PCM16 audio chunks, uses Wav2Vec2 for transcription, OpenRouter for LLM responses, Google Cloud TTS for audio replies, and emits pronunciation feedback.
- `/api/phonemes/*`: HTTP pronunciation utilities for sentence analysis, word analysis, IPA lookup, comparison, and reference syllables.
- `/health`: service health check.

The old multipart `/transcribe` and `/clear-conversation` HTTP flow has been removed.

## Environment

```env
FRONTEND_URL=http://localhost:3000
OPENROUTER_API_KEY=
GOOGLE_APPLICATION_CREDENTIALS=/path/to/google-credentials.json
# or GOOGLE_CREDENTIALS_JSON=<base64-json>
ENABLE_WAV2VEC2=1
WARM_WAV2VEC2_ON_STARTUP=1
WAV2VEC2_MODEL_ID=facebook/wav2vec2-base-960h
TURN_AUDIO_MAX_BYTES=160000
```

## Install

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Test

```bash
python -m unittest discover -s tests
```

## API Smoke Checks

```bash
curl http://localhost:8000/health
curl http://localhost:8000/api/phonemes/reference/hello
```

The frontend should connect to `NEXT_PUBLIC_BACKEND_URL/ws/voice`.
