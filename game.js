(() => {
    'use strict';

    // ===== Canvas & 基本設定 =====
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    const overlay = document.getElementById('overlay');
    const overlayTitle = document.getElementById('overlay-title');
    const overlayMessage = document.getElementById('overlay-message');
    const overlayContent = overlay.querySelector('.overlay-content');
    const timeEl = document.getElementById('time');
    const bestEl = document.getElementById('best');
    const deathsEl = document.getElementById('deaths');

    // ===== 定数 =====
    const GRAVITY = 0.6;
    const MOVE_SPEED = 4.2;
    const CROUCH_SPEED = 2.0;
    const JUMP_POWER = 12.5;
    const MAX_FALL = 16;
    const FRICTION = 0.82;
    const LEVEL_WIDTH = 6400;
    const GROUND_Y = 460;

    // ===== 入力 =====
    const keys = {};
    window.addEventListener('keydown', (e) => {
        keys[e.code] = true;
        if (['KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space'].includes(e.code)) e.preventDefault();
        if (e.code === 'KeyR') restart();
        if (e.code === 'Space' && state.phase !== 'playing') startGame();
    });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });
    canvas.addEventListener('click', () => { if (state.phase !== 'playing') startGame(); });

    document.getElementById('restart-btn').addEventListener('click', restart);
    document.getElementById('reset-best-btn').addEventListener('click', () => {
        localStorage.removeItem('bestTime');
        updateBestDisplay();
    });

    // ===== レベル定義 =====
    // プラットフォーム: {x, y, w, h}
    // ハザード (トゲ): {x, y, w, h}
    // 低い天井 (しゃがみ必須): プラットフォームとして上方に配置
    const platforms = [
        // 地面セグメント
        { x: 0, y: GROUND_Y, w: 700, h: 80 },
        { x: 800, y: GROUND_Y, w: 500, h: 80 },
        { x: 1400, y: GROUND_Y, w: 300, h: 80 },
        { x: 1800, y: GROUND_Y, w: 400, h: 80 },
        { x: 2300, y: GROUND_Y, w: 600, h: 80 },
        { x: 3000, y: GROUND_Y, w: 900, h: 80 },
        { x: 4000, y: GROUND_Y, w: 500, h: 80 },
        { x: 4600, y: GROUND_Y, w: 400, h: 80 },
        { x: 5100, y: GROUND_Y, w: 1300, h: 80 },

        // 浮遊プラットフォーム
        { x: 500, y: 340, w: 160, h: 20 },
        { x: 720, y: 260, w: 120, h: 20 },
        { x: 1500, y: 340, w: 150, h: 20 },
        { x: 2000, y: 320, w: 160, h: 20 },
        { x: 2500, y: 280, w: 140, h: 20 },
        { x: 3200, y: 340, w: 140, h: 20 },
        { x: 3450, y: 270, w: 130, h: 20 },
        { x: 3700, y: 200, w: 130, h: 20 },
        { x: 4200, y: 340, w: 150, h: 20 },
        { x: 4700, y: 280, w: 150, h: 20 },
        { x: 5300, y: 340, w: 150, h: 20 },
        { x: 5550, y: 260, w: 150, h: 20 },

        // 低い天井 (しゃがみ必須セクション)
        { x: 2300, y: 415, w: 600, h: 20 },   // 3000手前の頭上
        { x: 4000, y: 415, w: 500, h: 20 },   // 4500手前の頭上
    ];

    const hazards = [
        // トゲ
        { x: 1300, y: GROUND_Y - 20, w: 100, h: 20 },
        { x: 1700, y: GROUND_Y - 20, w: 100, h: 20 },
        { x: 2200, y: GROUND_Y - 20, w: 100, h: 20 },
        { x: 2900, y: GROUND_Y - 20, w: 100, h: 20 },
        { x: 3900, y: GROUND_Y - 20, w: 100, h: 20 },
        { x: 4500, y: GROUND_Y - 20, w: 100, h: 20 },
        // 浮遊トゲ
        { x: 2700, y: GROUND_Y - 20, w: 80, h: 20 },
    ];

    // ゴール
    const goal = { x: 6200, y: GROUND_Y - 80, w: 20, h: 80 };

    // スタート地点
    const startPos = { x: 60, y: 300 };

    // ===== プレイヤー =====
    const PLAYER_W = 28;
    const PLAYER_H = 44;
    const PLAYER_CROUCH_H = 24;

    const player = {
        x: 0, y: 0,
        w: PLAYER_W, h: PLAYER_H,
        vx: 0, vy: 0,
        onGround: false,
        crouching: false,
        facing: 1,
    };

    // ===== ゲーム状態 =====
    const state = {
        phase: 'title',       // 'title' | 'playing' | 'clear' | 'dead'
        startTime: 0,
        elapsed: 0,
        finishTime: 0,
        camera: 0,
        deaths: 0,
    };

    function resetPlayer() {
        player.x = startPos.x;
        player.y = startPos.y;
        player.vx = 0;
        player.vy = 0;
        player.onGround = false;
        player.crouching = false;
        player.facing = 1;
        state.camera = 0;
    }

    function startGame() {
        if (state.phase === 'playing') return;
        resetPlayer();
        state.phase = 'playing';
        state.startTime = performance.now();
        state.elapsed = 0;
        overlay.classList.add('hidden');
        overlayContent.classList.remove('clear', 'dead');
    }

    function restart() {
        state.phase = 'title';
        state.elapsed = 0;
        resetPlayer();
        showOverlay('START', 'スペースキーまたはクリックでスタート');
    }

    function die() {
        if (state.phase !== 'playing') return;
        state.phase = 'dead';
        state.deaths++;
        deathsEl.textContent = state.deaths;
        overlayContent.classList.add('dead');
        showOverlay('MISS!', 'スペースキーでリトライ (R でリセット)');
    }

    function clearLevel() {
        if (state.phase !== 'playing') return;
        state.phase = 'clear';
        state.finishTime = state.elapsed;
        const best = getBestTime();
        let msg = `クリアタイム: ${formatTime(state.finishTime)}`;
        if (best === null || state.finishTime < best) {
            setBestTime(state.finishTime);
            msg += ' 🎉 NEW RECORD!';
        }
        msg += '\nスペースキーで再挑戦 (R でタイトルへ)';
        overlayContent.classList.add('clear');
        showOverlay('CLEAR!', msg);
        updateBestDisplay();
    }

    function showOverlay(title, message) {
        overlayTitle.textContent = title;
        overlayMessage.innerText = message;
        overlay.classList.remove('hidden');
    }

    // ===== ベストタイム =====
    function getBestTime() {
        const v = localStorage.getItem('bestTime');
        return v === null ? null : Number(v);
    }
    function setBestTime(t) {
        localStorage.setItem('bestTime', String(t));
    }
    function updateBestDisplay() {
        const best = getBestTime();
        bestEl.textContent = best === null ? '--:--.---' : formatTime(best);
    }
    function formatTime(ms) {
        const total = Math.floor(ms);
        const m = Math.floor(total / 60000);
        const s = Math.floor((total % 60000) / 1000);
        const msR = total % 1000;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(msR).padStart(3, '0')}`;
    }

    // ===== 衝突判定 =====
    function aabb(a, b) {
        return a.x < b.x + b.w && a.x + a.w > b.x &&
               a.y < b.y + b.h && a.y + a.h > b.y;
    }

    // ===== 更新 =====
    function update(dt) {
        if (state.phase !== 'playing') return;

        // タイマー
        state.elapsed = performance.now() - state.startTime;

        // 入力処理
        const wantCrouch = !!keys['KeyS'] && player.onGround;

        // しゃがみトグル: 上方に頭上スペースが無ければ立ち上がれない
        if (wantCrouch && !player.crouching) {
            player.crouching = true;
            const diff = PLAYER_H - PLAYER_CROUCH_H;
            player.y += diff;
            player.h = PLAYER_CROUCH_H;
        } else if (!wantCrouch && player.crouching) {
            // 上部に障害がないか判定
            const testRect = { x: player.x, y: player.y - (PLAYER_H - PLAYER_CROUCH_H), w: player.w, h: PLAYER_H };
            let blocked = false;
            for (const p of platforms) {
                if (aabb(testRect, p)) { blocked = true; break; }
            }
            if (!blocked) {
                player.y -= (PLAYER_H - PLAYER_CROUCH_H);
                player.h = PLAYER_H;
                player.crouching = false;
            }
        }

        const speed = player.crouching ? CROUCH_SPEED : MOVE_SPEED;

        if (keys['KeyA']) {
            player.vx = -speed;
            player.facing = -1;
        } else if (keys['KeyD']) {
            player.vx = speed;
            player.facing = 1;
        } else {
            player.vx *= FRICTION;
            if (Math.abs(player.vx) < 0.1) player.vx = 0;
        }

        if (keys['KeyW'] && player.onGround && !player.crouching) {
            player.vy = -JUMP_POWER;
            player.onGround = false;
        }

        // 重力
        player.vy += GRAVITY;
        if (player.vy > MAX_FALL) player.vy = MAX_FALL;

        // 横移動と衝突
        player.x += player.vx;
        for (const p of platforms) {
            if (aabb(player, p)) {
                if (player.vx > 0) player.x = p.x - player.w;
                else if (player.vx < 0) player.x = p.x + p.w;
                player.vx = 0;
            }
        }
        if (player.x < 0) player.x = 0;
        if (player.x + player.w > LEVEL_WIDTH) player.x = LEVEL_WIDTH - player.w;

        // 縦移動と衝突
        player.y += player.vy;
        player.onGround = false;
        for (const p of platforms) {
            if (aabb(player, p)) {
                if (player.vy > 0) {
                    player.y = p.y - player.h;
                    player.vy = 0;
                    player.onGround = true;
                } else if (player.vy < 0) {
                    player.y = p.y + p.h;
                    player.vy = 0;
                }
            }
        }

        // 奈落
        if (player.y > H + 200) { die(); return; }

        // ハザード
        for (const hz of hazards) {
            if (aabb(player, hz)) { die(); return; }
        }

        // ゴール
        if (aabb(player, goal)) { clearLevel(); return; }

        // カメラ
        const targetCam = player.x + player.w / 2 - W / 2;
        state.camera += (targetCam - state.camera) * 0.15;
        if (state.camera < 0) state.camera = 0;
        if (state.camera > LEVEL_WIDTH - W) state.camera = LEVEL_WIDTH - W;
    }

    // ===== 描画 =====
    function drawBackground() {
        // グラデーション空
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#1a2138');
        g.addColorStop(0.6, '#2a3866');
        g.addColorStop(1, '#4a5f9e');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        // 遠景の星
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        for (let i = 0; i < 60; i++) {
            const sx = (i * 173 % LEVEL_WIDTH) - state.camera * 0.2;
            const sy = (i * 97 % 200) + 20;
            const wrap = ((sx % W) + W) % W;
            ctx.fillRect(wrap, sy, 2, 2);
        }

        // 遠景の山
        ctx.fillStyle = 'rgba(40, 55, 100, 0.8)';
        for (let i = 0; i < 20; i++) {
            const mx = i * 400 - state.camera * 0.4;
            ctx.beginPath();
            ctx.moveTo(mx, 420);
            ctx.lineTo(mx + 200, 240);
            ctx.lineTo(mx + 400, 420);
            ctx.closePath();
            ctx.fill();
        }

        // 中景の山
        ctx.fillStyle = 'rgba(30, 40, 80, 0.9)';
        for (let i = 0; i < 25; i++) {
            const mx = i * 300 - state.camera * 0.6;
            ctx.beginPath();
            ctx.moveTo(mx, 460);
            ctx.lineTo(mx + 150, 310);
            ctx.lineTo(mx + 300, 460);
            ctx.closePath();
            ctx.fill();
        }
    }

    function drawPlatform(p) {
        const x = p.x - state.camera;
        if (x + p.w < 0 || x > W) return;
        // 地面 (高さが大きい) と浮遊プラットフォームで描き分け
        if (p.h > 40) {
            const grad = ctx.createLinearGradient(x, p.y, x, p.y + p.h);
            grad.addColorStop(0, '#6a8a3c');
            grad.addColorStop(0.15, '#4a6a2c');
            grad.addColorStop(1, '#2a3a1c');
            ctx.fillStyle = grad;
            ctx.fillRect(x, p.y, p.w, p.h);
            // 芝生ライン
            ctx.fillStyle = '#8abc4c';
            ctx.fillRect(x, p.y, p.w, 6);
        } else {
            ctx.fillStyle = '#6a4a2c';
            ctx.fillRect(x, p.y, p.w, p.h);
            ctx.fillStyle = '#8a6a4c';
            ctx.fillRect(x, p.y, p.w, 4);
        }
    }

    function drawHazard(hz) {
        const x = hz.x - state.camera;
        if (x + hz.w < 0 || x > W) return;
        ctx.fillStyle = '#b0b6c6';
        const spikes = Math.floor(hz.w / 10);
        for (let i = 0; i < spikes; i++) {
            const sx = x + i * 10;
            ctx.beginPath();
            ctx.moveTo(sx, hz.y + hz.h);
            ctx.lineTo(sx + 5, hz.y);
            ctx.lineTo(sx + 10, hz.y + hz.h);
            ctx.closePath();
            ctx.fill();
        }
        ctx.strokeStyle = '#6a7080';
        ctx.lineWidth = 1;
        for (let i = 0; i < spikes; i++) {
            const sx = x + i * 10;
            ctx.beginPath();
            ctx.moveTo(sx, hz.y + hz.h);
            ctx.lineTo(sx + 5, hz.y);
            ctx.lineTo(sx + 10, hz.y + hz.h);
            ctx.stroke();
        }
    }

    function drawGoal() {
        const x = goal.x - state.camera;
        // ポール
        ctx.fillStyle = '#e8ecf4';
        ctx.fillRect(x + 8, goal.y, 4, goal.h);
        // フラッグ (アニメーション)
        const t = performance.now() / 200;
        ctx.fillStyle = '#ffd86b';
        ctx.beginPath();
        ctx.moveTo(x + 12, goal.y);
        ctx.lineTo(x + 12 + 40 + Math.sin(t) * 3, goal.y + 10);
        ctx.lineTo(x + 12, goal.y + 24);
        ctx.closePath();
        ctx.fill();
        // ベース
        ctx.fillStyle = '#888';
        ctx.fillRect(x, goal.y + goal.h - 4, 20, 4);
    }

    function drawPlayer() {
        const x = player.x - state.camera;
        const y = player.y;
        const w = player.w;
        const h = player.h;

        // 影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(x + w / 2, GROUND_Y - 2, w * 0.6, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // 胴体
        const bodyGrad = ctx.createLinearGradient(x, y, x, y + h);
        bodyGrad.addColorStop(0, '#7ee0ff');
        bodyGrad.addColorStop(1, '#4a8ab8');
        ctx.fillStyle = bodyGrad;
        ctx.fillRect(x, y, w, h);

        // 縁取り
        ctx.strokeStyle = '#1a2138';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);

        // 目
        ctx.fillStyle = '#1a2138';
        const eyeY = player.crouching ? y + 8 : y + 12;
        if (player.facing === 1) {
            ctx.fillRect(x + w - 10, eyeY, 4, 4);
        } else {
            ctx.fillRect(x + 6, eyeY, 4, 4);
        }

        // 口 (しゃがみ時は変化)
        ctx.fillStyle = '#1a2138';
        if (!player.crouching) {
            ctx.fillRect(x + w / 2 - 3, y + 22, 6, 2);
        }
    }

    function drawUI() {
        // スタート地点フラッグ
        if (state.phase !== 'playing' || state.camera < 200) {
            const x = 40 - state.camera;
            ctx.fillStyle = '#e8ecf4';
            ctx.fillRect(x, GROUND_Y - 60, 3, 60);
            ctx.fillStyle = '#7ee0ff';
            ctx.fillRect(x + 3, GROUND_Y - 60, 24, 16);
            ctx.fillStyle = '#1a2138';
            ctx.font = 'bold 10px sans-serif';
            ctx.fillText('START', x + 5, GROUND_Y - 48);
        }

        // 進捗バー
        const progress = Math.min(1, Math.max(0, (player.x - startPos.x) / (goal.x - startPos.x)));
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(20, 20, W - 40, 10);
        ctx.fillStyle = '#7ee0ff';
        ctx.fillRect(20, 20, (W - 40) * progress, 10);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(20, 20, W - 40, 10);
    }

    function render() {
        drawBackground();

        // プラットフォーム
        for (const p of platforms) drawPlatform(p);

        // ハザード
        for (const hz of hazards) drawHazard(hz);

        // ゴール
        drawGoal();

        // プレイヤー
        drawPlayer();

        // UI
        drawUI();
    }

    // ===== メインループ =====
    let lastTime = 0;
    function loop(t) {
        const dt = Math.min(32, t - lastTime);
        lastTime = t;

        update(dt);
        render();

        timeEl.textContent = formatTime(state.elapsed);

        requestAnimationFrame(loop);
    }

    // ===== 初期化 =====
    resetPlayer();
    updateBestDisplay();
    showOverlay('START', 'スペースキーまたはクリックでスタート');
    requestAnimationFrame(loop);
})();
