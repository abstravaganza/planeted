import { speechIssues, suggestedConcept } from "./tap-grammar";
import { emptyTapSession } from "./tap-contracts";
import { z } from "zod";
import {
  missionIdSchema,
  missions,
  shapedSchema,
  questFeedbackSchema,
  type MissionId,
  type SentenceUnit,
} from "./missions";
import { engineSchema, emptyEngine, canPractice, selectedText } from "./learning-engine";
import { practiceSchema } from "./corrections";
export const QUEST_KEY = "writing-quest:missions:v5";
export const oldKeys = [
  "writing-quest:missions:v4",
  "writing-quest:workspace:v3",
  "writing-quest:ru-sport-1:v1",
  "writing-quest:practice-library:v1",
];
const approvedSchema = z.strictObject({
  id: z.string(),
  text: z.string().max(1500),
  before: z.string().max(1500),
  explanation: z.string().max(700),
  choice: z.enum(["suggestion", "original", "edited"]),
  review: z.enum(["unreviewed", "curated", "ai"]).default("unreviewed"),
  intendedMeaning: z.string().default(""),
});
const buildSchema = z.strictObject({
  order: z.array(z.number().int().nonnegative()),
  done: z.boolean(),
  attempts: z.number().int().nonnegative(),
  message: z.string(),
  provenance: z.enum(["reconstruction", "reviewed", "ai", "unreviewed"]),
});
const generationSchema = z.strictObject({
  shuffleSeed: z.number().int().nonnegative().default(0),
  transcript: z.string().max(8000),
  sentences: z.array(approvedSchema).max(8),
  builds: z.record(z.string(), buildSchema),
  expansions: z.record(z.string(), z.string()),
  paragraph: z.string().max(16000),
});
export const missionStateSchema = z.strictObject({
  attemptNumber: z.number().int().nonnegative().default(0),
  attemptHistory: z
    .array(
      z.strictObject({
        createdAt: z.number(),
        transcript: z.string(),
        approvedTranscript: z.string(),
        draft: z.string(),
        original: z.string().nullable(),
        revision: z.string(),
      }),
    )
    .default([]),
  engine: engineSchema.default(() => emptyEngine()),
  stage: z.number().int().min(0).max(6),
  completed: z.array(z.number().int().min(0).max(5)),
  ledger: z.array(z.string()),
  transcript: z.string().max(8000),
  approvedTranscript: z.string().max(8000),
  units: shapedSchema.shape.units.or(z.tuple([])),
  decisions: z.record(z.string(), approvedSchema),
  generation: generationSchema.nullable(),
  history: z.array(generationSchema),
  engineHistory: z
    .array(
      z.strictObject({
        generation: generationSchema.nullable(),
        engine: engineSchema,
        createdAt: z.number(),
      }),
    )
    .default([]),
  writingHistory: z
    .array(
      z.strictObject({
        original: z.string().max(8000),
        revision: z.string().max(8000),
        feedback: questFeedbackSchema.nullable(),
        source: z.enum(["demo", "ai"]).nullable(),
        sample: z.string(),
        practice: z.record(z.string(), practiceSchema),
      }),
    )
    .default([]),
  sentenceIndex: z.number().int().min(0),
  draft: z.string().max(8000),
  original: z.string().max(8000).nullable(),
  revision: z.string().max(8000),
  feedback: questFeedbackSchema.nullable(),
  feedbackSource: z.enum(["demo", "ai"]).nullable(),
  feedbackSample: z.string(),
  status: z.enum(["idle", "loading", "ready", "error", "interrupted"]),
  requestId: z.string(),
  error: z.string(),
  practice: z.record(z.string(), practiceSchema),
  activePattern: z.enum(["with", "after", "because"]),
  timerSeconds: z.number().nonnegative(),
  timerRunning: z.boolean(),
  transcriptSource: z.enum(["typed", "recorded", "example"]),
  shapeSource: z.enum(["demo", "ai"]).nullable(),
  unitsTranscript: z.string().max(8000).default(""),
});
export type MissionState = z.infer<typeof missionStateSchema>;
export type Generation = NonNullable<MissionState["generation"]>;
export const questStateSchema = z.strictObject({
  version: z.literal(5),
  selected: missionIdSchema.nullable(),
  missions: z.record(missionIdSchema, missionStateSchema),
  legacy: z.record(z.string(), z.string().nullable()),
  settings: z.strictObject({
    motion: z.boolean(),
    quiet: z.boolean(),
    sound: z.boolean(),
  }),
});
export type QuestState = z.infer<typeof questStateSchema>;
export function emptyMission(): MissionState {
  return {
    attemptNumber: 0,
    attemptHistory: [],
    engine: emptyEngine(),
    stage: 0,
    completed: [],
    ledger: [],
    transcript: "",
    approvedTranscript: "",
    units: [],
    decisions: {},
    generation: null,
    history: [],
    engineHistory: [],
    writingHistory: [],
    sentenceIndex: 0,
    draft: "",
    original: null,
    revision: "",
    feedback: null,
    feedbackSource: null,
    feedbackSample: "",
    status: "idle",
    requestId: "",
    error: "",
    practice: {},
    activePattern: "with",
    timerSeconds: 0,
    timerRunning: false,
    transcriptSource: "typed",
    shapeSource: null,
    unitsTranscript: "",
  };
}
export function emptyQuest(
  legacy: Record<string, string | null> = {},
): QuestState {
  return questStateSchema.parse({
    version: 5,
    selected: null,
    missions: Object.fromEntries(missions.map((m) => [m.id, emptyMission()])),
    legacy,
    settings: { motion: true, quiet: false, sound: false },
  });
}
export function recoverQuest(raw: unknown) {
  const value = raw as { version?: number };
  const state = questStateSchema.parse(
    value?.version === 4 ? { ...value, version: 5 } : raw,
  );
  for (const m of Object.values(state.missions)) {
    if (m.status === "loading") {
      m.status = "interrupted";
      m.error =
        "Feedback was interrupted. Your original is saved. Retry when ready.";
      m.requestId = "";
    }
    m.timerRunning = false;
    if (m.stage >= 2 && m.stage <= 4 && !m.engine.units.some(canPractice))
      m.stage = 1;
  }
  return state;
}
export function reward(state: MissionState, key: string) {
  return { ...state, ledger: [...new Set([...state.ledger, key])] };
}
export const xp = (m: MissionState) =>
  m.ledger.reduce(
    (n, key) =>
      n + (key.startsWith("stage:") || key.startsWith("pattern:") ? 20 : 10),
    0,
  );
