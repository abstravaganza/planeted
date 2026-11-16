import { createHash, createHmac, timingSafeEqual } from "node:crypto";
export const ACCESS_COOKIE = "quest-practice";
const lifetime = 7 * 24 * 60 * 60;
export function accessRequired() {
  return process.env.VERCEL === "1" || process.env.PRACTICE_GATE_ENABLED === "true";
}
export function accessConfigured() {
  return (process.env.PRACTICE_ACCESS_CODE?.trim().length ?? 0) >= 12;
}
function equal(a: string, b: string) {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}
export function acceptsCode(code: string) {
  return accessConfigured() && equal(code.trim(), process.env.PRACTICE_ACCESS_CODE!.trim());
}
function signature(payload: string) {
  return createHmac("sha256", process.env.PRACTICE_ACCESS_CODE || "").update(payload).digest("hex");
}
export function createAccessToken(now = Date.now()) {
  const expiry = String(Math.floor(now / 1000) + lifetime);
  return `${expiry}.${signature(expiry)}`;
}
export function validAccessToken(token: string | undefined, now = Date.now()) {
  if (!accessConfigured() || !token) return false;
  const [expiry, signed, extra] = token.split(".");
  if (!expiry || !signed || extra || !/^\d+$/u.test(expiry)) return false;
  const seconds = Math.floor(now / 1000);
  return Number(expiry) > seconds && Number(expiry) <= seconds + lifetime && equal(signed, signature(expiry));
}
export const accessCookieAge = lifetime;
