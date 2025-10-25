/**
 * Audio Buffer Utilities for Pre-Speech Capture
 * Implements circular buffer for capturing audio before speech detection
 */

export class CircularAudioBuffer {
  private buffer: Float32Array;
  private writeIndex: number = 0;
  private size: number;
  private filled: boolean = false;

  constructor(sampleRate: number, durationMs: number) {
    // Calculate buffer size based on sample rate and duration
    this.size = Math.floor((sampleRate * durationMs) / 1000);
    this.buffer = new Float32Array(this.size);
  }

  /**
   * Write audio data to the circular buffer
   */
  write(data: Float32Array): void {
    for (let i = 0; i < data.length; i++) {
      this.buffer[this.writeIndex] = data[i];
      this.writeIndex = (this.writeIndex + 1) % this.size;
      
      // Mark as filled once we've written enough data
      if (this.writeIndex === 0) {
        this.filled = true;
      }
    }
  }

  /**
   * Read all buffered audio data in correct order
   * Returns audio from oldest to newest
   */
  read(): Float32Array {
    if (!this.filled) {
      // Buffer not full yet, return only written portion
      return this.buffer.slice(0, this.writeIndex);
    }

    // Buffer is full, need to reorder from writeIndex (oldest) to writeIndex-1 (newest)
    const result = new Float32Array(this.size);
    for (let i = 0; i < this.size; i++) {
      result[i] = this.buffer[(this.writeIndex + i) % this.size];
    }
    return result;
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer.fill(0);
    this.writeIndex = 0;
    this.filled = false;
  }

  /**
   * Get current buffer size in samples
   */
  getSize(): number {
    return this.filled ? this.size : this.writeIndex;
  }
}

/**
 * Calculate rolling average of audio levels for smoothing
 */
export class RollingAverage {
  private values: number[];
  private index: number = 0;
  private size: number;
  private filled: boolean = false;

  constructor(windowSize: number) {
    this.size = windowSize;
    this.values = new Array(windowSize).fill(0);
  }

  /**
   * Add a new value and return the current average
   */
  add(value: number): number {
    this.values[this.index] = value;
    this.index = (this.index + 1) % this.size;
    
    if (this.index === 0) {
      this.filled = true;
    }

    // Calculate average
    const count = this.filled ? this.size : this.index;
    const sum = this.values.slice(0, count).reduce((a, b) => a + b, 0);
    return sum / count;
  }

  /**
   * Reset the rolling average
   */
  reset(): void {
    this.values.fill(0);
    this.index = 0;
    this.filled = false;
  }
}

/**
 * Convert Float32Array audio to WAV Blob
 */
export function float32ArrayToWav(
  audioData: Float32Array,
  sampleRate: number
): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;

  const dataLength = audioData.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  // Write WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // Subchunk1Size
  view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  // Write audio data
  let offset = 44;
  for (let i = 0; i < audioData.length; i++) {
    const sample = Math.max(-1, Math.min(1, audioData[i]));
    const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Concatenate multiple Float32Array buffers
 */
export function concatenateAudioBuffers(
  buffers: Float32Array[]
): Float32Array {
  const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
  const result = new Float32Array(totalLength);
  
  let offset = 0;
  for (const buffer of buffers) {
    result.set(buffer, offset);
    offset += buffer.length;
  }
  
  return result;
}

/**
 * Calculate average audio level from frequency data
 */
export function calculateAudioLevel(frequencyData: Uint8Array): number {
  const sum = frequencyData.reduce((acc, val) => acc + val, 0);
  return sum / frequencyData.length;
}

/**
 * Exponential Moving Average for more responsive audio level detection
 * More responsive to recent changes than rolling average
 */
export class ExponentialMovingAverage {
  private alpha: number;
  private ema: number = 0;
  private initialized: boolean = false;

  constructor(alpha: number = 0.3) {
    this.alpha = alpha; // Smoothing factor (0-1, higher = less smoothing)
  }

  /**
   * Add a new value and return the exponential moving average
   */
  add(value: number): number {
    if (!this.initialized) {
      this.ema = value;
      this.initialized = true;
      return value;
    }

    this.ema = this.alpha * value + (1 - this.alpha) * this.ema;
    return this.ema;
  }

  /**
   * Get current EMA value
   */
  getValue(): number {
    return this.ema;
  }

  /**
   * Reset the EMA
   */
  reset(): void {
    this.ema = 0;
    this.initialized = false;
  }
}

/**
 * Adaptive threshold detector for dynamic speech detection
 * Automatically adjusts threshold based on ambient noise level
 */
export class AdaptiveThresholdDetector {
  private ambientNoise: number = 0;
  private speechPeaks: number[] = [];
  private ambientSamples: number[] = [];
  private readonly maxAmbientSamples = 100; // Track last 100 samples

  /**
   * Calibrate ambient noise level when user is not speaking
   */
  calibrate(audioLevel: number): void {
    this.ambientSamples.push(audioLevel);
    if (this.ambientSamples.length > this.maxAmbientSamples) {
      this.ambientSamples.shift();
    }

    // Update ambient noise as median of recent samples
    const sorted = [...this.ambientSamples].sort((a, b) => a - b);
    this.ambientNoise = sorted[Math.floor(sorted.length / 2)];
  }

  /**
   * Check if audio level indicates speech
   */
  isSpeech(audioLevel: number): boolean {
    // Use adaptive threshold = ambientNoise * 2.5
    const dynamicThreshold = Math.max(this.ambientNoise * 2.5, 15);
    return audioLevel > dynamicThreshold;
  }

  /**
   * Check if audio level indicates peak speech (for speech start detection)
   * More sensitive for initial detection
   */
  isPeakSpeech(audioLevel: number): boolean {
    const dynamicThreshold = Math.max(this.ambientNoise * 1.8, 12);
    return audioLevel > dynamicThreshold;
  }

  /**
   * Get current ambient noise level
   */
  getAmbientNoise(): number {
    return this.ambientNoise;
  }

  /**
   * Reset calibration
   */
  reset(): void {
    this.ambientNoise = 0;
    this.speechPeaks = [];
    this.ambientSamples = [];
  }
}

