"use client";
import { useEffect, useState } from "react";
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
    await load();
    setSaving(false);
  }

  return (
    <div className="absolute inset-0 overflow-y-auto p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Journal</h1>
      <p className="text-text-3 text-sm mb-8">Daily reflection. Three questions, one line each. Build the streak.</p>

      <section className="bg-bg-1 border border-border rounded-xl p-6 mb-8">
        <div className="text-text-3 text-xs uppercase tracking-wider mb-4">Today · {todayStr}</div>
        <Field label="What's a win from today?" value={draft.win}
               onChange={(v) => setDraft({ ...draft, win: v })} />
        <Field label="What did I learn?" value={draft.lesson}
               onChange={(v) => setDraft({ ...draft, lesson: v })} />
        <Field label="What needs follow-up?" value={draft.followup}
               onChange={(v) => setDraft({ ...draft, followup: v })} />

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="text-[11px] text-text-3 uppercase tracking-wider">Mood</label>
            <input
              value={draft.mood}
              onChange={(e) => setDraft({ ...draft, mood: e.target.value })}
              placeholder="e.g. focused, scattered, content"
              className="w-full bg-bg-2 border border-border rounded px-3 py-2 mt-1 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-[11px] text-text-3 uppercase tracking-wider">Energy {draft.energy}/10</label>
            <input
              type="range" min={1} max={10} value={draft.energy}
              onChange={(e) => setDraft({ ...draft, energy: Number(e.target.value) })}
              className="w-full mt-3 accent-accent"
            />
          </div>
        </div>

        <button onClick={save} disabled={saving}
                className="mt-6 px-5 py-2 bg-accent text-black rounded-lg text-sm font-semibold hover:bg-accent-bright transition-colors disabled:opacity-50">
          {saving ? "Saving…" : today ? "Update" : "Save"}
        </button>
      </section>

      <h2 className="text-sm font-semibold text-text-2 mb-3 mt-10">Past entries</h2>
      <div className="space-y-3">
        {journals.filter(j => j.date !== todayStr).map(j => (
          <div key={j.id} className="bg-bg-1 border border-border rounded-lg p-4">
            <div className="flex items-baseline justify-between mb-2">
              <div className="text-text-1 text-sm font-semibold">{j.date}</div>
              <div className="text-[11px] text-text-3">{j.mood ?? ""} {j.energy ? `· energy ${j.energy}/10` : ""}</div>
            </div>
            {j.win && <div className="text-text-2 text-sm"><span className="text-green-400">win:</span> {j.win}</div>}
            {j.lesson && <div className="text-text-2 text-sm"><span className="text-blue-400">lesson:</span> {j.lesson}</div>}
            {j.followup && <div className="text-text-2 text-sm"><span className="text-yellow-400">followup:</span> {j.followup}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-4">
      <label className="text-[11px] text-text-3 uppercase tracking-wider">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full bg-bg-2 border border-border rounded px-3 py-2 mt-1 text-sm outline-none focus:border-accent resize-none"
      />
    </div>
  );
}
