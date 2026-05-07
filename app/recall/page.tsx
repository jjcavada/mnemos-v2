"use client";
import { useEffect, useState } from "react";
import { BrainCircuit, Download, FileText, KeyRound, Loader2, Search } from "lucide-react";
import { useMemoriesStore } from "@/store/memories";
import { MemoryDrawer } from "@/components/MemoryDrawer";
import type { Memory } from "@/lib/types";

type SearchResponse = {
  ok: boolean;
  error?: string;
  results?: Array<Memory & { why?: string; score?: number }>;
};

export default function RecallPage() {
  const { select } = useMemoriesStore();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState<"search" | "context" | null>(null);
  const [results, setResults] = useState<SearchResponse["results"]>([]);
  const [context, setContext] = useState("");
  const [error, setError] = useState("");
  const [apiToken, setApiToken] = useState("");

  useEffect(() => {
    setApiToken(sessionStorage.getItem("mnemos_api_token") ?? "");
  }, []);

  function saveApiToken(value: string) {
    setApiToken(value);
    if (value.trim()) sessionStorage.setItem("mnemos_api_token", value.trim());
    else sessionStorage.removeItem("mnemos_api_token");
  }

  function authHeaders(): Record<string, string> {
    const token = apiToken.trim();
    return token ? { authorization: `Bearer ${token}` } : {};
  }

  async function runSearch() {
    setLoading("search");
    setError("");
    setContext("");
    const headers: Record<string, string> = { "content-type": "application/json", ...authHeaders() };
    const res = await fetch("/api/search", {
      method: "POST",
      headers,
      body: JSON.stringify({ query, k: 16 })
    });
    const json = await res.json() as SearchResponse;
    if (json.ok) setResults(json.results ?? []);
    else setError(json.error ?? "Search failed");
    setLoading(null);
  }

  async function buildContext() {
    if (!apiToken.trim()) {
      setError("Context packs are protected. Paste your Mnemos API token first.");
      return;
    }
    setLoading("context");
    setError("");
    const headers: Record<string, string> = { "content-type": "application/json", ...authHeaders() };
    const res = await fetch("/api/context", {
      method: "POST",
      headers,
      body: JSON.stringify({ query, k: 10 })
    });
    if (res.ok) setContext(await res.text());
    else setError(await friendlyApiError(res));
    setLoading(null);
  }

  async function exportArchive() {
    if (!apiToken.trim()) {
      setError("Export is protected. Paste your Mnemos API token first.");
      return;
    }
    setError("");
    const res = await fetch("/api/export", { headers: authHeaders() });
    if (!res.ok) {
      setError(await friendlyApiError(res));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mnemos-archive.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="absolute inset-0 overflow-y-auto p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Recall</h1>
          <div className="text-text-3 text-sm mt-1">Hybrid search and context packs</div>
        </div>
        <button
          onClick={exportArchive}
          className="inline-flex items-center gap-2 px-3 py-2 bg-bg-2 border border-border rounded-lg text-sm text-text-2 hover:text-text-1 hover:border-border-strong"
        >
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      <section className="bg-bg-1 border border-border rounded-lg px-4 py-3 mb-3">
        <div className="flex items-center gap-3">
          <KeyRound className="w-4 h-4 text-text-3" />
          <input
            value={apiToken}
            onChange={(e) => saveApiToken(e.target.value)}
            type="password"
            placeholder="Mnemos API token for protected actions"
            className="flex-1 bg-transparent outline-none text-xs placeholder-text-3"
          />
          <div className="text-[11px] text-text-4">{apiToken ? "unlocked" : "keyword search only"}</div>
        </div>
      </section>

      <section className="bg-bg-1 border border-border rounded-lg p-4 mb-5">
        <div className="flex items-center gap-3">
          <BrainCircuit className="w-5 h-5 text-accent" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void runSearch(); }}
            placeholder="Daylon UDT Glendale issue from three months ago"
            className="flex-1 bg-transparent outline-none text-sm placeholder-text-3"
          />
          <button
            onClick={runSearch}
            disabled={loading !== null || !query.trim()}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent text-black rounded text-xs font-semibold disabled:opacity-50"
          >
            {loading === "search" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Search
          </button>
          <button
            onClick={buildContext}
            disabled={loading !== null || !query.trim()}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-bg-3 border border-border text-text-2 rounded text-xs font-semibold disabled:opacity-50 hover:text-text-1"
          >
            {loading === "context" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Context
          </button>
        </div>
      </section>

      {error && <div className="mb-4 text-red-300 text-sm">{error}</div>}

      {context && (
        <section className="bg-bg-1 border border-border rounded-lg p-5 mb-5">
          <div className="h-section mb-3">Context Pack</div>
          <pre className="whitespace-pre-wrap text-xs text-text-2 leading-relaxed font-mono max-h-[420px] overflow-y-auto">{context}</pre>
        </section>
      )}

      <div className="grid grid-cols-1 gap-2">
        {results?.map(m => (
          <button key={m.id} onClick={() => select(m)} className="mem-card w-full text-left">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm text-text-1 font-medium">{m.summary || m.content.slice(0, 160)}</div>
                <div className="text-[11px] text-text-3 mt-1">
                  {m.type} - {new Date(m.created_at).toLocaleDateString()} - {m.why ?? "match"}
                </div>
              </div>
              {typeof m.score === "number" && <div className="text-[11px] text-text-4 font-mono">{m.score.toFixed(2)}</div>}
            </div>
          </button>
        ))}
      </div>
      <MemoryDrawer />
    </div>
  );
}

async function friendlyApiError(res: Response) {
  try {
    const json = await res.json() as { error?: string };
    return json.error ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}
