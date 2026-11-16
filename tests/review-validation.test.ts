import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { reviewRussian } from "../src/lib/ai/correction-engine";
import { safeUnit, mayBuild, type AnalysisUnit } from "../src/lib/learning-engine";
import { approveReviewedModels, emptyMission } from "../src/lib/quest-state";

function candidate(patch: Partial<AnalysisUnit> = {}): AnalysisUnit {
  return {
    id: "friend", original: "У меня есть подруга, зовут Тилли.",
    corrected: "У меня есть подруга, её зовут Тилли.",
    intendedMeaning: "I have a friend named Tilly.",
    changes: [{before: "зовут", after: "её зовут", explanation: "Use её to say her name."}],
    confidence: 0.8, needsClarification: false, question: "", options: [], unresolved: [],
    tiles: [
      {text: "У меня", role: "preposition"}, {text: "есть", role: "verb"},
      {text: "подруга", role: "subject"}, {text: "её", role: "complement"},
      {text: "зовут", role: "verb"}, {text: "Тилли", role: "complement"},
    ], review: "unreviewed", approved: false, assessment: "correction", ...patch,
  };
}
function mockProvider(t: TestContext, units: AnalysisUnit[], accepted = true) {
  const inputs: Record<string, unknown>[] = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    const input = JSON.parse(body.input);
    inputs.push(input);
    const data = body.text.format.name === "russian_analysis" ? { units } : {
      verdicts: (input.sentences as {id: string}[]).map(({id}) => ({
        id, accepted, agreementCorrect: accepted, meaningPreserved: accepted,
        explanation: accepted ? "Grammar and meaning checked." : "The intended event is not clear; clarify what happened.",
      })),
    };
    return Response.json({status: "completed", output: [{type: "message", content: [{type: "output_text", text: JSON.stringify(data)}]}]});
  });
  return inputs;
}
test("low self-confidence does not silently skip an independent review of a clear correction", async (t) => {
  const u = candidate();
  const inputs = mockProvider(t, [u]);
  const result = await reviewRussian(u.original, true);
  assert.equal(inputs.length, 2);
  assert.equal(safeUnit(result.data.units[0]), true);
  assert.equal(result.data.units[0].approved, false);
  const m = emptyMission();
  m.stage = 1; m.completed = [0]; m.approvedTranscript = u.original;
  m.engine.analysisTranscript = u.original;
  m.engine.units = result.data.units.map(v => ({...v, approved: true}));
  assert.equal(approveReviewedModels(m).stage, 2);
});
test("failed independent review stays blocked and explains why", async (t) => {
  const u = candidate(); mockProvider(t, [u], false);
  const result = await reviewRussian(u.original, true);
  assert.equal(safeUnit(result.data.units[0]), false);
  assert.match(result.data.units[0].unresolved[0], /clarify/);
});
test("ambiguity in one unit does not stop another unit from being checked", async (t) => {
  const clear = candidate();
  const unclear = candidate({id: "unclear", needsClarification: true, question: "Who puts it there?", changes: [], original: "она положит они"});
  const text = clear.original + " " + unclear.original;
  const inputs = mockProvider(t, [clear, unclear]);
  const result = await reviewRussian(text, true);
  assert.equal((inputs[1].sentences as unknown[]).length, 1);
  assert.equal(safeUnit(result.data.units[0]), true);
  assert.equal(mayBuild(result.data.units[1]), false);
  assert.match(result.data.units[1].unresolved[0], /Who puts/);
});
test("edit validation preserves exact edit and sends semantic clarification plus full transcript context", async (t) => {
  const u = candidate();
  const inputs = mockProvider(t, [u]);
  const edited = "  у меня есть подруга, её зовут Тилли!\n";
  const context = u.original + " Она моя соседка.";
  const meaning = "I have a friend named Tilly.";
  const result = await reviewRussian(u.original, true, meaning, edited, "My friends", context);
  assert.equal(inputs[0].confirmedMeaning, meaning);
  assert.equal(inputs[0].transcriptContext, context);
  assert.equal(inputs[0].edited, edited);
  assert.equal(result.data.units[0].corrected, edited);
  assert.equal(result.data.units[0].original, u.original);
  assert.equal(safeUnit(result.data.units[0]), true);
});
test("a replacement differing in actual words is not certified as the student's exact edit", async (t) => {
  const u = candidate(); mockProvider(t, [u]);
  const result = await reviewRussian(u.original, true, u.intendedMeaning, "Я живу в Москве.");
  assert.equal(safeUnit(result.data.units[0]), false);
  assert.match(result.data.units[0].unresolved[0], /exact edit was not validated/);
});
