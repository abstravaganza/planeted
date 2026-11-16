"use client";
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { z } from "zod";
import {
  patterns,
  emptyPractice,
  changedParts,
  checkPracticeItem,
  completePractice,
  reviewedTransfer,
  type CorrectionPractice as Practice,
} from "@/lib/corrections";
import type { Feedback } from "@/lib/contracts";
import { sentenceVerdictSchema } from "@/lib/contracts";
import type { TopicId } from "@/lib/topics";
import { Button, Notice } from "./ui";
import { Help } from "./help";
export function CorrectionPractice({
  topicId,
  mode,
  practices,
  corrections,
  onChange,
  selectedPattern,
  onSelectPattern,
  earnedPatternIds = [],
  correctionSource = "ai",
}: {
  topicId: TopicId;
  mode: "demo" | "ai";
  practices: Record<string, Practice>;
  corrections: Feedback["corrections"];
  onChange: (patternId: string, state: Practice) => void;
  selectedPattern: "with" | "after" | "because";
  onSelectPattern: (id: "with" | "after" | "because") => void;
  earnedPatternIds?: string[];
  correctionSource?: "ai" | "curated";
}) {
  const patternId = selectedPattern;
  const [busy, setBusy] = useState(false);
  const token = useRef(0);
  useEffect(
    () => () => {
      token.current++;
    },
    [],
  );
  const pattern = patterns.find((p) => p.id === patternId)!;
  const state = practices[patternId] ?? structuredClone(emptyPractice);
  const linked = corrections.find((c) => c.patternId === patternId);
  const parts = changedParts(
    linked?.original ?? pattern.before,
    linked?.corrected ?? pattern.after,
  );
  function change(next: Practice) {
    onChange(patternId, next);
  }
  async function checkTransfer() {
    const text = state.transfer;
    const requestId = ++token.current;
    if (reviewedTransfer(pattern, text)) {
      change({
        ...state,
        reviewedText: text,
        provenance: "reviewed",
        accepted: true,
        message:
          "Reviewed answer: this complete sentence uses the pattern correctly.",
      });
      return;
    }
    if (mode === "demo") {
      change({
        ...state,
        reviewedText: text,
        provenance: "unreviewed",
        accepted: false,
        message:
          "Draft saved · not reviewed. Demo Mode cannot judge this original sentence. You can keep it, edit it, or request review when AI Mode is available.",
      });
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation: "transfer",
          topicId,
          patternId,
          mode,
          text,
        }),
      });
      if (!response.ok) throw new Error("Review unavailable");
      const result = z
        .object({ source: z.enum(["demo", "ai"]), data: sentenceVerdictSchema })
        .parse(await response.json());
      if (requestId !== token.current) return;
      const accepted =
        result.source === "ai" &&
        result.data.accepted &&
        result.data.meaningPreserved &&
        result.data.agreementCorrect;
      change({
        ...state,
        reviewedText: text,
        provenance: result.source === "ai" ? "ai" : "unreviewed",
        accepted,
        message:
          result.source === "ai"
            ? result.data.explanation
            : "Review unavailable. Your sentence remains an unreviewed draft.",
      });
    } catch {
      if (requestId === token.current)
        change({
          ...state,
          provenance: "unreviewed",
          reviewedText: text,
          accepted: false,
          message: "Review could not finish. Your draft is saved; try again.",
        });
    } finally {
      if (requestId === token.current) setBusy(false);
    }
  }
  return (
    <section
      id="pattern-practice"
      className="activity-card correction-practice"
      aria-label="Correction practice"
    >
      <div className="section-title">
        <h2>Practice the pattern</h2>
        <Help label="Correction practice help">
          Try both short items before revealing their answers. Then write a new
          sentence. Reviewed examples and AI-reviewed writing are labeled
          separately; other sentences remain drafts. Complete both items and a
          reviewed transfer to earn 20 XP once.
        </Help>
      </div>
      <nav className="pattern-tabs" aria-label="Grammar patterns">
        {patterns.map((p) => (
          <button
            key={p.id}
            disabled={busy}
            aria-pressed={p.id === patternId}
            onClick={() => onSelectPattern(p.id)}
          >
            {practices[p.id]?.completed && <Check size={13} />} {p.title}
          </button>
        ))}
      </nav>
      <p className="provenance-badge">
        {linked
          ? correctionSource === "curated"
            ? "From your transcript · supported local rule"
            : "From your original · AI-identified, supported correction"
          : "Example-pattern practice · not an identified mistake in your writing"}
      </p>
      <div className="correction-comparison">
        <div>
          <span>{linked ? "Your wording" : "Example wording"}</span>
          <p lang="ru">
            {parts.before[0]}
            <mark>{parts.before[1]}</mark>
            {parts.before[2]}
          </p>
        </div>
        <div>
          <span>Corrected</span>
          <p lang="ru">
            {parts.after[0]}
            <mark>{parts.after[1]}</mark>
            {parts.after[2]}
          </p>
        </div>
      </div>
      <p className="pattern-rule">{pattern.explanation}</p>
      <fieldset disabled={busy} className="practice-fieldset">
        {pattern.items.map((item, i) => (
          <div key={`${patternId}-${i}`} className="retrieval-item">
            <label htmlFor={`${topicId}-${patternId}-item-${i}`} lang="ru">
              {i + 1}. {item.prompt}
            </label>
            <div className="inline-answer">
              <input
                id={`${topicId}-${patternId}-item-${i}`}
                lang="ru"
                value={state.answers[i]}
                maxLength={500}
                onChange={(e) => {
                  const answers = [...state.answers];
                  answers[i] = e.target.value;
                  const checked = [...state.checked];
                  checked[i] = false;
                  change({ ...state, answers, checked });
                }}
              />
              <Button
                variant="secondary"
                disabled={!state.answers[i].trim() || state.checked[i]}
                onClick={() => change(checkPracticeItem(pattern, state, i))}
              >
                {state.checked[i]
                  ? "Checked"
                  : state.attempts[i]
                    ? "Try again"
                    : "Check"}
              </Button>
            </div>
            {state.attempts[i] > 0 && (
              <p
                className={state.checked[i] ? "correct-text" : "retry-text"}
                role="status"
              >
                {state.checked[i]
                  ? "Correct. " + item.feedback
                  : item.feedback + " Edit your answer and try again."}
              </p>
            )}
            {!state.checked[i] && state.attempts[i] > 0 && (
              <Button
                variant="ghost"
                onClick={() => {
                  const revealed = [...state.revealed];
                  revealed[i] = !revealed[i];
                  change({ ...state, revealed });
                }}
              >
                {state.revealed[i] ? "Hide answer" : "Reveal answer"}
              </Button>
            )}
            {state.revealed[i] && (
              <p className="revealed-answer" lang="ru">
                {item.answers[0]}
              </p>
            )}
          </div>
        ))}
      </fieldset>
      {state.checked.every(Boolean) && (
        <div className="transfer-editor">
          <label
            className="field-label"
            htmlFor={`${topicId}-${patternId}-transfer`}
          >
            {pattern.transferPrompt}
          </label>
          <textarea
            id={`${topicId}-${patternId}-transfer`}
            lang="ru"
            value={state.transfer}
            maxLength={2000}
            rows={3}
            disabled={busy}
            onChange={(e) => {
              token.current++;
              change({
                ...state,
                transfer: e.target.value,
                accepted: false,
                reviewedText: "",
                provenance: "unreviewed",
                message: "",
              });
            }}
          />
          <Help label="Transfer sentence help">
            Use your own idea. {pattern.transferPrompt} A few complete sentences
            have been reviewed for Demo Mode. A different correct sentence can
            remain unreviewed until AI review is enabled. Your draft is always
            saved.
          </Help>
          <div className="action-row">
            <Button
              variant="secondary"
              disabled={busy || !state.transfer.trim()}
              onClick={() => void checkTransfer()}
            >
              {busy
                ? "Reviewing…"
                : mode === "ai"
                  ? "Review my sentence"
                  : "Check reviewed examples"}
            </Button>
          </div>
          {state.message && (
            <Notice success={state.accepted}>
              {state.provenance === "ai"
                ? "AI-reviewed · "
                : state.provenance === "reviewed"
                  ? "Reviewed · "
                  : "Unreviewed draft · "}
              {state.message}
            </Notice>
          )}
          {state.message && (
            <details className="sample-details">
              <summary>Reviewed transfer examples · open after trying</summary>
              {pattern.reviewedTransfers.slice(0, 3).map((text) => (
                <p lang="ru" key={text}>
                  {text}
                </p>
              ))}
            </details>
          )}
          <div className="activity-footer">
            <span>
              {state.completed ? "20 XP earned for this pattern" : ""}
            </span>
            <Button
              disabled={
                state.completed ||
                !state.checked.every(Boolean) ||
                !state.accepted ||
                state.transfer !== state.reviewedText
              }
              onClick={() => change(completePractice(state))}
            >
              {state.completed
                ? "Pattern complete"
                : earnedPatternIds.includes(patternId)
                  ? "Complete practice"
                  : "Complete practice · +20 XP"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
