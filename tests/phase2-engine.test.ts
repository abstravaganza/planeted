import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { missions } from "../src/lib/missions";
import {
  suppliedExample,
  localAnalysis,
  safeUnit,
  mayBuild,
  buildTiles,
  acceptedModelOrder,
  knownMeaning,
} from "../src/lib/learning-engine";
import {
  emptyMission,
  completeStage,
  approveReviewedModels,
  decide,
  approveUnits,
  recoverQuest,
  emptyQuest,
  reward,
  xp,
} from "../src/lib/quest-state";
import {
  grammarLessons,
  checkBubble,
  reviewedGrammarTransfer,
} from "../src/lib/grammar-game";
import { checkStory } from "../src/lib/story-rescue";
import { reviewRussian } from "../src/lib/ai/correction-engine";
import { POST as correct } from "../src/app/api/correct/route";
import { POST as transcribe } from "../src/app/api/transcribe/route";
import { POST as develop } from "../src/app/api/develop/route";
function request(path: string, body: unknown) {
  return new NextRequest("http://localhost:3000" + path, {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
test("supplied tennis input asks clarification and cannot become an answer key", () => {
  const u = localAnalysis(suppliedExample)[0];
  assert.equal(u.original, suppliedExample);
  assert.equal(u.needsClarification, true);
  assert.equal(u.corrected, "");
  assert.equal(u.options.length, 2);
  assert.equal(safeUnit(u), false);
  assert.equal(mayBuild({ ...u, approved: true }), false);
});
test("two confirmed meanings give different reviewed natural Russian; original stays verbatim", () => {
  for (const [meaning, expected] of [
    ["play", "Вчера я играла в теннис с моими друзьями."],
    [
      "lesson",
      "Вчера я ходила на тренировку по теннису, а потом играла с друзьями.",
    ],
  ]) {
    const u = localAnalysis(suppliedExample, meaning)[0];
    assert.equal(u.original, suppliedExample);
    assert.equal(u.corrected, expected);
    assert.equal(safeUnit(u), true);
    assert.equal(mayBuild(u), false);
    assert.equal(mayBuild({ ...u, approved: true }), true);
    assert.ok(u.changes.some((c) => c.before === "с мои друзей"));
  }
});
test("unreviewed originals, edits, low confidence, unresolved issues and mismatched tiles are blocked", () => {
  const good = localAnalysis(suppliedExample, "play")[0];
  for (const bad of [
    { ...good, review: "unreviewed" as const },
    { ...good, confidence: 0.6 },
    { ...good, unresolved: ["case unresolved"] },
    { ...good, tiles: [{ text: "Другой текст", role: "complement" as const }] },
  ])
    assert.equal(safeUnit(bad), false);
  let m = emptyMission();
  m.stage = 1;
  m.approvedTranscript = suppliedExample;
  m.unitsTranscript = suppliedExample;
  m.units = [
    {
      id: "old",
      before: suppliedExample,
      after: suppliedExample,
      explanation: "",
    },
  ];
  m = decide(m, m.units[0], "original");
  assert.equal(approveUnits(m).generation, null);
  m.engine.analysisTranscript = suppliedExample;
  m.engine.units = [{ ...good, approved: false }];
  assert.equal(approveReviewedModels(m).generation, null);
});
test("approved review is sole source of tiles and scaffolding fades without showing Russian answer as idea", () => {
  let m = emptyMission();
  m.stage = 1;
  m.approvedTranscript = suppliedExample;
  m.engine.analysisTranscript = suppliedExample;
  m.engine.units = localAnalysis(suppliedExample, "play").map((u) => ({
    ...u,
    approved: true,
  }));
  m = approveReviewedModels(m);
  assert.equal(
    m.generation!.sentences[0].text,
    "Вчера я играла в теннис с моими друзьями.",
  );
  const u = m.engine.units[0];
  assert.deepEqual(
    buildTiles(u, 1).map((t) => t.text),
    ["Вчера", "я", "играла", "в теннис", "с моими друзьями"],
  );
  assert.deepEqual(
    buildTiles(u, 1).map((t) => t.role),
    ["time", "subject", "verb", "preposition", "preposition"],
  );
  assert.equal(buildTiles(u, 2).length, 8);
  assert.ok(!knownMeaning(u.corrected).includes("Вчера"));
  assert.equal(
    acceptedModelOrder(u, "С моими друзьями я вчера играла в теннис."),
    true,
  );
  assert.equal(acceptedModelOrder(u, suppliedExample), false);
});
test("unknown offline edits stay blocked, including grammatical edits with a different meaning", async () => {
  const result = await reviewRussian(
    suppliedExample,
    false,
    "play",
    "Вчера я ишла в теннис.",
  );
  assert.equal(safeUnit(result.data.units[0]), false);
  const unrelated = await reviewRussian(
    suppliedExample,
    false,
    "play",
    "Я живу в небольшом городе.",
  );
  assert.equal(safeUnit(unrelated.data.units[0]), false);
});
test("v4 migration preserves independent writing, archives and XP but quarantines unreviewed teaching keys", () => {
  const q = emptyQuest();
  q.selected = "sports";
  q.missions.sports.stage = 3;
  q.missions.sports.original = "  Точно так.\n";
  q.missions.sports.revision = "Моя правка.";
  q.missions.sports.ledger = ["stage:2"];
  const old = { ...q, version: 4 };
  const snapshot = JSON.stringify(old);
  const restored = recoverQuest(JSON.parse(snapshot));
  assert.equal(restored.version, 5);
  assert.equal(restored.missions.sports.stage, 1);
  assert.equal(restored.missions.sports.original, "  Точно так.\n");
  assert.equal(restored.missions.sports.revision, "Моя правка.");
  assert.deepEqual(restored.missions.sports.ledger, ["stage:2"]);
  assert.equal(JSON.stringify(old), snapshot);
});
test("instrumental rule teaches masculine, feminine and plural possessive AND noun changes", () => {
  const rows = grammarLessons.with.chart;
  assert.deepEqual(
    rows.map((r) => r.after),
    ["с моим другом", "с моей подругой", "с моими друзьями"],
  );
  assert.equal(checkBubble("with", 0, "fem")?.correct, true);
  assert.equal(checkBubble("with", 0, "masc")?.correct, false);
  assert.equal(checkBubble("with", 1, "plural")?.correct, true);
  assert.equal(checkBubble("with", 2, "both")?.correct, true);
  assert.equal(checkBubble("with", 3, "both")?.correct, true);
  assert.equal(checkBubble("with", 0, "Я гуляю с моей подругой."), null);
  assert.equal(
    reviewedGrammarTransfer("with", "  Я гуляю с моей подругой! "),
    true,
  );
  assert.equal(reviewedGrammarTransfer("with", "любые русские слова"), false);
});
test("all bubble items have one registered correct option; wrong options explain the rule without a completed solution", () => {
  for (const lesson of Object.values(grammarLessons))
    for (const item of lesson.items) {
      assert.equal(item.options.filter((o) => o.correct).length, 1);
      assert.ok(item.hint);
      for (const wrong of item.options.filter((o) => !o.correct))
        assert.ok(wrong.why.length > 15);
    }
});
test("Story Rescue checks temporal meaning, relation and actual missing detail", () => {
  assert.equal(
    checkStory([0, 1, 2], "После этого", "with-brother").correct,
    true,
  );
  assert.equal(
    checkStory([2, 0, 1], "После этого", "with-brother").correct,
    false,
  );
  assert.equal(checkStory([0, 1, 2], "Поэтому", "with-brother").correct, false);
  assert.equal(
    checkStory([0, 1, 2], "После этого", "with-friend").correct,
    false,
  );
});
test("bubble, recall and stage rewards remain once-only", () => {
  let m = emptyMission();
  for (const key of [
    "bubble:with:fem",
    "independent-build:review-0:3",
    "stage:4",
  ])
    m = reward(reward(m, key), key);
  assert.equal(xp(m), 40);
});
test("correction API preserves supplied source, returns clarification, rejects extras and does not invent demo success", async () => {
  const value = await (
    await correct(
      request("/api/correct", { text: suppliedExample, mode: "demo" }),
    )
  ).json();
  assert.equal(value.source, "demo");
  assert.equal(value.data.units[0].needsClarification, true);
  assert.equal(
    (
      await correct(
        request("/api/correct", {
          text: suppliedExample,
          mode: "demo",
          key: "forbidden",
        }),
      )
    ).status,
    400,
  );
  const unknown = await (
    await correct(
      request("/api/correct", {
        text: "Я ишла куда-то неправильно.",
        mode: "demo",
      }),
    )
  ).json();
  assert.equal(unknown.data.units[0].review, "unreviewed");
});
test("expansion API never certifies arbitrary typed Russian in offline mode", async () => {
  const result = await (
    await develop(
      request("/api/develop", {
        mode: "demo",
        original: "Я играю в теннис с подругами.",
        text: "Я играю в теннис всегда друзья нравится.",
        question: "why",
      }),
    )
  ).json();
  assert.equal(result.source, "draft");
  assert.equal(result.accepted, false);
  const valid = await (
    await develop(
      request("/api/develop", {
        mode: "demo",
        original: "Я играю в теннис с подругами.",
        text: "Я играю в теннис с подругами, потому что мне нравится эта игра.",
        question: "why",
      }),
    )
  ).json();
  assert.equal(valid.source, "curated");
  assert.equal(valid.accepted, true);
});
test("real speech route forwards bytes, mime, Russian hint, configured model and parses a real-shaped response (mock provider)", async () => {
  const vars = [
    "AI_ENABLED",
    "TRANSCRIPTION_ENABLED",
    "OPENAI_API_KEY",
    "OPENAI_TRANSCRIPTION_MODEL",
  ] as const;
  const old = Object.fromEntries(vars.map((k) => [k, process.env[k]]));
  const previous = globalThis.fetch;
  let sent = false;
  try {
    process.env.AI_ENABLED = "true";
    process.env.TRANSCRIPTION_ENABLED = "true";
    process.env.OPENAI_API_KEY = "test-only";
    process.env.OPENAI_TRANSCRIPTION_MODEL = "gpt-transcribe";
    globalThis.fetch = (async (url, init) => {
      assert.equal(
        String(url),
        "https://api.openai.com/v1/audio/transcriptions",
      );
      const form = init!.body as FormData;
      assert.equal(form.get("model"), "gpt-transcribe");
      assert.equal(form.get("languages[]"), "ru");
      assert.equal(form.get("language"), null);
      const blob = form.get("file") as File;
      assert.equal(blob.type, "audio/webm");
      assert.equal(await blob.text(), "test-audio-bytes");
      sent = true;
      return Response.json({ text: "  Вчера я играла в теннис.\n" });
    }) as typeof fetch;
    const form = new FormData();
    form.append(
      "audio",
      new Blob(["test-audio-bytes"], { type: "audio/webm" }),
      "capture.webm",
    );
    const req = new NextRequest("http://localhost:3000/api/transcribe", {
      method: "POST",
      headers: { host: "localhost:3000", origin: "http://localhost:3000" },
      body: form,
    });
    const response = await transcribe(req);
    const data = await response.json();
    assert.equal(sent, true);
    assert.equal(response.status, 200);
    assert.equal(data.source, "ai");
    assert.equal(data.locale, "ru-RU");
    assert.equal(data.data.text, "  Вчера я играла в теннис.\n");
  } finally {
    globalThis.fetch = previous;
    for (const key of vars) {
      if (old[key] === undefined) delete process.env[key];
      else process.env[key] = old[key];
    }
  }
});
test("AI correction requires a separate grammar verdict and never pre-approves student meaning", async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  let accept = false;
  const original = "Вчера я гуляла с мой подругой.";
  const model = "Вчера я гуляла с моей подругой.";
  try {
    globalThis.fetch = (async () => {
      calls++;
      const data =
        calls % 2 === 1
          ? {
              units: [
                {
                  id: "u",
                  original,
                  intendedMeaning: "Yesterday I walked with my female friend.",
                  corrected: model,
                  changes: [
                    {
                      before: "мой",
                      after: "моей",
                      explanation: "Use feminine instrumental after с.",
                    },
                  ],
                  confidence: 0.97,
                  needsClarification: false,
                  question: "",
                  options: [],
                  unresolved: [],
                  tiles: [
                    { text: "Вчера", role: "time" },
                    { text: "я", role: "subject" },
                    { text: "гуляла", role: "verb" },
                    { text: "с моей подругой", role: "preposition" },
                  ],
                  review: "ai",
                  approved: true,
                  assessment: "correction",
                },
              ],
            }
          : {
              verdicts: [
                {
                  id: "u",
                  accepted: accept,
                  agreementCorrect: accept,
                  meaningPreserved: true,
                  explanation: "Independent check",
                },
              ],
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
    let result = await reviewRussian(original, true);
    assert.equal(calls, 2);
    assert.equal(result.data.units[0].review, "unreviewed");
    assert.equal(mayBuild(result.data.units[0]), false);
    accept = true;
    result = await reviewRussian(original, true);
    assert.equal(calls, 4);
    assert.equal(safeUnit(result.data.units[0]), true);
    assert.equal(result.data.units[0].approved, false);
    assert.equal(mayBuild(result.data.units[0]), false);
  } finally {
    globalThis.fetch = previous;
  }
});
test("audio policy preserves unique originals separately from the latest replay pointer", async () => {
  const { keepRecording, getRecording, forgetRecording } = await import(
    "../src/lib/audio-store"
  );
  await keepRecording("mission", new Blob(["first"]), 0, "mission:first");
  await keepRecording("mission", new Blob(["second"]), 0, "mission:second");
  assert.equal(
    await (await getRecording("mission:first"))!.blob.text(),
    "first",
  );
  assert.equal(await (await getRecording("mission"))!.blob.text(), "second");
  await forgetRecording("mission:first");
  assert.equal(await getRecording("mission:first"), null);
});
test("speech provider authentication failure is actionable and never returns fabricated text", async () => {
  const previous = globalThis.fetch;
  const vars = [
    "AI_ENABLED",
    "TRANSCRIPTION_ENABLED",
    "OPENAI_API_KEY",
  ] as const;
  const old = Object.fromEntries(vars.map((k) => [k, process.env[k]]));
  try {
    process.env.AI_ENABLED = "true";
    process.env.TRANSCRIPTION_ENABLED = "true";
    process.env.OPENAI_API_KEY = "test-secret";
    globalThis.fetch = (async () =>
      new Response("", { status: 401 })) as typeof fetch;
    const form = new FormData();
    form.append(
      "audio",
      new Blob(["test-audio"], { type: "audio/mp4" }),
      "capture.m4a",
    );
    const response = await transcribe(
      new NextRequest("http://localhost:3000/api/transcribe", {
        method: "POST",
        headers: { host: "localhost:3000", origin: "http://localhost:3000" },
        body: form,
      }),
    );
    assert.equal(response.status, 503);
    const data = await response.json();
    assert.match(data.error, /configuration/);
    assert.equal(data.data, undefined);
    assert.ok(!JSON.stringify(data).includes("test-secret"));
  } finally {
    globalThis.fetch = previous;
    for (const key of vars) {
      if (old[key] === undefined) delete process.env[key];
      else process.env[key] = old[key];
    }
  }
});
test("an unchanged reviewed edit validates against the confirmed English meaning; unrelated edits do not", async () => {
  const result = await reviewRussian(
    suppliedExample,
    false,
    "I played tennis with my friends yesterday.",
    "Вчера я играла в теннис с моими друзьями.",
  );
  assert.equal(safeUnit(result.data.units[0]), true);
  assert.equal(result.data.units[0].original, suppliedExample);
  assert.equal(localAnalysis("Я гуляю с моим другом.")[0].question, "");
});
test("skipping grammar advances with review needed and does not earn a mastery/stage reward", () => {
  const m = emptyMission();
  m.stage = 4;
  m.completed = [0, 1, 2, 3];
  m.engine.reviewNeeded = ["with"];
  const finished = completeStageForTest(m);
  assert.equal(finished.stage, 5);
  assert.equal(finished.ledger.includes("stage:4"), false);
  assert.deepEqual(finished.engine.reviewNeeded, ["with"]);
});
function completeStageForTest(m: ReturnType<typeof emptyMission>) {
  return completeStage(m, 4);
}
test("reviewed models have complete authored role chunks, including noun subjects rather than generic details", () => {
  for (const m of missionsForRoleTest())
    for (const sentence of m.sample) {
      const u = localAnalysis(sentence)[0];
      assert.equal(safeUnit(u), true);
      assert.ok(
        u.tiles.every((t) =>
          ["subject", "verb", "preposition", "time", "complement"].includes(
            t.role,
          ),
        ),
      );
      assert.ok(u.tiles.some((t) => t.role === "verb"));
    }
  const town = localAnalysis("В центре есть красивый парк.")[0];
  assert.equal(
    town.tiles.find((t) => t.text === "красивый парк")?.role,
    "subject",
  );
});
function missionsForRoleTest() {
  return missions;
}
test("a rejected edit retains confirmed intent so a corrected retry is not trapped", async () => {
  const bad = await reviewRussian(
    suppliedExample,
    false,
    "I played tennis with my friends yesterday.",
    "Вчера я ишла в теннис.",
  );
  assert.equal(
    bad.data.units[0].intendedMeaning,
    "I played tennis with my friends yesterday.",
  );
  assert.equal(safeUnit(bad.data.units[0]), false);
  const retry = await reviewRussian(
    suppliedExample,
    false,
    bad.data.units[0].intendedMeaning,
    "Вчера я играла в теннис с моими друзьями.",
  );
  assert.equal(safeUnit(retry.data.units[0]), true);
  assert.ok(retry.data.units[0].changes.length > 0);
});
test("a regenerated model resets current guided completion while preserving independent completion and earlier XP", () => {
  let m = emptyMission();
  m.stage = 1;
  m.completed = [0, 1, 2, 3, 4, 5];
  m.original = "  Сохранённый оригинал.\n";
  m.revision = "Отдельная правка.";
  m.ledger = ["stage:2", "stage:5"];
  m.approvedTranscript = suppliedExample;
  m.engine.analysisTranscript = suppliedExample;
  m.engine.units = localAnalysis(suppliedExample, "lesson").map((u) => ({
    ...u,
    approved: true,
  }));
  m = approveReviewedModels(m);
  assert.deepEqual(m.completed, [0, 1, 5]);
  assert.equal(m.original, "  Сохранённый оригинал.\n");
  assert.equal(m.revision, "Отдельная правка.");
  assert.ok(m.ledger.includes("stage:2"));
});
test("AI failure cannot bypass the meaning gate or substitute an offline edited answer", async () => {
  const previous = globalThis.fetch;
  const enabled = process.env.AI_ENABLED,
    key = process.env.OPENAI_API_KEY;
  try {
    process.env.AI_ENABLED = "true";
    process.env.OPENAI_API_KEY = "test-only";
    globalThis.fetch = (async () => {
      throw new Error("mock provider unavailable");
    }) as typeof fetch;
    const value = await (
      await correct(
        request("/api/correct", {
          text: suppliedExample,
          meaning: "play",
          edited: "Я живу в небольшом городе.",
          mode: "ai",
        }),
      )
    ).json();
    assert.equal(value.source, undefined);
    assert.equal(value.data, undefined);
    assert.match(value.error, /AI review could not finish/);
  } finally {
    globalThis.fetch = previous;
    if (enabled === undefined) delete process.env.AI_ENABLED;
    else process.env.AI_ENABLED = enabled;
    if (key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
  }
});
