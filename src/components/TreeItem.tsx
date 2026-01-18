import { TrashIcon } from "./TrashIcon";

export function TreeItem(props) {
  const selected = !!props.selected;
  const muted = !!props.muted;

  // インデント調整
  const padBase = 12 + (props.level || 0) * 14 + (props.leftOffset || 0);
  const padLeft = Math.max(0, padBase);

  const rowCls = selected
    ? "bg-neutral-50 border-neutral-200 text-neutral-900"
    : muted
    ? "bg-white border-transparent text-neutral-400 hover:bg-neutral-50"
    : "bg-white border-transparent text-neutral-800 hover:bg-neutral-50";

  // ✅ Trash の“予約席”サイズ（ボタンと同寸にする）
  const TRASH_SLOT = "h-9 w-9";

  return (
    <div
      className="flex items-center gap-0"
      style={{ paddingLeft: padLeft }}
      onDoubleClick={(e) => {
        if (!props.onDoubleClick) return;
        e.stopPropagation();
        props.onDoubleClick();
      }}
    >
      <button
        type="button"
        className={`flex min-w-0 flex-1 items-center justify-start gap-0 rounded-lg border px-1 py-0.5 text-left text-sm ${rowCls}`}
        onClick={props.onClick}
        style={{ textAlign: "left" }}
      >
        {props.marker ? (
          <span
            className={`${selected ? "text-neutral-700" : "text-neutral-500"} text-xs leading-none shrink-0`}
            style={{ width: 10, marginRight: 2 }}
            aria-hidden
          >
            {props.marker}
          </span>
        ) : (
          <span className="shrink-0" style={{ width: 10, marginRight: 2 }} aria-hidden />
        )}
        <span className="truncate text-left whitespace-nowrap">{props.label}</span>
      </button>

      {/* ✅ 右側アクション + Trash予約席 */}
      <div className="flex items-center gap-0.5 shrink-0">
        {/* ✅ + / − を“もう少し右へ”：左余白を追加 */}
        {props.rightActions && <div className="flex items-center gap-1 ml-4">{props.rightActions}</div>}

        {/* ✅ Trash が無い時も“予約席”だけ出す（位置がズレない） */}
        {props.showTrash ? (
          <button
            type="button"
            className={`${TRASH_SLOT} shrink-0 rounded-xl border border-transparent p-2 text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900`}
            onClick={(e) => {
              e.stopPropagation();
              props.onTrash?.();
            }}
            title="Delete"
            aria-label="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        ) : (
          <div className={`${TRASH_SLOT} shrink-0`} aria-hidden />
        )}
      </div>
    </div>
  );
}
