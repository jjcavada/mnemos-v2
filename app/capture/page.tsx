"use client";
import { useMemo, useState } from "react";
import { Check, Loader2, Save } from "lucide-react";
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
    degraded: { openai_missing: boolean; service_role_missing: boolean };
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
  const [error, setError] = useState("");

  const projects = useMemo(
    () => Object.values(projectsById).sort((a, b) => a.name.localeCompare(b.name)),
    [projectsById]
  );

  async function submit() {
    setSaving(true);
    setResponse(null);
    setError("");
    const project = projectId ? projectsById[projectId]?.slug : undefined;
    const res = await fetch("/api/capture/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
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
    } else if (json.error) {
      setError(json.error);
    }
    setSaving(false);
  }

  const inputBaseStyle = { background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.08)" };

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="sticky top-0 z-10 px-8 py-3" style={{ background: "rgba(5,5,5,0.78)", borderBottom: "0.5px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }}>
        <div className="flex items-baseline justify-between max-w-[760px] mx-auto">
          <span className="font-mono text-[10px] tracking-[0.32em] uppercase text-text-3">Capture · Ingest</span>
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-text-4">raw + distilled</span>
        </div>
      </div>

      <div className="max-w-[760px] mx-auto px-8 pt-8 pb-16">
        <section className="bento-card mb-4 spring-in">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 mb-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="px-3 py-2 text-[13px] outline-none rounded-md placeholder-text-4 text-text-1"
              style={inputBaseStyle}
            />
            <label className="inline-flex items-center gap-2.5 px-3 rounded-md text-[12px] text-text-2 cursor-pointer h-[36px]" style={inputBaseStyle}>
              <input
                type="checkbox"
                checked={isProject}
                onChange={(e) => setIsProject(e.target.checked)}
                style={{ accentColor: "#E5E5E5" }}
              />
              Project memory
            </label>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste a chat, meeting note, decision, or raw thought…"
            className="w-full min-h-[280px] p-3 text-[14px] leading-relaxed outline-none rounded-lg resize-y placeholder-text-4 text-text-1"
            style={{ ...inputBaseStyle, letterSpacing: "0.001em" }}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            {isProject ? (
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="px-3 py-2 text-[12px] outline-none rounded-md text-text-1"
                style={inputBaseStyle}
              >
                <option value="">No project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            ) : (
              <select
                value={lifeArea}
                onChange={(e) => setLifeArea(e.target.value)}
                className="px-3 py-2 text-[12px] outline-none rounded-md text-text-1"
                style={inputBaseStyle}
              >
                {lifeAreas.map(la => <option key={la.slug} value={la.slug}>{la.name}</option>)}
              </select>
            )}
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="tags, comma-separated"
              className="md:col-span-2 px-3 py-2 text-[12px] outline-none rounded-md placeholder-text-4 text-text-1"
              style={inputBaseStyle}
            />
          </div>

          <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
            <div className="font-mono text-[10px] tracking-wider uppercase text-text-4">
              {response?.result?.degraded.openai_missing ? "openai key missing · raw fallback" : ""}
            </div>
            <button
              onClick={submit}
              disabled={saving || text.trim().length < 3}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-[12px] font-medium disabled:opacity-40 transition-opacity"
              style={{ background: "rgba(229,229,229,0.92)", color: "#0a0a0a" }}
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save memory
            </button>
          </div>
        </section>

        {error && (
          <div className="mb-4 px-3 py-2 rounded-md text-[12px] text-text-1" style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.12)" }}>
            {error}
          </div>
        )}

        {response?.ok && response.result && (
          <section className="bento-card spring-in">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-text-1" />
                <span className="h-micro">Captured</span>
              </div>
              <span className="font-mono text-[10px] tracking-wider uppercase text-text-4">
                {response.result.inserted.length} distilled · raw kept
              </span>
            </div>
            <div className="space-y-1.5">
              {response.result.inserted.map(m => (
                <button key={m.id} onClick={() => select(m)} className="mem-card w-full text-left">
                  <div className="text-[13px] font-medium text-text-1">{m.summary || m.content.slice(0, 120)}</div>
                  <div className="font-mono text-[10px] tracking-wider uppercase text-text-4 mt-1">
                    {m.type}{(m.tags ?? []).length > 0 ? ` · ${(m.tags ?? []).slice(0, 5).join(" · ")}` : ""}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
      <MemoryDrawer />
    </div>
  );
}
