import * as THREE from "three";

const canvas = document.getElementById("scene");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const logEl = document.getElementById("log");
const hitmarker = document.getElementById("hitmarker");
const scoreEl = document.getElementById("score");
const killsEl = document.getElementById("kills");
const accuracyEl = document.getElementById("accuracy");
const weaponNameEl = document.getElementById("weaponName");
const magAmmoEl = document.getElementById("magAmmo");
const reserveAmmoEl = document.getElementById("reserveAmmo");
const ammoEl = document.getElementById("ammo");
const blinkFill = document.getElementById("blinkFill");
const blinkText = document.getElementById("blinkText");
const wheelEl = document.getElementById("weaponWheel");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x27384f);
scene.fog = new THREE.Fog(0x27384f, 80, 230);

const camera = new THREE.PerspectiveCamera(74, 1, 0.05, 400);
scene.add(camera);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);

scene.add(new THREE.AmbientLight(0xa8c2e0, 0.9));
scene.add(new THREE.HemisphereLight(0xbcd8ff, 0x35404f, 1.5));
const sun = new THREE.DirectionalLight(0xfff2da, 2.6);
sun.position.set(40, 66, 26);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -90;
sun.shadow.camera.right = 90;
sun.shadow.camera.top = 90;
sun.shadow.camera.bottom = -90;
sun.shadow.camera.far = 240;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.06;
scene.add(sun);

// ------------------------------------------------------------------ world

const ARENA = 80;
const colliders = [];
const solidMeshes = [];

const materials = {
  floor: new THREE.MeshStandardMaterial({ color: 0x4a5668, roughness: 0.96 }),
  crate: new THREE.MeshStandardMaterial({ color: 0x77603f, roughness: 0.85 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0x565f70, roughness: 0.92 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x8794a6, roughness: 0.35, metalness: 0.6 }),
  platform: new THREE.MeshStandardMaterial({ color: 0x3d6f8f, roughness: 0.6 }),
  pad: new THREE.MeshStandardMaterial({ color: 0x1fa87f, emissive: 0x0f6b50, roughness: 0.4 }),
  wall: new THREE.MeshStandardMaterial({ color: 0x3b4658, roughness: 1 }),
};

function addBox(x, y, z, sx, sy, sz, material, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), material);
  mesh.position.set(x, y + sy / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  solidMeshes.push(mesh);
  const box = new THREE.Box3().setFromObject(mesh);
  colliders.push({ box, pad: !!opts.pad });
  return mesh;
}

const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA * 2, ARENA * 2), materials.floor);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
solidMeshes.push(floor);

const grid = new THREE.GridHelper(ARENA * 2, 64, 0x3c4a61, 0x2f3949);
grid.position.y = 0.02;
grid.material.opacity = 0.35;
grid.material.transparent = true;
scene.add(grid);

// outer walls
const WALL_H = 14;
addBox(0, 0, -ARENA, ARENA * 2, WALL_H, 2, materials.wall);
addBox(0, 0, ARENA, ARENA * 2, WALL_H, 2, materials.wall);
addBox(-ARENA, 0, 0, 2, WALL_H, ARENA * 2, materials.wall);
addBox(ARENA, 0, 0, 2, WALL_H, ARENA * 2, materials.wall);

// low cover crates scattered around the spawn side
const coverLayout = [
  [-14, 10, 3, 1.2, 3],
  [-6, 4, 2.4, 1.8, 2.4],
  [6, 6, 3, 1.0, 3],
  [14, 12, 2.6, 2.4, 2.6],
  [-22, -4, 4, 1.6, 2],
  [20, -2, 2, 2.0, 5],
  [0, -14, 6, 1.2, 2],
  [-10, -22, 2.5, 2.6, 2.5],
  [11, -24, 3.5, 1.4, 3.5],
  [26, 16, 3, 3.2, 3],
  [-28, 18, 3, 2.2, 6],
  [30, -18, 5, 1.8, 3],
];
for (const [x, z, sx, sy, sz] of coverLayout) {
  addBox(x, 0, z, sx, sy, sz, materials.crate);
}

// concrete pillars for vertical cover
for (const [x, z] of [[-18, 0], [18, 0], [-34, -30], [34, -30], [0, 28], [-40, 34], [40, 34]]) {
  addBox(x, 0, z, 2.4, 9, 2.4, materials.concrete);
}

