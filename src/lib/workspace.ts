import { z } from "zod";
import {
  initialProgress,
  progressSchema,
  restoreProgress,
  STORAGE_KEY,
  type Progress,
} from "./progress";
import { practiceSchema, type CorrectionPractice } from "./corrections";
import {
  topicIdSchema,
  topicIds,
  getSteps,
  writingStage,
  feedbackStage,
  type TopicId,
} from "./topics";
import { mission } from "./mission";
import type { Feedback, ServiceResult } from "./contracts";
import { totalXp, award } from "./learning";
export const WORKSPACE_KEY = "writing-quest:workspace:v3";
export const LEGACY_PACKS_KEY = "writing-quest:practice-library:v1";
export const topicStateSchema = z.strictObject({
  progress: progressSchema,
  status: z.enum(["idle", "loading", "ready", "error", "interrupted"]),
  requestId: z.string(),
  error: z.string(),
  feedbackSample: z.string(),
  practice: z.record(z.string(), practiceSchema),
  activePattern: z.enum(["with", "after", "because"]).default("with"),
  earnedPatterns: z.array(z.string()).default([]),
  earnedStages: z.array(z.number().int()).default([]),
  revisionMilestone: z.boolean().default(false),
  archives: z
    .array(
      z.strictObject({
        original: z.string().max(8000),
        revision: z.string().max(8000),
      }),
    )
    .max(100),
});
export type TopicState = z.infer<typeof topicStateSchema>;
export const workspaceSchema = z
  .strictObject({
    version: z.literal(3),
    selectedTopic: topicIdSchema.nullable(),
    topics: z.record(topicIdSchema, topicStateSchema),
  })
  .superRefine((state, context) => {
    for (const id of topicIds) {
      if (
        state.topics[id].progress.stage >= getSteps(id).length ||
        state.topics[id].progress.completed.some(
          (n) => n >= getSteps(id).length,
        )
      )
        context.addIssue({
          code: "custom",
          path: ["topics", id, "progress"],
          message: "Stage does not belong to this topic.",
        });
    }
  });
