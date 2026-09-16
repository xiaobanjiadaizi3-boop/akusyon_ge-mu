"use strict";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const W = canvas.width;
const H = canvas.height;

const COLORS = ["#4cc9f0", "#f7717d"];
const NAMES = ["P1", "P2"];

const keys = new Set();
const KEYMAP = [
  { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD" },
  { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" },
];

function axis(p) {
  const m = KEYMAP[p];
  return {
    x: (keys.has(m.right) ? 1 : 0) - (keys.has(m.left) ? 1 : 0),
    y: (keys.has(m.down) ? 1 : 0) - (keys.has(m.up) ? 1 : 0),
  };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const rand = (a, b) => a + Math.random() * (b - a);

function circle(x, y, r, color, stroke) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = 3;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function drawPlayer(p, i, r = 18) {
  circle(p.x, p.y, r, COLORS[i], "#fff");
  ctx.fillStyle = "#0b0e14";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(NAMES[i], p.x, p.y);
}

function drawTimer(t) {
  ctx.fillStyle = "#e8ecf3";
  ctx.font = "bold 28px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(Math.max(0, Math.ceil(t)), W / 2, 12);
}

function drawScores(a, b) {
  ctx.font = "bold 24px sans-serif";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = COLORS[0];
  ctx.fillText(a, 16, 12);
  ctx.textAlign = "right";
  ctx.fillStyle = COLORS[1];
  ctx.fillText(b, W - 16, 12);
}

// ---------- 1. 相撲 ----------
class Sumo {
  static title = "相撲";
  static desc = "相手を土俵の外に押し出せ";
  init() {
    this.r = 220;
    this.cx = W / 2;
    this.cy = H / 2;
    this.p = [
      { x: this.cx - 120, y: this.cy, vx: 0, vy: 0 },
      { x: this.cx + 120, y: this.cy, vx: 0, vy: 0 },
    ];
  }
  update(dt) {
    const acc = 900;
    const fr = 0.9;
    this.p.forEach((p, i) => {
      const a = axis(i);
      p.vx += a.x * acc * dt;
      p.vy += a.y * acc * dt;
      p.vx *= fr ** (dt * 60);
      p.vy *= fr ** (dt * 60);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    });
    const [a, b] = this.p;
    const d = dist(a, b);
    const R = 22;
    if (d < R * 2 && d > 0) {
      const nx = (b.x - a.x) / d;
      const ny = (b.y - a.y) / d;
      const overlap = R * 2 - d;
      a.x -= nx * overlap / 2;
      a.y -= ny * overlap / 2;
      b.x += nx * overlap / 2;
      b.y += ny * overlap / 2;
      const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (rel > 0) {
        const push = rel * 1.3;
        a.vx -= push * nx;
        a.vy -= push * ny;
        b.vx += push * nx;
        b.vy += push * ny;
      }
    }
    const out = this.p.map((p) => dist(p, { x: this.cx, y: this.cy }) > this.r);
    if (out[0] && out[1]) return "draw";
    if (out[0]) return 1;
    if (out[1]) return 0;
    return null;
  }
  draw() {
    circle(this.cx, this.cy, this.r, "#3a2d1c", "#c99a4a");
    circle(this.cx, this.cy, 6, "#c99a4a");
    this.p.forEach((p, i) => drawPlayer(p, i, 22));
  }
}

// ---------- 2. ライトサイクル ----------
class Tron {
  static title = "ライトサイクル";
  static desc = "壁や軌跡に当たると負け";
  init() {
    this.cell = 10;
    this.cols = W / this.cell;
    this.rows = H / this.cell;
    this.grid = new Uint8Array(this.cols * this.rows);
    this.p = [
      { x: 10, y: this.rows / 2, dx: 1, dy: 0 },
      { x: this.cols - 11, y: this.rows / 2, dx: -1, dy: 0 },
    ];
    this.p.forEach((p, i) => (this.grid[p.y * this.cols + p.x] = i + 1));
    this.acc = 0;
  }
  update(dt) {
    this.p.forEach((p, i) => {
      const a = axis(i);
      if (a.x && !p.dx) { p.dx = a.x; p.dy = 0; }
      else if (a.y && !p.dy) { p.dy = a.y; p.dx = 0; }
    });
    this.acc += dt;
    const step = 1 / 22;
    let dead = [false, false];
    while (this.acc >= step) {
      this.acc -= step;
      const next = this.p.map((p) => ({ x: p.x + p.dx, y: p.y + p.dy }));
      next.forEach((n, i) => {
        if (n.x < 0 || n.y < 0 || n.x >= this.cols || n.y >= this.rows) dead[i] = true;
        else if (this.grid[n.y * this.cols + n.x]) dead[i] = true;
      });
      if (next[0].x === next[1].x && next[0].y === next[1].y) dead = [true, true];
      if (dead[0] || dead[1]) break;
      next.forEach((n, i) => {
        this.p[i].x = n.x;
        this.p[i].y = n.y;
        this.grid[n.y * this.cols + n.x] = i + 1;
      });
    }
    if (dead[0] && dead[1]) return "draw";
    if (dead[0]) return 1;
    if (dead[1]) return 0;
    return null;
  }
  draw() {
    for (let i = 0; i < this.grid.length; i++) {
      const v = this.grid[i];
      if (!v) continue;
      ctx.fillStyle = COLORS[v - 1];
      ctx.fillRect((i % this.cols) * this.cell, Math.floor(i / this.cols) * this.cell, this.cell, this.cell);
    }
    this.p.forEach((p, i) => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(p.x * this.cell - 2, p.y * this.cell - 2, this.cell + 4, this.cell + 4);
      ctx.fillStyle = COLORS[i];
      ctx.fillRect(p.x * this.cell, p.y * this.cell, this.cell, this.cell);
    });
  }
}

// ---------- 3. コイン集め ----------
class Coins {
  static title = "コイン集め";
  static desc = "30秒で多くコインを取れ";
  init() {
    this.t = 30;
    this.p = [
      { x: 150, y: H / 2, score: 0 },
      { x: W - 150, y: H / 2, score: 0 },
    ];
    this.coins = [];
    for (let i = 0; i < 6; i++) this.spawn();
  }
  spawn() {
    this.coins.push({ x: rand(40, W - 40), y: rand(60, H - 40), gold: Math.random() < 0.15 });
  }
  update(dt) {
    this.t -= dt;
    const sp = 320;
    this.p.forEach((p, i) => {
      const a = axis(i);
      const l = Math.hypot(a.x, a.y) || 1;
      p.x = clamp(p.x + (a.x / l) * sp * dt, 18, W - 18);
      p.y = clamp(p.y + (a.y / l) * sp * dt, 50, H - 18);
      let taken = 0;
      this.coins = this.coins.filter((c) => {
        if (dist(p, c) < 28) {
          p.score += c.gold ? 3 : 1;
          taken++;
          return false;
        }
        return true;
      });
      for (let k = 0; k < taken; k++) this.spawn();
    });
    if (this.t <= 0) {
      const [a, b] = this.p.map((p) => p.score);
      return a === b ? "draw" : a > b ? 0 : 1;
    }
    return null;
  }
  draw() {
    this.coins.forEach((c) => circle(c.x, c.y, c.gold ? 14 : 10, c.gold ? "#ffd166" : "#f4a261", "#fff"));
    this.p.forEach((p, i) => drawPlayer(p, i));
    drawTimer(this.t);
    drawScores(this.p[0].score, this.p[1].score);
  }
}

// ---------- 4. 鬼ごっこ ----------
class Tag {
  static title = "鬼ごっこ";
  static desc = "鬼の時間が短いほうが勝ち";
  init() {
    this.t = 30;
    this.p = [
      { x: 150, y: H / 2, itTime: 0 },
      { x: W - 150, y: H / 2, itTime: 0 },
    ];
    this.it = Math.random() < 0.5 ? 0 : 1;
    this.cooldown = 0;
    this.walls = [
      { x: 300, y: 150, w: 30, h: 140 },
      { x: 570, y: 310, w: 30, h: 140 },
      { x: 400, y: 80, w: 100, h: 30 },
      { x: 400, y: 490, w: 100, h: 30 },
    ];
  }
  collide(p) {
    this.walls.forEach((w) => {
      const nx = clamp(p.x, w.x, w.x + w.w);
      const ny = clamp(p.y, w.y, w.y + w.h);
      const d = Math.hypot(p.x - nx, p.y - ny);
      if (d < 18 && d > 0) {
        p.x += ((p.x - nx) / d) * (18 - d);
        p.y += ((p.y - ny) / d) * (18 - d);
      }
    });
  }
  update(dt) {
    this.t -= dt;
    this.cooldown -= dt;
    this.p.forEach((p, i) => {
      const a = axis(i);
      const l = Math.hypot(a.x, a.y) || 1;
      const sp = i === this.it ? 340 : 300;
      p.x = clamp(p.x + (a.x / l) * sp * dt, 18, W - 18);
      p.y = clamp(p.y + (a.y / l) * sp * dt, 50, H - 18);
      this.collide(p);
    });
    this.p[this.it].itTime += dt;
    if (this.cooldown <= 0 && dist(this.p[0], this.p[1]) < 36) {
      this.it = 1 - this.it;
      this.cooldown = 1.2;
    }
    if (this.t <= 0) {
      const [a, b] = this.p.map((p) => p.itTime);
      if (Math.abs(a - b) < 0.05) return "draw";
      return a < b ? 0 : 1;
    }
    return null;
  }
  draw() {
    ctx.fillStyle = "#2a3140";
    this.walls.forEach((w) => ctx.fillRect(w.x, w.y, w.w, w.h));
    this.p.forEach((p, i) => {
      if (i === this.it) circle(p.x, p.y, 28, "rgba(255,80,80,0.25)");
      drawPlayer(p, i);
      if (i === this.it) {
        ctx.fillStyle = "#ff5050";
        ctx.font = "bold 18px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("鬼", p.x, p.y - 22);
      }
    });
    drawTimer(this.t);
    drawScores(`鬼 ${this.p[0].itTime.toFixed(1)}s`, `鬼 ${this.p[1].itTime.toFixed(1)}s`);
  }
}

// ---------- 5. 弾よけ ----------
class Dodge {
  static title = "弾よけ";
  static desc = "降ってくる弾を避けて生き残れ";
  init() {
    this.t = 0;
    this.p = [
      { x: W / 2 - 80, y: H - 60, alive: true },
      { x: W / 2 + 80, y: H - 60, alive: true },
    ];
    this.bullets = [];
    this.spawnAcc = 0;
  }
  update(dt) {
    this.t += dt;
    this.spawnAcc += dt;
    const rate = Math.max(0.08, 0.35 - this.t * 0.012);
    while (this.spawnAcc >= rate) {
      this.spawnAcc -= rate;
      this.bullets.push({ x: rand(10, W - 10), y: -10, vy: rand(180, 320) + this.t * 8, vx: rand(-60, 60), r: rand(7, 14) });
    }
    this.bullets.forEach((b) => {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    });
    this.bullets = this.bullets.filter((b) => b.y < H + 20);
    const sp = 330;
    this.p.forEach((p, i) => {
      if (!p.alive) return;
      const a = axis(i);
      const l = Math.hypot(a.x, a.y) || 1;
      p.x = clamp(p.x + (a.x / l) * sp * dt, 16, W - 16);
      p.y = clamp(p.y + (a.y / l) * sp * dt, H / 2, H - 16);
      if (this.bullets.some((b) => dist(p, b) < b.r + 14)) p.alive = false;
    });
    const [a, b] = this.p.map((p) => p.alive);
    if (!a && !b) return "draw";
    if (!a) return 1;
    if (!b) return 0;
    return null;
  }
  draw() {
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(0, H / 2 - 16, W, H / 2 + 16);
    this.bullets.forEach((b) => circle(b.x, b.y, b.r, "#f4a261"));
    this.p.forEach((p, i) => p.alive && drawPlayer(p, i, 16));
    drawTimer(this.t);
  }
}

// ---------- 6. 陣取り ----------
class Territory {
  static title = "陣取り";
  static desc = "30秒で多くマスを塗れ";
  init() {
    this.t = 30;
    this.cell = 30;
    this.cols = W / this.cell;
    this.rows = H / this.cell;
    this.grid = new Uint8Array(this.cols * this.rows);
    this.p = [
      { x: 90, y: H / 2 },
      { x: W - 90, y: H / 2 },
    ];
  }
  update(dt) {
    this.t -= dt;
    const sp = 300;
    this.p.forEach((p, i) => {
      const a = axis(i);
      const l = Math.hypot(a.x, a.y) || 1;
      p.x = clamp(p.x + (a.x / l) * sp * dt, 14, W - 14);
      p.y = clamp(p.y + (a.y / l) * sp * dt, 14, H - 14);
      const cx = Math.floor(p.x / this.cell);
      const cy = Math.floor(p.y / this.cell);
      this.grid[cy * this.cols + cx] = i + 1;
    });
    if (this.t <= 0) {
      const [a, b] = this.count();
      return a === b ? "draw" : a > b ? 0 : 1;
    }
    return null;
  }
  count() {
    let a = 0;
    let b = 0;
    for (const v of this.grid) {
      if (v === 1) a++;
      else if (v === 2) b++;
    }
    return [a, b];
  }
  draw() {
    for (let i = 0; i < this.grid.length; i++) {
      const v = this.grid[i];
      if (!v) continue;
      ctx.fillStyle = v === 1 ? "rgba(76,201,240,0.55)" : "rgba(247,113,125,0.55)";
      ctx.fillRect((i % this.cols) * this.cell, Math.floor(i / this.cols) * this.cell, this.cell, this.cell);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= this.cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * this.cell, 0);
      ctx.lineTo(x * this.cell, H);
      ctx.stroke();
    }
    for (let y = 0; y <= this.rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * this.cell);
      ctx.lineTo(W, y * this.cell);
      ctx.stroke();
    }
    this.p.forEach((p, i) => drawPlayer(p, i, 14));
    drawTimer(this.t);
    const [a, b] = this.count();
    drawScores(a, b);
  }
}

