import {
  answerReviewSchema,
  validateAnswerReview,
  unavailableReview,
  type AnswerReview,
} from "../answer-review";
import { structured } from "./openai";
import { reviewedGrammarTransfer, type PatternId } from "../grammar-game";
import { acceptedModelOrder, localAnalysis } from "../learning-engine";
import { contextualChoices } from "../languages/ru-quest";
export type ReviewContext = {
  activity: "builder" | "expansion" | "transfer";
  prompt: string;
  reference: string;
  question: string;
  patternId?: PatternId;
};
export async function reviewAnswer(
  text: string,
  context: ReviewContext,
  enabled: boolean,
): Promise<AnswerReview> {
  if (!enabled) {
    const accepted =
      context.activity === "transfer" && context.patternId
        ? reviewedGrammarTransfer(context.patternId, text)
        : context.activity === "builder"
          ? localAnalysis(context.reference).some((u) =>
              acceptedModelOrder(u, text),
            )
          : context.activity === "expansion" &&
            contextualChoices(context.reference).some(
              (c) => c.after === text && c.kind === context.question,
            );
    return accepted
      ? {
          status: "correct",
          source: "curated",
          original: text,
          suggestion: "",
          changes: [],
          question: "",
          taskMet: true,
          explanation:
            "This answer matches a reviewed example for this task. No AI evaluation was performed.",
        }
      : unavailableReview(
          text,
          "Live review is not enabled. Your answer is saved. Enable AI review and retry, use labeled example practice, or continue with review pending.",
        );
  }
  const result = await structured(
    "answer_review",
    `Evaluate the exact submitted Russian against ONLY this activity and intended meaning. Builder checks ONE sentence: grammar, comprehensibility and fidelity to the reference. A single sentence is sufficient; never request a whole school day, more subjects, sport details or a complete paragraph. Do not ask for details absent from the reference or apply mission-wide prompt completion. Missing full-mission details are not ambiguity or failure in builder/expansion/transfer practice. Full prompt completion is assessed separately in final writing. Distinguish grammar errors from optional style/naturalness. Correct natural answers need no changes. Do not invent a missing sport or personal fact. Accept flexible word order. Expansion must add relevant meaning answering the question without contradicting the reference. Transfer must apply only the requested pattern, not match a reference sentence. Ask clarification only for genuine ambiguity, not merely unfamiliar wording. For errors give a minimal local correction and exact changed spans, with brief English explanations. Use naturalness only for optional improvements to grammatically acceptable text, never for a required case/tense/agreement repair. For recurring Saturdays use по субботам; for an activity during the weekend use на выходных, explaining на выходные can be valid for other meanings. After с meaning with, both possessive and noun take instrumental. Never write a final paragraph. Original must equal input text exactly, including whitespace. Set source ai. Correct status must have empty suggestion and changes. Clarify requires a concrete question. taskMet must describe whether this particular activity requirement is met.`,
    { text, ...context },
    answerReviewSchema,
  );
  const r = validateAnswerReview(result.data, text);
  if (r.source !== "ai" || r.status === "unavailable")
    throw new Error("Invalid provider review");
  return r;
}
