const GRID_SIZE = 50;
const SAMPLE_SECONDS = 60;
const TILE = {
  empty: "empty",
  iron: "iron",
  copper: "copper",
  miner: "miner",
  belt: "belt",
  furnace: "furnace",
  assembler: "assembler",
  splitter: "splitter",
  merger: "merger",
  storage: "storage",
  fastBelt: "fastBelt",
};

const ITEMS = {
  ironOre: { label: "鉄鉱石", color: "#8fa3b8" },
  copperOre: { label: "銅鉱石", color: "#d8894b" },
  ironPlate: { label: "鉄板", color: "#dce8f4" },
  copperPlate: { label: "銅板", color: "#ffb06e" },
  gear: { label: "ギア", color: "#ffc857" },
};

const DIRECTIONS = [
  { x: 0, y: -1, symbol: "↑" },
  { x: 1, y: 0, symbol: "→" },
  { x: 0, y: 1, symbol: "↓" },
  { x: -1, y: 0, symbol: "←" },
];

const TOOLS = [
  { id: TILE.miner, icon: "⛏", label: "採掘機", detail: "資源上 / 2秒に1個" },
  { id: TILE.belt, icon: "▸", label: "ベルト", detail: "容量4 / 方向あり" },
  { id: TILE.furnace, icon: "🔥", label: "精錬炉", detail: "鉱石→板 / 1秒" },
  { id: TILE.assembler, icon: "⚙", label: "組立機", detail: "鉄板2→ギア / 2秒" },
  { id: TILE.splitter, icon: "⫶", label: "分岐ベルト", detail: "交互分配 / score 45" },
  { id: TILE.merger, icon: "⤙", label: "合流装置", detail: "複数入力 / score 60" },
  { id: TILE.storage, icon: "▣", label: "ストレージ", detail: "容量60 / score 75" },
  { id: TILE.fastBelt, icon: "»", label: "高速ベルト", detail: "容量6 / score 90" },
];

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const chart = document.querySelector("#chart");
const chartCtx = chart.getContext("2d");
const ui = {
  toolbox: document.querySelector("#toolbox"),
  selection: document.querySelector("#selection"),
  missions: document.querySelector("#missions"),
  unlocks: document.querySelector("#unlocks"),
  stats: document.querySelector("#stats"),
  score: document.querySelector("#score"),
  bottlenecks: document.querySelector("#bottlenecks"),
  utilization: document.querySelector("#utilization"),
  history: document.querySelector("#history"),
  theory: document.querySelector("#theory"),
  hoverTip: document.querySelector("#hoverTip"),
};

let selectedTool = TILE.miner;
let direction = 1;
let speed = 1;
let paused = false;
let lastTime = performance.now();
let uiTimer = 0;
let selectedCell = null;
let hoverCell = null;
let gameTime = 0;

const state = {
  grid: [],
  machines: new Map(),
  belts: new Map(),
  storages: new Map(),
  producedWindow: [],
  consumedWindow: [],
  bottleneckHistory: [],
  unlocked: new Set([TILE.miner, TILE.belt, TILE.furnace, TILE.assembler]),
};

function itemMap(value) {
  return Object.fromEntries(Object.keys(ITEMS).map((item) => [item, value]));
}

function key(x, y) {
  return `${x},${y}`;
}

function inBounds(x, y) {
  return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE;
}

function getCell(x, y) {
  if (!inBounds(x, y)) return null;
  return state.grid[y][x];
}

function isPassable(cell) {
  return Boolean(cell && [TILE.belt, TILE.fastBelt, TILE.furnace, TILE.assembler, TILE.splitter, TILE.merger, TILE.storage].includes(cell.type));
}

function resourceType(cell) {
  if (cell.resource === TILE.iron) return "ironOre";
  if (cell.resource === TILE.copper) return "copperOre";
  return null;
}

function outputPos(cell) {
  const dir = DIRECTIONS[cell.dir ?? 1];
  return { x: cell.x + dir.x, y: cell.y + dir.y };
}

function tileLabel(type) {
  return TOOLS.find((tool) => tool.id === type)?.label ?? type;
}

function createGrid() {
  state.grid = Array.from({ length: GRID_SIZE }, (_, y) =>
    Array.from({ length: GRID_SIZE }, (_, x) => ({ x, y, type: TILE.empty, resource: null, dir: 1, blockedTime: 0, delayTime: 0 }))
  );

  addResourceBlob(8, 10, 5, TILE.iron);
  addResourceBlob(36, 12, 4, TILE.copper);
  addResourceBlob(14, 35, 5, TILE.iron);
  addResourceBlob(39, 38, 5, TILE.copper);
  addResourceBlob(25, 24, 3, TILE.iron);
}

