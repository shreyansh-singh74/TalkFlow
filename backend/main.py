# backend/main.py
import os
import uuid
import subprocess
import aiofiles
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
import google.generativeai as genai
from typing import Optional
from dotenv import load_dotenv

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

def ffmpeg_to_wav(in_path: str, out_path: str):
    """Convert audio file to 16k mono WAV using ffmpeg"""
    try:
        subprocess.run([
            "ffmpeg", "-y", "-i", in_path, "-ar", "16000", "-ac", "1", out_path
        ], check=True, capture_output=True)
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=400, detail=f"Audio conversion failed: {e.stderr.decode()}")

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
async def transcribe_and_reply(audio: UploadFile = File(...)):
    """
    Transcribe audio using Whisper and get a reply from Gemini
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
                "reply": "I couldn't hear anything in the audio. Please try speaking more clearly.",
                "error": "No speech detected"
            }
        
        # Call Gemini (chat) to generate a reply
        print("Calling Gemini...")
        model = genai.GenerativeModel("gemini-1.5-flash")
        chat = model.start_chat()
        
        # Prompt instructs Gemini to reply like an English tutor
        user_prompt = f"""You are an English pronunciation tutor. The user said: "{transcript}".

Please provide:
1) A short correction or feedback (1-2 sentences)
2) One clear tip to improve pronunciation (with phonetic hint if helpful)
3) A short example sentence for practice

Reply in plain text, be encouraging and helpful."""
        
        response = chat.send_message(user_prompt)
        reply_text = response.text
        print(f"Gemini reply: {reply_text}")
        
        return {
            "transcript": transcript,
            "reply": reply_text,
            "success": True
        }
        
    except Exception as e:
        print(f"Error processing audio: {str(e)}")
        return {
            "transcript": "",
            "reply": f"Sorry, there was an error processing your audio: {str(e)}",
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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)