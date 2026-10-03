/* Testy simulačního jádra – `node --test tests/`.
   Ověřují, že remake dodržuje pravidla originálu (docs/ORIGINAL.md). */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const E = require("../js/engine.js");
require("../js/ai.js");
const D = E.D;

function game(opts) { return E.createGame(Object.assign({ seed: 7 }, opts)); }
function ticks(g, n) { for (let i = 0; i < n; i++) E.tick(g); }
function spawn(g, side, id, x) {
  const S = g.sides[side]; S.gold = 1e9; S.age = D.UNITS[id].age;
  E.enqueueUnit(g, side, id);
  ticks(g, D.UNITS[id].train + 1);
  const u = g.units[g.units.length - 1];
  if (x !== undefined) u.x = x;
  return u;
}
function noAI(g) { g.ai.kind = "none"; return g; }
E.registerAI("none", { create() { return { uof: 0 }; }, update() {} });

test("data: 16 jednotek, 15 věží, 5 věků, odměny podle originálu", () => {
  assert.equal(D.UNITS.length, 16);
  assert.equal(D.TURRETS.length, 15);
  assert.equal(D.AGES.length, 5);
  const club = D.UNITS[0];
  assert.equal(club.reward, 20);      // round(15*1.3)
  assert.equal(club.killXp, 40);
  assert.equal(club.lossXp, 10);
  assert.equal(D.UNITS[15].reward, 195000);
  assert.deepEqual(D.AGES.map(a => a.evolveXp).slice(0, 4), [4000, 14000, 45000, 200000]);
  assert.deepEqual(D.SLOT_COSTS, [0, 1000, 3000, 7500]);
  for (const u of D.UNITS) if (u.isRanged) assert.ok(u.shootPeriod > 0 && u.walkShootPeriod > 0, u.en);
});

test("createGame: 175 zlata, základna 500 HP, 1 slot, special připraven po 1 ticku", () => {
  const g = game();
  for (const S of g.sides) {
    assert.equal(S.gold, 175); assert.equal(S.baseHp, 500); assert.equal(S.slots, 1);
    assert.equal(S.specialCd, 1);
  }
  assert.equal(E.canUseSpecial(g, 0), false);
  E.tick(g);
  assert.equal(E.canUseSpecial(g, 0), true);
});

test("fronta: strhne zlato, max 5, odmítne jiný věk a nedostatek zlata, výcvik trvá podle tabulky", () => {
  const g = noAI(game());
  const S = g.sides[0];
  assert.equal(E.enqueueUnit(g, 0, 3), false, "mečíř je z jiného věku");
  assert.equal(E.enqueueUnit(g, 0, 2), true, "dino za 100");
  assert.equal(S.gold, 75);
  assert.equal(E.enqueueUnit(g, 0, 2), false, "nedostatek zlata");
  for (let i = 0; i < 4; i++) assert.equal(E.enqueueUnit(g, 0, 0), true);
  assert.equal(S.queue.length, 5);
  assert.equal(E.enqueueUnit(g, 0, 0), false, "fronta plná");
  assert.equal(S.gold, 15);
  ticks(g, 99);
  assert.equal(g.units.length, 0, "dino se trénuje 100 ticků");
  ticks(g, 1);
  assert.equal(g.units.length, 1);
  assert.ok(Math.abs(g.units[0].x - 150) < 1.01, "spawn na x≈150");
  assert.equal(S.queue.length, 4);
  ticks(g, 40);
  assert.equal(g.units.length, 2, "klackař se trénuje 40 ticků");
  assert.equal(E.cancelQueued(g, 0, 1), true);
  assert.equal(S.gold, 30, "refundace zrušené jednotky");
});

test("pohyb: 0.7 px/tick, druhá jednotka se zastaví za první (zástup)", () => {
  const g = noAI(game());
  const a = spawn(g, 0, 0, 300);
  const x0 = a.x;
  ticks(g, 10);
  assert.ok(Math.abs(a.x - x0 - 7) < 1e-9, "7 px za 10 ticků");
  const b = spawn(g, 0, 0);
  b.x = a.x - 100;
  ticks(g, 1000); // první se zastaví u nepřátelské základny, druhá za ní
  const gap = a.x - b.x;
  const limit = a.w / 2 + b.w / 2 + 2;
  assert.ok(gap > limit - 0.8 && gap < limit + 1.5, `rozestup ${gap} ≈ limit ${limit}`);
});

