/* ============================================================
   Age of War – remake: SIMULAČNÍ JÁDRO
   Čistá logika bez DOM. Běží v prohlížeči (window.AoWEngine) i v Node.

   - Pevný krok: 1 tick = 1/40 s (stejně jako originál na 40 fps),
     takže všechna čísla z docs/ORIGINAL.md platí beze změny.
   - Stav je prostý JSON (žádné funkce, žádné Infinity) → lze uložit.
   - Náhoda jde výhradně přes seedovaný RNG ve stavu → stejný seed
     a stejné akce = stejný průběh (testy, replay, balanc).
   - Jádro nic nekreslí; do state.events zapisuje, co se v ticku
     stalo (zásahy, výstřely, smrti…), renderer si je přečte a vymaže.
   ============================================================ */
(function (global) {
  "use strict";

  const D = (typeof module !== "undefined" && module.exports) ? require("./data.js") : global.AoWData;
  const { TPS, WORLD_W, GROUND_Y, AGES, UNITS, UNITS_BY_AGE, TURRETS, SLOT_COSTS, MAX_SLOTS, SLOT_Y, TURRET_X,
          SPECIALS, SPECIAL_COOLDOWN, BASE_HP, BASE_HALF_W, BASE_CENTER, BASE_EDGE, SPAWN_X, evolveHpBonus,
          UNIT_SPEED, START_GOLD, QUEUE_SIZE, UNIT_DEATH_TICKS, DIFFICULTIES, CLASSIC_AI } = D;

  const DEG = Math.PI / 180;

  // ---------- RNG (mulberry32) ----------
  function rng(state) {
    let a = (state.rng + 0x6d2b79f5) | 0;
    state.rng = a;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function rngInt(state, n) { return Math.floor(rng(state) * n); }

  // ---------- Vytvoření hry ----------
  function makeSide(side) {
    return {
      side, gold: START_GOLD, xp: 0, age: 0,
      baseHp: BASE_HP, baseMaxHp: BASE_HP,
      slots: 1, turrets: [null, null, null, null],
      queue: [], trainLeft: 0, trainTotal: 0,
      specialCd: 1,            // originál: special je k dispozici po 1 framu
      stats: { kills: 0, lost: 0, goldEarned: 0, goldSpent: 0, unitsTrained: 0, turretsBuilt: 0, specialsUsed: 0, dmgDealt: 0, dmgToBase: 0 },
    };
  }

  function createGame(opts) {
    opts = opts || {};
    const seed = opts.seed !== undefined ? (opts.seed >>> 0) : ((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    const diffKey = DIFFICULTIES[opts.difficulty] ? opts.difficulty : "normal";
    const state = {
      version: 1,
      seed, rng: seed, tick: 0,
      difficulty: diffKey,
      aiKind: opts.ai || "classic",
      rules: Object.assign({
        enemyMul: DIFFICULTIES[diffKey].enemyMul,  // násobek HP a dmg nepřátelských jednotek
        playerMul: 1.0,
        specialCooldown: SPECIAL_COOLDOWN,
        queueSize: QUEUE_SIZE,
        passiveIncome: 0,                            // zlato / s (originál 0)
      }, opts.rules || {}),
      over: false, winner: null,
      sides: [makeSide(0), makeSide(1)],
      units: [], bullets: [], specials: [], events: [],
      nextUid: 1,
      ai: null,
    };
    state.ai = createAI(state, state.aiKind);
    return state;
  }

  // ---------- Pomocné ----------
  function sideOf(state, side) { return state.sides[side]; }
  function dirOf(side) { return side === 0 ? 1 : -1; }
  function aliveUnits(state, side) { let n = 0; for (const u of state.units) if (!u.dead && u.side === side) n++; return n; }
  function emit(state, ev) { state.events.push(ev); }

  function spawnUnit(state, side, unitId) {
    const def = UNITS[unitId];
    const mul = side === 1 ? state.rules.enemyMul : state.rules.playerMul;
    const u = {
      uid: state.nextUid++, id: unitId, side,
      x: SPAWN_X[side] + rng(state),       // originál: _x += Math.random()
      hp: def.hp * mul, maxHp: def.hp * mul, dmgMul: mul,
      w: def.w, h: def.h,
      anim: "walk", animT: 0, hitDone: false,
      moving: true, targetUid: 0, targetBase: false,
      dead: false, deathT: 0,
    };
    state.units.push(u);
    emit(state, { t: "spawn", side, uid: u.uid, id: unitId, x: u.x });
    return u;
  }

  // ---------- Akce hráče / AI ----------
  function canTrain(state, side, unitId) {
    const S = sideOf(state, side), def = UNITS[unitId];
    if (state.over || !def || def.age !== S.age) return false;
    if (S.queue.length >= state.rules.queueSize) return false;
    return S.gold >= def.cost;
  }
  function enqueueUnit(state, side, unitId) {
    if (!canTrain(state, side, unitId)) return false;
    const S = sideOf(state, side), def = UNITS[unitId];
    S.gold -= def.cost; S.stats.goldSpent += def.cost;
    S.queue.push(unitId);
    if (S.queue.length === 1) { S.trainLeft = def.train; S.trainTotal = def.train; }
    emit(state, { t: "enqueue", side, id: unitId });
    return true;
  }
  function cancelQueued(state, side, index) {
    // rozšíření oproti originálu: odebrání čekající jednotky z fronty (ne té ve výcviku) s plnou refundací
    const S = sideOf(state, side);
    if (state.over || index <= 0 || index >= S.queue.length) return false;
    const id = S.queue.splice(index, 1)[0];
    S.gold += UNITS[id].cost; S.stats.goldSpent -= UNITS[id].cost;
    return true;
  }

  function slotCost(state, side) { const S = sideOf(state, side); return S.slots >= MAX_SLOTS ? null : SLOT_COSTS[S.slots]; }
  function buySlot(state, side) {
    const S = sideOf(state, side), cost = slotCost(state, side);
    if (state.over || cost === null || S.gold < cost) return false;
    S.gold -= cost; S.stats.goldSpent += cost; S.slots++;
    emit(state, { t: "slot", side, slots: S.slots });
    return true;
  }
  function canBuildTurret(state, side, slot, turretId) {
    const S = sideOf(state, side), def = TURRETS[turretId];
    if (state.over || !def || def.age !== S.age) return false;
    if (slot < 0 || slot >= S.slots || S.turrets[slot]) return false;
    return S.gold >= def.cost;
  }
  function buildTurret(state, side, slot, turretId) {
    if (!canBuildTurret(state, side, slot, turretId)) return false;
    const S = sideOf(state, side), def = TURRETS[turretId];
    S.gold -= def.cost; S.stats.goldSpent += def.cost; S.stats.turretsBuilt++;
    S.turrets[slot] = { id: turretId, st: 0, scanT: 0, targetUid: 0, angle: side === 0 ? 0 : 180 };
    emit(state, { t: "build", side, slot, id: turretId });
    return true;
  }
  function sellTurret(state, side, slot) {
    const S = sideOf(state, side);
    if (state.over || !S.turrets[slot]) return false;
    const def = TURRETS[S.turrets[slot].id];
    S.gold += def.sell;
    S.turrets[slot] = null;
    emit(state, { t: "sell", side, slot, id: def.id });
    return true;
  }
  function canEvolve(state, side) {
    const S = sideOf(state, side);
    return !state.over && S.age < AGES.length - 1 && S.xp >= AGES[S.age].evolveXp;
  }
  function evolve(state, side, force) {
    const S = sideOf(state, side);
    if (!force && !canEvolve(state, side)) return false;
    if (S.age >= AGES.length - 1) return false;
    S.age++;
    const bonus = evolveHpBonus(S.age);
    S.baseMaxHp += bonus; S.baseHp += bonus;
    emit(state, { t: "evolve", side, age: S.age });
    return true;
  }
  function canUseSpecial(state, side) { return !state.over && sideOf(state, side).specialCd <= 0; }
  function useSpecial(state, side) {
    if (!canUseSpecial(state, side)) return false;
    const S = sideOf(state, side), sp = SPECIALS[S.age];
    S.specialCd = state.rules.specialCooldown; S.stats.specialsUsed++;
    const fx = { key: sp.key, side, t: 0, next: 0 };
    if (sp.key === "airstrike") { fx.x = side === 0 ? -100 : WORLD_W + 100; }
    if (sp.key === "deathray") { fx.x = side === 0 ? 150 : WORLD_W - 150; fx.shots = 0; }
    state.specials.push(fx);
    emit(state, { t: "special", side, key: sp.key });
    return true;
  }

  // ---------- Jednotky ----------
  function unitDef(u) { return UNITS[u.id]; }

  function updateUnit(state, u) {
    const def = unitDef(u);
    if (u.dead) { u.deathT++; return; }
    const dir = dirOf(u.side);
    const enemySide = 1 - u.side;

    // Nejbližší jednotka před sebou (blokování) a nejbližší nepřítel (cíl) – jako v originálu,
    // základny jsou v obou seznamech.
    let blockDist = Infinity, blockHalf = 0;
    let ed = Infinity, target = null, targetBase = false;
    for (const o of state.units) {
      if (o === u || o.dead) continue;
      const dist = (o.x - u.x) * dir;
      if (dist <= 0) continue;
      if (dist < blockDist) { blockDist = dist; blockHalf = o.w / 2; }
      if (o.side !== u.side) {
        const e = dist - o.w / 2;
        if (e < ed) { ed = e; target = o; targetBase = false; }
      }
    }
    // nepřátelská základna
    {
      const dist = (BASE_CENTER[enemySide] - u.x) * dir;
      if (dist > 0) {
        if (dist < blockDist) { blockDist = dist; blockHalf = BASE_HALF_W; }
        const e = dist - BASE_HALF_W;
        if (e < ed) { ed = e; target = null; targetBase = true; }
      }
    }
    const limit = u.w / 2 + blockHalf + 2;
    const moving = blockDist > limit;

    const inMelee = ed < def.meleeRange;
    const inShoot = def.isRanged && ed < def.shootRange;

    // volba animace / režimu (viz docs/ORIGINAL.md, kap. 2)
    let anim;
    if (inMelee && !moving) anim = "attack";
    else if (inShoot) anim = moving ? "shootwalk" : "shoot";
    else anim = moving ? "walk" : "idle";

    if (anim !== u.anim) { u.anim = anim; u.animT = 0; u.hitDone = false; }
    u.moving = moving;
    u.targetUid = target ? target.uid : 0;
    u.targetBase = targetBase;

    if (moving) u.x += dir * UNIT_SPEED;

    // úder podle časování animace
    let period = 0, hitAt = 0, dmg = 0, ranged = false;
    if (anim === "attack") { period = def.period; hitAt = def.hitAt; dmg = def.melee; }
    else if (anim === "shoot") { period = def.shootPeriod; hitAt = def.shootHitAt; dmg = def.ranged; ranged = true; }
    else if (anim === "shootwalk") { period = def.walkShootPeriod; hitAt = def.walkShootHitAt; dmg = def.ranged; ranged = true; }
    if (period) {
      u.animT++;
      if (!u.hitDone && u.animT >= hitAt) {
        u.hitDone = true;
        const amount = (dmg - rng(state) * 2) * u.dmgMul;
        if (targetBase) {
          const ES = state.sides[enemySide];
          ES.baseHp -= amount;
          state.sides[u.side].stats.dmgToBase += amount;
          emit(state, { t: "hitbase", side: enemySide, x: BASE_EDGE[enemySide], ranged, from: u.uid });
        } else if (target) {
          target.hp -= amount;
          state.sides[u.side].stats.dmgDealt += amount;
          emit(state, { t: "hit", uid: target.uid, x: target.x, y: GROUND_Y - target.h / 1.5, ranged, from: u.uid, side: u.side });
        }
      }
      if (u.animT >= period) { u.animT -= period; u.hitDone = false; }
    } else {
      u.animT++;
    }
  }

  // ---------- Věže ----------
  function turretPos(side, slot) {
    return { x: side === 0 ? TURRET_X : WORLD_W - TURRET_X, y: GROUND_Y + SLOT_Y[slot] };
  }

  function updateTurret(state, side, slot, tw) {
    const def = TURRETS[tw.id];
    const pos = turretPos(side, slot);
    tw.scanT++;
    if (tw.scanT >= 10) {
      tw.scanT = 0;
      let best = null, bd = Infinity;
      for (const o of state.units) {
        if (o.dead || o.side === side) continue;
        const dx = o.x - pos.x, dy = GROUND_Y - pos.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < bd) { bd = d; best = o; }
      }
      tw.targetUid = best ? best.uid : 0; tw.targetDist = bd;
    }
    if (!tw.targetUid) return;
    const target = findUnit(state, tw.targetUid);
    if (!target || target.dead) { tw.targetUid = 0; return; }
    const dx = target.x - pos.x, dy = GROUND_Y - pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= def.range) return;
    if (!def.noAim) tw.angle = Math.atan2((GROUND_Y - target.h / 1.3) - pos.y, target.x - pos.x) / DEG;
    tw.st++;
    if (tw.st >= def.period) {
      tw.st = 0;
      fireTurret(state, side, slot, tw, def, pos, target);
    }
  }

  function fireTurret(state, side, slot, tw, def, pos, target) {
    const ang = tw.angle * DEG;
    const b = { kind: def.projectile, side, x: pos.x, y: pos.y, dmg: def.dmg, g: 0, rot: tw.angle, ttl: 400, turret: def.id };
    switch (def.projectile) {
      case "ballistic": {
        const sp = def.speed || 7, lead = def.lead || 5;
        b.vx = sp * Math.cos(ang); b.vy = sp * Math.sin(ang); b.gf = 0.05;
        b.x += b.vx * lead; b.y += b.vy * lead;
        break;
      }
      case "fast": {
        b.vx = 7 * Math.cos(ang); b.vy = 7 * Math.sin(ang); b.gf = 0.02; b.sub = 4;
        b.x += b.vx * 5; b.y += b.vy * 5;
        break;
      }
      case "rocket": case "laser": {
        // originál: střela startuje pomalu (0.2 px/podkrok) a zrychluje 1 % za podkrok, 8 podkroků/tick
        const lead = def.projectile === "rocket" ? (def.id === 12 ? 100 : 200) : 42;
        b.vx = 0.2 * Math.cos(ang); b.vy = 0.2 * Math.sin(ang); b.sub = 8; b.acc = 1.01;
        b.x += b.vx * lead; b.y += b.vy * lead;
        break;
      }
      case "oil": {
        const dir = dirOf(side);
        b.x += 116 * dir; b.y += 7; b.ttl = 40; b.dropT = 0; b.vx = 0; b.vy = 0;
        break;
      }
    }
    // střepiny / plamínky po dopadu (originál: ohnivý katapult 3×10, trhavinové dělo 3 při zásahu, 4 při dopadu na zem)
    if (def.fragments) { b.fragHit = def.fragments; b.fragGround = def.fragmentsGround || def.fragments; b.fragDmg = def.fragmentDmg; b.fragKind = def.fragmentKind || "shrapnel"; }
    state.bullets.push(b);
    emit(state, { t: "shot", side, slot, id: def.id, x: pos.x, y: pos.y, angle: tw.angle, target: target.uid });
  }

  // ---------- Střely ----------
  function findUnit(state, uid) { for (const u of state.units) if (u.uid === uid) return u; return null; }

  function hitTest(state, b) {
    // zásah = bod střely uvnitř hitzóny živé nepřátelské jednotky
    for (const o of state.units) {
      if (o.dead || o.side === b.side) continue;
      if (b.x >= o.x - o.w / 2 && b.x <= o.x + o.w / 2 && b.y >= GROUND_Y - o.h && b.y <= GROUND_Y) return o;
    }
    return null;
  }

  function damageUnit(state, o, amount, bySide, kind, x, y) {
    o.hp -= amount;
    state.sides[bySide].stats.dmgDealt += amount;
    emit(state, { t: "hit", uid: o.uid, x: x !== undefined ? x : o.x, y: y !== undefined ? y : GROUND_Y - o.h / 1.5, kind, side: bySide });
  }

  // Střepiny (30 dmg) / plamínky (10 dmg): vyletí vzhůru ±30° a zraňují až při pádu (jako part11 / part5 originálu)
  function spawnFragments(state, b, n) {
    if (!n) return;
    for (let k = 0; k < n; k++) {
      const a = (-90 + (rng(state) * 60 - 30)) * DEG;
      state.bullets.push({ kind: "shrapnel", sub: b.fragKind, side: b.side, x: b.x, y: Math.min(b.y, GROUND_Y - 1), dmg: b.fragDmg,
        vx: 7 * Math.cos(a), vy: 7 * Math.sin(a) + rng(state), g: 0, ttl: 200 });
    }
  }

  function updateBullet(state, b) {
    b.ttl--;
    if (b.ttl <= 0) return false;
    switch (b.kind) {
      case "oil": {
        b.dropT++;
        if (b.dropT >= 2) {
          b.dropT = 0;
          state.bullets.push({ kind: "drop", side: b.side, x: b.x + (rng(state) * 2 - 1), y: b.y + (rng(state) * 2 - 1), dmg: b.dmg, g: 1, ttl: 200 });
        }
        return true;
      }
      case "drop": {            // olejová kapka: padá kolmo dolů, zrychluje
        b.g += 0.2; b.y += b.g;
        const o = hitTest(state, b);
        if (o) { damageUnit(state, o, b.dmg, b.side, "oil", b.x, b.y); return false; }
        if (b.y > GROUND_Y) { emit(state, { t: "impact", kind: "oil", x: b.x, y: GROUND_Y }); return false; }
        return true;
      }
      case "shrapnel": {        // střepina / plamínek: letí nahoru, zraňuje až při pádu
        b.g += 0.2; b.x += b.vx; b.y += b.vy + b.g;
        if (b.vy + b.g > 0) {
          if (b.y > GROUND_Y) return false;
          const o = hitTest(state, b);
          if (o) { damageUnit(state, o, b.dmg, b.side, b.sub === "flame" ? "flame" : "shrapnel", b.x, b.y); return false; }
        }
        return true;
      }
      case "bomb": {            // bomba z náletu
        if (b.g < 15) b.g += 0.2;
        b.vx /= 1.02; b.x += b.vx; b.y += 1 + b.g;
        const o = hitTest(state, b);
        if (o) { damageUnit(state, o, b.dmg, b.side, "bomb", b.x, b.y); emit(state, { t: "impact", kind: "bomb", x: b.x, y: b.y }); return false; }
        if (b.y > GROUND_Y) { emit(state, { t: "impact", kind: "bomb", x: b.x, y: GROUND_Y }); return false; }
        return true;
      }
      case "sky": {             // meteor / šíp z nebe
        b.g += 0.05; b.x += b.vx; b.y += b.vy + b.g;
        const o = hitTest(state, b);
        if (o) { damageUnit(state, o, b.dmg, b.side, b.sub, b.x, b.y); emit(state, { t: "impact", kind: b.sub, x: b.x, y: b.y }); return false; }
        if (b.y > GROUND_Y) { emit(state, { t: "impact", kind: b.sub, x: b.x, y: GROUND_Y }); return false; }
        return true;
      }
      case "ballistic": {
        b.g += b.gf; b.x += b.vx; b.y += b.vy + b.g; b.rot += 2;
        const o = hitTest(state, b);
        if (o) { damageUnit(state, o, b.dmg, b.side, "shot", b.x, b.y); spawnFragments(state, b, b.fragHit); return false; }
        if (b.y > GROUND_Y) { emit(state, { t: "impact", kind: b.fragKind === "flame" ? "fire" : "ground", x: b.x, y: GROUND_Y }); spawnFragments(state, b, b.fragGround); return false; }
        return true;
      }
      case "fast": case "rocket": case "laser": {
        for (let i = 0; i < b.sub; i++) {
          if (b.acc) {
            b.x += b.vx; b.y += b.vy;
            if (Math.abs(b.vx) + Math.abs(b.vy) < 15) { b.vx *= b.acc; b.vy *= b.acc; }   // originál: zrychluje do stropu 15
          } else { b.g += b.gf; b.x += b.vx; b.y += b.vy + b.g; }
          if (b.y > GROUND_Y) { emit(state, { t: "impact", kind: b.fragHit ? "explosion" : "ground", x: b.x, y: GROUND_Y }); spawnFragments(state, b, b.fragGround); return false; }
          const o = hitTest(state, b);
          if (o) {
            damageUnit(state, o, b.dmg, b.side, b.kind, b.x, b.y);
            if (b.fragHit) emit(state, { t: "impact", kind: "explosion", x: b.x, y: b.y });
            spawnFragments(state, b, b.fragHit);
            return false;
          }
        }
        if (b.x < -200 || b.x > WORLD_W + 200 || b.y < -300) return false;
        return true;
      }
    }
    return false;
  }

  // ---------- Specialy ----------
  function updateSpecial(state, fx) {
    const sp = SPECIALS.find(s => s.key === fx.key);
    fx.t++;
    switch (fx.key) {
      case "meteors": case "arrows": {
        fx.next++;
        if (fx.next >= sp.every) {
          fx.next = 0;
          const angle = (80 + rng(state) * 20) * DEG;      // 80–100° = dolů, lehce šikmo
          const x = 200 + rng(state) * 500;
          state.bullets.push({ kind: "sky", sub: fx.key, side: fx.side, x, y: -100,
            vx: 10 * Math.cos(angle), vy: 10 * Math.sin(angle), g: 0, dmg: sp.dmg, ttl: 300,
            scale: 1.2 + rng(state) * 0.7 });
        }
        if (fx.t === 1 || fx.t % 2 === 0) emit(state, { t: "shake", amount: fx.key === "meteors" ? 5 : 2 });
        return fx.t < sp.duration;
      }
      case "heal": {
        for (const u of state.units) if (!u.dead && u.side === fx.side && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + 1);
        return fx.t < sp.duration;
      }
      case "airstrike": {
        const dir = dirOf(fx.side);
        fx.x += 4 * dir;
        fx.next++;
        const inZone = fx.side === 0 ? fx.x < 700 : fx.x > WORLD_W - 700;
        if (fx.next >= sp.every && inZone) {
          fx.next = 0;
          state.bullets.push({ kind: "bomb", side: fx.side, x: fx.x, y: 200, vx: 4 * dir, g: 0, dmg: sp.dmg, ttl: 300 });
        }
        emit(state, { t: "shake", amount: 1 });
        return fx.side === 0 ? fx.x <= WORLD_W : fx.x >= 0;
      }
      case "deathray": {
        fx.next++;
        if (fx.next >= sp.every) {
          fx.next = 0;
          const dir = dirOf(fx.side);
          const x = fx.x + 30 * dir;
          fx.x += 50 * dir; fx.shots++;
          const probe = { side: fx.side, x, y: GROUND_Y - 5 };
          const o = hitTest(state, probe);
          if (o) damageUnit(state, o, sp.dmg, fx.side, "ray", x, GROUND_Y - o.h / 2);
          emit(state, { t: "ray", x, side: fx.side });
          emit(state, { t: "shake", amount: 1 });
        }
        return fx.shots < 12;
      }
    }
    return false;
  }

  // ---------- Smrt a odměny ----------
  function processDeaths(state) {
    for (const u of state.units) {
      if (u.dead || u.hp > 0) continue;
      u.dead = true; u.deathT = 0; u.anim = "die";
      const def = unitDef(u);
      const owner = state.sides[u.side], killer = state.sides[1 - u.side];
      const reward = killer.side === 1 && state.rules.aiRewardMul ? Math.round(def.reward * state.rules.aiRewardMul) : def.reward;
      killer.gold += reward; killer.xp += def.killXp;
      killer.stats.kills++; killer.stats.goldEarned += reward;
      owner.xp += def.lossXp; owner.stats.lost++;
      if (state.ai && u.side === 1) state.ai.uof = Math.max(0, state.ai.uof - 1);
      emit(state, { t: "death", uid: u.uid, id: u.id, side: u.side, x: u.x, reward: def.reward });
    }
    let i = 0;
    while (i < state.units.length) {
      const u = state.units[i];
      if (u.dead && u.deathT >= UNIT_DEATH_TICKS) state.units.splice(i, 1); else i++;
    }
  }

  // ---------- AI nepřítele ----------
  const AI_KINDS = {};
  function createAI(state, kind) {
    const make = AI_KINDS[kind] ? AI_KINDS[kind].create : AI_KINDS.classic.create;
    const ai = make(state);
    ai.kind = AI_KINDS[kind] ? kind : "classic";
    return ai;
  }
  function updateAI(state) {
    const ai = state.ai;
    if (!ai) return;
    AI_KINDS[ai.kind].update(state, ai);
  }

  // Věrný port AI originálu: časovaná, jednotky zdarma, pevný rozvrh věží.
  AI_KINDS.classic = {
    create() {
      return { side: 1, ageT: 0, unitLevel: 1, decideT: 0, uTimer: -1, uTotal: 0, training: null, uof: 0, planIdx: 0, pending: false };
    },
    update(state, ai) {
      const S = state.sides[1];
      const C = CLASSIC_AI;
      ai.ageT++;
      if (ai.unitLevel < 3 && ai.ageT === C.unitLevelAt[ai.unitLevel]) ai.unitLevel++;
      if (ai.ageT === C.evolveEvery && S.age < AGES.length - 1) {
        evolve(state, 1, true);
        ai.unitLevel = 1; ai.ageT = 0; ai.planIdx = 0;
      }
      // rozvrh věží
      const plan = C.turretPlan[S.age];
      while (plan && ai.planIdx < plan.length && ai.ageT >= plan[ai.planIdx].at) {
        const step = plan[ai.planIdx++];
        if (step.slots && S.slots < step.slots) S.slots = step.slots;
        if (step.sell) for (const s of step.sell) if (S.turrets[s]) { S.turrets[s] = null; emit(state, { t: "sell", side: 1, slot: s }); }
        if (step.build && !S.turrets[step.build.slot] && step.build.slot < S.slots) {
          S.turrets[step.build.slot] = { id: step.build.turret, st: 0, scanT: 0, targetUid: 0, angle: 180 };
          S.stats.turretsBuilt++;
          emit(state, { t: "build", side: 1, slot: step.build.slot, id: step.build.turret });
        }
      }
      // rozhodnutí o výcviku
      ai.decideT++;
      if (ai.decideT >= C.decideEvery) {
        ai.decideT = 0;
        ai.pending = rng(state) < C.trainChance;
      }
      if (ai.pending && ai.uTimer < -5 && ai.uof < C.maxUnits) {
        const pool = UNITS_BY_AGE[S.age];
        const def = pool[rngInt(state, Math.min(ai.unitLevel, pool.length))];
        ai.training = def.id; ai.uTimer = def.train; ai.uTotal = def.train; ai.uof++;
        ai.pending = false;
        S.stats.unitsTrained++;
        emit(state, { t: "enqueue", side: 1, id: def.id });
      }
      if (ai.uTimer === 0 && ai.training !== null) { spawnUnit(state, 1, ai.training); ai.training = null; }
      ai.uTimer--;
    },
  };
  function registerAI(name, impl) { AI_KINDS[name] = impl; }

  // ---------- Hlavní krok ----------
  function tick(state) {
    if (state.over) return;
    state.events.length = 0;
    state.tick++;

    for (const S of state.sides) {
      if (S.specialCd > 0) S.specialCd--;
      if (state.rules.passiveIncome) S.gold += state.rules.passiveIncome / TPS;
      if (S.side === 1 && state.rules.aiIncome) {
        const esc = state.rules.aiEscalation;
        const mins = state.tick / TPS / 60;
        const mul = esc && mins > esc.afterMin ? 1 + (mins - esc.afterMin) * esc.perMin : 1;
        S.gold += state.rules.aiIncome[S.age] * mul / TPS;
      }
      // výcvik
      if (S.queue.length) {
        if (S.trainLeft > 0) S.trainLeft--;
        if (S.trainLeft <= 0) {
          const id = S.queue.shift();
          spawnUnit(state, S.side, id);
          S.stats.unitsTrained++;
          if (S.queue.length) { S.trainLeft = UNITS[S.queue[0]].train; S.trainTotal = S.trainLeft; }
          else { S.trainLeft = 0; S.trainTotal = 0; }
        }
      }
    }

    updateAI(state);

    for (const u of state.units) updateUnit(state, u);
    for (const S of state.sides) for (let s = 0; s < MAX_SLOTS; s++) if (S.turrets[s]) updateTurret(state, S.side, s, S.turrets[s]);

    // střely (nové střely vzniklé během průchodu se zpracují příští tick)
    const n = state.bullets.length;
    const keep = [];
    for (let i = 0; i < n; i++) if (updateBullet(state, state.bullets[i])) keep.push(state.bullets[i]);
    for (let i = n; i < state.bullets.length; i++) keep.push(state.bullets[i]);
    state.bullets = keep;

    state.specials = state.specials.filter(fx => updateSpecial(state, fx));

    processDeaths(state);

    if (state.sides[1].baseHp < 0) { state.over = true; state.winner = 0; emit(state, { t: "gameover", winner: 0 }); }
    else if (state.sides[0].baseHp < 0) { state.over = true; state.winner = 1; emit(state, { t: "gameover", winner: 1 }); }
  }

  function run(state, ticks) { for (let i = 0; i < ticks && !state.over; i++) tick(state); return state; }

  const Engine = {
    D, TPS,
    createGame, tick, run,
    enqueueUnit, canTrain, cancelQueued,
    buySlot, slotCost, buildTurret, canBuildTurret, sellTurret,
    evolve, canEvolve, useSpecial, canUseSpecial,
    aliveUnits, turretPos, findUnit, registerAI, rng,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Engine;
  else global.AoWEngine = Engine;
})(typeof window !== "undefined" ? window : globalThis);