function addResourceBlob(cx, cy, radius, resource) {
  for (let y = cy - radius; y <= cy + radius; y += 1) {
    for (let x = cx - radius; x <= cx + radius; x += 1) {
      const cell = getCell(x, y);
      if (!cell) continue;
      const dx = x - cx;
      const dy = y - cy;
      if (Math.sqrt(dx * dx + dy * dy) <= radius + Math.random() * 1.2) {
        cell.resource = resource;
      }
    }
  }
}

function seedFactory() {
  const placements = [
    [8, 10, TILE.miner, 1],
    [9, 10, TILE.belt, 1],
    [10, 10, TILE.belt, 1],
    [11, 10, TILE.belt, 1],
    [12, 10, TILE.furnace, 1],
    [13, 10, TILE.belt, 1],
    [14, 10, TILE.belt, 1],
    [15, 10, TILE.assembler, 1],
    [16, 10, TILE.belt, 1],
    [17, 10, TILE.storage, 1],
    [8, 12, TILE.miner, 1],
    [9, 12, TILE.belt, 1],
    [10, 12, TILE.belt, 1],
    [11, 12, TILE.furnace, 1],
    [12, 12, TILE.belt, 1],
    [13, 12, TILE.belt, 1],
    [14, 12, TILE.belt, 0],
    [14, 11, TILE.belt, 1],
    [15, 11, TILE.belt, 0],
  ];
  placements.forEach(([x, y, type, dir]) => place(x, y, type, dir, true));
}

function place(x, y, type, dir = direction, force = false) {
  const cell = getCell(x, y);
  if (!cell || (!force && !state.unlocked.has(type))) return false;
  if (type === TILE.miner && !resourceType(cell)) return false;
  if (cell.type !== TILE.empty) remove(x, y);
  cell.type = type;
  cell.dir = dir;
  cell.blockedTime = 0;
  cell.delayTime = 0;
  cell.throughput = 0;
  if ([TILE.belt, TILE.fastBelt, TILE.splitter, TILE.merger].includes(type)) {
    state.belts.set(key(x, y), { items: [], cooldown: 0, alternate: 0 });
  } else if (type === TILE.storage) {
    state.storages.set(key(x, y), { items: itemMap(0), capacity: 60, lastInput: 0 });
  } else if ([TILE.miner, TILE.furnace, TILE.assembler].includes(type)) {
    state.machines.set(key(x, y), {
      progress: 0,
      activeTime: 0,
      idleTime: 0,
      blockedTime: 0,
      input: itemMap(0),
      output: itemMap(0),
      lastReason: "待機中",
    });
  }
  return true;
}

function remove(x, y) {
  const cell = getCell(x, y);
  if (!cell) return;
  state.machines.delete(key(x, y));
  state.belts.delete(key(x, y));
  state.storages.delete(key(x, y));
  cell.type = TILE.empty;
  cell.dir = 1;
  cell.blockedTime = 0;
  cell.delayTime = 0;
  cell.throughput = 0;
}

function inputItem(cell, item, dt = 0) {
  if (!cell || !isPassable(cell)) return false;
  if ([TILE.belt, TILE.fastBelt, TILE.splitter, TILE.merger].includes(cell.type)) return inputBelt(cell, item);
  if (cell.type === TILE.furnace || cell.type === TILE.assembler) return inputMachine(cell, item);
  if (cell.type === TILE.storage) return inputStorage(cell, item, dt);
  return false;
}

function inputBelt(cell, item) {
  const belt = state.belts.get(key(cell.x, cell.y));
  const capacity = cell.type === TILE.fastBelt ? 6 : 4;
  if (!belt || belt.items.length >= capacity) return false;
  belt.items.push({ item, age: 0 });
  return true;
}

function inputMachine(cell, item) {
  const machine = state.machines.get(key(cell.x, cell.y));
  if (!machine) return false;
  const accepted = acceptedItems(cell.type);
  if (!accepted.includes(item) || machine.input[item] >= 8) return false;
  machine.input[item] += 1;
  return true;
}

function inputStorage(cell, item, dt) {
  const storage = state.storages.get(key(cell.x, cell.y));
  if (!storage) return false;
  const total = Object.values(storage.items).reduce((sum, count) => sum + count, 0);
  if (total >= storage.capacity) return false;
  storage.items[item] += 1;
  storage.lastInput += 1;
  cell.throughput += 1 / Math.max(dt, 1 / 60);
  return true;
}

function acceptedItems(type) {
  if (type === TILE.furnace) return ["ironOre", "copperOre"];
  if (type === TILE.assembler) return ["ironPlate"];
  return [];
}

function recipeFor(cell, machine) {
  if (cell.type === TILE.furnace) {
    if (machine.input.ironOre > 0) return { in: { ironOre: 1 }, out: "ironPlate", time: 1 };
    if (machine.input.copperOre > 0) return { in: { copperOre: 1 }, out: "copperPlate", time: 1 };
  }
  if (cell.type === TILE.assembler && machine.input.ironPlate >= 2) {
    return { in: { ironPlate: 2 }, out: "gear", time: 2 };
  }
  return null;
}