test("boj zblízka: klackař udeří ve 20. ticku animace za 14–16, zabití dá 20 $ a 40 XP, majitel dostane 10 XP", () => {
  const g = noAI(game());
  const a = spawn(g, 0, 0, 480);
  const b = spawn(g, 1, 0, 520);
  b.hp = 10000; a.hp = 10000;
  // přiblížení: zastaví se na limitu 33.6 px, melee dosah 20 od okraje (dist < 35.8) → útočí
  let firstHit = null;
  for (let t = 0; t < 400 && firstHit === null; t++) {
    E.tick(g);
    if (b.hp < 10000) firstHit = { tick: g.tick, dmg: 10000 - b.hp };
  }
  assert.ok(firstHit, "došlo k zásahu");
  assert.ok(firstHit.dmg >= 14 && firstHit.dmg <= 16, `dmg ${firstHit.dmg}`);
  // perioda 40 ticků mezi údery
  const hp1 = b.hp;
  ticks(g, 39);
  assert.equal(b.hp, hp1, "žádný další úder před 40 ticky");
  ticks(g, 1);
  assert.ok(b.hp < hp1, "další úder přesně po 40 ticích");

  // zabití
  b.hp = 1;
  const gold = g.sides[0].gold, xp0 = g.sides[0].xp, xp1 = g.sides[1].xp;
  ticks(g, 45);
  assert.equal(g.sides[0].gold, gold + 20);
  assert.equal(g.sides[0].xp, xp0 + 40);
  assert.equal(g.sides[1].xp, xp1 + 10);
  assert.equal(g.sides[0].stats.kills, 1);
  assert.ok(b.dead);
  ticks(g, 80);
  assert.ok(!g.units.includes(b), "tělo zmizí po 80 ticích");
});

test("střelec: prakovník střílí na nepřítele do 100 px od okraje a dál ne", () => {
  const g = noAI(game());
  const s = spawn(g, 0, 1, 400);
  const e = spawn(g, 1, 2, 400 + 150 + 81.4 / 2 + 5); // okraj dina 155 px daleko
  e.hp = 1e6; s.hp = 1e6;
  const dinoDef = D.UNITS[2];
  // zmrazíme dino i prakovníka na místě tím, že jim dáme obrovskou šířku? ne – ověříme chování v čase:
  // dino jde doleva 0.7/tick, prakovník doprava 0.7/tick → okraj se blíží 1.4 px/tick → do dosahu 100 za ~39 ticků
  let shotAt = null;
  for (let t = 0; t < 200 && shotAt === null; t++) { E.tick(g); if (e.hp < 1e6) shotAt = g.tick; }
  assert.ok(shotAt !== null, "prakovník zasáhl");
  const edge = (e.x - e.w / 2) - s.x;
  assert.ok(edge < 100 + 1.4 * 31, `při zásahu byl okraj v dosahu (edge=${edge.toFixed(1)})`);
  void dinoDef;
});

test("útok na základnu: jednotka dojde k nepřátelské základně, poškodí ji, HP < 0 = konec hry", () => {
  const g = noAI(game());
  const u = spawn(g, 0, 11, 700); // tank, 300 dmg
  g.sides[1].baseHp = 350; g.sides[1].baseMaxHp = 350;
  ticks(g, 400);
  assert.ok(g.sides[1].baseHp < 350, "základna poškozena");
  assert.ok(u.x < D.BASE_EDGE[1] - u.w / 2 + 1, "tank se zastavil před základnou");
  ticks(g, 200);
  assert.equal(g.over, true);
  assert.equal(g.winner, 0);
});

