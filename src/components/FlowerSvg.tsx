import { useMemo } from "react";
import { computePetalSizing, degToRad, PETAL_OUTWARD_FRACTION, petalUnitPath } from "../utils/geometry";

export function FlowerSvg(props) {
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
