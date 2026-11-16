import { test } from "node:test";
import assert from "node:assert/strict";
import { initialProgress } from "../src/lib/progress";
import {
  emptyWorkspace,
  emptyTopic,
  migrateWorkspace,
  recoverWorkspace,
  workspaceSchema,
  canNavigate,
  navigateTopic,
  beginFeedback,
  receiveFeedback,
  failFeedback,
  finishStage,
  nextAttempt,
  savePractice,
  topicXp,
} from "../src/lib/workspace";
import { feedbackExamples, writingPrompt, getSteps } from "../src/lib/topics";
import {
  patterns,
  emptyPractice,
  checkPracticeItem,
  completePractice,
  reviewedTransfer,
  supportedCorrections,
  changedParts,
} from "../src/lib/corrections";

test("migration preserves sports originals, revisions, exact whitespace, and old tile order", () => {
  const original = "  Привет!\nМоя первая версия.  ";
  const source: Record<string, unknown> = {
    ...initialProgress,
    stage: 7,
    completed: [0, 1, 2, 3, 4, 5, 6, 7],
    original,
    revision: "Моя правка",
    tiles: ["who", "action", "what", "company", "time"],
  };
  delete source.tileFormatVersion;
  const untouched = JSON.stringify(source);
  const state = migrateWorkspace(source, null);
  assert.equal(state.topics.sports.progress.original, original);
  assert.equal(state.topics.sports.progress.revision, "Моя правка");
  assert.equal(state.topics.sports.progress.tiles.length, 8);
  assert.equal(JSON.stringify(source), untouched);
});
test("migration keeps every shorter pack and archived original separately", () => {
  const source = {
    food: {
      notes: "еда",
      tiles: [],
      expansions: {},
      writing: "  суп\n",
      original: "  суп\n",
      previousOriginals: ["старый суп"],
      completed: [0, 1, 2, 3],
      step: 3,
    },
    music: {
      notes: "музыка",
      tiles: [],
      expansions: {},
      writing: "песня",
      original: null,
      completed: [0],
      step: 1,
    },
  };
  const state = migrateWorkspace(null, source);
  assert.equal(state.topics.food.progress.original, "  суп\n");
  assert.equal(state.topics.food.progress.revision, "  суп\n");
  assert.equal(state.topics.food.progress.stage, 4);
  assert.equal(state.topics.food.archives[0].original, "старый суп");
  assert.equal(state.topics.music.progress.notes, "музыка");
  assert.equal(state.topics.music.progress.stage, 1);
});
test("reloading restores selected topic and step and recovers interrupted requests without inventing feedback", () => {
  const state = emptyWorkspace();
  state.selectedTopic = "music";
  state.topics.music = {
    ...beginFeedback(
      "music",
      {
        ...emptyTopic(),
        progress: { ...initialProgress, draft: "  музыка  " },
      },
      "pending",
    ),
    status: "loading",
  };
  state.topics.music.activePattern = "after";
  const restored = recoverWorkspace(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.selectedTopic, "music");
  assert.equal(restored.topics.music.activePattern, "after");
  assert.equal(restored.topics.music.progress.stage, 4);
  assert.equal(restored.topics.music.status, "interrupted");
  assert.equal(restored.topics.music.progress.original, "  музыка  ");
  assert.equal(restored.topics.music.progress.feedback, null);
});
test("short topic navigation follows its own progress and cannot skip to feedback without an original", () => {
  let topic = emptyTopic();
  assert.equal(canNavigate("food", topic, 1), false);
  topic = finishStage("food", topic);
  assert.equal(topic.progress.stage, 1);
  assert.equal(canNavigate("food", topic, 1), true);
  assert.equal(canNavigate("food", topic, 4), false);
  assert.equal(navigateTopic("food", topic, 7), topic);
  assert.equal(getSteps("sports").length, 8);
  assert.equal(getSteps("food").length, 5);
});
test("feedback is reachable after submission even while loading or after a failed request", () => {
  const topic = beginFeedback(
    "food",
    { ...emptyTopic(), progress: { ...initialProgress, draft: "мой текст" } },
    "request",
  );
  assert.equal(topic.progress.original, "мой текст");
  assert.equal(canNavigate("food", topic, 4), true);
  const failed = failFeedback(topic, "request");
  assert.equal(canNavigate("food", failed, 4), true);
  assert.equal(failed.status, "error");
  assert.equal(failed.progress.feedback, null);
});
test("feedback retries preserve the first original and an independently edited revision", () => {
  const saved = beginFeedback(
    "food",
    { ...emptyTopic(), progress: { ...initialProgress, draft: "  первая\n" } },
    "first",
  );
  const changed = {
    ...failFeedback(saved, "first"),
    progress: {
      ...saved.progress,
      draft: "не заменять",
      revision: "моя правка",
    },
  };
  const retry = beginFeedback("food", changed, "retry");
  assert.equal(retry.progress.original, "  первая\n");
  assert.equal(retry.progress.revision, "моя правка");
  const complete = receiveFeedback(
    "food",
    retry,
    "retry",
    { source: "demo", data: feedbackExamples.food.feedback },
    feedbackExamples.food.sample,
  );
  assert.equal(complete.progress.revision, "моя правка");
  assert.equal(complete.progress.feedbackSource, "demo");
  assert.ok(complete.progress.completed.includes(4));
});
test("late or duplicate feedback cannot replace the latest request or new attempt", () => {
  const first = beginFeedback(
    "music",
    { ...emptyTopic(), progress: { ...initialProgress, draft: "первая" } },
    "old",
  );
  const retry = beginFeedback("music", failFeedback(first, "old"), "new");
  assert.equal(
    receiveFeedback(
      "music",
      retry,
      "old",
      { source: "demo", data: feedbackExamples.music.feedback },
      "",
    ),
    retry,
  );
  const done = receiveFeedback(
    "music",
    retry,
    "new",
    { source: "demo", data: feedbackExamples.music.feedback },
    "sample",
  );
  assert.equal(
    receiveFeedback(
      "music",
      done,
      "new",
      { source: "demo", data: feedbackExamples.food.feedback },
      "",
    ),
    done,
  );
  const fresh = nextAttempt(done);
  assert.equal(
    receiveFeedback(
      "music",
      fresh,
      "new",
      { source: "demo", data: feedbackExamples.music.feedback },
      "",
    ),
    fresh,
  );
  assert.equal(fresh.archives[0].original, "первая");
});
test("practice mistakes permit retries, reveal state persists, and arbitrary text never passes", () => {
  const pattern = patterns[0];
  let state = { ...structuredClone(emptyPractice), answers: ["мой", "моей"] };
  state = checkPracticeItem(pattern, state, 0);
  assert.equal(state.checked[0], false);
  state = { ...state, answers: ["моим", "моей"], revealed: [true, false] };
  state = checkPracticeItem(pattern, state, 0);
  state = checkPracticeItem(pattern, state, 1);
  assert.deepEqual(state.checked, [true, true]);
  assert.equal(state.attempts[0], 2);
  assert.equal(state.revealed[0], true);
  assert.equal(reviewedTransfer(pattern, "случайный русский текст"), false);
  assert.equal(completePractice(state).completed, false);
});
test("transfer must match the reviewed text before completion; stale reviews cannot complete an edited sentence", () => {
  const pattern = patterns[0];
  const text = pattern.reviewedTransfers[0];
  const state = {
    ...structuredClone(emptyPractice),
    checked: [true, true],
    transfer: text,
    reviewedText: text,
    provenance: "reviewed" as const,
    accepted: true,
  };
  assert.equal(completePractice(state).completed, true);
  assert.equal(
    completePractice({ ...state, transfer: "другой текст" }).completed,
    false,
  );
});
test("all six retrieval items have checked answers, including because and genitive forms", () => {
  for (const pattern of patterns) {
    for (let i = 0; i < 2; i++) {
      let state = structuredClone(emptyPractice);
      state.answers[i] = pattern.items[i].answers[0];
      state = checkPracticeItem(pattern, state, i);
      assert.equal(state.checked[i], true);
    }
  }
});
test("completion XP is once per pattern through retries, reloads, and a new attempt", () => {
  const completed = { ...structuredClone(emptyPractice), completed: true };
  let topic = savePractice(emptyTopic(), "with", completed);
  assert.equal(topicXp("food", topic), 20);
  topic = savePractice(topic, "with", completed);
  assert.equal(topicXp("food", topic), 20);
  topic = {
    ...topic,
    progress: { ...topic.progress, original: "text", revision: "revision" },
  };
  topic = nextAttempt(topic);
  assert.equal(topic.archives[0].revision, "revision");
  assert.equal(topicXp("food", topic), 20);
  topic = savePractice(topic, "with", completed);
  assert.equal(topicXp("food", topic), 20);
});
test("AI correction links require an exact excerpt and a supported minimal edit", () => {
  const text = "Я играю с мой подругой после школа.";
  const accepted = supportedCorrections(text, [
    {
      patternId: "with",
      original: "с мой подругой",
      corrected: "с моей подругой",
    },
    { patternId: "after", original: "после школа", corrected: "после школы" },
  ]);
  assert.equal(accepted.length, 2);
  assert.equal(
    supportedCorrections(text, [
      {
        patternId: "with",
        original: "с мой братом",
        corrected: "с моим братом",
      },
    ]).length,
    0,
  );
  assert.equal(
    supportedCorrections(text, [
      {
        patternId: "with",
        original: "с мой подругой",
        corrected: "с моим другом",
      },
    ]).length,
    0,
  );
  assert.equal(
    supportedCorrections(text, [
      {
        patternId: "because",
        original: "школа",
        corrected: "потому что интересно",
      },
    ]).length,
    0,
  );
});
test("topic prompts differ and invalid topic stage data is rejected", () => {
  assert.notEqual(writingPrompt("food"), writingPrompt("sports"));
  const state = emptyWorkspace();
  state.topics.food.progress.stage = 7;
  assert.equal(workspaceSchema.safeParse(state).success, false);
});
test("correction highlighting preserves text and isolates the changed ending", () => {
  const parts = changedParts("с мой подругой", "с моей подругой");
  assert.equal(parts.before.join(""), "с мой подругой");
  assert.equal(parts.after.join(""), "с моей подругой");
  assert.notEqual(parts.before[1], parts.after[1]);
  assert.equal(parts.before[1], "мой");
  assert.equal(parts.after[1], "моей");
});
