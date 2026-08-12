import { useEffect, useRef, useState } from "react";

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
}

export default function VoiceRecorder({
  onRecordingComplete,
}: VoiceRecorderProps) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!isRecording) return;

    const timer = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());

      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream);

      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        const url = URL.createObjectURL(blob);

        setAudioUrl(url);
        onRecordingComplete(blob);

        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();

      setDuration(0);
      setIsRecording(true);
    } catch (error) {
      console.error("Microphone permission error:", error);

      alert(
        "Please allow microphone access to record your complaint."
      );
    }
  };

  const stopRecording = () => {
    if (
      recorderRef.current &&
      recorderRef.current.state !== "inactive"
    ) {
      recorderRef.current.stop();
    }

    setIsRecording(false);
  };

  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    setAudioUrl(null);
    setDuration(0);
    chunksRef.current = [];
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");

    const remainingSeconds = (seconds % 60)
      .toString()
      .padStart(2, "0");

    return `${minutes}:${remainingSeconds}`;
  };

  return (
    <div className="rounded-xl border border-gray-200 p-4 space-y-4">
      <div>
        <h3 className="font-semibold text-lg">
          🎙️ Voice Complaint
        </h3>

        <p className="text-sm text-gray-500 mt-1">
          Don't know how to capture the issue?
          Simply describe the problem by voice.
        </p>
      </div>

      {!isRecording && !audioUrl && (
        <button
          type="button"
          onClick={startRecording}
          className="w-full rounded-lg bg-red-600 px-4 py-3 text-white font-medium hover:bg-red-700"
        >
          🎙️ Start Recording
        </button>
      )}

      {isRecording && (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-3">
            <span className="h-3 w-3 rounded-full bg-red-600 animate-pulse" />

            <span className="font-medium">
              Recording... {formatTime(duration)}
            </span>
          </div>

          <button
            type="button"
            onClick={stopRecording}
            className="w-full rounded-lg bg-gray-900 px-4 py-3 text-white font-medium"
          >
            ⏹ Stop Recording
          </button>
        </div>
      )}

      {!isRecording && audioUrl && (
        <div className="space-y-3">
          <audio
            controls
            src={audioUrl}
            className="w-full"
          />

          <button
            type="button"
            onClick={deleteRecording}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 font-medium"
          >
            🗑️ Delete Recording
          </button>
        </div>
      )}
    </div>
  );
}
