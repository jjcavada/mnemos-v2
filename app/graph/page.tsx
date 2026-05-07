"use client";
import { useState } from "react";
import { Graph2D } from "@/components/Graph2D";
import { Graph3D } from "@/components/Graph3D";
import { GraphCommandDeck } from "@/components/GraphCommandDeck";
import { MemoryDrawer } from "@/components/MemoryDrawer";
import { useMemoriesStore } from "@/store/memories";

export default function GraphPage() {
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  const { loading, memories } = useMemoriesStore();

  return (
    <div className="absolute inset-0 graph-stage overflow-hidden">
      <div className="absolute top-5 left-1/2 -translate-x-1/2 z-10 flex bg-black/45 border border-cyan-300/20 rounded-md p-1 backdrop-blur">
        <button
          onClick={() => setMode("2d")}
          className={`px-3 py-1 text-xs font-semibold rounded ${mode === "2d" ? "bg-cyan-200 text-black" : "text-text-3 hover:text-text-1"}`}
        >2D</button>
        <button
          onClick={() => setMode("3d")}
          className={`px-3 py-1 text-xs font-semibold rounded ${mode === "3d" ? "bg-cyan-200 text-black" : "text-text-3 hover:text-text-1"}`}
        >3D</button>
      </div>

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-text-3 z-5">
          <div className="font-mono text-xs tracking-[0.28em]">LOADING SECOND BRAIN</div>
        </div>
      )}

      {!loading && memories.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-text-3">
          <div className="text-center">
            <div className="text-4xl mb-2">.</div>
            <div>No memories yet. Run the migration.</div>
          </div>
        </div>
      )}

      {mode === "2d" ? <Graph2D /> : <Graph3D />}
      {!loading && memories.length > 0 && <GraphCommandDeck />}
      <MemoryDrawer />
    </div>
  );
}
