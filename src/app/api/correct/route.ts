import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sameOrigin, allowAiRequest } from "@/lib/ai/request-guard";
import { reviewRussian } from "@/lib/ai/correction-engine";
import { configured, recordService } from "@/lib/ai/service-status";
import { missionIdSchema, getMission } from "@/lib/missions";
const schema = z.strictObject({
  text: z
    .string()
    .min(1)
    .max(8000)
    .refine((t) => t.trim().length > 0),
  mode: z.enum(["demo", "ai"]),
  missionId: missionIdSchema.optional(),
  meaning: z.string().max(1500).optional(),
  context: z.string().max(8000).optional(),
  edited: z
    .string()
    .min(1)
    .max(1500)
    .refine((t) => t.trim().length > 0)
    .optional(),
});
export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers.get("origin"), req.headers.get("host")))
    return NextResponse.json({ error: "Origin not allowed." }, { status: 403 });
  if (Number(req.headers.get("content-length") ?? 0) > 50000)
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  let body: z.infer<typeof schema>;
  try {
    body = schema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid correction request." },
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
          "AI review is not configured. Open Services for setup, then retry. Your original is saved.",
      },
      { status: 503 },
    );
  if (enabled && !allowAiRequest())
    return NextResponse.json(
      { error: "Review budget reached. Retry later; your original is saved." },
      { status: 429 },
    );
  try {
    const result = await reviewRussian(
      body.text,
      enabled,
      body.meaning,
      body.edited,
      body.missionId
        ? getMission(body.missionId).prompt
        : "Russian sentence practice",
      body.context,
    );
    if (result.source === "ai") recordService("review", true);
    return NextResponse.json(result);
  } catch {
    console.warn("correction_review_failed");
    recordService("review", false);
    return NextResponse.json(
      {
        error:
          "AI review could not finish. Your original and edits are saved. Retry or choose labeled example practice.",
      },
      { status: 502 },
    );
  }
}
