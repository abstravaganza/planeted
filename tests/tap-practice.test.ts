import test from "node:test";
import assert from "node:assert/strict";
import {
  tapItems,
  practiceItems,
  checkTap,
  speechIssues,
  suggestedConcept,
  type TapItem,
} from "../src/lib/tap-grammar";
import { emptyTapSession, type Concept } from "../src/lib/tap-contracts";
import { localAnalysis, type AnalysisUnit } from "../src/lib/learning-engine";
import {
  emptyMission,
  emptyQuest,
  recoverQuest,
  restartChallenge,
  replayTapPractice,
  reward,
  xp,
  failedFeedback,
} from "../src/lib/quest-state";
function correctSelections(item: TapItem) {
  return item.kind === "pairs"
    ? Object.fromEntries(
        item.slots!.map((s, i) => [
          String(i),
          s.options.find((o) => o.correct)!.id,
        ]),
      )
    : { answer: item.options.find((o) => o.correct)!.id };
}
for (const concept of ["with", "after", "because", "time"] as Concept[]) {
  test(`${concept}: every tap task has a checked solution, useful wrong feedback and stable registered IDs`, () => {
    const items = tapItems(concept);
    assert.ok(items.length >= 4);
    assert.equal(new Set(items.map((i) => i.id)).size, items.length);
    for (const item of items) {
      const right = correctSelections(item);
      assert.equal(checkTap(item, right).correct, true);
      assert.equal(checkTap(item, { answer: "invented" }).correct, false);
      if (item.kind === "pairs") {
        for (const [n, slot] of item.slots!.entries()) {
          assert.equal(
            new Set(slot.options.map((o) => o.id)).size,
            slot.options.length,
          );
          const wrong = slot.options.find((o) => !o.correct)!;
          const verdict = checkTap(item, { ...right, [String(n)]: wrong.id });
          assert.equal(verdict.correct, false);
          assert.ok(verdict.message.length > 15);
        }
      } else {
        for (const wrong of item.options.filter((o) => !o.correct)) {
          const verdict = checkTap(item, { answer: wrong.id });
          assert.equal(verdict.correct, false);
          assert.equal(verdict.message, wrong.why);
        }
      }
    }
  });
}
test("all concepts provide genuinely different interaction types and a new round changes the opening task", () => {
  for (const c of ["with", "after", "because", "time"] as Concept[]) {
    const items = tapItems(c);
    assert.deepEqual(
      new Set(items.map((i) => i.kind)),
      new Set(["bubbles", "message", "pairs"]),
    );
    assert.notEqual(tapItems(c, 1)[0].id, items[0].id);
  }
});
test("only supported reviewed transcript changes identify grammar needs; correct or unreviewed speech does not", () => {
  const withIssue = {
    ...localAnalysis(
      "Вчера я ишла в теннис и я играла с мои друзей.",
      "play",
    )[0],
    approved: true,
  };
  assert.ok(speechIssues([withIssue]).some((i) => i.concept === "with"));
  assert.equal(
    speechIssues([{ ...withIssue, review: "unreviewed" }]).length,
    0,
  );
  assert.equal(
    speechIssues([{ ...withIssue, unresolved: ["meaning unclear"] }]).length,
    0,
  );
  assert.equal(
    speechIssues(localAnalysis("Я играю в теннис с подругами.")).length,
    0,
  );
  const time: AnalysisUnit = {
    ...withIssue,
    id: "time",
    original: "Мы обычно играем на суббота.",
    corrected: "Мы обычно играем по субботам.",
    tiles: [{ text: "Мы обычно играем по субботам", role: "complement" }],
    changes: [
      {
        before: "на суббота",
        after: "по субботам",
        explanation: "Recurring Saturdays.",
      },
    ],
    review: "ai",
  };
  const issues = speechIssues([time]);
  assert.equal(issues[0].concept, "time");
  assert.equal(issues[0].context, time.original);
  assert.equal(issues[0].source, "ai");
  assert.equal(
    speechIssues([
      {
        ...time,
        changes: [
          { before: "invented", after: "по субботам", explanation: "x" },
        ],
      },
    ]).length,
    0,
  );
});
test("suggestions prioritize observed struggles and retain later review needs", () => {
  const u = {
    ...localAnalysis(
      "Вчера я ишла в теннис и я играла с мои друзей.",
      "play",
    )[0],
    approved: true,
  };
  assert.equal(suggestedConcept(speechIssues([u]), {}, []), "with");
  assert.equal(
    suggestedConcept(
      speechIssues([u]),
      { time: { ...emptyTapSession(), mistakes: 3 } },
      ["time"],
    ),
    "time",
  );
});
test("reset before submission archives transcript, raw recording identity, unfinished boss draft and revisions exactly", () => {
  let m = emptyMission();
  m.stage = 3;
  m.transcript = "  Живая речь.\n";
  m.approvedTranscript = m.transcript;
  m.draft = "  Неоконченный ответ.\n";
  m.revision = "Старая правка.";
  m.engine.rawTranscripts = [
    { text: "  Raw.\n", recordingId: "audio-original-id", createdAt: 1 },
  ];
  m = reward(m, "tap:with:fem");
  const reset = restartChallenge(m);
  assert.equal(reset.stage, 0);
  assert.equal(reset.attemptNumber, m.attemptNumber + 1);
  assert.equal(reset.original, null);
  assert.equal(reset.transcript, "");
  assert.equal(reset.attemptHistory[0].transcript, m.transcript);
  assert.equal(reset.attemptHistory[0].draft, m.draft);
  assert.equal(reset.attemptHistory[0].revision, m.revision);
  assert.equal(
    reset.engineHistory[0].engine.rawTranscripts[0].recordingId,
    "audio-original-id",
  );
  assert.equal(xp(reset), xp(m));
  assert.equal(m.transcript, "  Живая речь.\n");
});
test("reset after submission preserves originals, feedback and revisions; old feedback cannot land in the new attempt", () => {
  const m = emptyMission();
  m.original = "  Оригинал!\n";
  m.revision = "Правка.\n";
  m.requestId = "old-request";
  m.status = "loading";
  const reset = restartChallenge(m);
  assert.equal(reset.writingHistory[0].original, m.original);
  assert.equal(reset.writingHistory[0].revision, m.revision);
  assert.equal(failedFeedback(reset, "old-request").status, "idle");
  assert.equal(reset.requestId, "");
});
test("replaying practice preserves history, shifts the round, and cannot farm the same item XP", () => {
  let m = emptyMission();
  m.engine.tap.selected = "time";
  m.engine.tap.sessions.time = {
    ...emptyTapSession(),
    done: true,
    completed: ["time-saturday"],
    mistakes: 2,
  };
  m = reward(m, "tap:time:time-saturday");
  const next = replayTapPractice(m);
  assert.equal(next.engine.tap.sessions.time?.round, 1);
  assert.equal(next.engine.tap.sessions.time?.done, false);
  assert.deepEqual(next.engine.tap.sessions.time?.completed, []);
  assert.equal(next.engineHistory[0].engine.tap.sessions.time?.mistakes, 2);
  assert.equal(xp(reward(next, "tap:time:time-saturday")), xp(m));
});
test("old v5 saves gain tap defaults without changing typed originals or previous transfer drafts", () => {
  const saved = emptyQuest();
  saved.missions.friends.original = "  Original exact.\n";
  saved.missions.friends.revision = "Separate revision.";
  const raw = JSON.parse(JSON.stringify(saved));
  for (const m of Object.values(raw.missions) as Record<string, unknown>[]) {
    delete m.attemptHistory;
    delete m.attemptNumber;
    delete (m.engine as Record<string, unknown>).tap;
  }
  const next = recoverQuest(raw);
  assert.equal(next.missions.friends.original, saved.missions.friends.original);
  assert.equal(next.missions.friends.revision, saved.missions.friends.revision);
  assert.equal(next.missions.friends.engine.tap.selected, "with");
  assert.deepEqual(next.missions.friends.attemptHistory, []);
});

