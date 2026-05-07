import { NextResponse } from "next/server";

export function hasValidApiToken(req: Request) {
  const configured = process.env.MNEMOS_API_TOKEN;
  if (!configured) return false;

  const raw = req.headers.get("authorization") ?? "";
  const token = raw.startsWith("Bearer ") ? raw.slice("Bearer ".length).trim() : "";
  return timingSafeEqual(token, configured);
}

export function requireApiToken(req: Request) {
  if (hasValidApiToken(req)) return null;
  return NextResponse.json(
    {
      ok: false,
      error: process.env.MNEMOS_API_TOKEN
        ? "Unauthorized"
        : "MNEMOS_API_TOKEN is not configured"
    },
    { status: 401 }
  );
}

function timingSafeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
