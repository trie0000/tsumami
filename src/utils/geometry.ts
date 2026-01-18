// src/utils/geometry.ts
// 目的:
// - 花びらユニット形状（丸つまみ/剣つまみ）を提供
// - 角度変換、花びらサイズ計算を提供
//
// 仕様（重要）:
// - ユニット形状は「根元(0,0) → 先端(+X方向)」に統一する
// - FlowerSvg 側は rotate(rot) で外向きに向く前提（余計な +270 等は不要）
// - geometry.ts に JSX は絶対に入れない（入れると build が壊れる）

export const PETAL_INWARD_FRACTION = 0.65;
export const PETAL_OUTWARD_FRACTION = 0.35;

// ユニットの定義（根元→先端が +X）
export const PETAL_UNIT_ROOT_X = 0;
export const PETAL_UNIT_TIP_X = 1;

export const UNIT_PETAL_PATHS: Record<string, string> = {
  // ✅ 丸つまみ（ティアドロップ/涙型）
  // - 根元(0,0)は細め（中心に刺さる）
  // - 先端(+X側)は丸く太め（外向きが「丸」になる）
  // - 幅方向は Y（±0.5 程度）
  "丸つまみ": `M 0 0
    C 0.06 0.28, 0.38 0.56, 0.86 0.44
    C 1.10 0.32, 1.10 -0.32, 0.86 -0.44
    C 0.38 -0.56, 0.06 -0.28, 0 0
    Z`,

  // ✅ 剣つまみ（細長い側＝先端が外向きになる）
  // 根元(0,0) → 先端(1,0)
  "剣つまみ": `M 0 0
    L 0.22 0.50
    L 1 0
    L 0.22 -0.50
    Z`,
};

export function petalUnitPath(type: string) {
  return type === "剣つまみ" ? UNIT_PETAL_PATHS["剣つまみ"] : UNIT_PETAL_PATHS["丸つまみ"];
}

export function degToRad(d: number) {
  return (d * Math.PI) / 180;
}

export function computePetalSizing(fabricSquareSizeMm: number) {
  // ベースの花びらサイズ（scale=1, widthScale=1 のときの基準）
  // 要件:
  // - 縦:横 = 2:1
  // - 現状ベースのサイズを 2 倍
  const length = fabricSquareSizeMm * 0.9 * 1.5 * 2;
  const width = length / 2;
  return { length, width };
}
