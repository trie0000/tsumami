import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Tsumami Designer MVP (single file / JSX)
 * - Home / New / Editor / Recipe
 * - localStorage save/load
 * - SVG preview (petals arranged on circles)
 * - Undo/Redo (snapshot history)
 * - Copy/Paste whole flower + Z-order controls
 *
 * NOTE:
 * このファイルは「TypeScript構文なし」で動くようにしています（.tsxでもJSXとして解釈される環境対策）。
 */

// =========================
// Constants / Utils
// =========================

const STORAGE_KEY = "tsumami_projects_v1";

const PETAL_TYPES = ["丸つまみ", "剣つまみ"]; // UI/保存はこれに統一

const nowIso = () => new Date().toISOString();
const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const deepCopy = (obj) => JSON.parse(JSON.stringify(obj));

const degToRad = (d) => (d * Math.PI) / 180;

function normalizePetalType(v) {
  if (v === "maru") return "丸つまみ";
  if (v === "ken") return "剣つまみ";
  if (v === "丸つまみ" || v === "剣つまみ") return v;
  return "丸つまみ";
}

function normalizeProject(p) {
  const d = deepCopy(p || {});
  if (!Array.isArray(d.flowers)) d.flowers = [];

  for (const f of d.flowers) {
    if (!Array.isArray(f.layers)) f.layers = [];
    for (const l of f.layers) {
      l.petalType = normalizePetalType(l.petalType);
      l.petalCount = clamp(Number(l.petalCount || 0), 5, 24);
      if (!Number.isFinite(l.scale)) l.scale = 1;
      if (!Number.isFinite(l.widthScale)) l.widthScale = 1;
      if (!Number.isFinite(l.radius)) l.radius = 28;
      if (!Number.isFinite(l.offsetAngle)) l.offsetAngle = 0;

      if (Array.isArray(l.petalOverrides)) {
        for (const o of l.petalOverrides) {
          if (o && o.petalType != null) o.petalType = normalizePetalType(o.petalType);
        }
      }
    }
  }

  // Palette
  if (!Array.isArray(d.palette)) d.palette = makeDefaultPalette();
  if (!d.createdAt) d.createdAt = nowIso();
  if (!d.updatedAt) d.updatedAt = d.createdAt;
  if (!d.id) d.id = uid("proj");
  if (!d.title) d.title = "つまみ細工デザイン";
  d.unit = "mm"; // fixed (UIから削除)
  if (!Number.isFinite(d.fabricSquareSize)) d.fabricSquareSize = 20;
  if (typeof d.notes !== "string") d.notes = "";
  return d;
}

// =========================
// Self tests (console.assert)
// =========================
(function runSelfTests() {
  try {
    console.assert(normalizePetalType("maru") === "丸つまみ", "normalizePetalType(maru) failed");
    console.assert(normalizePetalType("ken") === "剣つまみ", "normalizePetalType(ken) failed");
    const t = normalizeProject({
      id: "t",
      title: "t",
      flowers: [{ id: "f", name: "f", position: { x: 0, y: 0 }, flowerDiameter: 60, rotation: 0, layers: [{ id: "l", name: "l", order: 1, petalType: "ken", petalCount: 99 }] }],
    });
    console.assert(t.flowers[0].layers[0].petalType === "剣つまみ", "normalizeProject petalType failed");
    console.assert(t.flowers[0].layers[0].petalCount === 24, "normalizeProject petalCount clamp failed");
  } catch {
    // ignore
  }
})();

