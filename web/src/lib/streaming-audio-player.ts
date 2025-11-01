/**
 * Streams and plays TTS audio chunks progressively
 */
export class StreamingAudioPlayer {
  private audioContext: AudioContext;
  private gainNode: GainNode;
  private chunks: AudioBuffer[] = [];
  private isPlaying = false;
  private currentSourceNode: AudioBufferSourceNode | null = null;
  
  constructor() {
    this.audioContext = new AudioContext();
    this.gainNode = this.audioContext.createGain();
    this.gainNode.connect(this.audioContext.destination);
  }
  
  /**
   * Add an audio chunk (MP3 bytes) to the playback queue
   */
  async addChunk(audioBytes: Uint8Array, _isFinal: boolean) {
    try {
      // Decode MP3 to AudioBuffer
      // Create a new ArrayBuffer to avoid type issues
      const buffer = new ArrayBuffer(audioBytes.byteLength);
      new Uint8Array(buffer).set(audioBytes);
      const audioBuffer = await this.audioContext.decodeAudioData(buffer);
      
      this.chunks.push(audioBuffer);
      
      // Start playing if first chunk
      if (!this.isPlaying && this.chunks.length > 0) {
        this.playNextChunk();
      }
      
    } catch (error) {
      console.error("Failed to decode audio chunk:", error);
    }
  }
  
  private playNextChunk() {
    if (this.chunks.length === 0) {
      this.isPlaying = false;
      return;
    }
    
    this.isPlaying = true;
    const chunk = this.chunks.shift()!;
    
    // Create source node
    this.currentSourceNode = this.audioContext.createBufferSource();
    this.currentSourceNode.buffer = chunk;
    this.currentSourceNode.connect(this.gainNode);
    
    // Play next chunk when this one ends
    this.currentSourceNode.onended = () => {
      this.playNextChunk();
    };
    
    this.currentSourceNode.start();
  }
  
  /**
   * Stop playback immediately and clear queue
   */
  stop() {
    if (this.currentSourceNode) {
      this.currentSourceNode.stop();
      this.currentSourceNode.disconnect();
      this.currentSourceNode = null;
    }
    this.chunks = [];
    this.isPlaying = false;
  }
  
  /**
   * Get playback state
   */
  getState() {
    return {
      isPlaying: this.isPlaying,
      queueLength: this.chunks.length
    };
  }
}

