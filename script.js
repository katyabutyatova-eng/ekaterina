const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const scoreEl = document.getElementById("score");
const resEl = document.getElementById("resources");
const waveEl = document.getElementById("wave");
const livesEl = document.getElementById("lives");
const upgradeBtn = document.getElementById("upgrade-btn");

let ship, bullets, enemyBullets, enemies, crystals, particles, stars;
let score, resources, lives, wave, upgradeLevel;
let spawnTimer, waveTimer, running, message, best;
best = Number(localStorage.getItem("galaxyBest")) || 0;

const keys = {};
let mouseControl = false;
let mouseX = W / 2, mouseY = H - 70;

document.addEventListener("keydown", (e) => {
  // e.code не зависит от раскладки: KeyW = «ц» на русской раскладке и т.д.
  const moveCodes = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyW", "KeyA", "KeyS", "KeyD", "Space"];
  if (moveCodes.includes(e.code)) e.preventDefault();

  keys[e.code] = true;

  // нажали клавишу движения — мышью больше не управляем
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyW", "KeyA", "KeyS", "KeyD"].includes(e.code)) {
    mouseControl = false;
  }
  if (e.code === "Space" && !running) restartGame();
});
document.addEventListener("keyup", (e) => keys[e.code] = false);

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = (e.clientX - rect.left) * (W / rect.width);
  mouseY = (e.clientY - rect.top) * (H / rect.height);
  mouseControl = true;
});

// фоновые звёзды генерируем один раз
stars = Array.from({ length: 90 }, () => ({
  x: Math.random() * W,
  y: Math.random() * H,
  s: Math.random() * 2 + 0.5,
  v: Math.random() * 0.6 + 0.2
}));

function reset() {
  ship = { x: W / 2, y: H - 70, w: 42, h: 36, speed: 5.2, cd: 0 };
  bullets = [];
  enemyBullets = [];
  enemies = [];
  crystals = [];
  particles = [];
  score = 0;
  resources = 0;
  lives = 3;
  wave = 1;
  upgradeLevel = 1;
  spawnTimer = 60;
  waveTimer = 0;
  message = "";
  updateHud();
}

function upgradeCost() {
  return 60 + (upgradeLevel - 1) * 40;
}

function updateHud() {
  scoreEl.textContent = score;
  resEl.textContent = resources;
  waveEl.textContent = wave;
  livesEl.textContent = "❤️".repeat(Math.max(0, lives)) || "—";
  upgradeBtn.textContent = `Улучшить корабль (${upgradeCost()} 💎) · ур. ${upgradeLevel}`;
}

function restartGame() {
  reset();
  running = true;
}

function upgradeShip() {
  const cost = upgradeCost();
  if (!running || resources < cost) return;
  resources -= cost;
  upgradeLevel++;
  updateHud();
}

function gameOver() {
  running = false;
  if (score > best) {
    best = score;
    localStorage.setItem("galaxyBest", best);
  }
  message = `Игра окончена! Счёт: ${score} · Рекорд: ${best}`;
}

function boom(x, y, color, n = 14) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = Math.random() * 3 + 1;
    particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 30 + Math.random() * 20,
      color
    });
  }
}

function spawnEnemy() {
  const roll = Math.random();
  const x = Math.random() * (W - 60) + 30;
  if (wave >= 2 && roll < 0.2) {
    // стрелок: останавливается и ведёт огонь
    enemies.push({ type: "shooter", x, y: -30, r: 18, hp: 3, stopY: 90 + Math.random() * 80, shootCd: 60 });
  } else if (roll < 0.55) {
    // зигзаг
    enemies.push({ type: "zigzag", x, y: -30, r: 16, hp: 2, phase: Math.random() * Math.PI * 2 });
  } else {
    // рядовой
    enemies.push({ type: "grunt", x, y: -30, r: 15, hp: 1 });
  }
}

