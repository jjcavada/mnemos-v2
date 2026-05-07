import { NextResponse } from "next/server";
import { captureChat, envReport } from "@/lib/mnemos-server";
import { requireApiToken } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const unauthorized = requireApiToken(req);
  if (unauthorized) return unauthorized;

  try {
    const form = await req.formData();
    const transcript = String(form.get("transcript") ?? "").trim();
    if (!transcript) {
      return NextResponse.json(
        { ok: false, error: "Voice upload is not transcribed in-app yet; send a transcript field for now.", env: envReport() },
        { status: 501 }
      );
    }
    const result = await captureChat({
      text: transcript,
      title: String(form.get("title") ?? "Voice note"),
      source: "manual",
      tags: ["voice-note"],
      is_project: form.get("is_project") === "true",
      project: form.get("project") ? String(form.get("project")) : undefined,
      life_area: form.get("life_area") ? String(form.get("life_area")) : undefined
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Voice capture failed", env: envReport() },
      { status: 400 }
    );
  }
}
