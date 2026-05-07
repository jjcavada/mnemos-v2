"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, Pencil } from "lucide-react";
import { sb } from "@/lib/supabase";
import type { Journal } from "@/lib/types";

const EMPTY_DRAFT = { win: "", lesson: "", followup: "", mood: "", energy: 7 };

export default function JournalPage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string>(todayStr());
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT });
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }
  const today = todayStr();
  const isEditingToday = editingDate === today;

  async function load() {
    const { data } = await sb.from("journals").select("*").order("date", { ascending: false }).limit(60);
    setJournals((data ?? []) as Journal[]);
  }
  useEffect(() => { load(); }, []);

  function startEdit(j: Journal) {
    setEditingId(j.id);
    setEditingDate(j.date);
    setDraft({
      win: j.win ?? "",
      lesson: j.lesson ?? "",
      followup: j.followup ?? "",
      mood: j.mood ?? "",
      energy: j.energy ?? 7
    });
    // scroll to top so the form is visible
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startNewToday() {
    setEditingId(null);
    setEditingDate(today);
    setDraft({ ...EMPTY_DRAFT });
  }

  async function save() {
    if (!draft.win.trim() && !draft.lesson.trim() && !draft.followup.trim()) return;
    setSaving(true);

    const payload = { date: editingDate, ...draft };
    if (editingId) {
      await sb.from("journals").update(payload).eq("id", editingId);
    } else {
      // check if a row already exists for this date (avoid duplicates)
      const { data: existing } = await sb.from("journals").select("id").eq("date", editingDate).limit(1);
      const existingId = (existing as Array<{ id: string }> | null)?.[0]?.id;
      if (existingId) {
        await sb.from("journals").update(payload).eq("id", existingId);
      } else {
        await sb.from("journals").insert(payload);
      }
    }

    // Mirror to mnemos memory (idempotent per date)
    const lines: string[] = [];
    if (draft.win.trim())      lines.push(`Win: ${draft.win.trim()}`);
    if (draft.lesson.trim())   lines.push(`Lesson: ${draft.lesson.trim()}`);
    if (draft.followup.trim()) lines.push(`Followup: ${draft.followup.trim()}`);
    if (draft.mood.trim())     lines.push(`Mood: ${draft.mood.trim()}`);
    if (draft.energy)          lines.push(`Energy: ${draft.energy}/10`);
    const content = lines.join("\n");

    if (content.length > 5) {
      try {
        await fetch("/api/capture/journal", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            date: editingDate,
            content,
            summary: `Journal · ${editingDate}`,
            mood: draft.mood.trim() || null,
            energy: draft.energy ?? null,
            importance: 0.65
          })
        });
      } catch {
        // non-blocking
      }
    }

    await load();
    // Clear the form back to a fresh "new for today" state
    setDraft({ ...EMPTY_DRAFT });
    setEditingId(null);
    setEditingDate(today);
    setSaving(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2600);
  }

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="sticky top-0 z-10 px-8 py-3" style={{ background: "rgba(5,5,5,0.78)", borderBottom: "0.5px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }}>
        <div className="flex items-baseline justify-between max-w-[680px] mx-auto">
          <span className="font-mono text-[10px] tracking-[0.32em] uppercase text-text-3">
            Journal · {isEditingToday ? "Today" : `Editing ${editingDate}`}
          </span>
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-text-4">{editingDate}</span>
        </div>
      </div>

      <div className="max-w-[680px] mx-auto px-8 pt-10 pb-16">
        {/* form for today or for a past entry being edited */}
        <section className="bento-card mb-8 spring-in" style={!isEditingToday ? { borderColor: "rgba(229,229,229,0.32)" } : undefined}>
          {!isEditingToday && (
            <div className="mb-5 flex items-center justify-between gap-3 pb-3" style={{ borderBottom: "0.5px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center gap-2 text-[12px] text-text-2">
                <Pencil className="w-3 h-3" />
                Editing entry for <span className="font-mono uppercase tracking-wider text-text-1">{editingDate}</span>
              </div>
              <button
                onClick={startNewToday}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11px] text-text-3 hover:text-text-1 transition-colors"
                style={{ background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)" }}
              >
                <ArrowLeft className="w-3 h-3" />
                Back to today
              </button>
            </div>
          )}

          <div className="space-y-6">
            <Field
              label="A win from the day"
              value={draft.win}
              onChange={(v) => setDraft({ ...draft, win: v })}
              placeholder="something that worked, however small"
            />
            <Field
              label="A lesson learned"
              value={draft.lesson}
              onChange={(v) => setDraft({ ...draft, lesson: v })}
              placeholder="what changed in your model of the world"
            />
            <Field
              label="A loop to follow up on"
              value={draft.followup}
              onChange={(v) => setDraft({ ...draft, followup: v })}
              placeholder="something unresolved, owed, or open"
            />

            <div className="grid grid-cols-2 gap-5 pt-2">
              <div>
                <label className="h-micro block mb-2">Mood</label>
                <input
                  value={draft.mood}
                  onChange={(e) => setDraft({ ...draft, mood: e.target.value })}
                  placeholder="focused · scattered · content"
                  className="w-full px-3 py-2 text-[13px] outline-none rounded-md text-text-1 placeholder-text-4"
                  style={{ background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.08)" }}
                />
              </div>
              <div>
                <label className="h-micro block mb-2">
                  Energy <span className="text-text-1 ml-1">{draft.energy}<span className="text-text-4">/10</span></span>
                </label>
                <input
                  type="range" min={1} max={10} value={draft.energy}
                  onChange={(e) => setDraft({ ...draft, energy: Number(e.target.value) })}
                  className="w-full mt-3"
                  style={{ accentColor: "#E5E5E5" }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3" style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
              <div className="font-mono text-[10px] tracking-[0.18em] uppercase">
                {savedFlash ? (
                  <span className="inline-flex items-center gap-1.5 text-text-1">
                    <Check className="w-3 h-3" />
                    Saved · captured to mnemos
                  </span>
                ) : (
                  <span className="text-text-4">
                    {editingId ? "edits will overwrite this entry" : "click any past entry below to edit it"}
                  </span>
                )}
              </div>
              <button
                onClick={save}
                disabled={saving || (!draft.win.trim() && !draft.lesson.trim() && !draft.followup.trim())}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-[12px] font-medium disabled:opacity-40 transition-opacity"
                style={{ background: "rgba(229,229,229,0.92)", color: "#0a0a0a" }}
              >
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                {saving ? "Saving" : editingId ? "Update entry" : "Save entry"}
              </button>
            </div>
          </div>
        </section>

        {/* recent entries — clickable to edit */}
        <div className="mb-3 flex items-baseline justify-between">
          <span className="h-micro">Recent entries · click to edit</span>
          <span className="font-mono text-[10px] tracking-[0.16em] text-text-4 uppercase">{journals.length}</span>
        </div>

        <div className="space-y-2">
          {journals.map(j => {
            const isToday = j.date === today;
            const active = editingId === j.id;
            return (
              <button
                key={j.id}
                onClick={() => startEdit(j)}
                className="bento-tight w-full text-left transition-colors hover:bg-white/[0.04]"
                style={active ? { borderColor: "rgba(229,229,229,0.45)" } : isToday ? { borderColor: "rgba(229,229,229,0.20)" } : undefined}
              >
                <div className="flex items-baseline justify-between mb-2">
                  <div className="flex items-baseline gap-2">
                    <div className="font-mono text-[11px] tracking-wider uppercase text-text-2">{j.date}</div>
                    {isToday && (
                      <span className="font-mono text-[9px] tracking-[0.22em] uppercase px-1.5 py-0.5 rounded" style={{ background: "rgba(229,229,229,0.12)", color: "#F4F4F5" }}>
                        today
                      </span>
                    )}
                    {active && (
                      <span className="font-mono text-[9px] tracking-[0.22em] uppercase px-1.5 py-0.5 rounded" style={{ background: "rgba(229,229,229,0.18)", color: "#F4F4F5" }}>
                        editing
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[10px] text-text-4 tracking-wider">
                    {j.mood ?? ""}{j.mood && j.energy ? " · " : ""}{j.energy ? `energy ${j.energy}/10` : ""}
                  </div>
                </div>
                <div className="space-y-1.5 text-[13px] leading-relaxed">
                  {j.win && <div className="text-text-1"><span className="h-micro mr-2">Win</span>{j.win}</div>}
                  {j.lesson && <div className="text-text-2"><span className="h-micro mr-2">Lesson</span>{j.lesson}</div>}
                  {j.followup && <div className="text-text-2"><span className="h-micro mr-2">Followup</span>{j.followup}</div>}
                </div>
              </button>
            );
          })}
          {journals.length === 0 && (
            <div className="text-center py-12 text-text-4 text-[12px]">No entries yet. Save above to start your streak.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="h-micro block mb-2">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 text-[14px] leading-relaxed outline-none rounded-md resize-none placeholder-text-4 text-text-1"
        style={{ background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.08)", letterSpacing: "0.001em" }}
      />
    </div>
  );
}
