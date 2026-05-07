"use client";
import { useMemoriesStore } from "@/store/memories";
import { X, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import type { Asset, Memory } from "@/lib/types";

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
    <>
      {/* dim+blur the page behind the drawer so text doesn't bleed through */}
      <div
        className="fixed top-[44px] right-[460px] left-[40px] bottom-0 z-20 fade-in"
        style={{ background: "rgba(5, 5, 5, 0.55)", backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)", pointerEvents: "none" }}
      />
      <div
        className="fixed top-[44px] right-0 bottom-0 w-[460px] z-30 overflow-y-auto drawer-in"
        style={{ background: "rgba(8, 8, 8, 0.94)", borderLeft: "0.5px solid rgba(255,255,255,0.10)", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)", boxShadow: "-12px 0 48px rgba(0,0,0,0.6)" }}
      >
      {/* head */}
      <div
        className="sticky top-0 px-5 py-4 flex items-start justify-between gap-3 z-10"
        style={{ background: "rgba(8, 8, 8, 0.94)", borderBottom: "0.5px solid rgba(255,255,255,0.06)", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)" }}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-micro">
              {selected.is_project ? (proj?.name ?? "project") : `life · ${selected.life_area ?? "other"}`}
            </span>
            <span className="type-badge">{selected.type}</span>
          </div>
          <div className="text-text-1 font-medium leading-snug text-[14px]">
            {selected.summary || selected.content.slice(0, 80)}
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <IconBtn onClick={() => setEditing(!editing)} aria-label="Edit"><Pencil className="w-3.5 h-3.5" /></IconBtn>
          <IconBtn onClick={deleteMemory} aria-label="Delete"><Trash2 className="w-3.5 h-3.5" /></IconBtn>
          <IconBtn onClick={() => select(null)} aria-label="Close"><X className="w-3.5 h-3.5" /></IconBtn>
        </div>
      </div>

      {/* body */}
      <div className="px-5 py-5 space-y-5">
        <section>
          <div className="h-micro mb-2">Content</div>
          {editing ? (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full min-h-[140px] p-3 text-[13px] outline-none rounded-lg"
                style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.08)" }}
              />
              <div className="flex gap-2">
                <button onClick={saveEdit} className="px-3 py-1.5 rounded text-[11px] font-medium" style={{ background: "rgba(229,229,229,0.92)", color: "#0a0a0a" }}>Save</button>
                <button onClick={() => { setEditing(false); setDraft(selected.content); }} className="px-3 py-1.5 rounded text-[11px] text-text-2" style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="text-text-2 text-[13px] leading-relaxed whitespace-pre-wrap">{selected.content}</div>
          )}
        </section>

        {selected.tags?.length > 0 && (
          <section>
            <div className="h-micro mb-2">Tags</div>
            <div className="flex flex-wrap gap-1.5">
              {selected.tags.map(t => (
                <span key={t} className="pill text-[11px] h-[22px]">{t}</span>
              ))}
            </div>
          </section>
        )}

        {assets.length > 0 && (
          <section>
            <div className="h-micro mb-2">Assets ({assets.length})</div>
            <div className="grid grid-cols-3 gap-2">
              {assets.map(a => (
                <a key={a.id} href={a.storage_url} target="_blank" rel="noreferrer"
                   className="aspect-square rounded-lg overflow-hidden"
                   style={{ background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.08)" }}>
                  {a.mime_type.startsWith("image/") ? (
                    <img src={a.storage_url} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-[10px] text-text-3 p-2">
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
            <div className="h-micro mb-2">Connected · {linked.length}</div>
            <div className="space-y-1.5">
              {linked.map(m => (
                <button key={m.id} onClick={() => select(m)} className="mem-card w-full text-left">
                  <div className="text-[12.5px] font-medium truncate text-text-1">{m.summary || m.content.slice(0, 60)}</div>
                  <div className="text-[10.5px] text-text-3 mt-1">
                    {m.is_project ? (m.project_id && projectsById[m.project_id]?.name) : (m.life_area ?? "life")} · {m.type}
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="pt-4 text-[10.5px] text-text-4 space-y-1 font-mono" style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
          <div>id  · {selected.id.slice(0, 8)}…</div>
          <div>src · {selected.source}</div>
          <div>at  · {new Date(selected.created_at).toLocaleString()}</div>
        </section>
      </div>
    </div>
    </>
  );
}

function IconBtn({ children, onClick, ...rest }: { children: React.ReactNode; onClick?: () => void; "aria-label"?: string }) {
  return (
    <button onClick={onClick} {...rest} className="p-1.5 rounded-md text-text-3 hover:text-text-1 transition-colors" style={{ background: "transparent" }}>
      {children}
    </button>
  );
}
