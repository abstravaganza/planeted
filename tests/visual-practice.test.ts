import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { sentenceGrowth, contextualChoices } from "../src/lib/languages/ru-quest";
import { localAnalysis, practiceUnits, safeUnit } from "../src/lib/learning-engine";
import { emptyMission } from "../src/lib/quest-state";
import { TapGrammar } from "../src/components/tap-grammar";

for (const [base, expanded, added] of [
  ["Я играю в теннис.", "После школы я играю в теннис.", "После школы"],
  ["Мне нравится общаться с ней.", "Мне нравится общаться с ней, потому что она меня понимает.", "потому что она меня понимает"],
  ["Мою подругу зовут Аня.", "Мою подругу зовут Аня. Мы познакомились в школе.", "Мы познакомились в школе"],
]) test(`sentence growth highlights added meaning: ${added}`, () => {
  const parts = sentenceGrowth(base, expanded);
  assert.equal(parts.before + parts.added + parts.after, expanded);
  assert.ok(parts.added.includes(added));
});
test("no new detail produces no highlight", () => {
  assert.deepEqual(sentenceGrowth("Я гуляю.", "Я гуляю."), {before:"Я гуляю.",added:"",after:""});
});
test("three friend sentences have distinct, context-matched detail choices", () => {
  const rows = ["Мою подругу зовут Аня.", "Она умеет внимательно слушать.", "Мне нравится общаться с ней."];
  const choices = rows.map(s => contextualChoices(s));
  assert.ok(choices.every(c => c.length > 0));
  assert.match(choices[0][0].after, /познакомились/);
  assert.match(choices[1][0].after, /Поэтому/);
  assert.match(choices[2][0].after, /потому что/);
  choices.forEach((c,i) => assert.ok(c.every(v => v.after.startsWith(rows[i].replace(/\.$/, "")))));
});
test("draft tiles keep visual role cues without changing review or original wording", () => {
  const m = emptyMission();
  const u = localAnalysis("Я играю в теннис с подругами.")[0];
  u.review = "unreviewed"; u.approved=true; u.selectedVersion="original";
  m.engine.units = [u];
  const p = practiceUnits(m.engine)[0];
  assert.equal(p.practiceDraft, true); assert.equal(safeUnit(u), false);
  assert.equal(p.tiles.find(t=>t.text === "играю")?.role, "verb");
  assert.equal(p.tiles.find(t=>t.text === "с")?.role, "preposition");
  assert.equal(p.tiles.find(t=>t.text === "Я")?.role, "subject");
  assert.equal(u.original, "Я играю в теннис с подругами.");
});
test("detective has illustrated See the rule and changes palette across tasks", () => {
  const m=emptyMission();
  const render=()=>renderToStaticMarkup(createElement(TapGrammar,{state:m,update:()=>{},onComplete:()=>{},sound:false}));
  const first=render(); assert.match(first,/See the rule/); assert.ok(!first.includes("See the pattern"));
  assert.match(first,/q-rule-illustration/); assert.match(first,/q-detective-palette-0/);
  m.engine.tap.sessions.with={round:0,index:1,selections:{},targetFound:false,correct:false,attempts:0,mistakes:0,completed:[],message:"",hint:false,done:false};
  assert.match(render(),/q-detective-palette-1/);
});
