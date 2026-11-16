import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/review/route";
import { GET } from "../src/app/api/services/route";
import { POST as correct } from "../src/app/api/correct/route";
import { recordService } from "../src/lib/ai/service-status";
import {
  answerReviewSchema,
  validateAnswerReview,
  unavailableReview,
  reviewAccepted,
  ReviewRequestGate,
  type AnswerReview,
} from "../src/lib/answer-review";
import { emptyQuest, recoverQuest, reward, xp } from "../src/lib/quest-state";
import { localAnalysis, mayBuild } from "../src/lib/learning-engine";
function req(body: unknown, origin = "http://localhost:3000") {
  return new NextRequest("http://localhost:3000/api/review", {
    method: "POST",
    headers: {
      origin,
      host: "localhost:3000",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
function result(
  text: string,
  status: AnswerReview["status"] = "correct",
  patch: Partial<AnswerReview> = {},
): AnswerReview {
  return {
    original: text,
    status,
    source: "ai",
    suggestion: "",
    changes: [],
    question: "",
    taskMet: true,
    explanation: "The instrumental construction is correct.",
    ...patch,
  };
}
const cases = [
  {
    text: "Я люблю играть в теннис с мои друзья.",
    suggestion: "Я люблю играть в теннис с моими друзьями.",
    before: "мои друзья",
    after: "моими друзьями",
    explanation:
      "After с meaning with, both мои → моими and друзья → друзьями take instrumental forms.",
    activity: "builder",
    reference: "Я люблю играть в теннис с моими друзьями.",
  },
  {
    text: "мы обычно играем на суббота.",
    suggestion: "Мы обычно играем по субботам.",
    before: "на суббота",
    after: "по субботам",
    explanation: "For a recurring Saturday activity, use по субботам.",
    activity: "expansion",
    reference: "Мы играем.",
    question: "when",
  },
  {
    text: "Я играю в теннис с подругами на выходные.",
    suggestion: "Я играю в теннис с подругами на выходных.",
    before: "на выходные",
    after: "на выходных",
    explanation:
      "For playing during the weekend use на выходных; на выходные is valid with other meanings, such as going away for the weekend.",
    activity: "expansion",
    reference: "Я играю в теннис с подругами.",
    question: "when",
  },
];
for (const c of cases)
  test(`mocked live review returns a local correction for ${c.before}`, async (t) => {
    const env = { ...process.env };
    process.env.AI_ENABLED = "true";
    process.env.OPENAI_API_KEY = "phase3-test-only";
    let sent: Record<string, unknown> = {};
    t.mock.method(
      globalThis,
      "fetch",
      async (_url: unknown, init?: RequestInit) => {
        sent = JSON.parse(String(init?.body));
        return Response.json({
          status: "completed",
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify(
                    result(c.text, "correction", {
                      suggestion: c.suggestion,
                      changes: [
                        {
                          before: c.before,
                          after: c.after,
                          explanation: c.explanation,
                        },
                      ],
                      explanation: c.explanation,
                    }),
                  ),
                },
              ],
            },
          ],
        });
      },
    );
    try {
      const r = await POST(
        req({
          mode: "ai",
          missionId: "sports",
          activity: c.activity,
          text: c.text,
          reference: c.reference,
          question: c.question ?? "",
        }),
      );
      assert.equal(r.status, 200);
      const reviewed = validateAnswerReview(await r.json(), c.text);
      assert.equal(reviewed.status, "correction");
      assert.equal(reviewed.source, "ai");
      assert.equal(reviewAccepted(reviewed), false);
      assert.equal(reviewed.original, c.text);
      assert.equal(reviewed.suggestion, c.suggestion);
      const input = JSON.parse(String(sent.input));
      assert.equal(input.text, c.text);
      assert.equal(input.reference, c.reference);
      assert.ok(input.prompt.includes("Russian") || input.prompt.length > 20);
      assert.equal(sent.store, false);
      assert.equal(
        (sent.text as { format: { strict: boolean } }).format.strict,
        true,
      );
    } finally {
      process.env = env;
    }
  });
