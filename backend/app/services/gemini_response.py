import google.generativeai as genai
from app.core.config import settings
import os
import asyncio
from concurrent.futures import ThreadPoolExecutor, TimeoutError

# Suppress Google API warnings
os.environ['GRPC_VERBOSITY'] = 'ERROR'
os.environ['GLOG_minloglevel'] = '2'

def _call_gemini(transcript: str) -> str:
    """Internal function to call Gemini API"""
    model = genai.GenerativeModel(
        "gemini-2.0-flash",
        system_instruction=(
            "You are an English-speaking coach helping users improve conversational English.\n"
            "Be concise and encouraging. Keep responses to 2-3 sentences.\n"
            "If you notice grammar errors, gently correct them and ask the user to repeat.\n"
            "Ask follow-up questions to keep the conversation going."
        )
    )
    
    response = model.generate_content(
        transcript,
        generation_config=genai.types.GenerationConfig(
            temperature=0.7,
            max_output_tokens=150,  # Keep responses short
        )
    )
    return response.text

def get_gemini_response(transcript: str) -> str:
    """Generate AI response using Gemini with timeout"""
    try:
        print(f"🤖 Calling Gemini for: '{transcript}'")
        
        # Use ThreadPoolExecutor with timeout
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_call_gemini, transcript)
            try:
                reply_text = future.result(timeout=10)  # 10 second timeout
                print(f"✓ AI Response: {reply_text[:100]}...")
                return reply_text
            except TimeoutError:
                print("✗ Gemini timeout after 10 seconds")
                return "I'm thinking too long. Can you try again?"
        
    except Exception as e:
        print(f"✗ Gemini Error: {type(e).__name__}: {e}")
        return "Sorry, I couldn't generate a response. Please try again."