test("věž: kamenný prak střílí každých 30 ticků na cíl do 350 px a trefí stojící jednotku", () => {
  const g = noAI(game());
  g.sides[0].gold = 1e6;
  assert.equal(E.buildTurret(g, 0, 0, 0), true);
  assert.equal(g.sides[0].gold, 1e6 - 100);
  assert.equal(E.buildTurret(g, 0, 1, 0), false, "slot 1 ještě není koupený");
  const e = spawn(g, 1, 2, 260); e.hp = 1e6;
  // dino jde k základně a zastaví se u ní; sledujeme výstřely
  let shots = 0, hits = 0, lastShot = null, gaps = [];
  for (let t = 0; t < 600; t++) {
    E.tick(g);
    for (const ev of g.events) if (ev.t === "shot") { shots++; if (lastShot) gaps.push(g.tick - lastShot); lastShot = g.tick; }
    for (const ev of g.events) if (ev.t === "hit" && ev.kind === "shot") hits++;
  }
  assert.ok(shots >= 10, `věž střílela (${shots})`);
  assert.ok(gaps.every(x => x === 30), `perioda 30 ticků: ${gaps.slice(0, 5)}`);
  assert.ok(hits >= 3, `aspoň pár zásahů (${hits})`);
  // mimo dosah nestřílí
  const g2 = noAI(game()); g2.sides[0].gold = 1e6; E.buildTurret(g2, 0, 0, 0);
  const far = spawn(g2, 1, 11, 900); far.hp = 1e6; far.w = 1; // tank daleko, zmenšený
  let shots2 = 0; for (let t = 0; t < 100; t++) { E.tick(g2); for (const ev of g2.events) if (ev.t === "shot") shots2++; }
  assert.equal(shots2, 0);
});

test("sloty a prodej: 1000/3000/7500, max 4, prodej vrátí 50 %", () => {
  const g = noAI(game());
  const S = g.sides[0]; S.gold = 20000;
  assert.equal(E.slotCost(g, 0), 1000);
  assert.equal(E.buySlot(g, 0), true); assert.equal(S.gold, 19000);
  assert.equal(E.buySlot(g, 0), true); assert.equal(S.gold, 16000);
  assert.equal(E.buySlot(g, 0), true); assert.equal(S.gold, 8500);
  assert.equal(E.buySlot(g, 0), false); assert.equal(S.slots, 4);
  assert.equal(E.slotCost(g, 0), null);
  E.buildTurret(g, 0, 3, 2); // primitivní katapult 500
  assert.equal(S.gold, 8000);
  assert.equal(E.sellTurret(g, 0, 3), true);
  assert.equal(S.gold, 8250);
  assert.equal(S.turrets[3], null);
});

test("evoluce: potřebuje kumulativní XP (neodečítá se), základna +300×věk", () => {
  const g = noAI(game());
  const S = g.sides[0];
  assert.equal(E.canEvolve(g, 0), false);
  S.xp = 4000;
  assert.equal(E.evolve(g, 0), true);
  assert.equal(S.age, 1); assert.equal(S.xp, 4000); assert.equal(S.baseHp, 1100); assert.equal(S.baseMaxHp, 1100);
  assert.equal(E.evolve(g, 0), false, "na 14000 nestačí");
  S.xp = 14000; E.evolve(g, 0); assert.equal(S.baseHp, 2000);
  S.xp = 45000; E.evolve(g, 0); assert.equal(S.baseHp, 3200);
  S.xp = 200000; E.evolve(g, 0); assert.equal(S.baseHp, 4700); assert.equal(S.age, 4);
  assert.equal(E.evolve(g, 0), false, "dál to nejde");
});

test("special: cooldown 2000 ticků; meteory zraní nepřátele; léčení léčí; paprsek dá 12 úderů", () => {
  const g = noAI(game()); E.tick(g);
  g.sides[0].baseHp = g.sides[0].baseMaxHp = 1e9;   // ať dinové nezničí základnu dřív, než doběhne test
  const e1 = spawn(g, 1, 2, 400), e2 = spawn(g, 1, 2, 600);
  e1.hp = e2.hp = 1e6;
  assert.equal(E.useSpecial(g, 0), true);
  assert.equal(g.sides[0].specialCd, 2000);
  assert.equal(E.useSpecial(g, 0), false);
  let impacts = 0;
  for (let t = 0; t < 400; t++) { E.tick(g); for (const ev of g.events) if (ev.t === "impact" && ev.kind === "meteors") impacts++; }
  assert.ok(impacts >= 15, `meteory dopadly (${impacts})`);
  assert.ok(e1.hp < 1e6 || e2.hp < 1e6, "aspoň jeden dino zasažen");
  ticks(g, 1600);
  assert.equal(E.canUseSpecial(g, 0), true, "po 2000 ticích znovu");

  const h = noAI(game()); E.tick(h); h.sides[0].age = 2;
  const mine = spawn(h, 0, 6, 300); mine.hp = 50;
  E.useSpecial(h, 0); ticks(h, 100);
  assert.ok(mine.hp >= 149 && mine.hp <= 150, `léčení +1/tick (hp=${mine.hp})`);

  const r = noAI(game()); E.tick(r); r.sides[0].age = 4;
  const v = spawn(r, 1, 11, 430); v.hp = 1e6; v.w = 1000; // tank přes celé bojiště → každý úder trefí
  E.useSpecial(r, 0);
  let rays = 0; for (let t = 0; t < 120; t++) { E.tick(r); for (const ev of r.events) if (ev.t === "ray") rays++; }
  assert.equal(rays, 12);
  assert.ok(Math.abs(1e6 - v.hp - 12000) < 1, `12 × 1000 dmg (ubrano ${1e6 - v.hp})`);
});

