import { z } from "zod";
import { answerReviewSchema } from "./answer-review";
import { tapStateSchema } from "./tap-contracts";
import reviewedModels from "../content/reviewed-models.json";
import { tileRole } from "./languages/ru-quest";
import { normalizeRussian } from "./languages/ru";
export const modelTileSchema = z.strictObject({
  text: z.string().min(1).max(300),
  role: z.enum(["subject", "verb", "complement", "preposition", "time"]),
});
export const analysisUnitSchema = z.strictObject({
  id: z.string().max(100),
  original: z.string().min(1).max(1500),
  intendedMeaning: z.string().max(1500),
  corrected: z.string().max(1500),
  changes: z
    .array(
      z.strictObject({
        before: z.string().max(500),
        after: z.string().max(500),
        explanation: z.string().max(700),
      }),
    )
    .max(8),
  confidence: z.number().min(0).max(1),
  needsClarification: z.boolean(),
  question: z.string().max(700),
  options: z
    .array(
      z.strictObject({
        id: z.string().max(100),
        meaning: z.string().max(1000),
      }),
    )
    .max(4),
  unresolved: z.array(z.string().max(700)).max(8),
  tiles: z.array(modelTileSchema).max(40),
  review: z.enum(["unreviewed", "curated", "ai"]),
  approved: z.boolean(),
  selectedVersion: z.enum(["original", "suggestion"]).optional(),
  assessment: z
    .enum(["correct", "naturalness", "correction", "clarify"])
    .optional(),
});
export const analysisSchema = z.strictObject({
  units: z.array(analysisUnitSchema).min(1).max(8),
});
export type AnalysisUnit = z.infer<typeof analysisUnitSchema>;
export const engineSchema = z.strictObject({
  tap: tapStateSchema.default(() => tapStateSchema.parse({})),
  hintCount: z.number().nonnegative().default(0),
  reviewDrafts: z
    .record(
      z.string(),
      z.strictObject({
        edited: z.string().max(1500),
        meaning: z.string().max(1500),
      }),
    )
    .default({}),
  clarificationTranscripts: z
    .array(
      z.strictObject({
        unitId: z.string(),
        text: z.string().max(8000),
        recordingId: z.string(),
        createdAt: z.number(),
      }),
    )
    .default([]),
  rawTranscripts: z
    .array(
      z.strictObject({
        text: z.string().max(8000),
        recordingId: z.string(),
        createdAt: z.number(),
      }),
    )
    .default([]),
  analysisTranscript: z.string().default(""),
  units: z.array(analysisUnitSchema).default([]),
  build: z
    .record(
      z.string(),
      z.strictObject({
        level: z.number().int().min(1).max(3),
        orders: z.record(z.string(), z.array(z.number().int().nonnegative())),
        completed: z.array(z.number()),
        assistedLevels: z.array(z.number()).default([]),
        attempts: z.number(),
        recall: z.string().max(1500),
        answerReview: answerReviewSchema.optional(),
        message: z.string(),
        hint: z.boolean(),
      }),
    )
    .default({}),
  grammar: z
    .record(
      z.string(),
      z.strictObject({
        taught: z.boolean(),
        example: z.number(),
        index: z.number(),
        answers: z.array(z.string()),
        attempts: z.number(),
        message: z.string(),
        hint: z.boolean(),
        done: z.boolean(),
        skipped: z.boolean(),
        transfer: z.string().max(1500),
        transferReview: z.enum(["draft", "curated", "ai"]),
        transferAccepted: z.boolean(),
        supportUsed: z.boolean().default(false),
        answerReview: answerReviewSchema.optional(),
      }),
    )
    .default({}),
  expansion: z
    .record(
      z.string(),
      z.strictObject({
        question: z.string(),
        draft: z.string().max(1500),
        reviewed: z.string().max(1500),
        source: z.enum(["draft", "curated", "ai"]),
        examplePractice: z.boolean().optional(),
        answerReview: answerReviewSchema.optional(),
      }),
    )
    .default({}),
  targetedPattern: z
    .enum(["with", "after", "because"])
    .nullable()
    .default(null),
  story: z
    .strictObject({
      order: z.array(z.number()),
      connector: z.string(),
      detail: z.string().max(1500),
      checked: z.boolean(),
      attempts: z.number(),
      message: z.string(),
      hint: z.boolean(),
    })
    .default({
      order: [2, 0, 1],
      connector: "",
      detail: "",
      checked: false,
      attempts: 0,
      message: "",
      hint: false,
    }),
  bossMode: z.enum(["chaos", "quiet", "exam"]).default("chaos"),
  reviewNeeded: z.array(z.enum(["with", "after", "because"])).default([]),
});
export type Engine = z.infer<typeof engineSchema>;
export const emptyEngine = () => engineSchema.parse({});
export const suppliedExample = "Вчера я ишла в теннис и я играла с мои друзей.";
const clarifications = [
  { id: "play", meaning: "I played tennis with my friends yesterday." },
  {
    id: "lesson",
    meaning: "I went to a tennis lesson, then played with friends.",
  },
];
const correctedMeanings: Record<string, string> = {
  play: "Вчера я играла в теннис с моими друзьями.",
  lesson: "Вчера я ходила на тренировку по теннису, а потом играла с друзьями.",
};
export function phraseTiles(text: string): z.infer<typeof modelTileSchema>[] {
  const words = text.replace(/[.!?]$/u, "").split(/\s+/u);
  const out: z.infer<typeof modelTileSchema>[] = [];
  const verbs = new Set([
    "играла",
    "играл",
    "играю",
    "ходила",
    "ходил",
    "гуляю",
    "гуляем",
    "встречаемся",
    "зовут",
    "нравится",
    "люблю",
    "живу",
    "есть",
    "умеет",
    "слушать",
    "находится",
    "обсуждаем",
    "хожу",
    "работать",
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
    "читаю",
    "рисую",
  ]);
  for (let i = 0; i < words.length; i++) {
    const w = normalizeRussian(words[i]);
    let role: z.infer<typeof modelTileSchema>["role"] = "complement",
      chunk = words[i];
    if (["я", "мы", "ты", "он", "она", "они", "вы"].includes(w))
      role = "subject";
    else if (verbs.has(w)) role = "verb";
    else if (
      [
        "вчера",
        "сегодня",
        "завтра",
        "сначала",
        "иногда",
        "часто",
        "утром",
      ].includes(w)
    )
      role = "time";
    else if (["после", "по"].includes(w) && i + 1 < words.length) {
      role = "time";
      chunk += " " + words[++i];
    } else if (["в", "на", "с", "со", "к", "из", "у"].includes(w)) {
      role = "preposition";
      if (i + 1 < words.length) chunk += " " + words[++i];
      while (
        i + 1 < words.length &&
        /^(моими|моей|моим|нашими|нашей|нашим)$/u.test(
          normalizeRussian(chunk.split(" ").at(-1)!),
        )
      )
        chunk += " " + words[++i];
    }
    out.push({ text: chunk, role });
  }
  return out;
}
export function knownReviewed(text: string) {
  return reviewedModels.find(
    (m) => normalizeRussian(m.text) === normalizeRussian(text),
  )?.text;
}
export function knownMeaning(text: string) {
  return (
    reviewedModels.find(
      (m) => normalizeRussian(m.text) === normalizeRussian(text),
    )?.meaning ?? ""
  );
}
export function safeUnit(u: AnalysisUnit) {
  return (
    !u.needsClarification &&
    u.corrected.trim().length > 0 &&
    u.confidence >= 0.85 &&
    u.unresolved.length === 0 &&
    u.review !== "unreviewed" &&
    u.tiles.length > 0 &&
    normalizeRussian(u.tiles.map((t) => t.text).join(" ")) ===
      normalizeRussian(u.corrected)
  );
}
export function mayBuild(u: AnalysisUnit) {
  return safeUnit(u) && u.approved && u.intendedMeaning.trim().length > 0;
}
/** Selection is a drafting choice, not a grammar verdict. Old approvals still work. */
export function canPractice(u: AnalysisUnit) {
  return u.approved && (Boolean(u.selectedVersion) || mayBuild(u));
}
export function selectedText(u: AnalysisUnit) {
  return u.selectedVersion === "original" ? u.original : u.corrected;
}
export function practiceUnits(engine: { units: AnalysisUnit[] }) {
  return engine.units.map((u) => {
    const text = selectedText(u);
    const draft = !safeUnit(u) ||
      (u.selectedVersion === "original" &&
        normalizeRussian(u.original) !== normalizeRussian(u.corrected));
    return {
      ...u,
      corrected: text,
      practiceDraft: draft,
      tiles: draft
        ? text.trim().replace(/[.!?]+$/u, "").split(/\s+/u).filter(Boolean).map((text) => ({ text, role: tileRole(text) === "detail" ? "complement" as const : tileRole(text) as "subject" | "verb" | "preposition" }))
        : u.tiles,
    };
  });
}
export function localAnalysis(text: string, meaning?: string): AnalysisUnit[] {
  const meaningId = clarifications.find(
    (c) =>
      c.id === meaning ||
      normalizeRussian(c.meaning) === normalizeRussian(meaning ?? ""),
  )?.id;
  return (text.match(/[^.!?\n]+[.!?]?/gu) ?? [])
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((original, i) => {
      const supplied =
        normalizeRussian(original) === normalizeRussian(suppliedExample);
      const choice =
        supplied && meaningId ? correctedMeanings[meaningId] : null;
      const known = choice ?? knownReviewed(original);
      return {
        id: `review-${i}`,
        original,
        intendedMeaning: choice
          ? clarifications.find((c) => c.id === meaningId)!.meaning
          : known
            ? knownMeaning(known)
            : "",
        corrected: known ?? "",
        changes: choice
          ? [
              {
                before: "ишла в теннис",
                after:
                  meaningId === "play"
                    ? "играла в теннис"
                    : "ходила на тренировку по теннису",
                explanation:
                  meaningId === "play"
                    ? "Играть в теннис means to play tennis."
                    : "Ходила на тренировку describes going to a lesson.",
              },
              {
                before: "с мои друзей",
                after: meaningId === "play" ? "с моими друзьями" : "с друзьями",
                explanation:
                  "With с meaning WITH, both the describing word and noun take instrumental endings.",
              },
            ]
          : [],
        confidence: known ? 1 : 0,
        needsClarification: supplied && !known,
        question: known
          ? ""
          : supplied
            ? "Did you play tennis, or go to a lesson before playing?"
            : "",
        options: !known && supplied ? clarifications : [],
        unresolved: known
          ? []
          : [
              supplied
                ? "The verb and instrumental phrase need correction after you clarify the meaning."
                : "Offline mode cannot establish a grammatically valid correction. Enable AI review, edit to a reviewed example, or choose reviewed example practice.",
            ],
        tiles: known
          ? (
              reviewedModels.find((m) => m.text === known)?.tiles ??
              phraseTiles(known)
            ).map((t) => modelTileSchema.parse(t))
          : [],
        review: known ? "curated" : "unreviewed",
        approved: false,
      };
    });
}
export const roleLegend = {
  subject: "Subject",
  verb: "Verb / predicate",
  complement: "Complement",
  preposition: "Preposition / phrase",
  time: "Time expression",
};
export function buildTiles(u: AnalysisUnit, level: number) {
  return level === 1
    ? u.tiles
    : u.tiles.flatMap((t) =>
        t.text.split(/\s+/u).map((text) => ({ text, role: t.role })),
      );
}
export function acceptedModelOrder(u: AnalysisUnit, text: string) {
  if (!safeUnit(u)) return false;
  const actual = normalizeRussian(text);
  const model = normalizeRussian(u.corrected);
  if (actual === model) return true;
  const alternatives: Record<string, string[]> = {
    [normalizeRussian(correctedMeanings.play)]: [
      "Я вчера играла в теннис с моими друзьями.",
      "Вчера с моими друзьями я играла в теннис.",
      "С моими друзьями я вчера играла в теннис.",
      "Я играла в теннис с моими друзьями вчера.",
    ],
    [normalizeRussian("Я играю в теннис с подругами.")]: [
      "С подругами я играю в теннис.",
      "Я с подругами играю в теннис.",
      "В теннис я играю с подругами.",
    ],
  };
  return (alternatives[model] ?? []).some(
    (t) => normalizeRussian(t) === actual,
  );
}
export function normalizeAnswer(text: string) {
  return normalizeRussian(text).trim();
}
export function feedbackObjectives() {
  return [
    "Prompt completion",
    "Communicative clarity",
    "Sentence construction",
    "Grammar control",
    "Organization",
    "Elaboration",
    "Independence from hints",
  ];
}

/** New analysis has new unit identities even when provider IDs repeat. Archive the previous engine before calling. */
export function replaceAnalysis(
  engine: Engine,
  transcript: string,
  units: AnalysisUnit[],
): Engine {
  return { ...engine, analysisTranscript: transcript, units, reviewDrafts: {} };
}
