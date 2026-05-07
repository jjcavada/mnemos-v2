// Resolve a memory's display color.
// Rule: greyscale by default. Project hue ONLY if is_project=true AND we know the project.
import type { Memory, Project } from "./types";

export const LIFE_GREY = "#4a4a52";

export function memoryColor(m: Memory, projectsById: Record<string, Project>): string {
  if (!m.is_project) return LIFE_GREY;
  if (m.project_id && projectsById[m.project_id]) return projectsById[m.project_id].color;
  return LIFE_GREY;
}

export const RELATION_EDGE_COLORS: Record<string, string> = {
  references: "#6b6b75",
  parent: "#a5b4fc",
  blocks: "#fca5a5",
  related: "#a8a8b1",
  semantic: "#c7d2fe",
  sequel: "#bbf7d0",
  causes: "#fde68a"
};

export const ANIMATED_RELATIONS = new Set(["causes", "blocks", "sequel"]);
