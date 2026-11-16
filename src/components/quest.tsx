"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { mission } from "@/lib/mission";
import { sportsChallenge } from "@/lib/challenges";
import { getLanguageProfile } from "@/lib/languages";
import { extractionSchema, sentenceVerdictSchema } from "@/lib/contracts";
import type { Idea } from "@/lib/contracts";
import type { Progress } from "@/lib/progress";
import { checkSentence, award } from "@/lib/learning";
import { Button, Continue, Notice } from "./ui";
import { Help } from "./help";
import { SentenceBuilder } from "./sentence-builder";
import { ExpansionBuilder } from "./expansion-builder";
import { Recorder } from "./recorder";
import { learningRequest } from "@/lib/client";
const fields = [
  ["activity", "Activity"],
  ["when", "When"],
  ["where", "Where"],
  ["company", "With whom"],
  ["why", "Why"],
] as const;
export function SportsActivity({
  progress: p,
  onChange,
  finish,
  mode,
  transcriptionEnabled,
}: {
  progress: Progress;
  onChange: (patch: Partial<Progress>) => void;
  finish: () => void;
  mode: "demo" | "ai";
  transcriptionEnabled: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [aiOrder, setAiOrder] = useState("");
  const language = getLanguageProfile(mission.language);
  async function organize() {
    setBusy(true);
    try {
      const result = await learningRequest(
        "ideas",
        p.notes,
        mode,
        "sports",
        extractionSchema,
      );
      onChange({ ideas: result.data.ideas, approved: false });
      setMessage(
        result.source === "demo"
          ? "Demo organizer · edit and approve your map."
          : "Edit and approve your map.",
      );
    } catch {
      setMessage(
        "Could not organize ideas. Try again or add an idea yourself.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function check() {
    const verdict = checkSentence(
      p.tiles,
      mission.tiles.map((t) => t.id),
      mission.acceptableOrders,
    );
    if (verdict === "accepted") {
      onChange({ completed: award(p.completed, 2) });
      setMessage("Reviewed sentence.");
      return;
    }
    if (verdict === "incomplete") {
      setMessage("Use every tile once.");
      return;
    }
    if (mode === "demo") {
      setMessage(
        "This order is unreviewed; it may be correct. Try a hint or another order.",
      );
      return;
    }
    setBusy(true);
    try {
      const result = await learningRequest(
        "sentence",
        p.tiles
          .map((id) => mission.tiles.find((t) => t.id === id)?.text)
          .join(" "),
        mode,
        "sports",
        sentenceVerdictSchema,
      );
      setMessage(result.data.explanation);
      if (
        result.source === "ai" &&
        result.data.accepted &&
        result.data.agreementCorrect &&
        result.data.meaningPreserved
      ) {
        setAiOrder(p.tiles.join("|"));
        onChange({ completed: award(p.completed, 2) });
      }
    } catch {
      setMessage("Review unavailable. Your tiles are saved.");
    } finally {
      setBusy(false);
    }
  }
  function edit(id: string, field: keyof Idea, value: string) {
    onChange({
      ideas: p.ideas.map((idea) =>
        idea.id === id ? { ...idea, [field]: value } : idea,
      ),
      approved: false,
    });
  }
  const checked =
    p.completed.includes(2) &&
    (checkSentence(
      p.tiles,
      mission.tiles.map((t) => t.id),
      mission.acceptableOrders,
    ) === "accepted" ||
      aiOrder === p.tiles.join("|"));
  if (p.stage === 0)
    return (
      <section className="activity-card mission-start">
        <p>{mission.prompt}</p>
        <Help label="Mission information">
          Original AAPPL Form A-style preparation. Eight short stages build
          toward independent writing. This is not an official test question or
          rating.
        </Help>
        <div className="activity-footer">
          <Continue label="Start mission" onClick={finish} />
        </div>
      </section>
    );
  if (p.stage === 1)
    return (
      <section className="activity-card">
        {transcriptionEnabled && (
          <Recorder
            enabled
            onTranscript={(text) =>
              onChange({ notes: p.notes + (p.notes ? "\n" : "") + text })
            }
          />
        )}
        <label htmlFor="sports-ideas" className="field-label">
          Your Russian ideas
        </label>
        <textarea
          id="sports-ideas"
          lang="ru"
          rows={4}
          maxLength={8000}
          value={p.notes}
          onChange={(e) => onChange({ notes: e.target.value, approved: false })}
        />
        <div className="action-row">
          <Button
            variant="ghost"
            onClick={() => {
              onChange({ notes: mission.sample, approved: false });
              setMessage("Demo sample loaded.");
            }}
          >
            Demo sample
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !p.notes.trim()}
            onClick={() => void organize()}
          >
            {busy ? "Organizing…" : "Organize ideas"}
          </Button>
          <Help label="Ideas help">
            Type or record your ideas. Organize them into activities and
            details, then edit and approve your map. Missing details may stay
            blank. The demo organizer never invents facts.
          </Help>
        </div>
        <div className="section-title">
          <h2>Idea map</h2>
          <Button
            variant="ghost"
            disabled={p.ideas.length >= 8}
            onClick={() =>
              onChange({
                ideas: [
                  ...p.ideas,
                  {
                    id: crypto.randomUUID(),
                    activity: "",
                    when: "",
                    where: "",
                    company: "",
                    why: "",
                  },
                ],
                approved: false,
              })
            }
          >
            <Plus size={15} />
            Add idea
          </Button>
        </div>
        {p.ideas.map((idea, i) => (
          <fieldset className="idea-card" key={idea.id}>
            <legend>Idea {i + 1}</legend>
            <button
              className="icon-button remove-idea"
              aria-label={`Remove idea ${i + 1}`}
              onClick={() =>
                onChange({
                  ideas: p.ideas.filter((item) => item.id !== idea.id),
                  approved: false,
                })
              }
            >
              <Trash2 size={15} />
            </button>
            <div className="idea-grid">
              {fields.map(([field, label]) => (
                <label
                  className={field === "activity" ? "wide" : ""}
                  key={field}
                >
                  <span>{label}</span>
                  <input
                    lang="ru"
                    value={idea[field]}
                    maxLength={500}
                    onChange={(e) => edit(idea.id, field, e.target.value)}
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        {message && <Notice>{message}</Notice>}
        <div className="activity-footer">
          <Continue
            label="Approve ideas"
            disabled={
              !p.ideas.length ||
              p.ideas.some((idea) => !idea.activity.trim()) ||
              busy
            }
            onClick={() => {
              onChange({ approved: true });
              finish();
            }}
          />
        </div>
      </section>
    );
  if (p.stage === 2)
    return (
      <SentenceBuilder
        challenge={sportsChallenge}
        tiles={p.tiles}
        onChange={(tiles) => {
          onChange({ tiles });
          setMessage("");
        }}
        onCheck={() => void check()}
        onContinue={finish}
        checked={checked}
        status={message}
        busy={busy}
      />
    );
  if (p.stage === 3)
    return (
      <ExpansionBuilder
        challenge={sportsChallenge}
        values={p.expansions}
        onChange={(expansions) => onChange({ expansions })}
        onContinue={finish}
      />
    );
  if (p.stage === 4)
    return (
      <section className="activity-card">
        <div className="section-title">
          <h2>Connect the ideas</h2>
          <Help label="Story rescue help">
            Choose a connection that fits each sentence. После этого describes a
            sequence; поэтому introduces a result. These sentences describe
            activities, not a timeline.
          </Help>
        </div>
        {mission.story.map((sentence, i) => (
          <div className="story-row" key={sentence.id}>
            <span className="story-number">{i + 1}</span>
            <div>
              <label className="sr-only" htmlFor={`transition-${sentence.id}`}>
                Connection for sentence {i + 1}
              </label>
              <select
                id={`transition-${sentence.id}`}
                lang="ru"
                value={p.transitions[sentence.id] ?? ""}
                onChange={(e) =>
                  onChange({
                    transitions: {
                      ...p.transitions,
                      [sentence.id]: e.target.value,
                    },
                  })
                }
              >
                <option value="">Выбери связку…</option>
                {mission.transitions.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <p lang="ru">{sentence.text}</p>
              {p.transitions[sentence.id] && (
                <p className="fine">
                  {p.transitions[sentence.id] === sentence.connector
                    ? sentence.explanation
                    : "Choose a first point, example, or additional activity."}
                </p>
              )}
            </div>
          </div>
        ))}
        <label htmlFor="missing-detail" className="field-label">
          Where do you play tennis?
        </label>
        <input
          id="missing-detail"
          lang="ru"
          maxLength={500}
          value={p.detail}
          onChange={(e) => onChange({ detail: e.target.value })}
        />
        <div className="activity-footer">
          <Continue
            disabled={
              !mission.story.every(
                (s) => p.transitions[s.id] === s.connector,
              ) || !language.hasDetail(p.detail)
            }
            onClick={finish}
          />
        </div>
      </section>
    );
  return (
    <section className="activity-card">
      <div className="section-title">
        <h2>Repair the sentences</h2>
        <Help label="Grammar detective help">
          С meaning “with” takes instrumental endings. После takes genitive.
          Type each complete repaired sentence. The feedback screen has more
          practice with these patterns.
        </Help>
      </div>
      {mission.grammar.map((g, i) => {
        const correct =
          language.normalize(p.repairs[i] ?? "") ===
          language.normalize(g.answer);
        return (
          <div className="grammar-card" key={g.id}>
            <p lang="ru" className="error-sentence">
              {g.error}
            </p>
            <label htmlFor={`repair-${i}`} className="field-label">
              Repair {i + 1}
            </label>
            <input
              id={`repair-${i}`}
              lang="ru"
              maxLength={1000}
              value={p.repairs[i] ?? ""}
              onChange={(e) =>
                onChange({
                  repairs: p.repairs.map((text, n) =>
                    n === i ? e.target.value : text,
                  ),
                })
              }
            />
            {correct ? (
              <Notice success>{g.explanation}</Notice>
            ) : (
              p.repairs[i] && (
                <p className="retry-text" role="status">
                  Check the ending after the preposition.
                </p>
              )
            )}
          </div>
        );
      })}
      <div className="activity-footer">
        <Continue
          label="Write independently"
          disabled={
            !mission.grammar.every(
              (g, i) =>
                language.normalize(p.repairs[i] ?? "") ===
                language.normalize(g.answer),
            )
          }
          onClick={finish}
        />
      </div>
    </section>
  );
}
