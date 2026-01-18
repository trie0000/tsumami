# AI Handoff — 後続AIに渡す「実装指示パック」

## 0. ゴール
- 既存の単一ファイルReactアプリ（Tsumami Designer MVP）をベースに、機能追加・バグ修正を継続できる状態にする。
- 本パックは「読んだAIが迷わず実装を進める」ことを目的にしている。

## 1. リポジトリ/ファイル構成
- 現状：単一ファイル（index.tsx相当）
- ドキュメント：本ZIP（00〜05 + AI_Handoff）

## 2. 実装前提（重要）
- **TypeScript構文は使わない**（.tsxでもJSXとして解釈される環境を想定）
- localStorage 保存キー
  - Projects: `tsumami_projects_v1`
  - Tree expand: `tsumami_tree_expanded_v1_<projectId>`
- 花びらタイプは文字列で統一：`丸つまみ` / `剣つまみ`

## 3. 現行の操作仕様（短縮版）
- 選択：project / flower / layer / petal
- 空白クリック：projectへ
- petalダブルクリック：layer選択
- flower/layer選択中は、花びら上でもドラッグすると花全体が移動（花びら選択は変えない）
- 外周リングドラッグ：現行は scale を変更（flower or layer）

## 4. 直近の要件（優先度順の例）
### P0（壊れてる/阻害）
- SyntaxError/JSXタグ不整合が出る場合、まずビルドが通る状態に復帰
- クリック/ドラッグ判定の破綻（意図せず選択が変わる等）を修正

### P1（ユーザー指定）
- Layersツリー：
  - Flower行ダブルクリックで展開切替
  - 展開アイコンを押しやすく大きく
  - layer選択時に flower行をアクティブ背景にしない（マーカーのみ）
  - 左ペインは少し細く、右Propertiesは十分な幅を確保

### P2（設計整理：scale不要）
- ユーザー方針：**「scaleが計算値なら不要」**
- 現行は scale が花びらサイズ倍率として独立パラメータになっている。
- もし「配置だけを変えたい（花びらサイズ固定）」が真意なら、
  - 外周ドラッグ操作を **radius更新**に変更し、
  - scale をUIから外す or `petalScale` へ改名して役割を分離する。

## 5. テスト観点（手動）
- New→Editor→Save→Home一覧反映
- Tree展開状態が再起動後も維持
- +Flower で petalCount=6
- +Layer が最外周へ追加され、角度が半ピッチずれる
- Copy/PasteがFlower単位で機能
- Z順操作が見た目に反映
- Recipe が visible=false を除外して集計

## 6. 重要な設計判断ログ
- 本MVPは「コードを読みやすく」よりも「単一ファイルで動く」を優先している。
- Undo/Redoは差分ではなくスナップショット（JSON文字列）方式。

---

## 添付
- `index.tsx`（現行コード）
- 00〜05の仕様書
