# 03_MainScreens — 編集画面仕様（Editor Spec）

## 1. レイアウト
- 3ペイン
  - Left: Layers Tree（スクロール）
  - Center: Canvas（SVG）
  - Right: Properties（編集フォーム）

## 2. 左ペイン（Layers）
### 2.1 ヘッダ操作
- Copy / Paste（Flower単位）
- + Flower / + Layer（上部に配置）
- Z順操作：Front / Back / +1 / -1

### 2.2 ツリー構造
- Project
  - Flower（展開/折りたたみ）
    - Layer（order順）

### 2.3 選択表示ルール
- Flower行：Flowerが直接選択されているときのみアクティブ背景
- Layer/Petalが選択されているとき、Flower行はアクティブにしない（マーカーのみ表示）
- Layer行：選択中はアクティブ背景＋削除アイコン表示

### 2.4 展開状態の永続化
- localStorage key: `tsumami_tree_expanded_v1_<project.id>`
- value: `{ [flowerId: string]: boolean }`

## 3. 中央（Canvas）
### 3.1 表示
- SVG viewBox + zoom/pan
- 原点ガイド（十字）
- Flowerは project.flowers の配列順で描画（後ろほど前面）

### 3.2 入力
- 空白クリック：選択解除
- 中ボタン（button=1）：pan
- 花びらクリック：選択（状況により）
- ダブルクリック（花びら）：レイヤー選択

### 3.3 移動
- Flower選択 or Layer選択の状態でドラッグすると花全体が移動
- ドラッグ開始位置の花びらは「押しただけ」では選択しない
  - pointer up 時に「移動なし」なら花びら選択へ切り替える

### 3.4 拡大縮小（現行）
- Flower選択時：外周リングドラッグ → 全Layerの scale を同時に更新
- Layer選択時：外周リングドラッグ → そのLayerの scale を更新

> NOTE: 今後「配置半径のみ変更（花びらサイズは固定）」にする場合は `radius` 更新へ仕様変更する。

### 3.5 選択ハイライト
- 選択対象の外周を点滅ダッシュ（strokeWidth太め）
- 花全体選択：全花びらに点滅ダッシュを適用
- レイヤー選択：そのレイヤーの花びらのみ点滅対象
- 花びら選択：その花びらのみ点滅対象

## 4. 右ペイン（Properties）
- 選択対象に応じたフォーム切替
  - Project
  - Flower
  - Layer
  - Petal（現行は説明のみ／将来拡張）

### 4.1 Project
- title
- fabricSquareSize(mm)
- notes
- palette一覧（表示のみ）

### 4.2 Flower
- name
- positionX/Y（abs）
- flowerDiameter
- rotation

### 4.3 Layer
- name
- order（readonly）
- petalType（丸/剣）
- petalCount（5–24）
- radius（mm）
- scale（現行）
- widthScale
- offsetAngle
- colorId
- visible / locked

## 5. 追加/削除
- + Flower
  - デフォルト petalCount=6
- + Layer
  - 最外周へ追加
  - 外側レイヤーの petalCount/scale/widthScale/petalType/color を踏襲
  - radius は外側より少し大きく（+6mm目安）
  - offsetAngle は半ピッチずらし

- Delete
  - Flower / Layer削除
  - Layer削除後は order を詰め直す
