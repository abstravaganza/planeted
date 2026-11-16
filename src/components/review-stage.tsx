"use client";
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import {
  analysisSchema, replaceAnalysis, localAnalysis, safeUnit, canPractice,
  type AnalysisUnit,
} from "@/lib/learning-engine";
import { approveReviewedModels, type MissionState } from "@/lib/quest-state";
import { getMission, type MissionId } from "@/lib/missions";
import { ReviewRequestGate } from "@/lib/answer-review";
import { Button, Notice } from "./ui";

export function ReviewStage({ state, missionId, mode, update }: {
  state: MissionState;
  missionId: MissionId;
  mode: "demo" | "ai";
  transcriptionEnabled?: boolean;
  retentionHours?: number;
  update: (fn: (s: MissionState) => MissionState) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(new ReviewRequestGate());
  const checking = useRef(false);
  useEffect(() => () => request.current.invalidate(), [mode]);
  const units = state.engine.analysisTranscript === state.approvedTranscript
    ? state.engine.units : [];
  const selected = units.filter(canPractice).length;

  async function review() {
    if (checking.current) return;
    checking.current = true;
    const token = request.current.begin();
    const transcript = state.approvedTranscript;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/correct", {
        method: "POST", headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(65000),
        body: JSON.stringify({ mode, missionId, text: transcript, context: transcript }),
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Suggestions unavailable. Your recording is saved. Try again.");
      const result = analysisSchema.parse(value.data);
      if (!request.current.current(token)) return;
      update((s) => s.approvedTranscript !== transcript ? s : {
        ...s,
        engineHistory: s.engine.units.length ? [...s.engineHistory, {
          generation: s.generation, engine: s.engine, createdAt: Date.now(),
        }] : s.engineHistory,
        engine: replaceAnalysis(s.engine, transcript, result.units),
      });
    } catch (e) {
      if (request.current.current(token)) setError(e instanceof Error ? e.message : "Suggestions unavailable. Try again.");
    } finally {
      checking.current = false;
      setBusy(false);
    }
  }
  function choose(id: string, selectedVersion: "original" | "suggestion") {
    update((s) => ({ ...s, engine: { ...s.engine, units: s.engine.units.map((u) =>
      u.id === id ? { ...u, selectedVersion, approved: true } : u,
    ) } }));
  }
  function examples() {
    setError("");
    update((s) => ({
      ...s,
      engineHistory: s.engine.units.length ? [...s.engineHistory, {
        generation: s.generation, engine: s.engine, createdAt: Date.now(),
      }] : s.engineHistory,
      engine: replaceAnalysis(s.engine, s.approvedTranscript,
        getMission(missionId).sample.flatMap((text) => localAnalysis(text))
          .map((u, i) => ({ ...u, id: `example-${i}` }))),
    }));
  }
  return (
    <section className="q-panel q-shape-picker">
      <div className="q-section-line">
        <h2>Choose your version</h2>
        <details className="q-shape-tools">
          <summary aria-label="Suggestion options">Options</summary>
          <Button variant="ghost" disabled={busy} onClick={() => void review()}>Refresh suggestions</Button>
          <Button variant="ghost" disabled={busy} onClick={examples}>Use example practice</Button>
          <details className="q-review">
            <summary>Original transcript</summary>
            <p className="q-exact" lang="ru">{state.approvedTranscript}</p>
          </details>
        </details>
      </div>
      {mode === "demo" && <p className="fine">Demo · reviewed examples only. Unknown speech stays a draft.</p>}
      {error && <Notice>{error} <Button variant="ghost" disabled={busy} onClick={() => void review()}>Retry</Button></Notice>}
      {!units.length && <Button disabled={busy} onClick={() => void review()}>{busy ? "Finding suggestions…" : "Find suggestions"}</Button>}
      {busy && units.length > 0 && <p role="status">Updating suggestions…</p>}
      {units.map((u, i) => {
        const choice = u.approved ? u.selectedVersion ?? "suggestion" : undefined;
        const explanation = explanationFor(u);
        return (
          <article className="q-shape-unit" key={u.id}>
            <div className="q-section-line">
              <span className="q-eyebrow">IDEA {i + 1}</span>
              {u.id.startsWith("example-") && <span className="fine">Example practice · not your speech</span>}
            </div>
            <div className="q-version-grid" role="group" aria-label={`Choose version for idea ${i + 1}`}>
              <button type="button" className="q-version q-version-original"
                aria-pressed={choice === "original"} disabled={busy}
                aria-label={`Use Your Version for idea ${i + 1}`}
                onClick={() => choose(u.id, "original")}>
                <span className="q-version-heading">Your Version</span>
                <span className="q-version-text" lang="ru">{u.original}</span>
                {choice === "original" && <span className="q-version-selected"><Check size={16} aria-hidden="true" />Selected</span>}
              </button>
              <div className="q-version-suggested-wrap">
                <button type="button" className="q-version q-version-suggested"
                  aria-pressed={choice === "suggestion"} disabled={busy || !u.corrected.trim()}
                  aria-label={`Use You can do Better for idea ${i + 1}`}
                  onClick={() => choose(u.id, "suggestion")}>
                  <span className="q-version-heading">You can do Better</span>
                  <span className="q-version-text" lang="ru">{u.corrected || "No suggestion yet"}</span>
                  {choice === "suggestion" && <span className="q-version-selected"><Check size={16} aria-hidden="true" />Selected</span>}
                </button>
                <details className="q-why">
                  <summary aria-label={`Why this suggestion for idea ${i + 1}?`}>WHY?</summary>
                  <div className="q-why-content">
                    <p>{explanation}</p>
                    {!safeUnit(u) && <p className="fine">This suggestion is still a draft. Choosing it does not mark it grammatically correct.</p>}
                    {u.assessment === "naturalness" && <p className="fine">Your version also works; this change is optional.</p>}
                  </div>
                </details>
              </div>
            </div>
          </article>
        );
      })}
      {units.length > 0 && <div className="q-actions">
        <span aria-live="polite">{selected}/{units.length} selected</span>
        <Button disabled={busy || selected !== units.length}
          onClick={() => update(approveReviewedModels)}>Build sentences →</Button>
      </div>}
    </section>
  );
}
function explanationFor(u: AnalysisUnit) {
  if (!u.corrected.trim()) return "There is no supported suggestion yet. You can keep your version and continue.";
  const explanation = u.changes.map((c) => c.explanation).filter(Boolean).slice(0, 2).join(" ");
  if (explanation) return explanation.split(/\s+/u).slice(0, 48).join(" ") + (explanation.split(/\s+/u).length > 48 ? "…" : "");
  if (safeUnit(u)) return "Your wording already works. There is no grammar change to explain.";
  return "This wording is a suggestion to compare with your speech; its accuracy has not yet been established.";
}
