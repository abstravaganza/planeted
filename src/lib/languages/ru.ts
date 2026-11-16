import type { Idea } from "../contracts";
import content from "../../content/ru-sport.json";
export const normalizeRussian = (text: string) =>
  text
    .normalize("NFC")
    .toLocaleLowerCase("ru")
    .replace(/[.!?,;:«»“”]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
export function demoIdeas(text: string): Idea[] {
  if (normalizeRussian(text) === normalizeRussian(content.sample))
    return [
      {
        id: "tennis",
        activity: "играть в теннис",
        when: "иногда после школы",
        where: "",
        company: "с подругами",
        why: "потому что весело",
      },
      {
        id: "walk",
        activity: "гулять с собакой",
        when: "",
        where: "",
        company: "с собакой",
        why: "",
      },
    ];
  // Only extract known facts present in the input; never attribute a sample's ideas to arbitrary writing.
  const clauses = text
    .split(/[.!?\n]+/u)
    .map((s) => s.trim())
    .filter(Boolean);
  return clauses.slice(0, 8).map((clause, i) => ({
    id: `idea-${i}`,
    activity: clause,
    when: "",
    where: "",
    company: "",
    why: "",
  }));
}
export function meaningfulDetail(value: string): boolean {
  return /[а-яё]{2,}/iu.test(value) && normalizeRussian(value).length >= 4;
}
