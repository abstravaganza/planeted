import type { Challenge } from "../challenges";
import { normalizeRussian } from "./ru";
export type DetailReview = {
  status: "empty" | "reviewed" | "repair" | "unreviewed";
  message: string;
};
export function reviewDetail(
  challenge: Challenge,
  field: string,
  value: string,
): DetailReview {
  const text = normalizeRussian(value);
  if (!text) return { status: "empty", message: "" };
  const definition = challenge.expansions.find((e) => e.id === field);
  if (definition?.options.some((option) => normalizeRussian(option) === text))
    return {
      status: "reviewed",
      message: "Reviewed phrase for this exercise.",
    };
  if (
    field === "company" &&
    ["друзья", "подруги", "брат", "сестра", "папа", "мама"].includes(text)
  )
    return {
      status: "repair",
      message:
        "Use с + instrumental to say “with”: друзья → с друзьями; сестра → с сестрой. Choose a reviewed phrase below.",
    };
  if (field === "why" && !text.startsWith("потому что "))
    return {
      status: "repair",
      message:
        "Write a complete reason starting with потому что. For example: потому что это весело. A fragment such as «равится» cannot join this sentence.",
    };
  return {
    status: "unreviewed",
    message:
      "This phrase is not reviewed in Demo Mode. It may be correct. Keep it as a draft, or choose a reviewed phrase below to build the preview.",
  };
}
export function expansionState(
  challenge: Challenge,
  values: Record<string, string>,
) {
  const reviews = Object.fromEntries(
    challenge.expansions.map((e) => [
      e.id,
      reviewDetail(challenge, e.id, values[e.id] ?? ""),
    ]),
  );
  const reviewed = Object.values(reviews).filter(
    (r) => r.status === "reviewed",
  ).length;
  const hasUnreviewed = Object.values(reviews).some(
    (r) => r.status === "repair" || r.status === "unreviewed",
  );
  return { reviews, reviewed, canContinue: reviewed >= 3 && !hasUnreviewed };
}
export function buildExpansion(
  challenge: Challenge,
  values: Record<string, string>,
): string | null {
  const { reviews } = expansionState(challenge, values);
  if (
    Object.values(reviews).some(
      (r) => r.status === "repair" || r.status === "unreviewed",
    )
  )
    return null;
  const text = (id: string) =>
    reviews[id]?.status === "reviewed" ? normalizeRussian(values[id]) : "";
  const when = text("when");
  const rest = challenge.base.replace(/^Я\s/u, "");
  const adverbs = ["всегда", "иногда", "часто", "обычно", "редко"];
  let sentence = when
    ? adverbs.includes(when)
      ? `Я ${when} ${rest}`
      : `${when[0].toLocaleUpperCase("ru")}${when.slice(1)} я ${rest}`
    : challenge.base;
  if (text("where")) sentence += " " + text("where");
  if (text("company")) sentence += " " + text("company");
  if (text("why")) sentence += ", " + text("why");
  return sentence + ".";
}