const GAMES = [Sumo, Tron, Coins, Tag, Dodge, Territory];

// ---------- 状態管理 ----------
const state = {
  screen: "menu", // menu | countdown | play | result
  selected: 0,
  game: null,
  countdown: 0,
  result: null,
  wins: [0, 0],
};

function updateScoreboard() {
  document.getElementById("scoreP1").textContent = state.wins[0];
  document.getElementById("scoreP2").textContent = state.wins[1];
}

function renderOverlay() {
  if (state.screen === "menu") {
    const items = GAMES.map(
      (g, i) =>
        `<li class="${i === state.selected ? "selected" : ""}"><span><span class="key">${i + 1}</span> ${g.title}</span><span class="desc">${g.desc}</span></li>`
    ).join("");
    overlay.innerHTML = `<div class="card"><h2>ゲームを選択</h2><p>W/S または ↑/↓ で選択、Space で開始</p><ul class="menu">${items}</ul></div>`;
  } else if (state.screen === "countdown") {
    overlay.innerHTML = `<div class="card"><h2>${state.game.constructor.title}</h2><p>${state.game.constructor.desc}</p><div class="big">${Math.ceil(state.countdown)}</div></div>`;
  } else if (state.screen === "result") {
    const r = state.result;
    const who = r === "draw" ? "引き分け" : `<span class="p${r + 1}">${NAMES[r]} の勝ち!</span>`;
    overlay.innerHTML = `<div class="card"><h2>${state.game.constructor.title}</h2><div class="big">${who}</div><p>Space: もう一度 / Esc: メニュー</p></div>`;
  } else {
    overlay.innerHTML = "";
  }
}

