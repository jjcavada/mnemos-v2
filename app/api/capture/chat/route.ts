import { NextResponse } from "next/server";
import { captureChat, envReport, type CaptureChatBody } from "@/lib/mnemos-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json() as CaptureChatBody;
    const result = await captureChat({ ...body, source: body.source ?? "claude-code" });
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Capture failed", env: envReport() },
      { status: 400 }
    );
  }
}