export type Workspace = z.infer<typeof workspaceSchema>;
export function emptyTopic(): TopicState {
  return {
    progress: structuredClone(initialProgress),
    status: "idle",
    requestId: "",
    error: "",
    feedbackSample: "",
    practice: {},
    activePattern: "with",
    earnedPatterns: [],
    earnedStages: [],
    revisionMilestone: false,
    archives: [],
  };
}
export function emptyWorkspace(): Workspace {
  return {
    version: 3,
    selectedTopic: null,
    topics: Object.fromEntries(
      topicIds.map((id) => [id, emptyTopic()]),
    ) as Workspace["topics"],
  };
}
const legacyPackSchema = z.object({
  notes: z.string(),
  tiles: z.array(z.string()),
  expansions: z.record(z.string(), z.string()),
  writing: z.string(),
  original: z.string().nullable(),
  previousOriginals: z.array(z.string()).default([]),
  completed: z.array(z.number()),
  step: z.number(),
  revision: z.string().optional(),
});
export function recoverWorkspace(value: unknown): Workspace {
  const state = workspaceSchema.parse(value);
  for (const id of topicIds) {
    const topic = state.topics[id];
    if (topic.status === "loading") {
      topic.status = "interrupted";
      topic.error =
        "Feedback was interrupted. Your original is saved. Retry when ready.";
      topic.requestId = "";
    }
    if (
      topic.progress.original !== null &&
      !topic.progress.feedback &&
      topic.status === "idle"
    )
      topic.status = "interrupted";
  }
  return state;
}
export function migrateWorkspace(
  sports: unknown | null,
  packs: unknown | null,
): Workspace {
  const state = emptyWorkspace();
  if (sports !== null) {
    const p = restoreProgress(sports);
    state.topics.sports = {
      ...emptyTopic(),
      progress: p,
      status: p.feedback
        ? "ready"
        : p.original !== null
          ? "interrupted"
          : "idle",
      feedbackSample: p.feedbackSource === "demo" ? mission.sample : "",
    };
    state.selectedTopic = "sports";
  }
  if (packs !== null) {
    const parsed = z.record(z.string(), legacyPackSchema).parse(packs);
    for (const id of topicIds.filter((id) => id !== "sports")) {
      const old = parsed[id];
      if (!old) continue;
      const topic = state.topics[id];
      topic.progress = {
        ...structuredClone(initialProgress),
        stage:
          old.original !== null ? feedbackStage(id) : Math.min(3, old.step),
        notes: old.notes,
        tiles: old.tiles,
        expansions: old.expansions,
        draft: old.writing,
        original: old.original,
        revision: old.revision ?? old.original ?? "",
        completed: old.completed.filter((n) => n >= 0 && n <= 3),
      };
      topic.archives = old.previousOriginals.map((original) => ({
        original,
        revision: original,
      }));
      topic.status = old.original !== null ? "interrupted" : "idle";
    }
  }
  return workspaceSchema.parse(state);
}
export function canNavigate(
  id: TopicId,
  topic: TopicState,
  stage: number,
): boolean {
  if (stage < 0 || stage >= getSteps(id).length) return false;
  if (stage === feedbackStage(id)) return topic.progress.original !== null;
  return stage <= Math.max(0, ...topic.progress.completed.map((n) => n + 1));
}
export function navigateTopic(
  id: TopicId,
  topic: TopicState,
  stage: number,
): TopicState {
  if (!canNavigate(id, topic, stage)) return topic;
  return { ...topic, progress: { ...topic.progress, stage } };
}
export function finishStage(
  id: TopicId,
  topic: TopicState,
  stage = topic.progress.stage,
): TopicState {
  if (topic.progress.stage !== stage) return topic;
  return {
    ...topic,
    progress: {
      ...topic.progress,
      completed: award(topic.progress.completed, stage),
      stage: Math.min(stage + 1, feedbackStage(id)),
    },
  };
}
export function beginFeedback(
  id: TopicId,
  topic: TopicState,
  requestId: string,
): TopicState {
  const first = topic.progress.original === null;
  if (first && !topic.progress.draft.trim()) return topic;
  return {
    ...topic,
    status: "loading",
    error: "",
    requestId,
    progress: {
      ...topic.progress,
      original: first ? topic.progress.draft : topic.progress.original,
      revision: first ? topic.progress.draft : topic.progress.revision,
      stage: feedbackStage(id),
      completed: award(topic.progress.completed, writingStage(id)),
    },
  };
}
export function receiveFeedback(
  id: TopicId,
  topic: TopicState,
  requestId: string,
  result: ServiceResult<Feedback>,
  sample: string,
): TopicState {
  if (topic.requestId !== requestId || topic.status !== "loading") return topic;
  return {
    ...topic,
    activePattern:
      result.source === "ai" &&
      result.data.corrections.length &&
      Object.keys(topic.practice).length === 0
        ? result.data.corrections[0].patternId
        : topic.activePattern,
    status: "ready",
    error: "",
    feedbackSample: result.source === "demo" ? sample : "",
    progress: {
      ...topic.progress,
      feedback: result.data,
      feedbackSource: result.source,
      feedbackNotice: result.notice ?? "",
      completed: award(topic.progress.completed, feedbackStage(id)),
    },
  };
}
export function failFeedback(topic: TopicState, requestId: string): TopicState {
  return topic.requestId === requestId
    ? {
        ...topic,
        status: "error",
        error: "Feedback could not load. Your original is saved. Try again.",
      }
    : topic;
}
export function topicXp(id: TopicId, topic: TopicState) {
  const stages = [
    ...new Set([...topic.earnedStages, ...topic.progress.completed]),
  ];
  const earned = [
    ...new Set([
      ...topic.earnedPatterns,
      ...Object.keys(topic.practice).filter(
        (key) => topic.practice[key].completed,
      ),
    ]),
  ];
  return (
    (id === "sports" ? totalXp(stages) : stages.length * 20) +
    (topic.progress.revisionRewarded || topic.revisionMilestone ? 20 : 0) +
    earned.length * 20
  );
}
export function savePractice(
  topic: TopicState,
  patternId: string,
  practice: CorrectionPractice,
): TopicState {
  return {
    ...topic,
    practice: { ...topic.practice, [patternId]: practice },
    earnedPatterns: practice.completed
      ? [...new Set([...topic.earnedPatterns, patternId])]
      : topic.earnedPatterns,
  };
}
export function nextAttempt(topic: TopicState): TopicState {
  if (topic.progress.original === null || topic.archives.length >= 100)
    return topic;
  return {
    ...emptyTopic(),
    earnedPatterns: [
      ...new Set([
        ...topic.earnedPatterns,
        ...Object.keys(topic.practice).filter(
          (key) => topic.practice[key].completed,
        ),
      ]),
    ],
    earnedStages: [
      ...new Set([...topic.earnedStages, ...topic.progress.completed]),
    ],
    revisionMilestone:
      topic.revisionMilestone || topic.progress.revisionRewarded,
    archives: [
      ...topic.archives,
      { original: topic.progress.original, revision: topic.progress.revision },
    ],
  };
}
export function updateProgress(
  topic: TopicState,
  patch: Partial<Progress>,
): TopicState {
  return { ...topic, progress: { ...topic.progress, ...patch } };
}
export { STORAGE_KEY };
