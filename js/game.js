/* ============================================================
   Věky Války – jednoduchá idle hra ve stylu Age of War
   Čistý JavaScript + Canvas, bez závislostí.
   ============================================================ */

(() => {
  "use strict";

  // ---------- Konstanty hřiště ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;      // 960
  const H = canvas.height;     // 380
  const BASE_W = 74;           // šířka základny
  const GROUND_Y = H - 54;     // úroveň země
  const SPACING = 6;           // rozestup mezi spřátelenými jednotkami

  // ---------- Definice věků ----------
  // income = pasivní příjem zlata/s, evolveCost = cena postupu ve zkušenostech
  const AGES = [
    { name: "Pravěk",      sky: "#2a2118", ground: "#5a4427", income: 3,  evolveCost: 60 },
    { name: "Antika",      sky: "#1f2a22", ground: "#4f5a33", income: 5,  evolveCost: 180 },
    { name: "Středověk",   sky: "#202430", ground: "#454b5a", income: 8,  evolveCost: 480 },
    { name: "Moderní doba", sky: "#181d26", ground: "#3a4150", income: 13, evolveCost: 1200 },
    { name: "Budoucnost",  sky: "#101826", ground: "#27324a", income: 22, evolveCost: Infinity },
  ];

  // ---------- Definice jednotek pro každý věk ----------
  // size = vizuální velikost, range>60 znamená střelce
  const UNITS = [
    [ // Pravěk
      { name: "Klackař",       cost: 25,  hp: 70,   dmg: 11,  range: 24,  speed: 36, interval: 0.8, reward: 14,  xp: 9,   size: 18, color: "#caa46a" },
      { name: "Vrhač kamenů",  cost: 55,  hp: 45,   dmg: 15,  range: 95,  speed: 30, interval: 1.1, reward: 20,  xp: 13,  size: 17, color: "#9fc46a" },
      { name: "Mamut",         cost: 130, hp: 240,  dmg: 20,  range: 28,  speed: 22, interval: 1.0, reward: 44,  xp: 26,  size: 28, color: "#b08968" },
    ],
    [ // Antika
      { name: "Legionář",      cost: 65,  hp: 150,  dmg: 24,  range: 26,  speed: 38, interval: 0.8, reward: 28,  xp: 15,  size: 19, color: "#d6c27a" },
      { name: "Lučištník",     cost: 110, hp: 90,   dmg: 30,  range: 115, speed: 32, interval: 1.0, reward: 38,  xp: 21,  size: 18, color: "#86c97a" },
      { name: "Bojový slon",   cost: 240, hp: 460,  dmg: 44,  range: 30,  speed: 24, interval: 1.0, reward: 78,  xp: 42,  size: 30, color: "#9aa0a8" },
    ],
    [ // Středověk
      { name: "Rytíř",         cost: 150, hp: 320,  dmg: 48,  range: 28,  speed: 40, interval: 0.8, reward: 55,  xp: 26,  size: 20, color: "#c9ced8" },
      { name: "Kušostřelec",   cost: 210, hp: 180,  dmg: 58,  range: 125, speed: 34, interval: 0.9, reward: 70,  xp: 34,  size: 18, color: "#7ec98e" },
      { name: "Beranidlo",     cost: 440, hp: 880,  dmg: 80,  range: 32,  speed: 22, interval: 1.1, reward: 140, xp: 68,  size: 32, color: "#8a6b4a" },
    ],
    [ // Moderní doba
      { name: "Voják",         cost: 290, hp: 560,  dmg: 85,  range: 32,  speed: 44, interval: 0.6, reward: 100, xp: 42,  size: 19, color: "#7d8a6a" },
      { name: "Odstřelovač",   cost: 410, hp: 320,  dmg: 135, range: 165, speed: 36, interval: 1.2, reward: 135, xp: 56,  size: 18, color: "#6abf9a" },
      { name: "Tank",          cost: 880, hp: 1700, dmg: 165, range: 36,  speed: 26, interval: 1.0, reward: 270, xp: 112, size: 34, color: "#6b7a5a" },
    ],
    [ // Budoucnost
      { name: "Mech",          cost: 540, hp: 1050, dmg: 155, range: 36,  speed: 48, interval: 0.6, reward: 185, xp: 62,  size: 22, color: "#8fa3d6" },
      { name: "Laserista",     cost: 770, hp: 620,  dmg: 245, range: 185, speed: 40, interval: 1.0, reward: 245, xp: 82,  size: 19, color: "#6ad6cf" },
      { name: "Robot Titan",   cost: 1650, hp: 3300, dmg: 330, range: 40, speed: 28, interval: 1.0, reward: 490, xp: 165, size: 38, color: "#9c8fd6" },
    ],
  ];

  // Časy (v sekundách), kdy nepřítel postoupí do dalšího věku
  const ENEMY_AGE_THRESHOLDS = [42, 115, 210, 330];
  const BASE_MAX_HP = 2200;

  let game;
  let autoUnit = 0;          // index jednotky vybrané pro automat
  let last = performance.now();

  // ---------- Inicializace stavu ----------
  function freshState() {
    return {
      gold: 80,
      xp: 0,
      age: 0,
      enemyGold: 0,
      enemyAge: 0,
      playerBaseHp: BASE_MAX_HP,
      enemyBaseHp: BASE_MAX_HP,
      units: [],
      effects: [],
      time: 0,
      enemySpawnTimer: 3,
      auto: false,
      autoTimer: 0,
      specialCd: 0,
      over: false,
      won: false,
    };
  }

  // ---------- Vytvoření jednotky ----------
  function spawnUnit(side, t) {
    const x = side === "player" ? BASE_W + 12 : W - BASE_W - 12;
    game.units.push({
      side, x,
      hp: t.hp, maxHp: t.hp,
      dmg: t.dmg, range: t.range, speed: t.speed,
      interval: t.interval, cd: Math.random() * 0.3,
      reward: t.reward, xp: t.xp,
      size: t.size, color: t.color,
      ranged: t.range > 60,
    });
  }

  // ---------- Nákup / akce hráče ----------
  function tryBuyUnit(i) {
    const t = UNITS[game.age][i];
    if (!t || game.over) return false;
    if (game.gold >= t.cost) {
      game.gold -= t.cost;
      spawnUnit("player", t);
      return true;
    }
    return false;
  }

  function evolve() {
    if (game.over || game.age >= AGES.length - 1) return;
    const cost = AGES[game.age].evolveCost;
    if (game.xp >= cost) {
      game.xp -= cost;
      game.age++;
      autoUnit = 0;
      buildShop();
    }
  }

  function special() {
    if (game.over || game.specialCd > 0) return;
    const dmg = 150 + game.age * 160;
    for (const u of game.units) {
      if (u.side === "enemy") u.hp -= dmg;
    }
    game.effects.push({ type: "meteor", ttl: 0.7 });
    game.specialCd = 30;
  }

  // ---------- Umělý protivník ----------
  function updateAI(dt) {
    game.enemyGold += (AGES[game.enemyAge].income + 1) * dt;

    while (game.enemyAge < ENEMY_AGE_THRESHOLDS.length &&
           game.time > ENEMY_AGE_THRESHOLDS[game.enemyAge]) {
      game.enemyAge++;
    }

    game.enemySpawnTimer -= dt;
    if (game.enemySpawnTimer <= 0) {
      const pool = UNITS[game.enemyAge];
      const affordable = pool.filter(t => t.cost <= game.enemyGold);
      if (affordable.length) {
        const t = affordable[Math.floor(Math.random() * affordable.length)];
        game.enemyGold -= t.cost;
        spawnUnit("enemy", t);
        game.enemySpawnTimer = 1.1 + Math.random() * 1.6;
      } else {
        game.enemySpawnTimer = 0.5;
      }
    }
  }

  // ---------- Krok jedné jednotky ----------
  function stepUnit(u, dt) {
    u.cd -= dt;
    const dir = u.side === "player" ? 1 : -1;

    // Nejbližší nepřítel před jednotkou
    let target = null, targetDist = Infinity;
    for (const o of game.units) {
      if (o.side === u.side) continue;
      const ahead = (o.x - u.x) * dir;
      if (ahead < -u.size) continue;
      if (ahead < targetDist) { targetDist = ahead; target = o; }
    }

    const baseEdge = u.side === "player" ? (W - BASE_W) : BASE_W;
    const baseDist = (baseEdge - u.x) * dir;

    // Útok na jednotku v dosahu
    if (target && targetDist <= u.range) {
      if (u.cd <= 0) {
        target.hp -= u.dmg;
        u.cd = u.interval;
        addAttackEffect(u, target.x);
      }
      return;
    }

    // Útok na základnu (žádný nepřítel nestojí v cestě)
    if (!target && baseDist <= u.range) {
      if (u.cd <= 0) {
        if (u.side === "player") game.enemyBaseHp -= u.dmg;
        else game.playerBaseHp -= u.dmg;
        u.cd = u.interval;
        game.effects.push({ type: "hit", x: baseEdge - dir * 6, ttl: 0.15 });
      }
      return;
    }

    // Pohyb vpřed se zachováním rozestupu mezi spřátelenými
    let blocked = false;
    for (const o of game.units) {
      if (o.side !== u.side) continue;
      const ahead = (o.x - u.x) * dir;
      if (ahead > 0 && ahead < u.size + SPACING) { blocked = true; break; }
    }
    if (!blocked) u.x += dir * u.speed * dt;
  }

  function addAttackEffect(u, tx) {
    if (u.ranged) {
      game.effects.push({ type: "shot", x1: u.x, x2: tx, side: u.side, ttl: 0.12 });
    } else {
      game.effects.push({ type: "hit", x: tx, ttl: 0.1 });
    }
  }

  // ---------- Hlavní aktualizace ----------
  function update(dt) {
    if (game.over) return;
    game.time += dt;
    game.gold += AGES[game.age].income * dt;
    if (game.specialCd > 0) game.specialCd -= dt;

    updateAI(dt);

    // Automatické posílání jednotek (idle prvek)
    if (game.auto) {
      game.autoTimer -= dt;
      if (game.autoTimer <= 0) {
        tryBuyUnit(autoUnit);
        game.autoTimer = 1.2;
      }
    }

    for (const u of game.units) stepUnit(u, dt);

    for (const e of game.effects) e.ttl -= dt;
    game.effects = game.effects.filter(e => e.ttl > 0);

    // Odměny za padlé jednotky
    const alive = [];
    for (const u of game.units) {
      if (u.hp > 0) { alive.push(u); continue; }
      if (u.side === "enemy") { game.gold += u.reward; game.xp += u.xp; }
      else { game.enemyGold += Math.round(u.reward * 0.4); }
    }
    game.units = alive;

    if (game.enemyBaseHp <= 0) endGame(true);
    else if (game.playerBaseHp <= 0) endGame(false);
  }

  function endGame(won) {
    game.over = true;
    game.won = won;
    const overlay = document.getElementById("overlay");
    document.getElementById("overlay-title").textContent = won ? "Vítězství!" : "Porážka";
    document.getElementById("overlay-text").textContent = won
      ? "Zničil jsi nepřátelskou základnu. Dobrá práce, veliteli!"
      : "Tvoje základna padla. Zkus to znovu s lepší strategií.";
    overlay.classList.remove("hidden");
  }

  // ---------- Vykreslení ----------
  function render() {
    const age = AGES[game.age];
    // obloha
    ctx.fillStyle = age.sky;
    ctx.fillRect(0, 0, W, H);
    // země
    ctx.fillStyle = age.ground;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = "rgba(0,0,0,.15)";
    ctx.fillRect(0, GROUND_Y, W, 4);

    drawBase("player", game.playerBaseHp);
    drawBase("enemy", game.enemyBaseHp);

    // jednotky zezadu dopředu
    const sorted = [...game.units].sort((a, b) => a.x - b.x);
    for (const u of sorted) drawUnit(u);

    drawEffects();
  }

  function drawBase(side, hp) {
    const x = side === "player" ? 0 : W - BASE_W;
    const color = side === "player" ? "#33507a" : "#7a3733";
    const top = GROUND_Y - 120;
    ctx.fillStyle = color;
    ctx.fillRect(x + 6, top, BASE_W - 12, 120);
    // cimbuří
    ctx.fillStyle = side === "player" ? "#3e5f90" : "#90413c";
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x + 6 + i * ((BASE_W - 12) / 4), top - 10, (BASE_W - 12) / 4 - 3, 10);
    }
    // vlajka
    ctx.fillStyle = side === "player" ? "#6fa8ff" : "#ff7a6f";
    ctx.fillRect(x + BASE_W / 2 - 1, top - 34, 2, 24);
    ctx.fillRect(x + BASE_W / 2 + 1, top - 34, 14 * (side === "player" ? 1 : -1), 10);

    // ukazatel zdraví
    const bw = BASE_W - 14, bx = x + 7, by = top - 50;
    ctx.fillStyle = "rgba(0,0,0,.5)";
    ctx.fillRect(bx, by, bw, 7);
    ctx.fillStyle = side === "player" ? "#4a90e2" : "#e2574a";
    ctx.fillRect(bx, by, bw * Math.max(0, hp / BASE_MAX_HP), 7);
  }

  function drawUnit(u) {
    const h = u.size * 1.7;
    const w = u.size;
    const x = u.x - w / 2;
    const y = GROUND_Y - h;

    // tělo
    ctx.fillStyle = u.color;
    ctx.fillRect(x, y, w, h);
    // okraj podle strany
    ctx.fillStyle = u.side === "player" ? "rgba(74,144,226,.9)" : "rgba(226,87,74,.9)";
    ctx.fillRect(x, y, w, 4);
    ctx.fillRect(x, GROUND_Y - 4, w, 4);
    // střelci mají "hlaveň"
    if (u.ranged) {
      const dir = u.side === "player" ? 1 : -1;
      ctx.fillStyle = "#2b2f38";
      ctx.fillRect(u.x + dir * (w / 2), y + h * 0.3, dir * 8, 3);
    }

    // ukazatel zdraví
    const ratio = Math.max(0, u.hp / u.maxHp);
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(x, y - 8, w, 4);
    ctx.fillStyle = ratio > 0.5 ? "#5dd35d" : ratio > 0.25 ? "#e6c34c" : "#e2574a";
    ctx.fillRect(x, y - 8, w * ratio, 4);
  }

  function drawEffects() {
    for (const e of game.effects) {
      if (e.type === "shot") {
        ctx.strokeStyle = e.side === "player" ? "rgba(150,200,255,.8)" : "rgba(255,170,150,.8)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(e.x1, GROUND_Y - 22);
        ctx.lineTo(e.x2, GROUND_Y - 22);
        ctx.stroke();
      } else if (e.type === "hit") {
        ctx.fillStyle = "rgba(255,230,150," + (e.ttl / 0.15) + ")";
        ctx.beginPath();
        ctx.arc(e.x, GROUND_Y - 20, 6, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === "meteor") {
        ctx.fillStyle = "rgba(255,120,40," + (e.ttl / 0.7) * 0.5 + ")";
        ctx.fillRect(W / 2, 0, W / 2, H);
      }
    }
  }

  // ---------- HUD ----------
  function updateHUD() {
    document.getElementById("age-name").textContent = AGES[game.age].name;
    document.getElementById("gold").textContent = Math.floor(game.gold);
    document.getElementById("xp").textContent = Math.floor(game.xp);

    const evolveBtn = document.getElementById("evolve-btn");
    if (game.age >= AGES.length - 1) {
      evolveBtn.textContent = "Nejvyšší věk";
      evolveBtn.disabled = true;
    } else {
      const cost = AGES[game.age].evolveCost;
      evolveBtn.textContent = `Postoupit do dalšího věku (${cost} XP)`;
      evolveBtn.disabled = game.xp < cost || game.over;
    }

    const specialBtn = document.getElementById("special-btn");
    if (game.specialCd > 0) {
      specialBtn.textContent = `Meteor (${Math.ceil(game.specialCd)}s)`;
      specialBtn.disabled = true;
    } else {
      specialBtn.textContent = "Meteor";
      specialBtn.disabled = game.over;
    }

    // dostupnost karet
    const cards = document.querySelectorAll(".unit-card");
    cards.forEach((card, i) => {
      const t = UNITS[game.age][i];
      card.classList.toggle("unaffordable", !t || game.gold < t.cost);
    });
  }

  // ---------- Obchod (karty jednotek) ----------
  function buildShop() {
    const container = document.getElementById("units");
    container.innerHTML = "";
    UNITS[game.age].forEach((t, i) => {
      const card = document.createElement("div");
      card.className = "unit-card" + (i === autoUnit ? " auto-selected" : "");
      card.innerHTML = `
        <span class="star">★</span>
        <div class="name">${t.name}</div>
        <div class="cost">${t.cost} zlata</div>
        <div class="stats">
          <span>❤ <b>${t.hp}</b></span>
          <span>⚔ <b>${t.dmg}</b></span>
          <span>${t.range > 60 ? "🏹 střelec" : "🛡 boj zblízka"}</span>
        </div>`;
      card.addEventListener("click", () => tryBuyUnit(i));
      card.querySelector(".star").addEventListener("click", (ev) => {
        ev.stopPropagation();
        autoUnit = i;
        buildShop();
      });
      container.appendChild(card);
    });
  }

  // ---------- Smyčka ----------
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05; // ochrana proti velkým skokům
    update(dt);
    render();
    updateHUD();
    requestAnimationFrame(frame);
  }

  // ---------- Ovládání ----------
  function init() {
    game = freshState();
    autoUnit = 0;
    buildShop();
    document.getElementById("overlay").classList.add("hidden");
  }

  document.getElementById("evolve-btn").addEventListener("click", evolve);
  document.getElementById("special-btn").addEventListener("click", special);
  document.getElementById("auto-check").addEventListener("change", (e) => {
    game.auto = e.target.checked;
  });
  document.getElementById("restart-btn").addEventListener("click", () => {
    init();
    document.getElementById("auto-check").checked = false;
  });

  init();
  requestAnimationFrame(frame);
})();
