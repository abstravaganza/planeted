import { z } from "zod";
import raw from "../content/challenges.json";
export const challengeSchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  english: z.string(),
  description: z.string(),
  base: z.string(),
  meaning: z.string(),
  ideaPrompt: z.string(),
  writingPrompt: z.string(),
  tiles: z
    .array(
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
          "place",
        ]),
      }),
    )
    .min(3)
    .max(16),
  tileOrder: z.array(z.string()),
  acceptableOrders: z.array(z.array(z.string())).min(1),
  links: z.array(z.tuple([z.string(), z.string()])),
  expansions: z
    .array(
      z.strictObject({
        id: z.enum(["when", "where", "why", "company"]),
        label: z.string(),
        english: z.string(),
        options: z.array(z.string()).min(1),
      }),
    )
    .length(4),
});
export type Challenge = z.infer<typeof challengeSchema>;
export const challenges = z.array(challengeSchema).parse(raw);
export const sportsChallenge = challenges[0];
