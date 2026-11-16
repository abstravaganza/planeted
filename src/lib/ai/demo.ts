import { mission } from "../mission";
import { demoIdeas } from "../languages/ru";
import type { LearningServices } from "./types";
import { feedbackExamples } from "../topics";
export const demoServices: LearningServices = {
  async transcribe() {
    throw new Error(
      "Demo Mode does not transcribe recordings. Type your ideas or use the labeled sample.",
    );
  },
  async extractIdeas(text) {
    return {
      source: "demo",
      data: { ideas: demoIdeas(text) },
      notice:
        text === mission.sample
          ? "The labeled sample has a curated idea map. Missing details stay blank for you to add."
          : "Demo organizer: your phrases are copied into Activity. Add the other details yourself.",
    };
  },
  async generateExercise() {
    return {
      source: "demo",
      data: {
        instruction: "Build a sentence about tennis.",
        tiles: mission.tiles,
        acceptableOrders: mission.acceptableOrders,
      },
    };
  },
  async analyzeGrammar() {
    return {
      source: "demo",
      data: { issues: [] },
      notice:
        "No automatic grammar analysis in Demo Mode. The detective activity uses predefined examples.",
    };
  },
  async writingFeedback() {
    return {
      source: "demo",
      data: feedbackExamples.sports.feedback,
      notice:
        "Illustrative example only. Your response has not been evaluated.",
    };
  },
  async validateSentence() {
    return {
      source: "demo",
      data: {
        accepted: false,
        meaningPreserved: false,
        agreementCorrect: false,
        explanation:
          "This order is outside our reviewed demo set. That does not mean it is incorrect. Try a hint or enable AI review.",
      },
    };
  },
};