function startGame(idx) {
  state.selected = idx;
  state.game = new GAMES[idx]();
  state.game.init();
  state.countdown = 3;
  state.screen = "countdown";
  renderOverlay();
}

function toMenu() {
  state.screen = "menu";
  state.game = null;
  renderOverlay();
}

document.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);

  if (state.screen === "menu") {
    if (e.code === "KeyW" || e.code === "ArrowUp") state.selected = (state.selected + GAMES.length - 1) % GAMES.length;
    if (e.code === "KeyS" || e.code === "ArrowDown") state.selected = (state.selected + 1) % GAMES.length;
    const n = Number(e.key);
    if (n >= 1 && n <= GAMES.length) state.selected = n - 1;
    if (e.code === "Space" || e.code === "Enter") startGame(state.selected);
    renderOverlay();
  } else if (state.screen === "result") {
    if (e.code === "Space" || e.code === "Enter") startGame(state.selected);
    if (e.code === "Escape") toMenu();
  } else if (e.code === "Escape") {
    toMenu();
  }
});
document.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => keys.clear());

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  ctx.clearRect(0, 0, W, H);

  if (state.screen === "countdown") {
    state.countdown -= dt;
    if (state.countdown <= 0) {
      state.screen = "play";
    }
    renderOverlay();
    state.game.draw();
  } else if (state.screen === "play") {
    const r = state.game.update(dt);
    state.game.draw();
    if (r !== null) {
      state.result = r;
      state.screen = "result";
      if (r !== "draw") state.wins[r]++;
      updateScoreboard();
      renderOverlay();
    }
  } else if (state.screen === "result") {
    state.game.draw();
  } else {
    ctx.fillStyle = "#1a2030";
    ctx.font = "bold 40px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("WASD  vs  ↑↓←→", W / 2, H / 2);
  }

  requestAnimationFrame(frame);
}

renderOverlay();
updateScoreboard();
requestAnimationFrame(frame);