test("mocked AI accepts a valid new transfer without inventing tennis or a missing detail", async (t) => {
  const env = { ...process.env };
  process.env.AI_ENABLED = "true";
  process.env.OPENAI_API_KEY = "phase3-transfer";
  const text = "  Я играю с моей подругой.\n";
  let input = "";
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, init?: RequestInit) => {
      input = String(init?.body);
      return Response.json({
        status: "completed",
        output: [
          {
            type: "message",
            content: [
              { type: "output_text", text: JSON.stringify(result(text)) },
            ],
          },
        ],
      });
    },
  );
  try {
    const response = await POST(
      req({
        mode: "ai",
        missionId: "friends",
        activity: "transfer",
        patternId: "with",
        text,
      }),
    );
    const r = validateAnswerReview(await response.json(), text);
    assert.equal(r.status, "correct");
    assert.equal(reviewAccepted(r), true);
    assert.equal(r.suggestion, "");
    assert.match(input, /с \+ a person/);
  } finally {
    process.env = env;
  }
});
test("optional improvements remain acceptable while corrections and uncertainty do not earn success", () => {
  const text = "Я гуляю часто.";
  const r = result(text, "naturalness", {
    suggestion: "Я часто гуляю.",
    changes: [
      {
        before: "гуляю часто",
        after: "часто гуляю",
        explanation:
          "An optional change in emphasis; both orders are grammatically acceptable.",
      },
    ],
  });
  assert.equal(reviewAccepted(validateAnswerReview(r, text)), true);
  assert.equal(reviewAccepted({ ...r, status: "correction" }), false);
  assert.equal(
    reviewAccepted({
      ...r,
      status: "clarify",
      question: "Do you mean yesterday or usually?",
    }),
    false,
  );
  assert.equal(reviewAccepted({ ...r, taskMet: false }), false);
});
test("strict verdicts reject fabricated evidence, rewritten originals and incompatible status fields", () => {
  const text = "Я играю.";
  for (const bad of [
    { ...result(text), original: "A different answer" },
    { ...result(text), extra: "unknown" },
    { ...result(text), suggestion: "Я гуляю." },
    { ...result(text), status: "clarify" },
    {
      ...result(text),
      status: "correction",
      suggestion: "Я гуляю.",
      changes: [{ before: "invented", after: "гуляю", explanation: "x" }],
    },
  ])
    assert.throws(() => validateAnswerReview(bad, text));
  assert.equal(
    answerReviewSchema.safeParse({ status: "correct" }).success,
    false,
  );
});
test("service failure preserves exact input, returns Retry contract and never silently substitutes demo", async (t) => {
  const env = { ...process.env };
  process.env.AI_ENABLED = "true";
  process.env.OPENAI_API_KEY = "phase3-failure";
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("private diagnostic", { status: 401 }),
  );
  const text = "  Мои слова.\n";
  try {
    const r = await POST(
      req({
        mode: "ai",
        missionId: "sports",
        activity: "builder",
        reference: "Мои слова.",
        text,
      }),
    );
    assert.equal(r.status, 502);
    const value = validateAnswerReview(await r.json(), text);
    assert.equal(value.status, "unavailable");
    assert.equal(value.source, "none");
    assert.equal(reviewAccepted(value), false);
    assert.match(value.explanation, /Retry/);
    assert.ok(!JSON.stringify(value).includes("private diagnostic"));
    assert.equal((await GET().json()).services.review.verifiedAt, null);
  } finally {
    process.env = env;
  }
});
test("missing configuration and explicit Demo are distinguishable and do not invent clarification", async () => {
  const env = { ...process.env };
  delete process.env.OPENAI_API_KEY;
  process.env.AI_ENABLED = "false";
  try {
    const body = {
      mode: "ai",
      missionId: "friends",
      activity: "transfer",
      patternId: "with",
      text: "Я играю с моей подругой.",
    };
    assert.equal((await POST(req(body))).status, 503);
    const draft = await (await POST(req({ ...body, mode: "demo" }))).json();
    assert.equal(draft.status, "unavailable");
    assert.equal(draft.question, "");
    assert.equal(draft.original, body.text);
    const offline = localAnalysis(body.text)[0];
    assert.equal(offline.needsClarification, false);
    assert.equal(mayBuild(offline), false);
    const r = await correct(req({ mode: "ai", text: body.text }));
    assert.equal(r.status, 503);
    assert.equal((await r.json()).data, undefined);
  } finally {
    process.env = env;
  }
});
test("malformed provider JSON is a service failure, not an incorrect student answer", async (t) => {
  const env = { ...process.env };
  process.env.AI_ENABLED = "true";
  process.env.OPENAI_API_KEY = "phase3-malformed";
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      status: "completed",
      output: [
        {
          type: "message",
          content: [{ type: "output_text", text: '{"status":"correct"}' }],
        },
      ],
    }),
  );
  try {
    const r = await POST(
      req({
        mode: "ai",
        missionId: "sports",
        activity: "builder",
        text: "Я играю.",
      }),
    );
    assert.equal(r.status, 502);
    assert.equal((await r.json()).status, "unavailable");
  } finally {
    process.env = env;
  }
});
test("request identity rejects stale results including an A→B→A edit; retry has a fresh identity", () => {
  const gate = new ReviewRequestGate();
  const old = gate.begin();
  gate.invalidate();
  gate.invalidate();
  assert.equal(gate.current(old), false);
  const retry = gate.begin();
  assert.equal(gate.current(retry), true);
  assert.equal(gate.current(old), false);
  gate.invalidate();
  assert.equal(gate.current(retry), false);
});
test("new optional review fields preserve v5 originals, revisions and one-time XP", () => {
  const saved = emptyQuest(),
    m = saved.missions.sports;
  m.original = "  Оригинал!\n";
  m.revision = "Моя правка.\n";
  m.engine.expansion.u = {
    question: "when",
    draft: "Мой черновик.",
    reviewed: "",
    source: "draft",
    answerReview: unavailableReview("Мой черновик."),
  };
  m.engine.grammar.with = {
    taught: true,
    example: 0,
    index: 0,
    answers: [],
    attempts: 0,
    message: "",
    hint: false,
    done: true,
    skipped: false,
    transfer: "Мой ответ.",
    transferReview: "draft",
    transferAccepted: false,
    supportUsed: true,
  };
  const restored = recoverQuest(JSON.parse(JSON.stringify(saved)));
  assert.equal(restored.missions.sports.original, m.original);
  assert.equal(restored.missions.sports.revision, m.revision);
  assert.equal(
    restored.missions.sports.engine.expansion.u.answerReview?.status,
    "unavailable",
  );
  const once = reward(m, "understood:with");
  assert.equal(xp(reward(once, "understood:with")), xp(once));
});
test("service diagnostics separate configured, verified and failed without exposing secrets", async () => {
  const env = { ...process.env };
  process.env.AI_ENABLED = "true";
  process.env.TRANSCRIPTION_ENABLED = "true";
  process.env.OPENAI_API_KEY = "status-secret-not-output";
  try {
    let r = await GET().json();
    assert.equal(r.services.review.configured, true);
    assert.equal(r.services.review.verifiedAt, null);
    recordService("review", true);
    r = await GET().json();
    assert.equal(typeof r.services.review.verifiedAt, "number");
    assert.equal(r.services.transcription.verifiedAt, null);
    recordService("review", false);
    r = await GET().json();
    assert.equal(typeof r.services.review.failedAt, "number");
    assert.ok(!JSON.stringify(r).includes("status-secret"));
    process.env.OPENAI_API_KEY = "different-key";
    assert.equal((await GET().json()).services.review.verifiedAt, null);
  } finally {
    process.env = env;
  }
});
test("review API rejects unsupported tasks, missing pattern and foreign origin", async () => {
  const body = {
    mode: "demo",
    missionId: "friends",
    activity: "transfer",
    text: "Я гуляю.",
  };
  assert.equal((await POST(req(body))).status, 400);
  assert.equal((await POST(req({ ...body, activity: "unknown" }))).status, 400);
  assert.equal(
    (await POST(req({ ...body, patternId: "with" }, "https://foreign.example")))
      .status,
    403,
  );
});