// ------------------------------------------------- athletic (parkour) course

// stairs climbing to the first tower
for (let i = 0; i < 6; i++) {
  addBox(-44 + i * 3.4, 0, -12, 3.4, 1.1 * (i + 1), 4.5, materials.concrete);
}
// tower top
addBox(-22, 6.6, -12, 6, 1, 6, materials.platform);

// floating platforms, increasing gaps and heights
const floaters = [
  [-14, 7.4, -12, 4, 4],
  [-7, 8.6, -14.5, 3.4, 3.4],
  [-0.5, 9.8, -12, 3, 3],
  [5.5, 11.0, -9, 2.8, 2.8],
  [11.5, 12.2, -12.5, 2.6, 2.6],
  [17.5, 10.4, -16, 3.2, 3.2],
  [24, 8.2, -12, 4, 4],
];
for (const [x, y, z, sx, sz] of floaters) {
  addBox(x, y, z, sx, 0.6, sz, materials.platform);
}

// sniper nest at the end of the floating chain
addBox(32, 8.2, -12, 8, 0.8, 8, materials.metal);
addBox(32, 9.0, -8.6, 8, 1.1, 0.6, materials.metal);
addBox(35.7, 9.0, -12, 0.6, 1.1, 8, materials.metal);

// jump pads that launch the player onto the course
addBox(-40, 0, 16, 3, 0.4, 3, materials.pad, { pad: true });
addBox(12, 0, 22, 3, 0.4, 3, materials.pad, { pad: true });
addBox(-4, 0, -30, 3, 0.4, 3, materials.pad, { pad: true });

// staggered blocks above the right-hand jump pad
addBox(12, 5.5, 16, 4, 0.6, 4, materials.platform);
addBox(12, 8.5, 9, 4, 0.6, 4, materials.platform);
addBox(6, 11.0, 4, 4, 0.6, 4, materials.platform);
addBox(-2, 12.5, 4, 5, 0.6, 5, materials.platform);

// catwalk ring in the back of the arena
for (let i = 0; i < 5; i++) {
  addBox(-46 + i * 11, 4.2, 44, 9, 0.6, 3.2, materials.metal);
}
addBox(-52, 0, 44, 3, 4.2, 3, materials.concrete);
addBox(6, 4.2, 36, 3.2, 0.6, 14, materials.metal);

// ------------------------------------------------------------------ dummies

const dummies = [];
const dummyParts = [];

const dummyMats = {
  body: new THREE.MeshStandardMaterial({ color: 0xd8613f, roughness: 0.65 }),
  head: new THREE.MeshStandardMaterial({ color: 0xf0c04a, roughness: 0.5 }),
  dead: new THREE.MeshStandardMaterial({ color: 0x3b4352, roughness: 0.9 }),
};

function createDummy(config) {
  const group = new THREE.Group();
  group.position.copy(config.position);
  scene.add(group);

  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.2, 16), materials.metal);
  stand.position.y = 0.1;
  stand.castShadow = true;
  group.add(stand);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 10), materials.metal);
  pole.position.y = 0.35;
  group.add(pole);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.95, 6, 14), dummyMats.body.clone());
  body.position.y = 1.35;
  body.castShadow = true;
  group.add(body);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), dummyMats.head.clone());
  head.position.y = 2.22;
  head.castShadow = true;
  group.add(head);

  const dummy = {
    group,
    body,
    head,
    kind: config.kind,
    origin: config.position.clone(),
    path: config.path || null,
    speed: config.speed || 3,
    phase: Math.random() * Math.PI * 2,
    maxHp: config.hp || 100,
    hp: config.hp || 100,
    alive: true,
    respawnAt: 0,
  };

  body.userData = { dummy, part: "body" };
  head.userData = { dummy, part: "head" };
  dummyParts.push(body, head);
  dummies.push(dummy);
  return dummy;
}

