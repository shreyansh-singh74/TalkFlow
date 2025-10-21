# backend/main.py
import os
import uuid
import subprocess
import aiofiles
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from faster_whisper import WhisperModel
import google.generativeai as genai
from typing import Optional, Dict, List
from dotenv import load_dotenv
from gtts import gTTS
from datetime import datetime, timedelta
import asyncio

load_dotenv()

app = FastAPI(title="LinguaLive Backend", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3002"],  # Add your frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is required")

genai.configure(api_key=GEMINI_API_KEY)

# Load faster-whisper model once at startup (CPU-friendly)
# Options: tiny, base, small, medium, large-v3. Prefer tiny/base for CPU.
WHISPER_MODEL_NAME = os.getenv("WHISPER_MODEL", "tiny")
print(f"Loading faster-whisper model: {WHISPER_MODEL_NAME}")
whisper_model = WhisperModel(WHISPER_MODEL_NAME, device="cpu", compute_type="int8")
print("faster-whisper model loaded successfully!")

# In-memory conversation storage
# Format: {conversation_id: {"history": [messages], "last_updated": datetime}}
conversations: Dict[str, dict] = {}

# Audio files cleanup tracker
audio_files: Dict[str, datetime] = {}

def ffmpeg_to_wav(in_path: str, out_path: str):
    """Convert audio file to 16k mono WAV using ffmpeg"""
    try:
        subprocess.run([
            "ffmpeg", "-y", "-i", in_path, "-ar", "16000", "-ac", "1", out_path
        ], check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=400, detail=f"Audio conversion failed: {e.stderr.decode()}")

def cleanup_old_audio_files():
    """Remove audio files older than 1 hour"""
    try:
        current_time = datetime.now()
        files_to_remove = []
        
        for filename, created_time in list(audio_files.items()):
            if current_time - created_time > timedelta(hours=1):
                file_path = f"/tmp/{filename}"
                if os.path.exists(file_path):
                    os.remove(file_path)
                    print(f"Cleaned up old audio file: {filename}")
                files_to_remove.append(filename)
        
        for filename in files_to_remove:
            del audio_files[filename]
    except Exception as e:
        print(f"Error during audio cleanup: {e}")

def get_or_create_conversation(conversation_id: Optional[str] = None) -> tuple[str, List]:
    """Get existing conversation or create new one"""
    if conversation_id and conversation_id in conversations:
        return conversation_id, conversations[conversation_id]["history"]
    else:
        new_id = str(uuid.uuid4())
        conversations[new_id] = {
            "history": [],
            "last_updated": datetime.now()
        }
        return new_id, []

@app.get("/")
async def root():
    return {"message": "LinguaLive Backend is running!", "status": "healthy"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "whisper_model": WHISPER_MODEL_NAME}

@app.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    """
    Simple transcription endpoint - returns only the transcribed text without AI processing
    """
    if not audio.filename:
        raise HTTPException(status_code=400, detail="No audio file provided")
    
    # Generate unique file names
    uid = str(uuid.uuid4())
    in_path = f"/tmp/{uid}_in_{audio.filename}"
    wav_path = f"/tmp/{uid}.wav"
    
    try:
        # Save uploaded file
        async with aiofiles.open(in_path, "wb") as f:
            content = await audio.read()
            await f.write(content)
        
        print(f"Saved audio file: {in_path} ({len(content)} bytes)")
        
        # Convert to WAV (ffmpeg must be installed)
        ffmpeg_to_wav(in_path, wav_path)
        print(f"Converted to WAV: {wav_path}")
        
        # Transcribe with faster-whisper
        print("Starting transcription...")
        segments, info = whisper_model.transcribe(
            wav_path,
            beam_size=1,
            vad_filter=True,
        )
        transcript = "".join(seg.text for seg in segments).strip()
        print(f"Transcript: {transcript}")
        
        if not transcript:
            return {
                "transcript": "",
                "success": False,
                "error": "No speech detected"
            }
        
        return {
            "transcript": transcript,
            "success": True
        }
        
    except Exception as e:
        print(f"Error processing audio: {str(e)}")
        return {
            "transcript": "",
            "error": str(e),
            "success": False
        }
    
    finally:
        # Cleanup temp files
        try:
            if os.path.exists(in_path):
                os.remove(in_path)
            if os.path.exists(wav_path):
                os.remove(wav_path)
        except Exception as e:
            print(f"Warning: Could not clean up temp files: {e}")

