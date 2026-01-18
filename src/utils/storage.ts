import { STORAGE_KEY } from "./constants";
import { normalizeProject } from "./normalization";

export function loadSavedProjects() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => {
        const proj = x?.project ? normalizeProject(x.project) : null;
        if (!proj) return null;
        return {
          id: x.id ?? proj.id,
          title: x.title ?? proj.title,
          updatedAt: x.updatedAt ?? proj.updatedAt,
          project: proj,
        };
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

export function saveSavedProjects(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function upsertSavedProject(project) {
  const list = loadSavedProjects();
  const idx = list.findIndex((p) => p.id === project.id);
  const entry = {
    id: project.id,
    title: project.title,
    updatedAt: project.updatedAt,
    project,
  };
  const next = idx >= 0 ? [...list.slice(0, idx), entry, ...list.slice(idx + 1)] : [entry, ...list];
  next.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  saveSavedProjects(next);
}

export function deleteSavedProject(id) {
  const next = loadSavedProjects().filter((p) => p.id !== id);
  saveSavedProjects(next);
}
