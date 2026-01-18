import { useEffect, useMemo, useRef, useState } from "react";
import { clamp, uid } from "../utils/helpers";
import { PETAL_TYPES } from "../utils/constants";
import { TreeItem } from "./TreeItem";
import { TrashIcon } from "./TrashIcon";
import { FlowerSvg } from "./FlowerSvg";
import { PropertyGroup } from "./PropertyGroup";
import { Labeled } from "./Labeled";

export function Editor(props) {
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
  }, [EXPAND_KEY, project.flowers]);

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
    applyUpdate((d) => {
      d.flowers = (d.flowers || []).filter((x) => x.id !== flowerId);
    }, true);

    setSelection({ kind: "project" });

    setExpandedFlowers((prev) => {
      const n = { ...(prev || {}) };
      delete n[flowerId];
      return n;
    });
  };

  const deleteLayerById = (flowerId, layerId) => {
    applyUpdate((d) => {
      const f = (d.flowers || []).find((x) => x.id === flowerId);
      if (!f) return;
      f.layers = (f.layers || []).filter((x) => x.id !== layerId);
      f.layers
        .slice()
        .sort((a, b) => a.order - b.order)
        .forEach((l, i) => (l.order = i + 1));
    }, true);

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

  // 花行の + / −（外側レイヤー）
  const addOuterLayer = (flowerId) => {
    const f = project.flowers.find((x) => x.id === flowerId);
    if (!f) return;
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

    if (outer) {
      const innerStep = 360 / Math.max(1, outer.petalCount);
      base.offsetAngle = (outer.offsetAngle ?? 0) + innerStep / 2;
    }

    applyUpdate((d) => {
      const df = d.flowers.find((x) => x.id === flowerId);
      if (!df) return;
      df.layers.forEach((l) => (l.order += 1));
      df.layers.unshift(base);
      const currentOuter = layersSorted[0];
      if (currentOuter) base.radius = (currentOuter.radius ?? base.radius) + 6;
    }, true);

    setSelection({ kind: "layer", flowerId, layerId: base.id });
    setExpandedFlowers((prev) => ({ ...prev, [flowerId]: true }));
  };

  const deleteOuterLayer = (flowerId) => {
    const f = project.flowers.find((x) => x.id === flowerId);
    if (!f || !f.layers || f.layers.length === 0) return;

    const layersSorted = [...f.layers].sort((a, b) => a.order - b.order);
    const outerLayer = layersSorted[0];
    if (!outerLayer) return;

    applyUpdate((d) => {
      const df = d.flowers.find((x) => x.id === flowerId);
      if (!df) return;
      df.layers = df.layers.filter((x) => x.id !== outerLayer.id);
      df.layers
        .slice()
        .sort((a, b) => a.order - b.order)
        .forEach((l, i) => (l.order = i + 1));
    }, true);

    if (selection.kind === "layer" && selection.layerId === outerLayer.id) {
      setSelection({ kind: "flower", flowerId });
    } else if (selection.kind === "petal" && selection.layerId === outerLayer.id) {
      setSelection({ kind: "flower", flowerId });
    }
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

  const selectedFlowerId =
    selection.kind === "flower" || selection.kind === "layer" || selection.kind === "petal" ? selection.flowerId : null;

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

          {/* + buttons */}
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
            <button
              className="rounded-xl border bg-white px-3 py-1.5 text-xs hover:bg-neutral-50"
              onClick={() => props.onArrangeFlower("front")}
            >
              Front
            </button>
            <button
              className="rounded-xl border bg-white px-3 py-1.5 text-xs hover:bg-neutral-50"
              onClick={() => props.onArrangeFlower("back")}
            >
              Back
            </button>
            <button
              className="rounded-xl border bg-white px-3 py-1.5 text-xs hover:bg-neutral-50"
              onClick={() => props.onArrangeFlower("forward")}
            >
              +1
            </button>
            <button
              className="rounded-xl border bg-white px-3 py-1.5 text-xs hover:bg-neutral-50"
              onClick={() => props.onArrangeFlower("backward")}
            >
              -1
            </button>
          </div>

          {/* Tree */}
          <div className="mt-3 max-h-[420px] overflow-y-auto pr-1">
            <TreeItem
              label={project.title}
              selected={selection.kind === "project"}
              onClick={() => setSelection({ kind: "project" })}
              level={0}
            />

            {project.flowers.map((f) => {
              const isDirectFlowerSelected = selection.kind === "flower" && selection.flowerId === f.id;
              const isChildSelected = (selection.kind === "layer" || selection.kind === "petal") && selection.flowerId === f.id;

              // ✅ レイヤー選択時に花行をアクティブにしない
              const flowerSelected = isDirectFlowerSelected;

              // ✅ マーカー：花自体=● / 子が選択中=◦
              const flowerMarker = isDirectFlowerSelected ? "●" : isChildSelected ? "◦" : "";

              const expanded = isExpanded(f.id);
              const hasLayers = f.layers && f.layers.length > 0;

              // ✅ 花行の右側： + / − / ゴミ箱（TrashIcon）
              // - ゴミ箱は花が直接選択されている時だけ出す
              const flowerActions = (
                <div className="flex items-center gap-1">
                  <button
                    className="flex h-5 w-5 items-center justify-center rounded text-xs leading-none p-0 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                    title="Add outer layer"
                    onClick={(e) => {
                      e.stopPropagation();
                      addOuterLayer(f.id);
                    }}
                    aria-label="Add outer layer"
                  >
                    +
                  </button>

                  {hasLayers && (
                    <button
                      className="flex h-5 w-5 items-center justify-center rounded text-xs leading-none p-0 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                      title="Delete outer layer"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteOuterLayer(f.id);
                      }}
                      aria-label="Delete outer layer"
                    >
                      −
                    </button>
                  )}

                  {isDirectFlowerSelected && (
                    <button
                      className="ml-1 flex h-6 w-6 items-center justify-center rounded hover:bg-red-50"
                      title="Delete flower"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFlowerById(f.id);
                      }}
                      aria-label="Delete flower"
                    >
                      <TrashIcon className="h-4 w-4 text-red-600" />
                    </button>
                  )}
                </div>
              );

              return (
                <div key={f.id}>
                  {/* ここを “昔の見た目” に寄せる：三角を小さく、行高も詰める */}
                  <div className="flex items-center gap-0">
                    <button
                      className={`-ml-1 flex h-5 w-5 items-center justify-center rounded text-[11px] leading-none p-0 ${
                        expanded ? "text-neutral-900" : "text-neutral-500"
                      } hover:bg-neutral-50`}
                      title={expanded ? "Collapse layers" : "Expand layers"}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(f.id);
                      }}
                      aria-label={expanded ? "collapse" : "expand"}
                    >
                      {expanded ? "▼" : "▶︎"}
                    </button>
                    
                    {/* TreeItem 全体も少し左へ寄せる */}
                    <div className="flex-1 min-w-0 -ml-1">
                      <TreeItem
                        label={f.name}
                        marker={flowerMarker}
                        selected={flowerSelected}
                        showTrash={isDirectFlowerSelected}
                        onTrash={() => deleteFlowerById(f.id)}
                        rightActions={flowerActions}
                        onClick={() => scheduleFlowerRowClick(f.id)}
                        onDoubleClick={() => handleFlowerRowDoubleClick(f.id)}
                        level={0}
                        leftOffset={-18}   // ★ここ変更（-12 → -18）
                      />
                    </div>
                  </div>

                  {expanded &&
                    f.layers
                      .slice()
                      .sort((a, b) => a.order - b.order)
                      .map((l) => {
                        const isLayerSelected = (selection.kind === "layer" || selection.kind === "petal") && selection.layerId === l.id;

                        return (
                          <TreeItem
                            key={l.id}
                            label={`${l.order}. ${l.name}`}
                            marker={isLayerSelected ? "●" : ""}
                            selected={isLayerSelected}
                            // ✅ layer側のゴミ箱：layer選択時のみ表示（見た目はTrashIcon）
                            rightActions={
                              isLayerSelected ? (
                                <button
                                  className="ml-1 flex h-6 w-6 items-center justify-center rounded hover:bg-red-50"
                                  title="Delete layer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteLayerById(f.id, l.id);
                                  }}
                                  aria-label="Delete layer"
                                >
                                  <TrashIcon className="h-4 w-4 text-red-600" />
                                </button>
                              ) : null
                            }
                            onClick={() => {
                              setSelection({ kind: "layer", flowerId: f.id, layerId: l.id });
                              setExpandedFlowers((prev) => ({ ...prev, [f.id]: true }));
                            }}
                            // ✅ layer行はインデント（見た目改善）
                            level={0}
                            leftOffset={18}
                            muted={!l.visible}
                          />
                        );
                      })}
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
            <button
              className="w-full rounded-xl border bg-white px-3 py-2 text-xs hover:bg-neutral-50"
              onClick={() => fileInputRef.current?.click()}
            >
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
                <button
                  className="rounded-xl border px-3 py-1.5 text-xs hover:bg-neutral-50"
                  onClick={() => setZoom((z) => clamp(Number((z * 1.1).toFixed(3)), 0.4, 3))}
                >
                  Zoom +
                </button>
                <button
                  className="rounded-xl border px-3 py-1.5 text-xs hover:bg-neutral-50"
                  onClick={() => setZoom((z) => clamp(Number((z / 1.1).toFixed(3)), 0.4, 3))}
                >
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
                  <input
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={project.title}
                    onChange={(e) => applyUpdate((d) => (d.title = e.target.value))}
                  />
                </Labeled>

                <Labeled>
                  <span>fabricSquareSize (mm)</span>
                  <input
                    type="number"
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={project.fabricSquareSize}
                    min={5}
                    max={60}
                    onChange={(e) =>
                      applyUpdate((d) => (d.fabricSquareSize = clamp(Number(e.target.value || 0), 5, 60)))
                    }
                  />
                </Labeled>

                <Labeled>
                  <span>notes</span>
                  <textarea
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    rows={4}
                    value={project.notes}
                    onChange={(e) => applyUpdate((d) => (d.notes = e.target.value))}
                  />
                </Labeled>

                <PropertyGroup title="Palette (MVP)" compact>
                  <div className="grid grid-cols-1 gap-2">
                    {project.palette.map((c) => (
                      <div
                        key={c.id}
                        className="flex min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2"
                      >
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
                    <input
                      className="w-full rounded-xl border bg-neutral-50 px-3 py-2 text-sm"
                      value={selectedLayer.order}
                      readOnly
                    />
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
