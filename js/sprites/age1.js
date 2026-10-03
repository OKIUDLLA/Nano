/* ============================================================
   Age of War – remake: SPRITY – věk 1: Hradní věk ("castle")
   Jednotky: swordman, archer, knight
   Věže:     catapult, firecatapult, oil
   Základna: kamenný hrad s ochozy pro věže, pozadí: středověká krajina.
   Vše procedurálně (Canvas 2D), kontrakt viz common.js.
   ============================================================ */
(function () {
  "use strict";
  const S = window.Sprites, H = S.H, D = window.AoWData, PAL = S.PAL;
  const { clamp, lerp, ease } = S;
  const TAU = Math.PI * 2;
  const O = PAL.outline, LW = 1.6;
  const deg = d => d * Math.PI / 180;
  const shade = H.shade, mix = H.mix, rgba = H.rgba;
  void D;

  // ---------- lokální pomocníci ----------
  // končetina s obrysem (silná tmavá linka pod barvou)
  function limbO(ctx, x, y, l1, l2, a1, a2, col, lw) {
    H.limb2(ctx, x, y, l1, l2, a1, a2, O, lw + 2.6);
    return H.limb2(ctx, x, y, l1, l2, a1, a2, col, lw);
  }
  function lineO(ctx, x1, y1, x2, y2, col, lw) {
    H.line(ctx, x1, y1, x2, y2, O, lw + 2.4);
    H.line(ctx, x1, y1, x2, y2, col, lw);
  }
  function path(ctx, build, fill, stroke, lw, open) {
    ctx.beginPath(); build(ctx); if (!open) ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || LW; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke(); }
  }
  // pád dozadu: 0..0.7 pád (zrychlený), 0.7..1 odraz
  function fallAngle(u) {
    if (u < 0.7) return deg(-80) * ease.in(u / 0.7);
    return deg(-80 + 9 * Math.sin((u - 0.7) / 0.3 * Math.PI));
  }
  // společná kostra pro lidské jednotky
  function frame(p) {
    const dying = p.anim === "die";
    const walking = !dying && (p.anim === "walk" || p.anim === "shootwalk");
    const u = dying ? clamp(p.dying / 0.45, 0, 1) : 0;
    const wc = H.walkCycle(walking ? p.walk : 0);
    const bob = dying ? 0 : (walking ? -wc.bob : H.breathe(p.t) * 0.4);
    const ang = dying ? fallAngle(u) : 0;
    // nohy: koleno se ohýbá ve švihové fázi (noha jde dopředu)
    let aA = wc.legA, kA = wc.kneeB, aB = wc.legB, kB = wc.kneeA;
    if (u > 0) { aA = lerp(aA, -0.3, u); kA = lerp(kA, 0.6, u); aB = lerp(aB, 0.2, u); kB = lerp(kB, 0.35, u); }
    return { dying, walking, u, wc, bob, ang, aA, kA, aB, kB };
  }
  // 2-kloubová inverzní kinematika (konvence limb: 0 = dolů, + = vpřed); bend = ±1 strana lokte
  function ik(sx, sy, l1, l2, tx, ty, bend) {
    const dx = tx - sx, dy = ty - sy;
    const d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.05, l1 + l2 - 0.05);
    const base = Math.atan2(dx, dy);
    const al = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
    const ga = Math.acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
    return [base + bend * al, -bend * (Math.PI - ga)];
  }
  function boot(ctx, x, y, col) { H.ellipse(ctx, x + 1.2, y - 0.6, 3.4, 2.1, col, O, 1.3); }
  function hand(ctx, x, y, col) { H.circle(ctx, x, y, 2.2, col, O, 1.1); }
  function faceOn(ctx, x, y, r) {
    H.circle(ctx, x + r * 0.5, y - r * 0.15, 1.1, O);                                   // oko
    H.line(ctx, x + r * 0.85, y + r * 0.05, x + r * 1.05, y + r * 0.4, O, 1.2);         // nos
  }
  // meč: od ruky (x,y) směrem dir (konvence limb), délka len
  function sword(ctx, x, y, dir, len) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI - dir);
    H.rrect(ctx, -1.3, 0, 2.6, 4.5, 1, PAL.leather, O, 1);              // jílec
    H.circle(ctx, 0, 5, 1.6, "#c9a227", O, 1);                            // hlavice
    path(ctx, c => { c.moveTo(-1.5, -2); c.lineTo(-1.5, -len + 3); c.lineTo(0, -len); c.lineTo(1.5, -len + 3); c.lineTo(1.5, -2); }, PAL.metalLight, O, 1.3);
    H.line(ctx, 0, -3, 0, -len + 4, PAL.metal, 0.8);                      // rýha čepele
    H.rrect(ctx, -4, -2.6, 8, 2.2, 1, "#c9a227", O, 1);                   // záštita
    ctx.restore();
  }
  // luk: střed v ruce (x,y), horní rameno směrem dir; draw 0..1 natažení; vrací světové souřadnice tětivy
  function bow(ctx, x, y, dir, draw, arrow, teamCol, vib) {
    const th = Math.PI - dir, c = Math.cos(th), sn = Math.sin(th);
    const px = -12 * draw + (vib || 0);
    ctx.save(); ctx.translate(x, y); ctx.rotate(th);
    // tětiva
    path(ctx, k => { k.moveTo(0, -14); k.lineTo(px, 0); k.lineTo(0, 14); }, null, "#e8e2d0", 1, true);
    // lučiště
    path(ctx, k => { k.moveTo(0, -14.5); k.quadraticCurveTo(6.5, 0, 0, 14.5); }, null, O, 4, true);
    path(ctx, k => { k.moveTo(0, -14.5); k.quadraticCurveTo(6.5, 0, 0, 14.5); }, null, PAL.wood, 2, true);
    H.rrect(ctx, 1.2, -3, 3, 6, 1.5, PAL.leather, O, 1);                 // omotávka
    if (arrow) {
      H.line(ctx, px, 0, 6, 0, "#6b4a2a", 1.5);
      path(ctx, k => { k.moveTo(6, 0); k.lineTo(2.5, -1.6); k.lineTo(2.5, 1.6); }, PAL.metalLight, O, 1);
      path(ctx, k => { k.moveTo(px, 0); k.lineTo(px - 3.5, -2.2); k.lineTo(px + 2, -0.4); }, teamCol, O, 0.9);
      path(ctx, k => { k.moveTo(px, 0); k.lineTo(px - 3.5, 2.2); k.lineTo(px + 2, 0.4); }, teamCol, O, 0.9);
    }
    ctx.restore();
    return [x + px * c, y + px * sn];
  }

  // =====================================================================
  //  JEDNOTKY
  // =====================================================================

  // ---------- Mečíř: pěšák s mečem, kulatým štítem na zádech, kroužkovou zbrojí a kotlíkovou přilbou ----------
  S.registerUnit("swordman", function (ctx, p) {
    const skin = PAL.skin[Math.floor(p.rng() * PAL.skin.length)];
    const beard = p.rng() < 0.45;
    const team = p.team, teamD = shade(team, -0.3);
    const mail = "#a4acb6", mailD = shade(mail, -0.25);
    const pants = "#6b4f33", pantsD = shade(pants, -0.25), boots = "#3f2d1e";
    const f = frame(p);
    const s = (!f.dying && p.anim === "attack") ? H.strike(p.phase, p.hitFrac) : 0;
    H.shadow(ctx, p.w * 0.9);
    ctx.save(); ctx.rotate(f.ang);
    const hipY = -17 + f.bob, shY = -29 + f.bob, hy = shY - 8.5;

    // blízká paže (meč): klid = meč vzhůru; nápřah dozadu; sek vpřed-dolů
    let a1 = 0.3, a2 = 2.1, swA = 0.3;
    // nápřah: předloktí jde přes svislici dozadu (a1+a2: 2.4 → 3.7, tj. meč se zvedá nad hlavu a za ni)
    if (s < 0) { const k = -s; a1 = lerp(0.3, -1.2, k); a2 = lerp(2.1, 4.9, k); swA = lerp(0.3, 0.25, k); }
    else if (s > 0) { a1 = lerp(0.3, 1.15, s); a2 = lerp(2.1, -0.3, s); swA = lerp(0.3, -0.25, s); }
    if (f.walking) a1 += f.wc.armA * 0.35;
    if (f.u > 0) { a1 = lerp(a1, 0.5, f.u); a2 = lerp(a2, 0.3, f.u); swA = lerp(swA, 0.4, f.u); }
    // vzdálená paže (volná, vyvažuje)
    let fa1 = f.walking ? 0.1 + f.wc.armB * 0.6 : 0.15, fa2 = 0.35;
    if (s < 0) fa1 = lerp(0.15, 0.6, -s); else if (s > 0) fa1 = lerp(0.15, -0.7, s);
    if (f.u > 0) { fa1 = lerp(fa1, 0.35, f.u); fa2 = lerp(fa2, 0.15, f.u); }

    // štít na zádech
    H.circle(ctx, -6.5, shY + 6, 6.3, PAL.wood, O, LW);
    H.circle(ctx, -6.5, shY + 6, 4.7, team);
    H.line(ctx, -6.5, shY + 1.6, -6.5, shY + 10.4, teamD, 1.3);
    H.line(ctx, -10.9, shY + 6, -2.1, shY + 6, teamD, 1.3);
    H.circle(ctx, -6.5, shY + 6, 1.7, PAL.metalLight, O, 1);
    // vzdálená paže
    const fe = limbO(ctx, -1, shY + 1, 7, 6.5, fa1, fa2, mailD, 3.4);
    hand(ctx, fe[2], fe[3], shade(skin, -0.2));
    // vzdálená noha
    const lf = limbO(ctx, -1.5, hipY, 9, 8, f.aB, -f.kB, pantsD, 4.2);
    boot(ctx, lf[2], lf[3], boots);
    // trup: kroužková zbroj + tabard v barvě týmu
    H.rrect(ctx, -6, shY - 1, 12, 15.5, 4, mail, O, LW);
    ctx.fillStyle = rgba("#000", 0.12);
    for (let yy = shY + 2; yy < shY + 13; yy += 3) for (let xx = -4.5; xx < 6; xx += 3) { ctx.beginPath(); ctx.arc(xx, yy, 0.7, 0, TAU); ctx.fill(); }
    H.rrect(ctx, -3.5, shY + 1, 7, 12.5, 2, team, O, 1.2);
    H.line(ctx, 0, shY + 3, 0, shY + 12, teamD, 1);
    H.rrect(ctx, -6.3, hipY - 3.2, 12.6, 2.8, 1, PAL.leather, O, 1);      // opasek
    H.rrect(ctx, -1.2, hipY - 3, 2.4, 2.4, 0.5, "#c9a227");
    // blízká noha
    const ln = limbO(ctx, 1.5, hipY, 9, 8, f.aA, -f.kA, pants, 4.2);
    boot(ctx, ln[2], ln[3], boots);
    // hlava + přilba
    H.circle(ctx, 0, hy, 6.2, skin, O, LW);
    faceOn(ctx, 0, hy, 6.2);
    if (beard) H.ellipse(ctx, 1.5, hy + 4.2, 4, 2.3, "#5a4030", O, 1);
    path(ctx, c => { c.moveTo(-6.3, hy - 2.5); c.arc(0, hy - 2.5, 6.3, Math.PI, TAU); }, PAL.metal, O, LW);
    H.ellipse(ctx, 0, hy - 2.5, 8.8, 2.3, PAL.metalLight, O, LW);        // krempa
    H.line(ctx, -2.5, hy - 7.5, 2.5, hy - 7.5, PAL.metalLight, 1.2);     // odlesk
    H.line(ctx, 0, hy - 8.8, 0, hy - 7, O, 1.2);                          // nýt
    // blízká paže + meč
    const ne = limbO(ctx, 1, shY + 1, 7, 6.5, a1, a2, mail, 3.4);
    const dir = a1 + a2 + swA;
    sword(ctx, ne[2], ne[3], dir, 14);
    hand(ctx, ne[2], ne[3], skin);
    // švih
    if (s > 0.5) {
      ctx.strokeStyle = rgba("#ffffff", (s - 0.5) * 1.6); ctx.lineWidth = 2.2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(1, shY + 1, 16, -1.9, 0.9); ctx.stroke();
    }
    ctx.restore();
  });

  // ---------- Lučištník: kapuce, toulec, dlouhý luk ----------
  const HOODS = ["#5b8a3a", "#6c7a3a", "#7b5a33"];
  S.registerUnit("archer", function (ctx, p) {
    const skin = PAL.skin[Math.floor(p.rng() * PAL.skin.length)];
    const hood = HOODS[Math.floor(p.rng() * HOODS.length)];
    const hoodD = shade(hood, -0.28), tunic = mix(hood, "#c9a56a", 0.45), tunicD = shade(tunic, -0.28);
    const team = p.team, teamD = shade(team, -0.3);
    const pants = "#5a4632", pantsD = shade(pants, -0.25), boots = "#3f2d1e";
    const f = frame(p);
    const shooting = !f.dying && (p.anim === "shoot" || p.anim === "shootwalk");
    const s = (!f.dying && p.anim === "attack") ? H.strike(p.phase, p.hitFrac) : 0;
    const hf = clamp(p.hitFrac || 0.375, 0.05, 0.95);
    let draw = 0, after = -1;
    if (shooting) { if (p.phase < hf) draw = ease.out(p.phase / hf); else after = (p.phase - hf) / (1 - hf); }
    H.shadow(ctx, p.w * 0.9);
    ctx.save(); ctx.rotate(f.ang);
    const hipY = -17 + f.bob, shY = -29 + f.bob, hy = shY - 8.5;

    // blízká paže (luk): klid = luk svisle u boku; střelba = vpřed; úder = švih lukem
    let a1 = 0.35, a2 = 0.1, bowDir = 3.0;
    if (shooting) { a1 = 1.3; a2 = -0.05; bowDir = 3.1; }
    else if (s < 0) { const k = -s; a1 = lerp(0.35, -1.0, k); a2 = lerp(0.1, -1.5, k); bowDir = lerp(3.0, 3.9, k); }
    else if (s > 0) { a1 = lerp(0.35, 1.0, s); a2 = lerp(0.1, -0.5, s); bowDir = lerp(3.0, 0.55, s); }
    if (f.walking && !shooting) a1 += f.wc.armA * 0.4;
    if (f.u > 0) { a1 = lerp(a1, 0.5, f.u); a2 = lerp(a2, 0.2, f.u); bowDir = lerp(bowDir, 2.6, f.u); }

    // toulec na zádech (šípy s opeřením v barvě týmu)
    ctx.save(); ctx.translate(-6.5, shY + 5); ctx.rotate(0.3);
    for (let i = 0; i < 3; i++) { H.line(ctx, -1.5 + i * 1.5, -8, -1.5 + i * 1.5, -13, "#6b4a2a", 1.2); H.circle(ctx, -1.5 + i * 1.5, -13, 1.4, team, O, 0.8); }
    H.rrect(ctx, -3, -9, 6, 16, 2.5, PAL.leather, O, LW);
    H.line(ctx, -3, -4, 3, -4, shade(PAL.leather, -0.3), 1.2);
    ctx.restore();
    // vzdálená paže: při střelbě drží tětivu (IK), jinak visí
    let fa1 = f.walking ? 0.1 + f.wc.armB * 0.6 : 0.15, fa2 = 0.35;
    if (s < 0) fa1 = lerp(0.15, 0.6, -s); else if (s > 0) fa1 = lerp(0.15, -0.7, s);
    if (f.u > 0) { fa1 = lerp(fa1, 0.35, f.u); fa2 = lerp(fa2, 0.15, f.u); }
    // vzdálená noha
    const lf = limbO(ctx, -1.5, hipY, 9, 8, f.aB, -f.kB, pantsD, 4.2);
    boot(ctx, lf[2], lf[3], boots);
    // trup: tunika + opasek
    H.rrect(ctx, -6, shY - 1, 12, 15.5, 4, tunic, O, LW);
    H.line(ctx, 0.5, shY + 2, 0.5, shY + 13, tunicD, 1);
    H.rrect(ctx, -6.3, hipY - 3.2, 12.6, 2.8, 1, PAL.leather, O, 1);
    H.rrect(ctx, -2.5, hipY - 2.5, 4, 5, 1, "#8a6a3a", O, 1);             // váček
    // blízká noha
    const ln = limbO(ctx, 1.5, hipY, 9, 8, f.aA, -f.kA, pants, 4.2);
    boot(ctx, ln[2], ln[3], boots);
    // hlava s kapucí
    path(ctx, c => {
      c.moveTo(6, hy - 3); c.quadraticCurveTo(5, hy - 10.5, -1, hy - 9.8); c.quadraticCurveTo(-9, hy - 10.5, -11.5, hy - 2.5);
      c.quadraticCurveTo(-10.5, hy + 4, -8, shY + 2.5); c.lineTo(7.5, shY + 2.5); c.lineTo(6.8, hy + 4);
    }, hood, O, LW);
    H.ellipse(ctx, 2.8, hy + 0.8, 4.2, 5, skin, O, 1.3);                  // otvor kapuce / obličej
    H.circle(ctx, 4.6, hy - 0.6, 1.05, O);
    H.line(ctx, 6.3, hy + 0.8, 7, hy + 2, O, 1.1);
    H.line(ctx, -4, hy - 4, -7, hy - 6, hoodD, 1.2);                      // záhyb kapuce
    // šátek v barvě týmu: uzel u krku + cíp vlající přes hruď
    H.rrect(ctx, -6.5, shY - 1.8, 13.5, 3.6, 1.6, team, O, 1.1);
    path(ctx, c => { const w = Math.sin(p.t * 4) * 0.8; c.moveTo(1, shY + 1.5); c.lineTo(5.5, shY + 1.5); c.lineTo(4 + w, shY + 9); c.lineTo(0.5 + w, shY + 7); }, team, O, 1);

    // blízká paže + luk
    const ne = limbO(ctx, 0, shY + 1, 7, 6.5, a1, a2, tunic, 3.4);
    const bx = ne[2], by = ne[3];
    let vib = 0;
    if (after >= 0 && after < 0.25) vib = Math.sin(after * 70) * 2.2 * (1 - after * 4);
    const pull = bow(ctx, bx, by, bowDir, draw, draw > 0.02, team, vib);
    hand(ctx, bx, by, skin);
    // vzdálená ruka: tětiva → po výstřelu sáhne do toulce a zpět
    if (shooting) {
      let tx = pull[0], ty = pull[1];
      if (after >= 0) {
        const qx = -6, qy = shY - 9;
        if (after < 0.5) { const k = ease.inOut(after * 2); tx = lerp(pull[0], qx, k); ty = lerp(pull[1], qy, k); }
        else { const k = ease.inOut((after - 0.5) * 2); tx = lerp(qx, bx - 1.5, k); ty = lerp(qy, by, k); }
      }
      const ang = ik(-1, shY + 1, 7, 6.5, tx, ty, -1);
      const fe = limbO(ctx, -1, shY + 1, 7, 6.5, ang[0], ang[1], tunicD, 3.4);
      hand(ctx, fe[2], fe[3], shade(skin, -0.15));
    } else {
      const fe = limbO(ctx, -1, shY + 1, 7, 6.5, fa1, fa2, tunicD, 3.4);
      hand(ctx, fe[2], fe[3], shade(skin, -0.15));
    }
    if (s > 0.5) {
      ctx.strokeStyle = rgba("#ffffff", (s - 0.5) * 1.6); ctx.lineWidth = 2.2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.arc(0, shY + 1, 17, -1.9, 0.9); ctx.stroke();
    }
    ctx.restore();
  });

  // ---------- Rytíř na koni s dřevcem ----------
  const HORSES = ["#6e4a2e", "#3a3230", "#b5ad9f", "#8a5a35"];
  function hoof(ctx, x, y) { H.ellipse(ctx, x + 0.8, y - 0.8, 3.2, 2, "#2a211c", O, 1.2); }
  S.registerUnit("knight", function (ctx, p) {
    const horse = HORSES[Math.floor(p.rng() * HORSES.length)];
    const horseD = shade(horse, -0.25), horseL = shade(horse, 0.18);
    const plumeV = p.rng();
    const team = p.team, teamD = shade(team, -0.3), teamL = mix(team, "#ffffff", 0.4);
    const armor = PAL.metal, armorD = PAL.metalDark, armorL = PAL.metalLight;
    const mane = "#2a211c";
    const dying = p.anim === "die";
    const walking = !dying && (p.anim === "walk" || p.anim === "shootwalk");
    const u = dying ? clamp(p.dying / 0.45, 0, 1) : 0;
    const s = (!dying && p.anim === "attack") ? H.strike(p.phase, p.hitFrac) : 0;
    const wc = H.walkCycle(walking ? p.walk : 0, 0.42);
    const br = H.breathe(p.t, 2, 1);
    H.shadow(ctx, p.w * 0.85);
    ctx.save();
    // výpad (s>0) / vzepnutí (s<0)
    if (s !== 0) { ctx.translate(s > 0 ? 3 * s : 2 * s, 0); ctx.translate(-17, 0); ctx.rotate(s < 0 ? 0.16 * s : 0.03 * s); ctx.translate(17, 0); }
    // smrt: kůň klesá k zemi, nohy se složí, jezdec se skácí dozadu
    const drop = u < 0.7 ? 21 * ease.in(u / 0.7) : 21 - 2.5 * Math.sin((u - 0.7) / 0.3 * Math.PI);
    const by = -38 - (walking ? wc.bob * 0.8 : br * 0.35) + drop;
    const hipY = by + 7, hipB = -17, hipF = 15;
    // nohy: diagonální páry; zadní mají hlezno (ohyb vpřed), přední koleno (ohyb vzad)
    let fnA = wc.legA, fnK = wc.kneeB, ffA = wc.legB, ffK = wc.kneeA;        // přední blízká / vzdálená
    let bnA = -0.22 + wc.legB, bnK = 0.35 + wc.kneeA, bfA = -0.22 + wc.legA, bfK = 0.35 + wc.kneeB; // zadní
    if (s < 0) { const k = -s; fnA = lerp(fnA, 0.9, k); fnK = lerp(fnK, 1.7, k); ffA = lerp(ffA, 0.7, k); ffK = lerp(ffK, 1.5, k); }
    if (u > 0) {
      fnA = lerp(fnA, 1.1, u); fnK = lerp(fnK, 2.2, u); ffA = lerp(ffA, 1.0, u); ffK = lerp(ffK, 2.2, u);
      bnA = lerp(bnA, -1.3, u); bnK = lerp(bnK, 2.5, u); bfA = lerp(bfA, -1.2, u); bfK = lerp(bfK, 2.5, u);
    }
    // ocas
    const sway = Math.sin(p.t * 2.3) * 3 + (walking ? Math.sin(p.walk * TAU) * 3 : 0);
    path(ctx, c => { c.moveTo(-24, by - 5); c.quadraticCurveTo(-38 + sway, by + 2, -34 + sway, by + 16); }, null, O, 6.5, true);
    path(ctx, c => { c.moveTo(-24, by - 5); c.quadraticCurveTo(-38 + sway, by + 2, -34 + sway, by + 16); }, null, mane, 4, true);
    // vzdálené nohy
    let e = limbO(ctx, hipB - 1.5, hipY, 15, 16, bfA, bfK, horseD, 4.6); hoof(ctx, e[2], e[3]);
    e = limbO(ctx, hipF - 1.5, hipY, 15, 16, ffA, -ffK, horseD, 4.6); hoof(ctx, e[2], e[3]);
    // tělo (zadek + hruď + trup), obrys a následné přetažení bez obrysu
    const bodyShapes = outline => {
      H.circle(ctx, -19, by - 1, 11.5, horse, outline, 3);
      H.circle(ctx, 17, by, 10.5, horse, outline, 3);
      H.ellipse(ctx, -2, by, 25, 12, horse, outline, 3);
    };
    bodyShapes(O); bodyShapes(null);
    H.ellipse(ctx, -4, by + 7, 18, 4, rgba("#000", 0.12));                 // stín břicha
    // čabraka v barvě týmu + třásně, sedlo
    H.rrect(ctx, -23, by - 11, 42, 22, 7, team, O, LW);
    path(ctx, c => { for (let x = -23; x < 19; x += 6) { c.moveTo(x, by + 11); c.lineTo(x + 3, by + 15); c.lineTo(x + 6, by + 11); } }, teamD, O, 1.1);
    H.circle(ctx, -14, by + 1, 3.2, teamL); H.circle(ctx, 9, by + 1, 3.2, teamL);
    H.rrect(ctx, -11, by - 15, 19, 7, 3, PAL.leather, O, LW);
    H.line(ctx, -1, by - 8, -1, by + 10, shade(PAL.leather, -0.3), 2);     // podbřišník
    // krk + hlava (při smrti klesá)
    ctx.save(); ctx.translate(14, by - 6);
    const nod = walking ? Math.sin(p.walk * TAU * 2) * 0.05 : br * 0.02;
    ctx.rotate(nod + (u > 0 ? 1.7 * ease.in(u) : 0) + (s < 0 ? 0.25 * s : 0));
    path(ctx, c => { c.moveTo(-5, 2); c.lineTo(8, -22); c.lineTo(19, -20); c.lineTo(12, 6); }, horse, O, LW);
    path(ctx, c => { c.moveTo(-5, 2); c.lineTo(8, -22); c.lineTo(19, -20); c.lineTo(12, 6); }, horse);
    path(ctx, c => { c.moveTo(-3, 0); c.quadraticCurveTo(2, -10, 6, -14); c.lineTo(10, -21); c.lineTo(7, -22); c.quadraticCurveTo(0, -12, -6, -1); }, mane, O, 1.2); // hříva
    H.circle(ctx, 17, -21, 6.2, horse, O, LW);
    H.ellipse(ctx, 25, -16.5, 7.5, 4.6, horse, O, LW, 0.55);
    H.circle(ctx, 17, -21, 6.2, horse); H.ellipse(ctx, 25, -16.5, 7.5, 4.6, horse, null, 0, 0.55);
    H.ellipse(ctx, 25, -16.5, 7.5, 4.6, null, null, 0, 0.55);
    path(ctx, c => { c.moveTo(13, -25); c.lineTo(11, -31); c.lineTo(16, -27); }, horse, O, 1.2);   // uši
    path(ctx, c => { c.moveTo(17, -26); c.lineTo(17, -32); c.lineTo(21, -27); }, horse, O, 1.2);
    H.circle(ctx, 19, -22.5, 1.2, O);                                                   // oko
    H.circle(ctx, 30, -14, 0.9, O);                                                     // nozdra
    H.line(ctx, 20, -16, 29, -12, PAL.leather, 1.4);                                    // uzda
    H.line(ctx, 29, -12, 0, 6, PAL.leather, 1.1);                                       // otěže
    ctx.restore();
    // blízké nohy
    e = limbO(ctx, hipB + 1.5, hipY, 15, 16, bnA, bnK, horse, 4.6); hoof(ctx, e[2], e[3]);
    e = limbO(ctx, hipF + 1.5, hipY, 15, 16, fnA, -fnK, horse, 4.6); hoof(ctx, e[2], e[3]);

    // ---- jezdec ----
    const kx = -2, ky = by - 11;                    // kyčel jezdce
    ctx.save(); ctx.translate(kx, ky); if (u > 0) ctx.rotate(fallAngle(u)); ctx.translate(-kx, -ky);
    // štít (vzdálená strana)
    path(ctx, c => { c.moveTo(-20, ky - 16); c.lineTo(-9, ky - 16); c.lineTo(-9, ky - 8); c.quadraticCurveTo(-9, ky, -14.5, ky + 1); c.quadraticCurveTo(-20, ky, -20, ky - 8); }, team, O, LW);
    path(ctx, c => { c.moveTo(-20, ky - 13); c.lineTo(-14.5, ky - 8); c.lineTo(-9, ky - 13); c.lineTo(-9, ky - 10); c.lineTo(-14.5, ky - 5); c.lineTo(-20, ky - 10); }, teamL);
    // blízká noha jezdce + třmen
    const kl = limbO(ctx, kx + 1, ky + 1, 9, 10, 1.05, -1.05, armor, 3.6);
    H.rrect(ctx, kl[2] - 2.5, kl[3] - 1, 6, 3, 1, armorD, O, 1);
    // trup + varkoč
    H.rrect(ctx, kx - 7, ky - 19, 14, 20, 4, armor, O, LW);
    H.rrect(ctx, kx - 5, ky - 17, 10, 16, 2, team, O, 1.1);
    H.line(ctx, kx - 4, ky - 15, kx + 4, ky - 3, teamL, 2);
    H.rrect(ctx, kx - 7.2, ky - 3, 14.4, 2.6, 1, PAL.leather, O, 1);
    H.circle(ctx, kx - 4, ky - 18, 3.4, armorL, O, 1.2);                   // nárameníky
    H.circle(ctx, kx + 4, ky - 18, 3.4, armorL, O, 1.2);
    // helma (kbelcová) s chocholem
    const hx = kx, hhy = ky - 25;
    path(ctx, c => { c.moveTo(hx - 6, hhy + 6); c.lineTo(hx - 6, hhy - 3); c.quadraticCurveTo(hx - 6, hhy - 7, hx, hhy - 7); c.quadraticCurveTo(hx + 6, hhy - 7, hx + 6, hhy - 3); c.lineTo(hx + 6, hhy + 6); }, armor, O, LW);
    H.line(ctx, hx - 4, hhy - 0.5, hx + 6, hhy - 0.5, O, 1.6);             // průzor
    H.line(ctx, hx + 1.5, hhy - 7, hx + 1.5, hhy + 5, armorD, 1);
    for (let i = 0; i < 3; i++) H.circle(ctx, hx + 2 + i * 1.6, hhy + 3, 0.5, O);
    path(ctx, c => { c.moveTo(hx - 1, hhy - 7); c.quadraticCurveTo(hx - 6 - plumeV * 3, hhy - 13, hx - 13, hhy - 6 + Math.sin(p.t * 3) * 1.2); c.quadraticCurveTo(hx - 6, hhy - 8, hx - 2, hhy - 5); }, team, O, 1.2);
    // blízká paže + dřevec
    let a1 = 0.6, a2 = 1.3, ld = 2.2;
    if (s < 0) { const k = -s; a1 = lerp(0.6, -0.4, k); a2 = lerp(1.3, 2.2, k); ld = lerp(2.2, 2.3, k); }
    else if (s > 0) { a1 = lerp(0.6, 1.3, s); a2 = lerp(1.3, 0.15, s); ld = lerp(2.2, 1.62, s); }
    if (u > 0) { a1 = lerp(a1, 0.9, u); a2 = lerp(a2, 0.6, u); ld = lerp(ld, 2.6, u); }
    const ae = limbO(ctx, kx + 5, ky - 17, 8, 8, a1, a2, armor, 3.6);
    const lx = ae[2], ly = ae[3], sn = Math.sin(ld), cs = Math.cos(ld), len = 31;
    lineO(ctx, lx - sn * 7, ly - cs * 7, lx + sn * len, ly + cs * len, PAL.woodLight, 2.4);
    H.circle(ctx, lx, ly, 3.4, armorD, O, 1.1);                            // záštita dřevce (vamplate)
    path(ctx, c => { c.moveTo(lx + sn * len, ly + cs * len); c.lineTo(lx + sn * (len - 4) - cs * 1.4, ly + cs * (len - 4) + sn * 1.4); c.lineTo(lx + sn * (len - 4) + cs * 1.4, ly + cs * (len - 4) - sn * 1.4); }, armorL, O, 1);
    const fl = Math.sin(p.t * 6) * 1.5;
    path(ctx, c => { const px = lx + sn * (len - 6), py = ly + cs * (len - 6); c.moveTo(px, py); c.lineTo(px - cs * 7 - sn * 4 + fl, py + sn * 7 - cs * 4); c.lineTo(px - sn * 6, py - cs * 6); }, team, O, 1);
    hand(ctx, lx, ly, armorL);
    ctx.restore();
    ctx.restore();
  });

  // =====================================================================
  //  VĚŽE
  // =====================================================================
  function wheel(ctx, x, y, r) {
    H.circle(ctx, x, y, r, PAL.woodDark, O, LW);
    ctx.strokeStyle = PAL.woodLight; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3; ctx.moveTo(x - Math.cos(a) * (r - 1.2), y - Math.sin(a) * (r - 1.2)); ctx.lineTo(x + Math.cos(a) * (r - 1.2), y + Math.sin(a) * (r - 1.2)); }
    ctx.stroke();
    H.circle(ctx, x, y, 1.5, O);
  }
  function flame(ctx, x, y, h, t, seed) {
    const f1 = 1 + Math.sin(t * 13 + seed) * 0.25, f2 = 1 + Math.sin(t * 17 + seed * 2) * 0.3;
    path(ctx, c => { c.moveTo(x - 4, y); c.quadraticCurveTo(x - 5, y - h * 0.5 * f1, x + Math.sin(t * 9 + seed) * 2, y - h * f1); c.quadraticCurveTo(x + 5, y - h * 0.5 * f2, x + 4, y); }, "#ff8a2a");
    path(ctx, c => { c.moveTo(x - 2, y); c.quadraticCurveTo(x - 2.5, y - h * 0.35 * f2, x + Math.sin(t * 11 + seed) * 1, y - h * 0.6 * f2); c.quadraticCurveTo(x + 2.5, y - h * 0.35 * f1, x + 2, y); }, "#ffe27a");
  }
  function catapult(ctx, p, fire) {
    const wood = fire ? "#6a4426" : PAL.wood, woodD = shade(wood, -0.3), woodL = shade(wood, 0.22);
    const rc = clamp(p.recoil || 0, 0, 1);
    const k = ease.inOut(rc);                                    // 1 = právě vystřelil (rameno vpředu)
    const ang = p.angle || 0;
    // míření: nabité rameno i poloha po výstřelu se natáčejí podle angle (záporné = výš)
    const armA = deg(lerp(-165 + ang * 0.55, -74 + ang * 0.9, k));
    const t = p.t || 0;
    // podvozek + kola
    H.rrect(ctx, -19, -4.5, 38, 5, 1.5, wood, O, LW);
    if (fire) { H.rrect(ctx, -12, -5, 3, 6, 0.5, PAL.metalDark); H.rrect(ctx, 9, -5, 3, 6, 0.5, PAL.metalDark); }
    wheel(ctx, -13, 0, 4.4); wheel(ctx, 13, 0, 4.4);
    // naviják vzadu + lano k rameni (jen když je nataženo)
    H.circle(ctx, -16, -8, 2.6, woodD, O, 1.2);
    // A-rám (vzdálenější vzpěry tmavší)
    lineO(ctx, -11, -3, -1, -23, woodD, 3);
    lineO(ctx, 9, -3, -1, -23, woodD, 3);
    H.rrect(ctx, -7, -25.5, 13, 3.5, 1.2, wood, O, 1.3);           // příčka (zarážka)
    // torzní svazek
    H.rrect(ctx, -8.5, -14.5, 13, 5, 2.5, "#cdb98f", O, 1.2);
    ctx.strokeStyle = rgba("#2b2320", 0.4); ctx.lineWidth = 1; ctx.beginPath();
    for (let x = -7; x < 4; x += 2.5) { ctx.moveTo(x, -14); ctx.lineTo(x + 1.5, -10); } ctx.stroke();
    // rameno
    const px = -2, py = -12, len = 18;
    const ex = px + Math.cos(armA) * len, ey = py + Math.sin(armA) * len;
    if (k < 0.5) H.line(ctx, -16, -8, ex, ey, "#d9cfb2", 1);        // lano navijáku
    lineO(ctx, px, py, ex, ey, woodL, 3.6);
    H.circle(ctx, px, py, 2.2, PAL.metalDark, O, 1.1);
    // lžíce/koš s projektilem
    ctx.save(); ctx.translate(ex, ey); ctx.rotate(armA + deg(75));
    path(ctx, c => { c.arc(0, 0, 4.6, Math.PI / 2, Math.PI * 1.5); }, fire ? PAL.metalDark : woodD, O, 1.3);
    if (fire) { H.line(ctx, -3, -3.5, -3, 3.5, PAL.metal, 1); }
    if (rc < 0.5) {
      if (fire) {
        H.circle(ctx, 0.5, 0, 5.5, rgba("#ff9a2e", 0.35 + Math.sin(t * 12) * 0.1));
        H.circle(ctx, 0.5, 0, 3.6, "#ff7a1a", O, 1); H.circle(ctx, -0.3, -0.8, 1.6, "#ffe27a");
      } else H.circle(ctx, 0.5, 0, 3.6, "#8d8d85", O, 1.2);
    }
    ctx.restore();
    // ohnivá varianta: koš se žhavým uhlím vpředu
    if (fire) {
      const gl = 0.5 + Math.sin(t * 9) * 0.12;
      H.circle(ctx, 17, -9, 9, H.radial(ctx, 17, -9, 1, 9, [[0, rgba("#ff9a2e", 0.5 * gl)], [1, rgba("#ff6a00", 0)]]));
      H.line(ctx, 13, -5, 15, 0, PAL.metalDark, 1.6); H.line(ctx, 21, -5, 19, 0, PAL.metalDark, 1.6);
      path(ctx, c => { c.moveTo(11, -9); c.quadraticCurveTo(17, -2, 23, -9); }, "#4a4a48", O, 1.3);
      H.circle(ctx, 14.5, -9.5, 1.6, "#ff6a1a"); H.circle(ctx, 17.5, -10, 1.8, "#ffb04a"); H.circle(ctx, 20, -9.5, 1.4, "#ff6a1a");
      flame(ctx, 17, -10, 8, t, 1.7);
    }
  }
  S.registerTurret("catapult", (ctx, p) => catapult(ctx, p, false));
  S.registerTurret("firecatapult", (ctx, p) => catapult(ctx, p, true));

  // Vroucí olej: kotel na čepech, při výstřelu se překlopí dopředu (neotáčí se podle angle)
  S.registerTurret("oil", function (ctx, p) {
    const t = p.t || 0;
    const tip = ease.inOut(clamp(p.recoil || 0, 0, 1));
    const rot = deg(105) * tip;
    const wood = PAL.wood, woodD = shade(wood, -0.3);
    // ohniště + podstavec
    H.rrect(ctx, -14, 1, 28, 4, 1.2, PAL.stoneDark, O, LW);
    H.circle(ctx, -6, 1, 2.6, "#4a3a2a", O, 1); H.circle(ctx, 0, 1.5, 2.8, "#4a3a2a", O, 1); H.circle(ctx, 6, 1, 2.6, "#4a3a2a", O, 1);
    H.circle(ctx, 0, -2, 9, H.radial(ctx, 0, -2, 1, 9, [[0, rgba("#ff9a2e", 0.45)], [1, rgba("#ff6a00", 0)]]));
    flame(ctx, -3, 0, 9, t, 0.4); flame(ctx, 3, 0, 8, t, 2.9);
    // rám: dvě vzpěry do čepu, horní trám
    lineO(ctx, -14, 3, -9, -14, woodD, 3); lineO(ctx, 14, 3, 9, -14, woodD, 3);
    lineO(ctx, -9, -14, -9, -29, wood, 3); lineO(ctx, 9, -14, 9, -29, wood, 3);
    H.rrect(ctx, -13, -31.5, 26, 4, 1.3, wood, O, LW);
    // kotel na čepu (0,-14)
    ctx.save(); ctx.translate(0, -14); ctx.rotate(rot);
    H.line(ctx, -8.5, -2, -17, -13, PAL.metalDark, 2.4);                  // páka pro překlopení
    H.circle(ctx, -17, -13, 2, PAL.woodLight, O, 1);
    path(ctx, c => { c.moveTo(-9.5, -8); c.quadraticCurveTo(-11, 9, 0, 9.5); c.quadraticCurveTo(11, 9, 9.5, -8); }, "#3f4246", O, LW);
    H.ellipse(ctx, 0, -8, 9.8, 2.6, "#5a5e63", O, LW);                    // okraj
    H.ellipse(ctx, 0, -8, 8.2, 1.7, "#1f1710");                           // hladina oleje
    for (let i = 0; i < 3; i++) {                                          // bubliny
      const b = (t * 1.7 + i * 0.37) % 1;
      H.circle(ctx, -5 + i * 5 + Math.sin(t * 3 + i) * 1.5, -8 - b * 1.2, 0.9 + (1 - b) * 0.8, rgba("#8a7a5a", 0.8 * (1 - b)));
    }
    H.line(ctx, -5, -2, -4, 5, "#6a6e73", 1.2);                            // odlesk
    H.circle(ctx, 0, 0, 1.6, PAL.metalLight, O, 1);                       // čep
    ctx.restore();
    // pára (jen když stojí) / proud oleje (když se vylévá)
    if (tip < 0.3) for (let i = 0; i < 3; i++) {
      const k = (t * 0.6 + i * 0.33) % 1;
      H.ellipse(ctx, -4 + i * 4 + Math.sin(t * 2 + i * 2) * 2, -25 - k * 9, 2.5 + k * 2, 1.6 + k, rgba("#ffffff", 0.35 * (1 - k) * (1 - tip / 0.3)));
    }
    if (tip > 0.35) {
      const a = (tip - 0.35) / 0.65;
      const c = Math.cos(rot), sn = Math.sin(rot);
      const rx = 9.5 * c + 8 * sn, ry = 9.5 * sn - 8 * c - 14;          // přední okraj po otočení
      ctx.strokeStyle = rgba("#1f1710", 0.9 * a); ctx.lineWidth = 3.5 * a; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.quadraticCurveTo(rx + 8, ry + 2, rx + 12, 6); ctx.stroke();
      H.circle(ctx, rx + 14 + Math.sin(t * 20) * 2, 2 + ((t * 8) % 4), 1.3, rgba("#1f1710", 0.8 * a));
    }
  });

  // =====================================================================
  //  ZÁKLADNA: kamenný hrad
  // =====================================================================
  function stoneWall(ctx, x, y, w, h, fill) {
    H.rrect(ctx, x, y, w, h, 2, fill, O, 2);
    ctx.strokeStyle = rgba("#2b2320", 0.2); ctx.lineWidth = 1; ctx.beginPath();
    let row = 0;
    for (let yy = y + 9; yy < y + h - 3; yy += 9, row++) {
      ctx.moveTo(x + 2, yy); ctx.lineTo(x + w - 2, yy);
      for (let xx = x + (row % 2 ? 7 : 14); xx < x + w - 3; xx += 14) { ctx.moveTo(xx, yy - 8); ctx.lineTo(xx, yy - 1); }
    }
    ctx.stroke();
  }
  function merlons(ctx, x, y, w, fill, hp) {
    const mw = 7, gap = 5, mh = 8;
    let i = 0;
    for (let xx = x; xx + mw <= x + w + 0.5; xx += mw + gap, i++) {
      if (hp < 0.5 && i % 3 === 1) { H.rrect(ctx, xx, y - 3, mw, 3.5, 1, fill, O, 1.4); continue; }
      H.rrect(ctx, xx, y - mh, mw, mh + 0.5, 1, fill, O, 1.4);
    }
  }
  function slit(ctx, x, y) { H.rrect(ctx, x - 1.2, y - 5, 2.4, 10, 1, "#2a2622"); H.rrect(ctx, x - 1.2, y - 1, 2.4, 2, 0, "#2a2622"); }
  function flag(ctx, x, y, w, h, col, t, lw) {
    const w1 = Math.sin(t * 5 + x * 0.1) * 2, w2 = Math.sin(t * 5 + 1.6 + x * 0.1) * 2.2;
    path(ctx, c => { c.moveTo(x, y); c.quadraticCurveTo(x + w * 0.5, y + w1, x + w, y + w2); c.lineTo(x + w * 0.72, y + h / 2 + w1); c.lineTo(x + w, y + h + w2); c.quadraticCurveTo(x + w * 0.5, y + h + w1, x, y + h); }, col, O, lw || 1.3);
  }
  function smoke(ctx, x, y, t, n, sc, alpha) {
    for (let i = 0; i < n; i++) {
      const k = (t * 0.3 + i * 0.41) % 1;
      H.circle(ctx, x + Math.sin(t * 1.1 + i * 2.1) * 5 * k + k * 12, y - k * 55 * sc, (3.5 + k * 9) * sc, rgba("#3a3a3a", alpha * (1 - k)));
    }
  }
  function cracks(ctx, pts, alpha) {
    ctx.strokeStyle = rgba("#1a1512", alpha); ctx.lineWidth = 1.4; ctx.lineJoin = "round"; ctx.beginPath();
    for (const pl of pts) { ctx.moveTo(pl[0], pl[1]); for (let i = 2; i < pl.length; i += 2) ctx.lineTo(pl[i], pl[i + 1]); }
    ctx.stroke();
  }
  S.registerBase("castle", function (ctx, p) {
    const t = p.t || 0, hp = p.hp === undefined ? 1 : p.hp;
    const slotY = p.slotY || D.SLOT_Y;
    const team = p.team || PAL.team[p.side ? 1 : 0], teamL = mix(team, "#ffffff", 0.45);
    const stone = PAL.stone, stoneL = "#a5a59c", keepCol = "#9a948a", towerCol = "#8f8f88", roof = "#7a3b3b";
    // patka
    H.rrect(ctx, -86, -7, 118, 8, 2, PAL.stoneDark, O, 2);
    // hlavní hradba s cimbuřím
    stoneWall(ctx, -84, -150, 90, 150, stone);
    merlons(ctx, -84, -150, 90, stone, hp);
    slit(ctx, -62, -80); slit(ctx, -30, -80); slit(ctx, -46, -120);
    // velký prapor na hradbě
    H.line(ctx, -70, -132, -46, -132, PAL.woodDark, 2.5);
    path(ctx, c => { const sw = Math.sin(t * 2.2) * 1.5; c.moveTo(-68, -131); c.lineTo(-48, -131); c.lineTo(-48 + sw, -92); c.lineTo(-58 + sw, -84); c.lineTo(-68 + sw, -92); }, team, O, 1.4);
    H.circle(ctx, -58, -112, 5, teamL); H.circle(ctx, -58, -112, 2.2, team);
    // hlavní věž (donjon) se střechou a vlajkou
    stoneWall(ctx, -64, -236, 48, 90, keepCol);
    merlons(ctx, -66, -236, 52, keepCol, hp);
    slit(ctx, -40, -180); slit(ctx, -40, -212);
    path(ctx, c => { c.moveTo(-68, -244); c.lineTo(-40, -284); c.lineTo(-12, -244); }, roof, O, LW);
    H.line(ctx, -55, -262, -40, -283, shade(roof, 0.25), 1.4);
    H.line(ctx, -40, -284, -40, -299, PAL.woodDark, 2);
    flag(ctx, -40, -299, 18, 9, team, t);
    // brána (gatehouse) – věž vpředu s ochozy pro věže
    stoneWall(ctx, 4, -246, 26, 246, towerCol);
    merlons(ctx, 4, -246, 26, towerCol, hp);
    slit(ctx, 17, -60); slit(ctx, 17, -150); slit(ctx, 17, -200);
    // dřevěná brána s obloukem
    path(ctx, c => { c.moveTo(9, 0); c.lineTo(9, -17); c.arc(17, -17, 8, Math.PI, TAU); c.lineTo(25, 0); }, PAL.woodDark, O, 2);
    ctx.strokeStyle = rgba("#000", 0.3); ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 12; x < 25; x += 3.5) { ctx.moveTo(x, -1); ctx.lineTo(x, -22); } ctx.stroke();
    H.rrect(ctx, 9.5, -14, 15, 2, 0.5, PAL.metalDark); H.rrect(ctx, 9.5, -6, 15, 2, 0.5, PAL.metalDark);
    path(ctx, c => { c.moveTo(7, -1); c.lineTo(7, -17); c.arc(17, -17, 10, Math.PI, TAU); c.lineTo(27, -1); }, null, O, 2.2, true);
    // louče u brány
    const fl = 0.8 + Math.sin(t * 11) * 0.2;
    H.line(ctx, 3, -30, 3, -24, PAL.woodDark, 2); H.circle(ctx, 3, -32, 5 * fl, rgba("#ffb04a", 0.25)); H.circle(ctx, 3, -31.5, 2.2, "#ffd27a", "#ff7a1a", 1.5);
    // praporek na věži
    H.line(ctx, 17, -246, 17, -268, PAL.woodDark, 2);
    flag(ctx, 17, -268, 13, 7, team, t + 1, 1.2);
    // ochozy (plošiny) pro věže
    for (let i = 0; i < Math.min(p.slots || 1, slotY.length); i++) {
      const sy = slotY[i];
      // podpěry: kamenné krakorce + dřevěná vzpěra
      lineO(ctx, 30, sy + 22, 70, sy + 5, PAL.wood, 3);
      path(ctx, c => { c.moveTo(30, sy + 4); c.lineTo(30, sy + 15); c.lineTo(41, sy + 4); }, stoneL, O, 1.3);
      path(ctx, c => { c.moveTo(44, sy + 4); c.lineTo(44, sy + 13); c.lineTo(54, sy + 4); }, stoneL, O, 1.3);
      path(ctx, c => { c.moveTo(57, sy + 4); c.lineTo(57, sy + 11); c.lineTo(66, sy + 4); }, stoneL, O, 1.3);
      H.rrect(ctx, 30, sy - 2, 44, 6, 1.5, stoneL, O, LW);
      H.line(ctx, 32, sy - 0.5, 72, sy - 0.5, "#c3c3ba", 1.2);
      H.line(ctx, 44, sy - 2, 44, sy + 4, rgba("#2b2320", 0.3), 1); H.line(ctx, 60, sy - 2, 60, sy + 4, rgba("#2b2320", 0.3), 1);
    }
    // poškození
    if (hp < 0.5) {
      cracks(ctx, [[-70, -150, -64, -130, -70, -112, -62, -95], [-20, -60, -28, -40, -22, -20, -30, -4], [17, -230, 12, -215, 19, -195], [-50, -236, -44, -220, -52, -205]], 0.55);
      smoke(ctx, -40, -270, t, 3, 1, 0.3);
      H.rrect(ctx, -22, -150, 10, 14, 1, PAL.stoneDark);                   // vylomený kus hradby
    }
    if (hp < 0.25) {
      cracks(ctx, [[-84, -100, -74, -80, -82, -60, -72, -30], [26, -120, 20, -100, 28, -75], [-12, -236, -18, -210, -10, -190]], 0.8);
      smoke(ctx, 17, -250, t + 2, 3, 0.8, 0.35);
      smoke(ctx, -46, -150, t + 4, 2, 0.7, 0.25);
      const g = 0.6 + Math.sin(t * 9) * 0.3;
      H.rrect(ctx, -41.5, -185.5, 3, 11, 1, rgba("#ffb04a", g));           // oheň za oknem
    }
  });

  // =====================================================================
  //  POZADÍ: středověká krajina
  // =====================================================================
  const A = PAL.ages[1];
  const BG = (() => {
    let sd = 20240601;
    const r = () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return sd / 4294967296; };
    const far = [], mid = [], near = [], forest = [], trees = [], clouds = [], pebbles = [], tufts = [];
    for (let x = -300; x < 1500; x += 165) far.push([x + r() * 60, 130 + r() * 70, 40 + r() * 28]);
    for (let x = -300; x < 1500; x += 125) mid.push([x + r() * 50, 95 + r() * 50, 24 + r() * 16]);
    for (let x = -300; x < 1500; x += 105) near.push([x + r() * 40, 80 + r() * 45, 13 + r() * 11]);
    for (let i = 0; i < 18; i++) forest.push([-120 + r() * 1400, r() * 10, 7 + r() * 7]);
    for (let i = 0; i < 9; i++) trees.push([-80 + r() * 1300, 9 + r() * 5, r()]);
    for (let i = 0; i < 5; i++) clouds.push([r() * 1200, 35 + r() * 90, 0.7 + r() * 0.8, 3 + r() * 4]);
    for (let i = 0; i < 16; i++) pebbles.push([r() * 1000, 431 + r() * 15, 1 + r() * 1.4]);
    for (let i = 0; i < 22; i++) tufts.push([r() * 1000, r() * 3]);
    return { far, mid, near, forest, trees, clouds, pebbles, tufts };
  })();
  const farCol = mix(A.hill[2], A.sky[1], 0.5), midCol = mix(A.hill[1], A.sky[1], 0.18), nearCol = A.hill[0];
  const forestCol = shade(midCol, -0.22), forestL = shade(midCol, -0.08);
  let gCtx = null, skyG = null, sunG = null;
  function hills(ctx, list, base, col) {
    ctx.fillStyle = col; ctx.beginPath();
    for (const [x, rx, ry] of list) ctx.ellipse(x, base, rx, ry, 0, 0, TAU);
    ctx.rect(-500, base, 2000, 430 - base);
    ctx.fill();
  }
  S.registerBackground("castle", function (ctx, p) {
    const t = p.t || 0, ls = p.layerShift || (() => 0);
    if (gCtx !== ctx) {
      gCtx = ctx;
      skyG = H.grad(ctx, 0, 0, 0, 425, [[0, A.sky[0]], [0.85, A.sky[1]]]);
      sunG = H.radial(ctx, 850, 60, 4, 75, [[0, "rgba(255,250,225,0.95)"], [0.2, "rgba(255,246,205,0.5)"], [1, "rgba(255,240,190,0)"]]);
    }
    ctx.fillStyle = skyG; ctx.fillRect(0, 0, 1000, 450);
    ctx.fillStyle = sunG; ctx.fillRect(770, -20, 160, 160);
    // mraky
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    for (const [cx, cy, sc, sp] of BG.clouds) {
      const x = ((cx + t * sp) % 1250) - 125;
      ctx.beginPath();
      ctx.ellipse(x, cy, 26 * sc, 9 * sc, 0, 0, TAU); ctx.ellipse(x - 14 * sc, cy + 3, 15 * sc, 7 * sc, 0, 0, TAU); ctx.ellipse(x + 15 * sc, cy + 2, 17 * sc, 8 * sc, 0, 0, TAU);
      ctx.fill();
    }
    // hejno ptáků
    ctx.strokeStyle = rgba("#3a4a5a", 0.5); ctx.lineWidth = 1.2; ctx.lineCap = "round"; ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const bx = ((300 + i * 13 + t * 9) % 1200) - 100, byy = 120 + i * 4 + Math.sin(t * 1.5 + i) * 3, fw = Math.sin(t * 7 + i) * 1.5;
      ctx.moveTo(bx - 4, byy - fw); ctx.lineTo(bx, byy + 1); ctx.lineTo(bx + 4, byy - fw);
    }
    ctx.stroke();
    // vzdálené kopce + silueta hradu
    ctx.save(); ctx.translate(ls(0.1), 0);
    hills(ctx, BG.far, 335, farCol);
    const cc = shade(farCol, -0.1);
    ctx.fillStyle = cc; ctx.beginPath();
    ctx.rect(545, 300, 100, 22);
    for (const tx of [545, 588, 633]) { ctx.rect(tx, 280, 12, 42); ctx.moveTo(tx - 1, 281); ctx.lineTo(tx + 6, 268); ctx.lineTo(tx + 13, 281); }
    ctx.rect(600, 286, 16, 36); ctx.moveTo(599, 287); ctx.lineTo(608, 272); ctx.lineTo(617, 287);
    ctx.fill();
    ctx.restore();
    // střední kopce s lesy
    ctx.save(); ctx.translate(ls(0.25), 0);
    hills(ctx, BG.mid, 372, midCol);
    for (const [x, dy, r] of BG.forest) { H.circle(ctx, x, 366 - dy, r, forestCol); H.circle(ctx, x - r * 0.25, 364 - dy - r * 0.2, r * 0.6, forestL); }
    ctx.restore();
    // blízké kopce: pole, stromy, větrný mlýn, plot
    ctx.save(); ctx.translate(ls(0.45), 0);
    hills(ctx, BG.near, 400, nearCol);
    for (const [fx, w] of [[110, 110], [430, 90], [690, 120]]) {
      path(ctx, c => { c.moveTo(fx, 412); c.lineTo(fx + w, 412); c.lineTo(fx + w - 22, 393); c.lineTo(fx + 22, 393); }, "#b9a461");
      ctx.strokeStyle = rgba("#6b5a2a", 0.35); ctx.lineWidth = 1.2; ctx.beginPath();
      for (let i = 1; i < 6; i++) { const y = 393 + i * 3.2; const k = (y - 393) / 19; ctx.moveTo(fx + 22 - 22 * k, y); ctx.lineTo(fx + w - 22 + 22 * k, y); }
      ctx.stroke();
    }
    // mlýn
    H.rrect(ctx, 866, 374, 18, 36, 2, "#b9a98a", rgba("#2b2320", 0.5), 1.2);
    path(ctx, c => { c.moveTo(862, 376); c.lineTo(875, 364); c.lineTo(888, 376); }, "#7a4a3a", rgba("#2b2320", 0.5), 1.2);
    ctx.save(); ctx.translate(875, 370); ctx.rotate(t * 0.7);
    ctx.strokeStyle = "#5a4a3a"; ctx.lineWidth = 1.6; ctx.beginPath();
    for (let i = 0; i < 4; i++) { ctx.moveTo(0, 0); ctx.lineTo(0, -18); ctx.moveTo(2.5, -5); ctx.lineTo(2.5, -17); ctx.rotate(Math.PI / 2); }
    ctx.stroke(); ctx.restore();
    // stromy
    for (const [x, h, v] of BG.trees) {
      H.rrect(ctx, x - 1.5, 420 - h * 1.6, 3, h * 1.6, 1, "#5a4030");
      H.circle(ctx, x, 418 - h * 1.7, h, shade(nearCol, -0.3), rgba("#2b2320", 0.35), 1);
      H.circle(ctx, x - h * 0.25, 416 - h * 1.95, h * 0.62, v > 0.5 ? shade(nearCol, -0.12) : shade(nearCol, -0.2));
    }
    // plot
    ctx.strokeStyle = "#6e5a3e"; ctx.lineWidth = 1.5; ctx.beginPath();
    for (let x = 300; x < 400; x += 11) { ctx.moveTo(x, 420); ctx.lineTo(x, 409); }
    ctx.moveTo(298, 413); ctx.lineTo(402, 413); ctx.moveTo(298, 417.5); ctx.lineTo(402, 417.5); ctx.stroke();
    ctx.restore();
    // země: tráva, okraj, cesta
    ctx.fillStyle = A.ground; ctx.fillRect(0, 425, 1000, 25);
    ctx.fillStyle = A.groundTop; ctx.fillRect(0, 419, 1000, 8);
    ctx.fillStyle = shade(A.groundTop, -0.25); ctx.fillRect(0, 425, 1000, 1.5);
    ctx.fillStyle = shade(A.ground, 0.18); ctx.fillRect(0, 432, 1000, 10);
    ctx.strokeStyle = rgba("#2b2320", 0.22); ctx.lineWidth = 1; ctx.setLineDash([9, 7]); ctx.beginPath();
    ctx.moveTo(0, 434.5); ctx.lineTo(1000, 434.5); ctx.moveTo(4, 440.5); ctx.lineTo(1000, 440.5); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = shade(A.ground, -0.25);
    for (const [x, y, r] of BG.pebbles) { ctx.beginPath(); ctx.ellipse(x, y, r * 1.3, r * 0.8, 0, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = shade(A.groundTop, -0.3); ctx.lineWidth = 1.2; ctx.beginPath();
    for (const [x, k] of BG.tufts) { ctx.moveTo(x, 420); ctx.lineTo(x - 1.5, 416 - k); ctx.moveTo(x + 1, 420); ctx.lineTo(x + 2.5, 416.5 - k); }
    ctx.stroke();
  });
})();
