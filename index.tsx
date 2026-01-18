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

// (このファイルはcanvasの現行コード全文を含める前提。)
