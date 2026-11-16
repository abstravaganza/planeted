import { z } from "zod";
import raw from "../content/missions.json";
export const missionIdSchema = z.enum([
  "sports",
  "friends",
  "town",
  "school",
  "weekend",
  "guest",
]);
export type MissionId = z.infer<typeof missionIdSchema>;
export const missionConfigSchema = z.strictObject({
  id: missionIdSchema,
  title: z.string(),
  english: z.string(),
  objective: z.string(),
  prompt: z.string(),
  bossPrompt: z.string(),
  difficulty: z.string(),
  theme: z.enum(["sage", "peach", "sky", "lilac", "lemon", "rose"]),
  illustration: missionIdSchema,
  language: z.literal("ru"),
  sample: z.array(z.string()).min(1),
  goals: z.array(z.string()),
  requiredContent: z.array(z.string()),
  sentenceSettings: z.strictObject({
    targetMin: z.number(),
    targetMax: z.number(),
    maxUnits: z.number(),
  }),
  grammarTargets: z.array(z.enum(["with", "after", "because"])),
  connectorOpportunities: z.array(z.string()),
  feedbackObjectives: z.array(z.string()).length(7),
});
export const missions = z.array(missionConfigSchema).length(6).parse(raw);
export type MissionConfig = z.infer<typeof missionConfigSchema>;
export const stages = [
  "Speak",
  "Shape Ideas",
  "Build Sentences",
  "Expand and Connect",
  "Grammar Detective",
  "Boss Battle",
] as const;
export const getMission = (id: MissionId) => missions.find((m) => m.id === id)!;
export const sentenceUnitSchema = z.strictObject({
  id: z.string().max(100),
  before: z.string().min(1).max(1500),
  after: z.string().min(1).max(1500),
  explanation: z.string().max(700),
});
export const shapedSchema = z.strictObject({
  units: z.array(sentenceUnitSchema).min(1).max(8),
});
export type SentenceUnit = z.infer<typeof sentenceUnitSchema>;
export const questFeedbackSchema = z.strictObject({
  summary: z.string().max(1500),
  dimensions: z
    .array(
      z.strictObject({
        name: z.string().max(100),
        evidence: z.string().max(700),
        next: z.string().max(700),
      }),
    )
    .min(6)
    .max(7),
  strengths: z.array(z.string().max(700)).min(1).max(3),
  nextSteps: z.array(z.string().max(700)).min(1).max(2),
});
export type QuestFeedback = z.infer<typeof questFeedbackSchema>;
