/* ============================================================
   Age of War – remake: SPRITY – společná knihovna a registr
   Všechna grafika je procedurální (Canvas 2D, žádné obrázky).

   KONTRAKT PRO KRESLICÍ FUNKCE (platí pro js/sprites/age*.js):

   Jednotka: Sprites.registerUnit(key, fn)  fn(ctx, p)
     - souřadnice: (0,0) = střed chodidel na zemi, +x = SMĚR POHYBU (vpřed),
       -y = nahoru. Renderer sám zrcadlí jednotky nepřítele, kresli vždy doprava.
     - rozměry: sprite má zhruba vyplnit hitzónu [-p.w/2, p.w/2] × [-p.h, 0]
       (p.w, p.h jsou v px; výška může mírně přesáhnout, šířka ne).
     - p.anim: "idle" | "walk" | "attack" | "shoot" | "shootwalk" | "die"
     - p.phase: 0..1 postup uvnitř smyčky aktuální animace (attack/shoot/shootwalk)
     - p.hitFrac: 0..1 okamžik úderu/výstřelu uvnitř smyčky (p.phase ≥ hitFrac = po zásahu)
     - p.walk: 0..1 fáze kroku (plynulá, roste s uraženou vzdáleností)
     - p.t: globální čas v sekundách (pro dýchání, vlání, blikání)
     - p.hp: 0..1 zbývající zdraví (např. šrámy), p.dying: 0..1 postup umírání
     - p.side: 0 = hráč, 1 = nepřítel; p.team: barva týmu (akcent: vlajka, šátek, světlo)
     - p.rng: deterministický generátor (0..1) seedovaný identitou jednotky – pro
       stálé drobné odlišnosti (barva vlasů apod.); volat vždy ve stejném pořadí.

   Věž: Sprites.registerTurret(key, fn)  fn(ctx, p)
     - (0,0) = bod uchycení na plošině; p.angle = míření ve stupních (0 = vpřed, +x;
       záporné = vzhůru), p.recoil 0..1 (1 = právě vystřelila), p.t čas.
     - velikost zhruba [-22, 26] × [-34, 6].

   Základna: Sprites.registerBase(ageKey, fn)  fn(ctx, p)
     - (0,0) = střed základny na zemi, bojiště je směrem +x. Kreslit zhruba
       [-85, 85] × [-300, 0]; p.slots (1..4) = kolik plošin pro věže je koupeno,
       p.slotY = pole výšek plošin (záporné y), p.turrets = pole bool (obsazeno),
       p.hp 0..1 (poškození: praskliny, kouř), p.t čas, p.age index věku.
     - Plošiny pro věže kreslí ZÁKLADNA (lešení/ochoz) na x = Sprites.SLOT_X (=52)
       a y = p.slotY[i]; věže samotné kreslí renderer.

   Pozadí: Sprites.registerBackground(ageKey, fn)  fn(ctx, p)
     - kreslí celé pozadí světa ve světových souřadnicích 0..1000 × 0..450,
       včetně země (y 425..450). p.t čas, p.layerShift(parallaxFactor) → vrací
       x-posun kamery pro danou vrstvu (použij pro mírný parallax).
   ============================================================ */
