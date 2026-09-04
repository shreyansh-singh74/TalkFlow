# TalkFlow

TalkFlow is a real-time, AI-powered spoken English practice application. It combines an interactive Next.js web interface with a FastAPI backend to provide real-time voice practice sessions, automated text-to-speech feedback, LLM conversational practice, and phoneme-level pronunciation analysis.

## Tech Stack

### Web Frontend
- **Framework:** Next.js 15 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS v4, Radix UI components, Lucide React icons
- **State & Data Fetching:** TanStack Query (React Query), TanStack Table
- **Authentication:** Better Auth (GitHub OAuth, Google OAuth, Email & Password)
- **Database & ORM:** PostgreSQL (Neon Serverless), Drizzle ORM, Drizzle Kit

### Backend API & ML Engine
- **Framework:** FastAPI, Uvicorn (WebSockets & HTTP)
- **Audio & ML Processing:** PyTorch, Hugging Face Transformers (WavLM ASR + phoneme-CTC scoring)
- **LLM Integration:** OpenRouter API
- **Text-to-Speech:** Google Cloud Text-to-Speech API
- **Phonetics & Scoring:** g2p-en, CMUDict, PyPhen, Acoustic Phoneme Alignment

## Project Structure

```
TalkFlow/
├── backend/            # FastAPI service (WebSockets, Speech-to-Text, LLM, TTS, Phoneme Scoring)
├── web/                # Next.js web application (UI, Authentication, Database CRUD)
└── docs/               # Technical documentation
```

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Python 3.10+
- PostgreSQL database (e.g., Neon)

### 1. Backend Setup

Navigate to the `backend` directory, create and activate a virtual environment, install dependencies, and start the service:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 2. Web Setup

In a new terminal window, navigate to the `web` directory, install dependencies, and start the development server:

```bash
cd web
npm install
npm run dev
```

The application will be available at `http://localhost:3000`.

## Environment Variables

### Web Configuration (`web/.env`)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/talkflow
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
BETTER_AUTH_SECRET=your_better_auth_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_email_password
```

### Backend Configuration (`backend/.env`)

```env
FRONTEND_URL=http://localhost:3000
OPENROUTER_API_KEY=your_openrouter_api_key
GOOGLE_APPLICATION_CREDENTIALS=/path/to/google-credentials.json
# Alternative: GOOGLE_CREDENTIALS_JSON=<base64-encoded-json>
ENABLE_ASR=1
WARM_ASR_ON_STARTUP=1
ASR_MODEL_ID=patrickvonplaten/wavlm-libri-clean-100h-large
# 15s of 16kHz mono PCM16. Practice sentences take 6-10s at learner pace.
TURN_AUDIO_MAX_BYTES=480000
ENABLE_ACOUSTIC_SCORING=1
WARM_ACOUSTIC_ON_STARTUP=1
ACOUSTIC_PHONEME_MODEL_ID=vitouphy/wav2vec2-xls-r-300m-timit-phoneme
```

> **Renamed variables.** `ENABLE_WAV2VEC2` and `WARM_WAV2VEC2_ON_STARTUP` are
> still accepted as deprecated aliases. `WAV2VEC2_MODEL_ID` is **not** — it is
> ignored with a startup warning, because honouring it would silently pin the
> old wav2vec2 checkpoint and WavLM would never load. Rename it to
> `ASR_MODEL_ID` in your `.env` and in the Railway dashboard.

> **Memory.** WavLM-Large (1.26 GB) and the phoneme model (1.26 GB) are both fp32 and
> resident at once: **3.6 GB peak RSS, measured on the running server**. A 512 MB–1 GB
> container will OOM, and a 4 GB host is too tight. On a memory-capped host set
> `WARM_ACOUSTIC_ON_STARTUP=0` to defer the phoneme load, then fall back to
> `ASR_MODEL_ID=patrickvonplaten/wavlm-libri-clean-100h-base-plus` (2.8 GB peak, 2.9× faster
> ASR). base-plus does **not** reduce pronunciation-scoring accuracy — only the displayed
> transcript. See [backend/README.md](backend/README.md#deploying-on-a-small-vps).

## Database Management

To apply schema migrations or launch Drizzle Studio:

```bash
cd web
npm run db:push
npm run db:studio
```

## Testing & Verification

### Web Frontend
```bash
cd web
npm run lint
npm run build
```

### Backend API
```bash
cd backend
python -m unittest discover -s tests
```
