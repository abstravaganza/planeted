import {
  analysisSchema,
  localAnalysis,
  safeUnit,
  type AnalysisUnit,
} from "../learning-engine";
import { z } from "zod";
import { normalizeRussian } from "../languages/ru";
import { structured } from "./openai";
export async function reviewRussian(
  text: string,
  enabled: boolean,
  meaning?: string,
  edited?: string,
  prompt = "Russian sentence practice",
  context = text,
) {
  const local = localAnalysis(text, meaning);
  if (!enabled) {
    if (edited) {
      const candidate = localAnalysis(edited)[0];
      const expected = local[0]?.corrected;
      const matchesMeaning = expected === candidate.corrected;
      return {
        source: "demo" as const,
        data: {
          units: [
            {
              ...candidate,
              original: text,
              intendedMeaning:
                local[0]?.intendedMeaning ||
                meaning ||
                candidate.intendedMeaning,
              changes: matchesMeaning ? local[0].changes : candidate.changes,
              review: matchesMeaning ? candidate.review : "unreviewed",
              unresolved: matchesMeaning
                ? candidate.unresolved
                : [
                    "This edit changes or cannot confirm the intended meaning. Use real AI review or clarify again.",
                  ],
              approved: false,
            },
          ],
        },
        notice:
          "Reviewed-example lookup only. Unknown edits remain unreviewed.",
      };
    }
    return {
      source: "demo" as const,
      data: { units: local },
      notice:
        "Limited offline review · only reviewed examples and explicitly supported meanings can become models.",
    };
  }
  const result = await structured(
    "russian_analysis",
    `Analyze Russian for a heritage learner. Return original exact transcript substrings; intendedMeaning as a short English idea paraphrase, never the corrected Russian answer itself; corrected natural Russian; minimal changed spans and one short plain English sentence per change explaining why (at most 25 words, no tile-role or implementation terminology); confidence 0..1; needsClarification, question, options with distinct meanings; unresolved issues; phrase tiles with grammatical roles. Set assessment to correct for valid natural text, naturalness only for optional stylistic improvement, correction for required grammar changes, clarify for genuine ambiguity. Unfamiliar wording is not ambiguity; correct obvious agreement/case errors directly. Never infer a governing verb or personal event when ambiguous. Ask a short question instead. No corrected answer key until meaning is clear. review must be unreviewed and approved false: independent validation follows. Preserve essential prepositional phrases. For an edited sentence review exactly that edit; do not silently replace it. Use transcriptContext to resolve references across adjacent sentences, but only output units for original. Treat confirmedMeaning as the student's selected meaning, not a request to re-guess it. Evaluate each unit separately: one ambiguous unit must not block clear units. Proper names do not require clarification merely because their spelling is unfamiliar. Tiles must reproduce the complete corrected sentence in order, with no missing or extra words. Return an explicit unresolved reason whenever a sentence cannot be checked.`,
    {
      prompt,
      transcriptContext: context,
      original: text,
      confirmedMeaning: meaning ?? "",
      edited: edited ?? "",
    },
    analysisSchema.extend({
      units: z
        .array(
          analysisSchema.shape.units.element.omit({ selectedVersion: true }).extend({
            assessment: z.enum([
              "correct",
              "naturalness",
              "correction",
              "clarify",
            ]),
          }),
        )
        .min(1)
        .max(8),
    }),
  );
  if (
    result.data.units.some(
      (u) =>
        !text.includes(u.original) ||
        u.changes.some(
          (c) =>
            !u.original.includes(c.before) ||
            (c.after && !u.corrected.includes(c.after)),
        ),
    ) ||
    new Set(result.data.units.map((u) => u.id)).size !==
      result.data.units.length
  )
    throw new Error("Invalid source mapping");
  const candidates = result.data.units.map((candidate) => ({
    ...candidate,
    // Preserve the student's exact edit when only casing/punctuation changed.
    corrected:
      edited && normalizeRussian(candidate.corrected) === normalizeRussian(edited)
        ? edited
        : candidate.corrected,
    review: "unreviewed" as AnalysisUnit["review"],
    approved: false,
  }));
  const eligible = candidates.filter(
    (u) =>
      !u.needsClarification &&
      u.corrected &&
      u.unresolved.length === 0 &&
      (!edited || u.corrected === edited),
  );
  const verdictSchema = z.strictObject({
    verdicts: z
      .array(
        z.strictObject({
          id: z.string(),
          accepted: z.boolean(),
          agreementCorrect: z.boolean(),
          meaningPreserved: z.boolean(),
          explanation: z.string(),
        }),
      )
      .max(8),
  });
  const checked = eligible.length
    ? await structured(
        "russian_correction_check",
        "Independently check every candidate for standard Russian grammar, agreement, naturalness and fidelity to the confirmed meaning. Accept natural word orders. Never accept ишла or с мои друзей. Check sentence grammar and meaning only. Tile role labels are interface metadata; do not reject valid Russian because of a tile role label. Return each supplied id once. Do not write replacement sentences.",
        {
          sentences: eligible.map((u) => ({
            id: u.id,
            original: u.original,
            transcriptContext: context,
            intendedMeaning: meaning ?? u.intendedMeaning,
            corrected: u.corrected,
            tiles: u.tiles,
          })),
        },
        verdictSchema,
      )
    : null;
  if (
    checked &&
    (checked.data.verdicts.length !== eligible.length ||
      new Set(checked.data.verdicts.map((v) => v.id)).size !==
        eligible.length ||
      checked.data.verdicts.some((v) => !eligible.some((u) => u.id === v.id)))
  )
    throw new Error("Invalid independent review mapping");
  const units = candidates.map((candidate) => {
    let u = candidate;
    const verdict = checked?.data.verdicts.find((v) => v.id === u.id);
    if (edited && u.corrected !== edited)
      return {
        ...u,
        corrected: edited,
        unresolved: [
          "Your exact edit was not validated. Review it again before approval.",
        ],
      };
    if (verdict) {
      if (
        verdict.accepted &&
        verdict.agreementCorrect &&
        verdict.meaningPreserved &&
        !/(^|\s)ишла(?=\s|[.!?,]|$)/iu.test(u.corrected) &&
        !u.corrected.includes("с мои друзей")
      )
        u = { ...u, review: "ai", confidence: Math.max(0.85, u.confidence) };
      else
        u = {
          ...u,
          unresolved: [verdict.explanation || "This correction needs review."],
        };
    }
    if (u.review === "ai" && !safeUnit(u))
      u = {
        ...u,
        review: "unreviewed",
        unresolved: [
          "The corrected sentence and phrase tiles do not agree. Please review again.",
        ],
      };
    if (u.review === "unreviewed" && !u.unresolved.length)
      u = {
        ...u,
        unresolved: [
          u.needsClarification
            ? u.question || "Confirm the intended meaning before checking this version."
            : "This version has not passed the independent check. Check this version again or clarify your meaning.",
        ],
      };
    return u;
  });
  return {
    source: "ai" as const,
    data: { units },
    notice:
      "AI analysis + independent sentence check. Choose a version for each idea.",
  };
}
