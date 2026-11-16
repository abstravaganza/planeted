import { z } from "zod";
import raw from "../content/correction-patterns.json";
import { normalizeRussian } from "./languages/ru";
import type { Feedback } from "./contracts";
export const patternSchema = z.strictObject({
  id: z.enum(["with", "after", "because"]),
  title: z.string(),
  before: z.string(),
  after: z.string(),
  explanation: z.string(),
  items: z
    .array(
      z.strictObject({
        prompt: z.string(),
        answers: z.array(z.string()),
        feedback: z.string(),
      }),
    )
    .length(2),
  transferPrompt: z.string(),
  reviewedTransfers: z.array(z.string()),
  supportedEdits: z.array(z.tuple([z.string(), z.string()])),
});
export const patterns = z.array(patternSchema).parse(raw);
export type Pattern = z.infer<typeof patternSchema>;
export const practiceSchema = z.strictObject({
  answers: z.array(z.string().max(500)).length(2),
  checked: z.array(z.boolean()).length(2),
  attempts: z.array(z.number().int().min(0)).length(2),
  revealed: z.array(z.boolean()).length(2),
  transfer: z.string().max(2000),
  reviewedText: z.string().max(2000),
  provenance: z.enum(["unreviewed", "reviewed", "ai"]),
  accepted: z.boolean(),
  message: z.string().max(2000),
  completed: z.boolean(),
});
export type CorrectionPractice = z.infer<typeof practiceSchema>;
export const emptyPractice: CorrectionPractice = {
  answers: ["", ""],
  checked: [false, false],
  attempts: [0, 0],
  revealed: [false, false],
  transfer: "",
  reviewedText: "",
  provenance: "unreviewed",
  accepted: false,
  message: "",
  completed: false,
};
export function checkPatternAnswer(
  pattern: Pattern,
  index: number,
  value: string,
) {
  return (
    pattern.items[index]?.answers.some(
      (a) => normalizeRussian(a) === normalizeRussian(value),
    ) ?? false
  );
}
export function checkPracticeItem(
  pattern: Pattern,
  state: CorrectionPractice,
  index: number,
): CorrectionPractice {
  const checked = [...state.checked];
  checked[index] = checkPatternAnswer(pattern, index, state.answers[index]);
  const attempts = [...state.attempts];
  attempts[index] += 1;
  return { ...state, checked, attempts };
}
export function reviewedTransfer(pattern: Pattern, text: string) {
  return pattern.reviewedTransfers.some(
    (s) => normalizeRussian(s) === normalizeRussian(text),
  );
}
export function completePractice(
  state: CorrectionPractice,
): CorrectionPractice {
  return state.checked.every(Boolean) &&
    state.accepted &&
    state.transfer === state.reviewedText
    ? { ...state, completed: true }
    : state;
}
export function correctionXp(practice: Record<string, CorrectionPractice>) {
  return Object.values(practice).filter((p) => p.completed).length * 20;
}
/** Only link supported, bounded edits actually present in the submitted original. */
export function supportedCorrections(
  text: string,
  corrections: Feedback["corrections"],
): Feedback["corrections"] {
  return corrections
    .filter((c) => {
      if (!text.includes(c.original) || c.original === c.corrected)
        return false;
      const pattern = patterns.find((p) => p.id === c.patternId);
      return pattern?.supportedEdits.some(
        ([before, after]) =>
          c.original.includes(before) &&
          c.original.replace(before, after) === c.corrected,
      );
    })
    .filter(
      (c, i, all) =>
        all.findIndex((other) => other.patternId === c.patternId) === i,
    )
    .slice(0, 2);
}
export function changedParts(before: string, after: string) {
  const a = before.match(/\S+|\s+/gu) ?? [];
  const b = after.match(/\S+|\s+/gu) ?? [];
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let end = 0;
  while (
    end < a.length - start &&
    end < b.length - start &&
    a[a.length - 1 - end] === b[b.length - 1 - end]
  )
    end++;
  return {
    before: [
      a.slice(0, start).join(""),
      a.slice(start, a.length - end).join(""),
      end ? a.slice(-end).join("") : "",
    ],
    after: [
      b.slice(0, start).join(""),
      b.slice(start, b.length - end).join(""),
      end ? b.slice(-end).join("") : "",
    ],
  };
}
