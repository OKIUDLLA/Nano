/* Testy herního jádra – běží přes vestavěný `node --test`.
   Ověřují ekonomiku, souboj, věže, evoluci a determinismus.        */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const E = require("../js/engine.js");

test("createGame má konzistentní výchozí stav", () => {
  const g = E.createGame({ seed: 1 });
  assert.equal(g.gold, 80);
  assert.equal(g.age, 0);
  assert.equal(g.playerBaseHp, E.BASE_MAX_HP);
  assert.equal(g.enemyBaseHp, E.BASE_MAX_HP);
  assert.deepEqual(g.units, []);
  assert.equal(g.over, false);
});

test("nákup jednotky strhne zlato a přidá jednotku", () => {
  const g = E.createGame({ seed: 1 });
  const before = g.gold;
  const ok = E.buyUnit(g, "player", 0);
  assert.equal(ok, true);
  assert.equal(g.units.length, 1);
  assert.equal(g.units[0].side, "player");
  assert.equal(g.gold, before - E.UNITS[0][0].cost);
});

test("nelze koupit jednotku bez dostatku zlata", () => {
  const g = E.createGame({ seed: 1 });
  g.gold = 0;
  assert.equal(E.buyUnit(g, "player", 0), false);
  assert.equal(g.units.length, 0);
});

test("souboj ubírá HP a zabití dává zlato i XP", () => {
  const g = E.createGame({ seed: 1 });
  // postavíme proti sobě hráčovu a nepřátelskou jednotku v dosahu
  g.enemyGold = 1000;
  E.buyUnit(g, "player", 0);
  E.buyUnit(g, "enemy", 0);
  assert.equal(g.units.length, 2);
  g.units[0].x = 470;
  g.units[1].x = 490;
  g.enemyGold = 0;
  const goldBefore = g.gold;
  // simulujeme dokud někdo nepadne
  let guard = 0;
  while (g.units.length === 2 && guard < 5000) { E.update(g, 0.1); guard++; }
  assert.ok(guard < 5000, "souboj se vyřešil v rozumném čase");
  assert.ok(g.units.length < 2, "alespoň jedna jednotka padla");
  assert.ok(g.gold >= goldBefore, "zlato po souboji nekleslo pod původní");
});

test("evoluce vyžaduje XP a posune věk", () => {
  const g = E.createGame({ seed: 1 });
  assert.equal(E.evolve(g), false, "bez XP nejde evolvovat");
  g.xp = E.AGES[0].evolveCost;
  assert.equal(E.evolve(g), true);
  assert.equal(g.age, 1);
  assert.equal(g.xp, 0);
});

test("věž stojí zlato, má limit a střílí na nepřátele", () => {
  const g = E.createGame({ seed: 1 });
  g.gold = 100000;
  const cost0 = E.towerCost(g, "player");
  assert.equal(E.buyTower(g, "player"), true);
  assert.equal(E.towerCount(g, "player"), 1);
  // další věž je dražší
  assert.ok(E.towerCost(g, "player") > cost0);
  // limit věží
  for (let i = 0; i < 10; i++) E.buyTower(g, "player");
  assert.equal(E.towerCount(g, "player"), E.MAX_TOWERS);

  // věž zraní nepřítele v dosahu
  g.enemyGold = 1000;
  E.buyUnit(g, "enemy", 2); // odolný mamut
  assert.equal(g.units.length, 1);
  g.units[0].x = E.BASE_W + 40;
  const hpBefore = g.units[0].hp;
  for (let i = 0; i < 20; i++) E.update(g, 0.1);
  assert.ok(g.units[0] === undefined || g.units[0].hp < hpBefore, "věž ubrala HP nepříteli");
});

test("meteor zraní všechny nepřátele a má cooldown", () => {
  const g = E.createGame({ seed: 1 });
  E.buyUnit(g, "enemy", 0);
  E.buyUnit(g, "enemy", 0);
  const hp0 = g.units.map(u => u.hp);
  assert.equal(E.special(g), true);
  g.units.forEach((u, i) => assert.ok(u.hp < hp0[i]));
  assert.ok(g.specialCd > 0);
  assert.equal(E.special(g), false, "meteor nelze hned znovu");
});

test("stejný seed dává shodný průběh (determinismus)", () => {
  function run() {
    const g = E.createGame({ seed: 42 });
    for (let i = 0; i < 300; i++) E.update(g, 0.1);
    return { gold: Math.round(g.gold), units: g.units.length, ehp: Math.round(g.enemyBaseHp), php: Math.round(g.playerBaseHp), eage: g.enemyAge };
  }
  assert.deepEqual(run(), run());
});

test("obtížnost: výchozí je normal a neznámá hodnota spadne na normal", () => {
  assert.equal(E.createGame({ seed: 1 }).difficulty, "normal");
  assert.equal(E.createGame({ seed: 1, difficulty: "bogus" }).difficulty, "normal");
  assert.equal(E.createGame({ seed: 1, difficulty: "hard" }).difficulty, "hard");
});

test("obtížnost: hard nechá AI postupovat věky rychleji než easy", () => {
  function run(diff, steps) {
    const g = E.createGame({ seed: 5, difficulty: diff });
    g.playerBaseHp = 1e9; // ať hra neskončí a můžeme srovnat tempo
    for (let i = 0; i < steps; i++) E.update(g, 0.1);
    return g;
  }
  const easy = run("easy", 1300);
  const hard = run("hard", 1300);
  assert.ok(hard.enemyAge > easy.enemyAge,
    `hard věk ${hard.enemyAge} má být > easy věk ${easy.enemyAge}`);
});

test("statistiky zápasu se počítají (jednotky, věže, killy, zlato)", () => {
  const g = E.createGame({ seed: 1 });
  g.gold = 100000;
  assert.deepEqual(g.stats, { kills: 0, goldEarned: 0, unitsSent: 0, towersBuilt: 0 });
  E.buyUnit(g, "player", 0);
  E.buyUnit(g, "player", 1);
  assert.equal(g.stats.unitsSent, 2);
  E.buyTower(g, "player");
  assert.equal(g.stats.towersBuilt, 1);
  // nepřátelská jednotka zemře → kill + zlato
  g.enemyGold = 1000;
  E.buyUnit(g, "enemy", 0);
  const enemy = g.units.find(u => u.side === "enemy");
  enemy.hp = 0;
  E.update(g, 0.016);
  assert.equal(g.stats.kills, 1);
  assert.ok(g.stats.goldEarned > 0);
});

test("seedovaná hra s autopilotem doběhne do terminálního stavu", () => {
  const g = E.createGame({ seed: 7 });
  g.auto = true;
  g.autoUnit = 0;
  let t = 0;
  // hraje 10 minut herního času; AI i hráč spawnují → základna musí padnout
  while (!g.over && t < 6000) { E.update(g, 0.1); t++; }
  assert.equal(g.over, true, "hra skončila");
  assert.ok(g.won === true || g.won === false);
  assert.ok(g.playerBaseHp <= 0 || g.enemyBaseHp <= 0);
});
