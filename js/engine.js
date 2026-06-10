/* ============================================================
   Věky Války – herní JÁDRO (engine)
   Čistá logika bez DOM/Canvas. Funguje v prohlížeči (window.Engine)
   i v Node (module.exports) – díky tomu jde plně automaticky testovat.

   Stav je plně serializovatelný (žádné funkce uvnitř) a používá
   deterministický seedovaný RNG, takže createGame({seed}) dává
   reprodukovatelný průběh hry.
   ============================================================ */
(function (global) {
  "use strict";

  // ---------- Konstanty hřiště ----------
  const W = 960;
  const H = 380;
  const BASE_W = 74;
  const GROUND_Y = H - 54;
  const SPACING = 6;
  const BASE_MAX_HP = 2200;
  const MAX_TOWERS = 4;

  // ---------- Věky ----------
  const AGES = [
    { name: "Pravěk",       sky: "#2a2118", ground: "#5a4427", income: 3,  evolveCost: 60 },
    { name: "Antika",       sky: "#1f2a22", ground: "#4f5a33", income: 5,  evolveCost: 180 },
    { name: "Středověk",    sky: "#202430", ground: "#454b5a", income: 8,  evolveCost: 480 },
    { name: "Moderní doba", sky: "#181d26", ground: "#3a4150", income: 13, evolveCost: 1200 },
    { name: "Budoucnost",   sky: "#101826", ground: "#27324a", income: 22, evolveCost: Infinity },
  ];

  // ---------- Jednotky (3 na věk): range>60 = střelec ----------
  // kind = vizuální typ pro vykreslení (nemá vliv na herní logiku)
  const UNITS = [
    [
      { name: "Klackař",      kind: "club",   cost: 25,   hp: 70,   dmg: 11,  range: 24,  speed: 36, interval: 0.8, reward: 14,  xp: 9,   size: 18, color: "#caa46a" },
      { name: "Vrhač kamenů", kind: "sling",  cost: 55,   hp: 45,   dmg: 15,  range: 95,  speed: 30, interval: 1.1, reward: 20,  xp: 13,  size: 17, color: "#9fc46a" },
      { name: "Mamut",        kind: "beast",  cost: 130,  hp: 240,  dmg: 20,  range: 28,  speed: 22, interval: 1.0, reward: 44,  xp: 26,  size: 28, color: "#b08968" },
    ],
    [
      { name: "Legionář",     kind: "sword",  cost: 65,   hp: 150,  dmg: 24,  range: 26,  speed: 38, interval: 0.8, reward: 28,  xp: 15,  size: 19, color: "#d6c27a" },
      { name: "Lučištník",    kind: "bow",    cost: 110,  hp: 90,   dmg: 30,  range: 115, speed: 32, interval: 1.0, reward: 38,  xp: 21,  size: 18, color: "#86c97a" },
      { name: "Bojový slon",  kind: "beast",  cost: 240,  hp: 460,  dmg: 44,  range: 30,  speed: 24, interval: 1.0, reward: 78,  xp: 42,  size: 30, color: "#9aa0a8" },
    ],
    [
      { name: "Rytíř",        kind: "sword",  cost: 150,  hp: 320,  dmg: 48,  range: 28,  speed: 40, interval: 0.8, reward: 55,  xp: 26,  size: 20, color: "#c9ced8" },
      { name: "Kušostřelec",  kind: "bow",    cost: 210,  hp: 180,  dmg: 58,  range: 125, speed: 34, interval: 0.9, reward: 70,  xp: 34,  size: 18, color: "#7ec98e" },
      { name: "Beranidlo",    kind: "ram",    cost: 440,  hp: 880,  dmg: 80,  range: 32,  speed: 22, interval: 1.1, reward: 140, xp: 68,  size: 32, color: "#8a6b4a" },
    ],
    [
      { name: "Voják",        kind: "soldier",cost: 290,  hp: 560,  dmg: 85,  range: 32,  speed: 44, interval: 0.6, reward: 100, xp: 42,  size: 19, color: "#7d8a6a" },
      { name: "Odstřelovač",  kind: "rifle",  cost: 410,  hp: 320,  dmg: 135, range: 165, speed: 36, interval: 1.2, reward: 135, xp: 56,  size: 18, color: "#6abf9a" },
      { name: "Tank",         kind: "tank",   cost: 880,  hp: 1700, dmg: 165, range: 36,  speed: 26, interval: 1.0, reward: 270, xp: 112, size: 34, color: "#6b7a5a" },
    ],
    [
      { name: "Mech",         kind: "robot",  cost: 540,  hp: 1050, dmg: 155, range: 36,  speed: 48, interval: 0.6, reward: 185, xp: 62,  size: 22, color: "#8fa3d6" },
      { name: "Laserista",    kind: "laser",  cost: 770,  hp: 620,  dmg: 245, range: 185, speed: 40, interval: 1.0, reward: 245, xp: 82,  size: 19, color: "#6ad6cf" },
      { name: "Robot Titan",  kind: "titan",  cost: 1650, hp: 3300, dmg: 330, range: 40,  speed: 28, interval: 1.0, reward: 490, xp: 165, size: 38, color: "#9c8fd6" },
    ],
  ];

  // ---------- Obranné věže (1 na věk), staví se na základnu ----------
  const TOWERS = [
    { cost: 90,  dmg: 14,  range: 150, interval: 1.0 },
    { cost: 150, dmg: 26,  range: 165, interval: 0.95 },
    { cost: 260, dmg: 48,  range: 180, interval: 0.9 },
    { cost: 450, dmg: 90,  range: 200, interval: 0.85 },
    { cost: 760, dmg: 160, range: 220, interval: 0.8 },
  ];

  // Časy (s), kdy nepřítel postoupí do dalšího věku
  const ENEMY_AGE_THRESHOLDS = [42, 115, 210, 330];

  // ---------- Deterministický RNG (mulberry32), stav v `state.rngState` ----------
  function nextRng(state) {
    let a = state.rngState | 0;
    a = (a + 0x6d2b79f5) | 0;
    state.rngState = a;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // ---------- Vytvoření nové hry ----------
  function createGame(opts) {
    opts = opts || {};
    const seed = opts.seed !== undefined ? (opts.seed >>> 0) : ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    return {
      version: 3,
      rngState: seed,
      gold: 80,
      xp: 0,
      age: 0,
      enemyGold: 0,
      enemyAge: 0,
      playerBaseHp: BASE_MAX_HP,
      enemyBaseHp: BASE_MAX_HP,
      units: [],
      towers: [],
      effects: [],
      floats: [],
      time: 0,
      enemySpawnTimer: 3,
      enemyTowerTimer: 18,
      auto: false,
      autoUnit: 0,
      autoTimer: 0,
      specialCd: 0,
      over: false,
      won: false,
      stats: { kills: 0, goldEarned: 0, unitsSent: 0, towersBuilt: 0 },
    };
  }

  // ---------- Pomocné ----------
  function towerCount(state, side) {
    let n = 0;
    for (const t of state.towers) if (t.side === side) n++;
    return n;
  }

  function towerCost(state, side) {
    const age = side === "player" ? state.age : state.enemyAge;
    return Math.round(TOWERS[age].cost * (1 + 0.7 * towerCount(state, side)));
  }

  function spawnUnit(state, side, t) {
    const x = side === "player" ? BASE_W + 12 : W - BASE_W - 12;
    state.units.push({
      side, x,
      hp: t.hp, maxHp: t.hp,
      dmg: t.dmg, range: t.range, speed: t.speed,
      interval: t.interval, cd: nextRng(state) * 0.3,
      reward: t.reward, xp: t.xp,
      size: t.size, color: t.color,
      ranged: t.range > 60,
      name: t.name, kind: t.kind,
    });
  }

  function addFloat(state, text, x, color) {
    state.floats.push({ text, x, y: GROUND_Y - 70, color, ttl: 1.0 });
  }

  // ---------- Akce ----------
  function buyUnit(state, side, i) {
    if (state.over) return false;
    const age = side === "player" ? state.age : state.enemyAge;
    const t = UNITS[age][i];
    if (!t) return false;
    const gold = side === "player" ? state.gold : state.enemyGold;
    if (gold < t.cost) return false;
    if (side === "player") state.gold -= t.cost; else state.enemyGold -= t.cost;
    spawnUnit(state, side, t);
    if (side === "player" && state.stats) state.stats.unitsSent++;
    return true;
  }

  function buyTower(state, side) {
    if (state.over) return false;
    if (towerCount(state, side) >= MAX_TOWERS) return false;
    const age = side === "player" ? state.age : state.enemyAge;
    const tmpl = TOWERS[age];
    const cost = towerCost(state, side);
    const gold = side === "player" ? state.gold : state.enemyGold;
    if (gold < cost) return false;
    if (side === "player") state.gold -= cost; else state.enemyGold -= cost;
    state.towers.push({
      side, slot: towerCount(state, side),
      dmg: tmpl.dmg, range: tmpl.range, interval: tmpl.interval, cd: 0,
    });
    if (side === "player" && state.stats) state.stats.towersBuilt++;
    return true;
  }

  function evolve(state) {
    if (state.over || state.age >= AGES.length - 1) return false;
    const cost = AGES[state.age].evolveCost;
    if (state.xp < cost) return false;
    state.xp -= cost;
    state.age++;
    if (state.autoUnit > UNITS[state.age].length - 1) state.autoUnit = 0;
    return true;
  }

  function special(state) {
    if (state.over || state.specialCd > 0) return false;
    const dmg = 150 + state.age * 160;
    for (const u of state.units) if (u.side === "enemy") u.hp -= dmg;
    state.effects.push({ type: "meteor", ttl: 0.7 });
    state.specialCd = 30;
    return true;
  }

  // ---------- AI protivníka (deterministická přes state.rngState) ----------
  function updateAI(state, dt) {
    state.enemyGold += (AGES[state.enemyAge].income + 1) * dt;

    while (state.enemyAge < ENEMY_AGE_THRESHOLDS.length &&
           state.time > ENEMY_AGE_THRESHOLDS[state.enemyAge]) {
      state.enemyAge++;
    }

    // Občas postaví věž
    state.enemyTowerTimer -= dt;
    if (state.enemyTowerTimer <= 0) {
      if (towerCount(state, "enemy") < 3 && state.enemyGold > towerCost(state, "enemy") * 1.6) {
        buyTower(state, "enemy");
      }
      state.enemyTowerTimer = 12 + nextRng(state) * 8;
    }

    // Spawn jednotek s jednoduchou strategií
    state.enemySpawnTimer -= dt;
    if (state.enemySpawnTimer <= 0) {
      const pool = UNITS[state.enemyAge];
      const affordable = pool.filter(t => t.cost <= state.enemyGold);
      if (affordable.length) {
        let playerCount = 0;
        for (const u of state.units) if (u.side === "player") playerCount++;
        const tank = pool[2];

        // Šetří na tanka, když si ho skoro může dovolit
        if (state.enemyGold < tank.cost && state.enemyGold > tank.cost * 0.6 && nextRng(state) < 0.35) {
          state.enemySpawnTimer = 0.8;
          return;
        }

        let t;
        if (playerCount >= 5) {
          // hráč má velkou armádu → nejodolnější dostupná jednotka
          t = affordable.reduce((a, b) => (b.hp > a.hp ? b : a));
        } else {
          t = affordable[Math.floor(nextRng(state) * affordable.length)];
        }
        state.enemyGold -= t.cost;
        spawnUnit(state, "enemy", t);
        state.enemySpawnTimer = 1.0 + nextRng(state) * 1.4;
      } else {
        state.enemySpawnTimer = 0.5;
      }
    }
  }

  // ---------- Krok jednotky ----------
  function stepUnit(state, u, dt) {
    u.cd -= dt;
    const dir = u.side === "player" ? 1 : -1;

    let target = null, targetDist = Infinity;
    for (const o of state.units) {
      if (o.side === u.side) continue;
      const ahead = (o.x - u.x) * dir;
      if (ahead < -u.size) continue;
      if (ahead < targetDist) { targetDist = ahead; target = o; }
    }

    const baseEdge = u.side === "player" ? (W - BASE_W) : BASE_W;
    const baseDist = (baseEdge - u.x) * dir;

    if (target && targetDist <= u.range) {
      if (u.cd <= 0) {
        target.hp -= u.dmg;
        u.cd = u.interval;
        if (u.ranged) state.effects.push({ type: "shot", x1: u.x, x2: target.x, side: u.side, ttl: 0.12 });
        else state.effects.push({ type: "hit", x: target.x, ttl: 0.1 });
      }
      return;
    }

    if (!target && baseDist <= u.range) {
      if (u.cd <= 0) {
        if (u.side === "player") state.enemyBaseHp -= u.dmg; else state.playerBaseHp -= u.dmg;
        u.cd = u.interval;
        state.effects.push({ type: "hit", x: baseEdge - dir * 6, ttl: 0.15 });
      }
      return;
    }

    let blocked = false;
    for (const o of state.units) {
      if (o.side !== u.side) continue;
      const ahead = (o.x - u.x) * dir;
      if (ahead > 0 && ahead < u.size + SPACING) { blocked = true; break; }
    }
    if (!blocked) u.x += dir * u.speed * dt;
  }

  // ---------- Krok věže ----------
  function stepTower(state, tw, dt) {
    tw.cd -= dt;
    if (tw.cd > 0) return;
    const fireX = tw.side === "player" ? BASE_W : W - BASE_W;
    const dir = tw.side === "player" ? 1 : -1;
    let target = null, td = Infinity;
    for (const o of state.units) {
      if (o.side === tw.side) continue;
      const d = (o.x - fireX) * dir;
      if (d < 0) continue;
      if (d <= tw.range && d < td) { td = d; target = o; }
    }
    if (target) {
      target.hp -= tw.dmg;
      tw.cd = tw.interval;
      state.effects.push({ type: "shot", x1: fireX, x2: target.x, side: tw.side, ttl: 0.12, tower: true });
    }
  }

  // ---------- Hlavní aktualizace ----------
  function update(state, dt) {
    if (state.over) return;
    state.time += dt;
    state.gold += AGES[state.age].income * dt;
    if (state.specialCd > 0) state.specialCd -= dt;

    updateAI(state, dt);

    // Automatické posílání (idle prvek)
    if (state.auto) {
      state.autoTimer -= dt;
      if (state.autoTimer <= 0) {
        buyUnit(state, "player", state.autoUnit);
        state.autoTimer = 1.2;
      }
    }

    for (const u of state.units) stepUnit(state, u, dt);
    for (const tw of state.towers) stepTower(state, tw, dt);

    for (const e of state.effects) e.ttl -= dt;
    state.effects = state.effects.filter(e => e.ttl > 0);
    for (const f of state.floats) { f.ttl -= dt; f.y -= 18 * dt; }
    state.floats = state.floats.filter(f => f.ttl > 0);

    // Odměny za padlé jednotky
    const alive = [];
    for (const u of state.units) {
      if (u.hp > 0) { alive.push(u); continue; }
      if (u.side === "enemy") {
        state.gold += u.reward;
        state.xp += u.xp;
        if (state.stats) { state.stats.kills++; state.stats.goldEarned += u.reward; }
        addFloat(state, "+" + u.reward, u.x, "#ffce54");
      } else {
        state.enemyGold += Math.round(u.reward * 0.4);
      }
    }
    state.units = alive;

    if (state.enemyBaseHp <= 0) { state.over = true; state.won = true; }
    else if (state.playerBaseHp <= 0) { state.over = true; state.won = false; }
  }

  const Engine = {
    W, H, BASE_W, GROUND_Y, SPACING, BASE_MAX_HP, MAX_TOWERS,
    AGES, UNITS, TOWERS,
    createGame, update, buyUnit, buyTower, evolve, special,
    towerCount, towerCost,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  else global.Engine = Engine;
})(typeof window !== "undefined" ? window : globalThis);
