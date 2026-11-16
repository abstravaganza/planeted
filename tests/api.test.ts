import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET, POST } from "../src/app/api/learning/route";
import { POST as transcribe } from "../src/app/api/transcribe/route";
import { feedbackExamples, writingPrompt } from "../src/lib/topics";

function request(body: unknown, origin = "http://127.0.0.1:3000") {
  return new NextRequest("http://127.0.0.1:3000/api/learning", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      host: "127.0.0.1:3000",
      origin,
    },
    body: JSON.stringify(body),
  });
}
test("default capabilities reveal no credential values", async () => {
  const enabled = process.env.AI_ENABLED;
  process.env.AI_ENABLED = "false";
  try {
    const data = await GET().json();
    assert.deepEqual(data, {
      aiAvailable: false,
      transcriptionAvailable: false,
      audioRetentionHours: 0,
    });
  } finally {
    if (enabled === undefined) delete process.env.AI_ENABLED;
    else process.env.AI_ENABLED = enabled;
  }
});
test("demo feedback is explicitly attributed and never depends on the student text", async () => {
  const response = await POST(
    request({
      operation: "feedback",
      text: "Привет! Я люблю плавать.",
      mode: "demo",
    }),
  );
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.source, "demo");
  assert.match(data.notice, /not been evaluated/);
  assert.match(data.data.summary, /illustrative/);
});
test("server rejects invalid operations, unknown fields, oversized text, and foreign origins", async () => {
  const valid = { operation: "ideas", text: "Я играю.", mode: "demo" };
  for (const body of [
    { ...valid, operation: "unknown" },
    { ...valid, apiKey: "not-allowed" },
    { ...valid, text: "x".repeat(8001) },
  ])
    assert.equal((await POST(request(body))).status, 400);
  assert.equal(
    (await POST(request(valid, "https://foreign.example"))).status,
    403,
  );
});
test("failed provider request stays retryable without substituting sample feedback", async (t) => {
  const enabled = process.env.AI_ENABLED;
  const key = process.env.OPENAI_API_KEY;
  process.env.AI_ENABLED = "true";
  process.env.OPENAI_API_KEY = "test-only-placeholder";
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("private provider diagnostic", { status: 503 }),
  );
  try {
    const response = await POST(
      request({ operation: "feedback", text: "Мой текст.", mode: "ai" }),
    );
    const data = await response.json();
    assert.equal(response.status, 502);
    assert.equal(data.source, undefined);
    assert.match(data.error, /saved|Retry/);
    assert.equal(
      JSON.stringify(data).includes("private provider diagnostic"),
      false,
    );
  } finally {
    if (enabled === undefined) delete process.env.AI_ENABLED;
    else process.env.AI_ENABLED = enabled;
    if (key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
  }
});
test("transcription disabled by default gives an actionable typed alternative", async () => {
  const enabled = process.env.TRANSCRIPTION_ENABLED;
  process.env.TRANSCRIPTION_ENABLED = "false";
  try {
    const response = await transcribe(request({}));
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /Manual entry|Type your ideas/);
  } finally {
    if (enabled === undefined) delete process.env.TRANSCRIPTION_ENABLED;
    else process.env.TRANSCRIPTION_ENABLED = enabled;
  }
});
test("topic feedback uses the selected server-side prompt and filters unsupported invented corrections", async (t) => {
  const enabled = process.env.AI_ENABLED,
    key = process.env.OPENAI_API_KEY;
  process.env.AI_ENABLED = "true";
  process.env.OPENAI_API_KEY = "test-only";
  let sent = "";
  t.mock.method(
    globalThis,
    "fetch",
    async (_url: string | URL | Request, options?: RequestInit) => {
      sent = String(options?.body);
      return new Response(
        JSON.stringify({
          status: "completed",
          output: [
            {
              type: "message",
              content: [
                {
                  type: "output_text",
                  text: JSON.stringify({
                    ...feedbackExamples.food.feedback,
                    corrections: [
                      {
                        patternId: "with",
                        original: "с мой братом",
                        corrected: "с моим братом",
                      },
                      {
                        patternId: "after",
                        original: "после школа",
                        corrected: "после школы",
                      },
                    ],
                  }),
                },
              ],
            },
          ],
        }),
        { status: 200 },
      );
    },
  );
  try {
    const response = await POST(
      request({
        operation: "feedback",
        topicId: "food",
        text: "Я готовлю с мой братом.",
        mode: "ai",
      }),
    );
    const data = await response.json();
    assert.equal(data.source, "ai");
    assert.equal(data.data.corrections.length, 1);
    assert.equal(data.data.corrections[0].patternId, "with");
    const body = JSON.parse(sent);
    assert.equal(JSON.parse(body.input).prompt, writingPrompt("food"));
    assert.equal(body.store, false);
  } finally {
    if (enabled === undefined) delete process.env.AI_ENABLED;
    else process.env.AI_ENABLED = enabled;
    if (key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
  }
});
test("demo feedback carries its own topic sample and does not map sample mistakes to the student", async () => {
  const response = await POST(
    request({
      operation: "feedback",
      topicId: "music",
      text: "Мой текст.",
      mode: "demo",
    }),
  );
  const data = await response.json();
  assert.equal(data.sample, feedbackExamples.music.sample);
  assert.deepEqual(data.data.corrections, []);
  assert.equal(
    (
      await POST(
        request({
          operation: "transfer",
          topicId: "music",
          text: "Мой текст.",
          mode: "demo",
        }),
      )
    ).status,
    400,
  );
});
