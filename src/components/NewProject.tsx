import { useState } from "react";
import { clamp } from "../utils/helpers";
import { Labeled } from "./Labeled";

export function NewProject(props) {
  const [template, setTemplate] = useState("丸つまみ");
  const [title, setTitle] = useState("つまみ細工デザイン");
  const [fabricSquareSize, setFabricSquareSize] = useState(20);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-semibold">New Project</div>
            <div className="mt-1 text-sm text-neutral-600">テンプレを選んで、編集画面を立ち上げます。</div>
          </div>
          <button className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-neutral-50" onClick={props.onBack}>
            Back
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border p-4">
            <div className="text-sm font-semibold">Template</div>
            <div className="mt-3 flex gap-2">
              <button
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${
                  template === "丸つまみ" ? "bg-neutral-900 text-white" : "bg-white hover:bg-neutral-50"
                } border`}
                onClick={() => setTemplate("丸つまみ")}
              >
                丸つまみ菊
              </button>
              <button
                className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${
                  template === "剣つまみ" ? "bg-neutral-900 text-white" : "bg-white hover:bg-neutral-50"
                } border`}
                onClick={() => setTemplate("剣つまみ")}
              >
                剣つまみ菊
              </button>
            </div>
            <div className="mt-4 text-xs text-neutral-600">
              MVPでも花びら（Petal）単体の色・形状を上書きできます（Layer基本設定＋必要な箇所だけ個別変更）。
            </div>
          </div>

          <div className="rounded-2xl border p-4">
            <div className="text-sm font-semibold">Initial settings</div>
            <div className="mt-3 space-y-3">
              <Labeled>
                <span>title</span>
                <input
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Labeled>
              <Labeled>
                <span>fabricSquareSize (mm)</span>
                <input
                  type="number"
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  value={fabricSquareSize}
                  min={5}
                  max={60}
                  onChange={(e) => setFabricSquareSize(clamp(Number(e.target.value || 0), 5, 60))}
                />
              </Labeled>
              <button
                className="w-full rounded-2xl bg-neutral-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-neutral-800"
                onClick={() => props.onCreate(template, title, fabricSquareSize)}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
