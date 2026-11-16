/** Compare against the actual request Host; Next's internal URL can use localhost behind a proxy. */
export function sameOrigin(
  origin: string | null,
  host: string | null,
): boolean {
  if (!origin) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
// A small per-process safety ceiling for the prototype. Use a shared limiter before public deployment.
let windowStart = 0;
let count = 0;
export function allowAiRequest(now = Date.now()): boolean {
  if (now - windowStart >= 600_000) {
    windowStart = now;
    count = 0;
  }
  count += 1;
  return count <= 30;
}
