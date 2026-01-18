# 01_Flow — ユーザーフロー（状態遷移）

## 1) ナビゲーションフロー
```mermaid
stateDiagram-v2
  [*] --> Home
  Home --> New: click New
  Home --> Editor: Open project
  New --> Editor: Create
  Editor --> Recipe: click Recipe
  Recipe --> Editor: Back
  Editor --> Home: Navigate Home

  state Editor {
    [*] --> ProjectSelected
    ProjectSelected --> FlowerSelected: select flower
    FlowerSelected --> LayerSelected: select layer
    LayerSelected --> PetalSelected: click petal
    PetalSelected --> LayerSelected: double-click petal

    FlowerSelected --> ProjectSelected: click empty
    LayerSelected --> ProjectSelected: click empty
    PetalSelected --> ProjectSelected: click empty

    FlowerSelected --> FlowerMoving: drag
    LayerSelected --> FlowerMoving: drag
    FlowerMoving --> FlowerSelected: pointer up

    FlowerSelected --> FlowerScaling: drag flower outer ring
    FlowerScaling --> FlowerSelected: pointer up

    LayerSelected --> LayerScaling: drag layer outer ring
    LayerScaling --> LayerSelected: pointer up
  }
```

## 2) 選択ルール（重要）
- 空白クリック：選択解除（Project選択へ）
- 花びらダブルクリック：その花びらが属するレイヤーを選択
- Flower/Layer選択中に花びら上でドラッグ：**花びらの選択を変えずに**花全体を移動

## 3) ツリー展開ルール
- Flowerクリック：Flower選択＋展開（expand=true）
- Flowerダブルクリック：展開/折りたたみトグル
- 展開状態は localStorage に保存
