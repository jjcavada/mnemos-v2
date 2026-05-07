"use client";
import { useMemoriesStore } from "@/store/memories";
import { X, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import type { Asset, Memory } from "@/lib/types";
import { memoryColor } from "@/lib/colors";

export function MemoryDrawer() {
  const { selected, select, memories, projectsById, refresh, relationships } = useMemoriesStore();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!selected) { setAssets([]); setEditing(false); return; }
    setDraft(selected.content);
    sb.from("assets").select("*").eq("memory_id", selected.id).then(({ data }) => {
      setAssets((data ?? []) as Asset[]);
    });
  }, [selected]);

  if (!selected) return null;

  const color = memoryColor(selected, projectsById);
  const proj = selected.project_id ? projectsById[selected.project_id] : null;
  const linked: Memory[] = relationships
    .filter(r => r.from_memory === selected.id || r.to_memory === selected.id)
    .map(r => memories.find(m => m.id === (r.from_memory === selected.id ? r.to_memory : r.from_memory)))
    .filter((m): m is Memory => Boolean(m));

  async function saveEdit() {
    await sb.from("memories").update({ content: draft }).eq("id", selected!.id);
    setEditing(false);
    await refresh();
  }

  async function deleteMemory() {
    if (!confirm("Delete this memory? Cascade deletes assets.")) return;
    for (const a of assets) {
      const path = a.storage_url.split("/mnemos-assets/")[1];
      if (path) await sb.storage.from("mnemos-assets").remove([path]);
    }
    await sb.from("memories").delete().eq("id", selected!.id);
    select(null);
    await refresh();
  }

  return (
    <div className="fixed top-[56px] right-0 bottom-0 w-[460px] bg-bg-1 border-l border-border z-30 overflow-y-auto fade-in">
      {/* head */}
      <div className="sticky top-0 bg-bg-1 border-b border-border px-5 py-4 flex items-start justify-between gap-3 z-10">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-[11px] text-text-3">
              {selected.is_project ? (proj?.name ?? "project") : (selected.life_area ?? "life")}
            </span>
            <span className={`type-badge type-${selected.type}`} style={{ background: "rgba(168,168,177,0.15)", color: "#d1d5db" }}>
              {selected.type}
            </span>
          </div>
          <div className="text-text-1 font-semibold leading-snug">
            {selected.summary || selected.content.slice(0, 80)}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setEditing(!editing)} className="p-1.5 hover:bg-bg-2 rounded text-text-3 hover:text-text-1">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={deleteMemory} className="p-1.5 hover:bg-bg-2 rounded text-text-3 hover:text-red-400">
            <Trash2 className="w-4 h-4" />
          </button>
          <button onClick={() => select(null)} className="p-1.5 hover:bg-bg-2 rounded text-text-3 hover:text-text-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* body */}
      <div className="px-5 py-5 space-y-5">
        <section>
          <div className="h-section mb-2">Content</div>
          {editing ? (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full min-h-[120px] bg-bg-2 border border-border rounded-lg p-3 text-sm outline-none focus:border-accent"
              />
              <div className="flex gap-2">
                <button onClick={saveEdit} className="px-3 py-1.5 bg-accent text-black rounded text-xs font-semibold">Save</button>
                <button onClick={() => { setEditing(false); setDraft(selected.content); }} className="px-3 py-1.5 bg-bg-3 text-text-2 rounded text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="text-text-2 text-sm leading-relaxed whitespace-pre-wrap">{selected.content}</div>
          )}
        </section>

        {selected.tags?.length > 0 && (
          <section>
            <div className="h-section mb-2">Tags</div>
            <div className="flex flex-wrap gap-1.5">
              {selected.tags.map(t => (
                <span key={t} className="pill text-[11px] h-[22px]">#{t}</span>
              ))}
            </div>
          </section>
        )}

        {assets.length > 0 && (
          <section>
            <div className="h-section mb-2">Assets ({assets.length})</div>
            <div className="grid grid-cols-3 gap-2">
              {assets.map(a => (
                <a key={a.id} href={a.storage_url} target="_blank" rel="noreferrer"
                   className="aspect-square bg-bg-2 rounded-lg overflow-hidden border border-border hover:border-border-strong">
                  {a.mime_type.startsWith("image/") ? (
                    <img src={a.storage_url} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[10px] text-text-3 p-2">
                      <span className="text-2xl">📄</span>
                      <span className="truncate w-full text-center mt-1">{a.filename ?? "file"}</span>
                    </div>
                  )}
                </a>
              ))}
            </div>
          </section>
        )}

        {linked.length > 0 && (
          <section>
            <div className="h-section mb-2">Connected ({linked.length})</div>
            <div className="space-y-2">
              {linked.map(m => (
                <button key={m.id} onClick={() => select(m)} className="mem-card w-full text-left">
                  <div className="text-[13px] font-medium truncate">{m.summary || m.content.slice(0, 60)}</div>
                  <div className="text-[11px] text-text-3 mt-1">{m.is_project ? (m.project_id && projectsById[m.project_id]?.name) : (m.life_area ?? "life")} · {m.type}</div>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="pt-3 border-t border-border text-[11px] text-text-4 space-y-0.5">
          <div>id: <span className="font-mono">{selected.id.slice(0, 8)}…</span></div>
          <div>source: {selected.source}</div>
          <div>created: {new Date(selected.created_at).toLocaleString()}</div>
          {selected.occurred_at && <div>occurred: {new Date(selected.occurred_at).toLocaleString()}</div>}
        </section>
      </div>
    </div>
  );
}
