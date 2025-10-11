import AudioRecorder from "@/components/audio-recorder";

export default function TestRecorderPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">LinguaLive Audio Test</h1>
        <p className="text-muted-foreground">
          Test the audio recording and AI feedback system
        </p>
      </div>
      
      <AudioRecorder />
    </div>
  );
}

