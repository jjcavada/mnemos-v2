import { NextResponse } from "next/server";
import { appPasswordIsConfigured, setSessionCookie, verifyAppPassword } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as { password?: string };
  if (!appPasswordIsConfigured()) {
    return NextResponse.json({ ok: false, error: "MNEMOS_APP_PASSWORD is not configured" }, { status: 500 });
  }
  if (!verifyAppPassword(body.password ?? "")) {
    return NextResponse.json({ ok: false, error: "Wrong password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  setSessionCookie(res);
  return res;
}
