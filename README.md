# Factory Flow Optimizer

A browser-based 2D grid factory automation game focused on throughput optimization.
Mine resources, move them on belts, smelt ore into plates, assemble gears, find bottlenecks, and improve the factory until the numbers climb.

## How to play

1. Open `index.html` in a browser.
2. Pick a build tool from the left panel and left-click the grid to place it.
3. Right-click to remove equipment. Press `R` to rotate the build direction.
4. Watch production, consumption, inventory, utilization, theory-vs-actual output, and bottleneck warnings in the right panel.

## Implemented features

- 50x50 grid map
- Iron and copper resource nodes
- Miners, directional belts, furnaces, assemblers
- Unlockable splitters, mergers, storage buffers, and fast belts
- Output blocking, belt capacity limits, upstream stopping, and clear red/yellow jam visualization
- Real-time items/min, consumption, inventory, and machine utilization
- Automatic bottleneck detection and bottleneck history
- Production graph, theoretical max output, actual output comparison
- Efficiency score and lightweight missions
- 1x / 2x / 4x speed controls
- Ghost placement with no build cost

## Keyboard Duel (1vs1 ミニゲーム集)

`versus/index.html` に、同じキーボードで対戦する1vs1ミニゲーム集があります。
P1 は `WASD`、P2 は `↑↓←→` で操作します。メニューで `1`-`6` またはW/S・↑/↓で選び、`Space` で開始、`Esc` でメニューへ戻ります。

| # | ゲーム | ルール |
|---|---|---|
| 1 | 相撲 | 相手を土俵の外へ押し出す |
| 2 | ライトサイクル | 壁や軌跡に当たったら負け |
| 3 | コイン集め | 30秒でより多くコインを集める（金コインは3点） |
| 4 | 鬼ごっこ | 接触で鬼が交代。鬼だった時間が短いほうが勝ち |
| 5 | 弾よけ | 降ってくる弾を避けて最後まで生き残る |
| 6 | 陣取り | 30秒で多くのマスを自分の色に塗る |

勝敗は画面上部のスコアボードに累積されます。

## Local preview

The game is a static site. Any local static server works:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a browser (factory game) or `http://localhost:8000/versus/` (1vs1 minigames).
