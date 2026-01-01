# TalkFlow Backend - Speech-to-Text with Deepgram

A simple FastAPI backend that converts audio to text using Whisper.

## What It Does

**Complete Conversation Flow:**
```
Frontend sends audio → Deepgram transcribes → Gemini AI responds → Google TTS → Returns transcript + AI reply + audio
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
    │   └── models.py               # AI model configuration
    ├── services/
    │   ├── transcription_service.py # Deepgram transcription
    │   ├── gemini_response.py      # AI conversation
    │   └── tts_service.py          # Text-to-speech
    └── schemas/
        └── responses.py            # API response models
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

## Configuration

Create a `.env` file in the backend directory:

```env
# AI and API Keys
DEEPGRAM_API_KEY=your_deepgram_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_APPLICATION_CREDENTIALS=path/to/your/google-credentials.json

# Optional: CORS origins
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3002
```

## Getting API Keys

### Deepgram API Key
1. Sign up at [deepgram.com](https://deepgram.com)
2. Navigate to API Keys in the dashboard
3. Copy your API key

### Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com)
2. Create a new API key
3. Copy your API key

### Google Cloud TTS
1. Create a Google Cloud project
2. Enable Cloud Text-to-Speech API
3. Create a service account and download JSON credentials
4. Place the JSON file in your project directory

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
GET /health
```

Response:
```json
{
  "status": "healthy",
  "transcription_service": "deepgram"
}
```

### Transcribe Audio
```
POST /transcribe
Content-Type: multipart/form-data

Body: 
  - audio: <audio file>
  - conversation_id: <optional string>
  - turn_number: <optional int>
```

Response:
```json
{
  "transcript": "Hello, how are you?",
  "reply": "I'm doing great! How can I help you today?",
  "audio": "base64_encoded_mp3_audio",
  "success": true
}
```

## Example Usage

### Using curl
```bash
curl -X POST http://localhost:8000/transcribe \
  -F "audio=@recording.webm" \
  -F "conversation_id=abc123" \
  -F "turn_number=1"
```

### Using JavaScript (Frontend)
```javascript
const formData = new FormData();
formData.append('audio', audioBlob, 'recording.webm');
formData.append('conversation_id', 'abc123');
formData.append('turn_number', '1');

const response = await fetch('http://localhost:8000/transcribe', {
  method: 'POST',
  body: formData
});

const data = await response.json();
console.log(data.transcript);  // User speech
console.log(data.reply);       // AI response
// data.audio contains base64 MP3
```

## Features

- **Deepgram Transcription** - High-quality speech-to-text  
- **Gemini AI** - Intelligent, context-aware responses  
- **Google Cloud TTS** - Natural text-to-speech  
- **Conversation Memory** - Maintains context across turns  
- **CORS Support** - Frontend integration ready  
- **Error Handling** - Robust error management  
- **Audio Format Support** - Multiple audio formats accepted  

## Configuration Options

Edit `app/core/config.py` or environment variables to customize:

- **Deepgram Model**: Currently using `nova-2` (configured in transcription_service.py)
- **TTS Voice**: `en-US-Neural2-C` (female) or `en-US-Neural2-D` (male)
- **Speaking Rate**: Default 1.0
- **Conversation History**: Last 10 turns maintained in memory

## Dependencies

- **fastapi**: Web framework
- **uvicorn**: ASGI server
- **deepgram-sdk**: Deepgram transcription
- **google-generativeai**: Gemini AI
- **google-cloud-texttospeech**: Google Cloud TTS
- **python-multipart**: File upload support
- **python-dotenv**: Environment variables

## Troubleshooting

**Deepgram API key not working:**
- Verify your API key is correct
- Check your Deepgram account has sufficient credits
- Ensure the key is set in `.env` file

**Gemini API errors:**
- Verify API key is active in Google AI Studio
- Check rate limits
- Ensure content policy compliance

**Google TTS not working:**
- Verify `GOOGLE_APPLICATION_CREDENTIALS` path is correct
- Ensure Cloud Text-to-Speech API is enabled
- Check service account has proper permissions

**Port already in use:**
```bash
lsof -ti:8000 | xargs kill -9
```

## Production Deployment

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

For production, consider:
- Using Redis for conversation storage
- Implementing rate limiting
- Adding authentication
- Setting up proper logging
- Using environment-specific configurations

---

**Powered by Deepgram + Gemini + Google Cloud TTS**
