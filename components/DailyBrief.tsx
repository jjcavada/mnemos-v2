"use client";
import { useMemoriesStore } from "@/store/memories";
import { useMemo, useState } from "react";

export function DailyBrief() {
  const { memories, select } = useMemoriesStore();
  const [expanded, setExpanded] = useState<"yest" | "7d" | null>(null);

  const buckets = useMemo(() => {
    const now = new Date();
    const startToday = new Date(now); startToday.setHours(0,0,0,0);
    const startYest = new Date(startToday); startYest.setDate(startToday.getDate() - 1);
    const start7d = new Date(startToday); start7d.setDate(startToday.getDate() - 7);

    const today = memories.filter(m => new Date(m.created_at) >= startToday);
    const yest = memories.filter(m => {
      const d = new Date(m.created_at);
      return d >= startYest && d < startToday;
    });
    const week = memories.filter(m => new Date(m.created_at) >= start7d);
    const open = memories.filter(m => m.type === "todo" || m.type === "reminder" || m.type === "question");

    return { today, yest, week, open };
  }, [memories]);

  return (
    <div className="mt-6 pt-4 border-t border-border">
      <div className="h-section mb-3">Today's Brief</div>
      <div className="space-y-2 text-[13px]">
        <div className="flex justify-between">
          <span className="text-text-2">Today</span>
          <span className="text-text-1 font-semibold">{buckets.today.length}</span>
        </div>
        <button
          onClick={() => setExpanded(expanded === "yest" ? null : "yest")}
          className="flex justify-between w-full hover:text-text-1 transition-colors"
        >
          <span className="text-text-2">Yesterday</span>
          <span className="text-text-1 font-semibold">{buckets.yest.length}</span>
        </button>
        {expanded === "yest" && (
          <div className="ml-2 space-y-1 text-[11px] fade-in">
            {buckets.yest.slice(0, 5).map(m => (
              <button key={m.id} onClick={() => select(m)} className="block w-full text-left text-text-3 hover:text-text-2 truncate">
                · {m.summary || m.content.slice(0, 50)}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setExpanded(expanded === "7d" ? null : "7d")}
          className="flex justify-between w-full hover:text-text-1 transition-colors"
        >
          <span className="text-text-2">Last 7d</span>
          <span className="text-text-1 font-semibold">{buckets.week.length}</span>
        </button>
        {expanded === "7d" && (
          <div className="ml-2 space-y-1 text-[11px] fade-in">
            {buckets.week.slice(0, 8).map(m => (
              <button key={m.id} onClick={() => select(m)} className="block w-full text-left text-text-3 hover:text-text-2 truncate">
                · {m.summary || m.content.slice(0, 50)}
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-text-2">Open follow-ups</span>
          <span className="text-yellow-300 font-semibold">{buckets.open.length}</span>
        </div>
      </div>
    </div>
  );
}