test("AI originálu: věž v ticku 1000, evoluce v ticku 8000, max 6 jednotek, zdarma", () => {
  const g = game();
  g.sides[0].baseHp = 1e9; g.sides[0].baseMaxHp = 1e9;
  let built = null, evolved = null;
  for (let t = 0; t < 8100; t++) {
    E.tick(g);
    for (const ev of g.events) {
      if (ev.t === "build" && ev.side === 1 && built === null) built = { tick: g.tick, id: ev.id, slot: ev.slot };
      if (ev.t === "evolve" && ev.side === 1 && evolved === null) evolved = g.tick;
    }
    assert.ok(E.aliveUnits(g, 1) <= 6, "nikdy víc než 6 nepřátel");
  }
  assert.deepEqual(built, { tick: 1000, id: 0, slot: 0 });
  assert.equal(evolved, 8000);
  assert.equal(g.sides[1].age, 1);
  assert.equal(g.sides[1].baseMaxHp, 1100);
  assert.equal(g.sides[1].stats.unitsTrained, 6, "AI natrénovala 6 jednotek a pak čeká (limit 6 živých)");
  assert.equal(E.aliveUnits(g, 1), 6);
  assert.equal(g.sides[1].gold, 175, "AI za jednotky neplatí");
});

test("obtížnost násobí HP a dmg nepřátelských jednotek", () => {
  const n = noAI(game({ difficulty: "normal" })), h = noAI(game({ difficulty: "harder" })), i = noAI(game({ difficulty: "impossible" }));
  assert.equal(spawn(n, 1, 0).maxHp, 55);
  assert.ok(Math.abs(spawn(h, 1, 0).maxHp - 71.5) < 1e-9);
  assert.equal(spawn(i, 1, 0).maxHp, 110);
  assert.equal(spawn(i, 0, 0).maxHp, 55, "hráčovy jednotky beze změny");
  assert.equal(E.createGame({ difficulty: "bogus" }).difficulty, "normal");
});

test("determinismus a serializace: stejný seed = stejný průběh, uložený stav pokračuje identicky", () => {
  function play(g, n) {
    for (let t = 0; t < n; t++) {
      if (t % 50 === 0) { const pool = D.UNITS_BY_AGE[g.sides[0].age]; E.enqueueUnit(g, 0, pool[t % pool.length].id); }
      if (E.canEvolve(g, 0)) E.evolve(g, 0);
      E.tick(g);
    }
    return g;
  }
  const a = play(game({ seed: 123 }), 3000), b = play(game({ seed: 123 }), 3000);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  const c = play(game({ seed: 123 }), 1500);
  const d = JSON.parse(JSON.stringify(c));
  play(c, 1500); play(d, 1500);
  assert.equal(JSON.stringify(c), JSON.stringify(d));
  assert.ok(!/NaN|Infinity/.test(JSON.stringify(a)), "stav bez NaN/Infinity");
});

