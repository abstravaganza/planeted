"use client";
import { useState } from "react";
import { contextualChoices } from "@/lib/languages/ru-quest";
import { reward, type Generation, type MissionState } from "@/lib/quest-state";
import { Button, Notice } from "./ui";
import { Help } from "./help";
export function assembledParagraph(g: Generation, sequence: boolean) {
  const out: string[] = [];
  for (let i = 0; i < g.sentences.length; i++) {
    const s = g.sentences[i];
    const c = contextualChoices(
      s.text,
      g.sentences[i + 1]?.text,
      sequence,
    ).find((c) => c.id === g.expansions[s.id]);
    out.push(c?.after ?? s.text);
    if (c?.id === "addition" || c?.id === "sequence") i++;
  }
  return out.join(" ");
}
export function QuestExpansion({
  state,
  sequence,
  update,
  onComplete,
}: {
  state: MissionState;
  sequence: boolean;
  update: (fn: (s: MissionState) => MissionState) => void;
  onComplete: () => void;
}) {
  const [index, setIndex] = useState(0);
  const g = state.generation!;
  const sentence = g.sentences[index];
  const choices = contextualChoices(
    sentence.text,
    g.sentences[index + 1]?.text,
    sequence,
  );
  const choice = choices.find((c) => c.id === g.expansions[sentence.id]);
  const paragraph = assembledParagraph(g, sequence);
  const changed = Object.keys(g.expansions).length;
  return (
    <section className="q-panel">
      <div className="q-section-line">
        <span className="q-eyebrow">MAKE THE MEANING GROW</span>
        <Help label="Expansion help">
          Choose a new detail only if it is true for you. Connecting choices
          reuse your approved ideas. New details are suggestions you choose, not
          facts inferred about you. Length alone does not earn XP. One reward
          per sentence.
        </Help>
      </div>
      <h2>Expand and connect</h2>
      <div className="q-unit-tabs" aria-label="Choose a sentence to expand">
        {g.sentences.map((s, i) => (
          <button
            key={s.id}
            aria-pressed={index === i}
            onClick={() => setIndex(i)}
          >
            {i + 1}
            {g.expansions[s.id] ? " ✓" : ""}
          </button>
        ))}
      </div>
      <div className="q-transformation">
        <div className="q-before">
          <span className="q-eyebrow">BEFORE</span>
          <p lang="ru">{sentence.text}</p>
        </div>
        <span className="q-transform-arrow" aria-hidden="true">
          ↓
        </span>
        <div
          className={`q-after ${choice ? "has-growth" : ""}`}
          key={`${sentence.id}-${choice?.id}`}
        >
          <span className="q-eyebrow">
            AFTER · {choice?.kind ?? "YOUR CHOICE"}
          </span>
          <p lang="ru">
            {choice ? highlight(choice.after, choice.added) : sentence.text}
          </p>
          <div className="q-growth">
            <span style={{ width: choice ? "100%" : "22%" }} />
          </div>
          <p className="fine">
            {choice?.why ?? "Choose a useful detail or a connection below."}
          </p>
        </div>
      </div>
      <p className="fine">New detail? Choose it only if it is true for you.</p>
      <div className="q-expansion-choices">
        {choices.map((c) => (
          <button
            className={choice?.id === c.id ? "selected" : ""}
            key={c.id}
            aria-pressed={choice?.id === c.id}
            onClick={() =>
              update((s) => {
                if (!s.generation) return s;
                return {
                  ...reward(s, `expand:${sentence.id}`),
                  generation: {
                    ...s.generation,
                    expansions: {
                      ...s.generation.expansions,
                      [sentence.id]: c.id,
                    },
                  },
                };
              })
            }
          >
            <small>{c.kind}</small>
            <span lang="ru">{c.label}</span>
          </button>
        ))}
      </div>
      {!choices.length && (
        <Notice>
          No reviewed addition fits this sentence. Keep your wording or return
          to Shape Ideas to add another idea. No personal detail will be
          invented.
        </Notice>
      )}
      <div className="q-paragraph">
        <span className="q-eyebrow">YOUR DEVELOPING PARAGRAPH</span>
        <p lang="ru">{paragraph}</p>
      </div>
      <div className="q-actions">
        <span>
          {changed} meaning-building choices · +10 XP per sentence once
        </span>
        <Button
          disabled={
            changed === 0 &&
            g.sentences.some(
              (s, i) =>
                contextualChoices(s.text, g.sentences[i + 1]?.text, sequence)
                  .length > 0,
            )
          }
          onClick={() => {
            update((s) => ({
              ...s,
              generation: s.generation ? { ...s.generation, paragraph } : null,
            }));
            onComplete();
          }}
        >
          Grammar Detective →
        </Button>
      </div>
    </section>
  );
}
function highlight(text: string, added: string) {
  const at = text.indexOf(added);
  return at < 0 ? (
    text
  ) : (
    <>
      {text.slice(0, at)}
      <mark>{added}</mark>
      {text.slice(at + added.length)}
    </>
  );
}
