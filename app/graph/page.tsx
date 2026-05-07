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
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-text-3 z-5 pointer-events-none">
          <div className="font-mono text-[10px] tracking-[0.32em] uppercase">loading</div>
        </div>
      )}

      {!loading && memories.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-text-3">
          <div className="text-center text-[12px]">
            No memories yet.
          </div>
        </div>
      )}

      {mode === "2d" ? <Graph2D /> : <Graph3D />}
      {!loading && memories.length > 0 && <GraphCommandDeck />}

      {/* mode toggle — micro, top right */}
      <div
        className="absolute top-3 right-3 z-10 flex rounded-md overflow-hidden"
        style={{ background: "rgba(15,15,15,0.55)", border: "0.5px solid rgba(255,255,255,0.08)", backdropFilter: "blur(40px)", WebkitBackdropFilter: "blur(40px)" }}
      >
        {(["2d","3d"] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="font-mono text-[10px] tracking-wider uppercase px-3 py-1.5 transition-colors"
            style={mode === m
              ? { background: "rgba(229,229,229,0.92)", color: "#0a0a0a", fontWeight: 500 }
              : { color: "#71717A" }
            }
          >{m}</button>
        ))}
      </div>

      <MemoryDrawer />
    </div>
  );
}
