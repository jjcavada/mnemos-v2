import { NextResponse } from "next/server";
import crypto from "node:crypto";

const SESSION_COOKIE = "mnemos_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function hasValidApiToken(req: Request) {
  return hasValidBearerToken(req) || hasValidSession(req);
}

export function hasValidBearerToken(req: Request) {
  const configured = process.env.MNEMOS_API_TOKEN;
  if (!configured) return false;
  const raw = req.headers.get("authorization") ?? "";
  const token = raw.startsWith("Bearer ") ? raw.slice("Bearer ".length).trim() : "";
  return timingSafeEqual(token, configured);
}

export function requireApiToken(req: Request) {
  if (hasValidApiToken(req)) return null;
  return NextResponse.json(
    { ok: false, error: authIsConfigured() ? "Unauthorized" : "Mnemos auth is not configured" },
    { status: 401 }
  );
}

export function verifyAppPassword(password: string) {
  const configured = process.env.MNEMOS_APP_PASSWORD;
  if (!configured) return false;
  return timingSafeEqual(password, configured);
}

export function appPasswordIsConfigured() {
  return Boolean(process.env.MNEMOS_APP_PASSWORD);
}

export function setSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, createSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

function hasValidSession(req: Request) {
  const raw = cookieValue(req, SESSION_COOKIE);
  if (!raw) return false;
  const [expiresRaw, signature] = raw.split(".");
  const expires = Number(expiresRaw);
  if (!expiresRaw || !signature || !Number.isFinite(expires) || expires <= Date.now()) return false;
  return timingSafeEqual(signature, sign(expiresRaw));
}

function createSessionValue() {
  const expires = String(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  return `${expires}.${sign(expires)}`;
}

function sign(value: string) {
  const secret = process.env.MNEMOS_SESSION_SECRET ?? process.env.MNEMOS_API_TOKEN ?? "";
  if (!secret) return "";
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function authIsConfigured() {
  return Boolean(process.env.MNEMOS_API_TOKEN || process.env.MNEMOS_SESSION_SECRET);
}

function cookieValue(req: Request, name: string) {
  const header = req.headers.get("cookie") ?? "";
  const pair = header.split(";").map(v => v.trim()).find(v => v.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : "";
}

function timingSafeEqual(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
