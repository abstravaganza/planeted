import { z } from "zod";
export const answerStatusSchema = z.enum([
  "correct",
  "naturalness",
  "correction",
  "clarify",
  "unavailable",
]);
export const answerReviewSchema = z.strictObject({
  status: answerStatusSchema,
  source: z.enum(["ai", "curated", "none"]),
  original: z.string().min(1).max(8000),
  suggestion: z.string().max(1500),
  explanation: z.string().min(1).max(1000),
  changes: z
    .array(
      z.strictObject({
        before: z.string().min(1).max(500),
        after: z.string().max(500),
        explanation: z.string().min(1).max(700),
      }),
    )
    .max(8),
  question: z.string().max(700),
  taskMet: z.boolean(),
});
export type AnswerReview = z.infer<typeof answerReviewSchema>;
export const reviewAccepted = (r: AnswerReview) =>
  (r.status === "correct" || r.status === "naturalness") &&
  r.taskMet &&
  r.source !== "none";
export function unavailableReview(
  original: string,
  explanation = "Review could not be completed. Your answer is saved. Retry, or continue with review pending.",
): AnswerReview {
  return {
    status: "unavailable",
    source: "none",
    original,
    suggestion: "",
    explanation,
    changes: [],
    question: "",
    taskMet: false,
  };
}
export function validateAnswerReview(
  value: unknown,
  text: string,
): AnswerReview {
  const r = answerReviewSchema.parse(value);
  if (
    r.original !== text ||
    r.changes.some(
      (c) =>
        !text.includes(c.before) ||
        (c.after && !r.suggestion.includes(c.after)),
    )
  )
    throw new Error("Invalid review source mapping");
  if (r.status === "correct" && (r.suggestion || r.changes.length))
    throw new Error("Correct answer cannot require changes");
  if (
    ["correction", "naturalness"].includes(r.status) &&
    (!r.suggestion || !r.changes.length)
  )
    throw new Error("Missing correction detail");
  if (r.status === "clarify" && !r.question)
    throw new Error("Missing clarification question");
  return r;
}
export const reviewLabels = {
  correct: { icon: "✓", title: "Correct" },
  naturalness: { icon: "≈", title: "Optional improvement" },
  correction: { icon: "↻", title: "Needs a change" },
  clarify: { icon: "?", title: "Clarify your meaning" },
  unavailable: { icon: "!", title: "Review unavailable" },
};
// An edit, question change or new request invalidates an earlier response even after A→B→A edits.
export class ReviewRequestGate {
  private version = 0;
  invalidate() {
    this.version++;
  }
  begin() {
    return ++this.version;
  }
  current(token: number) {
    return token === this.version;
  }
}
