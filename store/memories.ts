"use client";
import { create } from "zustand";
import type { Memory, Relationship, LifeArea, Project } from "@/lib/types";
import { sb } from "@/lib/supabase";

type State = {
  memories: Memory[];
  relationships: Relationship[];
  lifeAreas: LifeArea[];
  projectsById: Record<string, Project>;
  projectsBySlug: Record<string, Project>;
  loading: boolean;
  selected: Memory | null;
  filters: {
    projects: Set<string>;     // project ids
    lifeAreas: Set<string>;    // slugs
    types: Set<string>;
    tags: Set<string>;
    showLife: boolean;
    showProjects: boolean;
    search: string;
  };
  load: () => Promise<void>;
  select: (m: Memory | null) => void;
  toggleFilter: (group: "projects"|"lifeAreas"|"types"|"tags", value: string) => void;
  clearFilter: (group: "projects"|"lifeAreas"|"types"|"tags") => void;
  setSearch: (q: string) => void;
  toggleSpace: (space: "life"|"projects") => void;
  refresh: () => Promise<void>;
};

export const useMemoriesStore = create<State>((set, get) => ({
  memories: [],
  relationships: [],
  lifeAreas: [],
  projectsById: {},
  projectsBySlug: {},
  loading: true,
  selected: null,
  filters: {
    projects: new Set(),
    lifeAreas: new Set(),
    types: new Set(),
    tags: new Set(),
    showLife: true,
    showProjects: true,
    search: ""
  },
  load: async () => {
    set({ loading: true });
    const [{ data: mems }, { data: rels }, { data: areas }, { data: projs }] = await Promise.all([
      sb.from("memories").select("*").order("created_at", { ascending: false }),
      sb.from("relationships").select("*"),
      sb.from("life_areas").select("*").order("sort_order"),
      sb.from("projects").select("*")
    ]);
    const byId: Record<string, Project> = {};
    const bySlug: Record<string, Project> = {};
    (projs ?? []).forEach((p: Project) => { byId[p.id] = p; bySlug[p.slug] = p; });
    set({
      memories: (mems ?? []) as Memory[],
      relationships: (rels ?? []) as Relationship[],
      lifeAreas: (areas ?? []) as LifeArea[],
      projectsById: byId,
      projectsBySlug: bySlug,
      loading: false
    });
  },
  select: (m) => set({ selected: m }),
  toggleFilter: (group, value) => {
    const cur = new Set(get().filters[group]);
    cur.has(value) ? cur.delete(value) : cur.add(value);
    set({ filters: { ...get().filters, [group]: cur } });
  },
  clearFilter: (group) => set({ filters: { ...get().filters, [group]: new Set() } }),
  setSearch: (q) => set({ filters: { ...get().filters, search: q } }),
  toggleSpace: (space) => {
    const f = get().filters;
    const key = space === "life" ? "showLife" : "showProjects";
    set({ filters: { ...f, [key]: !f[key] } });
  },
  refresh: async () => { await get().load(); }
}));

export function applyFilters(all: Memory[]) {
  const f = useMemoriesStore.getState().filters;
  return all.filter(m => {
    if (m.is_project && !f.showProjects) return false;
    if (!m.is_project && !f.showLife) return false;
    if (f.projects.size && !(m.project_id && f.projects.has(m.project_id))) return false;
    if (f.lifeAreas.size && !(m.life_area && f.lifeAreas.has(m.life_area))) return false;
    if (f.types.size && !f.types.has(m.type)) return false;
    if (f.tags.size && !m.tags?.some(t => f.tags.has(t))) return false;
    if (f.search) {
      const q = f.search.toLowerCase();
      const hay = (m.content + " " + (m.summary ?? "") + " " + (m.tags ?? []).join(" ")).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
