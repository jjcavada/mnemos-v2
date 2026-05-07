import { NextResponse } from "next/server";
import { appPasswordIsConfigured, hasValidApiToken } from "@/lib/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return NextResponse.json({
    ok: true,
    authenticated: hasValidApiToken(req),
    password_configured: appPasswordIsConfigured()
  });
}