@app.post("/transcribe_and_reply")
async def transcribe_and_reply(
    audio: UploadFile = File(...),
    conversation_id: Optional[str] = Form(None)
):
    """
    Transcribe audio using Whisper and get a reply from Gemini with conversation context
    """
    if not audio.filename:
        raise HTTPException(status_code=400, detail="No audio file provided")
    
    # Generate unique file names
    uid = str(uuid.uuid4())
    in_path = f"/tmp/{uid}_in_{audio.filename}"
    wav_path = f"/tmp/{uid}.wav"
    audio_filename = f"{uid}_reply.mp3"
    audio_path = f"/tmp/{audio_filename}"
    
    try:
        # Cleanup old audio files periodically
        cleanup_old_audio_files()
        
        # Save uploaded file
        async with aiofiles.open(in_path, "wb") as f:
            content = await audio.read()
            await f.write(content)
        
        print(f"Saved audio file: {in_path} ({len(content)} bytes)")
        
        # Convert to WAV (ffmpeg must be installed)
        ffmpeg_to_wav(in_path, wav_path)
        print(f"Converted to WAV: {wav_path}")
        
        # Transcribe with faster-whisper
        print("Starting transcription...")
        segments, info = whisper_model.transcribe(
            wav_path,
            beam_size=1,
            vad_filter=True,
        )
        transcript = "".join(seg.text for seg in segments).strip()
        print(f"Transcript: {transcript}")
        
        if not transcript:
            return {
                "transcript": "",
                "reply": "I couldn't hear anything in the audio. Please try speaking more clearly.",
                "error": "No speech detected",
                "conversation_id": conversation_id
            }
        
        # Get or create conversation
        conv_id, history = get_or_create_conversation(conversation_id)
        print(f"Using conversation ID: {conv_id}")
        
        # Call Gemini with conversation history
        print("Calling Gemini...")
        model = genai.GenerativeModel(
            "gemini-1.5-flash",
            system_instruction="You are a friendly and helpful conversation partner. Engage in natural, casual conversation. Be concise but engaging. Keep responses to 2-3 sentences unless asked for more detail."
        )
        
        # Start chat with history
        chat = model.start_chat(history=history)
        
        # Send user message
        response = chat.send_message(transcript)
        reply_text = response.text
        print(f"Gemini reply: {reply_text}")
        
        # Update conversation history
        conversations[conv_id]["history"] = chat.history
        conversations[conv_id]["last_updated"] = datetime.now()
        
        # Convert reply to speech using gTTS
        print("Generating TTS audio...")
        tts = gTTS(text=reply_text, lang='en', slow=False)
        tts.save(audio_path)
        print(f"TTS audio saved: {audio_path}")
        
        # Track audio file for cleanup
        audio_files[audio_filename] = datetime.now()
        
        return {
            "transcript": transcript,
            "reply": reply_text,
            "audio_url": f"/audio/{audio_filename}",
            "conversation_id": conv_id,
            "success": True
        }
        
    except Exception as e:
        print(f"Error processing audio: {str(e)}")
        return {
            "transcript": "",
            "reply": f"Sorry, there was an error processing your audio: {str(e)}",
            "error": str(e),
            "conversation_id": conversation_id,
            "success": False
        }
    
    finally:
        # Cleanup temp files
        try:
            if os.path.exists(in_path):
                os.remove(in_path)
            if os.path.exists(wav_path):
                os.remove(wav_path)
        except Exception as e:
            print(f"Warning: Could not clean up temp files: {e}")

@app.get("/audio/{filename}")
async def serve_audio(filename: str):
    """
    Serve generated TTS audio files
    """
    file_path = f"/tmp/{filename}"
    
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    return FileResponse(
        file_path,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": f"inline; filename={filename}",
            "Cache-Control": "public, max-age=3600"
        }
    )

@app.post("/conversation/new")
async def create_new_conversation():
    """
    Create a new conversation and return its ID
    """
    conv_id = str(uuid.uuid4())
    conversations[conv_id] = {
        "history": [],
        "last_updated": datetime.now()
    }
    return {"conversation_id": conv_id, "success": True}

@app.get("/conversation/{conversation_id}")
async def get_conversation(conversation_id: str):
    """
    Retrieve conversation history
    """
    if conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conv = conversations[conversation_id]
    return {
        "conversation_id": conversation_id,
        "history": conv["history"],
        "last_updated": conv["last_updated"].isoformat(),
        "success": True
    }

@app.delete("/conversation/{conversation_id}")
async def delete_conversation(conversation_id: str):
    """
    Clear/delete conversation history
    """
    if conversation_id in conversations:
        del conversations[conversation_id]
        return {"message": "Conversation deleted successfully", "success": True}
    else:
        raise HTTPException(status_code=404, detail="Conversation not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)