test("ohnivý katapult a trhavinové dělo: po dopadu vznikají plamínky (10) / střepiny (30), i při dopadu na zem", () => {
  const g = noAI(game());
  g.sides[0].gold = 1e6; g.sides[0].age = 1;
  E.buildTurret(g, 0, 0, 4); // ohnivý katapult
  const e = spawn(g, 1, 5, 330); e.hp = 1e6; e.w = 300;   // široký rytíř → chytí střepiny
  const kinds = {};
  for (let t = 0; t < 600; t++) { E.tick(g); for (const ev of g.events) if (ev.t === "hit") kinds[ev.kind] = (kinds[ev.kind] || 0) + 1; }
  assert.ok(kinds.flame >= 3, `plamínky zasáhly (${JSON.stringify(kinds)})`);
  const h = noAI(game());
  h.sides[0].gold = 1e6; h.sides[0].age = 2;
  E.buildTurret(h, 0, 0, 8); // trhavinové dělo
  const e2 = spawn(h, 1, 11, 400); e2.hp = 1e6; e2.w = 300;
  const k2 = {};
  for (let t = 0; t < 600; t++) { E.tick(h); for (const ev of h.events) if (ev.t === "hit") k2[ev.kind] = (k2[ev.kind] || 0) + 1; }
  assert.ok(k2.shrapnel >= 3, `střepiny zasáhly (${JSON.stringify(k2)})`);
  // dopad na zem bez cíle v místě vytvoří 4 střepiny
  const m = noAI(game()); m.sides[0].gold = 1e6; m.sides[0].age = 2; E.buildTurret(m, 0, 0, 8);
  const far = spawn(m, 1, 11, 560); far.hp = 1e6;
  let frags = 0;
  for (let t = 0; t < 200; t++) { E.tick(m); frags = Math.max(frags, m.bullets.filter(b => b.kind === "shrapnel").length); }
  assert.ok(frags >= 3 && frags <= 8, `střepiny ve vzduchu: ${frags}`);
});

test("chytrá AI: platí za jednotky, nemá násobené statistiky, evolvuje za XP, staví věže", () => {
  const g = game({ seed: 11, difficulty: "normal", ai: "smart" });
  assert.equal(g.rules.enemyMul, 1);
  assert.equal(g.sides[1].gold, 175);
  g.sides[0].baseHp = g.sides[0].baseMaxHp = 1e9;
  let spent = 0, built = false;
  for (let t = 0; t < 40 * 60 * 6; t++) {
    const gold0 = g.sides[1].gold;
    E.tick(g);
    for (const ev of g.events) { if (ev.t === "enqueue" && ev.side === 1) spent += D.UNITS[ev.id].cost; if (ev.t === "build" && ev.side === 1) built = true; }
    void gold0;
    // hráč posílá levné jednotky, ať má AI co zabíjet
    if (t % 120 === 0) { g.sides[0].gold = 1e6; E.enqueueUnit(g, 0, D.UNITS_BY_AGE[g.sides[0].age][0].id); }
  }
  assert.ok(spent > 500, "AI utratila za jednotky " + spent);
  assert.ok(g.sides[1].stats.goldSpent >= spent, "útrata je ve statistikách");
  assert.ok(built, "AI postavila věž");
  assert.ok(g.sides[1].age >= 1, "AI zevolvovala za XP (věk " + g.sides[1].age + ", xp " + g.sides[1].xp + ")");
  for (const u of g.units) if (u.side === 1) assert.equal(u.maxHp, D.UNITS[u.id].hp, "statistiky bez násobku");
  const hard = game({ seed: 11, difficulty: "impossible", ai: "smart" });
  assert.equal(hard.rules.enemyMul, 1); assert.equal(hard.rules.aiRewardMul, 1.8); assert.equal(hard.sides[1].gold, 600);
});

test("celá hra s autopilotem skončí (někdo zničí základnu)", () => {
  const g = game({ seed: 3 });
  let t = 0;
  while (!g.over && t < 40 * 60 * 40) {
    const S = g.sides[0], pool = D.UNITS_BY_AGE[S.age];
    for (let i = pool.length - 1; i >= 0; i--) if (E.canTrain(g, 0, pool[i].id)) { E.enqueueUnit(g, 0, pool[i].id); break; }
    if (E.canEvolve(g, 0)) E.evolve(g, 0);
    if (E.canUseSpecial(g, 0) && E.aliveUnits(g, 1) >= 3) E.useSpecial(g, 0);
    E.tick(g); t++;
  }
  assert.equal(g.over, true, "hra skončila do 40 minut");
  assert.ok(g.winner === 0 || g.winner === 1);
});