function canConsume(machine, recipe) {
  return Object.entries(recipe.in).every(([item, count]) => machine.input[item] >= count);
}

function consumeRecipe(machine, recipe) {
  Object.entries(recipe.in).forEach(([item, count]) => {
    machine.input[item] -= count;
    addWindowEvent(state.consumedWindow, item, count);
  });
}

function update(dt) {
  gameTime += dt;
  decayTileMetrics(dt);
  updateMachines(dt);
  updateStorages(dt);
  updateBelts(dt);
  updateUnlocks();
  trimWindows();
}

function updateStorages(dt) {
  for (const [id, storage] of state.storages) {
    const cell = cellFromKey(id);
    if (!cell) continue;
    storage.cooldown = Math.max(0, (storage.cooldown ?? 0) - dt);
    if (storage.cooldown > 0) continue;
    const item = Object.keys(storage.items).find((entry) => storage.items[entry] > 0);
    if (!item) continue;
    const out = outputPos(cell);
    const target = getCell(out.x, out.y);
    if (inputItem(target, item, dt)) {
      storage.items[item] -= 1;
      storage.cooldown = 0.25;
      cell.throughput += 1 / Math.max(dt, 1 / 60);
    } else {
      cell.blockedTime += dt;
    }
  }
}

function decayTileMetrics(dt) {
  for (const row of state.grid) {
    for (const cell of row) {
      cell.throughput = Math.max(0, (cell.throughput ?? 0) - dt * 2.4);
    }
  }
}

function updateMachines(dt) {
  for (const [id, machine] of state.machines) {
    const cell = cellFromKey(id);
    if (!cell) continue;

    if (cell.type === TILE.miner) {
      updateMiner(cell, machine, dt);
    } else {
      updateProcessor(cell, machine, dt);
    }
  }
}

function updateMiner(cell, machine, dt) {
  const out = outputPos(cell);
  const target = getCell(out.x, out.y);
  const item = resourceType(cell);
  if (!item) {
    machine.idleTime += dt;
    machine.lastReason = "資源ノード上にありません";
    return;
  }

  if (machine.progress < 2) {
    machine.progress = Math.min(2, machine.progress + dt);
    machine.activeTime += dt;
    machine.lastReason = "採掘中";
    return;
  }

  if (inputItem(target, item, dt)) {
    machine.progress -= 2;
    machine.activeTime += dt;
    addWindowEvent(state.producedWindow, item, 1);
  } else {
    machine.blockedTime += dt;
    cell.blockedTime += dt;
    machine.lastReason = "出力先が満杯";
  }
}

function updateProcessor(cell, machine, dt) {
  const recipe = recipeFor(cell, machine);
  if (!recipe) {
    machine.idleTime += dt;
    machine.lastReason = cell.type === TILE.assembler ? "鉄板供給不足" : "鉱石供給不足";
    return;
  }

  if (!canConsume(machine, recipe)) {
    machine.idleTime += dt;
    machine.lastReason = "材料不足";
    return;
  }

  if (machine.progress < recipe.time) {
    machine.progress = Math.min(recipe.time, machine.progress + dt);
    machine.activeTime += dt;
    machine.lastReason = "処理中";
    return;
  }

  const out = outputPos(cell);
  const target = getCell(out.x, out.y);
  if (inputItem(target, recipe.out, dt)) {
    consumeRecipe(machine, recipe);
    machine.progress -= recipe.time;
    addWindowEvent(state.producedWindow, recipe.out, 1);
  } else {
    machine.blockedTime += dt;
    cell.blockedTime += dt;
    machine.lastReason = "出力先が満杯";
  }
}

function updateBelts(dt) {
  const entries = [...state.belts.entries()].sort(() => 0.5 - Math.random());
  for (const [id, belt] of entries) {
    const cell = cellFromKey(id);
    if (!cell) continue;
    belt.items.forEach((entry) => {
      entry.age += dt;
    });
    belt.cooldown -= dt;
    const capacity = cell.type === TILE.fastBelt ? 6 : 4;
    if (belt.items.length >= capacity) cell.blockedTime += dt;
    if (belt.items.length > capacity * 0.6) cell.delayTime += dt;
    if (belt.cooldown > 0 || belt.items.length === 0) continue;
    const entry = belt.items[0];
    if (entry.age < beltTravelTime(cell)) continue;
    const target = nextBeltTarget(cell, belt);
    if (target && inputItem(target, entry.item, dt)) {
      belt.items.shift();
      belt.cooldown = 0.08;
      cell.throughput += 1 / Math.max(dt, 1 / 60);
      if (cell.type === TILE.splitter) belt.alternate += 1;
    } else {
      cell.blockedTime += dt;
    }
  }
}

function beltTravelTime(cell) {
  if (cell.type === TILE.splitter || cell.type === TILE.merger) return 0.28;
  if (cell.type === TILE.fastBelt) return 0.18;
  return 0.34;
}

