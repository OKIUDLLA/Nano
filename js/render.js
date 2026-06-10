/* ============================================================
   Věky Války – vykreslovací vrstva (Render)
   Veškerá grafika: parallax pozadí, animované jednotky, základny,
   efekty a částice. Čistý Canvas, bez obrázkových assetů.
   API:  Render.scene(ctx, game, dt, time)
   ============================================================ */
(function (global) {
  "use strict";

  const E = global.Engine;
  const { W, H, BASE_W, GROUND_Y, BASE_MAX_HP } = E;

  // ---------- Palety pozadí podle věku ----------
  const BACKDROPS = [
    { top: "#3b2f22", bot: "#7a5733", sun: "#ffcf9e", hillA: "#3d3220", hillB: "#2c2517", night: false },
    { top: "#2c3a2e", bot: "#69803f", sun: "#fff2c4", hillA: "#3a4a2a", hillB: "#28341c", night: false },
    { top: "#28324c", bot: "#5a6788", sun: "#e6eeff", hillA: "#3a4357", hillB: "#2a3140", night: false },
    { top: "#1d2431", bot: "#49546a", sun: "#d2dbe6", hillA: "#333c4a", hillB: "#262d38", night: false },
    { top: "#0a1124", bot: "#202b46", sun: "#7ad6ff", hillA: "#15203c", hillB: "#0d1328", night: true },
  ];

  // ---------- Pomocné ----------
  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function shade(h, amt) {
    const c = hexToRgb(h);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt)));
    return `rgb(${f(c.r)},${f(c.g)},${f(c.b)})`;
  }
  function rgba(h, a) {
    const c = hexToRgb(h);
    return `rgba(${c.r},${c.g},${c.b},${a})`;
  }
  function roundRect(ctx, x, y, w, h, r) {
    if (w < 0) { x += w; w = -w; }
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---------- Vnitřní stav vykreslování ----------
  let clouds = null;
  let stars = null;
  let hillsCache = null;
  let particles = [];
  let prevUnits = new Set();
  const lastPos = new Map(); // ref -> {x, color, size, side}

  function rnd(seed) { // malý deterministický generátor pro statické pozadí
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function initBackground() {
    const r = rnd(98765);
    clouds = [];
    for (let i = 0; i < 6; i++) {
      clouds.push({ x: r() * W, y: 20 + r() * 90, s: 0.6 + r() * 1.1, v: 4 + r() * 8 });
    }
    stars = [];
    for (let i = 0; i < 60; i++) {
      stars.push({ x: r() * W, y: r() * (GROUND_Y - 40), s: r() * 1.6 + 0.3, t: r() * 6 });
    }
    // dvě vrstvy kopců jako pole výšek
    hillsCache = [makeHills(31, 60, 18), makeHills(57, 95, 26)];
  }
  function makeHills(seed, baseY, amp) {
    const r = rnd(seed);
    const pts = [];
    const step = 40;
    for (let x = -step; x <= W + step; x += step) {
      pts.push({ x, y: GROUND_Y - baseY - r() * amp });
    }
    return pts;
  }

  // ============================================================
  //  POZADÍ
  // ============================================================
  function drawBackground(ctx, game, time) {
    const bd = BACKDROPS[game.age];

    const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    sky.addColorStop(0, bd.top);
    sky.addColorStop(1, bd.bot);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, GROUND_Y);

    // hvězdy (noční věk)
    if (bd.night) {
      for (const st of stars) {
        const tw = 0.5 + 0.5 * Math.sin(time * 2 + st.t);
        ctx.fillStyle = `rgba(255,255,255,${0.25 + tw * 0.6})`;
        ctx.fillRect(st.x, st.y, st.s, st.s);
      }
    }

    // slunce / měsíc
    const sunX = W * 0.78, sunY = 70;
    const g = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 60);
    g.addColorStop(0, rgba(bd.sun, 0.95));
    g.addColorStop(1, rgba(bd.sun, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(sunX, sunY, 60, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = bd.sun;
    ctx.beginPath(); ctx.arc(sunX, sunY, 22, 0, Math.PI * 2); ctx.fill();

    // mraky (pohyb řeší step())
    for (const c of clouds) {
      drawCloud(ctx, c.x, c.y, c.s, bd.night ? "rgba(180,200,230,0.18)" : "rgba(255,255,255,0.5)");
    }

    // kopce – dvě vrstvy
    drawHills(ctx, hillsCache[0], bd.hillB);
    drawHills(ctx, hillsCache[1], bd.hillA);

    // země
    const gr = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    gr.addColorStop(0, shade(BACKDROPS[game.age].hillA, 28));
    gr.addColorStop(1, shade(BACKDROPS[game.age].hillB, -10));
    ctx.fillStyle = gr;
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    // travnatý okraj
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.fillRect(0, GROUND_Y, W, 3);
    ctx.fillStyle = "rgba(255,255,255,.05)";
    ctx.fillRect(0, GROUND_Y + 3, W, 2);
    // textura – kamínky
    const rr = rnd(404);
    ctx.fillStyle = "rgba(0,0,0,.12)";
    for (let i = 0; i < 60; i++) {
      ctx.fillRect(rr() * W, GROUND_Y + 8 + rr() * (H - GROUND_Y - 10), 2 + rr() * 2, 2);
    }
  }
  function drawCloud(ctx, x, y, s, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x, y, 14 * s, 0, Math.PI * 2);
    ctx.arc(x + 16 * s, y + 4 * s, 11 * s, 0, Math.PI * 2);
    ctx.arc(x - 16 * s, y + 4 * s, 10 * s, 0, Math.PI * 2);
    ctx.arc(x, y + 6 * s, 16 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  function drawHills(ctx, pts, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, GROUND_Y);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.lineTo(pts[pts.length - 1].x, GROUND_Y);
    ctx.closePath();
    ctx.fill();
  }

  // ============================================================
  //  ZÁKLADNY
  // ============================================================
  function drawBase(ctx, game, side, hp, age, time) {
    const isP = side === "player";
    const x0 = isP ? 0 : W - BASE_W;
    const main = isP ? "#3a5a86" : "#86413a";
    const top = GROUND_Y - 130;
    const bw = BASE_W - 12;
    const bx = x0 + 6;
    const ratio = Math.max(0, hp / BASE_MAX_HP);

    // tělo věže s gradientem
    const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
    grad.addColorStop(0, shade(main, 18));
    grad.addColorStop(0.5, main);
    grad.addColorStop(1, shade(main, -28));
    ctx.fillStyle = grad;
    ctx.fillRect(bx, top, bw, 130);

    // cimbuří
    ctx.fillStyle = shade(main, -14);
    const merlons = 4;
    for (let i = 0; i < merlons; i++) {
      ctx.fillRect(bx + i * (bw / merlons), top - 12, bw / merlons - 3, 12);
    }
    // brána
    ctx.fillStyle = "rgba(0,0,0,.45)";
    roundRect(ctx, x0 + BASE_W / 2 - 13, GROUND_Y - 42, 26, 42, 8);
    ctx.fill();
    ctx.strokeStyle = shade(main, 26); ctx.lineWidth = 2; ctx.stroke();
    // okna (svítí)
    ctx.fillStyle = ratio > 0.25 ? "rgba(255,220,140,.85)" : "rgba(120,90,60,.5)";
    for (let r2 = 0; r2 < 2; r2++) {
      ctx.fillRect(x0 + BASE_W / 2 - 18, top + 26 + r2 * 28, 8, 12);
      ctx.fillRect(x0 + BASE_W / 2 + 10, top + 26 + r2 * 28, 8, 12);
    }

    // praskliny při poškození
    if (ratio < 0.6) {
      ctx.strokeStyle = "rgba(0,0,0,.5)"; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx + bw * 0.3, top + 10);
      ctx.lineTo(bx + bw * 0.45, top + 50);
      ctx.lineTo(bx + bw * 0.35, top + 90);
      if (ratio < 0.3) {
        ctx.moveTo(bx + bw * 0.7, top + 30);
        ctx.lineTo(bx + bw * 0.55, top + 70);
        ctx.lineTo(bx + bw * 0.7, top + 110);
      }
      ctx.stroke();
    }

    // stožár + vlající vlajka
    const poleX = x0 + BASE_W / 2;
    ctx.strokeStyle = "#cfd6e0"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(poleX, top - 12); ctx.lineTo(poleX, top - 44); ctx.stroke();
    const fdir = isP ? 1 : -1;
    const wave = Math.sin(time * 4) * 3;
    ctx.fillStyle = isP ? "#5b9bff" : "#ff6b5b";
    ctx.beginPath();
    ctx.moveTo(poleX, top - 44);
    ctx.lineTo(poleX + fdir * 20, top - 40 + wave);
    ctx.lineTo(poleX, top - 30);
    ctx.closePath();
    ctx.fill();

    // odznak věku
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Věk " + (age + 1), poleX, top + 78);

    // ukazatel zdraví
    const by = top - 64;
    ctx.fillStyle = "rgba(0,0,0,.5)";
    roundRect(ctx, bx, by, bw, 8, 4); ctx.fill();
    ctx.fillStyle = isP ? "#4a90e2" : "#e2574a";
    roundRect(ctx, bx, by, Math.max(2, bw * ratio), 8, 4); ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.2)"; ctx.lineWidth = 1;
    roundRect(ctx, bx, by, bw, 8, 4); ctx.stroke();

    // kouř při těžkém poškození
    if (ratio < 0.35) {
      const pf = (Math.sin(time * 2 + (isP ? 0 : 3)) + 1) / 2;
      ctx.fillStyle = `rgba(60,60,60,${0.15 + pf * 0.15})`;
      ctx.beginPath();
      ctx.arc(poleX + 8, top - 50 - pf * 14, 8 + pf * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ============================================================
  //  VĚŽE
  // ============================================================
  function drawTower(ctx, game, tw, time) {
    const isP = tw.side === "player";
    const x = isP ? BASE_W - 6 : W - BASE_W + 6;
    const y = GROUND_Y - 150 - tw.slot * 24;
    const col = isP ? "#4a90e2" : "#e2574a";

    // míří na nejbližšího nepřítele (jen vizuálně)
    const fireX = isP ? BASE_W : W - BASE_W;
    const dir = isP ? 1 : -1;
    let target = null, td = Infinity;
    for (const o of game.units) {
      if (o.side === tw.side) continue;
      const d = (o.x - fireX) * dir;
      if (d >= 0 && d <= tw.range && d < td) { td = d; target = o; }
    }
    let ang = 0;
    if (target) {
      ang = Math.atan2((GROUND_Y - 20) - y, (target.x - x));
    } else {
      ang = isP ? 0 : Math.PI;
    }

    // podstavec
    ctx.fillStyle = shade(col, -40);
    roundRect(ctx, x - 11, y - 2, 22, 20, 4); ctx.fill();
    ctx.fillStyle = col;
    roundRect(ctx, x - 9, y, 18, 14, 4); ctx.fill();
    // hlaveň
    ctx.save();
    ctx.translate(x, y + 6);
    ctx.rotate(ang);
    ctx.fillStyle = "#2b313c";
    roundRect(ctx, 0, -3, 18, 6, 2); ctx.fill();
    ctx.fillStyle = shade(col, 30);
    ctx.fillRect(14, -3, 4, 6);
    ctx.restore();
    // úroveň věže (tečky)
    const lvl = tw.level || 1;
    for (let i = 0; i < lvl; i++) {
      ctx.fillStyle = "#ffd86a";
      ctx.beginPath();
      ctx.arc(x - 6 + i * 6, y - 6, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // jiskra ve hlavni krátce po výstřelu
    const firing = game.effects.some(e => e.type === "shot" && e.tower && Math.abs(e.x1 - fireX) < 2);
    if (firing) {
      ctx.fillStyle = "rgba(255,230,150,.9)";
      ctx.beginPath();
      ctx.arc(x + Math.cos(ang) * 20, y + 6 + Math.sin(ang) * 20, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ============================================================
  //  JEDNOTKY
  // ============================================================
  // Zjistí, zda jednotka právě útočí (cíl/základna v dosahu) a fázi úderu 0..1
  function attackInfo(game, u) {
    const dir = u.side === "player" ? 1 : -1;
    let nearest = null, nd = Infinity;
    for (const o of game.units) {
      if (o.side === u.side) continue;
      const ahead = (o.x - u.x) * dir;
      if (ahead < -u.size) continue;
      if (ahead < nd) { nd = ahead; nearest = o; }
    }
    const baseEdge = u.side === "player" ? (W - BASE_W) : BASE_W;
    const baseDist = (baseEdge - u.x) * dir;
    const attacking = (nearest && nd <= u.range) || (!nearest && baseDist <= u.range);
    // cd jede od interval k 0; hned po úderu je atk≈1, před úderem ≈0
    const atk = attacking ? Math.max(0, Math.min(1, u.cd / (u.interval || 1))) : 0;
    return { attacking, atk };
  }

  function drawUnit(ctx, game, u, time) {
    const dir = u.side === "player" ? 1 : -1;
    const { attacking, atk } = attackInfo(game, u);
    const phase = time * 9 + u.x * 0.25;
    const walk = attacking ? Math.sin(time * 3) * 0.18 : Math.sin(phase);
    const bob = attacking ? 0 : Math.abs(Math.cos(phase)) * 2;
    const lunge = atk * 3; // výpad vpřed v okamžiku úderu

    // stín
    ctx.fillStyle = "rgba(0,0,0,.28)";
    ctx.beginPath();
    ctx.ellipse(u.x, GROUND_Y - 1, u.size * 0.6, u.size * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(u.x, GROUND_Y - bob);
    ctx.scale(dir, 1); // postavy kreslíme čelem doprava, otočíme podle strany
    ctx.translate(lunge, 0);

    if (u.kind === "beast") drawBeast(ctx, u, walk, atk);
    else if (u.kind === "ram" || u.kind === "tank") drawVehicle(ctx, u, walk, time, atk);
    else drawHumanoid(ctx, u, walk, time, atk);

    ctx.restore();

    drawUnitHealth(ctx, u);
  }

  function drawUnitHealth(ctx, u) {
    const ratio = Math.max(0, u.hp / u.maxHp);
    const w = Math.max(16, u.size * 1.2);
    const x = u.x - w / 2;
    const y = GROUND_Y - u.size * 2.0 - 8;
    ctx.fillStyle = "rgba(0,0,0,.55)";
    roundRect(ctx, x, y, w, 4, 2); ctx.fill();
    ctx.fillStyle = ratio > 0.5 ? "#5dd35d" : ratio > 0.25 ? "#e6c34c" : "#e2574a";
    roundRect(ctx, x, y, w * ratio, 4, 2); ctx.fill();
  }

  // --- Humanoidní postava (meč, luk, prak, puška, laser, robot) ---
  function drawHumanoid(ctx, u, walk, time, atk) {
    const s = u.size;
    const robot = u.kind === "robot" || u.kind === "titan";
    const body = u.color;
    const dk = shade(body, -45);
    const lt = shade(body, 30);
    const skin = robot ? shade(body, 50) : "#e8c4a0";

    const legLen = s * 0.55;
    const hipY = -legLen;
    const torsoH = s * 0.7;
    const torsoY = hipY - torsoH;
    const headR = s * 0.3;

    // nohy
    ctx.strokeStyle = dk;
    ctx.lineWidth = Math.max(3, s * 0.22);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-s * 0.12, hipY); ctx.lineTo(-s * 0.12 + walk * s * 0.18, 0);
    ctx.moveTo(s * 0.12, hipY); ctx.lineTo(s * 0.12 - walk * s * 0.18, 0);
    ctx.stroke();

    // trup
    const g = ctx.createLinearGradient(0, torsoY, 0, hipY);
    g.addColorStop(0, lt); g.addColorStop(1, dk);
    ctx.fillStyle = g;
    roundRect(ctx, -s * 0.32, torsoY, s * 0.64, torsoH + s * 0.1, s * 0.18);
    ctx.fill();

    // hlava + helma
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(0, torsoY - headR * 0.4, headR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = robot ? shade(body, -10) : shade(body, -20);
    ctx.beginPath();
    ctx.arc(0, torsoY - headR * 0.55, headR, Math.PI, Math.PI * 2);
    ctx.fill();
    if (robot) { // oko robota
      ctx.fillStyle = "#ff5d5d";
      ctx.fillRect(headR * 0.1, torsoY - headR * 0.55, headR * 0.7, headR * 0.3);
    }

    // ruka + zbraň
    drawWeapon(ctx, u, s, torsoY, time, walk, atk || 0);
  }

  function drawWeapon(ctx, u, s, torsoY, time, walk, atk) {
    const armY = torsoY + s * 0.18;
    // při útoku se zbraň rozmáchne dopředu úměrně fázi úderu
    const swing = Math.sin(time * 6 + u.x) * 0.12 + atk * 0.9;
    ctx.strokeStyle = "#caa888";
    ctx.lineWidth = Math.max(2.5, s * 0.16);
    ctx.lineCap = "round";

    switch (u.kind) {
      case "club": {
        ctx.beginPath(); ctx.moveTo(s * 0.2, armY); ctx.lineTo(s * 0.5, armY - s * 0.2); ctx.stroke();
        ctx.fillStyle = "#8a5a36";
        ctx.beginPath(); ctx.arc(s * 0.55, armY - s * 0.28, s * 0.18, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "sword": {
        // štít
        ctx.fillStyle = shade(u.color, -30);
        roundRect(ctx, -s * 0.5, armY - s * 0.1, s * 0.22, s * 0.5, 3); ctx.fill();
        // meč
        ctx.save(); ctx.translate(s * 0.25, armY); ctx.rotate(-0.5 + swing);
        ctx.strokeStyle = "#dfe6f0"; ctx.lineWidth = s * 0.12;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s * 0.6, 0); ctx.stroke();
        ctx.strokeStyle = "#8a6a3a"; ctx.lineWidth = s * 0.2;
        ctx.beginPath(); ctx.moveTo(-s * 0.05, -s * 0.12); ctx.lineTo(-s * 0.05, s * 0.12); ctx.stroke();
        ctx.restore();
        break;
      }
      case "soldier": {
        // puška u boku
        ctx.strokeStyle = "#2b313c"; ctx.lineWidth = s * 0.14;
        ctx.beginPath(); ctx.moveTo(-s * 0.1, armY); ctx.lineTo(s * 0.5, armY - s * 0.05); ctx.stroke();
        break;
      }
      case "sling": {
        ctx.strokeStyle = "#7a5a36"; ctx.lineWidth = s * 0.1;
        ctx.save(); ctx.translate(s * 0.3, armY - s * 0.1); ctx.rotate(Math.sin(time * 8 + u.x) * 0.8);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, s * 0.4); ctx.stroke();
        ctx.fillStyle = "#9a9a9a"; ctx.beginPath(); ctx.arc(0, s * 0.45, s * 0.12, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        break;
      }
      case "bow": {
        ctx.strokeStyle = "#7a4a26"; ctx.lineWidth = s * 0.1;
        ctx.beginPath(); ctx.arc(s * 0.35, armY, s * 0.45, -1.1, 1.1); ctx.stroke();
        ctx.strokeStyle = "rgba(230,230,230,.8)"; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(s * 0.35 + Math.cos(-1.1) * s * 0.45, armY + Math.sin(-1.1) * s * 0.45);
        ctx.lineTo(s * 0.35 + Math.cos(1.1) * s * 0.45, armY + Math.sin(1.1) * s * 0.45);
        ctx.stroke();
        break;
      }
      case "rifle": {
        ctx.strokeStyle = "#23282f"; ctx.lineWidth = s * 0.16;
        ctx.beginPath(); ctx.moveTo(-s * 0.1, armY); ctx.lineTo(s * 0.7, armY - s * 0.08); ctx.stroke();
        ctx.fillStyle = "#3a4150"; ctx.fillRect(s * 0.1, armY - s * 0.02, s * 0.18, s * 0.12);
        if (atk > 0.55) { // záblesk u ústí
          ctx.fillStyle = `rgba(255,220,120,${atk})`;
          ctx.beginPath(); ctx.arc(s * 0.74, armY - s * 0.08, s * 0.16 * atk, 0, Math.PI * 2); ctx.fill();
        }
        break;
      }
      case "laser": {
        ctx.strokeStyle = "#39424f"; ctx.lineWidth = s * 0.18;
        ctx.beginPath(); ctx.moveTo(-s * 0.05, armY); ctx.lineTo(s * 0.6, armY - s * 0.05); ctx.stroke();
        const glow = 0.5 + 0.5 * Math.sin(time * 10 + u.x);
        const r = s * 0.12 * (1 + atk);
        ctx.fillStyle = `rgba(110,214,207,${0.5 + glow * 0.5})`;
        ctx.beginPath(); ctx.arc(s * 0.62, armY - s * 0.05, r, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case "robot":
      case "titan": {
        ctx.fillStyle = "#39424f";
        roundRect(ctx, s * 0.1, armY - s * 0.12, s * 0.55, s * 0.24, 3); ctx.fill();
        ctx.fillStyle = shade(u.color, 40);
        ctx.fillRect(s * 0.6, armY - s * 0.06, s * 0.1, s * 0.12);
        break;
      }
    }
  }

  // --- Zvíře (mamut / slon) ---
  function drawBeast(ctx, u, walk, atk) {
    const s = u.size;
    const body = u.color, dk = shade(body, -40), lt = shade(body, 24);
    // nohy
    ctx.strokeStyle = dk; ctx.lineWidth = s * 0.22; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, -s * 0.5); ctx.lineTo(-s * 0.5 + walk * s * 0.15, 0);
    ctx.moveTo(-s * 0.15, -s * 0.5); ctx.lineTo(-s * 0.15 - walk * s * 0.15, 0);
    ctx.moveTo(s * 0.2, -s * 0.5); ctx.lineTo(s * 0.2 + walk * s * 0.15, 0);
    ctx.moveTo(s * 0.55, -s * 0.5); ctx.lineTo(s * 0.55 - walk * s * 0.15, 0);
    ctx.stroke();
    // tělo
    const g = ctx.createLinearGradient(0, -s * 1.4, 0, -s * 0.4);
    g.addColorStop(0, lt); g.addColorStop(1, dk);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.85, s * 0.8, s * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    // hlava
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(s * 0.7, -s * 0.85, s * 0.42, 0, Math.PI * 2); ctx.fill();
    // chobot
    ctx.strokeStyle = body; ctx.lineWidth = s * 0.22;
    ctx.beginPath();
    ctx.moveTo(s * 1.0, -s * 0.8);
    ctx.quadraticCurveTo(s * 1.25, -s * 0.55, s * 1.1, -s * 0.15);
    ctx.stroke();
    // kly
    ctx.strokeStyle = "#efe6d0"; ctx.lineWidth = s * 0.1;
    ctx.beginPath();
    ctx.moveTo(s * 0.95, -s * 0.65);
    ctx.quadraticCurveTo(s * 1.2, -s * 0.5, s * 1.25, -s * 0.7);
    ctx.stroke();
    // oko
    ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(s * 0.78, -s * 0.95, s * 0.06, 0, Math.PI * 2); ctx.fill();
  }

  // --- Vozidlo (beranidlo / tank) ---
  function drawVehicle(ctx, u, walk, time, atk) {
    const s = u.size;
    const body = u.color, dk = shade(body, -40), lt = shade(body, 22);
    const isTank = u.kind === "tank";
    atk = atk || 0;

    // pásy / kola
    ctx.fillStyle = "#1f242c";
    roundRect(ctx, -s * 0.7, -s * 0.34, s * 1.4, s * 0.34, s * 0.16); ctx.fill();
    ctx.fillStyle = "#3a4150";
    const wheels = 4;
    for (let i = 0; i < wheels; i++) {
      const wx = -s * 0.52 + i * (s * 1.04 / (wheels - 1));
      ctx.beginPath(); ctx.arc(wx, -s * 0.17, s * 0.12, 0, Math.PI * 2); ctx.fill();
    }
    // korba
    const g = ctx.createLinearGradient(0, -s * 1.0, 0, -s * 0.3);
    g.addColorStop(0, lt); g.addColorStop(1, dk);
    ctx.fillStyle = g;
    roundRect(ctx, -s * 0.6, -s * 0.9, s * 1.2, s * 0.6, s * 0.1); ctx.fill();

    if (isTank) {
      // věž + hlaveň (se zpětným rázem při výstřelu)
      ctx.fillStyle = shade(body, -10);
      roundRect(ctx, -s * 0.3, -s * 1.15, s * 0.6, s * 0.34, s * 0.1); ctx.fill();
      const recoil = atk * s * 0.18;
      ctx.fillStyle = "#2b313c";
      ctx.fillRect(s * 0.2 - recoil, -s * 1.02, s * 0.7, s * 0.12);
      if (atk > 0.55) {
        ctx.fillStyle = `rgba(255,210,110,${atk})`;
        ctx.beginPath(); ctx.arc(s * 0.92, -s * 0.96, s * 0.18 * atk, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      // beranidlo – kláda s kovovou hlavou
      ctx.fillStyle = "#6a4a2c";
      roundRect(ctx, -s * 0.2, -s * 0.75, s * 1.0, s * 0.2, s * 0.08); ctx.fill();
      ctx.fillStyle = "#9aa0a8";
      ctx.beginPath(); ctx.arc(s * 0.85, -s * 0.65, s * 0.18, 0, Math.PI * 2); ctx.fill();
      // střecha
      ctx.fillStyle = shade(body, -20);
      ctx.beginPath();
      ctx.moveTo(-s * 0.6, -s * 0.9); ctx.lineTo(0, -s * 1.15); ctx.lineTo(s * 0.6, -s * 0.9);
      ctx.closePath(); ctx.fill();
    }
  }

  // ============================================================
  //  EFEKTY (projektily, jiskry, meteor)
  // ============================================================
  function drawEffects(ctx, game) {
    for (const e of game.effects) {
      if (e.type === "shot") {
        const maxT = e.tower ? 0.12 : 0.12;
        const p = 1 - Math.max(0, e.ttl) / maxT;
        const yA = e.tower ? GROUND_Y - 150 : GROUND_Y - 22;
        const yB = GROUND_Y - 22;
        if (e.tower) {
          // zářivý paprsek
          ctx.strokeStyle = "rgba(255,235,140,.85)";
          ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(e.x1, yA); ctx.lineTo(e.x2, yB); ctx.stroke();
        } else {
          // letící projektil
          const x = e.x1 + (e.x2 - e.x1) * p;
          const y = yA + (yB - yA) * p - Math.sin(p * Math.PI) * 14; // mírný oblouk
          const col = e.side === "player" ? "#cfe4ff" : "#ffd0c4";
          ctx.strokeStyle = rgba(e.side === "player" ? "#9ec8ff" : "#ff9e8e", 0.7);
          ctx.lineWidth = 2;
          const dx = (e.x2 - e.x1) >= 0 ? 1 : -1;
          ctx.beginPath(); ctx.moveTo(x - dx * 8, y); ctx.lineTo(x, y); ctx.stroke();
          ctx.fillStyle = col;
          ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
        }
      } else if (e.type === "hit") {
        const a = Math.max(0, e.ttl) / 0.15;
        ctx.strokeStyle = `rgba(255,230,150,${a})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const an = (i / 6) * Math.PI * 2;
          const r1 = 3, r2 = 9 * (1 - a) + 4;
          ctx.beginPath();
          ctx.moveTo(e.x + Math.cos(an) * r1, GROUND_Y - 20 + Math.sin(an) * r1);
          ctx.lineTo(e.x + Math.cos(an) * r2, GROUND_Y - 20 + Math.sin(an) * r2);
          ctx.stroke();
        }
      } else if (e.type === "meteor") {
        const a = Math.max(0, e.ttl) / 0.7;
        // záblesk
        ctx.fillStyle = `rgba(255,120,40,${a * 0.35})`;
        ctx.fillRect(W / 2, 0, W / 2, H);
        // padající meteory
        const prog = 1 - a;
        for (let i = 0; i < 5; i++) {
          const mx = W / 2 + 60 + i * 80;
          const my = -60 + prog * (GROUND_Y + 80) + i * 30;
          const grd = ctx.createLinearGradient(mx - 24, my - 40, mx, my);
          grd.addColorStop(0, "rgba(255,180,80,0)");
          grd.addColorStop(1, "rgba(255,170,60,.9)");
          ctx.strokeStyle = grd; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(mx - 24, my - 40); ctx.lineTo(mx, my); ctx.stroke();
          ctx.fillStyle = "#ffd27a";
          ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }

  // ============================================================
  //  ČÁSTICE (obláčky při smrti jednotek)
  // ============================================================
  function spawnDeath(x, color, side) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 20 + Math.random() * 60;
      particles.push({
        x, y: GROUND_Y - 16 - Math.random() * 14,
        vx: Math.cos(a) * sp, vy: -Math.random() * 70 - 10,
        life: 0.6 + Math.random() * 0.4, max: 1,
        col: i % 3 === 0 ? color : (side === "player" ? "#9ec8ff" : "#ff9e8e"),
        r: 2 + Math.random() * 2.5,
      });
    }
    // prach
    for (let i = 0; i < 6; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 16, y: GROUND_Y - 4,
        vx: (Math.random() - 0.5) * 30, vy: -Math.random() * 20,
        life: 0.5, max: 0.5, col: "rgba(150,140,120,1)", r: 3 + Math.random() * 3, dust: true,
      });
    }
  }
  function updateParticles(game, dt) {
    // detekce úmrtí: jednotky, které zmizely od minulého snímku
    const current = new Set(game.units);
    for (const ref of prevUnits) {
      if (!current.has(ref)) {
        const lp = lastPos.get(ref);
        if (lp) spawnDeath(lp.x, lp.color, lp.side);
      }
    }
    lastPos.clear();
    for (const u of game.units) lastPos.set(u, { x: u.x, color: u.color, side: u.side });
    prevUnits = current;

    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 180 * dt; // gravitace
    }
    particles = particles.filter(p => p.life > 0);
  }
  function drawParticles(ctx) {
    for (const p of particles) {
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.col;
      if (p.dust) {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ============================================================
  //  PLOVOUCÍ TEXTY
  // ============================================================
  function drawFloats(ctx, game) {
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    for (const f of game.floats) {
      ctx.globalAlpha = Math.min(1, f.ttl);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,.6)";
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Posun mraků (volá se z update smyčky) ----------
  function step(dt) {
    if (!clouds) initBackground();
    for (const c of clouds) {
      c.x += c.v * dt;
      if (c.x - 40 > W) c.x = -40;
    }
  }

  // ============================================================
  //  HLAVNÍ VSTUP
  // ============================================================
  function scene(ctx, game, dt, time) {
    if (!clouds) initBackground();
    step(dt);
    drawBackground(ctx, game, time);
    drawBase(ctx, game, "player", game.playerBaseHp, game.age, time);
    drawBase(ctx, game, "enemy", game.enemyBaseHp, game.enemyAge, time);
    for (const tw of game.towers) drawTower(ctx, game, tw, time);

    const sorted = [...game.units].sort((a, b) => a.x - b.x);
    for (const u of sorted) drawUnit(ctx, game, u, time);

    drawEffects(ctx, game);
    updateParticles(game, dt);
    drawParticles(ctx);
    drawFloats(ctx, game);
  }

  global.Render = { scene };
})(typeof window !== "undefined" ? window : globalThis);