function spawnDummies() {
  const statics = [
    [-14, 0, 6], [7, 0, 9], [22, 0, 4], [-26, 0, -6], [3, 0, -20],
    [-9, 0, -26], [30, 0, -22], [-36, 0, 22], [17, 0, 26], [-2, 0, 38],
    [-22, 7.6, -12], [24, 8.8, -12], [32, 9.0, -14], [12, 6.1, 16], [-2, 13.1, 4],
    [-24, 4.8, 44], [6, 4.8, 42],
  ];
  for (const [x, y, z] of statics) {
    createDummy({ kind: "static", position: new THREE.Vector3(x, y, z) });
  }

  const patrols = [
    { from: new THREE.Vector3(-30, 0, -34), to: new THREE.Vector3(30, 0, -34), speed: 5.5 },
    { from: new THREE.Vector3(-18, 0, 30), to: new THREE.Vector3(24, 0, 30), speed: 4.2 },
    { from: new THREE.Vector3(40, 0, -6), to: new THREE.Vector3(40, 0, 34), speed: 6 },
    { from: new THREE.Vector3(-44, 4.8, 44), to: new THREE.Vector3(-4, 4.8, 44), speed: 5 },
  ];
  for (const p of patrols) {
    createDummy({ kind: "patrol", position: p.from.clone(), path: p, speed: p.speed, hp: 80 });
  }

  const poppers = [
    [-14, 0, -8], [10, 0, -6], [-6, 0, 16], [26, 0, 14],
  ];
  for (const [x, y, z] of poppers) {
    createDummy({ kind: "popup", position: new THREE.Vector3(x, y, z), hp: 60 });
  }
}
spawnDummies();

function updateDummies(dt, time) {
  for (const d of dummies) {
    if (!d.alive) {
      if (time >= d.respawnAt) respawnDummy(d);
      continue;
    }
    if (d.kind === "patrol" && d.path) {
      const t = (Math.sin(time * d.speed * 0.12 + d.phase) + 1) / 2;
      d.group.position.lerpVectors(d.path.from, d.path.to, t);
    } else if (d.kind === "popup") {
      const hidden = THREE.MathUtils.clamp(-Math.sin(time * 1.2 + d.phase) * 3, 0, 1);
      d.group.position.y = d.origin.y - hidden * 2.9;
    }
    d.group.rotation.y += dt * (d.kind === "static" ? 0.25 : 0.8);
  }
}

function killDummy(d, time) {
  d.alive = false;
  d.hp = 0;
  d.body.material = dummyMats.dead;
  d.head.material = dummyMats.dead;
  d.group.rotation.z = Math.PI / 2.2;
  d.group.position.y -= 0.5;
  d.respawnAt = time + 3.2;
}

function respawnDummy(d) {
  d.alive = true;
  d.hp = d.maxHp;
  d.body.material = dummyMats.body.clone();
  d.head.material = dummyMats.head.clone();
  d.group.rotation.set(0, 0, 0);
  d.group.position.copy(d.origin);
}

// ------------------------------------------------------------------ weapons

const WEAPONS = [
  {
    name: "ハンドガン", short: "1 PISTOL", auto: false, damage: 34, headMult: 2.2,
    rpm: 320, magSize: 12, reserve: 96, spread: 0.004, pellets: 1, reload: 1.1,
    recoil: 0.9, range: 120, color: 0x9fd8ff,
  },
  {
    name: "アサルトライフル", short: "2 RIFLE", auto: true, damage: 21, headMult: 2.0,
    rpm: 700, magSize: 30, reserve: 180, spread: 0.014, pellets: 1, reload: 1.8,
    recoil: 0.7, range: 150, color: 0xffe08a,
  },
  {
    name: "ショットガン", short: "3 SHOTGUN", auto: false, damage: 13, headMult: 1.6,
    rpm: 75, magSize: 6, reserve: 48, spread: 0.055, pellets: 9, reload: 2.4,
    recoil: 2.4, range: 45, color: 0xffb27a,
  },
  {
    name: "スナイパー", short: "4 SNIPER", auto: false, damage: 125, headMult: 2.0,
    rpm: 48, magSize: 5, reserve: 30, spread: 0.0008, pellets: 1, reload: 2.6,
    recoil: 3.2, range: 260, color: 0xb9a6ff,
  },
];

const ammoState = WEAPONS.map((w) => ({ mag: w.magSize, reserve: w.reserve }));
let weaponIndex = 0;
let nextShotAt = 0;
let reloadDoneAt = 0;
let reloading = false;

for (const w of WEAPONS) {
  const slot = document.createElement("div");
  slot.className = "slot";
  slot.textContent = w.short;
  wheelEl.appendChild(slot);
}

function currentWeapon() {
  return WEAPONS[weaponIndex];
}

