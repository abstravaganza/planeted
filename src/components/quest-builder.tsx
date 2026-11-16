"use client";
import { useState } from "react";
import { z } from "zod";
import { ArrowLeft, ArrowRight, Check, RotateCcw } from "lucide-react";
import {
  checkOrder,
  shuffleTiles,
  renderedSentence,
  tokens,
  tileRole,
  roleLabels,
} from "@/lib/languages/ru-quest";
import { sentenceVerdictSchema } from "@/lib/contracts";
import { reward, type MissionState } from "@/lib/quest-state";
import type { MissionId } from "@/lib/missions";
import { Button, Notice } from "./ui";
import { Help } from "./help";
export function QuestBuilder({
  state,
  missionId,
  mode,
  update,
  onComplete,
}: {
  state: MissionState;
  missionId: MissionId;
  mode: "demo" | "ai";
  update: (fn: (s: MissionState) => MissionState) => void;
  onComplete: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const g = state.generation!;
  const index = Math.min(state.sentenceIndex, g.sentences.length - 1);
  const sentence = g.sentences[index];
  const words = tokens(sentence.text);
  const b = g.builds[sentence.id] ?? {
    order: [],
    done: false,
    attempts: 0,
    message: "",
    provenance: "unreviewed" as const,
  };
  // Stable shuffle for a generation; duplicate words retain separate numeric identities.
  const shuffled = shuffleTiles(words.length, g.shuffleSeed + index);
  function patch(patch: Partial<typeof b>) {
    update((s) => {
      if (
        !s.generation ||
        s.generation.sentences.find((v) => v.id === sentence.id)?.text !==
          sentence.text
      )
        return s;
      return {
        ...s,
        generation: {
          ...s.generation,
          builds: { ...s.generation.builds, [sentence.id]: { ...b, ...patch } },
        },
      };
    });
  }
  function order(ids: number[]) {
    patch({ order: ids, done: false, message: "", provenance: "unreviewed" });
  }
  async function check() {
    const result = checkOrder(sentence.text, b.order);
    if (result === "incomplete") {
      patch({
        attempts: b.attempts + 1,
        message: "Use every tile once before checking.",
      });
      return;
    }
    if (result === "accepted") {
      finish(
        b.order.every((v, i) => v === i) ? "reconstruction" : "reviewed",
        "Sentence assembled. This matches your approved wording or a reviewed word order.",
      );
      return;
    }
    if (mode === "demo") {
      patch({
        attempts: b.attempts + 1,
        message:
          "This order is unreviewed, not necessarily wrong. Try your approved wording, or use AI review when available.",
      });
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/quest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          missionId,
          operation: "sentence",
          mode,
          text: renderedSentence(
            b.order.map((i) => words[i]),
            sentence.text,
          ),
          reference: sentence.text,
        }),
      });
      if (!response.ok) throw new Error();
      const data = z
        .object({ source: z.enum(["demo", "ai"]), data: sentenceVerdictSchema })
        .parse(await response.json());
      if (
        data.source === "ai" &&
        data.data.accepted &&
        data.data.meaningPreserved &&
        data.data.agreementCorrect
      )
        finish("ai", data.data.explanation);
      else patch({ attempts: b.attempts + 1, message: data.data.explanation });
    } catch {
      patch({
        attempts: b.attempts + 1,
        message:
          "Review could not finish. Your tiles are saved. Retry or reconstruct your approved wording.",
      });
    } finally {
      setBusy(false);
    }
  }
  function finish(
    provenance: "reconstruction" | "reviewed" | "ai",
    message: string,
  ) {
    update((s) => {
      if (
        !s.generation ||
        s.generation.sentences.find((v) => v.id === sentence.id)?.text !==
          sentence.text
      )
        return s;
      return {
        ...reward(s, `build:${sentence.id}`),
        generation: {
          ...s.generation,
          builds: {
            ...s.generation.builds,
            [sentence.id]: {
              ...b,
              done: true,
              attempts: b.attempts + 1,
              message,
              provenance,
            },
          },
        },
      };
    });
  }
  return (
    <section className="q-panel builder-panel">
      <div className="q-section-line">
        <span className="q-eyebrow">
          SENTENCE {index + 1} OF {g.sentences.length}
        </span>
        <Help label="Sentence Builder help">
          Tap a tile to add or remove it. Tab and Enter work too. Selected tiles
          have left/right controls. Drag a tile onto the sentence or another
          selected tile. Colors also have role labels. Natural alternate orders
          can be reviewed; an unreviewed order is not marked wrong.
        </Help>
      </div>
      <h2>Colored Sentence Builder</h2>
      <p className="fine">
        Your approved idea · <span lang="ru">{sentence.text}</span>
      </p>
      <fieldset disabled={busy}>
        <legend className="sr-only">
          Arrange words from your approved idea
        </legend>
        <div
          className={`q-sentence-zone ${b.done ? "is-complete" : ""}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const id = Number(e.dataTransfer.getData("text/plain"));
            if (Number.isInteger(id) && words[id] && !b.order.includes(id))
              order([...b.order, id]);
          }}
          aria-label="Assembled sentence"
        >
          {b.order.length === 0 ? (
            <span className="q-drop-label">Your sentence starts here</span>
          ) : (
            b.order.map((id, pos) => (
              <div
                className="q-selected-tile"
                key={id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.stopPropagation();
                  const incoming = Number(e.dataTransfer.getData("text/plain"));
                  if (!Number.isInteger(incoming) || !words[incoming]) return;
                  const next = b.order.filter((n) => n !== incoming);
                  next.splice(pos, 0, incoming);
                  order(next);
                }}
              >
                <button
                  className={`q-tile ${tileRole(words[id])}`}
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setData("text/plain", String(id))
                  }
                  aria-label={`Remove ${words[id]}, word ${id + 1}`}
                  onClick={() => order(b.order.filter((n) => n !== id))}
                >
                  <span lang="ru">{words[id]}</span>
                  <small>{roleLabels[tileRole(words[id])]}</small>
                </button>
                <div className="q-move">
                  <button
                    aria-label={`Move word ${id + 1} left`}
                    disabled={pos === 0}
                    onClick={() => {
                      const next = [...b.order];
                      [next[pos - 1], next[pos]] = [next[pos], next[pos - 1]];
                      order(next);
                    }}
                  >
                    ←
                  </button>
                  <button
                    aria-label={`Move word ${id + 1} right`}
                    disabled={pos === b.order.length - 1}
                    onClick={() => {
                      const next = [...b.order];
                      [next[pos + 1], next[pos]] = [next[pos], next[pos + 1]];
                      order(next);
                    }}
                  >
                    →
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="q-tile-bank" aria-label="Available word tiles">
          {shuffled.map((id) => (
            <button
              key={id}
              draggable
              onDragStart={(e) =>
                e.dataTransfer.setData("text/plain", String(id))
              }
              className={`q-tile ${tileRole(words[id])}`}
              disabled={b.order.includes(id)}
              aria-label={`Add ${words[id]}, word ${id + 1}`}
              onClick={() => order([...b.order, id])}
            >
              <span lang="ru">{words[id]}</span>
              <small>{roleLabels[tileRole(words[id])]}</small>
            </button>
          ))}
        </div>
      </fieldset>
      {b.message && (
        <Notice success={b.done}>
          {b.message}
          {b.done && <strong> +10 XP · once per sentence</strong>}
        </Notice>
      )}
      {b.attempts > 0 && !b.done && (
        <details className="q-review">
          <summary>Hint</summary>
          <p lang="ru">{sentence.text}</p>
          <p>Keep each preposition with the noun phrase it governs.</p>
        </details>
      )}
      <div className="q-actions">
        <Button variant="ghost" disabled={busy} onClick={() => order([])}>
          <RotateCcw size={16} /> Reset
        </Button>
        <Button disabled={busy || b.done} onClick={() => void check()}>
          {busy ? "Reviewing…" : b.done ? "Built ✓" : "Check sentence"}
        </Button>
      </div>
      <div className="q-sentence-nav">
        <Button
          variant="secondary"
          disabled={busy || index === 0}
          onClick={() => update((s) => ({ ...s, sentenceIndex: index - 1 }))}
        >
          <ArrowLeft size={16} />
          Previous
        </Button>
        <span>
          {Object.values(g.builds).filter((v) => v.done).length}/
          {g.sentences.length} built
        </span>
        <Button
          variant="secondary"
          disabled={busy || index === g.sentences.length - 1}
          onClick={() => update((s) => ({ ...s, sentenceIndex: index + 1 }))}
        >
          Next
          <ArrowRight size={16} />
        </Button>
      </div>
      <div className="q-gallery" aria-label="Sentence collection">
        {g.sentences.map((s, i) => (
          <button
            key={s.id}
            className={g.builds[s.id]?.done ? "built" : ""}
            aria-label={`Review sentence ${i + 1}`}
            onClick={() => update((m) => ({ ...m, sentenceIndex: i }))}
          >
            {g.builds[s.id]?.done ? <Check size={16} /> : <span>{i + 1}</span>}
            <span lang="ru">
              {g.builds[s.id]?.done
                ? renderedSentence(
                    g.builds[s.id].order.map((n) => tokens(s.text)[n]),
                    s.text,
                  )
                : "Build this idea"}
            </span>
          </button>
        ))}
      </div>
      <div className="q-actions">
        <Button
          disabled={!g.sentences.every((s) => g.builds[s.id]?.done)}
          onClick={onComplete}
        >
          Expand your ideas →
        </Button>
      </div>
    </section>
  );
}
