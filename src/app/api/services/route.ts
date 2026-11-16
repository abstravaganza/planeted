import { NextResponse } from "next/server";
import { serviceStatus } from "@/lib/ai/service-status";
export const runtime = "nodejs";
export function GET() {
  return NextResponse.json(
    { services: serviceStatus() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
