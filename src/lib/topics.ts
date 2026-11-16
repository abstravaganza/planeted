import { z } from "zod";
import { challenges } from "./challenges";
import { mission } from "./mission";
import { feedbackSchema } from "./contracts";
import examples from "../content/feedback-examples.json";
export const topicIds = ["sports", "food", "music", "weekend"] as const;
export type TopicId = (typeof topicIds)[number];
export const topicIdSchema = z.enum(topicIds);
export const feedbackExamples = z
  .record(
    z.string(),
    z.strictObject({ sample: z.string(), feedback: feedbackSchema }),
  )
  .parse(examples);
export function getTopic(id: TopicId) {
  return challenges.find((c) => c.id === id)!;
}
export function getSteps(id: TopicId) {
  return id === "sports"
    ? [
        "Mission",
        "Ideas",
        "Build",
        "Expand",
        "Connect",
        "Grammar",
        "Write",
        "Feedback",
      ]
    : ["Ideas", "Build", "Expand", "Write", "Feedback"];
}
export function writingStage(id: TopicId) {
  return id === "sports" ? 6 : 3;
}
export function feedbackStage(id: TopicId) {
  return getSteps(id).length - 1;
}
export function writingPrompt(id: TopicId) {
  return id === "sports"
    ? mission.independentPrompt
    : getTopic(id).writingPrompt;
}
