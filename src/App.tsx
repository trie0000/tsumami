import { useEffect, useMemo, useRef, useState } from "react";
import { clamp, deepCopy, nowIso } from "./utils/helpers";
import { normalizeProject } from "./utils/normalization";
import { loadSavedProjects, deleteSavedProject, upsertSavedProject } from "./utils/storage";
import { makeTemplateMaruKiku, makeTemplateKenKiku, cloneFlowerWithNewIds } from "./utils/templates";
import { buildRecipe } from "./utils/recipe";

// ✅ コンポーネントは “外部ファイル側” を使う（重複定義しない）
import { Header } from "./components/Header";
import { Home } from "./components/Home";
import { NewProject } from "./components/NewProject";
import { Editor } from "./components/Editor";
import { Recipe } from "./components/Recipe";

/**
 * Tsumami Designer MVP
 * - Home / New / Editor / Recipe
 * - localStorage save/load
 * - SVG preview (petals arranged on circles)
 * - Undo/Redo (snapshot history)
 * - Copy/Paste whole flower + Z-order controls
 *
 * NOTE:
 * このファイルは「TypeScript構文なし」で動くようにしています（.tsxでもJSXとして解釈される環境対策）。
 */

export default function TsumamiDesignerMVP() {
  const [view, setView] = useState<string>("home");
  const [saved, setSaved] = useState<any[]>([]);
  const [project, setProject] = useState<any>(null);
  const [selection, setSelection] = useState<any>({ kind: "project" });

  // history
  const [hist, setHist] = useState<string[]>([]);
  const [histIndex, setHistIndex] = useState(0);

  // drag state (flower move)
  const dragRef = useRef<any>(null);

  // clipboard
  const flowerClipboardRef = useRef<any>(null);

  // toast
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    const t = toast ? window.setTimeout(() => setToast(null), 2200) : null;
    return () => {
      if (t) window.clearTimeout(t);
    };
  }, [toast]);

  useEffect(() => {
    setSaved(loadSavedProjects());
  }, []);

  function resetHistory(p: any) {
    const snap = JSON.stringify(p);
    setHist([snap]);
    setHistIndex(0);
  }

  function applyProjectUpdate(mutator: (draft: any) => void, commitHistory = true) {
    if (!project) return;
    const next = deepCopy(project);
    mutator(next);
    next.updatedAt = nowIso();
    setProject(next);

    if (!commitHistory) return;

    if (hist.length === 0) {
      resetHistory(next);
      return;
    }

    const snap = JSON.stringify(next);
    const head = hist.slice(0, histIndex + 1);
    const nextHist = [...head, snap];
    setHist(nextHist);
    setHistIndex(nextHist.length - 1);
  }

  function undo() {
    if (histIndex <= 0) return;
    const nextIndex = histIndex - 1;
    const snap = hist[nextIndex];
    setHistIndex(nextIndex);
    setProject(normalizeProject(JSON.parse(snap)));
    setToast("Undo");
  }

  function redo() {
    if (histIndex >= hist.length - 1) return;
    const nextIndex = histIndex + 1;
    const snap = hist[nextIndex];
    setHistIndex(nextIndex);
    setProject(normalizeProject(JSON.parse(snap)));
    setToast("Redo");
  }

  function saveProject() {
    if (!project) return;
    upsertSavedProject(project);
    setSaved(loadSavedProjects());
    setToast("Saved");
  }

  function exportJson() {
    if (!project) return;
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.title || "tsumami"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToast("JSON exported");
  }

  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? ""));
        if (!parsed || typeof parsed !== "object" || !parsed.flowers) throw new Error("Invalid JSON");
        const p = normalizeProject(parsed);
        setProject(p);
        setSelection({ kind: "project" });
        resetHistory(p);
        setView("editor");
        setToast("Imported");
      } catch {
        setToast("Import failed");
      }
    };
    reader.readAsText(file);
  }

  function goEditorWithNew(p: any) {
    const n = normalizeProject(p);
    setProject(n);
    setSelection({ kind: "project" });
    resetHistory(n);
    setView("editor");
  }

  function getSelectedFlowerIdFromSelection(sel: any) {
    if (!sel) return null;
    if (sel.kind === "flower" || sel.kind === "layer" || sel.kind === "petal") return sel.flowerId;
    return null;
  }

  function copySelectedFlower() {
    if (!project) return;
    const flowerId = getSelectedFlowerIdFromSelection(selection);
    if (!flowerId) return;
    const f = project.flowers.find((x) => x.id === flowerId);
    if (!f) return;
    flowerClipboardRef.current = deepCopy(f);

    try {
      void navigator.clipboard?.writeText(JSON.stringify({ type: "tsumami_flower", flower: f }, null, 2));
    } catch {
      // ignore
    }

    setToast("Flower copied");
  }

  function pasteFlower() {
    if (!project) return;
    const src = flowerClipboardRef.current;
    if (!src) {
      setToast("Nothing to paste");
      return;
    }

    const pasted = cloneFlowerWithNewIds(src, { x: 12, y: 12 });
    applyProjectUpdate((d) => {
      d.flowers.push(pasted);
    }, true);

    setSelection({ kind: "flower", flowerId: pasted.id });
    setToast("Flower pasted");
  }

  function arrangeSelectedFlower(action: string) {
    if (!project) return;
    const flowerId = getSelectedFlowerIdFromSelection(selection);
    if (!flowerId) return;

    applyProjectUpdate((d) => {
      const idx = d.flowers.findIndex((f) => f.id === flowerId);
      if (idx < 0) return;
      const arr = d.flowers;
      const item = arr[idx];
      if (!item) return;

      arr.splice(idx, 1);
      if (action === "front") {
        arr.push(item);
        return;
      }
      if (action === "back") {
        arr.unshift(item);
        return;
      }
      if (action === "forward") {
        const nextIdx = clamp(idx + 1, 0, arr.length);
        arr.splice(nextIdx, 0, item);
        return;
      }
      const prevIdx = clamp(idx - 1, 0, arr.length);
      arr.splice(prevIdx, 0, item);
    }, true);

    setToast(
      action === "front"
        ? "Brought to front"
        : action === "back"
        ? "Sent to back"
        : action === "forward"
        ? "Moved forward"
        : "Moved backward"
    );
  }

  // keyboard shortcuts
  useEffect(() => {
    function isTypingTarget(t: EventTarget | null) {
      const el = t as HTMLElement | null;
      if (!el) return false;
      const tag = String(el.tagName || "").toLowerCase();
      return tag === "input" || tag === "textarea" || tag === "select" || !!el.isContentEditable;
    }

    function onKey(e) {
      if (isTypingTarget(e.target)) return;

      const isMac = String(navigator.platform || "").toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      if (view === "editor") {
        if (e.key.toLowerCase() === "c") {
          e.preventDefault();
          copySelectedFlower();
          return;
        }
        if (e.key.toLowerCase() === "v") {
          e.preventDefault();
          pasteFlower();
          return;
        }
      }

      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveProject();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [project, hist, histIndex, selection, view]);

  const recipe = useMemo(() => (project ? buildRecipe(project) : null), [project]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <Header
        view={view}
        onNavigate={setView}
        project={project}
        onSave={saveProject}
        onExportJson={exportJson}
        onUndo={undo}
        onRedo={redo}
        canUndo={histIndex > 0}
        canRedo={histIndex < hist.length - 1}
      />

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-xl bg-neutral-900 px-4 py-2 text-sm text-white shadow">
          {toast}
        </div>
      )}

      {view === "home" && (
        <Home
          saved={saved}
          onNew={() => setView("new")}
          onOpen={(p) => {
            const n = normalizeProject(deepCopy(p));
            setProject(n);
            setSelection({ kind: "project" });
            resetHistory(n);
            setView("editor");
          }}
          onDelete={(id) => {
            deleteSavedProject(id);
            setSaved(loadSavedProjects());
            setToast("Deleted");
          }}
        />
      )}

      {view === "new" && (
        <NewProject
          onBack={() => setView("home")}
          onCreate={(template, title, fabricSquareSize) => {
            const p =
              template === "丸つまみ"
                ? makeTemplateMaruKiku({ title, fabricSquareSize })
                : makeTemplateKenKiku({ title, fabricSquareSize });
            goEditorWithNew(p);
          }}
        />
      )}

      {view === "editor" && project && (
        <Editor
          project={project}
          selection={selection}
          setSelection={setSelection}
          applyUpdate={applyProjectUpdate}
          onGoRecipe={() => setView("recipe")}
          onImport={importJson}
          dragRef={dragRef}
          onCopyFlower={copySelectedFlower}
          onPasteFlower={pasteFlower}
          onArrangeFlower={arrangeSelectedFlower}
          canPasteFlower={!!flowerClipboardRef.current}
        />
      )}

      {view === "recipe" && project && recipe && (
        <Recipe project={project} recipe={recipe} onBack={() => setView("editor")} onExportJson={exportJson} />
      )}

      {(view === "editor" || view === "recipe") && !project && (
        <div className="mx-auto max-w-3xl p-6">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="text-lg font-semibold">Project not loaded</div>
            <div className="mt-2 text-sm text-neutral-600">Homeから作品を開くか、新規作成してください。</div>
          </div>
        </div>
      )}
    </div>
  );
}
