/**
 * Audio processing utilities for PCM16 conversion and chunking
 */

/**
 * Convert Float32Array audio samples to PCM16 (Int16Array)
 */
export function convertToPCM16(float32Samples: Float32Array): Int16Array {
  const pcm16 = new Int16Array(float32Samples.length);
  for (let i = 0; i < float32Samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, float32Samples[i]));
    pcm16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
  }
  return pcm16;
}

/**
 * Resample audio using linear interpolation.
 */
export function resampleAudio(
  audioData: Float32Array,
  originalSampleRate: number,
  targetSampleRate: number
): Float32Array {
  if (originalSampleRate === targetSampleRate) return audioData;

  const ratio = originalSampleRate / targetSampleRate;
  const newLength = Math.round(audioData.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio;
    const floor = Math.floor(srcIndex);
    const ceil = Math.min(floor + 1, audioData.length - 1);
    const frac = srcIndex - floor;
    result[i] = audioData[floor] * (1 - frac) + audioData[ceil] * frac;
  }

  return result;
}

/**
 * Captures microphone audio and emits PCM16 Int16Array chunks (~100ms each).
 *
 * Strategy:
 *  1. Create AudioContext and resume it SYNCHRONOUSLY during the user gesture
 *     (required by browsers — resume() after an async gap is often blocked).
 *  2. Use ScriptProcessorNode immediately (synchronous, no async module load).
 *     Route audio through a gain=0 node to keep the graph alive without
 *     playing the mic back through the speakers.
 *  3. Copy the live Float32 buffer before processing — ScriptProcessorNode
 *     reuses its internal buffer after the callback returns.
 */
export class AudioChunker {
  private context: AudioContext;
  private source: MediaStreamAudioSourceNode;
  private processor: ScriptProcessorNode;
  private silentGain: GainNode;
  private onChunk: (chunk: Int16Array) => void;
  private targetSampleRate: number;
  private stopped = false;

  constructor(
    stream: MediaStream,
    onChunk: (chunk: Int16Array) => void,
    targetSampleRate = 16000
  ) {
    this.onChunk = onChunk;
    this.targetSampleRate = targetSampleRate;

    // ── 1. Create context (must be during a user-gesture call stack) ──────
    this.context = new AudioContext();
    console.info('[AudioChunker] created', {
      nativeRate: this.context.sampleRate,
      state: this.context.state,
    });

    // ── 2. Resume synchronously ───────────────────────────────────────────
    // Calling resume() here is still inside the synchronous portion of the
    // user-gesture handler.  The browser will honour it.
    if (this.context.state !== 'running') {
      this.context.resume().then(() => {
        console.info('[AudioChunker] context running');
      }).catch((err) => {
        console.error('[AudioChunker] resume failed:', err);
      });
    }

    // ── 3. Build the graph ────────────────────────────────────────────────
    this.source = this.context.createMediaStreamSource(stream);

    // 4096-sample buffer, 1 input channel, 1 output channel
    this.processor = this.context.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (this.stopped) return;
      // Copy immediately — the underlying buffer is reused after return.
      const inputData = new Float32Array(e.inputBuffer.getChannelData(0));
      const nativeRate = this.context.sampleRate;
      const resampled =
        nativeRate !== this.targetSampleRate
          ? resampleAudio(inputData, nativeRate, this.targetSampleRate)
          : inputData;
      this.onChunk(convertToPCM16(resampled));
    };

    // Silent gain node — keeps the graph connected to destination (required
    // for onaudioprocess to fire) without playing mic audio through speakers.
    this.silentGain = this.context.createGain();
    this.silentGain.gain.value = 0;

    this.source.connect(this.processor);
    this.processor.connect(this.silentGain);
    this.silentGain.connect(this.context.destination);

    console.info('[AudioChunker] graph connected');
  }

  stop() {
    this.stopped = true;
    try { this.processor.disconnect(); } catch { /* ignore */ }
    try { this.source.disconnect(); } catch { /* ignore */ }
    try { this.silentGain.disconnect(); } catch { /* ignore */ }
    this.context.close().catch(() => { /* ignore */ });
  }
}
