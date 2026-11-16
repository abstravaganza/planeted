import type { AnswerReview } from "./answer-review";
import { acceptedModelOrder, type AnalysisUnit } from "./learning-engine";

/** Reuse established evidence; no new provider judgement is necessary for the same sentence. */
export function reviewedBuilderMatch(unit: AnalysisUnit, text: string): AnswerReview | null {
  if (!acceptedModelOrder(unit, text)) return null;
  return {
    status: "correct",
    source: unit.review === "ai" ? "ai" : "curated",
    original: text,
    suggestion: "",
    changes: [],
    question: "",
    taskMet: true,
    explanation: unit.review === "ai"
      ? "You rebuilt your previously AI-reviewed sentence. No new AI request was needed."
      : "You rebuilt a reviewed example. No AI request was needed.",
  };
}
