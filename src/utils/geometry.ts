// ユニット形状を上下非対称にして「中心向きの方が長い」見え方にする。
// -Y（上側）が中心方向、+Y（下側）が外側方向。
export const PETAL_INWARD_FRACTION = 0.65;
export const PETAL_OUTWARD_FRACTION = 0.35;
export const PETAL_UNIT_TOP_Y = -PETAL_INWARD_FRACTION; // -0.65
export const PETAL_UNIT_BOTTOM_Y = PETAL_OUTWARD_FRACTION; // +0.35
export const PETAL_UNIT_MID_Y = (PETAL_UNIT_TOP_Y + PETAL_UNIT_BOTTOM_Y) / 2; // -0.15

export const UNIT_PETAL_PATHS = {
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

export function petalUnitPath(type) {
  return type === "剣つまみ" ? UNIT_PETAL_PATHS["剣つまみ"] : UNIT_PETAL_PATHS["丸つまみ"];
}

export function degToRad(d) {
  return (d * Math.PI) / 180;
}

export function computePetalSizing(fabricSquareSizeMm) {
  // ベースの花びらサイズ（scale=1, widthScale=1 のときの基準）
  // 要件:
  // - 縦:横 = 2:1
  // - 現状ベースのサイズを 2 倍
  const length = fabricSquareSizeMm * 0.9 * 1.5 * 2;
  const width = length / 2;
  return { length, width };
}
