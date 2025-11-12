# **TalkFlow**

> **AI-Powered Language Learning Platform** — Practice pronunciation with personalized AI tutors and real-time feedback.

---

## Overview
**TalkFlow** helps users improve pronunciation and speaking fluency through AI tutors that provide instant, personalized feedback. Built with **Next.js** and **FastAPI**, it combines modern web technologies with AI models like **Google Gemini** and **OpenAI Whisper**.

---

## Tech Stack
**Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS, Better Auth  
**Backend:** FastAPI, Python 3.12, OpenAI Whisper, Google Gemini  
**Database:** Drizzle ORM  
**Other:** ffmpeg (audio processing)

---

## Features
- Create custom AI tutors  
- Real-time pronunciation feedback  
- Track session analytics  
- Manage and schedule meetings  
- Secure authentication  
- Fully responsive UI

---

## Setup

**Requirements:**  
Node.js 18+, Python 3.12+, ffmpeg

```bash
# Clone repo
git clone https://github.com/yourusername/TalkFlow.git
cd TalkFlow
````

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```

### Frontend

```bash
cd web
npm install
npm run dev
```

**Environment variables (.env):**

```bash
GEMINI_API_KEY="your-gemini-api-key"
WHISPER_MODEL="base"
```

---

## How It Works

1. Create an account
2. Build your AI tutor
3. Schedule a meeting
4. Speak and get feedback
5. Track progress over time

---

## Core APIs

* `/api/conversations` — Create conversation
* `/api/analyse` — Get pronunciation metrics
* `/api/reports` — Fetch session analytics

---

## Contributing

Fork → Create branch → Commit → PR

---

## License

MIT © 2025 TalkFlow
