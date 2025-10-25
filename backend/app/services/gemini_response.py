import google.generativeai as genai
from app.core.config import settings
import os
import asyncio
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from typing import List, Dict, Optional

# Suppress Google API warnings
os.environ['GRPC_VERBOSITY'] = 'ERROR'
os.environ['GLOG_minloglevel'] = '2'

def _call_gemini(prompt: str) -> str:
    """Internal function to call Gemini API"""
    model = genai.GenerativeModel(
        "gemini-2.0-flash",
        system_instruction=(
            "You are an English-speaking coach helping users improve conversational English.\n"
            "Be concise and encouraging. Keep responses to 2-3 sentences.\n"
            "If you notice grammar errors, gently correct them and ask the user to repeat.\n"
            "Ask follow-up questions to keep the conversation going.\n"
            "Remember the context of previous messages in the conversation."
        )
    )
    
    response = model.generate_content(
        prompt,
        generation_config=genai.types.GenerationConfig(
            temperature=0.7,
            max_output_tokens=150,  # Keep responses short
        )
    )
    return response.text

def get_gemini_response(
    current_text: str,
    conversation_history: Optional[List[Dict]] = None
) -> str:
    """
    Generate AI response using Gemini with conversation context
    
    Args:
        current_text: The current user's message
        conversation_history: List of previous turns [{"user": str, "ai": str, "turn": int}]
    
    Returns:
        AI response text
    """
    try:
        # Build conversation context
        context_messages = []
        
        if conversation_history:
            print(f"🧠 Building context with {len(conversation_history)} previous turns")
            for turn in conversation_history:
                context_messages.append(f"User: {turn['user']}")
                context_messages.append(f"Assistant: {turn['ai']}")
        
        # Add current message
        context_messages.append(f"User: {current_text}")
        
        # Create full prompt with context
        full_prompt = "\n".join(context_messages)
        
        print(f"🤖 Calling Gemini with context (total length: {len(full_prompt)} chars)")
        if conversation_history:
            print(f"📝 Current: '{current_text}'")
        else:
            print(f"🤖 Calling Gemini for: '{current_text}'")
        
        # Use ThreadPoolExecutor with timeout
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_call_gemini, full_prompt)
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