function nextBeltTarget(cell, belt) {
  if (cell.type === TILE.splitter) {
    const offsets = [0, 1, -1];
    for (let i = 0; i < offsets.length; i += 1) {
      const dir = (cell.dir + offsets[(belt.alternate + i) % offsets.length] + 4) % 4;
      const target = getCell(cell.x + DIRECTIONS[dir].x, cell.y + DIRECTIONS[dir].y);
      if (isPassable(target)) return target;
    }
    return null;
  }
  const out = outputPos(cell);
  return getCell(out.x, out.y);
}

function cellFromKey(id) {
  const [x, y] = id.split(",").map(Number);
  return getCell(x, y);
}

function addWindowEvent(window, item, count) {
  window.push({ t: gameTime, item, count });
}

function trimWindows() {
  state.producedWindow = state.producedWindow.filter((event) => gameTime - event.t <= SAMPLE_SECONDS);
  state.consumedWindow = state.consumedWindow.filter((event) => gameTime - event.t <= SAMPLE_SECONDS);
}

function ratePerMinute(window, item) {
  const total = window.filter((event) => event.item === item).reduce((sum, event) => sum + event.count, 0);
  return total * (60 / SAMPLE_SECONDS);
}

function updateUnlocks() {
  const score = efficiencyScore();
  if (score >= 45) state.unlocked.add(TILE.splitter);
  if (score >= 60) state.unlocked.add(TILE.merger);
  if (score >= 75) state.unlocked.add(TILE.storage);
  if (score >= 90) state.unlocked.add(TILE.fastBelt);
}

function efficiencyScore() {
  const machines = [...state.machines.values()];
  const active = machines.reduce((sum, machine) => sum + machine.activeTime, 0);
  const blocked = machines.reduce((sum, machine) => sum + machine.blockedTime, 0);
  const idle = machines.reduce((sum, machine) => sum + machine.idleTime, 0);
  const gearRate = ratePerMinute(state.producedWindow, "gear");
  const utilization = active / Math.max(active + blocked + idle, 1);
  const jamPenalty = blocked / Math.max(active + blocked + idle, 1);
  const overproductionPenalty = Math.min(0.2, Math.max(0, ratePerMinute(state.producedWindow, "ironPlate") - gearRate * 2.6) / 200);
  return Math.max(0, Math.min(100, Math.round(utilization * 70 + Math.min(gearRate, 120) * 0.35 - jamPenalty * 45 - overproductionPenalty * 100)));
}

function theoreticalGearRate() {
  const miners = countType(TILE.miner);
  const furnaces = countType(TILE.furnace);
  const assemblers = countType(TILE.assembler);
  const oreRate = miners * 30;
  const plateRate = Math.min(oreRate, furnaces * 60);
  return Math.min(plateRate / 2, assemblers * 30);
}

function countType(type) {
  let count = 0;
  for (const row of state.grid) {
    for (const cell of row) {
      if (cell.type === type) count += 1;
    }
  }
  return count;
}

function detectBottlenecks() {
  const messages = [];
  const machineEntries = [...state.machines.entries()];
  const blockedMachines = machineEntries.filter(([, machine]) => machine.blockedTime > machine.activeTime * 0.35 && machine.blockedTime > 2);
  const idleAssemblers = machineEntries.filter(([id, machine]) => cellFromKey(id)?.type === TILE.assembler && machine.lastReason.includes("供給不足"));
  const jammedBelts = [...state.belts.entries()].filter(([id, belt]) => {
    const cell = cellFromKey(id);
    const capacity = cell?.type === TILE.fastBelt ? 6 : 4;
    return belt.items.length >= capacity || (cell?.blockedTime ?? 0) > 4;
  });
  const gearActual = ratePerMinute(state.producedWindow, "gear");
  const gearTheory = theoreticalGearRate();
  const furnaces = countType(TILE.furnace);
  const miners = countType(TILE.miner);

  if (idleAssemblers.length > 0) {
    messages.push({ level: "warn", text: "鉄板の供給不足: 組立機までの炉・ベルトを増やしてください。" });
  }
  if (miners * 30 > furnaces * 60 && miners > 0) {
    messages.push({ level: "warn", text: "炉の処理能力が不足: 採掘速度に対して精錬炉が少なめです。" });
  }
  if (blockedMachines.length > 0) {
    messages.push({ level: "critical", text: `出力詰まり: ${blockedMachines.length}台の設備が停止しています。赤い設備の下流を拡張してください。` });
  }
  if (jammedBelts.length > 0) {
    messages.push({ level: "critical", text: `ベルト満杯: ${jammedBelts.length}箇所で上流停止が発生中です。分岐・合流・バッファを検討してください。` });
  }
  if (gearTheory > 0 && gearActual < gearTheory * 0.45) {
    messages.push({ level: "warn", text: "理論値に対して実測が低い: ライン接続・向き・搬送容量を確認してください。" });
  }
  if (messages.length === 0) {
    messages.push({ level: "ok", text: "重大なボトルネックなし。次は理論値との差を縮めましょう。" });
  }
  return messages;
}

