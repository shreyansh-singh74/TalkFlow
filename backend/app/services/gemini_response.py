import google.generativeai as genai
from app.core.config import settings
import os
import asyncio
import time
import re
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from typing import List, Dict, Optional, AsyncGenerator

# Suppress Google API warnings
os.environ['GRPC_VERBOSITY'] = 'ERROR'
os.environ['GLOG_minloglevel'] = '2'

async def stream_gemini_response(
    current_text: str,
    conversation_history: Optional[List[Dict]] = None,
    is_first_turn: bool = False
) -> AsyncGenerator[str, None]:
    """
    Stream AI response tokens from Gemini with conversation context
    
    Args:
        current_text: The current user's message
        conversation_history: List of previous turns
        is_first_turn: If True, uses Policy A (fast), else Policy B (punctuation-aware)
    
    Yields:
        Text chunks (tokens batched by policy)
    """
    try:
        # Build conversation context
        context_messages = []
        
        if conversation_history:
            print(f"🧠 Building context with {len(conversation_history)} previous turns")
            for turn in conversation_history[-10:]:  # Keep last 10 turns
                context_messages.append(f"User: {turn['user']}")
                context_messages.append(f"Assistant: {turn['ai']}")
        
        context_messages.append(f"User: {current_text}")
        full_prompt = "\n".join(context_messages)
        
        print(f"🤖 Streaming Gemini with context (length: {len(full_prompt)} chars)")
        
        # Initialize model with streaming
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
            full_prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.7,
                max_output_tokens=150,
            ),
            stream=True
        )
        
        # Token batching buffer
        token_buffer = ""
        token_count = 0
        last_flush_time = time.time() * 1000  # ms
        
        # Policy parameters
        if is_first_turn:
            # Policy A: Low latency (10-30 tokens or 100-200ms)
            min_tokens = 10
            max_tokens = 30
            flush_interval_ms = 150  # 150ms
            print("📊 Using Policy A (low latency)")
        else:
            # Policy B: Punctuation-aware (flush on sentence end or N tokens)
            min_tokens = 15
            max_tokens = 50
            flush_interval_ms = 300  # 300ms
            print("📊 Using Policy B (punctuation-aware)")
        
        for chunk in response:
            if not chunk.text:
                continue
                
            token_buffer += chunk.text
            token_count += len(chunk.text.split())
            current_time = time.time() * 1000  # ms
            
            # Flush conditions
            should_flush = False
            
            if is_first_turn:
                # Policy A: Time-based or token count
                if token_count >= min_tokens or (current_time - last_flush_time) >= flush_interval_ms:
                    should_flush = True
            else:
                # Policy B: Punctuation-aware
                if re.search(r'[.!?]\s*$', token_buffer):  # Sentence end
                    should_flush = True
                elif token_count >= max_tokens:
                    should_flush = True
                elif token_count >= min_tokens and (current_time - last_flush_time) >= flush_interval_ms:
                    should_flush = True
            
            if should_flush and token_buffer.strip():
                print(f"💬 Flushing: {len(token_buffer)} chars, {token_count} tokens")
                yield token_buffer
                token_buffer = ""
                token_count = 0
                last_flush_time = current_time
        
        # Flush remaining
        if token_buffer.strip():
            print(f"💬 Final flush: {len(token_buffer)} chars")
            yield token_buffer
            
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"✗ Gemini Streaming Error: {type(e).__name__}: {e}")
        print(f"Full traceback:\n{error_details}")
        
        # Handle specific error types
        error_str = str(e).lower()
        error_type = type(e).__name__
        
        if "quota" in error_str or "429" in error_str or "ResourceExhausted" in error_type:
            yield "API quota exceeded. Please get a new Gemini API key from https://aistudio.google.com/app/apikey"
        elif "401" in error_str or "403" in error_str or "invalid" in error_str:
            yield "Invalid API key. Please check your Gemini API configuration."
        elif isinstance(e, ValueError) and "Content blocked" in str(e):
            yield "I was blocked from answering that. Could you rephrase your message?"
        else:
            yield "Sorry, I couldn't generate a response. Please try again."


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
        import traceback
        error_details = traceback.format_exc()
        print(f"✗ Gemini Error: {type(e).__name__}: {e}")
        print(f"Full traceback:\n{error_details}")
        
        # Handle specific error types
        error_str = str(e).lower()
        error_type = type(e).__name__
        
        if "quota" in error_str or "429" in error_str or "ResourceExhausted" in error_type:
            return "API quota exceeded. Please get a new Gemini API key from https://aistudio.google.com/app/apikey"
        elif "401" in error_str or "403" in error_str or "invalid" in error_str:
            return "Invalid API key. Please check your Gemini API configuration."
        elif isinstance(e, ValueError) and "Content blocked" in str(e):
            return "I was blocked from answering that. Could you rephrase your question?"
        
        return "Sorry, I couldn't generate a response. Please try again."