// simple view model built from boxes
const viewModel = new THREE.Group();
camera.add(viewModel);
const viewParts = [];

function buildViewModel() {
  for (const part of viewParts) {
    viewModel.remove(part);
    part.geometry.dispose();
  }
  viewParts.length = 0;

  const w = currentWeapon();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a5468, roughness: 0.5, metalness: 0.35 });
  const accentMat = new THREE.MeshStandardMaterial({ color: w.color, roughness: 0.4, metalness: 0.3 });

  const sizes = {
    0: [[0.12, 0.13, 0.42], [0.09, 0.09, 0.2]],
    1: [[0.13, 0.15, 0.78], [0.08, 0.08, 0.34]],
    2: [[0.17, 0.18, 0.82], [0.13, 0.13, 0.3]],
    3: [[0.12, 0.14, 1.05], [0.07, 0.07, 0.5]],
  }[weaponIndex];

  const body = new THREE.Mesh(new THREE.BoxGeometry(...sizes[0]), bodyMat);
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(...sizes[1]), accentMat);
  barrel.position.z = -(sizes[0][2] / 2 + sizes[1][2] / 2);
  const gripGeo = new THREE.BoxGeometry(0.09, 0.2, 0.11);
  const grip = new THREE.Mesh(gripGeo, bodyMat);
  grip.position.set(0, -0.14, sizes[0][2] / 2 - 0.1);
  grip.rotation.x = -0.18;

  for (const part of [body, barrel, grip]) {
    viewModel.add(part);
    viewParts.push(part);
  }
  viewModel.position.set(0.3, -0.26, -0.85);
  viewModel.scale.setScalar(0.62);
}

const muzzleLight = new THREE.PointLight(0xffd9a0, 0, 9, 2);
muzzleLight.position.set(0.22, -0.14, -1.1);
camera.add(muzzleLight);

const gunLight = new THREE.PointLight(0xdce9ff, 2.2, 3, 2);
gunLight.position.set(0.45, 0.15, -0.3);
camera.add(gunLight);

// ------------------------------------------------------------------ player

const player = {
  position: new THREE.Vector3(-8, 0, 46),
  velocity: new THREE.Vector3(),
  radius: 0.36,
  height: 1.8,
  eye: 1.62,
  onGround: false,
  yaw: 0,
  pitch: 0,
  blinkReadyAt: 0,
};

const BLINK_COOLDOWN = 3.2;
const BLINK_DISTANCE = 7.5;
const GRAVITY = 26;
const JUMP_SPEED = 9.1;
const MOVE_SPEED = 8.4;
const AIR_CONTROL = 0.42;
const PAD_SPEED = 17.5;

const keys = new Set();
let pointerLocked = false;
let recoilKick = 0;
let bobTime = 0;
let shotsFired = 0;
let shotsHit = 0;
let score = 0;
let kills = 0;

function playerBox(pos = player.position) {
  return new THREE.Box3(
    new THREE.Vector3(pos.x - player.radius, pos.y, pos.z - player.radius),
    new THREE.Vector3(pos.x + player.radius, pos.y + player.height, pos.z + player.radius)
  );
}

function resolveAxis(axis, delta) {
  player.position[axis] += delta;
  const box = playerBox();
  for (const c of colliders) {
    if (!box.intersectsBox(c.box)) continue;
    if (delta > 0) {
      player.position[axis] -= box.max[axis] - c.box.min[axis];
    } else if (delta < 0) {
      player.position[axis] += c.box.max[axis] - box.min[axis];
    }
    if (axis === "y") {
      if (delta < 0) {
        player.onGround = true;
        player.velocity.y = c.pad ? PAD_SPEED : 0;
        if (c.pad) addLog("ジャンプパッド！", true);
      } else {
        player.velocity.y = 0;
      }
    } else {
      player.velocity[axis] = 0;
    }
    box.copy(playerBox());
  }
}

