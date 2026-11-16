"use client";
import { useState } from "react";
import { contextualChoices, sentenceGrowth } from "@/lib/languages/ru-quest";
import { expansionQuestions, storyCards, checkStory } from "@/lib/story-rescue";
import { canPractice, practiceUnits } from "@/lib/learning-engine";
import { reward, type MissionState } from "@/lib/quest-state";
import { type MissionId } from "@/lib/missions";
import { Button, Notice } from "./ui";
export function DevelopStage({
  state,
  update,
  onComplete,
}: {
  state: MissionState;
  missionId: MissionId;
  mode: "demo" | "ai";
  update: (fn: (s: MissionState) => MissionState) => void;
  onComplete: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [questionOverride, setQuestionOverride] = useState<
    Record<string, string>
  >({});
  const units = practiceUnits(state.engine);
  const u = units[index];
  if (!state.generation || !u || !state.engine.units.every(canPractice))
    return <Notice>Confirm reviewed models before expanding.</Notice>;
  const existing = state.engine.expansion[u.id];
  const base = u.corrected;
  const personal = contextualChoices(base).filter((c) =>
    expansionQuestions.some((q) => q.id === c.kind),
  );
  const nextIdea = units.length > 1 ? units[(index + 1) % units.length].corrected : undefined;
  const all = personal.length ? personal : contextualChoices(base, nextIdea).filter((c) =>
    expansionQuestions.some((q) => q.id === c.kind),
  );
  const example = false;
  const questions = expansionQuestions.filter((q) =>
    all.some((c) => c.kind === q.id),
  );
  const selected =
    questions.find((q) => q.id === existing?.question) ?? questions[0];
  const question =
    questions.find((q) => q.id === questionOverride[u.id]) ?? selected;
  const choices = all.filter((c) => c.kind === question?.id);
  const currentChoice = all.find((c) => c.after === existing?.draft);
  const grown = currentChoice ? currentChoice.after : base;
  const growth = sentenceGrowth(base, grown);
  const story = state.engine.story,
    scaffolded = !state.ledger.includes("story-rescued");
  function storyPatch(p: Partial<typeof story>) {
    update((s) => ({
      ...s,
      engine: { ...s.engine, story: { ...s.engine.story, ...p } },
    }));
  }
  const hasAttempt = Object.values(state.engine.expansion).some((v) =>
    v.draft.trim(),
  );
  return (
    <section className="q-panel q-develop-canvas">
      <span className="q-eyebrow">TAP → EXPAND → CONNECT</span>
      <h2>Add a detail</h2>
      <div className="q-unit-tabs">
        {units.map((v, i) => (
          <button
            key={v.id}
            aria-label={`Expand sentence ${i + 1}`}
            aria-pressed={i === index}
            onClick={() => setIndex(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <p className="q-provenance">Choose a detail that fits what you want to say.</p>
      <div className="q-growing-sentence" aria-live="polite" aria-atomic="true" key={u.id}>
        <span className="q-eyebrow">{currentChoice ? "YOUR IDEA, EXPANDED" : "YOUR STARTING IDEA"}</span>
        <p lang="ru">{growth.before}<mark key={grown}>{growth.added}</mark>{growth.after}</p>
      </div>
      <nav className="pattern-tabs" aria-label="Expansion questions">
        {questions.map((q) => (
          <button
            key={q.id}
            aria-pressed={q.id === question?.id}
            onClick={() => setQuestionOverride((v) => ({ ...v, [u.id]: q.id }))}
          >
            {q.ru} · {q.en}
          </button>
        ))}
      </nav>
      <div className="q-detail-cards">
        {choices.map((c) => (
          <button
            key={c.id}
            aria-pressed={existing?.draft === c.after}
            onClick={() =>
              update((s) => ({
                ...reward(
                  s,
                  `${example ? "example-expanded" : "meaning-expanded"}:${u.id}`,
                ),
                engineHistory:
                  existing?.draft && existing.draft !== c.after
                    ? [
                        ...s.engineHistory,
                        {
                          createdAt: Date.now(),
                          generation: s.generation,
                          engine: s.engine,
                        },
                      ]
                    : s.engineHistory,
                engine: {
                  ...s.engine,
                  expansion: {
                    ...s.engine.expansion,
                    [u.id]: {
                      question: question.id,
                      draft: c.after,
                      reviewed: !u.practiceDraft && c.kind !== "Connect" ? c.after : "",
                      source: u.practiceDraft || c.kind === "Connect" ? "draft" : "curated",
                      examplePractice: example,
                    },
                  },
                },
              }))
            }
          >
            <span lang="ru">{c.label}</span>
            <small>{c.why}</small>
          </button>
        ))}
      </div>
      {!all.length && <div>
        <p>No matched detail yet. Keep this sentence for your paragraph.</p>
        <Button variant="secondary" onClick={() => update((s) => ({ ...s, engine: { ...s.engine,
          expansion: { ...s.engine.expansion, [u.id]: { question: "keep", draft: base, reviewed: "", source: "draft", examplePractice: false } },
        } }))}>Keep this sentence</Button>
      </div>}
      {currentChoice && (
        <Notice success={!u.practiceDraft}>
          <strong>Detail added · </strong>{currentChoice.why}
          {u.practiceDraft && " Your original wording is still a draft."}
        </Notice>
      )}
      {existing?.draft && !currentChoice && (
        <details className="q-review">
          <summary>Earlier addition · preserved</summary>
          <p lang="ru">{existing.draft}</p>
        </details>
      )}
      <div className="q-story-rescue">
        <h2>Story Rescue</h2>
        <p className="q-provenance">
          Reviewed example plan · not your personal experience
        </p>
        <p>
          You went to a museum with your brother, saw an exhibition, then had
          lunch. Restore the order, the relationship and the missing detail.
        </p>
        <ol className="q-story-cards">
          {story.order.map((id, pos) => (
            <li key={id}>
              <span lang="ru">
                {scaffolded
                  ? storyCards[id].text
                  : storyCards[id].text
                      .replace(/^(Сначала|Потом|После этого) /u, "")
                      .replace(/^./u, (c) => c.toLocaleUpperCase("ru"))}
              </span>
              <button
                aria-label={`Move story card ${id + 1} up`}
                disabled={pos === 0}
                onClick={() => {
                  const order = [...story.order];
                  [order[pos - 1], order[pos]] = [order[pos], order[pos - 1]];
                  storyPatch({ order, checked: false });
                }}
              >
                ↑
              </button>
              <button
                aria-label={`Move story card ${id + 1} down`}
                disabled={pos === 2}
                onClick={() => {
                  const order = [...story.order];
                  [order[pos + 1], order[pos]] = [order[pos], order[pos + 1]];
                  storyPatch({ order, checked: false });
                }}
              >
                ↓
              </button>
            </li>
          ))}
        </ol>
        <label htmlFor="story-connector">
          Which connector introduces lunch after the exhibition?
        </label>
        <select
          id="story-connector"
          value={story.connector}
          onChange={(ev) =>
            storyPatch({ connector: ev.target.value, checked: false })
          }
        >
          <option value="">Choose a relationship</option>
          {["Потому что", "Поэтому", "После этого", "Однако"].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <label htmlFor="story-detail">
          Who was with you? Я ходила в музей…
        </label>
        <select
          id="story-detail"
          value={story.detail}
          onChange={(ev) =>
            storyPatch({ detail: ev.target.value, checked: false })
          }
        >
          <option value="">Choose the plan’s missing detail</option>
          <option value="with-brother">с моим братом</option>
          <option value="base-brother">с мой брат</option>
          <option value="with-friend">с моей подругой</option>
        </select>
        <Button
          variant="secondary"
          onClick={() => {
            const verdict = checkStory(
              story.order,
              story.connector,
              story.detail,
            );
            storyPatch({
              checked: verdict.correct,
              attempts: story.attempts + 1,
              message: verdict.message,
            });
            if (verdict.correct) update((s) => reward(s, "story-rescued"));
          }}
        >
          Check story
        </Button>
        {story.message && (
          <Notice success={story.checked}>{story.message}</Notice>
        )}
        <details className="q-review">
          <summary>Story clue</summary>
          <p>
            Use the given plan, not the sentence length. Sequence words describe
            time; потому что gives a cause, поэтому a result, однако a contrast.
          </p>
        </details>
      </div>
      <div className="q-actions">
        <Button disabled={!hasAttempt || !story.checked} onClick={onComplete}>
          Proofread in Grammar Detective →
        </Button>
      </div>
    </section>
  );
}
