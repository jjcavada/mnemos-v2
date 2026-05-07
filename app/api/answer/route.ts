import { NextResponse } from "next/server";
import { answerQuery, envReport, type SearchFilters } from "@/lib/mnemos-server";
import { requireApiToken } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const unauthorized = requireApiToken(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json() as { query?: string; k?: number; filter?: SearchFilters };
    const query = typeof body.query === "string" ? body.query.trim() : "";
    if (!query) return NextResponse.json({ ok: false, error: "Query required" }, { status: 400 });

    const result = await answerQuery(query, body.k ?? 12, body.filter ?? {});
    return NextResponse.json({
      ok: true,
      query: result.query,
      answer: result.answer,
      confidence: result.confidence,
      missing: result.missing,
      followups: result.followups,
      entities: result.entities,
      projects: result.projects,
      principles: result.principles,
      memories: result.memories,
      context_markdown: result.context_markdown,
      generated_at: result.generated_at,
      env: envReport()
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Answer failed", env: envReport() },
      { status: 400 }
    );
  }
}
