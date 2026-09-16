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

## FPS アスレチックレンジ (`fps/`)

A first-person shooter range built with Three.js. Open `fps/index.html` (through a local server, since it loads ES modules).

- `WASD` move, `Space` jump, `Shift` blink dash (cooldown), `Enter` (or left click) fire, `/` cycle weapons, `1`-`4` direct weapon select, `R` reload
- 4 weapons: pistol / assault rifle / shotgun / sniper, each with its own fire rate, spread, magazine and recoil
- Crates, pillars, stairs, floating platform chain, catwalks and jump pads form a parkour course
- Static, patrolling and pop-up dummies with head/body hitboxes, damage numbers in the feed, and respawn after a few seconds
- HUD: score, kills, accuracy, ammo, blink cooldown, hit markers

## Local preview

The game is a static site. Any local static server works:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a browser.
