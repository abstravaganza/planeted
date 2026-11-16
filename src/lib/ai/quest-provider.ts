import type { z } from "zod";
import type { ServiceResult } from "../contracts";
import { sentenceVerdictSchema } from "../contracts";
import {
  shapedSchema,
  questFeedbackSchema,
  type MissionConfig,
} from "../missions";
import { demonstratedCorrections, shapeLocally } from "../languages/ru-quest";
import { structured } from "./openai";
export interface QuestProvider {
  shape(
    text: string,
    mission: MissionConfig,
  ): Promise<ServiceResult<z.infer<typeof shapedSchema>>>;
  validate(
    text: string,
    reference: string,
    language: string,
  ): Promise<ServiceResult<z.infer<typeof sentenceVerdictSchema>>>;
  feedback(
    text: string,
    mission: MissionConfig,
    practiceEvidence?: {
      guidedMode?: "tap" | "typed";
      hintCount: number;
      recallCompleted: number;
      skippedPatterns: string[];
    },
  ): Promise<
    ServiceResult<z.infer<typeof questFeedbackSchema>> & { sample?: string }
  >;
}
export const localQuestProvider: QuestProvider = {
  async shape(text) {
    return {
      source: "demo",
      data: { units: shapeLocally(text) },
      notice: "Local, bounded suggestions. No general AI review.",
    };
  },
  async validate() {
    return {
      source: "demo",
      data: {
        accepted: false,
        meaningPreserved: false,
        agreementCorrect: false,
        explanation:
          "This order is unreviewed, not necessarily incorrect. Reconstruct your approved sentence or enable AI review.",
      },
    };
  },
  async feedback(_text, mission) {
    return {
      source: "demo",
      sample: mission.sample.join(" "),
      data: {
        summary:
          "Illustrative feedback for the example below. Your response has not been evaluated.",
        dimensions: mission.feedbackObjectives.map((name) => ({
          name,
          evidence:
            name === "Independence from hints"
              ? "This is a prepared example, so independent use cannot be assessed."
              : name === "Language accuracy"
                ? "The example uses complete sentences and familiar case patterns."
                : "The example presents connected personal details relevant to this mission.",
          next: "In your own response, check this goal against the prompt.",
        })),
        strengths: ["The example includes specific details about the topic."],
        nextSteps: [
          "Check that your response answers each part of the fresh prompt.",
          "Add a relevant question for your reader.",
        ],
      },
    };
  },
};
export const aiQuestProvider: QuestProvider = {
  async shape(text, mission) {
    const result = await structured(
      "shape",
      "Split this transcript into at most eight meaningful sentence units. Each before must be an EXACT substring of the transcript. Suggest minimal natural written Russian in after. Preserve all personal facts; never add missing details. Keep grammatical originals. Explain changes in one short English sentence. Unique ids. Do not write a final paragraph.",
      { text, language: mission.language, goals: mission.goals },
      shapedSchema,
    );
    if (
      result.data.units.some((u) => !text.includes(u.before)) ||
      new Set(result.data.units.map((u) => u.id)).size !==
        result.data.units.length
    )
      throw new Error("Unsupported source mapping");
    return result;
  },
  validate: (text, reference, language) =>
    structured(
      "sentence",
      "Judge this Russian sentence against its approved reference. Accept natural word-order variation, preserve meaning and check agreement. Do not require exact matching.",
      { text, reference, language },
      sentenceVerdictSchema,
    ),
  feedback: (text, mission, practiceEvidence) =>
    structured(
      "mission_feedback",
      "Evaluate only the actual response against the independent prompt and required content. Each dimension needs specific evidence from the response and one short next action; do not invent evidence. If guidedMode is tap, recallCompleted counts tile reconstructions, not typed recall or independent composition. Never confuse recognition with independent use. Seven dimensions including prompt completion, communicative clarity, sentence construction, grammar control, organization, elaboration and independence from hints: explain that independence cannot be proven from text alone; use supplied practiceEvidence only to describe observed hint use in guided practice, not to certify independence during the final response. Describe demonstrated patterns only. No official ratings. One or two priority next steps. Never write a replacement response.",
      {
        text,
        practiceEvidence: practiceEvidence ?? null,
        prompt: mission.bossPrompt,
        requiredContent: mission.requiredContent,
        dimensions: mission.feedbackObjectives,
        supportedIssues: demonstratedCorrections(text),
      },
      questFeedbackSchema,
    ),
};
