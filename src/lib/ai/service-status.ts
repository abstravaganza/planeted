import { createHash } from "node:crypto";
type RecordState = {
  verifiedAt: number | null;
  failedAt: number | null;
  error: string;
};
const globalStatus = globalThis as typeof globalThis & {
  questServices?: Map<string, RecordState>;
};
function key(service: "review" | "transcription") {
  return createHash("sha256")
    .update(
      [
        service,
        process.env.OPENAI_API_KEY,
        process.env.OPENAI_MODEL,
        process.env.OPENAI_TRANSCRIPTION_MODEL,
      ].join("|"),
    )
    .digest("hex");
}
export function configured(service: "review" | "transcription") {
  return (
    process.env.AI_ENABLED === "true" &&
    Boolean(process.env.OPENAI_API_KEY?.trim()) &&
    (service === "review" || process.env.TRANSCRIPTION_ENABLED === "true")
  );
}
export function recordService(
  service: "review" | "transcription",
  success: boolean,
  error = "Provider request failed. Retry or check server configuration.",
) {
  const store = (globalStatus.questServices ??= new Map());
  const previous = store.get(key(service));
  store.set(key(service), {
    verifiedAt: success ? Date.now() : (previous?.verifiedAt ?? null),
    failedAt: success ? null : Date.now(),
    error: success ? "" : error,
  });
}
export function serviceStatus() {
  return Object.fromEntries(
    (["review", "transcription"] as const).map((service) => {
      const enabled = configured(service);
      const observed = globalStatus.questServices?.get(key(service));
      return [
        service,
        {
          configured: enabled,
          verifiedAt: enabled ? (observed?.verifiedAt ?? null) : null,
          failedAt: enabled ? (observed?.failedAt ?? null) : null,
          error: enabled
            ? (observed?.error ?? "")
            : "Configure the server key and enable this service, then restart.",
        },
      ];
    }),
  );
}
