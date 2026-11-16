import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/review/route";
import { reviewedBuilderMatch } from "../src/lib/builder-check";
import { localAnalysis, type AnalysisUnit } from "../src/lib/learning-engine";
import { reviewAccepted } from "../src/lib/answer-review";
const sentence = "Мой любимый класс – история.";
function schoolUnit(): AnalysisUnit {
  return { ...localAnalysis("Я играю в теннис с подругами.")[0],
    original:sentence, corrected:sentence, intendedMeaning:"My favorite class is history.",
    tiles:[{text:"Мой любимый класс",role:"subject"},{text:"–",role:"complement"},{text:"история",role:"complement"}],
    review:"ai", approved:true, changes:[], assessment:"correct",
  };
}
test("screenshot sentence is accepted using prior review evidence in AI mode without another judgement", () => {
  const result=reviewedBuilderMatch(schoolUnit(),sentence);
  assert.ok(result); assert.equal(reviewAccepted(result),true);
  assert.equal(result.original,sentence); assert.equal(result.source,"ai");
  assert.match(result.explanation,/previously AI-reviewed/);
});
test("reconstruction accepts harmless casing/punctuation while blocking wrong meaning and unreviewed drafts", () => {
  const u=schoolUnit();
  assert.ok(reviewedBuilderMatch(u,"мой любимый класс – история.."));
  assert.equal(reviewedBuilderMatch(u,"Мой любимый класс – математика."),null);
  assert.equal(reviewedBuilderMatch({...u,review:"unreviewed"},sentence),null);
});
test("previously curated natural word orders remain accepted without exact string matching", () => {
  const u=localAnalysis("Я играю в теннис с подругами.")[0];
  assert.ok(reviewedBuilderMatch(u,"С подругами я играю в теннис."));
});
test("live builder request carries a sentence-only task rather than the school-day mission", async (t) => {
  const env={...process.env};
  process.env.AI_ENABLED="true"; process.env.OPENAI_API_KEY="mock-test-key";
  let input: {prompt:string; reference:string; activity:string} | undefined;
  let instructions="";
  t.mock.method(globalThis,"fetch",async (_url:unknown, init?:RequestInit)=>{
    const body=JSON.parse(String(init?.body)); input=JSON.parse(body.input); instructions=body.instructions;
    return Response.json({status:"completed",output:[{type:"message",content:[{type:"output_text",text:JSON.stringify({status:"correct",source:"ai",original:sentence,suggestion:"",changes:[],question:"",taskMet:true,explanation:"The sentence matches the reference meaning."})}]}]});
  });
  try {
    const response=await POST(new NextRequest("http://localhost:3000/api/review",{method:"POST",headers:{origin:"http://localhost:3000",host:"localhost:3000","Content-Type":"application/json"},body:JSON.stringify({mode:"ai",missionId:"school",activity:"builder",reference:sentence,text:sentence})}));
    assert.equal(response.status,200); assert.equal(reviewAccepted(await response.json()),true);
    assert.match(input!.prompt,/single complete sentence/);
    assert.equal(input!.reference,sentence);
    assert.match(instructions,/Full prompt completion is assessed separately/);
    assert.ok(!input!.prompt.includes("what you do after"));
  } finally {process.env=env;}
});