function rememberBottlenecks(messages) {
  const first = messages.find((message) => message.level !== "ok");
  if (!first) return;
  const now = new Date().toLocaleTimeString("ja-JP");
  if (state.bottleneckHistory[0]?.text !== first.text) {
    state.bottleneckHistory.unshift({ time: now, text: first.text });
    state.bottleneckHistory = state.bottleneckHistory.slice(0, 24);
  }
}

function render() {
  resizeCanvas();
  const tile = canvas.width / GRID_SIZE;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawTerrain(tile);
  drawBuildings(tile);
  drawGhost(tile);
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const size = Math.floor(Math.min(rect.width, rect.height) * devicePixelRatio);
  if (canvas.width !== size || canvas.height !== size) {
    canvas.width = size;
    canvas.height = size;
  }
}

function drawTerrain(tile) {
  ctx.fillStyle = "#091421";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const cell = getCell(x, y);
      const px = x * tile;
      const py = y * tile;
      if (cell.resource) {
        ctx.fillStyle = cell.resource === TILE.iron ? "rgba(143, 163, 184, 0.28)" : "rgba(216, 137, 75, 0.3)";
        ctx.fillRect(px + 1, py + 1, tile - 2, tile - 2);
        ctx.fillStyle = cell.resource === TILE.iron ? "#b7c4d0" : "#f0a262";
        ctx.beginPath();
        ctx.arc(px + tile * 0.5, py + tile * 0.5, tile * 0.18, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(76, 101, 134, 0.22)";
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, tile, tile);
    }
  }
}

function drawBuildings(tile) {
  for (let y = 0; y < GRID_SIZE; y += 1) {
    for (let x = 0; x < GRID_SIZE; x += 1) {
      const cell = getCell(x, y);
      if (cell.type === TILE.empty) continue;
      const px = x * tile;
      const py = y * tile;
      if ([TILE.belt, TILE.fastBelt, TILE.splitter, TILE.merger].includes(cell.type)) drawBelt(cell, px, py, tile);
      if (cell.type === TILE.miner) drawMachine(cell, px, py, tile, "#405777", "⛏");
      if (cell.type === TILE.furnace) drawMachine(cell, px, py, tile, "#6d3a24", "🔥");
      if (cell.type === TILE.assembler) drawMachine(cell, px, py, tile, "#314b42", "⚙");
      if (cell.type === TILE.storage) drawMachine(cell, px, py, tile, "#373f5f", "▣");
    }
  }
}

function drawBelt(cell, px, py, tile) {
  const belt = state.belts.get(key(cell.x, cell.y));
  const fill = congestionColor(cell, belt?.items.length ?? 0);
  ctx.fillStyle = fill;
  ctx.fillRect(px + 2, py + 2, tile - 4, tile - 4);
  ctx.save();
  ctx.translate(px + tile / 2, py + tile / 2);
  ctx.rotate((cell.dir * Math.PI) / 2);
  ctx.fillStyle = "#e8f0ff";
  ctx.beginPath();
  ctx.moveTo(tile * 0.22, 0);
  ctx.lineTo(-tile * 0.14, -tile * 0.18);
  ctx.lineTo(-tile * 0.14, tile * 0.18);
  ctx.closePath();
  ctx.fill();
  if (cell.type === TILE.splitter) {
    ctx.strokeStyle = "#ffc857";
    ctx.lineWidth = Math.max(2, tile * 0.08);
    ctx.beginPath();
    ctx.moveTo(-tile * 0.2, 0);
    ctx.lineTo(tile * 0.18, -tile * 0.22);
    ctx.moveTo(-tile * 0.2, 0);
    ctx.lineTo(tile * 0.18, tile * 0.22);
    ctx.stroke();
  }
  if (cell.type === TILE.merger) {
    ctx.strokeStyle = "#55d17c";
    ctx.lineWidth = Math.max(2, tile * 0.08);
    ctx.beginPath();
    ctx.moveTo(-tile * 0.2, -tile * 0.22);
    ctx.lineTo(tile * 0.18, 0);
    ctx.moveTo(-tile * 0.2, tile * 0.22);
    ctx.lineTo(tile * 0.18, 0);
    ctx.stroke();
  }
  ctx.restore();
  drawBeltItems(belt, px, py, tile);
}

function congestionColor(cell, count) {
  const capacity = cell.type === TILE.fastBelt ? 6 : 4;
  if (count >= capacity || cell.blockedTime > 3) return "#8c2e34";
  if (count >= capacity * 0.75 || cell.delayTime > 3) return "#8a6a2e";
  const flow = Math.min(1, (cell.throughput ?? 0) / 14);
  const blue = Math.round(83 + flow * 60);
  return `rgb(55, ${83 + Math.round(flow * 45)}, ${blue})`;
}

