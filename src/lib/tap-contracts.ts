import { z } from "zod";
export const conceptSchema = z.enum(["with", "after", "because", "time"]);
export type Concept = z.infer<typeof conceptSchema>;
export const tapSessionSchema = z.strictObject({
  round: z.number().int().nonnegative().default(0),
  index: z.number().int().nonnegative().default(0),
  selections: z.record(z.string(), z.string()).default({}),
  targetFound: z.boolean().default(false),
  correct: z.boolean().default(false),
  done: z.boolean().default(false),
  hint: z.boolean().default(false),
  attempts: z.number().int().nonnegative().default(0),
  mistakes: z.number().int().nonnegative().default(0),
  message: z.string().default(""),
  completed: z.array(z.string()).default([]),
});
export const tapStateSchema = z.strictObject({
  selected: conceptSchema.default("with"),
  chosen: z.boolean().default(false),
  sessions: z.partialRecord(conceptSchema, tapSessionSchema).default({}),
  needsReview: z.array(conceptSchema).default([]),
});
export type TapSession = z.infer<typeof tapSessionSchema>;
export const emptyTapSession = () => tapSessionSchema.parse({});
export type TapState = z.infer<typeof tapStateSchema>;
