import type { z } from "zod";
import type {
  exerciseSchema,
  extractionSchema,
  grammarSchema,
  sentenceVerdictSchema,
  Feedback,
  ServiceResult,
} from "../contracts";
export interface LearningServices {
  transcribe(audio: Blob): Promise<ServiceResult<{ text: string }>>;
  extractIdeas(
    text: string,
    language: string,
  ): Promise<ServiceResult<z.infer<typeof extractionSchema>>>;
  generateExercise(
    text: string,
    language: string,
  ): Promise<ServiceResult<z.infer<typeof exerciseSchema>>>;
  analyzeGrammar(
    text: string,
    language: string,
  ): Promise<ServiceResult<z.infer<typeof grammarSchema>>>;
  writingFeedback(
    text: string,
    prompt: string,
    language: string,
  ): Promise<ServiceResult<Feedback>>;
  validateSentence(
    text: string,
    intendedMeaning: string,
    language: string,
  ): Promise<ServiceResult<z.infer<typeof sentenceVerdictSchema>>>;
}
