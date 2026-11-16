import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sameOrigin, allowAiRequest } from "@/lib/ai/request-guard";
import { getMission, missionIdSchema } from "@/lib/missions";
import {
  aiQuestProvider,
  localQuestProvider,
  type QuestProvider,
} from "@/lib/ai/quest-provider";
import { configured, recordService } from "@/lib/ai/service-status";
export const runtime = "nodejs";
const bodySchema = z.strictObject({
  missionId: missionIdSchema,
  operation: z.enum(["shape", "sentence", "feedback"]),
  mode: z.enum(["demo", "ai"]),
  text: z.string().min(1).max(8000),
  reference: z.string().max(1500).optional(),
  practiceEvidence: z
    .strictObject({
      guidedMode: z.enum(["tap", "typed"]).optional(),
      hintCount: z.number().nonnegative(),
      recallCompleted: z.number().nonnegative(),
      skippedPatterns: z.array(z.string()).max(3),
    })
    .optional(),
});
export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers.get("origin"), req.headers.get("host")))
    return NextResponse.json(
      { error: "Request origin not allowed." },
      { status: 403 },
    );
  if (Number(req.headers.get("content-length") ?? 0) > 50000)
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid practice request." },
      { status: 400 },
    );
  }
  const mission = getMission(body.missionId);
  const enabled =
    body.mode === "ai" &&
    process.env.AI_ENABLED === "true" &&
    Boolean(process.env.OPENAI_API_KEY);
  if (body.mode === "ai" && !configured("review"))
    return NextResponse.json(
      {
        error:
          "AI review is not configured. Your writing is saved. Open Services and retry.",
      },
      { status: 503 },
    );
  if (enabled && !allowAiRequest())
    return NextResponse.json(
      { error: "Practice limit reached. Try Demo Mode or retry later." },
      { status: 429 },
    );
  function run(provider: QuestProvider) {
    if (body.operation === "shape") return provider.shape(body.text, mission);
    if (body.operation === "sentence")
      return provider.validate(
        body.text,
        body.reference ?? "",
        mission.language,
      );
    return provider.feedback(body.text, mission, body.practiceEvidence);
  }
  try {
    const result = await run(enabled ? aiQuestProvider : localQuestProvider);
    if (result.source === "ai") recordService("review", true);
    return NextResponse.json(result);
  } catch {
    console.warn("quest_request_failed", { operation: body.operation });
    recordService("review", false);
    return NextResponse.json(
      {
        error:
          "AI feedback could not finish. Your writing is saved. Retry, or explicitly choose Demo mode for sample feedback.",
      },
      { status: 502 },
    );
  }
}
