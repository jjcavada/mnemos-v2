import { NextResponse } from "next/server";
import { envReport, searchMemories, type SearchFilters } from "@/lib/mnemos-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json() as { query?: string; k?: number; filter?: SearchFilters };
    const query = typeof body.query === "string" ? body.query : "";
    const results = await searchMemories(query, body.k ?? 12, body.filter ?? {});
    return NextResponse.json({ ok: true, query, results, env: envReport() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Search failed", env: envReport() },
      { status: 400 }
    );
  }
}
