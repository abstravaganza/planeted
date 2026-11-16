import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSentence, award, totalXp, wordCount } from "../src/lib/learning";
import content from "../src/content/ru-sport.json";
import {
  demoIdeas,
  meaningfulDetail,
  normalizeRussian,
} from "../src/lib/languages/ru";
import { progressSchema, initialProgress } from "../src/lib/progress";
import { feedbackSchema } from "../src/lib/contracts";
import { sameOrigin } from "../src/lib/ai/request-guard";
const ids = content.tiles.map((t) => t.id);
test("accepts every curated natural order including a time-first sentence", () => {
  for (const order of content.acceptableOrders)
    assert.equal(
      checkSentence(order, ids, content.acceptableOrders),
      "accepted",
    );
});
test("incomplete sentences and duplicated tiles cannot pass", () => {
  assert.equal(
    checkSentence(ids.slice(1), ids, content.acceptableOrders),
    "incomplete",
  );
  assert.equal(
    checkSentence(
      ["who", "who", "what", "company", "time"],
      ids,
      content.acceptableOrders,
    ),
    "incomplete",
  );
  assert.equal(
    checkSentence(
      ["who", "action", "what", "company", "unknown"],
      ids,
      content.acceptableOrders,
    ),
    "incomplete",
  );
});
test("unreviewed word orders are not labeled grammatically incorrect", () => {
  assert.equal(
    checkSentence([...ids].reverse(), ids, content.acceptableOrders),
    "unreviewed",
  );
});
test("milestones award XP once even after replay", () => {
  const first = award([], 2);
  assert.deepEqual(award(first, 2), [2]);
  assert.equal(totalXp([2, 2]), 30);
  assert.equal(totalXp([0, 1, 2, 3, 4, 5, 6, 7]), 210);
});
test("Unicode and punctuation normalization preserve meaningful endings", () => {
  assert.equal(
    normalizeRussian("  Я ИГРАЮ с моей подругой! "),
    normalizeRussian(content.grammar[0].answer),
  );
  assert.notEqual(
    normalizeRussian(content.grammar[0].error),
    normalizeRussian(content.grammar[0].answer),
  );
});
test("details require a Cyrillic phrase but do not claim grammar evaluation", () => {
  assert.equal(meaningfulDetail("123456"), false);
  assert.equal(meaningfulDetail("in the park"), false);
  assert.equal(meaningfulDetail("в парке"), true);
  assert.equal(meaningfulDetail(""), false);
});
test("demo organizer never invents the sample facts for arbitrary input", () => {
  const ideas = demoIdeas("Я плаваю утром.");
  assert.equal(ideas[0].activity, "Я плаваю утром");
  assert.equal(ideas[0].company, "");
  assert.equal(ideas[0].where, "");
});
test("progress retains verbatim original separately from revision", () => {
  const original = "  Привет!\nЯ играю с мой подругой.  ";
  const progress = progressSchema.parse({
    ...initialProgress,
    original,
    revision: "Исправленная версия",
  });
  assert.equal(progress.original, original);
  assert.notEqual(progress.original, progress.revision);
});
test("invalid saved state and invalid feedback are rejected", () => {
  assert.equal(
    progressSchema.safeParse({ ...initialProgress, stage: 99 }).success,
    false,
  );
  assert.equal(
    feedbackSchema.safeParse({
      ...content.demoFeedback,
      nextSteps: ["1", "2", "3"],
    }).success,
    false,
  );
  assert.equal(
    feedbackSchema.safeParse({ ...content.demoFeedback, officialScore: "I-5" })
      .success,
    false,
  );
  assert.equal(feedbackSchema.safeParse(content.demoFeedback).success, true);
});
test("word counter handles whitespace and Cyrillic", () => {
  assert.equal(wordCount("  Я играю\nв теннис.  "), 4);
  assert.equal(wordCount(""), 0);
});
test("origin guard uses the actual host, supports loopback, and rejects foreign origins", () => {
  assert.equal(sameOrigin("http://127.0.0.1:3000", "127.0.0.1:3000"), true);
  assert.equal(
    sameOrigin("https://elsewhere.example", "127.0.0.1:3000"),
    false,
  );
  assert.equal(sameOrigin("malformed", "127.0.0.1:3000"), false);
});
test("sample organizer prepopulates only facts from the labeled sample", () => {
  const ideas = demoIdeas(content.sample);
  assert.equal(ideas.length, 2);
  assert.equal(ideas[0].company, "с подругами");
  assert.equal(ideas[0].where, "");
  assert.equal(ideas[1].when, "");
});