test("word-sized AI change spans still link to the supported phrase-level speech pattern", () => {
  const u = {
    ...localAnalysis(
      "Вчера я ишла в теннис и я играла с мои друзей.",
      "play",
    )[0],
    approved: true,
  };
  const reviewed = {
    ...u,
    original: "Я играю с мои друзья.",
    corrected: "Я играю с моими друзьями.",
    tiles: [{ text: "Я играю с моими друзьями", role: "complement" as const }],
    review: "ai" as const,
    changes: [
      { before: "мои", after: "моими", explanation: "Possessive ending." },
      { before: "друзья", after: "друзьями", explanation: "Noun ending." },
    ],
  };
  assert.ok(speechIssues([reviewed]).every((i) => i.concept === "with"));
  assert.equal(speechIssues([reviewed]).length, 2);
  const time = {
    ...reviewed,
    original: "Мы играем на суббота.",
    corrected: "Мы играем по субботам.",
    tiles: [{ text: "Мы играем по субботам", role: "complement" as const }],
    changes: [
      {
        before: "суббота",
        after: "субботам",
        explanation: "Recurring time expression.",
      },
    ],
  };
  assert.equal(speechIssues([time])[0].concept, "time");
});

test("personal practice uses the learner's confirmed correction before fresh curated contexts", () => {
  const u = {
    ...localAnalysis(
      "Вчера я ишла в теннис и я играла с мои друзей.",
      "play",
    )[0],
    approved: true,
  };
  assert.equal(speechIssues([{ ...u, approved: false }]).length, 0);
  assert.equal(speechIssues([{ ...u, id: "example-0" }]).length, 0);
  const issues = speechIssues([u]),
    items = practiceItems("with", 0, issues);
  assert.ok(items[0].id.startsWith("speech:"));
  assert.equal(items[0].kind, "message");
  assert.equal(items[0].prompt.replace("___", issues[0].original), u.original);
  assert.equal(
    items[0].options.find((o) => o.correct)?.label,
    issues[0].corrected,
  );
  assert.ok(items.some((i) => !i.id.startsWith("speech:")));
  assert.equal(checkTap(items[0], { answer: "original" }).correct, false);
  assert.equal(checkTap(items[0], { answer: "repair" }).correct, true);
});

test("recorded clarification is archived separately from the initial raw transcript and student writing", () => {
  const m = emptyMission();
  m.transcript = "Первоначальные слова.";
  m.engine.rawTranscripts = [
    { text: "Raw initial.", recordingId: "first-audio", createdAt: 1 },
  ];
  m.engine.clarificationTranscripts = [
    {
      unitId: "review-0",
      text: "  Я имела в виду другое.\n",
      recordingId: "clarify-audio",
      createdAt: 2,
    },
  ];
  const reset = restartChallenge(m),
    restored = recoverQuest({
      ...emptyQuest(),
      missions: { ...emptyQuest().missions, sports: reset },
    });
  const archived = restored.missions.sports.engineHistory[0].engine;
  assert.equal(archived.rawTranscripts[0].text, "Raw initial.");
  assert.equal(
    archived.clarificationTranscripts[0].recordingId,
    "clarify-audio",
  );
  assert.equal(
    archived.clarificationTranscripts[0].text,
    "  Я имела в виду другое.\n",
  );
  assert.equal(reset.attemptHistory[0].transcript, m.transcript);
});
