import { test } from "node:test";
import assert from "node:assert/strict";
import { challenges, sportsChallenge } from "../src/lib/challenges";
import {
  reviewDetail,
  buildExpansion,
  expansionState,
} from "../src/lib/languages/ru-expansion";
import { initialProgress, restoreProgress } from "../src/lib/progress";
import { checkSentence } from "../src/lib/learning";
test("all four challenge packs contain complete reviewed orders and separate prepositions", () => {
  assert.equal(challenges.length, 4);
  for (const challenge of challenges) {
    const ids = challenge.tiles.map((t) => t.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(new Set(challenge.tileOrder).size, ids.length);
    for (const tile of challenge.tiles)
      assert.equal(tile.text.includes(" "), false);
    for (const order of challenge.acceptableOrders) {
      assert.equal(
        checkSentence(order, ids, challenge.acceptableOrders),
        "accepted",
      );
      for (const [prep, noun] of challenge.links)
        assert.equal(order.indexOf(noun), order.indexOf(prep) + 1);
    }
  }
});
test("screenshot fragments do not earn checks or generate an incorrect combined sentence", () => {
  const values = {
    when: "всегда",
    where: "в центре",
    why: "равится",
    company: "друзья",
  };
  assert.equal(
    reviewDetail(sportsChallenge, "why", values.why).status,
    "repair",
  );
  assert.equal(
    reviewDetail(sportsChallenge, "company", values.company).status,
    "repair",
  );
  assert.equal(expansionState(sportsChallenge, values).reviewed, 2);
  assert.equal(expansionState(sportsChallenge, values).canContinue, false);
  assert.equal(buildExpansion(sportsChallenge, values), null);
});
test("corrected phrases form a natural sentence with an adverb before the verb", () => {
  const values = {
    when: "всегда",
    where: "в центре",
    why: "потому что это весело",
    company: "с друзьями",
  };
  assert.equal(
    buildExpansion(sportsChallenge, values),
    "Я всегда играю в теннис в центре с друзьями, потому что это весело.",
  );
  assert.equal(expansionState(sportsChallenge, values).canContinue, true);
});
test("a time phrase starts a sentence naturally, without stray punctuation", () => {
  assert.equal(
    buildExpansion(sportsChallenge, {
      when: "По субботам.",
      where: "в парке",
      company: "с друзьями",
    }),
    "По субботам я играю в теннис в парке с друзьями.",
  );
});
test("unknown but potentially correct phrases remain drafts rather than false errors or success", () => {
  const values = {
    when: "каждую среду",
    where: "в парке",
    why: "потому что это весело",
    company: "с друзьями",
  };
  assert.equal(
    reviewDetail(sportsChallenge, "when", values.when).status,
    "unreviewed",
  );
  assert.equal(expansionState(sportsChallenge, values).canContinue, false);
  assert.equal(buildExpansion(sportsChallenge, values), null);
});
test("all reviewed options can be composed for each topic", () => {
  for (const challenge of challenges) {
    for (const field of challenge.expansions) {
      for (const option of field.options) {
        const values = Object.fromEntries(
          challenge.expansions.map((e) => [
            e.id,
            e.id === field.id ? option : e.options[0],
          ]),
        );
        assert.equal(expansionState(challenge, values).canContinue, true);
        assert.ok(buildExpansion(challenge, values));
      }
    }
  }
});
test("old five-chunk progress migrates without losing independent writing", () => {
  const legacy: Record<string, unknown> = {
    ...initialProgress,
    tiles: ["who", "action", "what", "company", "time"],
    original: "  Привет!\nМой текст.  ",
    revision: "Моя новая версия.",
  };
  delete legacy.tileFormatVersion;
  const restored = restoreProgress(legacy);
  assert.deepEqual(restored.tiles, [
    "who",
    "action",
    "prep-activity",
    "what",
    "prep-company",
    "company",
    "prep-time",
    "time",
  ]);
  assert.equal(restored.original, legacy.original);
  assert.equal(restored.revision, legacy.revision);
  assert.deepEqual(restoreProgress(restored).tiles, restored.tiles);
});
