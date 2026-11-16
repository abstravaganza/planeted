import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";
import { POST } from "../src/app/api/access/route";
import { ACCESS_COOKIE, acceptsCode, createAccessToken, validAccessToken } from "../src/lib/practice-access";
const code="test-only-family-practice-code";
function envSetup(t: TestContext) {
  const previous={...process.env}; process.env.VERCEL="1"; process.env.PRACTICE_ACCESS_CODE=code;
  t.after(()=>{process.env=previous;});
}
test("deployed pages and APIs require a family code; assets/login remain available", t=>{
  envSetup(t);
  assert.equal(proxy(new NextRequest("https://quest.example/" )).status,307);
  assert.equal(proxy(new NextRequest("https://quest.example/api/review")).status,401);
  assert.equal(proxy(new NextRequest("https://quest.example/unlock")).status,200);
  assert.equal(proxy(new NextRequest("https://quest.example/api/access")).status,200);
  delete process.env.PRACTICE_ACCESS_CODE;
  assert.equal(proxy(new NextRequest("https://quest.example/api/review")).status,503);
});
test("signed cookie expires and cannot be forged or reused after code changes",t=>{
  envSetup(t); const now=Date.now(); const token=createAccessToken(now);
  assert.ok(validAccessToken(token,now)); assert.equal(validAccessToken(token+"forged",now),false);
  assert.equal(validAccessToken(token,now+8*24*60*60*1000),false);
  process.env.PRACTICE_ACCESS_CODE="different-test-code"; assert.equal(validAccessToken(token,now),false);
});
test("unlock rejects wrong codes and cross-origin submissions, sets secure HttpOnly cookie on success",async t=>{
  envSetup(t);
  const req=(value:string,origin="https://quest.example")=>new NextRequest("https://quest.example/api/access",{method:"POST",headers:{origin,host:"quest.example","Content-Type":"application/json"},body:JSON.stringify({code:value})});
  assert.equal((await POST(req("wrong"))).status,401);
  assert.equal((await POST(req(code,"https://other.example"))).status,403);
  const r=await POST(req(code)); assert.equal(r.status,200);
  const cookie=r.cookies.get(ACCESS_COOKIE); assert.ok(cookie); assert.ok(validAccessToken(cookie.value));
  assert.match(r.headers.get("set-cookie")!,/HttpOnly/); assert.match(r.headers.get("set-cookie")!,/Secure/);
  assert.equal(proxy(new NextRequest("https://quest.example/api/review",{headers:{cookie:`${ACCESS_COOKIE}=${cookie.value}`}})).status,200);
  assert.equal(acceptsCode("wrong"),false);
});
test("local practice remains ungated without deployment settings",t=>{
  envSetup(t); delete process.env.VERCEL; delete process.env.PRACTICE_GATE_ENABLED;
  assert.equal(proxy(new NextRequest("http://localhost:3000/")).status,200);
});