function updatePlayer(dt) {
  const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));

  const wish = new THREE.Vector3();
  if (keys.has("KeyW")) wish.add(forward);
  if (keys.has("KeyS")) wish.sub(forward);
  if (keys.has("KeyD")) wish.add(right);
  if (keys.has("KeyA")) wish.sub(right);
  if (wish.lengthSq() > 0) wish.normalize();

  const accel = player.onGround ? 1 : AIR_CONTROL;
  const target = wish.multiplyScalar(MOVE_SPEED);
  const damp = player.onGround ? 16 : 4;
  player.velocity.x += (target.x - player.velocity.x) * Math.min(1, damp * accel * dt);
  player.velocity.z += (target.z - player.velocity.z) * Math.min(1, damp * accel * dt);

  player.velocity.y -= GRAVITY * dt;
  if (player.velocity.y < -55) player.velocity.y = -55;

  player.onGround = false;
  resolveAxis("x", player.velocity.x * dt);
  resolveAxis("z", player.velocity.z * dt);
  resolveAxis("y", player.velocity.y * dt);

  if (player.position.y <= 0) {
    player.position.y = 0;
    if (player.velocity.y < 0) player.velocity.y = 0;
    player.onGround = true;
  }

  const limit = ARENA - 3;
  player.position.x = THREE.MathUtils.clamp(player.position.x, -limit, limit);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -limit, limit);

  const moving = player.onGround && wish.lengthSq() > 0;
  bobTime += dt * (moving ? 11 : 0);
  const bob = moving ? Math.sin(bobTime) * 0.045 : 0;
  const sway = moving ? Math.cos(bobTime * 0.5) * 0.03 : 0;

  camera.position.set(player.position.x, player.position.y + player.eye + bob, player.position.z);
  camera.rotation.set(player.pitch + recoilKick * 0.02, player.yaw, sway * 0.04, "YXZ");

  viewModel.position.set(0.3 + sway * 0.3, -0.26 + bob * 0.6 - recoilKick * 0.02, -0.85 + recoilKick * 0.08);
  viewModel.rotation.set(recoilKick * 0.25, 0, 0);
  recoilKick = Math.max(0, recoilKick - dt * 7);
}

function jump() {
  if (!player.onGround) return;
  player.velocity.y = JUMP_SPEED;
  player.onGround = false;
}

function blink(time) {
  if (time < player.blinkReadyAt) return;
  const dir = new THREE.Vector3();
  if (keys.has("KeyW") || keys.has("KeyA") || keys.has("KeyS") || keys.has("KeyD")) {
    const forward = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
    const right = new THREE.Vector3(Math.cos(player.yaw), 0, -Math.sin(player.yaw));
    if (keys.has("KeyW")) dir.add(forward);
    if (keys.has("KeyS")) dir.sub(forward);
    if (keys.has("KeyD")) dir.add(right);
    if (keys.has("KeyA")) dir.sub(right);
  } else {
    dir.set(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
  }
  dir.normalize();

  const start = player.position.clone();
  const step = 0.3;
  for (let travelled = step; travelled <= BLINK_DISTANCE; travelled += step) {
    const candidate = start.clone().addScaledVector(dir, travelled);
    const box = playerBox(candidate);
    let blocked = false;
    for (const c of colliders) {
      if (box.intersectsBox(c.box)) { blocked = true; break; }
    }
    if (blocked) break;
    player.position.copy(candidate);
  }

  player.blinkReadyAt = time + BLINK_COOLDOWN;
  player.velocity.y = Math.max(player.velocity.y, 1.5);
  spawnBlinkTrail(start, player.position);
  addLog("ブリンク");
}

// ------------------------------------------------------------------ effects

const tracers = [];
const tracerGeo = new THREE.CylinderGeometry(0.018, 0.018, 1, 6);

function spawnTracer(from, to, color) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
  const mesh = new THREE.Mesh(tracerGeo, mat);
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = dir.length();
  mesh.position.copy(from).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  mesh.scale.y = len;
  scene.add(mesh);
  tracers.push({ mesh, life: 0.09 });
}

function spawnBlinkTrail(from, to) {
  const mat = new THREE.MeshBasicMaterial({ color: 0x5ce1ff, transparent: true, opacity: 0.45 });
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = Math.max(0.01, dir.length());
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1, 8), mat);
  mesh.position.copy(from).addScaledVector(dir, 0.5).setY(from.y + player.eye * 0.6);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  mesh.scale.y = len;
  scene.add(mesh);
  tracers.push({ mesh, life: 0.3 });
}

const impactGeo = new THREE.SphereGeometry(0.07, 8, 6);
function spawnImpact(point, normal, color) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
  const mesh = new THREE.Mesh(impactGeo, mat);
  mesh.position.copy(point).addScaledVector(normal || new THREE.Vector3(0, 1, 0), 0.03);
  scene.add(mesh);
  tracers.push({ mesh, life: 0.35 });
}

