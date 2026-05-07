import { NextResponse } from "next/server";
import { buildContextPack, envReport, type SearchFilters } from "@/lib/mnemos-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json() as { query?: string; k?: number; filter?: SearchFilters };
    const markdown = await buildContextPack(body.query ?? "", body.k ?? 10, body.filter ?? {});
    return new NextResponse(markdown, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "x-mnemos-env": JSON.stringify(envReport())
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Context pack failed", env: envReport() },
      { status: 400 }
    );
  }
}
