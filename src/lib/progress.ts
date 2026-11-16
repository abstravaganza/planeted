import { z } from "zod";
import { feedbackSchema, ideaSchema } from "./contracts";
export const progressSchema = z.strictObject({
  version: z.literal(1),
  stage: z.number().int().min(0).max(7),
  completed: z.array(z.number().int().min(0).max(7)).max(8),
  notes: z.string().max(8000),
  ideas: z.array(ideaSchema).max(8),
  approved: z.boolean(),
  tiles: z.array(z.string()).max(16),
  tileFormatVersion: z.literal(2).default(2),
  expansions: z.record(z.string(), z.string().max(500)),
  transitions: z.record(z.string(), z.string()),
  detail: z.string().max(500),
  repairs: z.array(z.string().max(1000)).max(2),
  draft: z.string().max(8000),
  original: z.string().max(8000).nullable(),
  revision: z.string().max(8000),
  feedback: feedbackSchema.nullable(),
  feedbackSource: z.enum(["demo", "ai"]).nullable(),
  feedbackNotice: z.string(),
  revisionRewarded: z.boolean(),
});
export type Progress = z.infer<typeof progressSchema>;
export const initialProgress: Progress = {
  version: 1,
  stage: 0,
  completed: [],
  notes: "",
  ideas: [],
  approved: false,
  tiles: [],
  tileFormatVersion: 2,
  expansions: {},
  transitions: {},
  detail: "",
  repairs: ["", ""],
  draft: "",
  original: null,
  revision: "",
  feedback: null,
  feedbackSource: null,
  feedbackNotice: "",
  revisionRewarded: false,
};
export const STORAGE_KEY = "writing-quest:ru-sport-1:v1";
export function restoreProgress(value: unknown): Progress {
  if (
    typeof value === "object" &&
    value !== null &&
    "tiles" in value &&
    Array.isArray(value.tiles) &&
    !("tileFormatVersion" in value)
  ) {
    const replacements: Record<string, string[]> = {
      what: ["prep-activity", "what"],
      company: ["prep-company", "company"],
      time: ["prep-time", "time"],
    };
    return progressSchema.parse({
      ...value,
      tiles: value.tiles.flatMap((id) =>
        typeof id === "string" ? (replacements[id] ?? [id]) : [id],
      ),
      tileFormatVersion: 2,
    });
  }
  return progressSchema.parse(value);
}
