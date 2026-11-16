import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sameOrigin, allowAiRequest } from "@/lib/ai/request-guard";
import { reviewAnswer } from "@/lib/ai/answer-review";
import { reviewAccepted } from "@/lib/answer-review";
import { configured, recordService } from "@/lib/ai/service-status";
import { contextualChoices } from "@/lib/languages/ru-quest";
import { knownReviewed } from "@/lib/learning-engine";
const schema = z.strictObject({
  text: z.string().min(1).max(1500),
  original: z.string().min(1).max(1500),
  question: z.string().max(100),
  mode: z.enum(["demo", "ai"]),
});
export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers.get("origin"), req.headers.get("host")))
    return NextResponse.json({ error: "Origin not allowed." }, { status: 403 });
  let b: z.infer<typeof schema>;
  try {
    b = schema.parse(await req.json());
  } catch {
    return NextResponse.json(
      { error: "Invalid development request." },
      { status: 400 },
    );
  }
  const option =
    knownReviewed(b.original) &&
    contextualChoices(b.original).find(
      (c) => c.after === b.text && c.kind === b.question,
    );
  if (option && b.mode === "demo")
    return NextResponse.json({
      source: "curated",
      accepted: true,
      explanation: option.why,
    });
  const enabled =
    b.mode === "ai" &&
    process.env.AI_ENABLED === "true" &&
    Boolean(process.env.OPENAI_API_KEY);
  if (b.mode === "ai" && !configured("review"))
    return NextResponse.json(
      {
        error:
          "AI review is not configured. Your draft is saved. Open Services and retry.",
      },
      { status: 503 },
    );
  if (!enabled)
    return NextResponse.json({
      source: "draft",
      accepted: false,
      explanation:
        "Saved as an unreviewed draft. Offline mode cannot validate this new addition. You may use a reviewed choice or continue with the draft marked for review.",
    });
  if (!allowAiRequest())
    return NextResponse.json(
      { error: "Review limit reached. Draft saved; retry later." },
      { status: 429 },
    );
  try {
    const review = await reviewAnswer(
      b.text,
      {
        activity: "expansion",
        reference: b.original,
        question: b.question,
        prompt: "Expand the given personal idea with a relevant detail.",
      },
      true,
    );
    recordService("review", true);
    return NextResponse.json({
      source: "ai",
      accepted: reviewAccepted(review),
      explanation: review.explanation,
      review,
    });
  } catch {
    recordService("review", false);
    return NextResponse.json(
      {
        error:
          "AI review could not finish. Your draft is saved. Retry or continue with review pending.",
      },
      { status: 502 },
    );
  }
}
