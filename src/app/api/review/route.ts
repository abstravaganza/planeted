import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sameOrigin, allowAiRequest } from "@/lib/ai/request-guard";
import { configured, recordService } from "@/lib/ai/service-status";
import { reviewAnswer } from "@/lib/ai/answer-review";
import { unavailableReview } from "@/lib/answer-review";
import { missionIdSchema } from "@/lib/missions";
import { grammarLessons } from "@/lib/grammar-game";
const schema = z.strictObject({
  text: z
    .string()
    .min(1)
    .max(1500)
    .refine((t) => Boolean(t.trim())),
  mode: z.enum(["demo", "ai"]),
  missionId: missionIdSchema,
  activity: z.enum(["builder", "expansion", "transfer"]),
  reference: z.string().max(1500).default(""),
  question: z.string().max(200).default(""),
  patternId: z.enum(["with", "after", "because"]).optional(),
});
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers.get("origin"), req.headers.get("host")))
    return NextResponse.json({ error: "Origin not allowed." }, { status: 403 });
  if (Number(req.headers.get("content-length") ?? 0) > 30000)
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (
    !parsed.success ||
    (parsed.data.activity === "transfer" && !parsed.data.patternId)
  )
    return NextResponse.json(
      { error: "Invalid review request." },
      { status: 400 },
    );
  const b = parsed.data;
  if (b.mode === "ai" && !configured("review"))
    return NextResponse.json(
      unavailableReview(
        b.text,
        "AI review is not configured. Your answer is saved. Open Services for setup, then retry.",
      ),
      { status: 503 },
    );
  if (b.mode === "ai" && !allowAiRequest())
    return NextResponse.json(
      unavailableReview(
        b.text,
        "Review limit reached. Your answer is saved; retry later.",
      ),
      { status: 429 },
    );
  try {
    const r = await reviewAnswer(
      b.text,
      {
        activity: b.activity,
        reference: b.reference,
        question: b.question,
        prompt:
          b.activity === "transfer"
            ? grammarLessons[b.patternId!].transfer
            : b.activity === "builder"
              ? "Rebuild one Russian sentence with the same meaning as the reference. A single complete sentence meets this task; do not assess a full mission response."
              : "Expand the single reference sentence with a relevant detail answering the selected question. Do not require a full mission response.",
        patternId: b.patternId,
      },
      b.mode === "ai",
    );
    if (r.source === "ai") recordService("review", true);
    return NextResponse.json(r);
  } catch {
    recordService("review", false);
    return NextResponse.json(unavailableReview(b.text), { status: 502 });
  }
}