function updateEffects(dt) {
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i];
    t.life -= dt;
    t.mesh.material.opacity = Math.max(0, t.mesh.material.opacity - dt * 3.2);
    if (t.life <= 0) {
      scene.remove(t.mesh);
      t.mesh.material.dispose();
      if (t.mesh.geometry !== tracerGeo && t.mesh.geometry !== impactGeo) t.mesh.geometry.dispose();
      tracers.splice(i, 1);
    }
  }
  muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 28);
}

let hitmarkerTimer = 0;
function flashHitmarker(crit) {
  hitmarker.classList.add("on");
  hitmarker.style.filter = crit ? "hue-rotate(35deg) brightness(1.4)" : "none";
  hitmarkerTimer = 0.12;
}

function addLog(text, crit = false) {
  const line = document.createElement("div");
  line.className = crit ? "log-line crit" : "log-line";
  line.textContent = text;
  logEl.appendChild(line);
  setTimeout(() => line.remove(), 4000);
  while (logEl.childElementCount > 5) logEl.firstElementChild.remove();
}

// ------------------------------------------------------------------ shooting

const raycaster = new THREE.Raycaster();

function shoot(time) {
  const w = currentWeapon();
  if (reloading || time < nextShotAt) return;
  const state = ammoState[weaponIndex];
  if (state.mag <= 0) {
    startReload(time);
    return;
  }

  state.mag -= 1;
  shotsFired += 1;
  nextShotAt = time + 60 / w.rpm;
  recoilKick = Math.min(1.2, recoilKick + w.recoil * 0.12);
  muzzleLight.intensity = 5;

  const origin = camera.getWorldPosition(new THREE.Vector3());
  const baseDir = camera.getWorldDirection(new THREE.Vector3());
  const targets = [...solidMeshes, ...dummyParts];

  for (let p = 0; p < w.pellets; p++) {
    const dir = baseDir.clone();
    dir.x += (Math.random() - 0.5) * w.spread * 2;
    dir.y += (Math.random() - 0.5) * w.spread * 2;
    dir.z += (Math.random() - 0.5) * w.spread * 2;
    dir.normalize();

    raycaster.set(origin, dir);
    raycaster.far = w.range;
    const hits = raycaster.intersectObjects(targets, false);
    const hit = hits.find((h) => !h.object.userData.dummy || h.object.userData.dummy.alive);
    const end = hit ? hit.point : origin.clone().addScaledVector(dir, w.range);

    spawnTracer(origin.clone().addScaledVector(dir, 0.6), end, w.color);
    if (!hit) continue;

    const data = hit.object.userData;
    if (data && data.dummy && data.dummy.alive) {
      applyDamage(data.dummy, data.part, w, time);
      spawnImpact(hit.point, hit.face ? hit.face.normal : null, data.part === "head" ? 0xffd257 : 0xff6a5a);
    } else {
      spawnImpact(hit.point, hit.face ? hit.face.normal : null, 0xcfd8e3);
    }
  }

  if (state.mag === 0) startReload(time);
  updateHud();
}

function applyDamage(dummy, part, weapon, time) {
  const crit = part === "head";
  const damage = Math.round(weapon.damage * (crit ? weapon.headMult : 1));
  dummy.hp -= damage;
  shotsHit += 1;
  score += damage;
  flashHitmarker(crit);

  const mat = part === "head" ? dummy.head.material : dummy.body.material;
  mat.emissive = new THREE.Color(crit ? 0xffcc44 : 0xff3322);
  mat.emissiveIntensity = 1;
  setTimeout(() => { mat.emissiveIntensity = 0; }, 90);

  if (dummy.hp <= 0) {
    kills += 1;
    score += crit ? 150 : 100;
    addLog(crit ? "ヘッドショット撃破！ +150" : "ダミー撃破 +100", crit);
    killDummy(dummy, time);
  } else if (crit) {
    addLog(`ヘッドショット ${damage}`, true);
  }
  updateHud();
}

function startReload(time) {
  const w = currentWeapon();
  const state = ammoState[weaponIndex];
  if (reloading || state.mag === w.magSize || state.reserve <= 0) return;
  reloading = true;
  reloadDoneAt = time + w.reload;
  addLog("リロード中…");
}

