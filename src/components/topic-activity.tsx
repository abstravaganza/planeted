"use client";
import { useState } from "react";
import { getTopic, type TopicId } from "@/lib/topics";
import type { Progress } from "@/lib/progress";
import { checkSentence, award } from "@/lib/learning";
import { SentenceBuilder } from "./sentence-builder";
import { ExpansionBuilder } from "./expansion-builder";
import { Continue } from "./ui";
import { Help } from "./help";
import { Recorder } from "./recorder";
export function TopicActivity({
  topicId,
  progress: p,
  onChange,
  finish,
  transcriptionEnabled,
}: {
  topicId: TopicId;
  progress: Progress;
  onChange: (patch: Partial<Progress>) => void;
  finish: () => void;
  transcriptionEnabled: boolean;
}) {
  const [message, setMessage] = useState("");
  const challenge = getTopic(topicId);
  const checked =
    p.completed.includes(1) &&
    checkSentence(
      p.tiles,
      challenge.tiles.map((t) => t.id),
      challenge.acceptableOrders,
    ) === "accepted";
  function check() {
    const verdict = checkSentence(
      p.tiles,
      challenge.tiles.map((t) => t.id),
      challenge.acceptableOrders,
    );
    if (verdict === "accepted") {
      onChange({ completed: award(p.completed, 1) });
      setMessage("Reviewed sentence.");
    } else
      setMessage(
        verdict === "incomplete"
          ? "Use every tile once."
          : "This order is unreviewed. Keep each preposition with its noun, or try a hint.",
      );
  }
  if (p.stage === 0)
    return (
      <section className="activity-card">
        <p>{challenge.ideaPrompt}</p>
        {transcriptionEnabled && (
          <Recorder
            enabled
            onTranscript={(text) =>
              onChange({ notes: p.notes + (p.notes ? "\n" : "") + text })
            }
          />
        )}
        <label className="field-label" htmlFor="topic-ideas">
          Your Russian ideas
        </label>
        <textarea
          id="topic-ideas"
          lang="ru"
          value={p.notes}
          maxLength={8000}
          rows={6}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
        <Help label="Ideas help">
          Use your own ideas. These are preparation notes, not an evaluated
          response. Optional recording appears when AI transcription is enabled.
        </Help>
        <div className="activity-footer">
          <Continue
            label="Build a sentence"
            disabled={!p.notes.trim()}
            onClick={finish}
          />
        </div>
      </section>
    );
  if (p.stage === 1)
    return (
      <SentenceBuilder
        challenge={challenge}
        tiles={p.tiles}
        onChange={(tiles) => {
          onChange({ tiles });
          setMessage("");
        }}
        onCheck={check}
        onContinue={finish}
        checked={checked}
        status={message}
      />
    );
  return (
    <ExpansionBuilder
      challenge={challenge}
      values={p.expansions}
      onChange={(expansions) => onChange({ expansions })}
      onContinue={finish}
    />
  );
}
