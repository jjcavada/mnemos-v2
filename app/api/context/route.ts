import { NextResponse } from "next/server";
import { buildContextPack, envReport, type SearchFilters } from "@/lib/mnemos-server";
import { requireApiToken } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const unauthorized = requireApiToken(req);
  if (unauthorized) return unauthorized;

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
