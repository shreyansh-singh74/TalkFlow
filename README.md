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
- **Audio & ML Processing:** PyTorch, Hugging Face Transformers (Wav2Vec2 ASR)
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
ENABLE_WAV2VEC2=1
WARM_WAV2VEC2_ON_STARTUP=1
WAV2VEC2_MODEL_ID=facebook/wav2vec2-base-960h
TURN_AUDIO_MAX_BYTES=160000
ENABLE_ACOUSTIC_SCORING=0
WARM_ACOUSTIC_ON_STARTUP=0
ACOUSTIC_PHONEME_MODEL_ID=facebook/wav2vec2-lv-60-espeak-cv-ft
```

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
