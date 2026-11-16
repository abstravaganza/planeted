"use client";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "./ui";
const schema = z.object({
  services: z.object({
    review: z.object({
      configured: z.boolean(),
      verifiedAt: z.number().nullable(),
      failedAt: z.number().nullable(),
      error: z.string(),
    }),
    transcription: z.object({
      configured: z.boolean(),
      verifiedAt: z.number().nullable(),
      failedAt: z.number().nullable(),
      error: z.string(),
    }),
  }),
});
export function ServiceStatus({ onRefresh }: { onRefresh: () => void }) {
  const [data, setData] = useState<z.infer<typeof schema> | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/services", { cache: "no-store" });
      if (!r.ok) throw new Error();
      setData(schema.parse(await r.json()));
      onRefresh();
    } catch {
      setError("Service status unavailable. Retry.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    let active = true;
    fetch("/api/services", { cache: "no-store" })
      .then((r) => r.json())
      .then((v) => {
        if (active) setData(schema.parse(v));
      })
      .catch(() => {
        if (active) setError("Service status unavailable. Retry.");
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <details
      className="q-services"
      onToggle={(e) => {
        if (e.currentTarget.open) void refresh();
      }}
    >
      <summary>Services</summary>
      <div>
        {data &&
          Object.entries(data.services).map(([name, s]) => (
            <p key={name}>
              <strong>
                {name === "review" ? "AI review" : "Transcription"}:{" "}
              </strong>
              {!s.configured
                ? "Not configured"
                : s.failedAt
                  ? "Last request failed"
                  : s.verifiedAt
                    ? "Successful request observed"
                    : "Configured · not yet tested"}
              {s.verifiedAt && (
                <small>
                  Last success: {new Date(s.verifiedAt).toLocaleString()}
                </small>
              )}
              {s.error && <small>{s.error}</small>}
            </p>
          ))}
        <p>
          Status reflects requests in this server process; it is not a
          speech-quality assessment. Refresh does not make paid calls.
        </p>
        <details>
          <summary>Local setup</summary>
          <p>
            Create <code>.env.local</code> in the project folder, set the
            following variables, and restart the server. Keep your key private.
          </p>
          <pre>{`OPENAI_API_KEY=<your key>\nAI_ENABLED=true\nTRANSCRIPTION_ENABLED=true\nOPENAI_MODEL=gpt-4.1-mini\nOPENAI_TRANSCRIPTION_MODEL=gpt-transcribe`}</pre>
        </details>
        {error && <p role="status">{error}</p>}
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => void refresh()}
        >
          {busy ? "Refreshing…" : "Refresh status"}
        </Button>
      </div>
    </details>
  );
}
