import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, acceptsCode, accessConfigured, accessCookieAge, createAccessToken } from "@/lib/practice-access";
import { sameOrigin } from "@/lib/ai/request-guard";
export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers.get("origin"), req.headers.get("host"))) return NextResponse.json({error:"Origin not allowed."},{status:403});
  if (!accessConfigured()) return NextResponse.json({error:"The owner needs to set the practice code on the hosting server."},{status:503});
  if (Number(req.headers.get("content-length") ?? 0)>4096) return NextResponse.json({error:"Invalid code."},{status:400});
  const body = await req.json().catch(()=>null);
  if (typeof body?.code !== "string" || body.code.length>200 || !acceptsCode(body.code)) return NextResponse.json({error:"That code doesn’t match. Try again."},{status:401});
  const response=NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
  response.cookies.set(ACCESS_COOKIE,createAccessToken(),{httpOnly:true,secure:process.env.VERCEL==="1" || req.nextUrl.protocol === "https:",sameSite:"strict",path:"/",maxAge:accessCookieAge});
  return response;
}
