import { NextRequest, NextResponse } from "next/server";
import { openaiServices, SpeechProviderError } from "@/lib/ai/openai";
import { sameOrigin, allowAiRequest } from "@/lib/ai/request-guard";
import { recordService } from "@/lib/ai/service-status";
export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers.get("origin"), req.headers.get("host")))
    return NextResponse.json(
      { error: "Request origin not allowed." },
      { status: 403 },
    );
  if (
    process.env.AI_ENABLED !== "true" ||
    process.env.TRANSCRIPTION_ENABLED !== "true" ||
    !process.env.OPENAI_API_KEY
  )
    return NextResponse.json(
      {
        error:
          "Transcription is not configured. Set AI_ENABLED=true, TRANSCRIPTION_ENABLED=true and OPENAI_API_KEY on the server, then restart. Manual entry remains available.",
      },
      { status: 503 },
    );
  if (Number(req.headers.get("content-length") ?? 0) > 4_100_000)
    return NextResponse.json(
      { error: "Recording exceeds 4 MB." },
      { status: 413 },
    );
  if (!allowAiRequest())
    return NextResponse.json(
      {
        error: "AI practice limit reached. Type your ideas or try again later.",
      },
      { status: 429 },
    );
  try {
    const data = await req.formData();
    const file = data.get("audio");
    if (
      !(file instanceof Blob) ||
      file.size === 0 ||
      file.size > 4_000_000 ||
      !["audio/webm", "audio/mp4", "audio/ogg"].some((t) =>
        file.type.startsWith(t),
      )
    )
      return NextResponse.json(
        { error: "Use a short WebM, MP4 or Ogg recording under 4 MB." },
        { status: 400 },
      );
    const result = await openaiServices.transcribe(file);
    recordService("transcription", true);
    return NextResponse.json({ ...result, locale: "ru-RU" });
  } catch (error) {
    recordService(
      "transcription",
      false,
      "Transcription failed. Check the server key, model access or provider availability, then retry.",
    );
    const status = error instanceof SpeechProviderError ? error.status : 502;
    console.warn("transcription_failed", { providerStatus: status });
    if ([401, 403, 404].includes(status))
      return NextResponse.json(
        {
          error:
            "Transcription provider configuration failed. Check the server key, model and account access. Your recording is retained for retry.",
        },
        { status: 503 },
      );
    if (status === 429)
      return NextResponse.json(
        {
          error:
            "Transcription provider limit reached. Retry later; your recording is retained.",
        },
        { status: 429 },
      );
    return NextResponse.json(
      {
        error:
          "Transcription could not finish. Your typed ideas are still available.",
      },
      { status: 502 },
    );
  }
}
