import { NextResponse } from "next/server";
import { envReport, upsertJournalMemory } from "@/lib/mnemos-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/capture/journal
 * Body: { date, content, summary?, mood?, energy?, importance? }
 * Idempotent: one memory row per date. Re-posting the same date updates content + embedding.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      date?: string;
      content?: string;
      summary?: string | null;
      mood?: string | null;
      energy?: number | null;
      importance?: number;
    };
    const date = typeof body.date === "string" ? body.date.slice(0, 10) : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";
    if (!date || !content) {
      return NextResponse.json({ ok: false, error: "date and content are required" }, { status: 400 });
    }
    const memory = await upsertJournalMemory({
      date,
      content,
      summary: body.summary ?? null,
      mood: body.mood ?? null,
      energy: typeof body.energy === "number" ? body.energy : null,
      importance: body.importance
    });
    return NextResponse.json({ ok: true, memory, env: envReport() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Journal capture failed", env: envReport() },
      { status: 400 }
    );
  }
}
