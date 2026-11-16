export type SentenceResult = "accepted" | "incomplete" | "unreviewed";
export function checkSentence(
  ids: string[],
  expectedIds: string[],
  alternatives: string[][],
): SentenceResult {
  if (
    ids.length !== expectedIds.length ||
    new Set(ids).size !== ids.length ||
    !ids.every((id) => expectedIds.includes(id))
  )
    return "incomplete";
  return alternatives.some(
    (order) =>
      order.length === ids.length && order.every((id, i) => ids[i] === id),
  )
    ? "accepted"
    : "unreviewed";
}
export function award(completed: number[], stage: number): number[] {
  return completed.includes(stage) ? completed : [...completed, stage];
}
export const stageXp = [10, 25, 30, 30, 30, 30, 40, 15];
export function totalXp(completed: number[]): number {
  return [...new Set(completed)].reduce((n, i) => n + (stageXp[i] ?? 0), 0);
}
export function wordCount(text: string) {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}
