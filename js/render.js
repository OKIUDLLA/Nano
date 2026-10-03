/* ============================================================
   Age of War – remake: RENDERER (Canvas 2D)
   Kreslí stav jádra. Nic nepočítá o hře – jen čte state a state.events.
   - Interpoluje polohy mezi ticky (40 Hz simulace → plynulých 60+ fps).
   - Nepřátelské sprity zrcadlí (sprity se kreslí vždy "doprava").
   - Vlastní částice, plovoucí texty, záblesky zásahů, třes obrazu.
   ============================================================ */
(function (global) {
  "use strict";

  const D = global.AoWData, S = global.Sprites, E = global.AoWEngine;
  const { WORLD_W, GROUND_Y, SKY_H, AGES, UNITS, TURRETS, SLOT_Y, BASE_CENTER, UNIT_DEATH_TICKS, TPS } = D;
  const H = S.H;

  function create(canvas) {
    const ctx = canvas.getContext("2d");
    const R = {
      canvas, ctx,
      zoom: 1, camX: 0, viewW: WORLD_W, viewH: SKY_H, dpr: 1,
      prev: new WeakMap(),       // objekt → {x,y} z předchozího ticku
      flash: new Map(),          // uid → zbývající čas záblesku (s)
      recoil: new Map(),         // "side:slot" → čas od výstřelu (s)
      particles: [], floats: [], beams: [], planes: [], healAura: [0, 0],
      shake: 0, shakeX: 0, shakeY: 0,
      time: 0, lastAge: [-1, -1],
      showHpBars: true, reducedMotion: false,
      off: document.createElement("canvas"),
      hoverSlot: null, placingTurret: null, sellMode: false,
      lowFx: false,
    };
    R.offCtx = R.off.getContext("2d");
    resize(R);
    return R;
  }

  // ---------- Velikost a kamera ----------
  function resize(R) {
    const rect = R.canvas.getBoundingClientRect();
    const dpr = Math.min(2, global.devicePixelRatio || 1);
    const w = Math.max(320, Math.round(rect.width)), h = Math.max(200, Math.round(rect.height));
    R.canvas.width = Math.round(w * dpr); R.canvas.height = Math.round(h * dpr);
    R.dpr = dpr; R.cssW = w; R.cssH = h;
    // svět 1000×450 se vejde celý na šířku; na úzkých displejích se dá posouvat (camX)
    R.zoom = Math.max(w / WORLD_W, h / SKY_H);
    R.viewW = w / R.zoom; R.viewH = h / R.zoom;
    clampCam(R);
  }
  function clampCam(R) {
    R.camX = Math.max(0, Math.min(WORLD_W - R.viewW, R.camX));
    R.camY = Math.max(0, SKY_H - R.viewH);
  }
  function toWorld(R, cssX, cssY) {
    return { x: cssX / R.zoom + R.camX, y: cssY / R.zoom + R.camY };
  }
  function slotAt(R, state, side, wx, wy) {
    const bx = side === 0 ? S.SLOT_X : WORLD_W - S.SLOT_X;
    for (let s = 0; s < state.sides[side].slots; s++) {
      const sy = GROUND_Y + SLOT_Y[s];
      if (Math.abs(wx - bx) < 34 && wy > sy - 40 && wy < sy + 14) return s;
    }
    return null;
  }

  // ---------- Hooky z herní smyčky ----------
  function beforeTick(R, state) {
    for (const u of state.units) R.prev.set(u, { x: u.x });
    for (const b of state.bullets) R.prev.set(b, { x: b.x, y: b.y });
    for (const fx of state.specials) if (fx.x !== undefined) R.prev.set(fx, { x: fx.x });
  }
  function onEvents(R, state, events) {
    for (const ev of events) {
      switch (ev.t) {
        case "hit": {
          R.flash.set(ev.uid, 0.09);
          const u = E.findUnit(state, ev.uid);
          const col = u && UNITS[u.id].key === "tank" || (u && (UNITS[u.id].age === 4 || UNITS[u.id].key === "warmachine")) ? "#ffd27a" : (u && UNITS[u.id].key === "dino" ? "#c43b2a" : "#d13b2a");
          burst(R, ev.x, ev.y, ev.kind === "shot" || ev.kind === "fast" ? 5 : 4, col, 1.6, 50);
          if (ev.kind === "oil") burst(R, ev.x, ev.y, 3, "#2a1d0f", 1.2, 25);
          break;
        }
        case "hitbase": burst(R, ev.x, GROUND_Y - 40 - Math.random() * 60, 6, "#a0a0a0", 2, 40); shake(R, 1.5); break;
        case "death": {
          R.flash.delete(ev.uid);
          floatText(R, "+" + ev.reward, ev.x, GROUND_Y - 60, ev.side === 1 ? "#ffd84a" : "#ff8a8a", ev.side === 1);
          burst(R, ev.x, GROUND_Y - 25, 10, "#5a3a2a", 2, 70);
          break;
        }
        case "shot": R.recoil.set(ev.side + ":" + ev.slot, 0.0001); break;
        case "impact": {
          if (ev.kind === "ground") burst(R, ev.x, ev.y, 5, "#b9a27a", 1.6, 40, -1);
          else if (ev.kind === "explosion" || ev.kind === "bomb") { burst(R, ev.x, ev.y, 18, "#ff9a3a", 3, 110, 0); burst(R, ev.x, ev.y, 12, "#4a4a4a", 4, 60, -2); shake(R, ev.kind === "bomb" ? 4 : 3); }
          else if (ev.kind === "meteors") { burst(R, ev.x, ev.y, 14, "#ff8a2a", 3, 100, 0); burst(R, ev.x, ev.y, 8, "#5a4a40", 3, 60, -2); shake(R, 3); }
          else if (ev.kind === "arrows") burst(R, ev.x, ev.y, 3, "#c9b48a", 1.2, 30);
          else if (ev.kind === "oil") burst(R, ev.x, ev.y, 2, "#2a1d0f", 1.5, 20);
          break;
        }
        case "ray": R.beams.push({ x: ev.x, t: 0 }); burst(R, ev.x, GROUND_Y - 10, 16, "#9af7ff", 2.5, 120, 0); shake(R, 2); break;
        case "special": {
          if (ev.key === "airstrike") R.planes.push({ side: ev.side, t: 0 });
          if (ev.key === "heal") R.healAura[ev.side] = 15;
          if (ev.key === "meteors" || ev.key === "arrows") shake(R, 2);
          break;
        }
        case "shake": shake(R, ev.amount * 0.6); break;
        case "evolve": R.lastAge[ev.side] = -1; burst(R, BASE_CENTER[ev.side], GROUND_Y - 100, 40, "#ffe27a", 3, 160, 0); break;
        case "build": burst(R, ev.side === 0 ? S.SLOT_X : WORLD_W - S.SLOT_X, GROUND_Y + SLOT_Y[ev.slot], 12, "#d9c6a0", 2, 60, -1); break;
        case "spawn": burst(R, ev.x, GROUND_Y - 4, 4, "#c9b48a", 1.4, 30, -1); break;
      }
    }
  }
  function shake(R, amount) { if (!R.reducedMotion) R.shake = Math.min(10, R.shake + amount); }
  function burst(R, x, y, n, color, size, speed, gravity) {
    if (R.lowFx) n = Math.ceil(n / 2);
    if (R.particles.length > 600) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8);
      R.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - speed * 0.3, g: gravity === undefined ? 320 : gravity * 60, size: size * (0.6 + Math.random() * 0.8), color, life: 0.35 + Math.random() * 0.4, t: 0 });
    }
  }
  function floatText(R, text, x, y, color, big) { R.floats.push({ text, x, y, color, t: 0, life: 1.1, big }); }

  // ---------- Hlavní kreslení ----------
  function draw(R, state, alpha, dt) {
    const ctx = R.ctx;
    R.time += dt;
    updateFx(R, dt);
    const age0 = state.sides[0].age, age1 = state.sides[1].age;
    const ageKey = AGES[age0].key;

    // kamera + třes
    ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    ctx.clearRect(0, 0, R.cssW, R.cssH);
    ctx.save();
    ctx.scale(R.zoom, R.zoom);
    ctx.translate(-R.camX + R.shakeX, -R.camY + R.shakeY);

    // pozadí (podle věku hráče – svět se vyvíjí s ním)
    S.drawBackground(ctx, ageKey, { age: age0, t: R.time, camX: R.camX, w: WORLD_W, h: SKY_H,
      layerShift: f => (R.camX - (WORLD_W - R.viewW) / 2) * (1 - f) });

    // základny
    for (const side of [0, 1]) {
      const SS = state.sides[side];
      ctx.save(); ctx.translate(BASE_CENTER[side], GROUND_Y); if (side === 1) ctx.scale(-1, 1);
      S.drawBase(ctx, AGES[SS.age].key, { age: SS.age, side, slots: SS.slots, slotY: SLOT_Y, turrets: SS.turrets.map(t => !!t),
        hp: Math.max(0, SS.baseHp / SS.baseMaxHp), t: R.time, team: S.PAL.team[side] });
      // věže
      for (let s = 0; s < SS.slots; s++) {
        const tw = SS.turrets[s];
        if (!tw) continue;
        const def = TURRETS[tw.id];
        const rec = R.recoil.get(side + ":" + s);
        const recoil = rec ? Math.max(0, 1 - rec / 0.25) : 0;
        const angle = side === 0 ? tw.angle : 180 - tw.angle;
        ctx.save(); ctx.translate(S.SLOT_X, SLOT_Y[s]);
        S.drawTurret(ctx, def.key, { angle, recoil, t: R.time, side });
        ctx.restore();
      }
      ctx.restore();
      // zvýraznění slotů při stavbě
      if (side === 0 && R.placingTurret !== null) drawSlotHighlights(R, state);
      if (side === 0 && R.sellMode) drawSellHighlights(R, state);
    }

    // jednotky: nejdřív umírající, pak živé seřazené zezadu dopředu (podle uid – starší vzadu? ne, podle x)
    const dying = [], alive = [];
    for (const u of state.units) (u.dead ? dying : alive).push(u);
    for (const u of dying) drawUnit(R, state, u, alpha);
    for (const u of alive) drawUnit(R, state, u, alpha);

    // střely
    for (const b of state.bullets) {
      const p = R.prev.get(b);
      const bx = p ? p.x + (b.x - p.x) * alpha : b.x, by = p ? p.y + (b.y - p.y) * alpha : b.y;
      S.drawProjectile(ctx, Object.assign({}, b, { x: bx, y: by }), R.time);
      if (b.kind === "sky" && b.sub === "meteors" && !R.lowFx) R.particles.push({ x: bx, y: by, vx: 0, vy: 0, g: 0, size: 3 + Math.random() * 3, color: "rgba(255,140,40,0.6)", life: 0.25, t: 0 });
    }

    // efekty specialů
    drawSpecialFx(R, state, alpha);

    // částice a texty
    for (const p of R.particles) {
      const a = 1 - p.t / p.life;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    for (const f of R.floats) {
      const a = f.t < f.life * 0.6 ? 1 : 1 - (f.t - f.life * 0.6) / (f.life * 0.4);
      ctx.globalAlpha = Math.max(0, a);
      ctx.font = (f.big ? "bold 15px" : "bold 12px") + " system-ui, sans-serif";
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    // HP základen
    for (const side of [0, 1]) drawBaseHp(R, state, side);

    ctx.restore();
    void age1;
  }

  function drawUnit(R, state, u, alpha) {
    const ctx = R.ctx, def = UNITS[u.id];
    const p = R.prev.get(u);
    const x = p ? p.x + (u.x - p.x) * alpha : u.x;
    const dying = u.dead ? u.deathT / UNIT_DEATH_TICKS : 0;
    const fade = u.dead ? Math.max(0, 1 - Math.max(0, (dying - 0.6) / 0.4)) : 1;
    const period = u.anim === "attack" ? def.period : u.anim === "shoot" ? def.shootPeriod : u.anim === "shootwalk" ? def.walkShootPeriod : 0;
    const hitAt = u.anim === "attack" ? def.hitAt : u.anim === "shoot" ? def.shootHitAt : u.anim === "shootwalk" ? def.walkShootHitAt : 0;
    const phase = period ? Math.min(1, (u.animT + alpha) / period) : 0;
    const walk = ((x + u.uid * 13) / 42) % 1;   // fáze kroku roste s uraženou vzdáleností
    const params = {
      anim: u.anim, phase, hitFrac: period ? hitAt / period : 0.5, walk: walk < 0 ? walk + 1 : walk,
      t: R.time, hp: Math.max(0, u.hp / u.maxHp), dying, side: u.side, team: S.PAL.team[u.side],
      w: u.w, h: u.h, rng: rngFor(u.uid),
    };
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(x, GROUND_Y);
    if (u.side === 1) ctx.scale(-1, 1);
    // léčivá aura
    if (!u.dead && R.healAura[u.side] > 0) {
      ctx.save(); ctx.globalAlpha = 0.35 + 0.15 * Math.sin(R.time * 6);
      ctx.fillStyle = H.radial(ctx, 0, -u.h / 2, 2, u.h * 0.8, [[0, "rgba(120,255,160,0.9)"], [1, "rgba(120,255,160,0)"]]);
      ctx.beginPath(); ctx.ellipse(0, -u.h / 2, u.w * 0.9, u.h * 0.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    S.drawUnit(ctx, def.key, params);
    ctx.restore();
    // záblesk zásahu: sprite znovu do offscreenu, přebarvit bíle
    const fl = R.flash.get(u.uid);
    if (fl > 0 && !u.dead && !R.lowFx) {
      const pad = 12, w = Math.ceil(u.w + pad * 2), h = Math.ceil(u.h * 1.25 + pad);
      const off = R.off, oc = R.offCtx;
      if (off.width !== w * 2 || off.height !== h * 2) { off.width = w * 2; off.height = h * 2; }
      oc.setTransform(2, 0, 0, 2, 0, 0); oc.clearRect(0, 0, w, h);
      oc.save(); oc.translate(w / 2, h - 2); if (u.side === 1) oc.scale(-1, 1);
      S.drawUnit(oc, def.key, params); oc.restore();
      oc.globalCompositeOperation = "source-atop"; oc.fillStyle = "rgba(255,255,255,0.85)"; oc.fillRect(0, 0, w, h);
      oc.globalCompositeOperation = "source-over";
      ctx.save(); ctx.globalAlpha = Math.min(1, fl / 0.09) * 0.9;
      ctx.drawImage(off, x - w / 2, GROUND_Y - h + 2, w, h); ctx.restore();
    }
    // HP bar (jen poškozené živé jednotky)
    if (R.showHpBars && !u.dead && u.hp < u.maxHp - 0.5) {
      const bw = Math.max(22, Math.min(60, u.w)), by = GROUND_Y - u.h - 10;
      ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(x - bw / 2 - 1, by - 1, bw + 2, 5);
      const frac = Math.max(0, u.hp / u.maxHp);
      ctx.fillStyle = frac > 0.5 ? "#5ad65a" : frac > 0.25 ? "#f2c94c" : "#e74c3c";
      ctx.fillRect(x - bw / 2, by, bw * frac, 3);
    }
  }

  // HP základen: vodorovné pruhy v horních rozích světa (nepřekrývají základny ani vysoké hrady)
  function drawBaseHp(R, state, side) {
    const ctx = R.ctx, SS = state.sides[side];
    const frac = Math.max(0, SS.baseHp / SS.baseMaxHp);
    const w = 190, h = 12, y = R.camY + 10;   // relativně k viditelnému výřezu (kamera je ukotvená ke dnu světa)
    const x = side === 0 ? R.camX + 10 : R.camX + R.viewW - 10 - w;
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = "#2a2a2a"; ctx.fillRect(x, y, w, h);
    const col = frac > 0.5 ? "#5ad65a" : frac > 0.25 ? "#f2c94c" : "#e74c3c";
    ctx.fillStyle = col;
    if (side === 0) ctx.fillRect(x, y, w * frac, h); else ctx.fillRect(x + w * (1 - frac), y, w * frac, h);
    ctx.fillStyle = S.PAL.team[side]; ctx.fillRect(side === 0 ? x - 2 : x + w - 2, y - 2, 4, h + 4);
    if (frac < 0.25 && Math.sin(R.time * 8) > 0) { ctx.strokeStyle = "#ff4a3a"; ctx.lineWidth = 2; ctx.strokeRect(x - 3, y - 3, w + 6, h + 6); }
    ctx.fillStyle = "#fff"; ctx.font = "bold 10px system-ui, sans-serif"; ctx.textAlign = side === 0 ? "left" : "right";
    ctx.lineWidth = 3; ctx.strokeStyle = "rgba(0,0,0,0.7)";
    const label = `${side === 0 ? "Tvoje základna" : "Nepřítel"} ${Math.max(0, Math.round(SS.baseHp))} / ${SS.baseMaxHp}`;
    const tx = side === 0 ? x : x + w;
    ctx.strokeText(label, tx, y + h + 12); ctx.fillText(label, tx, y + h + 12);
  }

  function drawSlotHighlights(R, state) {
    const ctx = R.ctx, SS = state.sides[0];
    for (let s = 0; s < SS.slots; s++) {
      const x = S.SLOT_X, y = GROUND_Y + SLOT_Y[s];
      const free = !SS.turrets[s];
      const pulse = 0.5 + 0.5 * Math.sin(R.time * 5);
      ctx.save(); ctx.globalAlpha = free ? 0.55 + 0.3 * pulse : 0.25;
      ctx.strokeStyle = free ? "#7cff7c" : "#ff6a6a"; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      ctx.strokeRect(x - 28, y - 36, 56, 44); ctx.setLineDash([]);
      if (free && R.hoverSlot === s) { ctx.fillStyle = "rgba(124,255,124,0.25)"; ctx.fillRect(x - 28, y - 36, 56, 44); }
      ctx.restore();
    }
  }
  function drawSellHighlights(R, state) {
    const ctx = R.ctx, SS = state.sides[0];
    for (let s = 0; s < SS.slots; s++) {
      if (!SS.turrets[s]) continue;
      const x = S.SLOT_X, y = GROUND_Y + SLOT_Y[s];
      ctx.save(); ctx.globalAlpha = R.hoverSlot === s ? 0.9 : 0.5;
      ctx.strokeStyle = "#ffcc4a"; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      ctx.strokeRect(x - 28, y - 36, 56, 44); ctx.setLineDash([]); ctx.restore();
    }
  }

  function drawSpecialFx(R, state, alpha) {
    const ctx = R.ctx;
    // letadlo náletu
    for (const fx of state.specials) {
      if (fx.key !== "airstrike") continue;
      const p = R.prev.get(fx); const x = p ? p.x + (fx.x - p.x) * alpha : fx.x;
      ctx.save(); ctx.translate(x, 200 + Math.sin(R.time * 3) * 3); if (fx.side === 1) ctx.scale(-1, 1);
      drawPlane(ctx, R.time, S.PAL.team[fx.side]);
      ctx.restore();
    }
    // paprsky
    for (const b of R.beams) {
      const a = 1 - b.t / 0.35;
      ctx.save(); ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = H.grad(ctx, b.x - 14, 0, b.x + 14, 0, [[0, "rgba(120,240,255,0)"], [0.5, "rgba(220,255,255,0.95)"], [1, "rgba(120,240,255,0)"]]);
      ctx.fillRect(b.x - 14 * (0.5 + a), -20, 28 * (0.5 + a), GROUND_Y + 20);
      ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillRect(b.x - 3, -20, 6, GROUND_Y + 20);
      ctx.restore();
    }
  }
  function drawPlane(ctx, t, team) {
    // kreslený bombardér
    ctx.save();
    H.ellipse(ctx, 0, 0, 34, 9, "#8a9aa8", "#2b2320", 1.5);
    H.poly(ctx, [[-6, -2], [-30, -22], [-20, -22], [6, -2]], "#7a8a98", "#2b2320", 1.5);
    H.poly(ctx, [[-4, 2], [-18, 16], [-8, 16], [8, 2]], "#7a8a98", "#2b2320", 1.5);
    H.poly(ctx, [[-30, -4], [-40, -18], [-34, -18], [-22, -6]], team, "#2b2320", 1.5);
    H.circle(ctx, 14, -3, 4, "#c9eaff", "#2b2320", 1);
    ctx.save(); ctx.translate(36, 0); ctx.rotate(t * 40); H.line(ctx, -8, 0, 8, 0, "#333", 2); H.line(ctx, 0, -8, 0, 8, "#333", 2); ctx.restore();
    ctx.restore();
  }

  function updateFx(R, dt) {
    for (const p of R.particles) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.y > GROUND_Y + 2) { p.y = GROUND_Y + 2; p.vy *= -0.3; p.vx *= 0.7; } }
    R.particles = R.particles.filter(p => p.t < p.life);
    for (const f of R.floats) { f.t += dt; f.y -= (28 - 20 * (f.t / f.life)) * dt; }
    R.floats = R.floats.filter(f => f.t < f.life);
    for (const b of R.beams) b.t += dt;
    R.beams = R.beams.filter(b => b.t < 0.35);
    for (const [k, v] of R.flash) { const n = v - dt; if (n <= 0) R.flash.delete(k); else R.flash.set(k, n); }
    for (const [k, v] of R.recoil) { const n = v + dt; if (n > 0.4) R.recoil.delete(k); else R.recoil.set(k, n); }
    R.healAura[0] = Math.max(0, R.healAura[0] - dt); R.healAura[1] = Math.max(0, R.healAura[1] - dt);
    if (R.shake > 0) {
      R.shake = Math.max(0, R.shake - dt * 18);
      R.shakeX = (Math.random() * 2 - 1) * R.shake; R.shakeY = (Math.random() * 2 - 1) * R.shake * 0.6;
    } else { R.shakeX = R.shakeY = 0; }
  }

  function rngFor(seed) { let a = seed * 7919 | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  // Ikona jednotky / věže do malého canvasu (pro UI karty)
  function drawIcon(canvas, kind, key, def, side) {
    const ctx = canvas.getContext("2d");
    const w = canvas.width, h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
    if (kind === "unit") {
      const sc = Math.min((w - 8) / Math.max(def.w, 30), (h - 8) / Math.max(def.h, 30));
      ctx.translate(w / 2, h - 4); ctx.scale(sc, sc);
      S.drawUnit(ctx, key, { anim: "idle", phase: 0, hitFrac: 0.5, walk: 0, t: 0.3, hp: 1, dying: 0, side: side || 0, team: S.PAL.team[side || 0], w: def.w, h: def.h, rng: rngFor(def.id + 1) });
    } else {
      const sc = Math.min((w - 8) / 52, (h - 8) / 44);
      ctx.translate(w / 2 - 2 * sc, h - 8); ctx.scale(sc, sc);
      S.drawTurret(ctx, key, { angle: -15, recoil: 0, t: 0.3, side: 0 });
    }
  }

  global.AoWRender = { create, resize, draw, beforeTick, onEvents, toWorld, slotAt, drawIcon, floatText, shake };
})(typeof window !== "undefined" ? window : globalThis);
