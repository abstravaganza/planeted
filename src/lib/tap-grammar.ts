import { grammarLessons } from "./grammar-game";
import { safeUnit, type AnalysisUnit } from "./learning-engine";
import { patterns } from "./corrections";
import type { Concept, TapSession } from "./tap-contracts";
export type TapOption = {
  id: string;
  label: string;
  correct: boolean;
  why: string;
};
export type TapItem = {
  id: string;
  kind: "bubbles" | "message" | "pairs";
  context?: string;
  prompt: string;
  hint: string;
  options: TapOption[];
  slots?: { label: string; options: TapOption[] }[];
};
const o = (
  id: string,
  label: string,
  correct: boolean,
  why: string,
): TapOption => ({ id, label, correct, why });
export const conceptRules = {
  ...grammarLessons,
  time: {
    title: "When it happens",
    rule: "Use по субботам for a recurring Saturday activity and на выходных for an activity during the weekend. The phrase depends on the meaning.",
    chart: [
      { label: "Every Saturday", before: "суббота", after: "по субботам" },
      { label: "During the weekend", before: "выходные", after: "на выходных" },
      { label: "On one Saturday", before: "суббота", after: "в субботу" },
    ],
  },
};
const extra: Record<Concept, TapItem[]> = {
  with: [
    {
      id: "with-pair",
      kind: "pairs",
      prompt: "Я разговариваю с…",
      hint: "Match feminine instrumental in BOTH words.",
      options: [],
      slots: [
        {
          label: "Describing word",
          options: [
            o("base", "моя", false, "Моя is the basic form."),
            o("right", "моей", true, "Моя changes to моей after с."),
            o("masc", "моим", false, "The noun here is feminine."),
          ],
        },
        {
          label: "Noun",
          options: [
            o("base", "сестра", false, "The noun also needs instrumental."),
            o("right", "сестрой", true, "Сестра changes to сестрой."),
            o(
              "gen",
              "сестры",
              false,
              "That is not the instrumental form here.",
            ),
          ],
        },
      ],
    },
    {
      id: "with-new",
      kind: "message",
      prompt: "После школы я гуляю ___.",
      hint: "With more than one friend, both endings are plural instrumental.",
      options: [
        o(
          "bad",
          "с мои друзья",
          false,
          "Both words need instrumental endings.",
        ),
        o(
          "right",
          "с моими друзьями",
          true,
          "Мои → моими and друзья → друзьями.",
        ),
        o("half", "с моими друзья", false, "The noun needs to change too."),
      ],
    },
  ],
  after: [
    {
      id: "after-pair",
      kind: "pairs",
      prompt: "We meet after training.",
      hint: "После requires genitive; тренировка changes to тренировки.",
      options: [],
      slots: [
        {
          label: "Relationship",
          options: [
            o("right", "после", true, "После means after."),
            o("with", "с", false, "С means with here, not after."),
          ],
        },
        {
          label: "Noun",
          options: [
            o("base", "тренировка", false, "Use the genitive after после."),
            o("right", "тренировки", true, "Тренировка → тренировки."),
            o(
              "instr",
              "тренировкой",
              false,
              "That is instrumental, not genitive.",
            ),
          ],
        },
      ],
    },
    {
      id: "after-new",
      kind: "message",
      prompt: "Я отдыхаю после ___.",
      hint: "After work: работа changes to работы.",
      options: [
        o("base", "работа", false, "The basic form does not fit after после."),
        o("right", "работы", true, "Работа → работы after после."),
        o(
          "instr",
          "работой",
          false,
          "После requires genitive, not instrumental.",
        ),
      ],
    },
  ],
  because: [
    {
      id: "because-pair",
      kind: "pairs",
      prompt: "Я люблю рисовать…",
      hint: "Choose a reason connector and a complete reason.",
      options: [],
      slots: [
        {
          label: "Connector",
          options: [
            o(
              "right",
              ", потому что",
              true,
              "Потому что introduces the reason.",
            ),
            o(
              "then",
              ", после этого",
              false,
              "That describes sequence rather than a reason.",
            ),
          ],
        },
        {
          label: "Reason",
          options: [
            o(
              "fragment",
              "красивый",
              false,
              "An adjective alone is not a complete reason.",
            ),
            o(
              "right",
              "это помогает мне отдыхать",
              true,
              "This explains what drawing does for you.",
            ),
          ],
        },
      ],
    },
    {
      id: "because-new",
      kind: "message",
      prompt: "Я люблю музыку, ___.",
      hint: "The reason needs a complete thought.",
      options: [
        o(
          "bad",
          "потому что весёлый",
          false,
          "An isolated adjective does not finish this reason.",
        ),
        o(
          "right",
          "потому что она помогает мне отдыхать",
          true,
          "Она помогает мне отдыхать is a complete reason.",
        ),
      ],
    },
  ],
  time: [
    {
      id: "time-saturday",
      kind: "bubbles",
      prompt: "Мы обычно встречаемся ___.",
      hint: "The activity repeats on Saturdays.",
      options: [
        o(
          "bad",
          "на суббота",
          false,
          "That combination does not express recurring Saturdays.",
        ),
        o(
          "right",
          "по субботам",
          true,
          "По субботам means on Saturdays, repeatedly.",
        ),
        o(
          "week",
          "на выходные",
          false,
          "That does not express this recurring Saturday activity.",
        ),
      ],
    },
    {
      id: "time-weekend",
      kind: "message",
      context: "An activity during the weekend",
      prompt: "Я гуляю ___.",
      hint: "For an activity during the weekend, use the prepositional form.",
      options: [
        o(
          "bad",
          "на выходные",
          false,
          "На выходные can describe a destination/duration for the weekend; here the activity takes place during it.",
        ),
        o(
          "right",
          "на выходных",
          true,
          "На выходных fits an activity during the weekend.",
        ),
      ],
    },
    {
      id: "time-pair",
      kind: "pairs",
      prompt: "We play every Saturday.",
      hint: "Use по + the plural time expression.",
      options: [],
      slots: [
        {
          label: "Preposition",
          options: [
            o("right", "по", true, "По is used for recurring days here."),
            o(
              "at",
              "на",
              false,
              "На does not fit this recurring-day expression.",
            ),
          ],
        },
        {
          label: "Day",
          options: [
            o(
              "base",
              "суббота",
              false,
              "The basic form does not fit after по here.",
            ),
            o(
              "right",
              "субботам",
              true,
              "По субботам describes a recurring activity.",
            ),
          ],
        },
      ],
    },
    {
      id: "time-once",
      kind: "bubbles",
      context: "One particular Saturday",
      prompt: "Мы ходили в музей ___.",
      hint: "For one named Saturday, use в субботу.",
      options: [
        o("right", "в субботу", true, "В субботу names one Saturday."),
        o(
          "bad",
          "на суббота",
          false,
          "Use в with the accusative form субботу.",
        ),
        o(
          "repeat",
          "по субботам",
          false,
          "That means recurring Saturdays; this prompt is about one day.",
        ),
      ],
    },
  ],
};
export function tapItems(concept: Concept, round = 0): TapItem[] {
  const base =
    concept === "time"
      ? []
      : grammarLessons[concept].items.map((v, i) => ({
          ...v,
          id: `${concept}-${v.id}`,
          kind: (i % 2 && v.prompt.includes("___")
            ? "message"
            : "bubbles") as TapItem["kind"],
        }));
  const all = [...base, ...extra[concept]];
  const offset = round % all.length;
  return [...all.slice(offset), ...all.slice(0, offset)];
}
export function checkTap(item: TapItem, selections: Record<string, string>) {
  if (item.kind === "pairs") {
    for (const [i, slot] of (item.slots ?? []).entries()) {
      const chosen = slot.options.find((v) => v.id === selections[String(i)]);
      if (!chosen)
        return {
          correct: false,
          message: `Choose ${slot.label.toLowerCase()} first.`,
        };
      if (!chosen.correct) return { correct: false, message: chosen.why };
    }
    return {
      correct: true,
      message: item
        .slots!.map(
          (s, i) => s.options.find((v) => v.id === selections[String(i)])!.why,
        )
        .join(" "),
    };
  }
  const chosen = item.options.find((v) => v.id === selections.answer);
  return {
    correct: Boolean(chosen?.correct),
    message: chosen?.why ?? "Tap an answer first.",
  };
}
export type SpeechIssue = {
  concept: Concept;
  original: string;
  corrected: string;
  context: string;
  unitId: string;
  source: "ai" | "curated";
  explanation: string;
};
/** Supported mappings require reviewed evidence, never a guess from unreviewed speech. */
export function speechIssues(units: AnalysisUnit[]): SpeechIssue[] {
  const result: SpeechIssue[] = [];
  for (const u of units) {
    if (!safeUnit(u) || !u.approved || u.id.startsWith("example-")) continue;
    for (const c of u.changes) {
      if (
        !u.original.includes(c.before) ||
        !u.corrected.includes(c.after) ||
        c.before === c.after
      )
        continue;
      let concept: Concept | undefined;
      for (const p of patterns) {
        if (
          p.supportedEdits.some(
            ([bad, good]) =>
              u.original.includes(bad) &&
              u.corrected.includes(good) &&
              ((c.before.includes(bad) && c.after.includes(good)) ||
                (bad.includes(c.before) &&
                  good.includes(c.after) &&
                  Boolean(c.before) &&
                  Boolean(c.after))),
          )
        )
          concept = p.id;
      }
      const provesPair = (before: string, after: string) =>
        u.original.includes(before) &&
        u.corrected.includes(after) &&
        ((c.before.includes(before) && c.after.includes(after)) ||
          (Boolean(c.before) &&
            Boolean(c.after) &&
            before.includes(c.before) &&
            after.includes(c.after)));
      if (
        [
          ["с мои друзья", "с моими друзьями"],
          ["с мои друзей", "с моими друзьями"],
          ["с мой братом", "с моим братом"],
        ].some(([before, after]) => provesPair(before, after))
      )
        concept = "with";
      if (
        [
          ["на суббота", "по субботам"],
          ["на выходные", "на выходных"],
        ].some(([before, after]) => provesPair(before, after))
      )
        concept = "time";
      if (concept)
        result.push({
          concept,
          original: c.before,
          corrected: c.after,
          context: u.original,
          unitId: u.id,
          source: u.review as "ai" | "curated",
          explanation: c.explanation,
        });
    }
  }
  return result;
}
export function suggestedConcept(
  issues: SpeechIssue[],
  sessions: Partial<Record<Concept, TapSession>>,
  needs: Concept[] = [],
): Concept {
  const candidates = [...new Set([...issues.map((i) => i.concept), ...needs])];
  if (!candidates.length) return "with";
  return candidates.sort(
    (a, b) => (sessions[b]?.mistakes ?? 0) - (sessions[a]?.mistakes ?? 0),
  )[0];
}

export function practiceItems(
  concept: Concept,
  round: number,
  issues: SpeechIssue[],
): TapItem[] {
  const personal = issues
    .filter((i) => i.concept === concept)
    .map(
      (issue): TapItem => ({
        id: `speech:${issue.unitId}:${issue.original}:${issue.corrected}`,
        kind: "message",
        prompt: issue.context.replace(issue.original, "___"),
        hint: conceptRules[concept].rule,
        options: [
          {
            id: "original",
            label: issue.original,
            correct: false,
            why: conceptRules[concept].rule,
          },
          {
            id: "repair",
            label: issue.corrected,
            correct: true,
            why: issue.explanation,
          },
        ],
      }),
    );
  return [...personal, ...tapItems(concept, round)];
}
