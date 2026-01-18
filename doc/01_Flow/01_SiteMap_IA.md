# 01_Flow — 画面一覧（Site Map / IA）

```mermaid
flowchart TB
  A[Home / Projects] -->|New Project| B[New Project]
  A -->|Open| C[Editor]
  C -->|Recipe| D[Recipe]
  C -->|Export JSON| E[(Download .json)]
  C -->|Import JSON| C
  D -->|Back| C
  D -->|Export JSON| E

  subgraph Editor IA
    C1[Left: Layers Tree]
    C2[Center: Canvas (SVG)]
    C3[Right: Properties]
    C4[Top: Header (Undo/Redo/Save/Export)]
  end

  C --> C1
  C --> C2
  C --> C3
  C --> C4
```

## 画面一覧
- Home
  - 既存プロジェクト一覧（localStorage）
  - Open / Delete
  - New Project

- New Project
  - テンプレ選択（丸つまみ菊／剣つまみ菊）
  - title / fabricSquareSize

- Editor
  - Layers（左）
  - Canvas（中央）
  - Properties（右）

- Recipe
  - 色別枚数
  - Flowerごとの工程（外→内）
