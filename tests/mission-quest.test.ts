import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/quest/route";
import { missions, stages } from "../src/lib/missions";
import {
  emptyMission,
  emptyQuest,
  recoverQuest,
  approveTranscript,
  approveUnits,
  approveReviewedModels,
  decide,
  completeStage,
  available,
  reward,
  xp,
  submitOriginal,
  feedbackArrived,
  failedFeedback,
  questStateSchema,
  replayMission,
} from "../src/lib/quest-state";
import {
  shapeLocally,
  tokens,
  checkOrder,
  contextualChoices,
  demonstratedCorrections,
  shuffleTiles,
  renderedSentence,
  tileRole,
} from "../src/lib/languages/ru-quest";
import { localAnalysis } from "../src/lib/learning-engine";
import { assembledParagraph } from "../src/components/quest-expansion";
test("six distinct mission configs share six stages and full communicative metadata", () => {
  assert.equal(missions.length, 6);
  assert.equal(new Set(missions.map((m) => m.id)).size, 6);
  assert.equal(stages.length, 6);
  for (const m of missions) {
    assert.notEqual(m.prompt, m.bossPrompt);
    assert.equal(m.sample.length, 4);
    assert.equal(m.feedbackObjectives.length, 7);
    assert.ok(m.requiredContent.length >= 4);
  }
});
test("legacy migration snapshots exact raw saves without reassigning topics or changing originals", () => {
  const raw =
    '{"selectedTopic":"food","original":"  Борщ.\\n","revision":"Суп!"}';
  const initial = emptyQuest({ "writing-quest:workspace:v3": raw });
  const recovered = recoverQuest(JSON.parse(JSON.stringify(initial)));
  assert.equal(recovered.legacy["writing-quest:workspace:v3"], raw);
  assert.equal(recovered.selected, null);
  assert.deepEqual(
    Object.keys(recovered.missions),
    missions.map((m) => m.id),
  );
  assert.equal(initial.version, 5);
});
test("every mission can progress, revisit, persist, and build multiple actual approved ideas", () => {
  for (const config of missions) {
    let m = emptyMission();
    assert.equal(available(m, 4), false);
    m.transcript = config.sample.join(" ");
    m = approveTranscript(m);
    m.engine.analysisTranscript = m.approvedTranscript;
    m.engine.units = localAnalysis(m.approvedTranscript).map((u) => ({
      ...u,
      approved: true,
    }));
    m = approveReviewedModels(m);
    assert.equal(m.stage, 2);
    assert.equal(m.generation?.sentences.length, 4);
    for (const s of m.generation!.sentences)
      assert.equal(
        checkOrder(
          s.text,
          tokens(s.text).map((_, i) => i),
        ),
        "accepted",
      );
    m = completeStage(m, 2);
    m = completeStage(m, 3);
    m = completeStage(m, 4);
    assert.equal(m.stage, 5);
    assert.equal(available(m, 1), true);
    const q = emptyQuest();
    q.selected = config.id;
    q.missions[config.id] = m;
    const restored = recoverQuest(JSON.parse(JSON.stringify(q)));
    assert.equal(restored.selected, config.id);
    assert.equal(restored.missions[config.id].stage, 5);
    assert.equal(
      restored.missions[config.id].approvedTranscript,
      config.sample.join(" "),
    );
  }
});
test("shaping never supplies unrelated sample facts and keeps student decisions", () => {
  const text = "Я люблю рисовать. У меня есть кот.";
  let m = emptyMission();
  m.units = shapeLocally(text);
  assert.equal(m.units.length, 2);
  assert.equal(m.units[0].before, "Я люблю рисовать.");
  assert.equal(m.units[0].after, m.units[0].before);
  m = decide(m, m.units[0], "original");
  assert.equal(m.decisions["unit-0"].choice, "original");
  assert.equal(demonstratedCorrections(text).length, 0);
  assert.equal(
    demonstratedCorrections("Я гуляю с мой подругой.")[0].corrected,
    "с моей подругой",
  );
});
test("regeneration archives dependent exercises and retains independent original/revision and XP", () => {
  let m = emptyMission();
  m.stage = 1;
  m.approvedTranscript = "Я играю в теннис с подругами.";
  m.engine.analysisTranscript = m.approvedTranscript;
  m.engine.units = localAnalysis(m.approvedTranscript).map((u) => ({
    ...u,
    approved: true,
  }));
  m = approveReviewedModels(m);
  const old = m.generation;
  m.original = "  Мой ответ.\n";
  m.revision = "Моя правка.";
  m = reward(m, "stage:2");
  m.stage = 1;
  m.approvedTranscript = "Я гуляю с моим другом.";
  m.engine.analysisTranscript = m.approvedTranscript;
  m.engine.units = localAnalysis(m.approvedTranscript).map((u) => ({
    ...u,
    approved: true,
  }));
  m = approveReviewedModels(m);
  assert.deepEqual(m.history[0], old);
  assert.equal(m.original, "  Мой ответ.\n");
  assert.equal(m.revision, "Моя правка.");
  assert.ok(m.ledger.includes("stage:2"));
});
test("prepositions are separate, curated flexible orders accepted; duplicates and unknown orders are not certified", () => {
  const s = "Я играю в теннис с подругами.";
  assert.equal(tokens(s)[2], "в");
  assert.equal(checkOrder(s, [4, 5, 0, 1, 2, 3]), "accepted");
  assert.equal(checkOrder(s, [0, 0, 2, 3, 4, 5]), "incomplete");
  assert.equal(checkOrder(s, [5, 4, 3, 2, 1, 0]), "unreviewed");
});
test("all six missions offer context-sensitive no-typing expansion and connecting does not duplicate a sentence", () => {
  for (const config of missions) {
    const m = emptyMission();
    const sentences = config.sample.map((text, i) => ({
      id: `unit-${i}`,
      text,
      before: text,
      explanation: "",
      choice: "original" as const,
      review: "curated" as const,
      intendedMeaning: "Reviewed fixture",
    }));
    const g = {
      transcript: config.sample.join(" "),
      sentences,
      builds: {},
      expansions: { "unit-0": "addition" },
      paragraph: "",
      shuffleSeed: 0,
    };
    const choices = contextualChoices(
      sentences[0].text,
      sentences[1].text,
      config.id === "weekend",
    );
    assert.ok(choices.some((c) => c.id === "addition"));
    assert.ok(choices.every((c) => c.after !== sentences[0].text));
    m.generation = g;
    const paragraph = assembledParagraph(g, false);
    assert.equal(paragraph.split(sentences[1].text.slice(1)).length - 1, 1);
    assert.ok(paragraph.includes("Кроме того"));
  }
  assert.equal(contextualChoices("Я люблю рисовать.").length, 0);
});
test("stage and exercise XP cannot be farmed by revisit, retry, or reload", () => {
  let m = emptyMission();
  m = completeStage(m, 0);
  m = { ...m, stage: 0 };
  m = completeStage(m, 0);
  m = reward(reward(m, "build:unit-0"), "build:unit-0");
  m = reward(reward(m, "pattern:with"), "pattern:with");
  assert.equal(xp(m), 50);
  assert.equal(xp(JSON.parse(JSON.stringify(m))), 50);
});
test("feedback failure, interruption, retries and late results preserve exact original and separate revision", () => {
  let m = emptyMission();
  m.stage = 5;
  m.draft = "  Я пишу!\n\n";
  m = submitOriginal(m, "first");
  assert.equal(m.original, m.draft);
  assert.equal(m.stage, 6);
  assert.equal(available(m, 6), true);
  m.revision = "Отдельная правка.";
  m = failedFeedback(m, "first");
  m.draft = "Changed draft";
  m = submitOriginal(m, "retry");
  assert.equal(m.original, "  Я пишу!\n\n");
  assert.equal(m.revision, "Отдельная правка.");
  const feedback = {
    summary: "Example",
    dimensions: missions[0].feedbackObjectives.map((name) => ({
      name,
      evidence: "Example evidence",
      next: "Example next",
    })),
    strengths: ["Example"],
    nextSteps: ["Example"],
  };
  assert.equal(
    feedbackArrived(m, "first", feedback, "demo", "sample").status,
    "loading",
  );
  m = feedbackArrived(m, "retry", feedback, "demo", "sample");
  assert.equal(m.feedbackSample, "sample");
  assert.equal(m.original, "  Я пишу!\n\n");
  const state = emptyQuest();
  state.missions.sports = { ...m, status: "loading", requestId: "stale" };
  const restored = recoverQuest(state);
  assert.equal(restored.missions.sports.status, "interrupted");
  assert.equal(restored.missions.sports.timerRunning, false);
});
test("corrupt progress rejected rather than overwriting saved writing", () => {
  const q = emptyQuest();
  assert.equal(questStateSchema.safeParse({ ...q, version: 7 }).success, false);
  assert.equal(
    questStateSchema.safeParse({ ...q, missions: {} }).success,
    false,
  );
});
function req(body: unknown) {
  return new NextRequest("http://localhost:3000/api/quest", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
test("mission API demo organizes actual text and feedback is tied only to its labeled sample", async () => {
  const response = await POST(
    req({
      missionId: "friends",
      operation: "shape",
      mode: "demo",
      text: "Я рисую дома.",
    }),
  );
  const value = await response.json();
  assert.equal(value.source, "demo");
  assert.equal(value.data.units[0].before, "Я рисую дома.");
  const feedback = await (
    await POST(
      req({
        missionId: "town",
        operation: "feedback",
        mode: "demo",
        text: "A private original.",
      }),
    )
  ).json();
  assert.equal(
    feedback.sample,
    missions.find((m) => m.id === "town")!.sample.join(" "),
  );
  assert.ok(feedback.data.summary.includes("not been evaluated"));
  assert.equal(feedback.data.dimensions.length, 7);
  assert.ok(!JSON.stringify(feedback).includes("A private original"));
});
test("mission API rejects unknown missions and fields", async () => {
  assert.equal(
    (
      await POST(
        req({
          missionId: "bad",
          operation: "shape",
          mode: "demo",
          text: "Привет.",
        }),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await POST(
        req({
          missionId: "sports",
          operation: "shape",
          mode: "demo",
          text: "Привет.",
          secret: "bad",
        }),
      )
    ).status,
    400,
  );
});
test("upstream transcript changes cannot build stale suggestions", () => {
  let m = emptyMission();
  m.stage = 1;
  m.approvedTranscript = "Новое предложение.";
  m.units = shapeLocally("Старое предложение.");
  m.unitsTranscript = "Старое предложение.";
  m = decide(m, m.units[0], "original");
  assert.equal(approveUnits(m).generation, null);
});
test("provider requests use the selected fresh prompt; malformed and fabricated shape sources fail explicitly", async () => {
  const previousFetch = globalThis.fetch;
  const previousEnabled = process.env.AI_ENABLED;
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.AI_ENABLED = "true";
  process.env.OPENAI_API_KEY = "test-only";
  let sent: Record<string, unknown> = {};
  try {
    globalThis.fetch = (async (_url, init) => {
      sent = JSON.parse(String(init?.body));
      const data = {
        summary: "Based on submitted text",
        dimensions: missions[2].feedbackObjectives.map((name) => ({
          name,
          evidence: "Actual excerpt",
          next: "Practice this",
        })),
        strengths: ["A relevant detail"],
        nextSteps: ["Add a question"],
      };
      return Response.json({
        status: "completed",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: JSON.stringify(data) }],
          },
        ],
      });
    }) as typeof fetch;
    const result = await (
      await POST(
        req({
          missionId: "town",
          operation: "feedback",
          mode: "ai",
          text: "  Мой город красивый.\n",
        }),
      )
    ).json();
    assert.equal(result.source, "ai");
    const input = JSON.parse(String(sent.input));
    assert.equal(input.text, "  Мой город красивый.\n");
    assert.equal(input.prompt, missions[2].bossPrompt);
    assert.equal(sent.store, false);
    globalThis.fetch = (async () =>
      Response.json({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  units: [
                    {
                      id: "bad",
                      before: "Invented source",
                      after: "Я живу в Москве.",
                      explanation: "Invented",
                    },
                  ],
                }),
              },
            ],
          },
        ],
      })) as typeof fetch;
    const fallback = await (
      await POST(
        req({
          missionId: "town",
          operation: "shape",
          mode: "ai",
          text: "Я люблю мой город.",
        }),
      )
    ).json();
    assert.equal(fallback.source, undefined);
    assert.equal(fallback.data, undefined);
    assert.match(fallback.error, /could not finish/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousEnabled === undefined) delete process.env.AI_ENABLED;
    else process.env.AI_ENABLED = previousEnabled;
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousKey;
  }
});

