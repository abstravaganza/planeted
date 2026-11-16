import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, accessConfigured, accessRequired, validAccessToken } from "@/lib/practice-access";
export function proxy(req: NextRequest) {
  if (!accessRequired() || validAccessToken(req.cookies.get(ACCESS_COOKIE)?.value)) return NextResponse.next();
  if (req.nextUrl.pathname === "/unlock" || req.nextUrl.pathname === "/api/access") return NextResponse.next();
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({error: accessConfigured() ? "Open practice with your family code first." : "The owner needs to configure the practice access code."}, {status: accessConfigured() ? 401 : 503, headers:{"Cache-Control":"no-store"}});
  return NextResponse.redirect(new URL("/unlock", req.url));
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|woff2)$).*)"] };