function finishReload() {
  const w = currentWeapon();
  const state = ammoState[weaponIndex];
  const need = Math.min(w.magSize - state.mag, state.reserve);
  state.mag += need;
  state.reserve -= need;
  reloading = false;
  updateHud();
}

function switchWeapon(index, time) {
  if (index === weaponIndex) return;
  weaponIndex = (index + WEAPONS.length) % WEAPONS.length;
  reloading = false;
  nextShotAt = time + 0.35;
  buildViewModel();
  addLog(`${currentWeapon().name} に切替`);
  updateHud();
}

// ------------------------------------------------------------------ hud

function updateHud() {
  const w = currentWeapon();
  const state = ammoState[weaponIndex];
  scoreEl.textContent = score;
  killsEl.textContent = kills;
  accuracyEl.textContent = shotsFired ? `${Math.round((shotsHit / shotsFired) * 100)}%` : "-";
  weaponNameEl.textContent = w.name;
  magAmmoEl.textContent = state.mag;
  reserveAmmoEl.textContent = state.reserve;
  ammoEl.classList.toggle("empty", state.mag === 0);
  [...wheelEl.children].forEach((el, i) => el.classList.toggle("active", i === weaponIndex));
}

function updateBlinkHud(time) {
  const remain = Math.max(0, player.blinkReadyAt - time);
  const ratio = 1 - remain / BLINK_COOLDOWN;
  blinkFill.style.width = `${Math.min(1, ratio) * 100}%`;
  if (remain > 0) {
    blinkText.textContent = `${remain.toFixed(1)}s`;
    blinkText.classList.add("cooling");
  } else {
    blinkText.textContent = "READY";
    blinkText.classList.remove("cooling");
  }
}

// ------------------------------------------------------------------ input

let firing = false;

document.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "Enter" || e.code === "Slash" || e.code.startsWith("Arrow")) {
    e.preventDefault();
  }
  if (e.repeat) {
    if (e.code === "Enter") firing = true;
    return;
  }
  keys.add(e.code);

  const time = clock.getElapsedTime();
  switch (e.code) {
    case "Space": jump(); break;
    case "ShiftLeft":
    case "ShiftRight": blink(time); break;
    case "Enter": firing = true; shoot(time); break;
    case "Slash": switchWeapon(weaponIndex + 1, time); break;
    case "KeyR": startReload(time); break;
    case "Digit1": switchWeapon(0, time); break;
    case "Digit2": switchWeapon(1, time); break;
    case "Digit3": switchWeapon(2, time); break;
    case "Digit4": switchWeapon(3, time); break;
    default: break;
  }
});

document.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (e.code === "Enter") firing = false;
});

canvas.addEventListener("mousedown", (e) => {
  if (!pointerLocked) return;
  if (e.button === 0) { firing = true; shoot(clock.getElapsedTime()); }
});
document.addEventListener("mouseup", (e) => { if (e.button === 0) firing = false; });

document.addEventListener("mousemove", (e) => {
  if (!pointerLocked) return;
  const sensitivity = 0.0022;
  player.yaw -= e.movementX * sensitivity;
  player.pitch -= e.movementY * sensitivity;
  const limit = Math.PI / 2 - 0.02;
  player.pitch = THREE.MathUtils.clamp(player.pitch, -limit, limit);
});

function requestLock() {
  canvas.requestPointerLock();
}

startBtn.addEventListener("click", requestLock);
canvas.addEventListener("click", () => { if (!pointerLocked) requestLock(); });

document.addEventListener("pointerlockchange", () => {
  pointerLocked = document.pointerLockElement === canvas;
  overlay.classList.toggle("hidden", pointerLocked);
  if (!pointerLocked) {
    keys.clear();
    firing = false;
  }
});

// ------------------------------------------------------------------ loop

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.getElapsedTime();

  if (pointerLocked) {
    updatePlayer(dt);
    if (firing && currentWeapon().auto) shoot(time);
    if (reloading && time >= reloadDoneAt) finishReload();
  }

  updateDummies(dt, time);
  updateEffects(dt);
  updateBlinkHud(time);

  if (hitmarkerTimer > 0) {
    hitmarkerTimer -= dt;
    if (hitmarkerTimer <= 0) hitmarker.classList.remove("on");
  }

  renderer.render(scene, camera);
}

buildViewModel();
updateHud();
resize();
animate();