function loadSavedProjects() {
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

function saveSavedProjects(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function upsertSavedProject(project) {
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

function deleteSavedProject(id) {
  const next = loadSavedProjects().filter((p) => p.id !== id);
  saveSavedProjects(next);
}

function cloneFlowerWithNewIds(src, offset) {
  const f = deepCopy(src);
  f.id = uid("flw");
  f.name = `${src.name} Copy`;
  const dx = offset?.x ?? 12;
  const dy = offset?.y ?? 12;
  f.position = { x: (src.position?.x ?? 0) + dx, y: (src.position?.y ?? 0) + dy };
  f.layers = (f.layers || []).map((l) => ({
    ...l,
    id: uid("lay"),
    petalOverrides: l.petalOverrides ? l.petalOverrides.map((o) => ({ ...o })) : undefined,
  }));
  return f;
}

// =========================
// Templates
// =========================

function makeDefaultPalette() {
  return [
    { id: "col_green", name: "Green", hex: "#2FBF4A" },
    { id: "col_white", name: "White", hex: "#F5F5F5" },
    { id: "col_red", name: "Red", hex: "#E34850" },
    { id: "col_pink", name: "Pink", hex: "#F08CB6" },
    { id: "col_yellow", name: "Yellow", hex: "#F2D04B" },
  ];
}

function makeTemplateMaruKiku({ title, fabricSquareSize } = {}) {
  const createdAt = nowIso();
  const palette = makeDefaultPalette();

  const flower = {
    id: uid("flw"),
    name: "Flower 1",
    position: { x: 0, y: 0 },
    flowerDiameter: 60,
    rotation: 0,
    layers: [
      {
        id: uid("lay"),
        name: "Outer",
        order: 1,
        petalType: "丸つまみ",
        petalCount: 6,
        radius: 28,
        scale: 1,
        widthScale: 1,
        offsetAngle: 0,
        colorId: "col_green",
        visible: true,
        locked: false,
      },
      {
        id: uid("lay"),
        name: "Inner",
        order: 2,
        petalType: "丸つまみ",
        petalCount: 6,
        radius: 20,
        scale: 1,
        widthScale: 1,
        offsetAngle: 10,
        colorId: "col_white",
        visible: true,
        locked: false,
      },
      {
        id: uid("lay"),
        name: "Center",
        order: 3,
        petalType: "丸つまみ",
        petalCount: 6,
        radius: 12,
        scale: 1,
        widthScale: 1,
        offsetAngle: 0,
        colorId: "col_white",
        visible: true,
        locked: false,
      },
    ],
  };

  return normalizeProject({
    version: 1,
    id: uid("proj"),
    title: title ?? "丸つまみ菊（テンプレ）",
    unit: "mm",
    fabricSquareSize: fabricSquareSize ?? 20,
    notes: "",
    createdAt,
    updatedAt: createdAt,
    palette,
    flowers: [flower],
  });
}

function makeTemplateKenKiku({ title, fabricSquareSize } = {}) {
  const createdAt = nowIso();
  const palette = makeDefaultPalette();

  const flower = {
    id: uid("flw"),
    name: "Flower 1",
    position: { x: 0, y: 0 },
    flowerDiameter: 70,
    rotation: 0,
    layers: [
      {
        id: uid("lay"),
        name: "Outer",
        order: 1,
        petalType: "剣つまみ",
        petalCount: 6,
        radius: 32,
        scale: 1,
        widthScale: 1,
        offsetAngle: 0,
        colorId: "col_red",
        visible: true,
        locked: false,
      },
      {
        id: uid("lay"),
        name: "Inner",
        order: 2,
        petalType: "剣つまみ",
        petalCount: 6,
        radius: 24,
        scale: 1,
        widthScale: 1,
        offsetAngle: 7,
        colorId: "col_pink",
        visible: true,
        locked: false,
      },
      {
        id: uid("lay"),
        name: "Center",
        order: 3,
        petalType: "丸つまみ",
        petalCount: 6,
        radius: 14,
        scale: 1,
        widthScale: 1,
        offsetAngle: 0,
        colorId: "col_yellow",
        visible: true,
        locked: false,
      },
    ],
  };

  return normalizeProject({
    version: 1,
    id: uid("proj"),
    title: title ?? "剣つまみ菊（テンプレ）",
    unit: "mm",
    fabricSquareSize: fabricSquareSize ?? 20,
    notes: "",
    createdAt,
    updatedAt: createdAt,
    palette,
    flowers: [flower],
  });
}

// =========================
// Geometry (petal)
// =========================

function computePetalSizing(fabricSquareSizeMm) {
  // ベースの花びらサイズ（scale=1, widthScale=1 のときの基準）
  // 要件:
  // - 縦:横 = 2:1
  // - 現状ベースのサイズを 2 倍
  const length = fabricSquareSizeMm * 0.9 * 1.5 * 2;
  const width = length / 2;
  return { length, width };
}

// ユニット形状を上下非対称にして「中心向きの方が長い」見え方にする。
// -Y（上側）が中心方向、+Y（下側）が外側方向。
const PETAL_INWARD_FRACTION = 0.65;
const PETAL_OUTWARD_FRACTION = 0.35;
const PETAL_UNIT_TOP_Y = -PETAL_INWARD_FRACTION; // -0.65
const PETAL_UNIT_BOTTOM_Y = PETAL_OUTWARD_FRACTION; // +0.35
const PETAL_UNIT_MID_Y = (PETAL_UNIT_TOP_Y + PETAL_UNIT_BOTTOM_Y) / 2; // -0.15

const UNIT_PETAL_PATHS = {
  // 丸つまみ: 楕円
  "丸つまみ": `M 0 ${PETAL_UNIT_TOP_Y}
         A 0.5 0.5 0 1 1 0 ${PETAL_UNIT_BOTTOM_Y}
         A 0.5 0.5 0 1 1 0 ${PETAL_UNIT_TOP_Y}
         Z`,
  // 剣つまみ: 菱形
  "剣つまみ": `M 0 ${PETAL_UNIT_TOP_Y}
        L 0.5 ${PETAL_UNIT_MID_Y}
        L 0 ${PETAL_UNIT_BOTTOM_Y}
        L -0.5 ${PETAL_UNIT_MID_Y}
        Z`,
};

function petalUnitPath(type) {
  return type === "剣つまみ" ? UNIT_PETAL_PATHS["剣つまみ"] : UNIT_PETAL_PATHS["丸つまみ"];
}

// =========================
// Recipe
// =========================

function buildRecipe(project) {
  const colorMap = new Map((project.palette || []).map((c) => [c.id, c]));
  const totals = new Map();

  const perFlower = [];
  const findOverride = (layer, index) => layer?.petalOverrides?.find((o) => o.index === index) ?? null;

  for (const flower of project.flowers || []) {
    const layersSorted = [...(flower.layers || [])].sort((a, b) => a.order - b.order);
    const steps = [];

    for (const layer of layersSorted) {
      if (!layer.visible) continue;

      for (let i = 0; i < layer.petalCount; i++) {
        const ov = findOverride(layer, i);
        const effectiveColorId = ov?.colorId ?? layer.colorId;
        totals.set(effectiveColorId, (totals.get(effectiveColorId) ?? 0) + 1);
      }

      const col = colorMap.get(layer.colorId);
      const colorLabel = col ? col.name : layer.colorId;
      const typeLabel = layer.petalType;
      const hasOverrides = (layer.petalOverrides?.length ?? 0) > 0;

      const stepText = `Layer ${layer.order}（${layer.name}）: ${typeLabel} ${layer.petalCount}枚（基本色: ${colorLabel}）を作る → 円周に等間隔で貼る（offset=${layer.offsetAngle}°）${hasOverrides ? "（※個別変更あり）" : ""}`;
      steps.push({ layer, stepText });
    }

    perFlower.push({ flower, layers: steps });
  }

  const rows = Array.from(totals.entries())
    .map(([colorId, count]) => {
      const c = colorMap.get(colorId);
      return {
        colorId,
        colorName: c?.name ?? colorId,
        hex: c?.hex ?? "#999999",
        fabricSquareSize: project.fabricSquareSize,
        count,
      };
    })
    .sort((a, b) => b.count - a.count);

  return { rows, perFlower };
}

// =========================
// App
// =========================

export default function TsumamiDesignerMVP() {
  const [view, setView] = useState("home");
  const [saved, setSaved] = useState([]);
  const [project, setProject] = useState(null);
  const [selection, setSelection] = useState({ kind: "project" });

  // history
  const [hist, setHist] = useState([]);
  const [histIndex, setHistIndex] = useState(0);

  // drag state (flower move)
  const dragRef = useRef(null);

  // clipboard
  const flowerClipboardRef = useRef(null);

  // toast
  const [toast, setToast] = useState(null);
  useEffect(() => {
    const t = toast ? window.setTimeout(() => setToast(null), 2200) : null;
    return () => {
      if (t) window.clearTimeout(t);
    };
  }, [toast]);

  useEffect(() => {
    setSaved(loadSavedProjects());
  }, []);

  function resetHistory(p) {
    const snap = JSON.stringify(p);
    setHist([snap]);
    setHistIndex(0);
  }

  function applyProjectUpdate(mutator, commitHistory = true) {
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

  function importJson(file) {
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

  function goEditorWithNew(p) {
    const n = normalizeProject(p);
    setProject(n);
    setSelection({ kind: "project" });
    resetHistory(n);
    setView("editor");
  }

  function getSelectedFlowerIdFromSelection(sel) {
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

  function arrangeSelectedFlower(action) {
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
    function isTypingTarget(t) {
      const el = t;
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
            const p = template === "丸つまみ" ? makeTemplateMaruKiku({ title, fabricSquareSize }) : makeTemplateKenKiku({ title, fabricSquareSize });
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

// =========================
// Components
// =========================

function Header(props) {
  const { view, onNavigate, project } = props;
  return (
    <div className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-base font-semibold shrink-0">Tsumami Designer MVP</div>
          <div className="hidden sm:block text-sm text-neutral-500 truncate">{project ? project.title : "—"}</div>
        </div>

        <div className="flex items-center gap-2">
          <NavButton active={view === "home"} onClick={() => onNavigate("home")}>Home</NavButton>
          <NavButton active={view === "new"} onClick={() => onNavigate("new")}>New</NavButton>
          <NavButton active={view === "editor"} onClick={() => onNavigate("editor")} disabled={!project}>Editor</NavButton>
          <NavButton active={view === "recipe"} onClick={() => onNavigate("recipe")} disabled={!project}>Recipe</NavButton>
        </div>

        <div className="flex items-center gap-2">
          <button
            className={`rounded-xl border px-3 py-1.5 text-sm shadow-sm ${
              props.canUndo ? "bg-white hover:bg-neutral-50" : "bg-neutral-100 text-neutral-400"
            }`}
            onClick={props.onUndo}
            disabled={!props.canUndo}
            title="Ctrl/Cmd+Z"
          >
            Undo
          </button>
          <button
            className={`rounded-xl border px-3 py-1.5 text-sm shadow-sm ${
              props.canRedo ? "bg-white hover:bg-neutral-50" : "bg-neutral-100 text-neutral-400"
            }`}
            onClick={props.onRedo}
            disabled={!props.canRedo}
            title="Ctrl/Cmd+Shift+Z"
          >
            Redo
          </button>
          <button
            className="rounded-xl border bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-neutral-50"
            onClick={props.onSave}
            disabled={!project}
            title="Ctrl/Cmd+S"
          >
            Save
          </button>
          <button
            className="rounded-xl border bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-neutral-50"
            onClick={props.onExportJson}
            disabled={!project}
          >
            Export JSON
          </button>
        </div>
      </div>
    </div>
  );
}

function NavButton({ active, disabled, onClick, children }) {
  return (
    <button
      className={`rounded-xl px-3 py-1.5 text-sm ${
        active
          ? "bg-neutral-900 text-white"
          : disabled
          ? "bg-neutral-100 text-neutral-400"
          : "bg-white text-neutral-800 hover:bg-neutral-50"
      } border shadow-sm`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Home(props) {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold">Projects</div>
          <div className="mt-1 text-sm text-neutral-600">ローカル保存（localStorage）です。Saveで一覧に反映されます。</div>
        </div>
        <button
          className="rounded-2xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-neutral-800"
          onClick={props.onNew}
        >
          New Project
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {props.saved.length === 0 && (
          <div className="rounded-2xl border bg-white p-6 text-sm text-neutral-600 shadow-sm">
            まだ保存されたプロジェクトがありません。New Projectから作成してください。
          </div>
        )}
        {props.saved.map((p) => (
          <div key={p.id} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-lg font-semibold">{p.title}</div>
            <div className="mt-1 text-xs text-neutral-500">Updated: {p.updatedAt}</div>
            <div className="mt-4 flex gap-2">
              <button
                className="flex-1 rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                onClick={() => props.onOpen(p.project)}
              >
                Open
              </button>
              <button
                className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-neutral-50"
                onClick={() => props.onDelete(p.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewProject(props) {
  const [template, setTemplate] = useState("丸つまみ");
  const [title, setTitle] = useState("つまみ細工デザイン");
  const [fabricSquareSize, setFabricSquareSize] = useState(20);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold">New Project</div>
            <div className="mt-1 text-sm text-neutral-600">テンプレを選んで、編集画面を立ち上げます。</div>
          </div>
          <button className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-neutral-50" onClick={props.onBack}>
            Back
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border p-4">
            <div className="text-sm font-semibold">Template</div>
            <div className="mt-3 flex gap-2">
              <button
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${
                  template === "丸つまみ" ? "bg-neutral-900 text-white" : "bg-white hover:bg-neutral-50"
                } border`}
                onClick={() => setTemplate("丸つまみ")}
              >
                丸つまみ菊
              </button>
              <button
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${
                  template === "剣つまみ" ? "bg-neutral-900 text-white" : "bg-white hover:bg-neutral-50"
                } border`}
                onClick={() => setTemplate("剣つまみ")}
              >
                剣つまみ菊
              </button>
            </div>
            <div className="mt-4 text-xs text-neutral-600">
              MVPでも花びら（Petal）単体の色・形状を上書きできます（Layer基本設定＋必要な箇所だけ個別変更）。
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-sm font-semibold">Initial settings</div>
            <div className="mt-3 space-y-3">
              <Labeled>
                <span>title</span>
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Labeled>
              <Labeled>
                <span>fabricSquareSize (mm)</span>
                <input
                  type="number"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={fabricSquareSize}
                  min={5}
                  max={60}
                  onChange={(e) => setFabricSquareSize(clamp(Number(e.target.value || 0), 5, 60))}
                />
              </Labeled>
              <button
                className="w-full rounded-2xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-neutral-800"
                onClick={() => props.onCreate(template, title, fabricSquareSize)}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Editor(props) {
  const { project, selection, setSelection, applyUpdate } = props;

  const paletteMap = useMemo(() => new Map((project.palette || []).map((c) => [c.id, c])), [project.palette]);

  // Left tree expand state (persisted)
  const EXPAND_KEY = useMemo(() => `tsumami_tree_expanded_v1_${project.id}`, [project.id]);
  const [expandedFlowers, setExpandedFlowers] = useState({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(EXPAND_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setExpandedFlowers(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
    const first = project.flowers?.[0];
    if (first) setExpandedFlowers({ [first.id]: true });
  }, [EXPAND_KEY]);

  useEffect(() => {
    try {
      localStorage.setItem(EXPAND_KEY, JSON.stringify(expandedFlowers));
    } catch {
      // ignore
    }
  }, [EXPAND_KEY, expandedFlowers]);

  useEffect(() => {
    if (selection.kind === "flower" || selection.kind === "layer" || selection.kind === "petal") {
      const fid = selection.flowerId;
      setExpandedFlowers((prev) => (prev?.[fid] ? prev : { ...prev, [fid]: true }));
    }
  }, [selection]);

  const isExpanded = (flowerId) => expandedFlowers?.[flowerId] ?? false;
  const toggleExpanded = (flowerId) => setExpandedFlowers((prev) => ({ ...prev, [flowerId]: !(prev?.[flowerId] ?? false) }));

  // Flower row click behavior:
  // - Single click: select flower + expand
  // - Double click: toggle expand/collapse
  const flowerClickRef = useRef({ flowerId: null, timer: null });

  const scheduleFlowerRowClick = (flowerId) => {
    const t = flowerClickRef.current.timer;
    if (t) window.clearTimeout(t);
    flowerClickRef.current.flowerId = flowerId;
    flowerClickRef.current.timer = window.setTimeout(() => {
      setSelection({ kind: "flower", flowerId });
      setExpandedFlowers((prev) => ({ ...prev, [flowerId]: true }));
      flowerClickRef.current.timer = null;
      flowerClickRef.current.flowerId = null;
    }, 200);
  };

  const handleFlowerRowDoubleClick = (flowerId) => {
    const t = flowerClickRef.current.timer;
    if (t && flowerClickRef.current.flowerId === flowerId) window.clearTimeout(t);
    flowerClickRef.current.timer = null;
    flowerClickRef.current.flowerId = null;
    setSelection({ kind: "flower", flowerId });
    toggleExpanded(flowerId);
  };

  const stageRef = useRef(null);
  const fileInputRef = useRef(null);

  // Canvas view
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const viewBox = useMemo(() => {
    const w = 520;
    const h = 520;
    const cx = -w / 2 - pan.x;
    const cy = -h / 2 - pan.y;
    return `${cx / zoom} ${cy / zoom} ${w / zoom} ${h / zoom}`;
  }, [zoom, pan]);

  const selectedFlower = useMemo(() => {
    if (selection.kind === "flower" || selection.kind === "layer" || selection.kind === "petal") {
      return project.flowers.find((f) => f.id === selection.flowerId) ?? null;
    }
    return null;
  }, [project.flowers, selection]);

  const selectedLayer = useMemo(() => {
    if (!selectedFlower) return null;
    if (selection.kind === "layer" || selection.kind === "petal") {
      return selectedFlower.layers.find((l) => l.id === selection.layerId) ?? null;
    }
    return null;
  }, [selectedFlower, selection]);

  const selectedPetalIndex = selection.kind === "petal" ? selection.index : null;

  // --- Pan ---
  const panRef = useRef(null);
  const beginPan = (e) => {
    e.preventDefault();
    e.currentTarget?.setPointerCapture?.(e.pointerId);
    panRef.current = { start: { x: e.clientX, y: e.clientY }, pan0: { ...pan } };
  };
  const updatePan = (e) => {
    if (!panRef.current) return;
    const dx = e.clientX - panRef.current.start.x;
    const dy = e.clientY - panRef.current.start.y;
    setPan({ x: panRef.current.pan0.x + dx, y: panRef.current.pan0.y + dy });
  };
  const endPan = () => {
    panRef.current = null;
  };

  // --- Flower drag ---
  const beginFlowerDrag = (flowerId, e, clickPetal) => {
    e.preventDefault();
    e.currentTarget?.setPointerCapture?.(e.pointerId);
    const f = project.flowers.find((x) => x.id === flowerId);
    if (!f) return;
    props.dragRef.current = {
      flowerId,
      startClient: { x: e.clientX, y: e.clientY },
      startPos: { ...f.position },
      moved: false,
      clickPetal: clickPetal ?? null,
    };
  };

  const updateFlowerDrag = (e) => {
    const d = props.dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startClient.x) / zoom;
    const dy = (e.clientY - d.startClient.y) / zoom;
    if (Math.abs(dx) + Math.abs(dy) > 1) d.moved = true;
    applyUpdate(
      (draft) => {
        const f = draft.flowers.find((x) => x.id === d.flowerId);
        if (!f) return;
        f.position.x = d.startPos.x + dx;
        f.position.y = d.startPos.y + dy;
      },
      false
    );
  };

  const endFlowerDrag = () => {
    const d = props.dragRef.current;
    if (!d) return;

    // click (no move) on petal while something selected => petal select
    if (!d.moved && d.clickPetal) {
      setSelection({ kind: "petal", flowerId: d.flowerId, layerId: d.clickPetal.layerId, index: d.clickPetal.index });
    } else {
      applyUpdate(() => {}, true);
    }

    props.dragRef.current = null;
  };

  // --- Scale drag (layer/flower) ---
  const scaleDragRef = useRef(null);

  const beginScaleDrag = (mode, flowerId, e, opts) => {
    e.preventDefault();
    e.currentTarget?.setPointerCapture?.(e.pointerId);
    const f = project.flowers.find((x) => x.id === flowerId);
    if (!f) return;

    const startScales =
      mode === "layer" && opts?.layerId
        ? f.layers.filter((l) => l.id === opts.layerId).map((l) => ({ layerId: l.id, scale: l.scale ?? 1 }))
        : f.layers.map((l) => ({ layerId: l.id, scale: l.scale ?? 1 }));

    scaleDragRef.current = {
      mode,
      flowerId,
      layerId: opts?.layerId,
      startClientY: e.clientY,
      startScales,
    };
  };

  const updateScaleDrag = (e) => {
    const sd = scaleDragRef.current;
    if (!sd) return;
    const dy = e.clientY - sd.startClientY;
    const factor = clamp(1 + dy * 0.006, 0.3, 3);

    applyUpdate(
      (draft) => {
        const f = draft.flowers.find((x) => x.id === sd.flowerId);
        if (!f) return;
        for (const s of sd.startScales) {
          const l = f.layers.find((x) => x.id === s.layerId);
          if (!l) continue;
          l.scale = clamp(s.scale * factor, 0.3, 3);
        }
      },
      false
    );
  };

  const endScaleDrag = () => {
    if (!scaleDragRef.current) return;
    applyUpdate(() => {}, true);
    scaleDragRef.current = null;
  };

  // --- Add/Delete ---
  const deleteFlowerById = (flowerId) => {
    // flower 行のゴミ箱：対象Flowerを削除
    applyUpdate((d) => {
      d.flowers = (d.flowers || []).filter((x) => x.id !== flowerId);
    }, true);

    // 選択が消えるので安全にProjectへ
    setSelection({ kind: "project" });

    // 展開状態も掃除
    setExpandedFlowers((prev) => {
      const n = { ...(prev || {}) };
      delete n[flowerId];
      return n;
    });
  };

  const deleteLayerById = (flowerId, layerId) => {
    // layer 行のゴミ箱：対象Layerを削除
    applyUpdate((d) => {
      const f = (d.flowers || []).find((x) => x.id === flowerId);
      if (!f) return;
      f.layers = (f.layers || []).filter((x) => x.id !== layerId);
      // order を詰める
      f.layers
        .slice()
        .sort((a, b) => a.order - b.order)
        .forEach((l, i) => (l.order = i + 1));
    }, true);

    // layer 選択が無効になるので、親のflowerへ戻す
    setSelection({ kind: "flower", flowerId });
  };

  const addFlower = () => {
    const base = {
      id: uid("flw"),
      name: `Flower ${project.flowers.length + 1}`,
      position: { x: 0, y: 0 },
      flowerDiameter: 60,
      rotation: 0,
      layers: [
        {
          id: uid("lay"),
          name: "Outer",
          order: 1,
          petalType: "丸つまみ",
          petalCount: 6,
          radius: 28,
          scale: 1,
          widthScale: 1,
          offsetAngle: 0,
          colorId: project.palette?.[0]?.id ?? "col_green",
          visible: true,
          locked: false,
        },
      ],
    };

    applyUpdate((d) => {
      d.flowers.push(base);
    }, true);

    setSelection({ kind: "flower", flowerId: base.id });
    setExpandedFlowers((prev) => ({ ...prev, [base.id]: true }));
  };

  const addLayer = () => {
    if (!selectedFlower) return;
    const f = selectedFlower;
    const layersSorted = [...f.layers].sort((a, b) => a.order - b.order);
    const outer = layersSorted[0];
    const basePetalCount = clamp(outer?.petalCount ?? 6, 5, 24);

    const base = {
      id: uid("lay"),
      name: "Outer+",
      order: 1,
      petalType: outer?.petalType ?? "丸つまみ",
      petalCount: basePetalCount,
      radius: (outer?.radius ?? 28) + 6,
      scale: outer?.scale ?? 1,
      widthScale: outer?.widthScale ?? 1,
      offsetAngle: outer?.offsetAngle ?? 0,
      colorId: outer?.colorId ?? (project.palette?.[0]?.id ?? "col_green"),
      visible: true,
      locked: false,
    };

    // 新しい外側は、1つ内側の花びらの「間」に見えるように角度を半分ずらす
    if (outer) {
      const innerStep = 360 / Math.max(1, outer.petalCount);
      base.offsetAngle = (outer.offsetAngle ?? 0) + innerStep / 2;
    }

    applyUpdate((d) => {
      const df = d.flowers.find((x) => x.id === f.id);
      if (!df) return;
      df.layers.forEach((l) => (l.order += 1));
      df.layers.unshift(base);
      const currentOuter = layersSorted[0];
      if (currentOuter) base.radius = (currentOuter.radius ?? base.radius) + 6;
    }, true);

    setSelection({ kind: "layer", flowerId: f.id, layerId: base.id });
    setExpandedFlowers((prev) => ({ ...prev, [f.id]: true }));
  };

  const deleteSelected = () => {
    if (selection.kind === "project") return;

    if (selection.kind === "flower") {
      applyUpdate((d) => {
        d.flowers = d.flowers.filter((x) => x.id !== selection.flowerId);
      }, true);
      setSelection({ kind: "project" });
      return;
    }

    if (selection.kind === "layer" || selection.kind === "petal") {
      applyUpdate((d) => {
        const f = d.flowers.find((x) => x.id === selection.flowerId);
        if (!f) return;
        f.layers = f.layers.filter((x) => x.id !== selection.layerId);
        f.layers
          .slice()
          .sort((a, b) => a.order - b.order)
          .forEach((l, i) => (l.order = i + 1));
      }, true);
      setSelection({ kind: "flower", flowerId: selection.flowerId });
    }
  };

  const selectedFlowerId = selection.kind === "flower" || selection.kind === "layer" || selection.kind === "petal" ? selection.flowerId : null;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left */}
        <div className="rounded-2xl border bg-white p-3 shadow-sm lg:col-span-3 min-w-0">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Layers</div>
            <div className="flex items-center gap-2">
              <button
                className="rounded-xl border bg-white px-3 py-1.5 text-xs hover:bg-neutral-50"
                onClick={props.onCopyFlower}
                title="Ctrl/Cmd+C"
              >
                Copy
              </button>
              <button
                className={`rounded-xl border px-3 py-1.5 text-xs ${
                  props.canPasteFlower ? "bg-white hover:bg-neutral-50" : "bg-neutral-100 text-neutral-400"
                }`}
                onClick={props.onPasteFlower}
                disabled={!props.canPasteFlower}
                title="Ctrl/Cmd+V"
              >
                Paste
              </button>
            </div>
          </div>

          {/* + buttons moved to top */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="rounded-xl border bg-white px-3 py-2 text-xs hover:bg-neutral-50" onClick={addFlower}>
              + Flower
            </button>
            <button
              className={`rounded-xl border px-3 py-2 text-xs ${
                selectedFlower ? "bg-white hover:bg-neutral-50" : "bg-neutral-100 text-neutral-400"
              }`}
              onClick={addLayer}
              disabled={!selectedFlower}
            >
              + Layer
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            <button className="rounded-xl border bg-white px-3 py-1.5 text-xs hover:bg-neutral-50" onClick={() => props.onArrangeFlower("front")}>
              Front
            </button>
            <button className="rounded-xl border bg-white px-3 py-1.5 text-xs hover:bg-neutral-50" onClick={() => props.onArrangeFlower("back")}>
              Back
            </button>
            <button className="rounded-xl border bg-white px-3 py-1.5 text-xs hover:bg-neutral-50" onClick={() => props.onArrangeFlower("forward")}>
              +1
            </button>
            <button className="rounded-xl border bg-white px-3 py-1.5 text-xs hover:bg-neutral-50" onClick={() => props.onArrangeFlower("backward")}>
              -1
            </button>
          </div>

          <div className="mt-3 max-h-[420px] overflow-y-auto pr-1">
            <TreeItem label={project.title} selected={selection.kind === "project"} onClick={() => setSelection({ kind: "project" })} level={0} />

            {project.flowers.map((f) => {
              const isDirectFlowerSelected = selection.kind === "flower" && selection.flowerId === f.id;
              const isChildSelected = (selection.kind === "layer" || selection.kind === "petal") && selection.flowerId === f.id;

              // 要件: レイヤー選択時は「花の行をアクティブ背景にしない」
              // → 花行の selected は direct flowerのみ
              const flowerSelected = isDirectFlowerSelected;

              // 花行に表示するマーカー: directじゃないが子が選択中なら ● を表示
              const flowerMarker = isDirectFlowerSelected ? "●" : isChildSelected ? "◦" : "";

              const expanded = isExpanded(f.id);
              return (
                <div key={f.id}>
                  <div className="flex items-center gap-1">
                    <button
                      className={`-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-xl leading-none ${
                        expanded ? "text-neutral-900" : "text-neutral-500"
                      } hover:bg-neutral-50`}
                      title={expanded ? "Collapse layers" : "Expand layers"}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(f.id);
                      }}
                      aria-label={expanded ? "collapse" : "expand"}
                    >
                      {expanded ? "▾" : "▸"}
                    </button>
                    <div className="flex-1 min-w-0">
                      <TreeItem
                        label={f.name}
                        marker={flowerMarker}
                        selected={flowerSelected}
                        showTrash={isDirectFlowerSelected}
                        onTrash={() => deleteFlowerById(f.id)}
                        onClick={() => scheduleFlowerRowClick(f.id)}
                        onDoubleClick={() => handleFlowerRowDoubleClick(f.id)}
                        // flower 行は左詰め
                        level={0}
                        leftOffset={0}
                      />
                    </div>
                  </div>

                  {expanded &&
                    f.layers
                      .slice()
                      .sort((a, b) => a.order - b.order)
                      .map((l) => (
                        <TreeItem
                          key={l.id}
                          label={`${l.order}. ${l.name}`}
                          marker={(selection.kind === "layer" || selection.kind === "petal") && selection.layerId === l.id ? "●" : ""}
                          selected={(selection.kind === "layer" || selection.kind === "petal") && selection.layerId === l.id}
                          showTrash={(selection.kind === "layer" || selection.kind === "petal") && selection.layerId === l.id}
                          onTrash={() => deleteLayerById(f.id, l.id)}
                          onClick={() => {
                            setSelection({ kind: "layer", flowerId: f.id, layerId: l.id });
                            setExpandedFlowers((prev) => ({ ...prev, [f.id]: true }));
                          }}
                          // layer 行はflowerよりインデント（展開ボタン分 + 追加インデント）
                          level={0}
                          leftOffset={40}
                          muted={!l.visible}
                        />
                      ))}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              className="flex-1 rounded-xl bg-neutral-900 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
              onClick={props.onGoRecipe}
            >
              Recipe
            </button>
            <button
              className={`rounded-xl border px-3 py-2 text-xs ${
                selection.kind === "project" ? "bg-neutral-100 text-neutral-400" : "bg-white hover:bg-neutral-50"
              }`}
              disabled={selection.kind === "project"}
              onClick={deleteSelected}
              title="Delete selected layer/flower"
            >
              Delete
            </button>
          </div>

          <div className="mt-3">
            <button className="w-full rounded-xl border bg-white px-3 py-2 text-xs hover:bg-neutral-50" onClick={() => fileInputRef.current?.click()}>
              Import JSON
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) props.onImport(f);
                e.currentTarget.value = "";
              }}
            />
          </div>

          <div className="mt-4 rounded-xl bg-neutral-50 p-3 text-xs text-neutral-600">
            <div className="font-semibold text-neutral-800">Shortcuts</div>
            <div className="mt-1">Ctrl/Cmd+Z: Undo</div>
            <div>Ctrl/Cmd+Shift+Z: Redo</div>
            <div>Ctrl/Cmd+S: Save</div>
            <div>Ctrl/Cmd+C / V: Copy / Paste Flower</div>
          </div>
        </div>

        {/* Right */}
        <div className="lg:col-span-9 grid grid-cols-1 gap-4 lg:grid-cols-12 min-w-0">
          {/* Canvas */}
          <div className="rounded-2xl border bg-white p-3 shadow-sm lg:col-span-7 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">Canvas</div>
              <div className="flex items-center gap-2">
                <button className="rounded-xl border px-3 py-1.5 text-xs hover:bg-neutral-50" onClick={() => setZoom((z) => clamp(Number((z * 1.1).toFixed(3)), 0.4, 3))}>
                  Zoom +
                </button>
                <button className="rounded-xl border px-3 py-1.5 text-xs hover:bg-neutral-50" onClick={() => setZoom((z) => clamp(Number((z / 1.1).toFixed(3)), 0.4, 3))}>
                  Zoom -
                </button>
                <button
                  className="rounded-xl border px-3 py-1.5 text-xs hover:bg-neutral-50"
                  onClick={() => {
                    setZoom(1);
                    setPan({ x: 0, y: 0 });
                  }}
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="mt-3 overflow-hidden rounded-2xl border">
              <svg
                ref={stageRef}
                className="h-[520px] w-full bg-white"
                viewBox={viewBox}
                onPointerDown={(e) => {
                  // Click empty => clear
                  if (e.button === 0 && e.target === e.currentTarget) {
                    setSelection({ kind: "project" });
                    return;
                  }
                  // middle => pan
                  if (e.button === 1) beginPan(e);
                }}
                onPointerMove={(e) => {
                  if (scaleDragRef.current) {
                    updateScaleDrag(e);
                    return;
                  }
                  updateFlowerDrag(e);
                  updatePan(e);
                }}
                onPointerUp={() => {
                  endScaleDrag();
                  endFlowerDrag();
                  endPan();
                }}
                onPointerLeave={() => {
                  endScaleDrag();
                  endFlowerDrag();
                  endPan();
                }}
              >
                <defs>
                  <style>{`
                    @keyframes tsumamiBlink {
                      0%, 100% { opacity: 0.95; }
                      50% { opacity: 0.15; }
                    }
                    .tsumami-sel-dash {
                      stroke-dasharray: 4 3;
                      animation: tsumamiBlink 0.75s ease-in-out infinite;
                    }
                  `}</style>
                </defs>

                <line x1={-999} y1={0} x2={999} y2={0} stroke="#E5E5E5" strokeWidth={0.5} pointerEvents="none" />
                <line x1={0} y1={-999} x2={0} y2={999} stroke="#E5E5E5" strokeWidth={0.5} pointerEvents="none" />

                {project.flowers.map((f) => (
                  <FlowerSvg
                    key={f.id}
                    flower={f}
                    project={project}
                    paletteMap={paletteMap}
                    isSelected={selection.kind !== "project" && selectedFlowerId === f.id}
                    isFlowerSelected={selection.kind === "flower" && selection.flowerId === f.id}
                    selectedLayerId={selection.kind === "layer" ? selection.layerId : null}
                    selectedPetal={selection.kind === "petal" ? { layerId: selection.layerId, index: selection.index } : null}
                    onSelect={() => setSelection({ kind: "flower", flowerId: f.id })}
                    onSelectLayer={(layerId) => setSelection({ kind: "layer", flowerId: f.id, layerId })}
                    onSelectPetal={(layerId, index) => setSelection({ kind: "petal", flowerId: f.id, layerId, index })}
                    onBeginDragFromLayerPetal={(layerId, index, e) => beginFlowerDrag(f.id, e, { layerId, index })}
                    onBeginScaleDrag={(mode, e, opts) => beginScaleDrag(mode, f.id, e, opts)}
                    onDoubleClick={() => setSelection({ kind: "flower", flowerId: f.id })}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      if (!((selection.kind === "flower" && selection.flowerId === f.id) || (selection.kind === "layer" && selection.flowerId === f.id))) return;
                      beginFlowerDrag(f.id, e);
                    }}
                  />
                ))}
              </svg>
            </div>

            <div className="mt-2 text-xs text-neutral-600">
              ※ 花は<strong>花（Flower）選択</strong>または<strong>Layer選択</strong>の状態でドラッグして移動できます。
            </div>
          </div>

          {/* Properties */}
          <div className="rounded-2xl border bg-white p-3 shadow-sm lg:col-span-5 min-w-0 overflow-x-hidden">
            <div className="text-sm font-semibold">Properties</div>

            {selection.kind === "project" && (
              <PropertyGroup title="Project">
                <Labeled>
                  <span>title</span>
                  <input className="w-full rounded-xl border px-3 py-2 text-sm" value={project.title} onChange={(e) => applyUpdate((d) => (d.title = e.target.value))} />
                </Labeled>

                <Labeled>
                  <span>fabricSquareSize (mm)</span>
                  <input
                    type="number"
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={project.fabricSquareSize}
                    min={5}
                    max={60}
                    onChange={(e) => applyUpdate((d) => (d.fabricSquareSize = clamp(Number(e.target.value || 0), 5, 60)))}
                  />
                </Labeled>

                <Labeled>
                  <span>notes</span>
                  <textarea className="w-full rounded-xl border px-3 py-2 text-sm" rows={4} value={project.notes} onChange={(e) => applyUpdate((d) => (d.notes = e.target.value))} />
                </Labeled>

                <PropertyGroup title="Palette (MVP)" compact>
                  <div className="grid grid-cols-1 gap-2">
                    {project.palette.map((c) => (
                      <div key={c.id} className="flex min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="h-4 w-4 rounded" style={{ background: c.hex }} />
                          <div className="text-sm truncate">{c.name}</div>
                        </div>
                        <div className="text-xs text-neutral-500 truncate max-w-[140px]">{c.id}</div>
                      </div>
                    ))}
                  </div>
                </PropertyGroup>
              </PropertyGroup>
            )}

            {selection.kind === "flower" && selectedFlower && (
              <PropertyGroup title="Flower">
                <Labeled>
                  <span>name</span>
                  <input
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={selectedFlower.name}
                    onChange={(e) =>
                      applyUpdate((d) => {
                        const f = d.flowers.find((x) => x.id === selectedFlower.id);
                        if (f) f.name = e.target.value;
                      })
                    }
                  />
                </Labeled>

                <div className="grid grid-cols-2 gap-2">
                  <Labeled>
                    <span>positionX (abs)</span>
                    <input
                      type="number"
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      value={selectedFlower.position.x}
                      onChange={(e) =>
                        applyUpdate((d) => {
                          const f = d.flowers.find((x) => x.id === selectedFlower.id);
                          if (f) f.position.x = Number(e.target.value || 0);
                        })
                      }
                    />
                  </Labeled>
                  <Labeled>
                    <span>positionY (abs)</span>
                    <input
                      type="number"
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      value={selectedFlower.position.y}
                      onChange={(e) =>
                        applyUpdate((d) => {
                          const f = d.flowers.find((x) => x.id === selectedFlower.id);
                          if (f) f.position.y = Number(e.target.value || 0);
                        })
                      }
                    />
                  </Labeled>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Labeled>
                    <span>flowerDiameter</span>
                    <input
                      type="number"
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      value={selectedFlower.flowerDiameter}
                      min={10}
                      max={200}
                      onChange={(e) =>
                        applyUpdate((d) => {
                          const f = d.flowers.find((x) => x.id === selectedFlower.id);
                          if (f) f.flowerDiameter = clamp(Number(e.target.value || 0), 10, 200);
                        })
                      }
                    />
                  </Labeled>
                  <Labeled>
                    <span>rotation</span>
                    <input
                      type="number"
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      value={selectedFlower.rotation}
                      onChange={(e) =>
                        applyUpdate((d) => {
                          const f = d.flowers.find((x) => x.id === selectedFlower.id);
                          if (f) f.rotation = Number(e.target.value || 0);
                        })
                      }
                    />
                  </Labeled>
                </div>

                <div className="mt-2 text-xs text-neutral-600">layerCount: {selectedFlower.layers.length}</div>
              </PropertyGroup>
            )}

            {selection.kind === "layer" && selectedFlower && selectedLayer && (
              <PropertyGroup title="Layer">
                <Labeled>
                  <span>name</span>
                  <input
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={selectedLayer.name}
                    onChange={(e) =>
                      applyUpdate((d) => {
                        const f = d.flowers.find((x) => x.id === selectedFlower.id);
                        if (!f) return;
                        const l = f.layers.find((x) => x.id === selectedLayer.id);
                        if (l) l.name = e.target.value;
                      })
                    }
                  />
                </Labeled>

                <div className="grid grid-cols-2 gap-2">
                  <Labeled>
                    <span>order</span>
                    <input className="w-full rounded-xl border bg-neutral-50 px-3 py-2 text-sm" value={selectedLayer.order} readOnly />
                  </Labeled>
                  <Labeled>
                    <span>petalType</span>
                    <select
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      value={selectedLayer.petalType}
                      onChange={(e) =>
                        applyUpdate((d) => {
                          const f = d.flowers.find((x) => x.id === selectedFlower.id);
                          if (!f) return;
                          const l = f.layers.find((x) => x.id === selectedLayer.id);
                          if (l) l.petalType = e.target.value;
                        })
                      }
                    >
                      {PETAL_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </Labeled>
                </div>

                <Labeled>
                  <span>petalCount (5–24)</span>
                  <input
                    type="number"
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={selectedLayer.petalCount}
                    min={5}
                    max={24}
                    onChange={(e) =>
                      applyUpdate((d) => {
                        const f = d.flowers.find((x) => x.id === selectedFlower.id);
                        if (!f) return;
                        const l = f.layers.find((x) => x.id === selectedLayer.id);
                        if (l) l.petalCount = clamp(Number(e.target.value || 0), 5, 24);
                      })
                    }
                  />
                </Labeled>

                <div className="grid grid-cols-2 gap-2">
                  <Labeled>
                    <span>radius (mm)</span>
                    <input
                      type="number"
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      value={selectedLayer.radius}
                      min={2}
                      max={120}
                      onChange={(e) =>
                        applyUpdate((d) => {
                          const f = d.flowers.find((x) => x.id === selectedFlower.id);
                          if (!f) return;
                          const l = f.layers.find((x) => x.id === selectedLayer.id);
                          if (l) l.radius = clamp(Number(e.target.value || 0), 2, 120);
                        })
                      }
                    />
                  </Labeled>
                  <Labeled>
                    <span>scale</span>
                    <input
                      type="number"
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      value={selectedLayer.scale ?? 1}
                      min={0.4}
                      max={2.5}
                      step={0.05}
                      onChange={(e) =>
                        applyUpdate((d) => {
                          const f = d.flowers.find((x) => x.id === selectedFlower.id);
                          if (!f) return;
                          const l = f.layers.find((x) => x.id === selectedLayer.id);
                          if (!l) return;
                          l.scale = clamp(Number(e.target.value || 1), 0.3, 3);
                        })
                      }
                    />
                    <div className="mt-1 text-xs text-neutral-600">花びらを縦横とも拡大縮小（中心位置は固定）</div>
                  </Labeled>
                </div>

                <Labeled>
                  <span>widthScale</span>
                  <input
                    type="number"
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={selectedLayer.widthScale ?? 1}
                    min={0.5}
                    max={1.8}
                    step={0.05}
                    onChange={(e) =>
                      applyUpdate((d) => {
                        const f = d.flowers.find((x) => x.id === selectedFlower.id);
                        if (!f) return;
                        const l = f.layers.find((x) => x.id === selectedLayer.id);
                        if (!l) return;
                        l.widthScale = clamp(Number(e.target.value || 1), 0.5, 1.8);
                      })
                    }
                  />
                  <div className="mt-1 text-xs text-neutral-600">横幅だけ追加で調整（中心位置は固定）</div>
                </Labeled>

                <Labeled>
                  <span>offsetAngle (deg)</span>
                  <input
                    type="number"
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={selectedLayer.offsetAngle}
                    onChange={(e) =>
                      applyUpdate((d) => {
                        const f = d.flowers.find((x) => x.id === selectedFlower.id);
                        if (!f) return;
                        const l = f.layers.find((x) => x.id === selectedLayer.id);
                        if (l) l.offsetAngle = Number(e.target.value || 0);
                      })
                    }
                  />
                </Labeled>

                <Labeled>
                  <span>colorId</span>
                  <select
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={selectedLayer.colorId}
                    onChange={(e) =>
                      applyUpdate((d) => {
                        const f = d.flowers.find((x) => x.id === selectedFlower.id);
                        if (!f) return;
                        const l = f.layers.find((x) => x.id === selectedLayer.id);
                        if (l) l.colorId = e.target.value;
                      })
                    }
                  >
                    {project.palette.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 flex items-center gap-2 text-xs text-neutral-600">
                    <span className="h-3 w-3 rounded" style={{ background: paletteMap.get(selectedLayer.colorId)?.hex ?? "#999" }} />
                    <span>{paletteMap.get(selectedLayer.colorId)?.hex ?? "—"}</span>
                  </div>
                </Labeled>

                <div className="grid grid-cols-2 gap-2">
                  <Labeled>
                    <span>visible</span>
                    <input
                      type="checkbox"
                      checked={!!selectedLayer.visible}
                      onChange={(e) =>
                        applyUpdate((d) => {
                          const f = d.flowers.find((x) => x.id === selectedFlower.id);
                          if (!f) return;
                          const l = f.layers.find((x) => x.id === selectedLayer.id);
                          if (l) l.visible = e.target.checked;
                        })
                      }
                    />
                  </Labeled>
                  <Labeled>
                    <span>locked</span>
                    <input
                      type="checkbox"
                      checked={!!selectedLayer.locked}
                      onChange={(e) =>
                        applyUpdate((d) => {
                          const f = d.flowers.find((x) => x.id === selectedFlower.id);
                          if (!f) return;
                          const l = f.layers.find((x) => x.id === selectedLayer.id);
                          if (l) l.locked = e.target.checked;
                        })
                      }
                    />
                  </Labeled>
                </div>
              </PropertyGroup>
            )}

            {selection.kind === "petal" && selectedFlower && selectedLayer && selectedPetalIndex !== null && (
              <PropertyGroup title="Petal">
                <div className="rounded-xl bg-neutral-50 p-3 text-xs text-neutral-700">
                  <div className="font-semibold">選択中</div>
                  <div className="mt-1">
                    {selectedFlower.name} / {selectedLayer.name} / petal #{selectedPetalIndex + 1}
                  </div>
                  <div className="mt-1 text-neutral-600">ここで変更する内容は、この花びらだけに適用されます（Layerの基本設定は維持）。</div>
                </div>
                <div className="text-xs text-neutral-600">（このMVPでは、花びらの個別色/形はCanvas上の選択とLayer基本設定で運用します）</div>
              </PropertyGroup>
            )}

            {!selection || (selection.kind !== "project" && !selectedFlower) ? (
              <div className="mt-4 text-sm text-neutral-600">左のツリーから対象を選択してください。</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrashIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 16h10l1-16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

function TreeItem(props) {
  const selected = !!props.selected;
  const muted = !!props.muted;

  // インデント調整（flower行の“浮き”を抑えて、layer行より左に寄せられるように）
  const padBase = 12 + (props.level || 0) * 14 + (props.leftOffset || 0);
  const padLeft = Math.max(0, padBase);

  const rowCls = selected
    ? "bg-neutral-50 border-neutral-200 text-neutral-900"
    : muted
    ? "bg-white border-transparent text-neutral-400 hover:bg-neutral-50"
    : "bg-white border-transparent text-neutral-800 hover:bg-neutral-50";

  return (
    <div
      className="flex w-full items-center gap-2"
      style={{ paddingLeft: padLeft }}
      onDoubleClick={(e) => {
        if (!props.onDoubleClick) return;
        e.stopPropagation();
        props.onDoubleClick();
      }}
    >
      <button
        type="button"
        className={`flex min-w-0 flex-1 items-start gap-2 rounded-xl border px-3 py-2 text-left text-sm ${rowCls}`}
        onClick={props.onClick}
      >
        {props.marker ? (
          <span className={`${selected ? "text-neutral-700" : "text-neutral-500"} text-base leading-none`} style={{ width: 18 }} aria-hidden>
            {props.marker}
          </span>
        ) : (
          <span style={{ width: 18 }} aria-hidden />
        )}
        <span className="truncate">{props.label}</span>
      </button>

      {props.showTrash && (
        <button
          type="button"
          className="shrink-0 rounded-xl border border-transparent p-2 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
          onClick={(e) => {
            e.stopPropagation();
            props.onTrash?.();
          }}
          title="Delete"
          aria-label="Delete"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function PropertyGroup({ title, compact, children }) {
  return (
    <div className={compact ? "mt-3" : "mt-4"}>
      <div className="mb-2 text-xs font-semibold text-neutral-600">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Labeled({ children }) {
  return <div className="grid grid-cols-1 gap-1">{children}</div>;
}

function FlowerSvg(props) {
  const { flower, project, paletteMap } = props;
  const layers = useMemo(() => [...(flower.layers || [])].sort((a, b) => a.order - b.order), [flower.layers]);
  const { length, width } = computePetalSizing(project.fabricSquareSize);

  const flowerOuterR = useMemo(() => {
    let m = 12;
    for (const l of layers) {
      if (!l.visible) continue;
      const placeR = l.radius;
      const petalS = l.scale ?? 1;
      const lenL = length * petalS;
      const outwardTip = lenL * PETAL_OUTWARD_FRACTION;
      m = Math.max(m, placeR + outwardTip);
    }
    return m;
  }, [layers, length]);

  const findOverride = (layer, index) => layer?.petalOverrides?.find((o) => o.index === index) ?? null;

  return (
    <g
      transform={`translate(${flower.position.x} ${flower.position.y}) rotate(${flower.rotation})`}
      onPointerDown={props.onPointerDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        props.onDoubleClick?.();
      }}
      style={{ cursor: "grab" }}
    >
      {/* selection halo */}
      {props.isSelected && (
        <circle
          r={Math.max(12, (flower.flowerDiameter || 60) / 2)}
          fill="none"
          stroke="#111"
          strokeWidth={0.55}
          opacity={0.35}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
      )}

      {/* flower scale handle */}
      {props.isFlowerSelected && (
        <g>
          <circle r={flowerOuterR} fill="none" stroke="#111" strokeWidth={0.6} opacity={0.28} vectorEffect="non-scaling-stroke" pointerEvents="none" />
          <circle
            r={flowerOuterR}
            fill="none"
            stroke="transparent"
            strokeWidth={14}
            pointerEvents="stroke"
            style={{ cursor: "ns-resize" }}
            onPointerDown={(e) => props.onBeginScaleDrag("flower", e)}
          />
        </g>
      )}

      {layers.map((layer) => {
        if (!layer.visible) return null;

        const col = paletteMap.get(layer.colorId);
        const defaultFill = col?.hex ?? "#999";
        const step = 360 / Math.max(1, layer.petalCount);
        const petalScale = layer.scale ?? 1;

        // radius: 配置位置（花びら中心）だけ
        const placeR = layer.radius;

        // size: scale / widthScale だけ
        const lenL = length * petalScale;
        const widBase = width * (layer.widthScale ?? 1);
        const widL = widBase * petalScale;

        const unitMaru = petalUnitPath("丸つまみ");
        const unitKen = petalUnitPath("剣つまみ");

        const outwardTip = lenL * PETAL_OUTWARD_FRACTION;
        const layerOuterR = placeR + outwardTip;

        const isLayerSelected = props.isSelected && props.selectedLayerId === layer.id;
        const isAnyPetalSelectedInLayer = props.isSelected && props.selectedPetal?.layerId === layer.id;

        return (
          <g key={layer.id}>
            {Array.from({ length: layer.petalCount }).map((_, i) => {
              const ov = findOverride(layer, i);
              const effectiveType = ov?.petalType ?? layer.petalType;
              const dPath = effectiveType === "丸つまみ" ? unitMaru : unitKen;
              const fill = paletteMap.get(ov?.colorId ?? layer.colorId)?.hex ?? defaultFill;

              const rot = layer.offsetAngle + i * step;
              const rad = degToRad(rot);
              const x = Math.cos(rad) * placeR;
              const y = Math.sin(rad) * placeR;

              const isPetalSelected =
                props.isSelected && props.selectedPetal?.layerId === layer.id && props.selectedPetal?.index === i;

              return (
                <g key={i} transform={`translate(${x} ${y}) rotate(${rot + 270})`}>
                  <path
                    d={dPath}
                    transform={`scale(${widL} ${lenL})`}
                    fill={fill}
                    stroke="#111"
                    vectorEffect="non-scaling-stroke"
                    strokeWidth={0.3}
                    opacity={layer.locked ? 0.55 : 0.95}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (e.button !== 0) return;

                      // 何か選択がある状態で花びらを押したら:
                      // - drag => 花全体移動（花びら選択は変えない）
                      // - click => その花びらを選択
                      const hasAnyLayerSelected = props.isSelected && props.selectedLayerId != null;
                      const dragToMoveEnabled = props.isFlowerSelected || hasAnyLayerSelected || props.selectedPetal != null;

                      if (dragToMoveEnabled) {
                        props.onBeginDragFromLayerPetal(layer.id, i, e);
                        return;
                      }

                      props.onSelect();
                      props.onSelectPetal(layer.id, i);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      props.onSelect();
                      props.onSelectLayer(layer.id);
                    }}
                  />

                  {(isPetalSelected || isLayerSelected || props.isFlowerSelected) && (
                    <path
                      d={dPath}
                      transform={`scale(${widL} ${lenL})`}
                      fill="none"
                      stroke="#111"
                      vectorEffect="non-scaling-stroke"
                      strokeWidth={1.6}
                      className="tsumami-sel-dash"
                      opacity={0.95}
                      pointerEvents="none"
                    />
                  )}
                </g>
              );
            })}

            {/* layer scale handle */}
            {isLayerSelected && !isAnyPetalSelectedInLayer && (
              <g>
                <circle r={layerOuterR} fill="none" stroke="#111" strokeWidth={0.55} opacity={0.22} vectorEffect="non-scaling-stroke" pointerEvents="none" />
                <circle
                  r={layerOuterR}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  pointerEvents="stroke"
                  style={{ cursor: "ns-resize" }}
                  onPointerDown={(e) => props.onBeginScaleDrag("layer", e, { layerId: layer.id })}
                />
              </g>
            )}
          </g>
        );
      })}

      <circle r={1.5} fill="#111" opacity={0.6} />
    </g>
  );
}

function Recipe(props) {
  const { project, recipe } = props;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold">Recipe</div>
          <div className="mt-1 text-sm text-neutral-600">色別枚数・段別内訳・工程（外→内）を自動生成します。</div>
        </div>
        <div className="flex gap-2">
          <button className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-neutral-50" onClick={props.onBack}>
            Back
          </button>
          <button className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-neutral-50" onClick={props.onExportJson}>
            Export JSON
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold">材料表（色別）</div>
          <div className="mt-2 text-xs text-neutral-600">布サイズ: {project.fabricSquareSize}mm角</div>

          <div className="mt-4 space-y-2">
            {recipe.rows.map((r) => (
              <div key={r.colorId} className="flex items-center justify-between rounded-xl border px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded" style={{ background: r.hex }} />
                  <div className="text-sm font-semibold">{r.colorName}</div>
                </div>
                <div className="text-sm">{r.count} 枚</div>
              </div>
            ))}

            {recipe.rows.length === 0 && (
              <div className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-600">表示するデータがありません。</div>
            )}
          </div>

          <div className="mt-4 rounded-xl bg-neutral-50 p-3 text-xs text-neutral-700">
            <div className="font-semibold">メモ</div>
            <div className="mt-1">芯・台座などはMVPでは手動入力に寄せています（次段で拡張可）。</div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm font-semibold">工程（Flowerごと）</div>
          <div className="mt-4 space-y-4">
            {recipe.perFlower.map(({ flower, layers }) => (
              <div key={flower.id} className="rounded-2xl border p-4">
                <div className="text-sm font-semibold">{flower.name}</div>
                <div className="mt-2 space-y-2">
                  {layers.map(({ layer, stepText }) => (
                    <div key={layer.id} className="rounded-xl bg-neutral-50 p-3 text-sm">
                      {stepText}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

