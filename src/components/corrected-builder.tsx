"use client";
import { useEffect, useRef, useState } from "react";
import { answerRequest } from "@/lib/client";
import {
  ReviewRequestGate,
  reviewAccepted,
  unavailableReview,
  type AnswerReview,
} from "@/lib/answer-review";
import { reviewedBuilderMatch } from "@/lib/builder-check";
import { AnswerFeedback } from "./answer-feedback";
import {
  buildTiles,
  canPractice,
  practiceUnits,
  roleLegend,
} from "@/lib/learning-engine";
import { normalizeRussian } from "@/lib/languages/ru";
import { renderedSentence, shuffleTiles } from "@/lib/languages/ru-quest";
import { reward, type MissionState } from "@/lib/quest-state";
import type { MissionId } from "@/lib/missions";
import { playCue } from "@/lib/sound";
import { Button, Notice } from "./ui";
import { Help } from "./help";
export function CorrectedBuilder({
  state,
  missionId,
  mode,
  sound,
  update,
  onComplete,
}: {
  state: MissionState;
  missionId: MissionId;
  mode: "demo" | "ai";
  sound: boolean;
  update: (fn: (s: MissionState) => MissionState) => void;
  onComplete: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const gate = useRef(new ReviewRequestGate()),
    checking = useRef(false);
  useEffect(() => () => gate.current.invalidate(), [mode]);
  const units = practiceUnits(state.engine);
  const index = Math.min(state.sentenceIndex, Math.max(0, units.length - 1));
  const u = units[index];
  if (
    !u ||
    !state.engine.units.every(canPractice) ||
    state.engine.analysisTranscript !== state.approvedTranscript
  )
    return (
      <Notice>
        These saved exercises predate correction review. Your work is preserved.
        Return to Shape Ideas to confirm reviewed models before building.
      </Notice>
    );
  const b = state.engine.build[u.id] ?? {
    level: 1,
    orders: {},
    completed: [],
    assistedLevels: [],
    attempts: 0,
    recall: "",
    message: "",
    hint: false,
  };
  const tiles = buildTiles(u, b.level),
    order = b.orders[String(b.level)] ?? [],
    pool = shuffleTiles(
      tiles.length,
      state.generation!.shuffleSeed + b.level + index,
    );
  const text = renderedSentence(
    order.map((i) => tiles[i]?.text ?? ""),
    u.corrected,
  );
  function patch(p: Partial<typeof b>) {
    if (p.orders || p.recall !== undefined || p.level !== undefined) {
      gate.current.invalidate();
      p.answerReview = undefined;
    }
    update((s) =>
      practiceUnits(s.engine).find((v) => v.id === u.id)?.corrected !== u.corrected
        ? s
        : {
            ...s,
            engine: {
              ...s.engine,
              build: { ...s.engine.build, [u.id]: { ...b, ...p } },
            },
          },
    );
  }
  function setOrder(next: number[]) {
    patch({ orders: { ...b.orders, [b.level]: next }, message: "" });
  }
  async function check() {
    if (order.length !== tiles.length || new Set(order).size !== tiles.length) {
      patch({
        attempts: b.attempts + 1,
        message:
          "Use every tile once. Essential phrases stay together in Level 1.",
      });
      return;
    }
    if (u.practiceDraft) {
      const same = normalizeRussian(text) === normalizeRussian(u.corrected);
      if (!same) {
        patch({ attempts: b.attempts + 1, message: "Rebuild the version you selected. This checks the word sequence, not grammar." });
        return;
      }
      update((s) => ({
        ...reward(s, `independent-build:${u.id}:${b.level}`),
        engine: { ...s.engine, build: { ...s.engine.build, [u.id]: {
          ...b, attempts: b.attempts + 1, completed: [...new Set([...b.completed, b.level])],
          message: "Selected version rebuilt. Grammar practice will use your original wording; this is not a grammar approval.",
        } } },
      }));
      return;
    }
    if (checking.current) return;
    const token = gate.current.begin();
    let result: AnswerReview;
    const matched = reviewedBuilderMatch(u, text);
    if (matched) {
      result = matched;
    } else {
      checking.current = true;
      setBusy(true);
      try {
        result = await answerRequest({
          activity: "builder",
          missionId,
          mode,
          text,
          reference: u.corrected,
        });
      } catch {
        result = unavailableReview(text);
      }
      checking.current = false;
      setBusy(false);
    }
    if (!gate.current.current(token)) return;
    const valid = reviewAccepted(result),
      explanation = result.explanation;
    if (valid) {
      playCue(sound, "success");
      update((s) => ({
        ...reward(s, `independent-build:${u.id}:${b.level}`),
        engine: {
          ...s.engine,
          build: {
            ...s.engine.build,
            [u.id]: {
              ...b,
              answerReview: result,
              attempts: b.attempts + 1,
              completed: [...new Set([...b.completed, b.level])],
              message:
                b.level === 3
                  ? (b.assistedLevels.includes(3)
                      ? "You rebuilt it with a model hint. "
                      : "You rebuilt it from meaning using neutral tiles. ") +
                    explanation
                  : explanation,
            },
          },
        },
      }));
    } else
      patch({
        attempts: b.attempts + 1,
        message: explanation,
        answerReview: result,
        assistedLevels: result.suggestion
          ? [...new Set([...b.assistedLevels, b.level])]
          : b.assistedLevels,
      });
  }
  const done = b.completed.includes(b.level);
  return (
    <section className="q-panel">
      <div className="q-section-line">
        <span className="q-eyebrow">
          SENTENCE {index + 1}/{units.length} · LEVEL {b.level}/3
        </span>
        <Help label="Builder keyboard help">
          Tab to a tile, Enter to select or remove it. Arrow buttons move
          selected tiles. Drag onto the sentence to add a tile or onto another
          selected tile to place it. Level 1 keeps phrases intact; Level 2
          separates words; Level 3 removes color cues; tap the words from
          meaning.
        </Help>
      </div>
      <h2>
        {b.level === 3
          ? "Rebuild without color clues"
          : "Colored Sentence Builder"}
      </h2>
      <p>
        Idea: <span lang="ru">{u.intendedMeaning}</span>
      </p>
      {b.level === 1 && (
        <p className="fine" lang="ru">
          {u.corrected}
        </p>
      )}
      {<details className="q-review">
        <summary>Grammar color legend</summary>
        <div className="q-role-legend">
          {Object.entries(roleLegend).map(([role, label]) => (
            <span className={`q-tile ${role}`} key={role}>
              {label}
            </span>
          ))}
        </div>
      </details>}
      {u.practiceDraft && <p className="fine">Your selected draft · rebuild its words. Grammar is practiced separately.</p>}
      <fieldset disabled={busy}>
        <legend className="sr-only">Build your selected sentence</legend>

        <>
          <div
            className="q-sentence-zone"
            aria-label="Assembled sentence"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const raw = e.dataTransfer.getData("text/plain");
              const id = Number(raw);
              if (raw && tiles[id] && !order.includes(id))
                setOrder([...order, id]);
            }}
          >
            {!order.length && (
              <span className="q-drop-label">Build your sentence here</span>
            )}
            {order.map((id, pos) => (
              <div
                className="q-selected-tile"
                key={id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.stopPropagation();
                  const raw = e.dataTransfer.getData("text/plain"),
                    n = Number(raw);
                  if (!raw || !tiles[n]) return;
                  const next = order.filter((x) => x !== n);
                  next.splice(pos, 0, n);
                  setOrder(next);
                }}
              >
                <button
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData("text/plain", String(id))
                  }
                  className={`q-tile ${b.level === 3 ? "neutral" : tiles[id].role}`}
                  aria-label={`Remove tile ${id + 1}: ${tiles[id].text}`}
                  onClick={() => setOrder(order.filter((v) => v !== id))}
                >
                  <span lang="ru">{tiles[id].text}</span>
                  {b.level < 3 && <small>{roleLegend[tiles[id].role]}</small>}
                </button>
                <div className="q-move">
                  <button
                    aria-label={`Move tile ${id + 1} left`}
                    disabled={pos === 0}
                    onClick={() => {
                      const next = [...order];
                      [next[pos - 1], next[pos]] = [next[pos], next[pos - 1]];
                      setOrder(next);
                    }}
                  >
                    ←
                  </button>
                  <button
                    aria-label={`Move tile ${id + 1} right`}
                    disabled={pos === order.length - 1}
                    onClick={() => {
                      const next = [...order];
                      [next[pos + 1], next[pos]] = [next[pos], next[pos + 1]];
                      setOrder(next);
                    }}
                  >
                    →
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="q-tile-bank">
            {pool.map((id) => (
              <button
                draggable
                onDragStart={(e) =>
                  e.dataTransfer.setData("text/plain", String(id))
                }
                key={id}
                className={`q-tile ${b.level === 3 ? "neutral" : tiles[id].role}`}
                disabled={order.includes(id)}
                aria-label={`Add tile ${id + 1}: ${tiles[id].text}`}
                onClick={() => setOrder([...order, id])}
              >
                <span lang="ru">{tiles[id].text}</span>
                {b.level < 3 && <small>{roleLegend[tiles[id].role]}</small>}
              </button>
            ))}
          </div>
        </>
      </fieldset>
      {b.answerReview ? (
        <AnswerFeedback review={b.answerReview} retry={() => void check()} />
      ) : (
        b.message && <Notice success={done}>{b.message}</Notice>
      )}
      {b.attempts > 0 && !done && (
        <>
          <Button
            variant="ghost"
            onClick={() => {
              patch({
                hint: !b.hint,
                assistedLevels: [...new Set([...b.assistedLevels, b.level])],
              });
              if (!b.hint)
                update((s) => ({
                  ...s,
                  engine: { ...s.engine, hintCount: s.engine.hintCount + 1 },
                }));
            }}
          >
            Hint
          </Button>
          {b.hint && (
            <p className="q-model-hint" lang="ru">
              {u.corrected}
            </p>
          )}
        </>
      )}
      <div className="q-actions">
        {done && b.level < 3 ? (
          <Button
            onClick={() =>
              patch({
                level: b.level + 1,
                attempts: 0,
                message: "",
                hint: false,
              })
            }
          >
            Continue · less support →
          </Button>
        ) : (
          <Button
            disabled={busy || done || !text.trim()}
            onClick={() => void check()}
          >
            {busy
              ? "Checking…"
              : done
                ? "Level complete ✓"
                : "Check construction"}
          </Button>
        )}
      </div>
      <div className="q-sentence-nav">
        <Button
          variant="secondary"
          disabled={index === 0 || busy}
          onClick={() => update((s) => ({ ...s, sentenceIndex: index - 1 }))}
        >
          Previous
        </Button>
        <span>
          {
            units.filter((v) => state.engine.build[v.id]?.completed.includes(3))
              .length
          }
          /{units.length} rebuilt
        </span>
        <Button
          variant="secondary"
          disabled={index === units.length - 1 || busy}
          onClick={() => update((s) => ({ ...s, sentenceIndex: index + 1 }))}
        >
          Next sentence
        </Button>
      </div>
      <div className="q-gallery">
        {units.map((v, i) => (
          <button
            disabled={busy}
            key={v.id}
            onClick={() => update((s) => ({ ...s, sentenceIndex: i }))}
          >
            {i + 1}.{" "}
            {state.engine.build[v.id]?.completed.includes(3)
              ? v.corrected
              : "In progress"}
          </button>
        ))}
      </div>
      <div className="q-actions">
        <Button
          disabled={
            !units.every((v) => state.engine.build[v.id]?.completed.includes(3))
          }
          onClick={onComplete}
        >
          Expand and connect →
        </Button>
      </div>
    </section>
  );
}
