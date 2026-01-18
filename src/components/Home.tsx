export function Home(props) {
  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold">Projects</div>
          <div className="mt-1 text-sm text-neutral-600">ローカル保存（localStorage）です。Saveで一覧に反映されます。</div>
        </div>
        <button
          className="rounded-2xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-neutral-800"
          onClick={props.onNew}
        >
          New Project
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {props.saved.length === 0 && (
          <div className="rounded-2xl border bg-white p-6 text-sm text-neutral-600 shadow-sm">
            まだ保存されたプロジェクトがありません。New Projectから作成してください。
          </div>
        )}
        {props.saved.map((p) => (
          <div key={p.id} className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-lg font-semibold">{p.title}</div>
            <div className="mt-1 text-xs text-neutral-500">Updated: {p.updatedAt}</div>
            <div className="mt-4 flex gap-2">
              <button
                className="flex-1 rounded-xl bg-neutral-900 px-3 py-2 text-sm font-semibold text-white hover:bg-neutral-800"
                onClick={() => props.onOpen(p.project)}
              >
                Open
              </button>
              <button
                className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-neutral-50"
                onClick={() => props.onDelete(p.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