// движение корабля — работает всегда, даже на стартовом экране
function moveShip() {
  if (mouseControl) {
    ship.x += (mouseX - ship.x) * 0.25;
    ship.y += Math.max(80, Math.min(H - 30, mouseY)) !== mouseY ? 0 : (mouseY - ship.y) * 0.25;
  }
  let dx = 0, dy = 0;
  if (keys["ArrowLeft"] || keys["KeyA"]) dx -= 1;
  if (keys["ArrowRight"] || keys["KeyD"]) dx += 1;
  if (keys["ArrowUp"] || keys["KeyW"]) dy -= 1;
  if (keys["ArrowDown"] || keys["KeyS"]) dy += 1;
  ship.x += dx * ship.speed;
  ship.y += dy * ship.speed;
  ship.x = Math.max(24, Math.min(W - 24, ship.x));
  ship.y = Math.max(80, Math.min(H - 30, ship.y));
}

function update() {
  moveShip();

  // стрельба: чем выше уровень, тем чаще и мощнее
  if (keys["Space"] && ship.cd <= 0) {
    bullets.push({ x: ship.x, y: ship.y - 22, vy: -9, dmg: 1 + Math.floor(upgradeLevel / 2) });
    if (upgradeLevel >= 3) {
      bullets.push({ x: ship.x - 14, y: ship.y - 14, vy: -9, dmg: 1 + Math.floor(upgradeLevel / 2) });
      bullets.push({ x: ship.x + 14, y: ship.y - 14, vy: -9, dmg: 1 + Math.floor(upgradeLevel / 2) });
    }
    ship.cd = Math.max(6, 20 - upgradeLevel * 2);
  }
  ship.cd--;

  // волны: каждые ~15 секунд волна растёт
  waveTimer++;
  if (waveTimer > 900) {
    waveTimer = 0;
    wave++;
    updateHud();
  }

  // спавн врагов — тем чаще, чем выше волна
  spawnTimer--;
  if (spawnTimer <= 0) {
    spawnEnemy();
    spawnTimer = Math.max(20, 70 - wave * 5);
  }

  // пули игрока
  for (let i = bullets.length - 1; i >= 0; i--) {
    bullets[i].y += bullets[i].vy;
    if (bullets[i].y < -10) bullets.splice(i, 1);
  }

  // враги
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    const fallSpeed = 1.2 + wave * 0.12;

    if (e.type === "grunt") {
      e.y += fallSpeed;
    } else if (e.type === "zigzag") {
      e.y += fallSpeed * 0.9;
      e.phase += 0.06;
      e.x += Math.cos(e.phase) * 2.2;
      e.x = Math.max(20, Math.min(W - 20, e.x));
    } else {
      if (e.y < e.stopY) e.y += fallSpeed;
      e.shootCd--;
      if (e.shootCd <= 0) {
        const ang = Math.atan2(ship.y - e.y, ship.x - e.x);
        enemyBullets.push({ x: e.x, y: e.y + 12, vx: Math.cos(ang) * 3.5, vy: Math.sin(ang) * 3.5 });
        e.shootCd = Math.max(40, 110 - wave * 6);
      }
    }

    // таран корабля
    if (Math.hypot(e.x - ship.x, e.y - ship.y) < e.r + 18) {
      enemies.splice(i, 1);
      boom(e.x, e.y, "#f87171");
      lives--;
      updateHud();
      if (lives <= 0) { gameOver(); return; }
      continue;
    }

    if (e.y > H + 40) enemies.splice(i, 1);
  }

  // пули врагов
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.x += b.vx;
    b.y += b.vy;
    if (Math.hypot(b.x - ship.x, b.y - ship.y) < 16) {
      enemyBullets.splice(i, 1);
      lives--;
      updateHud();
      if (lives <= 0) { gameOver(); return; }
    } else if (b.y > H + 10 || b.y < -10 || b.x < -10 || b.x > W + 10) {
      enemyBullets.splice(i, 1);
    }
  }

  // попадания пуль игрока во врагов
  for (let i = bullets.length - 1; i >= 0; i--) {
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      if (Math.hypot(bullets[i].x - e.x, bullets[i].y - e.y) < e.r + 4) {
        e.hp -= bullets[i].dmg;
        bullets.splice(i, 1);
        if (e.hp <= 0) {
          boom(e.x, e.y, "#8b5cf6", 18);
          score += e.type === "shooter" ? 25 : e.type === "zigzag" ? 15 : 10;
          // шанс выронить кристалл
          if (Math.random() < 0.4) {
            crystals.push({ x: e.x, y: e.y, vy: 1.6, phase: Math.random() * Math.PI * 2 });
          }
          enemies.splice(j, 1);
          updateHud();
        }
        break;
      }
    }
  }

  // кристаллы
  for (let i = crystals.length - 1; i >= 0; i--) {
    const c = crystals[i];
    c.y += c.vy;
    c.phase += 0.1;
    if (Math.hypot(c.x - ship.x, c.y - ship.y) < 26) {
      crystals.splice(i, 1);
      resources += 10;
      score += 5;
      updateHud();
    } else if (c.y > H + 20) {
      crystals.splice(i, 1);
    }
  }

  // частицы
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // звёздный фон движется
  stars.forEach(s => {
    s.y += s.v;
    if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
  });
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // фон
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  stars.forEach(s => ctx.fillRect(s.x, s.y, s.s, s.s));

  // кристаллы
  crystals.forEach(c => {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(Math.sin(c.phase) * 0.4);
    ctx.fillStyle = "#34d399";
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 10);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  // пули игрока
  ctx.fillStyle = "#fbbf24";
  bullets.forEach(b => ctx.fillRect(b.x - 2, b.y - 8, 4, 12));

  // пули врагов
  ctx.fillStyle = "#f87171";
  enemyBullets.forEach(b => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
  });

  // враги
  enemies.forEach(e => {
    const colors = { grunt: "#f472b6", zigzag: "#38bdf8", shooter: "#f87171" };
    ctx.fillStyle = colors[e.type];
    ctx.beginPath();
    ctx.ellipse(e.x, e.y, e.r, e.r * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(e.x, e.y - 6, e.r * 0.45, Math.PI, 0);
    ctx.fill();
    // полоска здоровья
    if (e.hp > 1) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2, 3);
      ctx.fillStyle = "#34d399";
      ctx.fillRect(e.x - e.r, e.y - e.r - 8, e.r * 2 * (e.hp / 3), 3);
    }
  });

  // частицы
  particles.forEach(p => {
    ctx.globalAlpha = Math.max(0, p.life / 50);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  });
  ctx.globalAlpha = 1;

  // корабль
  ctx.fillStyle = "#8b5cf6";
  ctx.beginPath();
  ctx.moveTo(ship.x, ship.y - 20);
  ctx.lineTo(ship.x - 20, ship.y + 16);
  ctx.lineTo(ship.x + 20, ship.y + 16);
  ctx.closePath();
  ctx.fill();
  // сопло
  ctx.fillStyle = Math.random() < 0.5 ? "#fbbf24" : "#f97316";
  ctx.fillRect(ship.x - 4, ship.y + 16, 8, 6 + Math.random() * 6);

  // оверлей
  if (!running) {
    ctx.fillStyle = "rgba(15, 10, 35, 0.78)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#eae6f7";
    ctx.font = "bold 30px Segoe UI, Arial";
    ctx.fillText(message || "Готовы к обороне?", W / 2, H / 2 - 20);
    ctx.fillStyle = "#9d92bd";
    ctx.font = "16px Segoe UI, Arial";
    ctx.fillText("Пробел или кнопка «Начать игру» — старт", W / 2, H / 2 + 24);
  }
}

function loop() {
  // кораблём можно двигаться даже до старта — чтобы сразу было живо
  if (running) {
    update();
  } else {
    moveShip();
  }
  draw();
  requestAnimationFrame(loop);
}

reset();
running = false;
loop();
