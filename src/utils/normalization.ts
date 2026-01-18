import { clamp, deepCopy, nowIso, uid } from "./helpers";
import { makeDefaultPalette } from "./templates";

export function normalizePetalType(v) {
  if (v === "maru") return "丸つまみ";
  if (v === "ken") return "剣つまみ";
  if (v === "丸つまみ" || v === "剣つまみ") return v;
  return "丸つまみ";
}

export function normalizeProject(p) {
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

// Self tests
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