export function available(m: MissionState, stage: number) {
  return stage === 6
    ? m.original !== null
    : stage >= 0 &&
        stage < 6 &&
        (m.completed.includes(stage) ||
          stage <= Math.max(0, ...m.completed.map((n) => n + 1)));
}
export function completeStage(m: MissionState, stage: number) {
  if (!available(m, stage) || m.stage !== stage) return m;
  return {
    ...(stage === 4 &&
    (m.engine.reviewNeeded.includes(m.activePattern) ||
      m.engine.tap.needsReview.length > 0)
      ? m
      : reward(m, `stage:${stage}`)),
    completed: [...new Set([...m.completed, stage])],
    stage: Math.min(5, stage + 1),
  };
}
export function approveTranscript(m: MissionState) {
  if (!m.transcript.trim()) return m;
  return completeStage({ ...m, approvedTranscript: m.transcript }, 0);
}
export function approveUnits(m: MissionState) {
  if (m.unitsTranscript !== m.approvedTranscript) return m;
  const decisions = m.units.map((u) => m.decisions[u.id]);
  if (
    !decisions.length ||
    decisions.some(
      (d) => !d?.text.trim() || d.review === "unreviewed" || !d.intendedMeaning,
    )
  )
    return m;
  const same =
    m.generation &&
    JSON.stringify(m.generation.sentences) === JSON.stringify(decisions);
  return completeStage(
    {
      ...m,
      generation: same
        ? m.generation
        : {
            shuffleSeed: Math.floor(Math.random() * 2147483646),
            transcript: m.approvedTranscript,
            sentences: decisions,
            builds: {},
            expansions: {},
            paragraph: "",
          },
      history: !same && m.generation ? [...m.history, m.generation] : m.history,
      sentenceIndex: 0,
    },
    1,
  );
}
export function decide(
  m: MissionState,
  unit: SentenceUnit,
  choice: "suggestion" | "original" | "edited",
  text?: string,
): MissionState {
  return {
    ...m,
    decisions: {
      ...m.decisions,
      [unit.id]: {
        id: unit.id,
        text: text ?? (choice === "original" ? unit.before : unit.after),
        before: unit.before,
        explanation: unit.explanation,
        choice,
        review: "unreviewed",
        intendedMeaning: "",
      },
    },
  };
}
export function submitOriginal(
  m: MissionState,
  requestId: string,
): MissionState {
  if (m.original === null && !m.draft.trim()) return m;
  return {
    ...completeStage({ ...m, stage: 5 }, 5),
    stage: 6,
    original: m.original ?? m.draft,
    revision: m.original === null ? m.draft : m.revision,
    status: "loading",
    requestId,
    error: "",
  };
}
export function feedbackArrived(
  m: MissionState,
  requestId: string,
  feedback: z.infer<typeof questFeedbackSchema>,
  source: "demo" | "ai",
  sample: string,
): MissionState {
  if (m.status !== "loading" || m.requestId !== requestId) return m;
  return {
    ...m,
    status: "ready",
    feedback,
    feedbackSource: source,
    feedbackSample: source === "demo" ? sample : "",
    requestId: "",
  };
}
export function failedFeedback(
  m: MissionState,
  requestId: string,
): MissionState {
  return m.requestId !== requestId
    ? m
    : {
        ...m,
        status: "error",
        error: "Feedback could not load. Your original is saved; please retry.",
        requestId: "",
      };
}
export function missionPatch(
  s: QuestState,
  id: MissionId,
  change: (m: MissionState) => MissionState,
): QuestState {
  return { ...s, missions: { ...s.missions, [id]: change(s.missions[id]) } };
}

