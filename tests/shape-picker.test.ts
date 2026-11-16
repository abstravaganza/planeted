import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReviewStage } from "../src/components/review-stage";
import { localAnalysis, canPractice, practiceUnits, safeUnit } from "../src/lib/learning-engine";
import { emptyQuest, recoverQuest, approveReviewedModels } from "../src/lib/quest-state";
import { speechIssues } from "../src/lib/tap-grammar";

function mission() {
  const q = emptyQuest();
  const m = q.missions.sports;
  m.stage = 1; m.completed = [0];
  const u = localAnalysis("Я играю в теннис с подругами.")[0];
  u.original = "Я играю в теннис с мои друзья.";
  u.corrected = "Я играю в теннис с моими друзьями.";
  u.changes = [{before: "с мои друзья", after: "с моими друзьями", explanation: "After с meaning with, use instrumental forms: моими друзьями."}];
  u.tiles = [{text: "Я", role: "subject"}, {text: "играю", role: "verb"}, {text: "в теннис", role: "preposition"}, {text: "с моими друзьями", role: "preposition"}];
  u.review = "ai"; u.assessment = "correction";
  m.transcript = u.original; m.approvedTranscript = u.original;
  m.engine.analysisTranscript = u.original; m.engine.units = [u];
  return q;
}
test("version picker has two selectable cards and WHY without old validation controls", () => {
  const q = mission();
  const html = renderToStaticMarkup(createElement(ReviewStage, { state:q.missions.sports, missionId:"sports", mode:"ai", update:()=>{} }));
  assert.match(html, /Your Version/); assert.match(html, /You can do Better/);
  assert.match(html, /WHY\?/); assert.match(html, /After с meaning with/);
  for (const removed of ["Check this version", "Yes, that", "Not quite", "Edit it myself", "Validate my edit"])
    assert.ok(!html.includes(removed));
  assert.match(html, /aria-pressed="false"/);
});
test("choosing original advances as a draft without changing grammar evidence or final writing", () => {
  const q = mission(), m = q.missions.sports, u = m.engine.units[0];
  m.original = "  Exact final writing.\n"; m.revision = "Separate revision.\n";
  const evidence = JSON.stringify({original:u.original, corrected:u.corrected, changes:u.changes});
  u.selectedVersion = "original"; u.approved = true;
  assert.equal(canPractice(u), true);
  assert.equal(practiceUnits(m.engine)[0].practiceDraft, true);
  const next = approveReviewedModels(m);
  assert.equal(next.stage, 2);
  assert.equal(next.generation?.sentences[0].text, u.original);
  assert.equal(next.generation?.sentences[0].choice, "original");
  assert.equal(next.generation?.sentences[0].review, "unreviewed");
  assert.equal(speechIssues(next.engine.units)[0].concept, "with");
  assert.equal(JSON.stringify({original:u.original, corrected:u.corrected, changes:u.changes}), evidence);
  q.missions.sports = next;
  const restored = recoverQuest(JSON.parse(JSON.stringify(q))).missions.sports;
  assert.equal(restored.stage, 2); assert.equal(restored.engine.units[0].selectedVersion, "original");
  assert.equal(restored.original, "  Exact final writing.\n"); assert.equal(restored.revision, "Separate revision.\n");
});
test("choosing suggestion uses corrected tiles while retaining original speech for grammar", () => {
  const q = mission(), m = q.missions.sports, u = m.engine.units[0];
  u.selectedVersion = "suggestion"; u.approved = true;
  assert.equal(safeUnit(u), true);
  assert.equal(practiceUnits(m.engine)[0].practiceDraft, false);
  assert.equal(approveReviewedModels(m).generation?.sentences[0].text, u.corrected);
  assert.equal(speechIssues([u])[0].context, u.original);
});
test("an unresolved suggestion can be chosen but is never certified as correct", () => {
  const q = mission(), m = q.missions.sports, u = m.engine.units[0];
  u.review = "unreviewed"; u.unresolved = ["Provider check incomplete"];
  u.selectedVersion = "suggestion"; u.approved = true;
  assert.equal(canPractice(u), true); assert.equal(safeUnit(u), false);
  assert.equal(practiceUnits(m.engine)[0].practiceDraft, true);
  assert.equal(approveReviewedModels(m).stage, 2);
  assert.deepEqual(speechIssues([u]), []);
});
test("an unselected idea blocks continuation, old reviewed approvals retain compatibility", () => {
  const q = mission(), m = q.missions.sports;
  assert.equal(approveReviewedModels(m).stage, 1);
  m.engine.units[0].approved = true;
  assert.equal(approveReviewedModels(m).stage, 2);
});
