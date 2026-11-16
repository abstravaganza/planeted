"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Mic, Square } from "lucide-react";
import { Button, Notice } from "./ui";
import {
  audioError,
  keepRecording,
  getRecording,
  forgetRecording,
} from "@/lib/audio-store";
export function Recorder({
  enabled,
  onTranscript,
  recordingId = "practice",
  retentionHours = 0,
  onRawTranscript,
}: {
  enabled: boolean;
  onTranscript: (text: string) => void;
  recordingId?: string;
  retentionHours?: number;
  onRawTranscript?: (text: string, id: string) => void;
}) {
  const [status, setStatus] = useState<
      "idle" | "recording" | "processing" | "ready" | "error"
    >("idle"),
    [error, setError] = useState(""),
    [seconds, setSeconds] = useState(0),
    [preview, setPreview] = useState("");
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    audio = useRef<Blob | null>(null),
    audioId = useRef(recordingId),
    url = useRef(""),
    timeout = useRef<ReturnType<typeof setTimeout> | null>(null),
    mounted = useRef(true),
    pending = useRef(false);
  useEffect(() => {
    mounted.current = true;
    getRecording(recordingId)
      .then((record) => {
        if (record && mounted.current) {
          audio.current = record.blob;
          audioId.current = record.audioId ?? record.id;
          url.current = URL.createObjectURL(record.blob);
          setPreview(url.current);
        }
      })
      .catch(() => {});
    return () => {
      mounted.current = false;
      if (recorder.current) {
        recorder.current.onstop = null;
        if (recorder.current.state === "recording") recorder.current.stop();
      }
      stream.current?.getTracks().forEach((t) => t.stop());
      if (timeout.current) clearTimeout(timeout.current);
      if (url.current) URL.revokeObjectURL(url.current);
    };
  }, [recordingId]);
  useEffect(() => {
    if (status !== "recording") return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);
  async function transcribe() {
    if (!enabled) {
      setError(audioError(503));
      setStatus("error");
      return;
    }
    if (!audio.current) return;
    if (audio.current.size > 4_000_000) {
      setError("This recording is too large to upload. Try a shorter recording under 4 MB. Your audio is kept for replay.");
      setStatus("error");
      return;
    }
    setStatus("processing");
    setError("");
    try {
      const body = new FormData();
      body.append("audio", audio.current, "recording");
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body,
        signal: AbortSignal.timeout(45000),
      });
      if (!response.ok) throw new Error(audioError(response.status));
      const result = z
        .object({
          source: z.literal("ai"),
          data: z.object({ text: z.string().min(1).max(8000) }),
        })
        .parse(await response.json());
      if (mounted.current) {
        onRawTranscript?.(result.data.text, audioId.current);
        onTranscript(result.data.text);
        setStatus("ready");
      }
    } catch (e) {
      if (mounted.current) {
        setError(e instanceof Error ? e.message : "Transcription failed.");
        setStatus("error");
      }
    }
  }
  async function start() {
    if (pending.current) return;
    pending.current = true;
    setError("");
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("This browser cannot record. Type your transcript below.");
      setStatus("error");
      pending.current = false;
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      if (!mounted.current) {
        stream.current.getTracks().forEach((t) => t.stop());
        return;
      }
      const mime = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ].find((t) => MediaRecorder.isTypeSupported(t));
      const rec = new MediaRecorder(
        stream.current,
        mime ? { mimeType: mime } : undefined,
      );
      recorder.current = rec;
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      rec.onerror = () => {
        setError("The recording device failed. Retry or type below.");
        setStatus("error");
        if (rec.state === "recording") rec.stop();
      };
      rec.onstop = async () => {
        stream.current?.getTracks().forEach((t) => t.stop());
        if (timeout.current) clearTimeout(timeout.current);
        if (!mounted.current) return;
        setStatus(enabled ? "processing" : "error");
        audio.current = new Blob(chunks, { type: rec.mimeType });
        if (!audio.current.size) {
          setError(
            "No audio was captured. Check the microphone and try again.",
          );
          setStatus("error");
          return;
        }
        if (url.current) URL.revokeObjectURL(url.current);
        url.current = URL.createObjectURL(audio.current);
        setPreview(url.current);
        audioId.current = recordingId + ":" + crypto.randomUUID();
        try {
          await keepRecording(
            recordingId,
            audio.current,
            retentionHours,
            audioId.current,
          );
        } catch {
          setError(
            "Audio is available in this tab but could not be retained after reload.",
          );
        }
        if (!mounted.current) return;
        if (enabled) await transcribe();
        else {
          setStatus("error");
          setError(audioError(503));
        }
      };
      rec.start();
      setStatus("recording");
      setSeconds(0);
      timeout.current = setTimeout(() => {
        if (rec.state === "recording") rec.stop();
      }, 120000);
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      setStatus("error");
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Microphone permission denied. Enable it in browser settings or type below."
          : "Microphone unavailable. Check the device or type below.",
      );
    } finally {
      pending.current = false;
    }
  }
  return (
    <div className="recorder-panel">
      <p className="q-record-state" role="status">
        {
          {
            idle: "Ready to record",
            recording: "Recording",
            processing: "Processing Russian audio…",
            ready: "Transcript Ready · review below",
            error: "Error · manual entry is available",
          }[status]
        }
      </p>
      {!enabled && <Notice>{audioError(503)}</Notice>}
      <div className="action-row">
        <Button
          variant="secondary"
          disabled={status === "processing"}
          onClick={() =>
            status === "recording" ? recorder.current?.stop() : void start()
          }
        >
          {status === "recording" ? <Square size={19} /> : <Mic size={19} />}{" "}
          {status === "recording"
            ? "Stop recording"
            : preview
              ? "Rerecord in Russian"
              : "Record in Russian"}
        </Button>
        <span
          role="timer"
          aria-label="Recording elapsed time"
          className={status === "recording" ? "recording-clock" : ""}
        >
          {String(Math.floor(seconds / 60)).padStart(2, "0")}:
          {String(seconds % 60).padStart(2, "0")}
        </span>
      </div>
      <p className="fine">
        Russian · up to 2 minutes ·{" "}
        {enabled
          ? "sent to the configured transcription provider after Stop"
          : "local recording only until configured"}
        . Audio retention:{" "}
        {retentionHours
          ? `${retentionHours} hours on this browser`
          : "this tab session only"}
        .
      </p>
      {preview && (
        <div className="audio-preview">
          <audio
            controls
            src={preview}
            aria-label="Original recording playback"
          />
          <Button
            variant="secondary"
            disabled={status === "processing" || status === "recording"}
            onClick={() => void transcribe()}
          >
            Retry transcription
          </Button>
          <Button
            variant="ghost"
            disabled={status === "processing" || status === "recording"}
            onClick={() =>
              void Promise.all([
                forgetRecording(recordingId),
                forgetRecording(audioId.current),
              ]).then(() => {
                audio.current = null;
                URL.revokeObjectURL(url.current);
                setPreview("");
              })
            }
          >
            Remove local audio
          </Button>
        </div>
      )}
      {error && (enabled || error !== audioError(503)) && (
        <Notice>{error}</Notice>
      )}
    </div>
  );
}
