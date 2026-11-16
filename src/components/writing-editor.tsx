"use client";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import type { Progress } from "@/lib/progress";
import { Button } from "./ui";
import { Help } from "./help";
import { wordCount } from "@/lib/learning";
export function WritingEditor({
  prompt,
  progress,
  onDraft,
  onSubmit,
  onFeedback,
  onDownload,
}: {
  prompt: string;
  progress: Progress;
  onDraft: (text: string) => void;
  onSubmit: () => void;
  onFeedback: () => void;
  onDownload: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);
  return (
    <section className="activity-card writing-card">
      <p className="independent-prompt">{prompt}</p>
      <div className="editor-toolbar">
        <label htmlFor="independent-editor">Your message</label>
        <div className="timer">
          <Clock size={14} />
          {Math.floor(seconds / 60)
            .toString()
            .padStart(2, "0")}
          :{(seconds % 60).toString().padStart(2, "0")}
          <button onClick={() => setRunning(!running)}>
            {running ? "Pause" : "Timer"}
          </button>
        </div>
      </div>
      <textarea
        id="independent-editor"
        lang="ru"
        value={progress.original ?? progress.draft}
        readOnly={progress.original !== null}
        rows={12}
        maxLength={8000}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        onChange={(e) => onDraft(e.target.value)}
      />
      <div className="editor-footer">
        <span>{wordCount(progress.original ?? progress.draft)} words</span>
        <Help label="Writing help">
          Your original is saved exactly as written before feedback. Revisions
          have their own editor. The timer is optional and has no time limit.
        </Help>
      </div>
      <div className="activity-footer">
        <Button variant="ghost" onClick={onDownload}>
          Download writing
        </Button>
        {progress.original === null ? (
          <Button
            disabled={!progress.draft.trim()}
            onClick={() => {
              setRunning(false);
              onSubmit();
            }}
          >
            Save & get feedback
          </Button>
        ) : (
          <Button onClick={onFeedback}>View feedback</Button>
        )}
      </div>
    </section>
  );
}
