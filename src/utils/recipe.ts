export function buildRecipe(project) {
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
