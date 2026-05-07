import { NextResponse } from "next/server";
import { listEntities, upsertEntity } from "@/lib/mnemos-server";
import { coerceEntityKind, slugify } from "@/lib/mnemos-schema";
import { requireApiToken } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const unauthorized = requireApiToken(req);
  if (unauthorized) return unauthorized;

  const entities = await listEntities();
  return NextResponse.json({ ok: true, entities });
}

export async function POST(req: Request) {
  const unauthorized = requireApiToken(req);
  if (unauthorized) return unauthorized;

  try {
    const body = await req.json() as {
      slug?: string;
      name?: string;
      kind?: string;
      metadata?: Record<string, unknown>;
    };
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "";
    if (!name) return NextResponse.json({ ok: false, error: "Name is required" }, { status: 400 });
    const slug = slugify(typeof body.slug === "string" && body.slug.trim() ? body.slug : name);
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
