import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { demoServices } from "@/lib/ai/demo";
import { openaiServices } from "@/lib/ai/openai";
import { mission } from "@/lib/mission";
import { sameOrigin, allowAiRequest } from "@/lib/ai/request-guard";
import {
  topicIdSchema,
  writingPrompt,
  getTopic,
  feedbackExamples,
} from "@/lib/topics";
import { patterns, supportedCorrections } from "@/lib/corrections";
import { feedbackSchema } from "@/lib/contracts";
import { configured, recordService } from "@/lib/ai/service-status";
export const runtime = "nodejs";
const requestSchema = z.strictObject({
  operation: z.enum([
    "ideas",
    "feedback",
    "sentence",
    "grammar",
    "exercise",
    "transfer",
  ]),
  text: z.string().min(1).max(8000),
  mode: z.enum(["demo", "ai"]),
  topicId: topicIdSchema.default("sports"),
  patternId: z.enum(["with", "after", "because"]).optional(),
});
export function GET() {
  return NextResponse.json(
    {
      audioRetentionHours: Math.min(
        168,
        Math.max(0, Number(process.env.AUDIO_RETENTION_HOURS) || 0),
      ),
      aiAvailable:
        process.env.AI_ENABLED === "true" &&
        Boolean(process.env.OPENAI_API_KEY),
      transcriptionAvailable:
        process.env.AI_ENABLED === "true" &&
        process.env.TRANSCRIPTION_ENABLED === "true" &&
        Boolean(process.env.OPENAI_API_KEY),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers.get("origin"), req.headers.get("host")))
    return NextResponse.json(
      { error: "Request origin not allowed." },
      { status: 403 },
    );
  if (Number(req.headers.get("content-length") ?? 0) > 40000)
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid request. Use 1–8,000 characters." },
      { status: 400 },
    );
  }
  const enabled =
    body.mode === "ai" &&
    process.env.AI_ENABLED === "true" &&
    Boolean(process.env.OPENAI_API_KEY);
  if (body.mode === "ai" && !configured("review"))
    return NextResponse.json(
      {
        error:
          "AI review is not configured. Your answer is saved. Open Services and retry.",
      },
      { status: 503 },
    );
  if (enabled && !allowAiRequest())
    return NextResponse.json(
      {
        error:
          "AI practice limit reached. Switch to Demo Mode or try again later.",
      },
      { status: 429 },
    );
  if (body.operation === "transfer" && !body.patternId)
    return NextResponse.json(
      { error: "Choose a practice pattern." },
      { status: 400 },
    );
  const topic = getTopic(body.topicId);
  const demo: typeof demoServices = {
    ...demoServices,
    async writingFeedback() {
      return {
        source: "demo",
        data: feedbackExamples[body.topicId].feedback,
        notice:
          "Illustrative example only. Your response has not been evaluated.",
      };
    },
    async generateExercise() {
      return {
        source: "demo",
        data: {
          instruction: topic.meaning,
          tiles: topic.tiles,
          acceptableOrders: topic.acceptableOrders,
        },
      };
    },
  };
  const run = (service: typeof demoServices) => {
    switch (body.operation) {
      case "ideas":
        return service.extractIdeas(body.text, mission.language);
      case "feedback":
        return service.writingFeedback(
          body.text,
          writingPrompt(body.topicId),
          mission.language,
        );
      case "sentence":
        return service.validateSentence(
          body.text,
          topic.meaning,
          mission.language,
        );
      case "grammar":
        return service.analyzeGrammar(body.text, mission.language);
      case "exercise":
        return service.generateExercise(body.text, mission.language);
      case "transfer": {
        const pattern = patterns.find((p) => p.id === body.patternId)!;
        return service.validateSentence(
          body.text,
          `This must be a complete natural Russian sentence applying this pattern correctly: ${pattern.title}. ${pattern.explanation} ${pattern.transferPrompt} Judge the actual sentence; do not supply a replacement.`,
          mission.language,
        );
      }
    }
  };
  try {
    const result = await run(enabled ? openaiServices : demo);
    if (result.source === "ai") recordService("review", true);
    const payload =
      body.operation === "feedback"
        ? {
            ...result,
            data: (() => {
              const data = feedbackSchema.parse(result.data);
              return {
                ...data,
                corrections:
                  result.source === "ai"
                    ? supportedCorrections(body.text, data.corrections)
                    : [],
              };
            })(),
            sample:
              result.source === "demo"
                ? feedbackExamples[body.topicId].sample
                : "",
          }
        : result;
    return NextResponse.json(
      body.mode === "ai" && !enabled
        ? {
            ...payload,
            notice: "AI is not configured. Using a labeled demo example.",
          }
        : payload,
    );
  } catch {
    console.warn("ai_request_failed", { operation: body.operation });
    recordService("review", false);
    return NextResponse.json(
      {
        error:
          "AI review failed. Your answer is saved. Retry or choose labeled example practice.",
      },
      { status: 502 },
    );
  }
}
