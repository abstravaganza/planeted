import type { SentenceUnit } from "../missions";
import { normalizeRussian } from "./ru";
import { patterns } from "../corrections";
/** Conservative local suggestions: only bounded, reviewed edits; no invented facts. */
export function shapeLocally(text: string): SentenceUnit[] {
  return (text.match(/[^.!?\n]+[.!?]?/gu) ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((before, i) => {
      let after = before,
        explanation =
          "Kept your wording. Demo Mode does not review the whole sentence.";
      for (const pattern of patterns)
        for (const [bad, good] of pattern.supportedEdits)
          if (after.includes(bad)) {
            after = after.replace(bad, good);
            explanation = pattern.explanation;
          }
      if (/играю теннис/iu.test(after)) {
        after = after.replace(/играю теннис/iu, "играю в теннис");
        explanation = "Use играть в + the name of a ball game: играю в теннис.";
      }
      return { id: `unit-${i}`, before, after, explanation };
    });
}
export function tokens(text: string): string[] {
  return text.replace(/[.!?]+$/u, "").match(/[^\s]+/gu) ?? [];
}
const reviewedVerbs = new Set([
  "играю",
  "гуляю",
  "люблю",
  "нравится",
  "встречаемся",
  "зовут",
  "гуляем",
  "умеет",
  "слушать",
  "общаться",
  "живу",
  "есть",
  "находится",
  "обсуждаем",
  "хожу",
  "работать",
  "ходила",
  "посмотрели",
  "пообедали",
  "понравился",
  "приезжает",
  "ужинает",
  "хочу",
  "показать",
  "можем",
  "сходить",
  "проводить",
]);
export function tileRole(word: string) {
  const w = normalizeRussian(word);
  if (
    ["с", "со", "в", "во", "на", "после", "к", "из", "у", "о", "по"].includes(w)
  )
    return "preposition";
  if (["я", "мы", "он", "она", "они", "ты", "вы"].includes(w)) return "subject";
  if (reviewedVerbs.has(w)) return "verb";
  return "detail";
}
export const roleLabels: Record<string, string> = {
  preposition: "Preposition",
  subject: "Subject",
  verb: "Verb",
  detail: "Detail",
};
export function renderedSentence(words: string[], reference = ".") {
  const s = words.map((w, i) => (i > 0 ? lowerInitial(w) : w)).join(" ");
  return s
    ? s[0].toLocaleUpperCase("ru") +
        s.slice(1) +
        (reference.match(/[.!?]$/u)?.[0] ?? ".")
    : "";
}
/** Curated safe chunk moves. Other full permutations stay unreviewed until provider review. */
export function naturalOrders(sentence: string): string[][] {
  const words = tokens(sentence);
  const alternatives = [words];
  const time = sentence.match(
    /^(После (?:школы|уроков)|По (?:выходным|вечерам))\s+(.+?)[.!?]?$/u,
  );
  if (time) {
    const rest = tokens(time[2]);
    if (rest[0]) rest[0] = rest[0].toLocaleUpperCase("ru");
    alternatives.push([...rest, ...tokens(time[1].toLocaleLowerCase("ru"))]);
  }
  const sport = normalizeRussian(sentence);
  if (sport === "я играю в теннис с подругами")
    alternatives.push(
      tokens("С подругами я играю в теннис"),
      tokens("Я с подругами играю в теннис"),
      tokens("В теннис я играю с подругами"),
    );
  return alternatives;
}
export function checkOrder(sentence: string, ids: number[]) {
  const words = tokens(sentence);
  if (
    ids.length !== words.length ||
    new Set(ids).size !== words.length ||
    ids.some((i) => !words[i])
  )
    return "incomplete";
  const actual = normalizeRussian(ids.map((i) => words[i]).join(" "));
  return naturalOrders(sentence).some(
    (a) => normalizeRussian(a.join(" ")) === actual,
  )
    ? "accepted"
    : "unreviewed";
}
export type ExpansionChoice = {
  id: string;
  label: string;
  kind: string;
  after: string;
  added: string;
  why: string;
};
export function expansionChoices(
  sentence: string,
  next?: string,
  sequence = false,
): ExpansionChoice[] {
  const base = sentence.replace(/[.!?]+$/u, "");
  const choices: ExpansionChoice[] = [];
  if (next)
    choices.push({
      id: "addition",
      label: "Кроме того · connect your next idea",
      kind: "Connect",
      after: base + ". Кроме того, " + lowerInitial(next),
      added: "Кроме того,",
      why: "An additive link groups two of your ideas; it does not imply a time sequence.",
    });
  // These explicit choices introduce student-selected new meaning, never inferred personal facts.
  if (/^Я играю в теннис(?: с подругами)?[.!?]?$/u.test(sentence)) {
    for (const [id, label, after, why] of [
      [
        "when",
        "После школы",
        "После школы " + base[0].toLocaleLowerCase("ru") + base.slice(1) + ".",
        "Adds a specific time.",
      ],
      ["where", "на корте", base + " на корте.", "Adds a place."],
      [
        "why",
        "потому что мне нравится эта игра",
        base + ", потому что мне нравится эта игра.",
        "A complete clause explains your reason.",
      ],
      ...(!base.includes("с подругами")
        ? [
            [
              "company",
              "с друзьями",
              base + " с друзьями.",
              "С друзьями answers с кем? with the instrumental ending.",
            ],
          ]
        : []),
    ])
      choices.push({ id, label, kind: id, after, added: label, why });
  }
  if (
    sequence &&
    /^Сначала /u.test(sentence) &&
    next &&
    /^После этого /u.test(next)
  )
    choices.push({
      id: "sequence",
      label: "Сначала → После этого",
      kind: "Sequence",
      after: base + ". " + next,
      added: "После этого",
      why: "These sentences already describe ordered events. Keep their time relationship.",
    });
  return choices;
}
export function demonstratedCorrections(text: string) {
  return patterns
    .flatMap((p) =>
      p.supportedEdits
        .filter(([bad]) => text.includes(bad))
        .map(([bad, good]) => ({
          patternId: p.id,
          original: bad,
          corrected: good,
        })),
    )
    .slice(0, 2);
}
/** Reviewed, contextual additions. A learner explicitly chooses whether a new detail is true. */
export function contextualChoices(
  sentence: string,
  next?: string,
  sequence = false,
): ExpansionChoice[] {
  const choices = expansionChoices(sentence, next, sequence);
  const stem = sentence.replace(/[.!?]+$/u, "");
  const catalog: Record<string, [string, string, string, string][]> = {
    "Вчера я играла в теннис с моими друзьями": [
      [
        "where",
        "на школьном корте",
        "на школьном корте",
        "Names a more precise place without changing the event.",
      ],
      [
        "when",
        "вечером",
        "вечером",
        "Adds a time within yesterday, rather than repeating вчера.",
      ],
      [
        "why",
        "потому что",
        "мне хотелось потренироваться",
        "A complete clause gives a reason for playing.",
      ],
    ],
    "Мне нравится общаться с ней": [
      ["why", "потому что", "она меня понимает", "Gives a complete reason for enjoying your conversations."],
      ["when", "после школы", "после школы", "Says when you talk together."],
    ],
    "Она умеет внимательно слушать": [
      [
        "therefore",
        "Поэтому",
        "мне легко делиться с ней своими мыслями",
        "A result follows from the listening skill you described.",
      ],
    ],
    "Мне нравится проводить время на свежем воздухе": [
      [
        "contrast",
        "Однако",
        "в сильный мороз я предпочитаю оставаться дома",
        "A contrast qualifies your general preference.",
      ],
    ],
    "Я живу в небольшом городе": [
      [
        "why",
        "потому что",
        "здесь живёт моя семья",
        "A complete clause supplies a reason.",
      ],
    ],
    "Мой любимый предмет — история": [
      [
        "why",
        "потому что",
        "мне интересно узнавать о прошлом",
        "Explains your preference.",
      ],
    ],
    "В субботу я ходила в музей с братом": [
      ["when", "утром", "утром", "Adds a more precise time."],
    ],
    "К нам приезжает ученик из России": [
      [
        "when",
        "на следующей неделе",
        "на следующей неделе",
        "Makes the plan more specific.",
      ],
    ],
    "После школы я хожу в театральный кружок": [
      [
        "why",
        "потому что",
        "мне нравится выступать на сцене",
        "Explains the activity with a full reason.",
      ],
    ],
    "Мне очень понравился этот день": [
      ["why", "потому что", "я узнала много нового", "Explains your reaction."],
    ],
    "Я хочу показать ему наш город": [
      [
        "example",
        "Например",
        "Мы можем сходить в музей.",
        "Makes a general plan concrete.",
      ],
    ],
    "После уроков мы гуляем в парке": [
      [
        "company",
        "с друзьями",
        "с друзьями",
        "Adds company with the instrumental case.",
      ],
    ],
    "В центре есть красивый парк": [
      [
        "example",
        "Например",
        "Там можно гулять и кататься на велосипеде.",
        "Shows what a visitor can do.",
      ],
    ],
  };
  if (/зовут\s+[^.!?]+$/iu.test(stem)) {
    choices.push({ id: "where-met", kind: "where", label: "Мы познакомились в школе.",
      after: stem + ". Мы познакомились в школе.", added: "Мы познакомились в школе.",
      why: "Adds where you met; choose this only if it fits your story." });
    choices.push({ id: "when-met", kind: "when", label: "Мы знакомы уже три года.",
      after: stem + ". Мы знакомы уже три года.", added: "Мы знакомы уже три года.",
      why: "Adds how long you have known each other." });
  }
  for (const [id, label, detail, why] of catalog[stem] ?? []) {
    let after: string, added: string;
    if (id === "why") {
      after = stem + ", потому что " + detail + ".";
      added = "потому что " + detail;
    } else if (id === "therefore" || id === "contrast") {
      after = stem + ". " + label + " " + detail + ".";
      added = label + " " + detail;
    } else if (id === "example") {
      after = stem + ". Например, " + lowerInitial(detail);
      added = "Например, " + detail;
    } else {
      after = stem + " " + detail + ".";
      added = detail;
    }
    choices.push({
      id,
      label:
        id === "why"
          ? label + " " + detail
          : id === "example" || id === "therefore" || id === "contrast"
            ? label + ": " + detail
            : label,
      kind: id,
      after,
      added,
      why,
    });
  }
  return choices;
}

export function shuffleTiles(count: number, seed: number): number[] {
  const ids = Array.from({ length: count }, (_, i) => i);
  let value = (seed || 1) >>> 0;
  for (let i = count - 1; i > 0; i--) {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    const j = value % (i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}

function lowerInitial(text: string) {
  return /^(Я|Мы|Он|Она|Они|Ты|Вы|Мне|Мой|Моя|Мою|Мои|Моё|В|На|После|По|К|У|Рядом|Сначала|Это|Ещё|Здесь|Там|Наша|Наш|Наши|Мне|Он|Она|Вчера|Сегодня|Завтра)(?=\s|$)/u.test(
    text,
  )
    ? text[0].toLocaleLowerCase("ru") + text.slice(1)
    : text;
}

/** Display-only diff; does not change saved wording or evaluate grammar. */
export function sentenceGrowth(base: string, expanded: string) {
  if (base === expanded) return { before: base, added: "", after: "" };
  const original = base.match(/\S+\s*/gu) ?? [];
  const result = expanded.match(/\S+\s*/gu) ?? [];
  const comparable = (word: string) => normalizeRussian(word);
  let prefix = 0, suffix = 0;
  while (prefix < original.length && prefix < result.length &&
    comparable(original[prefix]) === comparable(result[prefix])) prefix++;
  while (suffix < original.length - prefix && suffix < result.length - prefix &&
    comparable(original[original.length - suffix - 1]) === comparable(result[result.length - suffix - 1])) suffix++;
  return {
    before: result.slice(0, prefix).join(""),
    added: result.slice(prefix, result.length - suffix).join(""),
    after: suffix ? result.slice(result.length - suffix).join("") : "",
  };
}
