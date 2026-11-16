import { z } from "zod";
import raw from "@/content/ru-sport.json";
import { feedbackSchema, categorySchema } from "./contracts";
const schema = z.strictObject({
  id: z.string(),
  language: z.string(),
  title: z.string(),
  subtitle: z.string(),
  minutes: z.number(),
  prompt: z.string(),
  independentPrompt: z.string(),
  sample: z.string(),
  skills: z.array(z.string()),
  steps: z
    .array(
      z.strictObject({
        title: z.string(),
        short: z.string(),
        description: z.string(),
      }),
    )
    .length(8),
  tiles: z.array(
    z.strictObject({
      id: z.string(),
      text: z.string(),
      role: z.enum([
        "subject",
        "verb",
        "activity",
        "company",
        "time",
        "preposition",
      ]),
    }),
  ),
  tileOrder: z.array(z.string()),
  acceptableOrders: z.array(z.array(z.string())),
  expansions: z.array(
    z.strictObject({
      id: z.string(),
      label: z.string(),
      english: z.string(),
      example: z.string(),
    }),
  ),
  story: z.array(
    z.strictObject({
      id: z.string(),
      text: z.string(),
      connector: z.string(),
      explanation: z.string(),
    }),
  ),
  transitions: z.array(z.string()),
  grammar: z.array(
    z.strictObject({
      id: z.string(),
      error: z.string(),
      answer: z.string(),
      explanation: z.string(),
      category: categorySchema,
    }),
  ),
  demoFeedback: feedbackSchema,
});
export const mission = schema.parse(raw);
