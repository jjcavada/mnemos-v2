import { NextResponse } from "next/server";
import { fetchEntityDetail, upsertEntity } from "@/lib/mnemos-server";
import { coerceEntityKind, slugify } from "@/lib/mnemos-schema";
import { requireApiToken } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function GET(req: Request, ctx: Params) {
  const unauthorized = requireApiToken(req);
  if (unauthorized) return unauthorized;

  const { slug } = await ctx.params;
  const detail = await fetchEntityDetail(slug);
  return NextResponse.json({ ok: true, entity: detail.entity, memories: detail.memories, mention_count: detail.memories.length });
}

export async function PUT(req: Request, ctx: Params) {
  const unauthorized = requireApiToken(req);
  if (unauthorized) return unauthorized;

  const { slug: rawSlug } = await ctx.params;
  const slug = slugify(rawSlug);
  if (!slug) return NextResponse.json({ ok: false, error: "Invalid slug" }, { status: 400 });

  try {
    const body = await req.json() as {
      name?: string;
      kind?: string;
      metadata?: Record<string, unknown>;
    };
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : slug;
    const kind = coerceEntityKind(body.kind);
    const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
    const saved = await upsertEntity({ slug, name, kind, metadata });
    return NextResponse.json({ ok: true, entity: saved });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Save failed" },
      { status: 400 }
    );
  }
}
