import { deepCopy, nowIso, uid } from "./helpers";
import { normalizeProject } from "./normalization";

export function makeDefaultPalette() {
  return [
    { id: "col_green", name: "Green", hex: "#2FBF4A" },
    { id: "col_white", name: "White", hex: "#F5F5F5" },
    { id: "col_red", name: "Red", hex: "#E34850" },
    { id: "col_pink", name: "Pink", hex: "#F08CB6" },
    { id: "col_yellow", name: "Yellow", hex: "#F2D04B" },
  ];
}

export function makeTemplateMaruKiku({ title, fabricSquareSize } = {}) {
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

export function makeTemplateKenKiku({ title, fabricSquareSize } = {}) {
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

export function cloneFlowerWithNewIds(src, offset) {
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
