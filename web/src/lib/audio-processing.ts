/**
 * Audio processing utilities for PCM16 conversion and chunking
 */

/**
 * Convert Float32Array audio samples to PCM16 (Int16Array)
 */
export function convertToPCM16(float32Samples: Float32Array): Int16Array {
  const pcm16 = new Int16Array(float32Samples.length);
  
  for (let i = 0; i < float32Samples.length; i++) {
    // Clamp to [-1, 1]
    const clamped = Math.max(-1, Math.min(1, float32Samples[i]));
    // Convert to 16-bit integer
    pcm16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
  }
  
  return pcm16;
}

/**
 * Resample audio to target sample rate (16kHz for Deepgram)
 */
export function resampleAudio(
  audioData: Float32Array,
  originalSampleRate: number,
  targetSampleRate: number
): Float32Array {
  if (originalSampleRate === targetSampleRate) {
    return audioData;
  }
  
  const ratio = originalSampleRate / targetSampleRate;
  const newLength = Math.round(audioData.length / ratio);
  const result = new Float32Array(newLength);
  
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const srcIndexFloor = Math.floor(srcIndex);
    const srcIndexCeil = Math.min(srcIndexFloor + 1, audioData.length - 1);
    const fraction = srcIndex - srcIndexFloor;
    
    // Linear interpolation
    result[i] = audioData[srcIndexFloor] * (1 - fraction) + 
                audioData[srcIndexCeil] * fraction;
  }
  
  return result;
}

/**
 * Create audio chunks at specified interval (100ms)
 */
export class AudioChunker {
  private context: AudioContext;
  private processor: ScriptProcessorNode;
  private source: MediaStreamAudioSourceNode;
  private onChunk: (chunk: Int16Array) => void;
  private targetSampleRate: number;
  
  constructor(
    stream: MediaStream,
    onChunk: (chunk: Int16Array) => void,
    targetSampleRate: number = 16000
  ) {
    this.onChunk = onChunk;
    this.targetSampleRate = targetSampleRate;
    
    // Don't specify sampleRate - let it use the stream's native rate
    // Firefox doesn't allow connecting MediaStreamAudioSourceNode to AudioContext
    // with different sample rates
    this.context = new AudioContext();
    console.info("AudioContext created", { sampleRate: this.context.sampleRate });
    this.source = this.context.createMediaStreamSource(stream);
    
    // 4096 samples at native rate
    this.processor = this.context.createScriptProcessor(4096, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const nativeSampleRate = this.context.sampleRate;
      
      // Resample if needed
      let processedData: Float32Array;
      if (nativeSampleRate !== targetSampleRate) {
        processedData = resampleAudio(inputData, nativeSampleRate, targetSampleRate);
      } else {
        processedData = inputData;
      }
      
      const pcm16 = convertToPCM16(processedData);
      this.onChunk(pcm16);
    };
    
    this.source.connect(this.processor);
    this.processor.connect(this.context.destination);
  }
  
  stop() {
    this.processor.disconnect();
    this.source.disconnect();
    this.context.close();
  }
}
