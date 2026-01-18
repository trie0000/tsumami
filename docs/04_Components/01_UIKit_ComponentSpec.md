# 04_Components — コンポーネント仕様（UI Kit）

## 1. 全体
- 単一ファイル構成（Reactコンポーネント群）

## 2. 一覧
### 2.1 App
- `TsumamiDesignerMVP`（root）
- state: view, saved, project, selection, history

### 2.2 Header
- ナビ: Home / New / Editor / Recipe
- 操作: Undo / Redo / Save / Export JSON
- Props:
  - view, onNavigate
  - project
  - onUndo/onRedo/canUndo/canRedo
  - onSave/onExportJson

### 2.3 Home
- 保存済みプロジェクト一覧
- Open / Delete

### 2.4 NewProject
- テンプレ選択
- title / fabricSquareSize
- Create

### 2.5 Editor
- 左: Layers Tree
- 中: Canvas（SVG）
- 右: Properties
- 補助: JSON Import

### 2.6 TreeItem
- ツリー行表示
- marker（●/◦）
- selected/muted
- trash表示（選択時）

### 2.7 FlowerSvg
- Flower 1つ分のSVG描画
- 花びら path を生成し、選択ハイライト/操作を付与

### 2.8 PropertyGroup / Labeled
- Properties UI補助

### 2.9 Recipe
- 材料表（色別）
- 工程（Flowerごと）

## 3. UI状態
- selection.kind: project | flower | layer | petal
- selected IDs:
  - flowerId
  - layerId
  - index（petal）

## 4. 永続化
- Projects: localStorage `tsumami_projects_v1`
- Tree expand: localStorage `tsumami_tree_expanded_v1_<projectId>`
