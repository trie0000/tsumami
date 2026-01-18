export function Recipe(props) {
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
