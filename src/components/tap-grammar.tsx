"use client";
import {
  conceptRules,
  practiceItems,
  checkTap,
  speechIssues,
  suggestedConcept,
} from "@/lib/tap-grammar";
import { emptyTapSession, type Concept } from "@/lib/tap-contracts";
import {
  replayTapPractice,
  reward,
  type MissionState,
} from "@/lib/quest-state";
import { Users, CalendarDays, MessageCircle, Search, Sparkles } from "lucide-react";
import { Button, Notice } from "./ui";
import { playCue } from "@/lib/sound";
export function TapGrammar({
  state,
  update,
  onComplete,
  sound,
}: {
  state: MissionState;
  update: (fn: (m: MissionState) => MissionState) => void;
  onComplete: () => void;
  sound: boolean;
}) {
  const tap = state.engine.tap;
  const issues =
    state.engine.analysisTranscript === state.approvedTranscript
      ? speechIssues(state.engine.units)
      : [];
  const suggested = suggestedConcept(issues, tap.sessions, tap.needsReview);
  const concept = tap.chosen ? tap.selected : suggested;
  const rule = conceptRules[concept],
    s = tap.sessions[concept] ?? emptyTapSession();
  const items = practiceItems(concept, s.round, issues),
    item = items[Math.min(s.index, items.length - 1)];
  const linked = issues.filter((i) => i.concept === concept);
  function patch(p: Partial<typeof s>) {
    update((m) => ({
      ...m,
      engine: {
        ...m.engine,
        tap: {
          ...m.engine.tap,
          sessions: { ...m.engine.tap.sessions, [concept]: { ...s, ...p } },
        },
      },
    }));
  }
  function check(selections: Record<string, string>) {
    const answer = checkTap(item, selections);
    playCue(sound, answer.correct ? "success" : "pop");
    const next = {
      ...s,
      selections,
      correct: answer.correct,
      attempts: s.attempts + 1,
      mistakes: s.mistakes + (answer.correct ? 0 : 1),
      message: answer.message,
      completed: answer.correct
        ? [...new Set([...s.completed, item.id])]
        : s.completed,
    };
    update((m) => ({
      ...(answer.correct ? reward(m, `tap:${concept}:${item.id}`) : m),
      engine: {
        ...m.engine,
        tap: {
          ...m.engine.tap,
          needsReview: !answer.correct
            ? [...new Set([...m.engine.tap.needsReview, concept])]
            : m.engine.tap.needsReview,
          sessions: { ...m.engine.tap.sessions, [concept]: next },
        },
      },
    }));
  }
  const bad = item.options.find((v) => !v.correct),
    parts = item.prompt.split("___");
  const RuleIcon = concept === "with" ? Users : concept === "because" ? MessageCircle : CalendarDays;
  return (
    <section className={`q-panel q-tap-grammar q-detective-palette-${s.index % 4}`}>
      <div className="q-detective-badge"><Search size={24} aria-hidden="true" /> GRAMMAR DETECTIVE</div>
      <span className="q-eyebrow">LISTEN → NOTICE → TAP → TRY AGAIN</span>
      <h2>Your grammar workout</h2>
      <nav className="pattern-tabs" aria-label="Grammar workouts">
        {(Object.keys(conceptRules) as Concept[]).map((id) => (
          <button
            key={id}
            aria-pressed={concept === id}
            onClick={() =>
              update((m) => ({
                ...m,
                engine: {
                  ...m.engine,
                  tap: { ...m.engine.tap, selected: id, chosen: true },
                },
              }))
            }
          >
            {conceptRules[id].title}
            {id === suggested ? " · suggested" : ""}
          </button>
        ))}
      </nav>
      {linked.length ? (
        <div className="q-speech-link">
          <strong>From your reviewed transcript</strong>
          {linked.map((i, n) => (
            <p key={n}>
              <span lang="ru">
                <del>{i.original}</del> → <mark>{i.corrected}</mark>
              </span>
              <small>
                {i.source === "ai"
                  ? "AI-reviewed correction"
                  : "Supported reviewed-example correction"}{" "}
                · New practice below uses this same pattern.
              </small>
            </p>
          ))}
        </div>
      ) : (
        <p className="q-provenance">
          {tap.needsReview.includes(concept)
            ? "Review from an earlier practice attempt"
            : "General example practice · not an identified speech mistake"}
        </p>
      )}
      <details className="q-rule-discovery">
        <summary><Sparkles size={18} aria-hidden="true" /> See the rule</summary>
        <div className="q-rule-poster">
          <div className="q-rule-illustration" aria-hidden="true"><RuleIcon size={64} strokeWidth={1.5} /><span>→</span><Sparkles size={32} /></div>
          <h3>{rule.title}</h3>
          <p>{rule.rule}</p>
          <div className="q-rule-transformations">
            {rule.chart.map((row) => (
              <div key={row.label}>
                <span className="q-rule-label">{row.label}</span>
                <span lang="ru" className="q-rule-before">{row.before}</span>
                <span aria-label="becomes" className="q-rule-arrow">→</span>
                <strong lang="ru">{row.after}</strong>
              </div>
            ))}
          </div>
        </div>
      </details>
      {s.done ? (
        <div className="q-tap-finish">
          <span aria-hidden="true">✦</span>
          <h3>Pattern practiced</h3>
          <p>
            {s.completed.length} tasks completed. Recognition practice prepares
            you for writing; it does not certify independent use.
          </p>
          <div className="q-actions">
            <Button
              variant="secondary"
              onClick={() =>
                update((m) =>
                  replayTapPractice({
                    ...m,
                    engine: {
                      ...m.engine,
                      tap: { ...m.engine.tap, selected: concept },
                    },
                  }),
                )
              }
            >
              Try a fresh round
            </Button>
            <Button onClick={onComplete}>Ready for the boss →</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="q-section-line">
            <span className="q-eyebrow">
              {s.index + 1}/{items.length} ·{" "}
              {item.kind === "message"
                ? "MESSAGE RESCUE"
                : item.kind === "pairs"
                  ? "ENDING LAB"
                  : "BUBBLE PICK"}
            </span>
            <Button
              variant="ghost"
              onClick={() =>
                update((m) =>
                  replayTapPractice({
                    ...m,
                    engine: {
                      ...m.engine,
                      tap: { ...m.engine.tap, selected: concept },
                    },
                  }),
                )
              }
            >
              Restart practice
            </Button>
          </div>
          {item.context && <p className="fine">{item.context}</p>}
          {item.kind === "message" && bad && item.prompt.includes("___") ? (
            <div className="q-message-rescue">
              <small>
                {item.id.startsWith("speech:")
                  ? "YOUR APPROVED TRANSCRIPT · TAP THE PART TO REPAIR"
                  : "EXAMPLE MESSAGE · TAP THE PART THAT NEEDS REPAIR"}
              </small>
              <div lang="ru">
                {[
                  parts[0],
                  s.correct
                    ? (item.options.find((o) => o.id === s.selections.answer)
                        ?.label ?? bad.label)
                    : bad.label,
                  parts[1],
                ].map(
                  (part, i) =>
                    part && (
                      <button
                        key={i}
                        disabled={s.targetFound || s.correct}
                        className={i === 1 && s.targetFound ? "found" : ""}
                        onClick={() =>
                          patch({
                            targetFound: i === 1,
                            message:
                              i === 1
                                ? "Found it. Now choose a repair below."
                                : "That part fits. Look at the form that fills the gap.",
                          })
                        }
                      >
                        {part}
                      </button>
                    ),
                )}
              </div>
            </div>
          ) : (
            <p
              className="q-tap-prompt"
              lang={/^[A-Za-z]/.test(item.prompt) ? "en" : "ru"}
            >
              {item.prompt}
            </p>
          )}
          {item.kind === "pairs" ? (
            <div className="q-ending-lab">
              {item.slots?.map((slot, i) => (
                <fieldset key={slot.label} disabled={s.correct}>
                  <legend>{slot.label}</legend>
                  {slot.options.map((opt) => (
                    <button
                      key={opt.id}
                      aria-pressed={s.selections[String(i)] === opt.id}
                      onClick={() =>
                        patch({
                          selections: { ...s.selections, [String(i)]: opt.id },
                          message: "",
                          correct: false,
                        })
                      }
                      lang="ru"
                    >
                      {opt.label}
                    </button>
                  ))}
                </fieldset>
              ))}
              <Button disabled={s.correct} onClick={() => check(s.selections)}>
                Check the pair
              </Button>
            </div>
          ) : (
            (item.kind !== "message" ||
              s.targetFound ||
              !item.prompt.includes("___")) && (
              <div
                className="q-bubble-bank"
                role="group"
                aria-label="Grammar answers"
              >
                {item.options.map((opt) => (
                  <button
                    className={`q-bubble ${s.selections.answer === opt.id ? "selected" : ""}`}
                    key={opt.id}
                    disabled={s.correct}
                    aria-pressed={s.selections.answer === opt.id}
                    lang="ru"
                    onClick={() => check({ answer: opt.id })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )
          )}
          {s.message && (
            <Notice success={s.correct}>
              <strong>{s.correct ? "✓ Correct · " : "↻ Keep going · "}</strong>
              {s.message}
            </Notice>
          )}
          {!s.correct && (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  patch({ hint: !s.hint });
                  if (!s.hint)
                    update((m) => ({
                      ...m,
                      engine: {
                        ...m.engine,
                        hintCount: m.engine.hintCount + 1,
                      },
                    }));
                }}
              >
                Hint
              </Button>
              {s.hint && <p>{item.hint}</p>}
            </>
          )}
          {s.correct && (
            <Button
              onClick={() =>
                patch(
                  s.index === items.length - 1
                    ? { done: true, message: "" }
                    : {
                        index: s.index + 1,
                        selections: {},
                        targetFound: false,
                        correct: false,
                        hint: false,
                        message: "",
                      },
                )
              }
            >
              Continue →
            </Button>
          )}
          <details className="q-review">
            <summary>Pause this pattern</summary>
            <p>{rule.rule} This keeps the pattern on your review list.</p>
            <Button
              variant="secondary"
              onClick={() => {
                update((m) => ({
                  ...m,
                  engine: {
                    ...m.engine,
                    tap: {
                      ...m.engine.tap,
                      needsReview: [
                        ...new Set([...m.engine.tap.needsReview, concept]),
                      ],
                    },
                  },
                }));
                onComplete();
              }}
            >
              Continue with review pending →
            </Button>
          </details>
        </>
      )}
    </section>
  );
}
