import { NextResponse } from "next/server";
import { captureChat, envReport, type CaptureChatBody } from "@/lib/mnemos-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json() as CaptureChatBody & { url?: string };
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const text = [body.title, url, body.text].filter(Boolean).join("\n\n");
    const isGithub = /github\.com/i.test(url);
    const baseTags = body.tags ?? [];
    const augmentedTags = [
      ...baseTags,
      "highlight",
      "link",
      ...(isGithub ? ["github"] : [])
    ];
    const result = await captureChat({
      ...body,
      text,
      source: body.source ?? "browser-ext",
      source_url: body.source_url ?? (url || undefined),
      tags: augmentedTags
    });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Highlight capture failed", env: envReport() },
      { status: 400 }
    );
  }
}