(function (global) {
  "use strict";

  const D = global.AoWData;
  const SLOT_X = 52;

  // ---------- Pomocné kreslení ----------
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = {
    inOut: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    out: t => 1 - (1 - t) * (1 - t),
    in: t => t * t,
    back: t => { const s = 1.70158; return (t = t - 1) * t * ((s + 1) * t + s) + 1; },
    pulse: (t, w) => { w = w || 0.15; return t < w ? t / w : Math.max(0, 1 - (t - w) / (1 - w)); },
  };

  function hexToRgb(h) {
    h = h.replace("#", "");
    if (h.length === 3) h = h.split("").map(c => c + c).join("");
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r, g, b) { return "#" + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join(""); }
  function shade(hex, amt) { const [r, g, b] = hexToRgb(hex); const f = 1 + amt; return rgbToHex(r * f, g * f, b * f); }
  function mix(a, b, t) { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)); }
  function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }

  function circle(ctx, x, y, r, fill, stroke, lw) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lw || 1.5; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function ellipse(ctx, x, y, rx, ry, fill, stroke, lw, rot) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, TAU);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lw || 1.5; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function rrect(ctx, x, y, w, h, r, fill, stroke, lw) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lw || 1.5; ctx.strokeStyle = stroke; ctx.stroke(); }
  }
  function poly(ctx, pts, fill, stroke, lw, close) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (close !== false) ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lw || 1.5; ctx.strokeStyle = stroke; ctx.lineJoin = "round"; ctx.stroke(); }
  }
  function line(ctx, x1, y1, x2, y2, color, lw, cap) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = lw || 2; ctx.lineCap = cap || "round"; ctx.stroke();
  }
  // Končetina: od (x,y) délky len pod úhlem a (radiány; 0 = dolů, kladné = vpřed), vrací konec
  function limb(ctx, x, y, len, a, color, lw) {
    const ex = x + Math.sin(a) * len, ey = y + Math.cos(a) * len;
    line(ctx, x, y, ex, ey, color, lw, "round");
    return [ex, ey];
  }
  // Dvoukloubová končetina (stehno+lýtko / paže+předloktí) s ohybem; vrací [kolenoX,Y, konecX,Y]
  function limb2(ctx, x, y, l1, l2, a1, a2, color, lw) {
    const kx = x + Math.sin(a1) * l1, ky = y + Math.cos(a1) * l1;
    const ex = kx + Math.sin(a1 + a2) * l2, ey = ky + Math.cos(a1 + a2) * l2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(kx, ky); ctx.lineTo(ex, ey);
    ctx.strokeStyle = color; ctx.lineWidth = lw || 4; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
    return [kx, ky, ex, ey];
  }
  function shadow(ctx, w, alpha) {
    ellipse(ctx, 0, 1, w / 2, Math.max(3, w / 9), `rgba(0,0,0,${alpha === undefined ? 0.22 : alpha})`);
  }
  function grad(ctx, x1, y1, x2, y2, stops) {
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    for (const [o, c] of stops) g.addColorStop(o, c);
    return g;
  }
  function radial(ctx, x, y, r0, r1, stops) {
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    for (const [o, c] of stops) g.addColorStop(o, c);
    return g;
  }

  // ---------- Animace ----------
  // Krok: vrací úhly nohou/paží (rad) a poskok těla pro fázi 0..1
  function walkCycle(walk, amp) {
    amp = amp || 0.55;
    const s = Math.sin(walk * TAU), c = Math.cos(walk * TAU);
    return {
      legA: s * amp, legB: -s * amp,                  // úhel stehen (kladný = vpřed)
      kneeA: Math.max(0, -c) * amp * 1.4, kneeB: Math.max(0, c) * amp * 1.4, // ohyb kolen
      armA: -s * amp * 0.8, armB: s * amp * 0.8,
      bob: Math.abs(s) * 1.6,                          // zvednutí těla (odečíst od y)
    };
  }
  // Úder: fáze 0..1 → nápřah (do hitFrac) a seknutí (po něm); vrací -1..1 (záporné = nápřah, kladné = úder)
  function strike(phase, hitFrac) {
    hitFrac = hitFrac || 0.5;
    if (phase < hitFrac) return -ease.inOut(phase / hitFrac);
    return 1 - ease.out((phase - hitFrac) / (1 - hitFrac));
  }
  function breathe(t, speed, amp) { return Math.sin(t * (speed || 2.2)) * (amp || 0.8); }

  // ---------- Palety ----------
  const PAL = {
    skin: ["#f1c9a5", "#d9a173", "#c48a5a", "#8d5a3b", "#f6d6b8"],
    skinDark: ["#c99a73", "#b07d55", "#9c6b45", "#6c432a", "#d4b091"],
    team: ["#2f6fd6", "#d63b2f"],          // hráč modrá, nepřítel červená
    teamDark: ["#1f4a92", "#8f2419"],
    metal: "#aab2bd", metalDark: "#6f7884", metalLight: "#dfe5ec",
    wood: "#8b5a2b", woodDark: "#5e3b1b", woodLight: "#b47a3e",
    leather: "#7a4a24", bone: "#efe6d2", stone: "#8d8d85", stoneDark: "#5f5f59",
    outline: "#2b2320",
    ages: [
      { sky: ["#8fd0ff", "#dff3ff"], hill: ["#6cb04e", "#4c8e3a", "#3b7030"], ground: "#8a6a3f", groundTop: "#6fa848", accent: "#d08b2b" },
      { sky: ["#7fb6ef", "#e2eefb"], hill: ["#6aa54a", "#4a8738", "#386a2c"], ground: "#7f6440", groundTop: "#5f9c45", accent: "#9c2f2f" },
      { sky: ["#f2c27a", "#fbe7c4"], hill: ["#9cae5a", "#6f8d41", "#51703a"], ground: "#8c7046", groundTop: "#a4a85a", accent: "#b48a3c" },
      { sky: ["#6f8ea8", "#d3dde6"], hill: ["#6c7f67", "#4f6350", "#3d4d40"], ground: "#5d5d55", groundTop: "#7c8a6e", accent: "#5f7a3a" },
      { sky: ["#1b1f3a", "#5a3f8a"], hill: ["#39466e", "#2a3454", "#1c2440"], ground: "#2e3346", groundTop: "#4e5a84", accent: "#4ae0ff" },
    ],
  };

  // ---------- Registr ----------
  const units = {}, turrets = {}, bases = {}, backgrounds = {};
  function registerUnit(key, fn) { units[key] = fn; }
  function registerTurret(key, fn) { turrets[key] = fn; }
  function registerBase(ageKey, fn) { bases[ageKey] = fn; }
  function registerBackground(ageKey, fn) { backgrounds[ageKey] = fn; }

  // Náhradní kresba, když sprite chybí (viditelná, ať se na to nezapomene)
  function placeholderUnit(ctx, p) {
    rrect(ctx, -p.w / 2, -p.h, p.w, p.h, 6, "rgba(255,0,255,0.35)", "#f0f", 2);
    ctx.fillStyle = "#000"; ctx.font = "10px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(p.key || "?", 0, -p.h / 2);
  }
  function placeholderTurret(ctx, p) {
    ctx.save(); ctx.rotate((p.angle || 0) * Math.PI / 180);
    rrect(ctx, -6, -6, 30, 12, 3, "rgba(255,0,255,0.5)", "#f0f", 2); ctx.restore();
    circle(ctx, 0, 0, 10, "rgba(255,0,255,0.5)", "#f0f", 2);
  }
  function placeholderBase(ctx, p) {
    rrect(ctx, -85, -120, 170, 120, 10, "rgba(255,0,255,0.3)", "#f0f", 2);
    for (let i = 0; i < (p.slots || 1); i++) rrect(ctx, SLOT_X - 20, p.slotY[i] - 4, 40, 8, 2, "#f0f");
  }
  function placeholderBackground(ctx, p) {
    ctx.fillStyle = "#cfe8ff"; ctx.fillRect(0, 0, 1000, 450);
    ctx.fillStyle = "#6a8a4a"; ctx.fillRect(0, 425, 1000, 25);
  }

  function drawUnit(ctx, key, p) { (units[key] || placeholderUnit)(ctx, Object.assign({ key }, p)); }
  function drawTurret(ctx, key, p) { (turrets[key] || placeholderTurret)(ctx, Object.assign({ key }, p)); }
  function drawBase(ctx, ageKey, p) { (bases[ageKey] || placeholderBase)(ctx, p); }
  function drawBackground(ctx, ageKey, p) { (backgrounds[ageKey] || placeholderBackground)(ctx, p); }

  // ---------- Projektily (společné pro všechny věky) ----------
  function drawProjectile(ctx, b, t) {
    const rot = (b.rot || 0) * Math.PI / 180;
    const ang = (b.vx !== undefined && (b.vx || b.vy)) ? Math.atan2(b.vy + (b.g || 0), b.vx) : rot;
    ctx.save(); ctx.translate(b.x, b.y);
    switch (b.kind) {
      case "ballistic": {
        if (b.turret === 1) { ctx.rotate(rot); ellipse(ctx, 0, 0, 5, 3.6, "#f3ead6", "#8a7a5a", 1); }          // vejce
        else if (b.turret === 4) { ctx.rotate(ang); circle(ctx, 0, 0, 7, radial(ctx, 0, 0, 1, 7, [[0, "#fff3b0"], [0.5, "#ff9a2e"], [1, "rgba(255,80,0,0)"]])); circle(ctx, 0, 0, 4, "#ff6a1a"); } // ohnivá koule
        else if (b.turret === 2 || b.turret === 3) { ctx.rotate(rot); circle(ctx, 0, 0, 7, "#8d8d85", "#4a4a44", 1.5); circle(ctx, -2, -2, 2, "#b5b5ad"); } // balvan
        else { ctx.rotate(rot); circle(ctx, 0, 0, 4.5, "#9a9a92", "#4a4a44", 1.2); }                                // kámen
        break;
      }
      case "fast": { ctx.rotate(ang); if (b.shrapnel) { circle(ctx, 0, 0, 6, "#3a3a3a", "#111", 1); circle(ctx, 2, -2, 1.5, "#ff8a3a"); } else circle(ctx, 0, 0, b.dmg >= 70 ? 5 : 3.5, "#2f2f2f", "#000", 1); break; }
      case "rocket": {
        ctx.rotate(ang);
        rrect(ctx, -10, -3, 16, 6, 3, "#c9ced6", "#4b5560", 1); poly(ctx, [[6, -3], [12, 0], [6, 3]], "#d8402c");
        poly(ctx, [[-10, -3], [-14, -6], [-8, -1]], "#d8402c"); poly(ctx, [[-10, 3], [-14, 6], [-8, 1]], "#d8402c");
        circle(ctx, -13, 0, 4 + Math.sin(t * 60) * 1.5, "rgba(255,170,60,0.8)"); break;
      }
      case "laser": {
        ctx.rotate(ang);
        const col = b.turret === 14 ? "#9af7ff" : "#ff5a6a";
        ctx.shadowColor = col; ctx.shadowBlur = 8;
        rrect(ctx, -14, -2, 20, 4, 2, col); rrect(ctx, -10, -1, 12, 2, 1, "#ffffff"); break;
      }
      case "drop": { ellipse(ctx, 0, 0, 2.5, 4, "#2a1d0f"); break; }
      case "oil": { break; }
      case "shrapnel": { ctx.rotate(t * 20); rrect(ctx, -3, -1.5, 6, 3, 1, "#444", "#111", 0.8); break; }
      case "bomb": { ctx.rotate(ang); rrect(ctx, -9, -4, 18, 8, 4, "#4a5a3a", "#1e2a16", 1); poly(ctx, [[-9, -4], [-14, -7], [-14, -1]], "#6a7a4a"); poly(ctx, [[-9, 4], [-14, 7], [-14, 1]], "#6a7a4a"); break; }
      case "sky": {
        if (b.sub === "arrows") { ctx.rotate(ang); line(ctx, -14, 0, 10, 0, "#5a3a1a", 2); poly(ctx, [[10, 0], [5, -3], [5, 3]], "#aab"); poly(ctx, [[-14, 0], [-18, -3], [-10, -2]], "#c33"); poly(ctx, [[-14, 0], [-18, 3], [-10, 2]], "#c33"); }
        else { const s = b.scale || 1.4; ctx.rotate(ang); ctx.shadowColor = "#ff8a2a"; ctx.shadowBlur = 14; ellipse(ctx, -10 * s, 0, 16 * s, 5 * s, "rgba(255,140,40,0.55)"); circle(ctx, 0, 0, 7 * s, "#5a4a40", "#ffb060", 2); circle(ctx, 2 * s, -2 * s, 2 * s, "#8a7a70"); }
        break;
      }
    }
    ctx.restore();
  }

  const Sprites = {
    SLOT_X, TAU, clamp, lerp, ease, PAL,
    H: { circle, ellipse, rrect, poly, line, limb, limb2, shadow, grad, radial, shade, mix, rgba, walkCycle, strike, breathe },
    units, turrets, bases, backgrounds,
    registerUnit, registerTurret, registerBase, registerBackground,
    drawUnit, drawTurret, drawBase, drawBackground, drawProjectile,
    has(kind, key) { return !!({ unit: units, turret: turrets, base: bases, background: backgrounds })[kind][key]; },
  };
  global.Sprites = Sprites;
  void D;
})(typeof window !== "undefined" ? window : globalThis);
