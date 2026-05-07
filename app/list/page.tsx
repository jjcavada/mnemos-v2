"use client";
import { useMemoriesStore, applyFilters } from "@/store/memories";
import { memoryColor } from "@/lib/colors";
import { MemoryDrawer } from "@/components/MemoryDrawer";

export default function ListPage() {
  const { memories, projectsById, select } = useMemoriesStore();
  const list = applyFilters(memories);

  return (
    <div className="absolute inset-0 overflow-y-auto p-8 max-w-4xl mx-auto">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-semibold">List</h1>
        <div className="text-text-3 text-sm">{list.length} memories</div>
      </div>
      <div className="space-y-2">
        {list.map(m => (
          <button
            key={m.id}
            onClick={() => select(m)}
            className="mem-card w-full text-left flex items-start gap-3"
          >
            <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: memoryColor(m, projectsById) }} />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] text-text-1 font-medium">{m.summary || m.content.slice(0, 100)}</div>
              <div className="text-[11px] text-text-3 mt-1">
                {new Date(m.created_at).toLocaleDateString()} · {m.is_project ? (m.project_id && projectsById[m.project_id]?.name) : (m.life_area ?? "life")} · {m.type}
                {m.tags?.length ? ` · ${m.tags.slice(0, 3).map(t => "#" + t).join(" ")}` : ""}
              </div>
            </div>
          </button>
        ))}
      </div>
      <MemoryDrawer />
    </div>
  );
}
