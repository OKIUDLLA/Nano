/* ============================================================
   Age of War – remake: SPRITY VĚKU 0 – Doba kamenná ("stone")
   Jednotky: clubman, slinger, dino. Věže: rockslingshot, eggautomatic,
   primcatapult. Základna + pozadí. Vše procedurální, kontrakt viz common.js.
   ============================================================ */
(function () {
  "use strict";
  const S = window.Sprites, H = S.H, D = window.AoWData;
  const PAL = S.PAL, TAU = S.TAU, lerp = S.lerp, clamp = S.clamp, ease = S.ease;
  const DEG = Math.PI / 180;
  const OL = PAL.outline, LW = 1.6;

  // ---------- lokální pomocníci ----------
  // čára / končetina s obrysem (tlustší tmavý tah pod barevným)
  function oline(ctx, x1, y1, x2, y2, col, lw) {
    H.line(ctx, x1, y1, x2, y2, OL, lw + 2.6); H.line(ctx, x1, y1, x2, y2, col, lw);
  }
  function olimb2(ctx, x, y, l1, l2, a1, a2, col, lw) {
    H.limb2(ctx, x, y, l1, l2, a1, a2, OL, lw + 2.6);
    return H.limb2(ctx, x, y, l1, l2, a1, a2, col, lw);
  }
  // translate+rotate tak, aby lokální +x mířilo ve směru končetinového úhlu a (0 = dolů, + = vpřed)
  function aim(ctx, x, y, a) { ctx.translate(x, y); ctx.rotate(Math.PI / 2 - a); }
  // pád dozadu kolem bodu (px,0): 0..0.45 rotace k -80° s odskokem, pak leží; vrací 0..1
  function deathFall(ctx, dying, px, maxDeg) {
    if (!dying) return 0;
    const t = Math.min(1, dying / 0.45);
    const f = t < 0.72 ? Math.pow(t / 0.72, 1.6) : 1 - 0.09 * Math.sin((t - 0.72) / 0.28 * Math.PI);
    ctx.translate(px, 0); ctx.rotate((maxDeg || -80) * DEG * f); ctx.translate(-px, 0);
    return f;
  }
  // deterministický generátor pro statické rozmístění (pozadí, základna) – jen při načtení
  function mulberry(seed) { let a = seed | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  const HAIR = ["#2b1d12", "#5a3a1e", "#8a4a22", "#161616"];
  const FUR = ["#a5733b", "#8a5a2b", "#6d4a28"];
  const FURSPOT = "#4a2e14";

  // ---------- společná anatomie pravěkého člověka ----------
  // p.rng se volá PŘESNĚ 3× (stálá variace: pleť, vlasy, kožešina)
  function cavemanLook(p) {
    const r1 = p.rng(), r2 = p.rng(), r3 = p.rng();
    const si = Math.min(3, Math.floor(r1 * 4)), hi = Math.min(3, Math.floor(r2 * 4)), fi = Math.min(2, Math.floor(r3 * 3));
    return { skin: PAL.skin[si], skinD: PAL.skinDark[si], hair: HAIR[hi], fur: FUR[fi], furD: H.shade(FUR[fi], -0.25), fi };
  }
  const BX = -2;           // střed těla (trochu dozadu, aby zbraň vpředu zůstala v hitzóně)
  const HIP = -18, SH = -30, HEAD = -38, HR = 6.6;

  function foot(ctx, x, y, col, fwd) {
    H.ellipse(ctx, x + 2.2 * (fwd === undefined ? 1 : fwd), y, 4.6, 2.5, col, OL, 1.4);
  }
  // nohy: (aA,kA) přední/bližší, (aB,kB) vzdálenější
  function legs(ctx, k, hx, hy, aA, kA, aB, kB) {
    let e = olimb2(ctx, hx - 1, hy, 8.5, 8.5, aB, -kB, k.skinD, 4.4); foot(ctx, e[2], e[3], k.skinD);
    e = olimb2(ctx, hx + 1, hy, 8.5, 8.5, aA, -kA, k.skin, 4.4); foot(ctx, e[2], e[3], k.skin);
  }
  function torso(ctx, k, p, lean) {
    ctx.save(); ctx.translate(BX, HIP); ctx.rotate(lean || 0); ctx.translate(-BX, -HIP);
    H.rrect(ctx, BX - 7.5, SH - 1, 15, 17, 6, k.skin, OL, LW);
    H.ellipse(ctx, BX + 1, HIP - 6, 5, 4, H.rgba(k.skinD, 0.45));          // stín břicha
    // kožešinový popruh přes rameno
    H.line(ctx, BX - 6, SH + 1, BX + 6, HIP - 2, OL, 6); H.line(ctx, BX - 6, SH + 1, BX + 6, HIP - 2, k.fur, 3.6);
    // bederní kožešina (zubatý lem) + skvrny
    H.poly(ctx, [[BX - 8.5, HIP - 4], [BX + 8.5, HIP - 4], [BX + 8, HIP + 3], [BX + 5, HIP + 6], [BX + 2, HIP + 3], [BX - 1, HIP + 7], [BX - 4, HIP + 3], [BX - 7, HIP + 6]], k.fur, OL, LW);
    H.circle(ctx, BX - 4, HIP, 1.3, FURSPOT); H.circle(ctx, BX + 3, HIP + 1, 1.2, FURSPOT); H.circle(ctx, BX, HIP - 2.5, 1, FURSPOT);
    // týmový náhrdelník (šňůra se zuby v barvě týmu)
    H.line(ctx, BX - 5, SH + 2, BX + 5, SH + 2, p.team, 2.2);
    H.poly(ctx, [[BX - 1.5, SH + 2], [BX + 1.5, SH + 2], [BX, SH + 5.5]], PAL.bone, OL, 1);
    ctx.restore();
  }
  function head(ctx, k, p, x, y, tilt) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt || 0);
    // divoké vlasy – vějíř hrotů kolem temene a zátylku
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const a = (150 + i * 19) * DEG, r = HR * (i % 2 ? 1.75 : 1.12);
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    pts.push([0, 0]);
    H.poly(ctx, pts, k.hair, OL, LW);
    H.circle(ctx, 0, 0, HR, k.skin, OL, LW);
    H.circle(ctx, -2, 2.5, 3.5, H.rgba(k.skinD, 0.35));                  // stín tváře/vousů
    // ofina přes čelo
    H.poly(ctx, [[-5, -4.5], [-1, -7.5], [2, -4], [5, -6], [5.5, -2.5], [1, -3.8], [-2, -2.2], [-5.5, -2]], k.hair);
    // týmová čelenka
    H.rrect(ctx, -6.4, -3.6, 12.6, 2.6, 1, p.team, OL, 1);
    // tvář: obočí, oko, nos, ústa
    H.line(ctx, 2, -0.6, 5.2, -1.2, OL, 1.3);
    H.circle(ctx, 3.6, 0.9, 1.5, "#fff", OL, 0.9); H.circle(ctx, 4.1, 1, 0.75, OL);
    H.circle(ctx, 6.3, 2.6, 1.6, k.skinD, OL, 1);
    H.line(ctx, 2.5, 4.4, 4.8, 4.2, OL, 1);
    ctx.restore();
  }
  function hand(ctx, x, y, col) { H.circle(ctx, x, y, 2.7, col, OL, 1.3); }

  // dřevěný kyj: rukojeť v (x,y), směr a (končetinový úhel), délka L
  function club(ctx, x, y, a, L) {
    ctx.save(); aim(ctx, x, y, a);
    H.poly(ctx, [[-2.5, -1.8], [L * 0.55, -2.5], [L, -4.4], [L + 3.6, -1.8], [L + 3.6, 1.8], [L, 4.4], [L * 0.55, 2.5], [-2.5, 1.8]], PAL.wood, OL, LW);
    H.circle(ctx, L + 0.5, -1.6, 1.3, PAL.woodDark); H.circle(ctx, L - 3.5, 2, 1.1, PAL.woodDark); H.circle(ctx, L * 0.6, -0.5, 0.9, PAL.woodDark);
    ctx.restore();
  }
  // prak: od ruky (hx,hy) pod úhlem phi (canvas rad) poloměr R; loaded = kámen v kapse
  function sling(ctx, hx, hy, phi, R, loaded) {
    const px = hx + Math.cos(phi) * R, py = hy + Math.sin(phi) * R;
    const nx = -Math.sin(phi) * 1.6, ny = Math.cos(phi) * 1.6;
    H.line(ctx, hx, hy, px + nx, py + ny, PAL.leather, 1.3); H.line(ctx, hx, hy, px - nx, py - ny, PAL.leather, 1.3);
    H.ellipse(ctx, px, py, 3.4, 2.2, PAL.leather, OL, 1, phi);
    if (loaded) H.circle(ctx, px, py, 1.9, PAL.stone, OL, 0.9);
  }

  // postoj nohou podle animace; vrací {aA,kA,aB,kB,bob}
  function legPose(p, walking) {
    if (walking) { const w = H.walkCycle(p.walk, 0.6); return { aA: w.legA, kA: w.kneeA, aB: w.legB, kB: w.kneeB, bob: w.bob, armA: w.armA, armB: w.armB }; }
    return { aA: 0.22, kA: 0, aB: -0.22, kB: 0.05, bob: 0, armA: 0, armB: 0 };
  }

  // Sestavení pravěkého člověka. far = {a1,a2} vzdálená paže; near(ctx, sx, sy) kreslí bližší paži + zbraň
  function cavemanBody(ctx, p, k, lp, br, lean, far, near) {
    const bob = -lp.bob + br;
    ctx.save(); ctx.translate(0, bob);
    // vzdálená paže (za tělem)
    const fsx = BX - 1.5, fsy = SH + 1;
    let e = olimb2(ctx, fsx, fsy, 6, 6, far.a1, far.a2, k.skinD, 3.8); hand(ctx, e[2], e[3], k.skinD);
    legs(ctx, k, BX, HIP, lp.aA, lp.kA, lp.aB, lp.kB);
    torso(ctx, k, p, lean);
    // rameno po náklonu trupu
    const sx = BX + Math.sin(lean) * (HIP - SH), sy = HIP - Math.cos(lean) * (HIP - SH);
    head(ctx, k, p, sx + 1.2, sy + (HEAD - SH), lean * 0.6);
    near(ctx, sx, sy);
    ctx.restore();
  }

  // ---------- KLACKAŘ ----------
  S.registerUnit("clubman", (ctx, p) => {
    const k = cavemanLook(p);
    H.shadow(ctx, p.w * 0.9);
    ctx.save();
    const df = deathFall(ctx, p.dying, 0);
    const walking = p.anim === "walk" || p.anim === "shootwalk";
    const attacking = p.anim === "attack" || p.anim === "shoot" || p.anim === "shootwalk";
    const lp = legPose(p, walking);
    const br = p.anim === "idle" ? H.breathe(p.t) * 0.6 : 0;
    const s = attacking ? H.strike(p.phase, p.hitFrac || 0.5) : 0;
    let a1, a2, ca;
    if (s < 0) { a1 = lerp(-0.9, -1.6, -s); a2 = lerp(-1.6, -1.2, -s); ca = lerp(-2.9, -2.95, -s); }
    else { a1 = lerp(-0.9, 0.85, s); a2 = lerp(-1.6, 0.3, s); ca = lerp(3.38, 0.3, s); }
    const lean = s > 0 ? s * 0.12 : s * 0.07;
    let far = { a1: 0.25 + (walking ? lp.armB : 0) - s * 0.45, a2: 0.35 };
    if (df) { far = { a1: -0.6, a2: -0.8 }; a1 = -0.5 - df * 1.6; a2 = -0.6; ca = lerp(-2.9, -1.4, df); }
    cavemanBody(ctx, p, k, lp, br, lean, far, (c, sx, sy) => {
      const e = olimb2(c, sx + 1, sy, 6, 6, a1, a2, k.skin, 3.8);
      club(c, e[2], e[3], ca, 12);
      hand(c, e[2], e[3], k.skin);
    });
    ctx.restore();
  });

  // ---------- PRAKOVNÍK ----------
  S.registerUnit("slinger", (ctx, p) => {
    const k = cavemanLook(p);
    H.shadow(ctx, p.w * 0.9);
    ctx.save();
    const df = deathFall(ctx, p.dying, 0);
    const walking = p.anim === "walk" || p.anim === "shootwalk";
    const shooting = p.anim === "shoot" || p.anim === "shootwalk";
    const lp = legPose(p, walking);
    const br = p.anim === "idle" ? H.breathe(p.t) * 0.6 : 0;
    const hf = p.hitFrac || 0.8;
    let a1 = 0.3 + (walking ? lp.armA : 0), a2 = 0.15, phi = Math.PI / 2 + (walking ? lp.armA * 0.6 : 0), R = 7, loaded = true, lean = 0;
    let far = { a1: 0.25 + (walking ? lp.armB : 0), a2: 0.3 };
    if (shooting) {
      far = { a1: 1.15, a2: 0.2 };
      if (p.phase < hf) {                          // roztáčení praku nad hlavou (2 otáčky)
        const u = p.phase / hf;
        a1 = 2.55; a2 = 0.1; R = 8.5; phi = -Math.PI / 4 + (u - 1) * 2 * TAU; lean = -0.05;
      } else {                                      // vypuštění kamene → paže vpřed, prak vlaje
        const u = (p.phase - hf) / (1 - hf); loaded = false;
        if (u < 0.35) { a1 = 1.5; a2 = 0.15; phi = lerp(-Math.PI / 4, -0.1, u / 0.35); R = 8; lean = 0.1; }
        else { const v = (u - 0.35) / 0.65; a1 = lerp(1.5, 2.55, v); a2 = 0.12; phi = lerp(-0.1, -Math.PI / 4, v); R = 8; lean = 0.1 * (1 - v); }
      }
    } else if (p.anim === "attack") {               // švih prakem jako bičem
      const s = H.strike(p.phase, p.hitFrac || 0.5);
      if (s < 0) { a1 = lerp(0.3, -2.3, -s); a2 = lerp(0.15, -0.5, -s); phi = Math.PI / 2; R = 7; lean = s * 0.06; }
      else { a1 = lerp(0.3, 1.0, s); a2 = lerp(0.15, 0.3, s); phi = lerp(Math.PI / 2, 0.6, s); R = 7; lean = s * 0.12; }
      far.a1 = 0.25 - s * 0.4;
    }
    if (df) { far = { a1: -0.5, a2: -0.9 }; a1 = -0.3 - df * 1.5; a2 = -0.5; phi = Math.PI / 2 - df * 0.6; R = 7; }
    cavemanBody(ctx, p, k, lp, br, lean, far, (c, sx, sy) => {
      const e = olimb2(c, sx + 1, sy, 6, 6, a1, a2, k.skin, 3.8);
      sling(c, e[2], e[3], phi, R, loaded);
      hand(c, e[2], e[3], k.skin);
    });
    ctx.restore();
  });

  // ---------- JEZDEC NA DINU ----------
  const DINO = [["#6a9a3c", "#cfd98c"], ["#7f8f3a", "#d8d39a"], ["#5c8a62", "#c6d8a8"]];
  const DX = -6;                               // střed těla dina
  function dinoFoot(ctx, x, y, col) {
    H.poly(ctx, [[x - 4, y - 2.5], [x + 4, y - 3], [x + 9, y - 1], [x + 8, y + 1.5], [x - 4, y + 2.5]], col, OL, 1.4);
    H.poly(ctx, [[x + 7.5, y - 1.5], [x + 11, y - 0.5], [x + 7.5, y + 1]], PAL.bone, OL, 0.8);
    H.poly(ctx, [[x + 3, y - 3], [x + 5, y - 6], [x + 6.5, y - 2.5]], PAL.bone, OL, 0.8);
  }
  function dinoHeadNeck(ctx, col, colD, belly, jaw, dead) {
    // počátek = kořen krku; hlava vpředu nahoře
    H.poly(ctx, [[-5, -6], [8, -20], [17, -17], [8, 7]], col, OL, LW);
    H.ellipse(ctx, 15, -13, 8.5, 7, col, OL, LW);
    H.poly(ctx, [[11, -18.5], [22, -16.5], [27, -12], [26.5, -7.5], [13, -6]], col, OL, LW);   // čenich
    H.ellipse(ctx, 18, -8.5, 6, 2.2, belly);                                                      // světlé hrdlo/pysk
    // zuby horní
    for (const tx of [16.5, 20.5, 24]) H.poly(ctx, [[tx - 1.3, -6.6], [tx + 1.3, -6.6], [tx, -3.6]], "#fff", OL, 0.7);
    // dolní čelist (otočná)
    ctx.save(); ctx.translate(13, -6); ctx.rotate(jaw);
    H.poly(ctx, [[0, 0], [12, 0.5], [13, 4], [3, 5.5]], colD, OL, LW);
    for (const tx of [4, 8.5]) H.poly(ctx, [[tx - 1.2, 0.6], [tx + 1.2, 0.6], [tx, -2.4]], "#fff", OL, 0.7);
    ctx.restore();
    H.circle(ctx, 25.5, -11, 0.9, OL);                                                            // nozdra
    // oko + nadočnicový val
    if (dead) { H.line(ctx, 14, -16, 18, -12, OL, 1.4); H.line(ctx, 18, -16, 14, -12, OL, 1.4); }
    else { H.circle(ctx, 16, -14, 2.4, "#fff", OL, 1); H.circle(ctx, 17, -14, 1.2, OL); }
    H.poly(ctx, [[11.5, -19], [21, -17.5], [20, -15.5], [12, -16]], colD, OL, 1.2);
  }
  S.registerUnit("dino", (ctx, p) => {
    const k = cavemanLook(p);
    const dv = DINO[k.fi];                       // stálá varianta barvy dina
    const col = dv[0], colD = H.shade(col, -0.28), belly = dv[1], spot = H.shade(col, -0.4);
    H.shadow(ctx, p.w * 0.9);
    const walking = p.anim === "walk" || p.anim === "shootwalk";
    const attacking = p.anim === "attack" || p.anim === "shoot" || p.anim === "shootwalk";
    const s = attacking ? H.strike(p.phase, p.hitFrac || 0.47) : 0;
    const d = p.dying ? Math.min(1, p.dying / 0.45) : 0;
    const df = d ? (d < 0.72 ? Math.pow(d / 0.72, 1.6) : 1 - 0.09 * Math.sin((d - 0.72) / 0.28 * Math.PI)) : 0;
    const wc = H.walkCycle(p.walk, 0.5);
    const idle = p.anim === "idle";
    const br = idle ? H.breathe(p.t, 2, 0.6) : 0;
    const sway = Math.sin(p.t * 2.6) * 1.5 + (walking ? Math.sin(p.walk * TAU * 2) * 1.5 : 0) - s * 2;
    const jaw = df ? 0.5 : (s < 0 ? -s * 0.7 : 0.04);
    const lunge = s < 0 ? s * 2.5 : s * 4.5;
    // nohy: stoj / chůze / zhroucení
    let aA = 0.3, kA = -0.6, aB = -0.2, kB = -0.35, bob = 0;
    if (walking) { aA = wc.legA + 0.1; kA = -0.55 - wc.kneeA * 0.6; aB = wc.legB + 0.1; kB = -0.55 - wc.kneeB * 0.6; bob = wc.bob * 1.3; }
    if (df) { aA = lerp(0.3, 1.45, df); kA = lerp(-0.6, -2.9, df); aB = lerp(-0.2, 1.25, df); kB = lerp(-0.35, -2.7, df); }   // nohy složené pod tělo
    ctx.save();
    // zhroucení: mírný záklon kolem zadních nohou + propad těla
    if (df) { ctx.translate(-10, 0); ctx.rotate(-20 * DEG * df); ctx.translate(10, 10 * df); }
    ctx.translate(0, -bob + br * 0.5);
    ctx.save(); ctx.translate(DX - 3, -22); ctx.rotate(s * 0.05); ctx.translate(-(DX - 3), 22);   // náklon při kousnutí
    // ocas
    ctx.beginPath(); ctx.moveTo(DX - 12, -40);
    ctx.quadraticCurveTo(DX - 27, -41 + sway * 0.5, DX - 33, -31 + sway);
    ctx.quadraticCurveTo(DX - 27, -25 + sway * 0.5, DX - 10, -23); ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = LW; ctx.lineJoin = "round"; ctx.stroke();
    // vzdálená noha
    let e = olimb2(ctx, DX - 5, -22, 12, 11, aB, kB, colD, 6); dinoFoot(ctx, e[2], e[3], colD);
    // tělo + břicho + skvrny + hřbetní hroty
    H.ellipse(ctx, DX, -32, 23, 12, col, OL, LW, -0.1);
    H.ellipse(ctx, DX + 3, -27, 15, 5.5, belly);
    H.ellipse(ctx, DX - 8, -38, 4, 2.4, spot); H.ellipse(ctx, DX + 2, -41, 3.2, 2, spot); H.ellipse(ctx, DX + 12, -37, 3.4, 2.2, spot); H.ellipse(ctx, DX - 16, -34, 3, 2, spot);
    for (let i = 0; i < 5; i++) { const x = DX - 20 + i * 5, y = -36 - Math.sqrt(Math.max(0, 1 - Math.pow((x - DX) / 23, 2))) * 12 * 0.98; H.poly(ctx, [[x - 2.2, y + 1.5], [x + 2.2, y + 1.5], [x + 0.3, y - 4]], colD, OL, 1); }
    // sedlo (týmová deka) + jezdec (bez bližší paže)
    H.rrect(ctx, DX - 12, -47, 19, 8, 3, p.team, OL, LW); H.line(ctx, DX - 9, -43, DX + 4, -43, H.shade(p.team, 0.35), 1.6);
    ctx.save(); ctx.translate(DX - 2, -43);
    if (df) { ctx.rotate(-80 * DEG * df); ctx.translate(0, 6 * df); }
    const sr = s;
    let r1, r2, rc;
    if (sr < 0) { r1 = lerp(-0.9, -1.6, -sr); r2 = lerp(-1.6, -1.2, -sr); rc = lerp(-2.9, -2.95, -sr); }
    else { r1 = lerp(-0.9, 0.85, sr); r2 = lerp(-1.6, 0.3, sr); rc = lerp(3.38, 0.5, sr); }
    if (df) { r1 = -0.4 - df * 1.5; r2 = -0.6; rc = lerp(-2.9, -1.5, df); }
    e = olimb2(ctx, -1.5, -13, 5, 5, df ? -0.8 : 1.25, df ? -0.9 : 0.25, k.skinD, 3.4); hand(ctx, e[2], e[3], k.skinD);
    const reinX = e[2], reinY = e[3];
    e = olimb2(ctx, 1, 0, 7, 7, 0.9, -1.6, k.skin, 4); foot(ctx, e[2], e[3], k.skin);
    H.rrect(ctx, -6, -15, 12, 15, 5, k.skin, OL, LW);
    H.line(ctx, -5, -13, 5, -3, OL, 5.5); H.line(ctx, -5, -13, 5, -3, k.fur, 3.2);
    H.poly(ctx, [[-7, -4], [7, -4], [6, 2], [3, 4.5], [0, 2], [-3, 5], [-6, 2]], k.fur, OL, LW);
    H.line(ctx, -4, -12.5, 4, -12.5, p.team, 2);
    ctx.save(); ctx.translate(1, -21.5); ctx.scale(0.85, 0.85); head(ctx, k, p, 0, 0, s * 0.1); ctx.restore();
    ctx.restore();
    // krk + hlava (s výpadem)
    ctx.save(); ctx.translate(DX + 15 + lunge, -37 + lunge * 0.35 + (idle ? Math.sin(p.t * 2.6) * 0.7 : 0));
    dinoHeadNeck(ctx, col, colD, belly, jaw, df > 0.3);
    ctx.restore();
    // otěž (od ruky jezdce k hlavě)
    if (!df) H.line(ctx, DX - 2 + reinX, -43 + reinY, DX + 15 + lunge + 11, -37 + lunge * 0.35 - 9, PAL.leather, 1.5);
    // bližší noha
    e = olimb2(ctx, DX - 1, -22, 12, 11, aA, kA, col, 6); dinoFoot(ctx, e[2], e[3], col);
    // bližší paže jezdce + kyj (navrch)
    ctx.save(); ctx.translate(DX - 2, -43);
    if (df) { ctx.rotate(-80 * DEG * df); ctx.translate(0, 6 * df); }
    e = olimb2(ctx, 1.5, -13, 5, 5, r1, r2, k.skin, 3.4);
    club(ctx, e[2], e[3], rc, 9); hand(ctx, e[2], e[3], k.skin);
    ctx.restore();
    ctx.restore(); // náklon
    ctx.restore(); // zhroucení/bob
  });

  // ---------- VĚŽE ----------
  function rock(ctx, x, y, r) { H.circle(ctx, x, y, r, PAL.stone, OL, 1.3); H.circle(ctx, x - r * 0.3, y - r * 0.3, r * 0.35, "#b5b5ad"); }
  // Kamenný prak: vidlice "Y" na pařezu, otáčí se podle míření; kapsa s kamenem natažená dozadu
  S.registerTurret("rockslingshot", (ctx, p) => {
    const a = (p.angle || 0) * DEG, rec = p.recoil || 0;
    rock(ctx, -16, 1, 3.2); rock(ctx, -11, 2, 2.6); rock(ctx, -19, 3, 2.2);               // zásoba kamení
    H.rrect(ctx, -6, -8, 12, 11, 3, PAL.woodDark, OL, LW); H.line(ctx, -3, -6, -3, 1, PAL.wood, 2);   // pařez
    // vzpřímená vidlice "Y", naklání se podle míření (záporný úhel = záklon = střelba vzhůru)
    ctx.save(); ctx.translate(0, -8); ctx.rotate(a);
    oline(ctx, 0, 1, 0, -11, PAL.woodLight, 5.4);                                          // dřík
    oline(ctx, 0, -10, -8, -22, PAL.woodLight, 4.4); oline(ctx, 0, -10, 8, -22, PAL.woodLight, 4.4); // vidlice
    H.line(ctx, -7, -20.5, -5.5, -18, PAL.woodDark, 1.4); H.line(ctx, 7, -20.5, 5.5, -18, PAL.woodDark, 1.4);
    H.circle(ctx, 0, -10, 2.2, PAL.woodDark, OL, 1);                                       // vázání v rozsoše
    const pull = lerp(16, -5, ease.out(rec));                                              // kapsa: nabito = natažená dozadu, po výstřelu vpředu
    const px = -pull, py = -20 + Math.max(0, pull) * 0.4;
    H.line(ctx, -8, -22, px, py, PAL.leather, 1.6); H.line(ctx, 8, -22, px, py, PAL.leather, 1.6);
    H.ellipse(ctx, px, py, 3.6, 2.6, PAL.leather, OL, 1);
    if (rec < 0.55) rock(ctx, px, py, 3);
    if (rec > 0.6) { ctx.strokeStyle = H.rgba("#ffffff", (rec - 0.6) * 2); ctx.lineWidth = 1.2; for (const dy of [-4, 0, 4]) { ctx.beginPath(); ctx.moveTo(8, -20 + dy); ctx.lineTo(16, -20 + dy * 1.4); ctx.stroke(); } }
    ctx.restore();
  });
  // Vaječný automat: hnízdo z větviček na kůlu, dutý kmínek jako hlaveň plive vejce
  S.registerTurret("eggautomatic", (ctx, p) => {
    const a = (p.angle || 0) * DEG, rec = p.recoil || 0;
    H.rrect(ctx, -3, -8, 6, 10, 2, PAL.woodDark, OL, 1.3);                                 // kůl
    H.ellipse(ctx, 0, -10, 12, 5.5, "#8a6a3a", OL, LW);                                    // hnízdo
    ctx.save(); ctx.strokeStyle = "#5e3b1b"; ctx.lineWidth = 1.2; ctx.lineCap = "round";
    for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(-10 + i * 3.2, -8 + (i % 2) * 2); ctx.lineTo(-6 + i * 3.2, -12 - (i % 3)); ctx.stroke(); }
    ctx.restore();
    H.ellipse(ctx, -5, -13, 3.2, 2.4, "#f3ead6", OL, 1, -0.3); H.ellipse(ctx, 1, -14, 3.2, 2.4, "#f3ead6", OL, 1, 0.2); H.ellipse(ctx, -2, -11.5, 3, 2.2, "#efe3c8", OL, 1);
    H.ellipse(ctx, 0, -9, 12, 3.4, "#7a5a30");                                             // přední okraj hnízda
    ctx.save(); ctx.translate(0, -14); ctx.rotate(a); ctx.translate(-3 * rec, 0);          // hlaveň (dutý kmínek) + zpětný ráz
    H.rrect(ctx, 0, -4, 17, 8, 3, PAL.wood, OL, LW); H.line(ctx, 4, -1, 12, -1, PAL.woodDark, 1.2);
    H.ellipse(ctx, 17, 0, 2.2, 3.8, "#3a2a18", OL, 1.2);
    if (rec < 0.3) H.ellipse(ctx, 17.5, 0, 3, 2.3, "#f3ead6", OL, 0.9);                   // další vejce v ústí
    if (rec > 0.5) { const f = (rec - 0.5) * 2; H.circle(ctx, 22, 0, 3.5 * f, H.rgba("#ffffff", 0.7 * f)); H.circle(ctx, 25, -3, 1.4, H.rgba("#f3ead6", f)); H.circle(ctx, 25, 3, 1.2, H.rgba("#f3ead6", f)); }
    ctx.restore();
    // ptáček-strážce na okraji hnízda (poskakuje s časem)
    const hop = Math.abs(Math.sin(p.t * 6)) * 1.2;
    H.ellipse(ctx, -11, -16 - hop, 3, 2.3, "#d9a93a", OL, 1); H.circle(ctx, -13, -18.5 - hop, 2, "#d9a93a", OL, 1); H.poly(ctx, [[-15, -18.5 - hop], [-17.5, -17.8 - hop], [-15, -17 - hop]], "#e0702a", OL, 0.7); H.circle(ctx, -13.6, -19 - hop, 0.6, OL);
  });
  // Primitivní katapult: A-rám z klád, vrhací rameno s miskou, kámen
  S.registerTurret("primcatapult", (ctx, p) => {
    const a = (p.angle || 0) * DEG, rec = p.recoil || 0;
    oline(ctx, -16, 3, 12, 3, PAL.woodDark, 4.5);                                          // základová kláda
    H.circle(ctx, -12, 3, 3.8, PAL.woodDark, OL, 1.3); H.circle(ctx, 8, 3, 3.8, PAL.woodDark, OL, 1.3); // kamenné/dřevěné disky (kola)
    H.circle(ctx, -12, 3, 1.2, OL); H.circle(ctx, 8, 3, 1.2, OL);
    oline(ctx, -12, 2, -2, -15, PAL.wood, 4); oline(ctx, 8, 2, -2, -15, PAL.wood, 4);     // A-rám
    oline(ctx, 2, -17, 14, -17, PAL.wood, 3.6);                                            // zarážka ramene
    H.line(ctx, -10, -1, -5, -9, PAL.leather, 1.2); H.line(ctx, 6, -1, 1, -9, PAL.leather, 1.2); // vázání
    const th = lerp(-150 * DEG, -62 * DEG, ease.out(rec)) + a * 0.35;                      // rameno: nataženo dozadu → vymrštěno vpřed
    ctx.save(); ctx.translate(-2, -15); ctx.rotate(th);
    oline(ctx, -3, 0, 20, 0, PAL.woodLight, 4);
    H.poly(ctx, [[17, -4.5], [23, -4.5], [24.5, 1.5], [17, 1.5]], PAL.leather, OL, 1.2);   // miska
    if (rec < 0.45) rock(ctx, 20.5, -4, 4);
    ctx.restore();
    H.circle(ctx, -2, -15, 2.6, PAL.woodDark, OL, 1.3);                                    // čep
    H.line(ctx, -2, -15, -12, 0, PAL.leather, 1.3);                                        // napínací lano
    H.rrect(ctx, -15, -4, 6, 5, 1.5, PAL.woodDark, OL, 1.2);                               // naviják
    if (rec > 0.5) { ctx.strokeStyle = H.rgba("#ffffff", (rec - 0.5) * 1.6); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(8, -32); ctx.lineTo(14, -34); ctx.moveTo(10, -27); ctx.lineTo(17, -27); ctx.stroke(); }
  });

  // ---------- ZÁKLADNA: hromada balvanů s jeskyní, lešení z klád, totem, kosti ----------
  const BOULDERS = (() => {
    const r = mulberry(4242), out = [];
    for (let row = 0; row < 5; row++) {
      const y = -9 - row * 17, x0 = -74 + row * 9, x1 = 58 - row * 13;
      for (let x = x0; x <= x1; x += 21) {
        out.push({ x: x + (r() - 0.5) * 8, y: y + (r() - 0.5) * 5, rx: 12 + r() * 5, ry: 9 + r() * 3.5, rot: (r() - 0.5) * 0.6, tint: row * 0.05 + r() * 0.08, row });
      }
    }
    out.sort((a, b) => b.row - a.row || a.x - b.x);
    return out;
  })();
  const CRACKS = [[[-50, -40], [-44, -48], [-47, -55], [-40, -60]], [[20, -70], [26, -64], [22, -58], [30, -52]], [[-20, -22], [-14, -28], [-18, -35]]];
  function boulder(ctx, b, hp) {
    const base = H.mix(PAL.stone, "#ffffff", b.tint), dark = H.shade(base, -0.22);
    H.ellipse(ctx, b.x, b.y, b.rx, b.ry, base, OL, LW, b.rot);
    ctx.save(); ctx.beginPath(); ctx.ellipse(b.x, b.y, b.rx - 0.8, b.ry - 0.8, b.rot, 0, TAU); ctx.clip();
    H.ellipse(ctx, b.x + b.rx * 0.25, b.y + b.ry * 0.45, b.rx * 0.9, b.ry * 0.7, dark, null, 0, b.rot);
    H.ellipse(ctx, b.x - b.rx * 0.35, b.y - b.ry * 0.4, b.rx * 0.3, b.ry * 0.22, H.rgba("#ffffff", 0.25));
    ctx.restore();
  }
  function skull(ctx, x, y, r) {
    H.circle(ctx, x, y, r, PAL.bone, OL, 1.3); H.rrect(ctx, x - r * 0.6, y + r * 0.4, r * 1.2, r * 0.75, 1, PAL.bone, OL, 1);
    H.circle(ctx, x - r * 0.35, y - r * 0.1, r * 0.3, OL); H.circle(ctx, x + r * 0.35, y - r * 0.1, r * 0.3, OL);
    H.line(ctx, x - r * 0.3, y + r * 0.8, x + r * 0.3, y + r * 0.8, OL, 0.8);
  }
  function flame(ctx, x, y, h, t, seed) {
    const w1 = Math.sin(t * 9 + seed) * 2, w2 = Math.sin(t * 13 + seed * 2) * 1.5;
    H.poly(ctx, [[x - 6, y], [x - 4 + w2, y - h * 0.5], [x + w1, y - h], [x + 4 - w2, y - h * 0.55], [x + 6, y]], "#f08a2a", OL, 1);
    H.poly(ctx, [[x - 3, y], [x - 1.5 + w2 * 0.5, y - h * 0.35], [x + w1 * 0.6, y - h * 0.6], [x + 2.5, y - h * 0.3], [x + 3, y]], "#ffd54a");
  }
  S.registerBase("stone", (ctx, p) => {
    const hp = p.hp === undefined ? 1 : p.hp, t = p.t || 0, slots = p.slots || 1;
    // totem vzadu vlevo
    ctx.save(); ctx.translate(-66, 0);
    H.rrect(ctx, -7, -118, 14, 118, 3, "#a86a2a", OL, LW);
    const faces = ["#c7442e", "#d9a13a", "#4f6fb3"];
    for (let i = 0; i < 3; i++) {
      const fy = -112 + i * 36;
      H.rrect(ctx, -7, fy, 14, 30, 3, faces[i], OL, 1.2);
      H.circle(ctx, -3, fy + 9, 2.6, "#fff", OL, 1); H.circle(ctx, 3, fy + 9, 2.6, "#fff", OL, 1); H.circle(ctx, -3, fy + 9, 1.1, OL); H.circle(ctx, 3, fy + 9, 1.1, OL);
      H.poly(ctx, [[-2, fy + 13], [2, fy + 13], [0, fy + 18]], H.shade(faces[i], -0.3), OL, 0.9);
      H.rrect(ctx, -4.5, fy + 20, 9, 5, 1, "#2b2320"); for (const tx of [-3, -1, 1, 3]) H.rrect(ctx, tx - 0.8, fy + 20.5, 1.6, 2, 0.3, PAL.bone);
    }
    H.poly(ctx, [[-16, -120], [-6, -126], [0, -122], [6, -126], [16, -120], [8, -116], [0, -112], [-8, -116]], "#c7442e", OL, 1.2);   // křídla ptáka
    H.poly(ctx, [[-3, -126], [3, -126], [0, -131]], "#d9a13a", OL, 1);
    ctx.restore();
    // balvany
    for (const b of BOULDERS) boulder(ctx, b, hp);
    // jeskyně (vchod do bojiště)
    const CX = 2;   // střed vchodu do jeskyně (mimo sloup lešení na x=35)
    ctx.beginPath(); ctx.moveTo(CX - 17, 0); ctx.lineTo(CX - 17, -20); ctx.quadraticCurveTo(CX, -44, CX + 17, -20); ctx.lineTo(CX + 17, 0); ctx.closePath();
    ctx.fillStyle = "#1c1511"; ctx.fill(); ctx.strokeStyle = OL; ctx.lineWidth = 2; ctx.stroke();
    for (const [sx, sl] of [[CX - 8, 6], [CX, 9], [CX + 8, 5]]) H.poly(ctx, [[sx - 2.5, -28 + (sx - CX) * (sx - CX) * 0.04], [sx + 2.5, -28 + (sx - CX) * (sx - CX) * 0.04], [sx, -28 + sl + (sx - CX) * (sx - CX) * 0.04]], "#5f5f59", OL, 0.8);
    const glow = hp < 0.5 ? 0.25 : 0.55 + Math.sin(t * 7) * 0.08;
    H.circle(ctx, CX, -6, 15, H.radial(ctx, CX, -6, 1, 15, [[0, H.rgba("#ff9a3a", glow)], [1, "rgba(255,120,40,0)"]]));
    // ohniště před jeskyní
    oline(ctx, -40, -2, -24, -5, PAL.woodDark, 3); oline(ctx, -40, -5, -24, -2, PAL.woodDark, 3);
    if (hp >= 0.5) flame(ctx, -32, -5, 16, t, 1); else { H.circle(ctx, -32, -5, 3, "#444", OL, 1); }
    // kosti: lebka, žebra, stehenní kost
    skull(ctx, -54, -5, 5.5);
    ctx.save(); ctx.strokeStyle = OL; ctx.lineWidth = 4.6; ctx.lineCap = "round";
    for (const pass of [0, 1]) { if (pass) { ctx.strokeStyle = PAL.bone; ctx.lineWidth = 2.4; } for (const [cx, cy, r] of [[-62, -60, 10], [-58, -66, 12]]) { ctx.beginPath(); ctx.arc(cx, cy, r, -0.4, 1.3); ctx.stroke(); } }
    ctx.restore();
    oline(ctx, -36, -18, -22, -30, PAL.bone, 2.4); H.circle(ctx, -36, -18, 2.3, PAL.bone, OL, 1); H.circle(ctx, -22, -30, 2.3, PAL.bone, OL, 1);
    // praskliny a suť podle poškození
    if (hp < 0.7) { ctx.strokeStyle = "#2b2320"; ctx.lineWidth = 1.4; ctx.lineJoin = "round"; const n = hp < 0.35 ? 3 : hp < 0.5 ? 2 : 1; for (let i = 0; i < n; i++) { const c = CRACKS[i]; ctx.beginPath(); ctx.moveTo(c[0][0], c[0][1]); for (let j = 1; j < c.length; j++) ctx.lineTo(c[j][0], c[j][1]); ctx.stroke(); } }
    if (hp < 0.5) { rock(ctx, 42, -2, 3.5); rock(ctx, -2, -1.5, 2.6); rock(ctx, 50, -1, 2.2); }
    // vlajka týmu na vrcholu
    const wv = Math.sin(t * 3) * 3, wv2 = Math.sin(t * 3 + 1.2) * 2;
    oline(ctx, -22, -88, -22, -160, PAL.wood, 3);
    H.poly(ctx, [[-21, -159], [10 + wv, -156 + wv2], [6 + wv2, -142], [10 + wv, -128 + wv2], [-21, -131]], p.team, OL, LW);
    H.circle(ctx, -6 + wv * 0.4, -144, 4, H.shade(p.team, -0.3)); H.circle(ctx, -22, -161, 2.6, PAL.bone, OL, 1);
    // lešení z klád: sloupy, příčky, vzpěry, plošiny pro věže
    const top = p.slotY[slots - 1] - 18;
    for (let r = -4; r > top; r -= 14) { oline(ctx, 35, r, 69, r - 2, PAL.wood, 3); if (((-r / 14) | 0) % 2) oline(ctx, 36, r, 68, r + 12, H.shade(PAL.wood, -0.1), 2.2); }
    oline(ctx, 35, 3, 35, top, PAL.woodDark, 5); oline(ctx, 69, 3, 69, top, PAL.woodDark, 5);
    for (let i = 0; i < slots; i++) {
      const y = p.slotY[i];
      oline(ctx, 31, y + 5, 36, y + 15, PAL.woodDark, 3); oline(ctx, 73, y + 5, 68, y + 15, PAL.woodDark, 3);
      H.rrect(ctx, S.SLOT_X - 22, y, 44, 6, 2, PAL.woodLight, OL, LW);
      for (const px of [38, 46, 54, 62, 70]) H.line(ctx, px, y + 1, px, y + 5, PAL.woodDark, 1);
      H.line(ctx, 32, y + 0.5, 72, y + 0.5, H.rgba("#ffffff", 0.3), 1);
    }
    oline(ctx, 35, top, 69, top, PAL.woodDark, 4); skull(ctx, 69, top - 7, 4);
    // kouř z jeskyně při těžkém poškození
    if (hp < 0.5) { for (let i = 0; i < 4; i++) { const u = ((t * 18 + i * 22) % 80) / 80; H.circle(ctx, 20 + Math.sin(u * 6 + i) * 6 + u * 10, -30 - u * 70, 4 + u * 7, H.rgba("#444444", 0.35 * (1 - u))); } }
  });

  // ---------- POZADÍ: obloha, slunce, mraky, sopka, kopce, pravěké stromy, země ----------
  const BG = (() => {
    const r = mulberry(777);
    const hill = (baseY, amp, step) => { const pts = []; for (let x = -320; x <= 1320; x += step) pts.push([x, baseY - r() * amp]); return pts; };
    const far = hill(300, 45, 140), mid = hill(343, 38, 110), near = hill(392, 22, 90);
    const yAt = (pts, x) => { let i = 0; while (i < pts.length - 2 && pts[i + 1][0] < x) i++; const a = pts[i], b = pts[i + 1]; return lerp(a[1], b[1], clamp((x - a[0]) / (b[0] - a[0]), 0, 1)); };
    const clouds = []; for (let i = 0; i < 7; i++) clouds.push({ x: i * 150 + r() * 80, y: 35 + r() * 95, s: 0.7 + r() * 0.7, v: 2.5 + r() * 3 });
    const trees = []; for (let i = 0; i < 9; i++) { const x = -250 + i * 165 + r() * 90; trees.push({ x, y: yAt(near, x) + 6, h: 38 + r() * 26, kind: i % 3 }); }
    const ferns = []; for (let i = 0; i < 14; i++) { const x = -280 + i * 115 + r() * 70; ferns.push({ x, y: yAt(near, x) + 4, s: 0.7 + r() * 0.6 }); }
    const midTrees = []; for (let i = 0; i < 12; i++) { const x = -300 + i * 135 + r() * 80; midTrees.push({ x, y: yAt(mid, x) + 4, s: 0.5 + r() * 0.4 }); }
    const pebbles = []; for (let i = 0; i < 16; i++) pebbles.push({ x: r() * 1000, y: 430 + r() * 16, r: 1.2 + r() * 1.6 });
    const grass = []; for (let x = 0; x <= 1000; x += 12) grass.push([x, 425 - r() * 3.5]);
    return { far, mid, near, clouds, trees, ferns, midTrees, pebbles, grass };
  })();
  const AGE0 = PAL.ages[0];
  let skyG = null, sunG = null, skyCtx = null;
  function hillPath(ctx, pts) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my); }
    ctx.lineTo(1400, 460); ctx.lineTo(-400, 460); ctx.closePath();
  }
  function cloud(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    for (const [cx, cy, r] of [[-22, 4, 12], [-6, -6, 16], [12, -2, 14], [26, 5, 10]]) H.circle(ctx, cx, cy, r, "#ffffff");
    H.ellipse(ctx, 2, 10, 34, 7, "#ffffff"); H.ellipse(ctx, 4, 13, 26, 4, "rgba(170,200,230,0.45)");
    ctx.restore();
  }
  function palm(ctx, x, y, h, kind) {
    const dark = AGE0.hill[2], top = H.shade(AGE0.hill[2], 0.25);
    ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.quadraticCurveTo(x + 2, y - h * 0.6, x + 5, y - h); ctx.lineTo(x + 9, y - h); ctx.quadraticCurveTo(x + 6, y - h * 0.6, x + 4, y); ctx.closePath();
    ctx.fillStyle = "#7a5a34"; ctx.fill(); ctx.strokeStyle = H.rgba(OL, 0.6); ctx.lineWidth = 1.2; ctx.stroke();
    for (let i = 0; i < 5; i++) { const a = -2.6 + i * 1.1 + (kind === 1 ? 0.3 : 0); H.ellipse(ctx, x + 7 + Math.cos(a) * 11, y - h - 2 + Math.sin(a) * 6, 15, 4.2, i % 2 ? dark : top, H.rgba(OL, 0.5), 1, a); }
    if (kind === 2) { H.circle(ctx, x + 5, y - h + 2, 2.2, "#c7442e"); H.circle(ctx, x + 10, y - h + 3, 2, "#c7442e"); }
  }
  function fern(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.strokeStyle = AGE0.hill[2]; ctx.lineWidth = 2.4; ctx.lineCap = "round";
    for (const a of [-1.3, -0.75, -0.2, 0.3, 0.9]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(Math.sin(a) * 10, -14, Math.sin(a) * 22, -18 + Math.abs(a) * 4); ctx.stroke(); }
    ctx.restore();
  }
  S.registerBackground("stone", (ctx, p) => {
    const t = p.t || 0, ls = p.layerShift || (() => 0);
    if (skyCtx !== ctx) { skyCtx = ctx; skyG = H.grad(ctx, 0, 0, 0, 420, [[0, AGE0.sky[0]], [1, AGE0.sky[1]]]); sunG = H.radial(ctx, 850, 72, 20, 62, [[0, "rgba(255,245,190,0.55)"], [1, "rgba(255,245,190,0)"]]); }
    ctx.fillStyle = skyG; ctx.fillRect(0, 0, 1000, 450);
    // slunce
    H.circle(ctx, 850, 72, 62, sunG);
    H.circle(ctx, 850, 72, 24, "#fff3b0", "#f2d05a", 2.5);
    // mraky (pomalu plují)
    for (const c of BG.clouds) cloud(ctx, ((c.x + t * c.v) % 1150) - 75, c.y, c.s);
    // sopka v dálce
    ctx.save(); ctx.translate(ls(0.15), 0);
    const vc = H.mix("#6d6480", AGE0.sky[1], 0.5);
    H.poly(ctx, [[380, 330], [522, 196], [560, 186], [600, 196], [745, 330]], vc, H.rgba(OL, 0.25), 1.2);
    H.poly(ctx, [[522, 196], [560, 186], [600, 196], [560, 330], [430, 330]], H.shade(vc, 0.12));
    H.poly(ctx, [[536, 192], [560, 186], [584, 192], [577, 200], [543, 200]], H.shade(vc, -0.3));
    H.ellipse(ctx, 560, 192, 16, 4.5, "rgba(240,90,40,0.85)");
    ctx.strokeStyle = "rgba(240,110,40,0.75)"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(566, 194); ctx.quadraticCurveTo(580, 230, 572, 262); ctx.stroke();
    for (let i = 0; i < 4; i++) { const u = ((t * 9 + i * 20) % 80) / 80; H.circle(ctx, 562 + u * 55 + Math.sin(u * 5 + i) * 6, 182 - u * 60, 9 + u * 10, H.rgba("#8a8296", 0.35 * (1 - u))); }
    ctx.restore();
    // kopce: daleko / střed / blízko (parallax)
    ctx.save(); ctx.translate(ls(0.3), 0); hillPath(ctx, BG.far); ctx.fillStyle = H.mix(AGE0.hill[0], AGE0.sky[1], 0.3); ctx.fill(); ctx.restore();
    ctx.save(); ctx.translate(ls(0.55), 0); hillPath(ctx, BG.mid); ctx.fillStyle = H.mix(AGE0.hill[0], AGE0.sky[1], 0.12); ctx.fill();
    for (const m of BG.midTrees) { H.circle(ctx, m.x, m.y - 10 * m.s, 9 * m.s, AGE0.hill[1]); H.circle(ctx, m.x + 6 * m.s, m.y - 8 * m.s, 7 * m.s, AGE0.hill[1]); H.line(ctx, m.x, m.y, m.x, m.y - 8 * m.s, "#6a5030", 2 * m.s); }
    ctx.restore();
    ctx.save(); ctx.translate(ls(0.8), 0); hillPath(ctx, BG.near); ctx.fillStyle = AGE0.hill[1]; ctx.fill();
    ctx.strokeStyle = H.rgba("#ffffff", 0.18); ctx.lineWidth = 3; ctx.stroke();
    for (const tr of BG.trees) palm(ctx, tr.x, tr.y, tr.h, tr.kind);
    for (const f of BG.ferns) fern(ctx, f.x, f.y, f.s);
    ctx.restore();
    // země: hlína + travnatý okraj + kamínky
    ctx.fillStyle = AGE0.ground; ctx.fillRect(0, 425, 1000, 25);
    ctx.beginPath(); ctx.moveTo(0, 432); for (const g of BG.grass) ctx.lineTo(g[0], g[1]); ctx.lineTo(1000, 432); ctx.closePath(); ctx.fillStyle = AGE0.groundTop; ctx.fill();
    H.line(ctx, 0, 431.5, 1000, 431.5, H.shade(AGE0.ground, -0.25), 1.5);
    for (const pb of BG.pebbles) H.circle(ctx, pb.x, pb.y, pb.r, H.shade(AGE0.ground, -0.3));
  });
})();