test("initial AI review does not short-circuit a known offline model and requires an independent check", async (t) => {
  const env = { ...process.env };
  process.env.AI_ENABLED = "true";
  process.env.OPENAI_API_KEY = "phase3-initial";
  const text = "Я играю в теннис с подругами.";
  const candidate = {
    ...localAnalysis(text)[0],
    assessment: "correct",
    review: "unreviewed",
    approved: false,
  };
  let count = 0;
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: unknown, init?: RequestInit) => {
      count++;
      const body = JSON.parse(String(init?.body));
      const input = JSON.parse(body.input);
      if (count === 1) {
        assert.equal(input.original, text);
        assert.ok(input.prompt.length > 20);
      }
      const value =
        count === 1
          ? { units: [candidate] }
          : {
              verdicts: [
                {
                  id: candidate.id,
                  accepted: true,
                  agreementCorrect: true,
                  meaningPreserved: true,
                  explanation: "Independent check passed.",
                },
              ],
            };
      return Response.json({
        status: "completed",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: JSON.stringify(value) }],
          },
        ],
      });
    },
  );
  try {
    const response = await correct(
      req({ mode: "ai", missionId: "sports", text }),
    );
    const r = await response.json();
    assert.equal(response.status, 200);
    assert.equal(count, 2);
    assert.equal(r.source, "ai");
    assert.equal(r.data.units[0].review, "ai");
    assert.equal(r.data.units[0].approved, false);
    assert.equal(r.data.units[0].original, text);
  } finally {
    process.env = env;
  }
});

test("new transcript analysis clears reused-ID drafts without mutating the archived engine", async () => {
  const { emptyEngine, replaceAnalysis } = await import(
    "../src/lib/learning-engine"
  );
  const old = emptyEngine();
  old.analysisTranscript = "Previous wording.";
  old.units = localAnalysis("Я играю в теннис с подругами.");
  old.reviewDrafts[old.units[0].id] = {
    edited: "An earlier edit",
    meaning: "An earlier meaning",
  };
  const next = replaceAnalysis(
    old,
    "New wording.",
    localAnalysis("Я живу в небольшом городе."),
  );
  assert.deepEqual(next.reviewDrafts, {});
  assert.equal(next.analysisTranscript, "New wording.");
  assert.equal(old.reviewDrafts[old.units[0].id].edited, "An earlier edit");
  assert.equal(old.analysisTranscript, "Previous wording.");
});
