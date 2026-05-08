"use client";
import { create } from "zustand";

type State = {
  /**
   * Graph node id to pan/zoom to. Consumed by Graph2D — set by CommandK or
   * any other surface that wants to fly the camera to a known node.
   *
   * id formats:
   *   "me:jay"
   *   "cat:project:<projectId>"
   *   "cat:life:<lifeSlug>"
   *   "<memoryId>"
   *
   * `selectMemory` is a hint: when true and the node resolves to a memory,
   * Graph2D will also open the memory drawer.
   */
  target: { id: string; selectMemory: boolean; nonce: number } | null;
  focus: (id: string, selectMemory?: boolean) => void;
  clear: () => void;
};

export const useGraphFocus = create<State>((set, get) => ({
  target: null,
  focus: (id, selectMemory = true) =>
    set({ target: { id, selectMemory, nonce: (get().target?.nonce ?? 0) + 1 } }),
  clear: () => set({ target: null })
}));
