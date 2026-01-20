// src/components/FlowerSvg.tsx
// つまみ細工デザイナー：Canvas上で花（Flower）をSVG描画するコンポーネント
// - レイヤーごとの花びら描画（petalType / colorId）
// - 花びら単体のオーバーライド（layer.petalOverrides: { index, colorId?, petalType? }）に対応
// - 単一選択（selectedPetal）/ 複数選択（selectedPetals）をハイライト表示
// - Shift+クリックで複数選択（onTogglePetalSelection）を優先処理
// - Layer選択時のスケールハンドル表示は「当該レイヤーに花びら選択が無い場合のみ」に制御
//
// ✅ 仕様（今回の復旧版）
// - geometry.ts のユニット形状は「根元(0,0) → 先端(1,0) が +X（外向き）」で統一
// - したがって配置点(translate(x,y))が “根元” になり、rotate(rot) は外向きに向く
// - 中心の隙間を詰めるため、placeR を length に応じて少し引く（R_PULL）

import { useMemo } from "react";
import { computePetalSizing, degToRad, PETAL_OUTWARD_FRACTION, petalUnitPath } from "../utils/geometry";


export function FlowerSvg(props: any) {
  const { flower, project, paletteMap } = props;

  const layers = useMemo(
    () => [...(flower.layers || [])].sort((a: any, b: any) => a.order - b.order),
    [flower.layers]
  );

  const { length, width } = computePetalSizing(project.fabricSquareSize);

  const flowerOuterR = useMemo(() => {
    let m = 12;
    for (const l of layers) {
      if (!l.visible) continue;
      const petalS = l.scale ?? 1;
      const lenL = length * petalS;
      // ✅ レイヤー選択時の円と同様に、花びらの外側頂点を通るように計算
      // ✅ scaleに依存しないように、基準のlengthを使用して根元の座標を固定
      const R_PULL = 0.28;
      const placeR = Math.max(0, l.radius - length * R_PULL);
      // 花びらの先端（外側頂点）までの距離
      const layerOuterR = placeR + lenL;
      m = Math.max(m, layerOuterR);
    }
    return m;
  }, [layers, length]);

  const findOverride = (layer: any, index: number) =>
    layer?.petalOverrides?.find((o: any) => o.index === index) ?? null;

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
          <circle
            r={flowerOuterR}
            fill="none"
            stroke="#111"
            strokeWidth={0.6}
            opacity={0.28}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
          {/* スケール用の円：外周全体 */}
          <circle
            r={flowerOuterR}
            fill="none"
            stroke="transparent"
            strokeWidth={8}
            pointerEvents="stroke"
            style={{ cursor: `url("${import.meta.env.BASE_URL}scale_cursor_32.png") 16 16, ns-resize` }}
            onPointerDown={(e) => {
              e.stopPropagation();
              props.onBeginScaleDrag("flower", e);
            }}
          />
          {/* ✅ 回転ハンドル：各花びらの頂点付近（スケールより上に配置） */}
          {layers.filter((l: any) => l.visible).map((layer: any) => {
            const petalScale = layer.scale ?? 1;
            const lenL = length * petalScale;
            const R_PULL = 0.28;
            const placeR = Math.max(0, layer.radius - length * R_PULL);
            const layerOuterR = placeR + lenL;
            const step = 360 / Math.max(1, layer.petalCount);

            return Array.from({ length: layer.petalCount }).map((_, i) => {
              const rot = layer.offsetAngle + i * step;
              const rad = degToRad(rot);
              const tipX = Math.cos(rad) * layerOuterR;
              const tipY = Math.sin(rad) * layerOuterR;
              return (
                <circle
                  key={`flower-rot-${layer.id}-${i}`}
                  cx={tipX}
                  cy={tipY}
                  r={lenL * 0.25}
                  fill="transparent"
                  style={{ cursor: `url("${import.meta.env.BASE_URL}rotate_cursor_32.png") 16 16, grab` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (props.onBeginRotationDrag) {
                      props.onBeginRotationDrag("flower", e);
                    }
                  }}
                />
              );
            });
          })}
        </g>
      )}

      {layers.map((layer: any) => {
        if (!layer.visible) return null;

        const col = paletteMap.get(layer.colorId);
        const defaultFill = col?.hex ?? "#999";
        const step = 360 / Math.max(1, layer.petalCount);
        const petalScale = layer.scale ?? 1;

        // size: scale / widthScale だけ
        const lenL = length * petalScale;
        const widBase = width * (layer.widthScale ?? 1);
        const widL = widBase * petalScale;

        // ✅ 中心の隙間を詰める（必要なら 0.20〜0.40 で調整）
        // ✅ scaleに依存しないように、基準のlengthを使用して根元の座標を固定
        const R_PULL = 0.28;
        const placeR = Math.max(0, layer.radius - length * R_PULL);

        const unitMaru = petalUnitPath("丸つまみ");
        const unitKen = petalUnitPath("剣つまみ");

        // ✅ 花びらの外側の頂点（先端）までの距離
        // ユニット形状では先端が +X方向で X=1 が先端なので、placeR から lenL だけ外側
        // しかし実際のユニット形状（丸つまみ）では最大X座標が約1.1なので、それを考慮
        // より正確には、すべての花びらの外側頂点を通る最大半径を計算する必要があるが、
        // 簡易的には placeR + lenL を使用（ユニット座標で先端は X=1）
        const layerOuterR = placeR + lenL;

        const isLayerSelected = props.isSelected && props.selectedLayerId === layer.id;

        // ✅ 単一選択 + 複数選択 のどちらかで「このレイヤー内に花びら選択がある」判定
        const isAnyPetalSelectedInLayer =
          props.isSelected &&
          (props.selectedPetal?.layerId === layer.id ||
            (props.selectedPetals?.some((p: any) => p.layerId === layer.id) ?? false));

        return (
          <g key={layer.id}>
            {Array.from({ length: layer.petalCount }).map((_, i) => {
              const ov = findOverride(layer, i);
              const effectiveType = ov?.petalType ?? layer.petalType;
              const dPath = effectiveType === "丸つまみ" ? unitMaru : unitKen;
              const fill = paletteMap.get(ov?.colorId ?? layer.colorId)?.hex ?? defaultFill;

              // rot は「外向き」の角度（中心→外）
              const rot = layer.offsetAngle + i * step;
              const rad = degToRad(rot);
              const x = Math.cos(rad) * placeR;
              const y = Math.sin(rad) * placeR;

              const isPetalSelected =
                props.isSelected && props.selectedPetal?.layerId === layer.id && props.selectedPetal?.index === i;

              const isPetalInMultiSelection =
                props.isSelected &&
                (props.selectedPetals?.some((p: any) => p.layerId === layer.id && p.index === i) ?? false);

              const isPetalSelectedForHighlight = isPetalSelected || isPetalInMultiSelection;

              // ✅ geometry.ts のユニット形状は +X が先端（外向き）
              // なので rotate(rot) で外向きにそろう（余計な +90/+270 を付けない）
              return (
                <g key={i} transform={`translate(${x} ${y}) rotate(${rot})`}>
                  <path
                    d={dPath}
                    // ✅ 根元(0,0)が配置点に一致する。width/length にスケール
                    transform={`scale(${lenL} ${widL})`}
                    fill={fill}
                    stroke="#111"
                    vectorEffect="non-scaling-stroke"
                    strokeWidth={0.3}
                    opacity={layer.locked ? 0.55 : 0.95}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (e.button !== 0) return;

                      const isShiftPressed = e.shiftKey;

                      // ✅ Shiftキーが押されている場合は複数選択モードを最優先
                      if (isShiftPressed) {
                        if (props.onTogglePetalSelection) {
                          e.preventDefault();
                          e.stopPropagation();
                          props.onTogglePetalSelection(layer.id, i, true);
                          return;
                        }
                      }

                      // Shiftなしの場合：ドラッグで花を動かすか、クリックで花びら選択
                      const hasAnyLayerSelected = props.isSelected && props.selectedLayerId != null;
                      const hasAnyPetalSelected =
                        props.selectedPetal != null || (props.selectedPetals?.length ?? 0) > 0;

                      const dragToMoveEnabled = props.isFlowerSelected || hasAnyLayerSelected || hasAnyPetalSelected;

                      if (dragToMoveEnabled) {
                        props.onBeginDragFromLayerPetal(layer.id, i, e);
                        return;
                      }

                      props.onSelect?.();
                      props.onSelectPetal?.(layer.id, i);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      props.onSelect?.();
                      props.onSelectLayer?.(layer.id);
                    }}
                  />

                  {(isPetalSelectedForHighlight || isLayerSelected || props.isFlowerSelected) && (
                    <path
                      key={`dash-${props.dashSyncToken ?? 0}-${layer.id}-${i}`}
                      d={dPath}
                      transform={`scale(${lenL} ${widL})`}
                      fill="none"
                      stroke="#111"
                      vectorEffect="non-scaling-stroke"
                      strokeWidth={1.6}
                      className="tsumami-sel-dash"
                      style={{ animationDelay: "var(--tsumami-delay, 0s)" }}
                      opacity={0.95}
                      pointerEvents="none"
                    />
                  )}

                </g>
              );
            })}

            {/* layer handle：レイヤー選択中 かつ レイヤー内に花びら選択がない場合のみ */}
            {isLayerSelected && !isAnyPetalSelectedInLayer && (
              <g>
                <circle
                  r={layerOuterR}
                  fill="none"
                  stroke="#111"
                  strokeWidth={0.55}
                  opacity={0.22}
                  vectorEffect="non-scaling-stroke"
                  pointerEvents="none"
                />
                {/* ✅ スケールハンドル：外周円上（花びら間のみ） */}
                <circle
                  r={layerOuterR}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={8}
                  pointerEvents="stroke"
                  style={{ cursor: `url("${import.meta.env.BASE_URL}scale_cursor_32.png") 16 16, ns-resize` }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    props.onBeginScaleDrag("layer", e, { layerId: layer.id });
                  }}
                />
                {/* ✅ 回転ハンドル：各花びらの頂点付近（スケールより上に配置） */}
                {Array.from({ length: layer.petalCount }).map((_, i) => {
                  const rot = layer.offsetAngle + i * step;
                  const rad = degToRad(rot);
                  // 花びら頂点の位置（外周円上）
                  const tipX = Math.cos(rad) * layerOuterR;
                  const tipY = Math.sin(rad) * layerOuterR;
                  return (
                    <circle
                      key={`rot-handle-${i}`}
                      cx={tipX}
                      cy={tipY}
                      r={lenL * 0.25}
                      fill="transparent"
                      style={{ cursor: `url("${import.meta.env.BASE_URL}rotate_cursor_32.png") 16 16, grab` }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (props.onBeginRotationDrag) {
                          props.onBeginRotationDrag("layer", e, { layerId: layer.id });
                        }
                      }}
                    />
                  );
                })}
              </g>
            )}
          </g>
        );
      })}

      <circle r={1.5} fill="#111" opacity={0.6} />
    </g>
  );
}
