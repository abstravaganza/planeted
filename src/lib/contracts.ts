import { z } from "zod";

export const categorySchema = z.enum(["red", "orange", "yellow", "green"]);
export const ideaSchema = z.strictObject({
  id: z.string().max(100),
  activity: z.string().max(500),
  when: z.string().max(500),
  where: z.string().max(500),
  company: z.string().max(500),
  why: z.string().max(500),
});
export type Idea = z.infer<typeof ideaSchema>;
export const correctionSchema = z.strictObject({
  patternId: z.enum(["with", "after", "because"]),
  original: z.string().min(1).max(300),
  corrected: z.string().min(1).max(300),
});
export const feedbackSchema = z.strictObject({
  summary: z.string().min(1).max(2000),
  dimensions: z
    .array(
      z.strictObject({
        name: z.string().max(100),
        level: z.enum(["Starting", "Developing", "Clear"]),
        detail: z.string().max(1000),
      }),
    )
    .length(5),
  strengths: z.array(z.string().max(1000)).min(1).max(4),
  nextSteps: z.array(z.string().max(1000)).min(1).max(2),
  issues: z
    .array(
      z.strictObject({
        category: categorySchema,
        message: z.string().max(1000),
      }),
    )
    .max(10),
  corrections: z.array(correctionSchema).max(2).default([]),
});
// Required for provider Structured Outputs, while stored older feedback can omit corrections.
export const aiFeedbackSchema = feedbackSchema.extend({
  corrections: z.array(correctionSchema).max(2),
});
export type Feedback = z.infer<typeof feedbackSchema>;
export const extractionSchema = z.strictObject({
  ideas: z.array(ideaSchema).min(1).max(8),
});
export const sentenceVerdictSchema = z.strictObject({
  accepted: z.boolean(),
  meaningPreserved: z.boolean(),
  agreementCorrect: z.boolean(),
  explanation: z.string().max(1000),
});
export const exerciseSchema = z.strictObject({
  instruction: z.string().max(1000),
  tiles: z
    .array(
      z.strictObject({ id: z.string(), text: z.string(), role: z.string() }),
    )
    .min(3)
    .max(16),
  acceptableOrders: z.array(z.array(z.string())).min(1).max(30),
});
export const grammarSchema = z.strictObject({
  issues: z
    .array(
      z.strictObject({
        category: categorySchema,
        excerpt: z.string().max(500),
        explanation: z.string().max(1000),
      }),
    )
    .max(12),
});
export type ServiceResult<T> = {
  source: "demo" | "ai";
  data: T;
  notice?: string;
};
