import { NextResponse } from "next/server";
import { envReport, exportArchive } from "@/lib/mnemos-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const format = url.searchParams.get("format") === "jsonl" ? "jsonl" : "bundle";
    const archive = await exportArchive(format);
    return new NextResponse(archive.body, {
      headers: {
        "content-type": archive.contentType,
        "content-disposition": format === "jsonl"
          ? "attachment; filename=mnemos-memories.jsonl"
          : "attachment; filename=mnemos-archive.json"
      }
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Export failed", env: envReport() },
      { status: 400 }
    );
  }
}
