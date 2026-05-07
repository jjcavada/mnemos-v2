import { NextResponse } from "next/server";
import { dailyDigest, envReport } from "@/lib/mnemos-server";
import { requireApiToken } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const unauthorized = requireApiToken(req);
  if (unauthorized) return unauthorized;

  try {
    return NextResponse.json({ ok: true, digest: await dailyDigest(), env: envReport() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Daily digest failed", env: envReport() },
      { status: 400 }
    );
  }
}
