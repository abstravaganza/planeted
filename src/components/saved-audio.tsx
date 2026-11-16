"use client";
import { useEffect, useRef, useState } from "react";
import { getRecording } from "@/lib/audio-store";
import { Button } from "./ui";
export function SavedAudio({ id }: { id: string }) {
  const [url, setUrl] = useState(""),
    [notice, setNotice] = useState("");
  const current = useRef("");
  useEffect(
    () => () => {
      if (current.current) URL.revokeObjectURL(current.current);
    },
    [],
  );
  async function load() {
    try {
      const record = await getRecording(id);
      if (!record) {
        setNotice(
          "Audio is no longer available under the retention policy. The raw transcript is still preserved.",
        );
        return;
      }
      if (current.current) URL.revokeObjectURL(current.current);
      current.current = URL.createObjectURL(record.blob);
      setUrl(current.current);
    } catch {
      setNotice(
        "Stored audio could not be opened. Your transcript remains saved.",
      );
    }
  }
  return (
    <div>
      {url ? (
        <audio controls src={url} aria-label="Preserved original audio" />
      ) : (
        <Button variant="ghost" onClick={() => void load()}>
          Replay this original audio
        </Button>
      )}
      {notice && (
        <p className="fine" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