function drawBeltItems(belt, px, py, tile) {
  if (!belt) return;
  belt.items.forEach((entry, index) => {
    const offset = (index - (belt.items.length - 1) / 2) * tile * 0.15;
    ctx.fillStyle = ITEMS[entry.item].color;
    ctx.beginPath();
    ctx.arc(px + tile / 2 + offset, py + tile / 2, Math.max(2, tile * 0.12), 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawMachine(cell, px, py, tile, color, icon) {
  const machine = state.machines.get(key(cell.x, cell.y));
  const storage = state.storages.get(key(cell.x, cell.y));
  const blocked = (machine?.lastReason.includes("満杯") || cell.blockedTime > 3) && cell.type !== TILE.storage;
  const delayed = machine?.lastReason.includes("不足");
  ctx.fillStyle = blocked ? "#86323a" : delayed ? "#7d642b" : color;
  ctx.fillRect(px + 2, py + 2, tile - 4, tile - 4);
  ctx.strokeStyle = blocked ? "#ff5d5d" : delayed ? "#ffc857" : "rgba(255,255,255,0.35)";
  ctx.lineWidth = Math.max(1, tile * 0.06);
  ctx.strokeRect(px + 3, py + 3, tile - 6, tile - 6);
  ctx.fillStyle = "#fff";
  ctx.font = `${Math.max(8, tile * 0.5)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(icon, px + tile / 2, py + tile / 2);
  if (machine) drawProgress(machine, px, py, tile);
  if (storage) drawStorage(storage, px, py, tile);
  drawDirection(cell, px, py, tile);
}

function drawProgress(machine, px, py, tile) {
  const total = Object.values(machine.input).reduce((sum, count) => sum + count, 0);
  if (total > 0) {
    ctx.fillStyle = "rgba(72, 165, 255, 0.9)";
    ctx.fillRect(px + 3, py + tile - 6, Math.min(tile - 6, total * tile * 0.08), 3);
  }
}

function drawStorage(storage, px, py, tile) {
  const total = Object.values(storage.items).reduce((sum, count) => sum + count, 0);
  ctx.fillStyle = "#55d17c";
  ctx.fillRect(px + 3, py + tile - 6, (tile - 6) * (total / storage.capacity), 3);
}

function drawDirection(cell, px, py, tile) {
  const dir = DIRECTIONS[cell.dir];
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = `${Math.max(7, tile * 0.35)}px sans-serif`;
  ctx.fillText(dir.symbol, px + tile * 0.78, py + tile * 0.24);
}

function drawGhost(tile) {
  if (!hoverCell) return;
  const cell = getCell(hoverCell.x, hoverCell.y);
  const px = hoverCell.x * tile;
  const py = hoverCell.y * tile;
  const valid = canPlace(cell, selectedTool);
  ctx.fillStyle = valid ? "rgba(72, 165, 255, 0.34)" : "rgba(255, 93, 93, 0.34)";
  ctx.fillRect(px + 1, py + 1, tile - 2, tile - 2);
  ctx.strokeStyle = valid ? "#48a5ff" : "#ff5d5d";
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 1, py + 1, tile - 2, tile - 2);
}

function canPlace(cell, type) {
  if (!cell || !state.unlocked.has(type)) return false;
  if (type === TILE.miner) return Boolean(resourceType(cell));
  return true;
}

function renderUi() {
  const bottlenecks = detectBottlenecks();
  rememberBottlenecks(bottlenecks);
  const score = efficiencyScore();
  ui.score.innerHTML = `
    <div class="score-card"><span>効率スコア</span><strong>${score}</strong></div>
    <div class="score-card"><span>ギア実測</span><strong>${ratePerMinute(state.producedWindow, "gear").toFixed(0)}/分</strong></div>
    <div class="score-card"><span>理論最大</span><strong>${theoreticalGearRate().toFixed(0)}/分</strong></div>
  `;
  ui.stats.innerHTML = Object.keys(ITEMS).map((item) => `
    <div class="stat-card">
      <span>${ITEMS[item].label}</span>
      <strong>${ratePerMinute(state.producedWindow, item).toFixed(1)}/分</strong>
      <span>消費 ${ratePerMinute(state.consumedWindow, item).toFixed(1)}/分 / 在庫 ${inventoryCount(item)}</span>
    </div>
  `).join("");
  ui.bottlenecks.innerHTML = bottlenecks.map((message) => `
    <div class="bottleneck ${message.level === "critical" ? "critical" : message.level === "ok" ? "ok" : ""}">${message.text}</div>
  `).join("");
  ui.utilization.innerHTML = machineUtilization().map((row) => `
    <div class="machine-row">
      <header><strong>${row.label}</strong><span>${row.rate}%</span></header>
      <div class="bar"><i style="width:${row.rate}%"></i></div>
      <span class="label">${row.detail}</span>
    </div>
  `).join("");
  ui.missions.innerHTML = missions().map((mission) => `
    <div class="mission ${mission.done ? "done" : ""}">
      <strong>${mission.done ? "達成" : "進行中"}</strong> ${mission.text}
      <div class="bar"><i style="width:${mission.progress}%"></i></div>
    </div>
  `).join("");
  ui.unlocks.innerHTML = TOOLS.slice(4).map((tool) => `
    <div class="unlock ${state.unlocked.has(tool.id) ? "" : "locked"}">
      <strong>${tool.icon} ${tool.label}</strong><br><span class="label">${state.unlocked.has(tool.id) ? "解放済み" : tool.detail}</span>
    </div>
  `).join("");
  ui.theory.innerHTML = `
    理論値 vs 実測: ギア ${theoreticalGearRate().toFixed(1)}/分 → ${ratePerMinute(state.producedWindow, "gear").toFixed(1)}/分<br>
    比率目安: 採掘機2 : 炉1 : 組立機1 で鉄板→ギアが安定します。
  `;
  ui.history.innerHTML = state.bottleneckHistory.length
    ? state.bottleneckHistory.map((entry) => `<div>${entry.time} ${entry.text}</div>`).join("")
    : "<span class=\"label\">まだ履歴はありません。</span>";
  renderSelection();
  renderChart();
}

function machineUtilization() {
  const groups = {};
  for (const [id, machine] of state.machines) {
    const cell = cellFromKey(id);
    if (!cell) continue;
    const label = tileLabel(cell.type);
    if (!groups[label]) groups[label] = { active: 0, idle: 0, blocked: 0, count: 0 };
    groups[label].active += machine.activeTime;
    groups[label].idle += machine.idleTime;
    groups[label].blocked += machine.blockedTime;
    groups[label].count += 1;
  }
  return Object.entries(groups).map(([label, group]) => {
    const total = Math.max(1, group.active + group.idle + group.blocked);
    return {
      label: `${label} x${group.count}`,
      rate: Math.round((group.active / total) * 100),
      detail: `停止 ${(group.blocked / total * 100).toFixed(0)}% / 待機 ${(group.idle / total * 100).toFixed(0)}%`,
    };
  });
}

function inventoryCount(item) {
  let count = 0;
  for (const storage of state.storages.values()) count += storage.items[item];
  for (const machine of state.machines.values()) count += machine.input[item] + machine.output[item];
  for (const belt of state.belts.values()) count += belt.items.filter((entry) => entry.item === item).length;
  return count;
}

function missions() {
  const ironPlate = ratePerMinute(state.producedWindow, "ironPlate");
  const gear = ratePerMinute(state.producedWindow, "gear");
  const jamRatio = jamRatioValue();
  return [
    { text: "鉄板を毎分100生産", progress: Math.min(100, ironPlate), done: ironPlate >= 100 },
    { text: "ギアを毎分30生産", progress: Math.min(100, gear / 30 * 100), done: gear >= 30 },
    { text: "詰まりゼロに近い状態を維持", progress: Math.max(0, 100 - jamRatio * 200), done: jamRatio < 0.03 },
  ];
}

function jamRatioValue() {
  const machineTime = [...state.machines.values()].reduce((sum, machine) => sum + machine.activeTime + machine.idleTime + machine.blockedTime, 0);
  const blocked = [...state.machines.values()].reduce((sum, machine) => sum + machine.blockedTime, 0);
  return blocked / Math.max(1, machineTime);
}

function renderSelection() {
  const tool = TOOLS.find((entry) => entry.id === selectedTool);
  const cell = selectedCell ? getCell(selectedCell.x, selectedCell.y) : null;
  let cellHtml = "タイル未選択";
  if (cell) {
    const machine = state.machines.get(key(cell.x, cell.y));
    const belt = state.belts.get(key(cell.x, cell.y));
    const storage = state.storages.get(key(cell.x, cell.y));
    cellHtml = `
      座標 ${cell.x}, ${cell.y}<br>
      タイル: ${cell.type === TILE.empty ? "空き" : tileLabel(cell.type)} ${cell.resource ? `/ 資源 ${cell.resource === TILE.iron ? "鉄" : "銅"}` : ""}<br>
      状態: ${machine?.lastReason ?? (belt ? `積載 ${belt.items.length}/${cell.type === TILE.fastBelt ? 6 : 4}` : storage ? `在庫 ${Object.values(storage.items).reduce((a, b) => a + b, 0)}/60` : "通常")}
    `;
  }
  ui.selection.innerHTML = `
    <strong>${tool.icon} ${tool.label}</strong><br>
    向き: ${DIRECTIONS[direction].symbol}<br>
    ${tool.detail}<hr>
    ${cellHtml}
  `;
}

function renderChart() {
  const w = chart.width;
  const h = chart.height;
  chartCtx.clearRect(0, 0, w, h);
  chartCtx.strokeStyle = "rgba(145, 163, 189, 0.2)";
  chartCtx.lineWidth = 1;
  for (let i = 1; i < 4; i += 1) {
    chartCtx.beginPath();
    chartCtx.moveTo(0, (h / 4) * i);
    chartCtx.lineTo(w, (h / 4) * i);
    chartCtx.stroke();
  }
  const items = ["ironPlate", "gear"];
  items.forEach((item) => {
    const points = productionSeries(item);
    chartCtx.strokeStyle = ITEMS[item].color;
    chartCtx.lineWidth = 3;
    chartCtx.beginPath();
    points.forEach((value, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * w;
      const y = h - Math.min(1, value / 120) * (h - 14) - 7;
      if (index === 0) chartCtx.moveTo(x, y);
      else chartCtx.lineTo(x, y);
    });
    chartCtx.stroke();
  });
  chartCtx.fillStyle = "#91a3bd";
  chartCtx.font = "11px sans-serif";
  chartCtx.fillText("鉄板 / ギア items/min", 10, 16);
}

function productionSeries(item) {
  const bins = Array.from({ length: 30 }, () => 0);
  state.producedWindow.forEach((event) => {
    if (event.item !== item) return;
    const age = gameTime - event.t;
    const index = Math.max(0, Math.min(29, 29 - Math.floor(age / 2)));
    bins[index] += event.count * 30;
  });
  return bins;
}

function setupToolbox() {
  ui.toolbox.innerHTML = TOOLS.map((tool) => `
    <button class="tool ${tool.id === selectedTool ? "active" : ""}" data-tool="${tool.id}">
      <span>${tool.icon}</span>
      <strong>${tool.label}</strong>
      <small>${tool.detail}</small>
    </button>
  `).join("");
  ui.toolbox.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tool]");
    if (!button) return;
    selectedTool = button.dataset.tool;
    document.querySelectorAll(".tool").forEach((tool) => tool.classList.toggle("active", tool.dataset.tool === selectedTool));
    renderSelection();
  });
}

function setupControls() {
  document.querySelectorAll(".speed").forEach((button) => {
    button.addEventListener("click", () => {
      speed = Number(button.dataset.speed);
      document.querySelectorAll(".speed").forEach((entry) => entry.classList.toggle("active", entry === button));
    });
  });
  document.querySelector("#pauseBtn").addEventListener("click", () => {
    paused = !paused;
    document.querySelector("#pauseBtn").textContent = paused ? "再開" : "停止";
  });
  window.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "r") {
      direction = (direction + 1) % 4;
      renderSelection();
    }
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("mousemove", pointerMove);
  canvas.addEventListener("mouseleave", () => {
    hoverCell = null;
    ui.hoverTip.style.display = "none";
  });
  canvas.addEventListener("mousedown", (event) => {
    const cell = pointerCell(event);
    if (!cell) return;
    selectedCell = { x: cell.x, y: cell.y };
    if (event.button === 2) remove(cell.x, cell.y);
    if (event.button === 0 && canPlace(cell, selectedTool)) place(cell.x, cell.y, selectedTool, direction);
    renderSelection();
  });
}

function pointerMove(event) {
  const cell = pointerCell(event);
  hoverCell = cell ? { x: cell.x, y: cell.y } : null;
  if (!cell) {
    ui.hoverTip.style.display = "none";
    return;
  }
  const rect = canvas.getBoundingClientRect();
  ui.hoverTip.style.left = `${event.clientX - rect.left}px`;
  ui.hoverTip.style.top = `${event.clientY - rect.top}px`;
  ui.hoverTip.style.display = "block";
  const belt = state.belts.get(key(cell.x, cell.y));
  const machine = state.machines.get(key(cell.x, cell.y));
  ui.hoverTip.innerHTML = `
    <strong>${cell.x},${cell.y}</strong> ${cell.type === TILE.empty ? "空き" : tileLabel(cell.type)}<br>
    ${cell.resource ? `資源: ${cell.resource === TILE.iron ? "鉄" : "銅"}<br>` : ""}
    ${belt ? `ベルト: ${belt.items.length}/${cell.type === TILE.fastBelt ? 6 : 4} ${belt.items.map((entry) => ITEMS[entry.item].label).join(", ")}<br>` : ""}
    ${machine ? `状態: ${machine.lastReason}<br>` : ""}
    流量: ${(cell.throughput ?? 0).toFixed(1)}
  `;
}

function pointerCell(event) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((event.clientX - rect.left) / rect.width) * GRID_SIZE);
  const y = Math.floor(((event.clientY - rect.top) / rect.height) * GRID_SIZE);
  return getCell(x, y);
}

function loop(now) {
  const rawDt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (!paused) {
    const steps = Math.max(1, speed * 2);
    for (let i = 0; i < steps; i += 1) update((rawDt * speed) / steps);
  }
  uiTimer += rawDt;
  render();
  if (uiTimer > 0.35) {
    renderUi();
    uiTimer = 0;
  }
  requestAnimationFrame(loop);
}

function init() {
  createGrid();
  seedFactory();
  setupToolbox();
  setupControls();
  renderUi();
  requestAnimationFrame(loop);
}

init();
