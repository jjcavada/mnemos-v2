import { NextResponse } from "next/server";
import { captureChat, envReport, type CaptureChatBody } from "@/lib/mnemos-server";
import { requireApiToken } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const unauthorized = requireApiToken(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json() as CaptureChatBody & { url?: string };
    const text = [body.title, body.url, body.text].filter(Boolean).join("\n\n");
    const result = await captureChat({
      ...body,
      text,
      source: "browser-ext",
      tags: [...(body.tags ?? []), "highlight"]
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Highlight capture failed", env: envReport() },
      { status: 400 }
    );
  }
}
