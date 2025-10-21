# TalkFlow Backend - Speech-to-Text Only

A simple FastAPI backend that converts audio to text using Whisper.

## What It Does

**Simple Flow:**
```
Frontend sends audio → Backend transcribes → Returns text
```

## Project Structure

```
backend/
├── main.py                          # Application entry point
├── requirements.txt                 # Python dependencies
└── app/
    ├── api/routes/
    │   ├── health.py               # Health check endpoints
    │   └── transcription.py        # Audio transcription endpoint
    ├── core/
    │   ├── config.py               # Configuration
    │   └── models.py               # Whisper model loading
    ├── services/
    │   └── transcription_service.py # Transcription logic
    └── utils/
        └── audio_utils.py          # Audio conversion
```

## Installation

1. Create and activate virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Ensure ffmpeg is installed:
```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg
```

## Running the Server

```bash
# Development
python3 main.py

# Or with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Server will start at: `http://localhost:8000`

## API Endpoints

### Health Check
```
GET /
GET /health
```

Response:
```json
{
  "status": "healthy",
  "whisper_model": "tiny"
}
```

### Transcribe Audio
```
POST /transcribe
Content-Type: multipart/form-data

Body: { audio: <audio file> }
```

Response:
```json
{
  "transcript": "transcribed text here",
  "success": true
}
```

## Example Usage

### Using curl
```bash
curl -X POST http://localhost:8000/transcribe \
  -F "audio=@recording.webm"
```

### Using JavaScript (Frontend)
```javascript
const formData = new FormData();
formData.append('audio', audioBlob, 'recording.webm');

const response = await fetch('http://localhost:8000/transcribe', {
  method: 'POST',
  body: formData
});

const data = await response.json();
console.log(data.transcript); // "Hello, this is the transcribed text"
```

## Configuration

Edit `app/core/config.py` to modify:
- **WHISPER_MODEL**: Model size (tiny/base/small/medium/large)
- **ALLOWED_ORIGINS**: CORS origins for frontend
- **AUDIO_SAMPLE_RATE**: Audio sample rate (default: 16000)

## Features

✅ Speech-to-text using faster-whisper  
✅ Automatic audio format conversion  
✅ CORS support for frontend integration  
✅ Clean, simple codebase  
✅ Fast and efficient  

## What Was Removed

This is a simplified version. Removed features:
- ❌ AI conversation (Gemini)
- ❌ Text-to-speech (TTS)
- ❌ Conversation memory
- ❌ Audio file serving

**This backend ONLY does transcription!**

## Dependencies

- **fastapi**: Web framework
- **uvicorn**: ASGI server
- **faster-whisper**: Efficient Whisper implementation
- **python-multipart**: File upload support
- **python-dotenv**: Environment variables

## Environment Variables (Optional)

Create a `.env` file:
```env
WHISPER_MODEL=tiny
```

Available models: `tiny`, `base`, `small`, `medium`, `large-v3`

## Troubleshooting

**Port already in use:**
```bash
lsof -ti:8000 | xargs kill -9
```

**FFmpeg not found:**
```bash
# Install ffmpeg
sudo apt-get install ffmpeg  # Ubuntu
brew install ffmpeg          # macOS
```

## Production Deployment

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

**Simple. Fast. Just transcription.** 🎤→📝