test("a replay preserves originals, revisions, exercise history and the one-time XP ledger", () => {
  let m = emptyMission();
  m.original = "  Исходный текст.\n";
  m.revision = "Правка.";
  m = reward(m, "stage:0");
  const next = replayMission(m);
  assert.equal(next.stage, 0);
  assert.equal(next.original, null);
  assert.equal(next.writingHistory[0].original, m.original);
  assert.equal(next.writingHistory[0].revision, m.revision);
  assert.equal(xp(reward(next, "stage:0")), xp(m));
});
test("shuffles persist by seed, preserve every tile and vary across generations", () => {
  assert.deepEqual(shuffleTiles(8, 70), shuffleTiles(8, 70));
  assert.deepEqual(
    [...shuffleTiles(8, 70)].sort((a, b) => a - b),
    [0, 1, 2, 3, 4, 5, 6, 7],
  );
  assert.notDeepEqual(shuffleTiles(8, 70), shuffleTiles(8, 903));
});
test("display preserves questions, moved pronouns, names and reviewed grammatical roles", () => {
  assert.equal(
    renderedSentence(["С", "подругами", "Я", "играю"]),
    "С подругами я играю.",
  );
  assert.equal(
    renderedSentence(["Что", "ты", "любишь"], "Что ты любишь?"),
    "Что ты любишь?",
  );
  assert.equal(tileRole("свежем"), "detail");
  assert.equal(tileRole("встречаемся"), "verb");
  assert.ok(
    contextualChoices("Я гуляю.", "Аня любит музыку.")[0].after.includes("Аня"),
  );
});
