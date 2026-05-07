"use client";
import { useState } from "react";
import { Graph2D } from "@/components/Graph2D";
import { Graph3D } from "@/components/Graph3D";
import { MemoryDrawer } from "@/components/MemoryDrawer";
import { useMemoriesStore } from "@/store/memories";

export default function GraphPage() {
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  const { loading, memories } = useMemoriesStore();

  return (
    <div className="absolute inset-0">
      {/* mode toggle */}
      <div className="absolute top-4 right-4 z-10 flex bg-bg-2 border border-border rounded-lg p-1">
        <button
          onClick={() => setMode("2d")}
          className={`px-3 py-1 text-xs font-medium rounded ${mode === "2d" ? "bg-bg-4 text-text-1" : "text-text-3 hover:text-text-2"}`}
        >2D</button>
        <button
          onClick={() => setMode("3d")}
          className={`px-3 py-1 text-xs font-medium rounded ${mode === "3d" ? "bg-bg-4 text-text-1" : "text-text-3 hover:text-text-2"}`}
        >3D</button>
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-text-3 z-5">
          <div className="text-sm">Loading your second brain…</div>
        </div>
      )}

      {!loading && memories.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-text-3">
          <div className="text-center">
            <div className="text-4xl mb-2">·</div>
            <div>No memories yet. Run the migration.</div>
          </div>
        </div>
      )}

      {mode === "2d" ? <Graph2D /> : <Graph3D />}
      <MemoryDrawer />
    </div>
  );
}
