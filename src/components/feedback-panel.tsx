"use client";
import { useState } from "react";
import { patterns, supportedCorrections } from "@/lib/corrections";
import type { TopicState } from "@/lib/workspace";
import type { TopicId } from "@/lib/topics";
import { Button, Notice } from "./ui";
import { Help } from "./help";
import { CorrectionPractice } from "./correction-practice";
import type { CorrectionPractice as Practice } from "@/lib/corrections";
export function FeedbackPanel({
  topicId,
  topic,
  mode,
  onRetry,
  onRevision,
  onPractice,
  onSelectPattern,
  onDownload,
  onNewAttempt,
}: {
  topicId: TopicId;
  topic: TopicState;
  mode: "demo" | "ai";
  onRetry: () => void;
  onRevision: (text: string, reward?: boolean) => void;
  onPractice: (id: string, state: Practice) => void;
  onSelectPattern: (id: "with" | "after" | "because") => void;
  onDownload: () => void;
  onNewAttempt: () => void;
}) {
  const [reflection, setReflection] = useState("");
  const p = topic.progress;
  const feedback = p.feedback;
  const isDemo = p.feedbackSource !== "ai";
  const available = feedback;
  return (
    <div className="feedback-page">
      <section className="activity-card">
        <div className="section-title">
          <h2>Feedback</h2>
          <Help label="Feedback help">
            Demo feedback describes its displayed example, never your writing.
            AI Mode reviews your saved original against this topic’s prompt.
            This is practice guidance, not an official ACTFL score. A retry uses
            the same original and preserves revisions.
          </Help>
        </div>
        {topic.status === "loading" && (
          <Notice>Loading feedback. Your original is saved.</Notice>
        )}
        {(topic.status === "error" ||
          topic.status === "interrupted" ||
          (p.original !== null && !feedback && topic.status !== "loading")) && (
          <Notice>
            {topic.error || "Your original is saved. Load feedback when ready."}
          </Notice>
        )}
        {topic.status !== "loading" && (
          <Button variant={available ? "ghost" : "primary"} onClick={onRetry}>
            {available && topic.status === "ready"
              ? "Refresh feedback"
              : "Retry feedback"}
          </Button>
        )}
        {available && (
          <>
            <div className="feedback-source">
              <strong>
                {isDemo
                  ? "Illustrative example · your writing was not evaluated"
                  : "AI feedback · your original response"}
              </strong>
            </div>
            {p.feedbackNotice &&
              !p.feedbackNotice.startsWith("Illustrative example only") && (
                <p className="fine">{p.feedbackNotice}</p>
              )}
            {isDemo && (
              <details className="sample-details">
                <summary>Example this feedback describes</summary>
                <p lang="ru">{topic.feedbackSample}</p>
              </details>
            )}
            <div className="feedback-columns">
              <div>
                <h3>{isDemo ? "Example strength" : "Strength"}</h3>
                {feedback.strengths.map((s) => (
                  <p key={s}>{s}</p>
                ))}
              </div>
              <div>
                <h3>{isDemo ? "Example next steps" : "Next steps"}</h3>
                {feedback.nextSteps.map((s) => (
                  <p key={s}>{s}</p>
                ))}
              </div>
            </div>
            <details className="sample-details">
              <summary>All five feedback areas</summary>
              <div className="feedback-dimensions">
                {feedback.dimensions.map((d) => (
                  <div key={d.name}>
                    <strong>
                      {d.name} · {d.level}
                    </strong>
                    <p>{d.detail}</p>
                  </div>
                ))}
              </div>
            </details>
          </>
        )}
        <details className="sample-details">
          <summary>Your original · preserved exactly</summary>
          <pre className="original-response" lang="ru">
            {p.original}
          </pre>
        </details>
        {available && (
          <a href="#pattern-practice" className="button primary">
            {!isDemo && feedback.corrections.length
              ? "Practice this correction"
              : "Practice a pattern"}
          </a>
        )}
        <details className="sample-details revision-details">
          <summary>Revise your response</summary>
          <label className="field-label" htmlFor="revision">
            Your revision
          </label>
          <textarea
            id="revision"
            lang="ru"
            rows={6}
            value={p.revision}
            maxLength={8000}
            onChange={(e) => onRevision(e.target.value)}
          />
          <Help label="Revision help">
            Choose a next step and change your message in your own words. Your
            revision autosaves separately from the original.
          </Help>
          <label htmlFor="revision-reflection" className="field-label">
            What did you clarify?
          </label>
          <input
            id="revision-reflection"
            value={reflection}
            maxLength={500}
            onChange={(e) => setReflection(e.target.value)}
          />
          <div className="action-row">
            <Button
              variant="secondary"
              disabled={
                p.revisionRewarded ||
                p.revision.trim() === (p.original ?? "").trim() ||
                !p.revision.trim() ||
                reflection.trim().length < 10
              }
              onClick={() => onRevision(p.revision, true)}
            >
              {p.revisionRewarded
                ? "Revision milestone earned"
                : "Save revision · +20 XP"}
            </Button>
            <Button variant="ghost" onClick={onDownload}>
              Download both versions
            </Button>
          </div>
        </details>
      </section>
      {available && (
        <CorrectionPractice
          key={topicId}
          topicId={topicId}
          mode={mode}
          practices={topic.practice}
          selectedPattern={topic.activePattern}
          onSelectPattern={onSelectPattern}
          earnedPatternIds={topic.earnedPatterns}
          corrections={
            isDemo
              ? []
              : supportedCorrections(
                  p.original ?? "",
                  feedback.corrections,
                ).filter((c) => patterns.some((p) => p.id === c.patternId))
          }
          onChange={onPractice}
        />
      )}
      <Button
        variant="ghost"
        disabled={topic.status === "loading" || topic.archives.length >= 100}
        onClick={onNewAttempt}
      >
        New attempt · keep original & revision
      </Button>
      {topic.archives.length > 0 && (
        <details className="sample-details">
          <summary>
            Previous originals and revisions ({topic.archives.length})
          </summary>
          {topic.archives.map((archive, i) => (
            <div key={i}>
              <h3>Attempt {i + 1}</h3>
              <pre className="original-response" lang="ru">
                {archive.original}
              </pre>
              <pre className="original-response" lang="ru">
                {archive.revision}
              </pre>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
