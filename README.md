# TalkFlow

TalkFlow is a spoken-English practice app. Next.js owns auth, database CRUD, and UI; FastAPI owns realtime voice, LLM responses, text-to-speech, and pronunciation feedback.

## Stack

- Web: Next.js 15, React 19, TypeScript, Tailwind CSS, Better Auth, Drizzle ORM
- Backend: FastAPI, Deepgram, OpenRouter, Google Cloud Text-to-Speech, optional wav2vec2 pronunciation comparison
- Database: Postgres via `DATABASE_URL`

## Supported APIs

- Web: `/api/auth/*`, `/api/agents*`, `/api/meetings*`
- Backend: `/health`, `/ws/voice`, `/api/phonemes/*`

Removed prototype surfaces include `/test-recorder`, `/upgrade`, `/api/config`, `/api/meetings/generate-token`, `/api/webhook`, `/transcribe`, and `/clear-conversation`.

## Environment

Web:

```env
DATABASE_URL=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
BETTER_AUTH_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
```

Backend:

```env
FRONTEND_URL=http://localhost:3000
OPENROUTER_API_KEY=
DEEPGRAM_API_KEY=
GOOGLE_APPLICATION_CREDENTIALS=/path/to/google-credentials.json
# or GOOGLE_CREDENTIALS_JSON=<base64-json>
ENABLE_WAV2VEC2=0
WARM_WAV2VEC2_ON_STARTUP=0
WAV2VEC2_MODEL_ID=facebook/wav2vec2-base-960h
TURN_AUDIO_MAX_BYTES=160000
# Acoustic pronunciation scoring: score the audio waveform (wav2vec2 phoneme
# recognition + GOP alignment) instead of comparing transcript text. When 0,
# the legacy text-proxy scorer is used.
ENABLE_ACOUSTIC_SCORING=0
WARM_ACOUSTIC_ON_STARTUP=0
ACOUSTIC_PHONEME_MODEL_ID=facebook/wav2vec2-lv-60-espeak-cv-ft
```

## Run Locally

Backend:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Web:

```bash
cd web
npm install
npm run dev
```

## Checks

```bash
cd web
npm run lint
npm run build
```

```bash
cd backend
python -m unittest discover -s tests
```
