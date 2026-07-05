# app/services/deepgram_service.py
"""
Simplified Deepgram service using prerecorded transcription
Since Deepgram SDK 5.x doesn't have a simple live API, we'll use prerecorded
with buffered audio chunks for now.
"""
from deepgram import DeepgramClient
from app.core.config import settings
import logging
from typing import Callable
import tempfile
import os
import asyncio

logger = logging.getLogger(__name__)


class DeepgramLiveService:
    """Manages Deepgram transcription with audio buffering"""
    
    def __init__(self, on_partial: Callable, on_final: Callable):
        self.on_partial = on_partial
        self.on_final = on_final
        self.deepgram = DeepgramClient(api_key=settings.DEEPGRAM_API_KEY)
        self.audio_buffer = bytearray()
        self.is_active = False
        
    async def start(self):
        """Start Deepgram service"""
        self.is_active = True
        logger.debug("Deepgram service started in buffered mode")
            
    async def send_audio(self, audio_chunk: bytes):
        """Buffer audio chunk for transcription"""
        if self.is_active:
            self.audio_buffer.extend(audio_chunk)
            
    async def finish(self):
        """Finalize transcript and send it"""
        if not self.is_active:
            return
            
        if len(self.audio_buffer) == 0:
            self.is_active = False
            return
            
        temp_file_path = None
        try:
            # Create temporary file for buffered audio
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as temp_file:
                # Write WAV header + PCM16 data
                # Simple WAV header for 16kHz mono PCM16
                sample_rate = settings.AUDIO_SAMPLE_RATE
                num_channels = 1
                bits_per_sample = 16
                byte_rate = sample_rate * num_channels * bits_per_sample // 8
                block_align = num_channels * bits_per_sample // 8
                data_size = len(self.audio_buffer)
                file_size = 36 + data_size
                
                wav_header = b'RIFF' + \
                    file_size.to_bytes(4, 'little') + \
                    b'WAVE' + \
                    b'fmt ' + \
                    (16).to_bytes(4, 'little') + \
                    (1).to_bytes(2, 'little') + \
                    num_channels.to_bytes(2, 'little') + \
                    sample_rate.to_bytes(4, 'little') + \
                    byte_rate.to_bytes(4, 'little') + \
                    block_align.to_bytes(2, 'little') + \
                    bits_per_sample.to_bytes(2, 'little') + \
                    b'data' + \
                    data_size.to_bytes(4, 'little')
                
                temp_file.write(wav_header)
                temp_file.write(self.audio_buffer)
                temp_file_path = temp_file.name
            
            # Read the file content
            with open(temp_file_path, 'rb') as f:
                audio_content = f.read()
            
            # Transcribe using Deepgram
            response = await asyncio.to_thread(
                self.deepgram.listen.v1.media.transcribe_file,
                request=audio_content,
                model=settings.DEEPGRAM_MODEL,
                language=settings.DEEPGRAM_LANGUAGE,
                smart_format=True,
                punctuate=True,
            )
            
            # Extract transcript
            if hasattr(response, 'results') and hasattr(response.results, 'channels'):
                transcript = response.results.channels[0].alternatives[0].transcript.strip()
                
                if transcript:
                    # Send as final transcript (no partial for buffered mode)
                    self.on_final(transcript, 1.0)
            
        except Exception:
            logger.exception("Deepgram transcription failed")
        finally:
            self.is_active = False
            self.audio_buffer.clear()
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                except Exception as e:
                    logger.warning("Failed to delete temporary file %s: %s", temp_file_path, e)
