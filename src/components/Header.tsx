import { NavButton } from "./NavButton";

const APP_VERSION = "v0.1.0-dev";

export function Header(props) {
  const { view, onNavigate, project } = props;
  return (
    <div className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-base font-semibold shrink-0">Tsumami Designer MVP</div>
          <div className="rounded-full border bg-white px-2 py-0.5 text-[10px] text-neutral-600">{APP_VERSION}</div>
          <div className="hidden sm:block text-sm text-neutral-500 truncate">{project ? project.title : "—"}</div>
        </div>

        <div className="flex items-center gap-2">
          <NavButton active={view === "home"} onClick={() => onNavigate("home")}>Home</NavButton>
          <NavButton active={view === "new"} onClick={() => onNavigate("new")}>New</NavButton>
          <NavButton active={view === "editor"} onClick={() => onNavigate("editor")} disabled={!project}>Editor</NavButton>
          <NavButton active={view === "recipe"} onClick={() => onNavigate("recipe")} disabled={!project}>Recipe</NavButton>
        </div>

        <div className="flex items-center gap-2">
          <button
            className={`rounded-xl border px-3 py-1.5 text-sm shadow-sm ${
              props.canUndo ? "bg-white hover:bg-neutral-50" : "bg-neutral-100 text-neutral-400"
            }`}
            onClick={props.onUndo}
            disabled={!props.canUndo}
            title="Ctrl/Cmd+Z"
          >
            Undo
          </button>
          <button
            className={`rounded-xl border px-3 py-1.5 text-sm shadow-sm ${
              props.canRedo ? "bg-white hover:bg-neutral-50" : "bg-neutral-100 text-neutral-400"
            }`}
            onClick={props.onRedo}
            disabled={!props.canRedo}
            title="Ctrl/Cmd+Shift+Z"
          >
            Redo
          </button>
          <button
            className="rounded-xl border bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-neutral-50"
            onClick={props.onSave}
            disabled={!project}
            title="Ctrl/Cmd+S"
          >
            Save
          </button>
          <button
            className="rounded-xl border bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-neutral-50"
            onClick={props.onExportJson}
            disabled={!project}
          >
            Export JSON
          </button>
        </div>
      </div>
    </div>
  );
}
