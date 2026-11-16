import { z } from "zod";
import type { TopicId } from "./topics";
export async function learningRequest<T>(
  operation: string,
  text: string,
  mode: "demo" | "ai",
  topicId: TopicId,
  schema: z.ZodType<T>,
) {
  const response = await fetch("/api/learning", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify({ operation, text, mode, topicId }),
  });
  if (!response.ok) throw new Error("Request unavailable");
  return z
    .object({
      source: z.enum(["demo", "ai"]),
      data: schema,
      notice: z.string().optional(),
      sample: z.string().optional(),
    })
    .parse(await response.json());
}

export async function answerRequest(body: unknown) {
  const response = await fetch("/api/review", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(45000),
    body: JSON.stringify(body),
  });
  const value = await response.json();
  const { answerReviewSchema } = await import("./answer-review");
  // Service failures use the same honest unavailable contract, never a demo success.
  return answerReviewSchema.parse(value);
}