/** Replaying is explicit and reversible through preserved exercise/writing history. */
export function replayMission(m: MissionState): MissionState {
  return m.original === null ? m : restartChallenge(m);
}

export function approveReviewedModels(m: MissionState): MissionState {
  const units = m.engine.units;
  if (
    m.engine.analysisTranscript !== m.approvedTranscript ||
    !units.length ||
    !units.every(canPractice)
  )
    return m;
  const sentences = units.map((u) => ({
    id: u.id,
    text: selectedText(u),
    before: u.original,
    explanation: u.changes.map((c) => c.explanation).join(" ").slice(0, 700),
    choice: u.selectedVersion ?? "suggestion",
    review: u.selectedVersion === "original" ? "unreviewed" as const : u.review,
    intendedMeaning: u.intendedMeaning,
  }));
  const same =
    m.generation &&
    JSON.stringify(m.generation.sentences) === JSON.stringify(sentences);
  return completeStage(
    {
      ...m,
      completed: same
        ? m.completed
        : m.completed.filter(
            (stage) => stage < 2 || (stage === 5 && m.original !== null),
          ),
      generation: same
        ? m.generation
        : {
            shuffleSeed: Math.floor(Math.random() * 2147483646),
            transcript: m.approvedTranscript,
            sentences,
            builds: {},
            expansions: {},
            paragraph: "",
          },
      history: !same && m.generation ? [...m.history, m.generation] : m.history,
      engine: same
        ? m.engine
        : {
            ...m.engine,
            build: {},
            expansion: {},
            story: emptyEngine().story,
            tap: {
              ...m.engine.tap,
              sessions: {},
              chosen: false,
              selected: suggestedConcept(
                speechIssues(units),
                m.engine.tap.sessions,
                m.engine.tap.needsReview,
              ),
            },
          },
      sentenceIndex: 0,
    },
    1,
  );
}

/** Archive every kind of unfinished/submitted work before a fresh recording. No destructive reset. */
export function restartChallenge(m: MissionState): MissionState {
  const now = Date.now();
  return {
    ...emptyMission(),
    attemptNumber: m.attemptNumber + 1,
    ledger: m.ledger,
    attemptHistory: [
      ...m.attemptHistory,
      {
        createdAt: now,
        transcript: m.transcript,
        approvedTranscript: m.approvedTranscript,
        draft: m.draft,
        original: m.original,
        revision: m.revision,
      },
    ],
    history: [...m.history, ...(m.generation ? [m.generation] : [])],
    engineHistory: [
      ...m.engineHistory,
      { createdAt: now, generation: m.generation, engine: m.engine },
    ],
    writingHistory:
      m.original === null
        ? m.writingHistory
        : [
            ...m.writingHistory,
            {
              original: m.original,
              revision: m.revision,
              feedback: m.feedback,
              source: m.feedbackSource,
              sample: m.feedbackSample,
              practice: m.practice,
            },
          ],
    engine: {
      ...emptyEngine(),
      tap: {
        ...emptyEngine().tap,
        needsReview: [
          ...new Set([
            ...m.engine.tap.needsReview,
            ...speechIssues(m.engine.units).map((i) => i.concept),
          ]),
        ],
      },
    },
  };
}
export function replayTapPractice(m: MissionState): MissionState {
  const concept = m.engine.tap.selected,
    session = m.engine.tap.sessions[concept] ?? emptyTapSession();
  return {
    ...m,
    engineHistory: [
      ...m.engineHistory,
      { createdAt: Date.now(), generation: m.generation, engine: m.engine },
    ],
    engine: {
      ...m.engine,
      tap: {
        ...m.engine.tap,
        sessions: {
          ...m.engine.tap.sessions,
          [concept]: { ...emptyTapSession(), round: session.round + 1 },
        },
      },
    },
  };
}
