# 03_MainScreens — レシピ仕様（Recipe Spec）

## 1. 目的
- 各色の必要枚数（布カット枚数）を自動集計
- Flowerごとに、Layer順（外→内）の工程を文章化

## 2. 入力
- project.palette
- project.flowers[].layers[]
- layer.petalOverrides（任意）

## 3. 出力
### 3.1 色別枚数（rows）
- `[{ colorId, colorName, hex, fabricSquareSize, count }]`
- 集計ルール
  - visible=false の layer は除外
  - petalOverrides があれば、その花びらは override の colorId を優先

### 3.2 工程（perFlower）
- `[{ flower, layers: [{ layer, stepText }] }]`
- layerを order順で処理
- stepText 例
  - `Layer 1（Outer）: 丸つまみ 6枚（基本色: Green）を作る → 円周に等間隔で貼る（offset=0°）`

## 4. MVPの制約
- 芯・台座などは未対応（メモで案内）
- 花びら個別編集UIは未整備（データは保持可能）
