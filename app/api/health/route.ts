import { NextResponse } from "next/server";
import { envReport } from "@/lib/mnemos-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, env: envReport() });
}
