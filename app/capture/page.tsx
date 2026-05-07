"use client";
import { useEffect, useMemo, useState } from "react";
import { Brain, Check, KeyRound, Loader2, Save } from "lucide-react";
import { useMemoriesStore } from "@/store/memories";
import { MemoryDrawer } from "@/components/MemoryDrawer";
import type { Memory } from "@/lib/types";

type CaptureResponse = {
  ok: boolean;
  error?: string;
  result?: {
    capture_id: string;
    raw_memory_id: string | null;
    inserted: Memory[];
    degraded: {
      openai_missing: boolean;
      service_role_missing: boolean;
    };
  };
};

export default function CapturePage() {
  const { projectsById, lifeAreas, refresh, select } = useMemoriesStore();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [tags, setTags] = useState("");
  const [isProject, setIsProject] = useState(true);
  const [projectId, setProjectId] = useState("");
  const [lifeArea, setLifeArea] = useState("other");
  const [saving, setSaving] = useState(false);
  const [response, setResponse] = useState<CaptureResponse | null>(null);
  const [apiToken, setApiToken] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setApiToken(sessionStorage.getItem("mnemos_api_token") ?? "");
  }, []);

  function saveApiToken(value: string) {
    setApiToken(value);
    if (value.trim()) sessionStorage.setItem("mnemos_api_token", value.trim());
    else sessionStorage.removeItem("mnemos_api_token");
  }

  const projects = useMemo(
    () => Object.values(projectsById).sort((a, b) => a.name.localeCompare(b.name)),
    [projectsById]
  );

  async function submit() {
    if (!apiToken.trim()) {
      setError("Capture is protected. Paste your Mnemos API token first.");
      return;
    }
    setSaving(true);
    setResponse(null);
    setError("");
    const project = projectId ? projectsById[projectId]?.slug : undefined;
    const res = await fetch("/api/capture/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiToken.trim()}`
      },
      body: JSON.stringify({
        title: title || undefined,
        text,
        source: "claude-code",
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
        is_project: isProject,
        project_id: isProject && projectId ? projectId : undefined,
        project,
        life_area: isProject ? undefined : lifeArea,
        keep_raw: true
      })
    });
    const json = await res.json() as CaptureResponse;
    setResponse(json);
    if (json.ok) {
      setText("");
      setTitle("");
      setTags("");
      await refresh();
    }
    setSaving(false);
  }

  return (
    <div className="absolute inset-0 overflow-y-auto p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Capture</h1>
          <div className="text-text-3 text-sm mt-1">Raw source plus distilled memories</div>
        </div>
        <div className="flex items-center gap-2 text-text-3 text-xs">
          <Brain className="w-4 h-4" />
          <span>mnemos ingestion</span>
        </div>
      </div>

      <section className="bg-bg-1 border border-border rounded-lg px-4 py-3 mb-3">
        <div className="flex items-center gap-3">
          <KeyRound className="w-4 h-4 text-text-3" />
          <input
            value={apiToken}
            onChange={(e) => saveApiToken(e.target.value)}
            type="password"
            placeholder="Mnemos API token for protected capture"
            className="flex-1 bg-transparent outline-none text-xs placeholder-text-3"
          />
          <div className="text-[11px] text-text-4">{apiToken ? "unlocked" : "locked"}</div>
        </div>
      </section>

      <section className="bg-bg-1 border border-border rounded-lg p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3 mb-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="bg-bg-2 border border-border rounded px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <label className="flex items-center gap-2 bg-bg-2 border border-border rounded px-3 text-sm text-text-2">
            <input
              type="checkbox"
              checked={isProject}
              onChange={(e) => setIsProject(e.target.checked)}
              className="accent-accent"
            />
            Project memory
          </label>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste chat, meeting notes, decisions, questions, or raw thoughts..."
          className="w-full min-h-[260px] bg-bg-2 border border-border rounded-lg p-3 text-sm outline-none focus:border-accent resize-y"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          {isProject ? (
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="bg-bg-2 border border-border rounded px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">No project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          ) : (
            <select
              value={lifeArea}
              onChange={(e) => setLifeArea(e.target.value)}
              className="bg-bg-2 border border-border rounded px-3 py-2 text-sm outline-none focus:border-accent"
            >
              {lifeAreas.map(la => <option key={la.slug} value={la.slug}>{la.name}</option>)}
            </select>
          )}
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="tags, comma-separated"
            className="md:col-span-2 bg-bg-2 border border-border rounded px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="text-[11px] text-text-4">
            {response?.result?.degraded.openai_missing ? "OPENAI_API_KEY missing: raw fallback active" : ""}
          </div>
          <button
            onClick={submit}
            disabled={saving || text.trim().length < 3}
            className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-black rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </section>

      {error && <div className="mb-4 text-red-300 text-sm">{error}</div>}

      {response && (
        <section className="bg-bg-1 border border-border rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            {response.ok ? <Check className="w-4 h-4 text-green-400" /> : null}
            <div className="font-semibold">{response.ok ? "Captured" : "Capture failed"}</div>
          </div>
          {response.error && <div className="text-red-300 text-sm">{response.error}</div>}
          <div className="space-y-2">
            {response.result?.inserted.map(m => (
              <button key={m.id} onClick={() => select(m)} className="mem-card w-full text-left">
                <div className="text-sm font-medium">{m.summary || m.content.slice(0, 120)}</div>
                <div className="text-[11px] text-text-3 mt-1">{m.type} - {(m.tags ?? []).slice(0, 5).join(", ")}</div>
              </button>
            ))}
          </div>
        </section>
      )}
      <MemoryDrawer />
    </div>
  );
}
