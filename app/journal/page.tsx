"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { sb } from "@/lib/supabase";
import type { Journal } from "@/lib/types";

export default function JournalPage() {
  const [journals, setJournals] = useState<Journal[]>([]);
  const [today, setToday] = useState<Journal | null>(null);
  const [draft, setDraft] = useState({ win: "", lesson: "", followup: "", mood: "", energy: 7 });
  const [saving, setSaving] = useState(false);
  const todayStr = new Date().toISOString().slice(0, 10);

  async function load() {
    const { data } = await sb.from("journals").select("*").order("date", { ascending: false }).limit(60);
    const list = (data ?? []) as Journal[];
    setJournals(list);
    const t = list.find(j => j.date === todayStr);
    if (t) {
      setToday(t);
      setDraft({ win: t.win ?? "", lesson: t.lesson ?? "", followup: t.followup ?? "", mood: t.mood ?? "", energy: t.energy ?? 7 });
    }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    const payload = { date: todayStr, ...draft };
    if (today) {
      await sb.from("journals").update(payload).eq("id", today.id);
    } else {
      await sb.from("journals").insert(payload);
    }

    // Also write a parallel memory so the AI can recall this journal entry later.
    // We build a single text blob from the structured fields + metadata.
    const lines: string[] = [`Journal · ${todayStr}`];
    if (draft.win.trim())      lines.push(`Win: ${draft.win.trim()}`);
    if (draft.lesson.trim())   lines.push(`Lesson: ${draft.lesson.trim()}`);
    if (draft.followup.trim()) lines.push(`Followup: ${draft.followup.trim()}`);
    if (draft.mood.trim())     lines.push(`Mood: ${draft.mood.trim()}`);
    if (draft.energy)          lines.push(`Energy: ${draft.energy}/10`);
    const text = lines.join("\n");

    if (text.length > 20) {
      try {
        await fetch("/api/capture/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            text,
            title: `Journal · ${todayStr}`,
            source: "manual",
            tags: ["journal", "daily-reflection", todayStr],
            is_project: false,
            life_area: "other",
            keep_raw: true,
            importance: 0.65,
            occurred_at: new Date(`${todayStr}T12:00:00`).toISOString(),
            mood: draft.mood.trim() || undefined
          })
        });
      } catch {
        // non-blocking: journal saved to journals table even if capture fails
      }
    }

    await load();
    setSaving(false);
  }

  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="sticky top-0 z-10 px-8 py-3" style={{ background: "rgba(5,5,5,0.78)", borderBottom: "0.5px solid rgba(255,255,255,0.06)", backdropFilter: "blur(20px)" }}>
        <div className="flex items-baseline justify-between max-w-[680px] mx-auto">
          <span className="font-mono text-[10px] tracking-[0.32em] uppercase text-text-3">Journal · Today</span>
          <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-text-4">{todayStr}</span>
        </div>
      </div>

      <div className="max-w-[680px] mx-auto px-8 pt-10 pb-16">
        {/* today's entry — single bento */}
        <section className="bento-card mb-10 spring-in">
          <div className="space-y-6">
            <Field
              label="A win from today"
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
                  className="w-full px-3 py-2 text-[13px] outline-none rounded-md"
                  style={{ background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.08)" }}
                />
              </div>
              <div>
                <label className="h-micro block mb-2">Energy <span className="text-text-1 ml-1">{draft.energy}<span className="text-text-4">/10</span></span></label>
                <input
                  type="range" min={1} max={10} value={draft.energy}
                  onChange={(e) => setDraft({ ...draft, energy: Number(e.target.value) })}
                  className="w-full mt-3"
                  style={{ accentColor: "#E5E5E5" }}
                />
              </div>
            </div>

            <div className="flex justify-end pt-3" style={{ borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-[12px] font-medium disabled:opacity-50 transition-opacity"
                style={{ background: "rgba(229,229,229,0.92)", color: "#0a0a0a" }}
              >
                {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                {saving ? "Saving" : today ? "Update entry" : "Save entry"}
              </button>
            </div>
          </div>
        </section>

        {/* past entries */}
        <div className="mb-3 flex items-baseline justify-between">
          <span className="h-micro">Past entries</span>
          <span className="font-mono text-[10px] tracking-[0.16em] text-text-4 uppercase">{journals.filter(j => j.date !== todayStr).length}</span>
        </div>

        <div className="space-y-2">
          {journals.filter(j => j.date !== todayStr).map(j => (
            <div key={j.id} className="bento-tight">
              <div className="flex items-baseline justify-between mb-2">
                <div className="font-mono text-[11px] tracking-wider uppercase text-text-2">{j.date}</div>
                <div className="font-mono text-[10px] text-text-4 tracking-wider">
                  {j.mood ?? ""}{j.mood && j.energy ? " · " : ""}{j.energy ? `energy ${j.energy}/10` : ""}
                </div>
              </div>
              <div className="space-y-1.5 text-[13px] leading-relaxed">
                {j.win && <div className="text-text-1"><span className="h-micro mr-2">Win</span>{j.win}</div>}
                {j.lesson && <div className="text-text-2"><span className="h-micro mr-2">Lesson</span>{j.lesson}</div>}
                {j.followup && <div className="text-text-2"><span className="h-micro mr-2">Followup</span>{j.followup}</div>}
              </div>
            </div>
          ))}
          {journals.filter(j => j.date !== todayStr).length === 0 && (
            <div className="text-center py-12 text-text-4 text-[12px]">No past entries yet.</div>
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
        className="w-full px-3 py-2.5 text-[14px] leading-relaxed outline-none rounded-md resize-none placeholder-text-4"
        style={{ background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.08)", letterSpacing: "0.001em" }}
      />
    </div>
  );
}
