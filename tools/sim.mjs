/* Simulační balanc: odehraje N her bez prohlížeče pro různé strategie hráče × AI × obtížnost.
   Použití: node tools/sim.mjs [games=20] [maxMinutes=40] [ai=classic|smart|all] [difficulty=normal|all]
   Výstup: tabulka win-rate, průměrná délka, dosažený věk. Jádro je deterministické → seed = index hry. */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const E = require("../js/engine.js");
try { require("../js/ai.js"); } catch (e) { /* chytrá AI nemusí existovat */ }
const D = E.D;

const [, , gamesArg = "20", maxMinArg = "40", aiArg = "all", diffArg = "all"] = process.argv;
const GAMES = +gamesArg, MAX_TICKS = +maxMinArg * 60 * D.TPS;

// ---------- Strategie hráče (skriptované, volané každých 10 ticků) ----------
const STRATEGIES = {
  // posílá nejdražší dostupnou jednotku, evolvuje hned, special při ≥3 nepřátelích, 1 věž
  spam(g) {
    const S = g.sides[0], pool = D.UNITS_BY_AGE[S.age];
    for (let i = pool.length - 1; i >= 0; i--) if (E.canTrain(g, 0, pool[i].id)) { E.enqueueUnit(g, 0, pool[i].id); break; }
    if (E.canEvolve(g, 0)) E.evolve(g, 0);
    if (E.canUseSpecial(g, 0) && E.aliveUnits(g, 1) >= 3) E.useSpecial(g, 0);
    if (!S.turrets[0] && S.gold >= D.TURRETS_BY_AGE[S.age][0].cost * 1.5) E.buildTurret(g, 0, 0, D.TURRETS_BY_AGE[S.age][0].id);
  },
  // levné jednotky pořád + pak věže: "turtle" – 4 sloty, nejlepší věže, mix jednotek
  turtle(g) {
    const S = g.sides[0], pool = D.UNITS_BY_AGE[S.age], tp = D.TURRETS_BY_AGE[S.age];
    const best = tp[tp.length - 1];
    const slotCost = E.slotCost(g, 0);
    const freeSlot = S.turrets.findIndex((t, i) => !t && i < S.slots);
    if (freeSlot >= 0 && S.gold >= best.cost) E.buildTurret(g, 0, freeSlot, best.id);
    else if (freeSlot >= 0 && S.gold >= tp[0].cost && E.aliveUnits(g, 1) > 2) E.buildTurret(g, 0, freeSlot, tp[0].id);
    else if (slotCost !== null && S.gold >= slotCost + tp[0].cost) E.buySlot(g, 0);
    // prodej slabé věže, když je na lepší
    for (let i = 0; i < S.slots; i++) if (S.turrets[i] && S.turrets[i].id !== best.id && D.TURRETS[S.turrets[i].id].age < S.age && S.gold >= best.cost) { E.sellTurret(g, 0, i); E.buildTurret(g, 0, i, best.id); }
    if (S.queue.length < 2 && E.canTrain(g, 0, pool[0].id)) E.enqueueUnit(g, 0, pool[E.aliveUnits(g, 0) % 2 === 0 ? 0 : Math.min(1, pool.length - 1)].id);
    if (E.canEvolve(g, 0)) E.evolve(g, 0);
    if (E.canUseSpecial(g, 0) && E.aliveUnits(g, 1) >= 2) E.useSpecial(g, 0);
  },
  // "balanced": drží 1–2 střelce za tankem, šetří na nejdražší jednotku věku, 2 věže
  balanced(g) {
    const S = g.sides[0], pool = D.UNITS_BY_AGE[S.age], tp = D.TURRETS_BY_AGE[S.age];
    const mine = g.units.filter(u => u.side === 0 && !u.dead).length;
    const enemies = E.aliveUnits(g, 1);
    const heavy = pool[Math.min(2, pool.length - 1)], ranged = pool[1], cheap = pool[0];
    if (!S.turrets[0] && S.gold >= tp[0].cost + cheap.cost * 2) E.buildTurret(g, 0, 0, tp[0].id);
    else if (S.slots < 2 && S.gold >= 1000 + tp[1].cost) { E.buySlot(g, 0); E.buildTurret(g, 0, 1, tp[1].id); }
    if (S.queue.length === 0) {
      if (enemies > mine + 1 && E.canTrain(g, 0, cheap.id)) E.enqueueUnit(g, 0, cheap.id);
      else if (mine % 3 === 2 && E.canTrain(g, 0, ranged.id)) E.enqueueUnit(g, 0, ranged.id);
      else if (E.canTrain(g, 0, heavy.id)) E.enqueueUnit(g, 0, heavy.id);
      else if (enemies > mine && E.canTrain(g, 0, cheap.id)) E.enqueueUnit(g, 0, cheap.id);
    }
    if (E.canEvolve(g, 0)) E.evolve(g, 0);
    if (E.canUseSpecial(g, 0) && (enemies >= 3 || S.baseHp < S.baseMaxHp * 0.4)) E.useSpecial(g, 0);
  },
  // "pro": meta zkušených hráčů – vejce/egg hned, farmit věžemi, 4 sloty s nejlepší věží věku,
  // mezi tím levné jednotky na XP, v Budoucnosti šetřit na Super vojáky a poslat je po 2
  pro(g) {
    const S = g.sides[0], pool = D.UNITS_BY_AGE[S.age], tp = D.TURRETS_BY_AGE[S.age];
    const best = tp[tp.length - 1], enemies = E.aliveUnits(g, 1), mine = E.aliveUnits(g, 0);
    const ultimate = pool[3] || null;
    // věže: sloty kupovat hned, jak jsou (s rezervou), do slotů nejlepší dostupnou věž věku a postupně vylepšovat
    const freeSlot = S.turrets.findIndex((t, i) => !t && i < S.slots);
    const slotCost = E.slotCost(g, 0);
    const reserve = pool[0].cost * 2;
    const affordable = [...tp].reverse().find(t => S.gold - reserve >= t.cost);
    if (freeSlot >= 0 && affordable && (affordable === best || S.age === 0 || enemies > 0)) E.buildTurret(g, 0, freeSlot, affordable.id);
    else if (freeSlot < 0 && slotCost !== null && S.gold - reserve >= slotCost + tp[0].cost) E.buySlot(g, 0);
    else {
      let worst = -1, worstDps = Infinity;
      for (let i = 0; i < S.slots; i++) { const t = S.turrets[i]; if (t && D.TURRETS[t.id].dps < worstDps) { worstDps = D.TURRETS[t.id].dps; worst = i; } }
      if (worst >= 0) {
        const up = [...tp].reverse().find(t => t.dps > worstDps * 1.4 && S.gold - reserve >= t.cost - D.TURRETS[S.turrets[worst].id].sell);
        if (up) { E.sellTurret(g, 0, worst); E.buildTurret(g, 0, worst, up.id); }
      }
    }
    const fourTurrets = S.slots === 4 && S.turrets.every(t => t);
    // jednotky: proti AI s jednotkami zdarma se výměnou vyhrát nedá → jen obrana levnými, když se nepřítel
    // dostane k základně, a šetření na Super vojáky (2 najednou + výplň); před Budoucností nepushovat
    const enemyNear = g.units.some(u => u.side === 1 && !u.dead && u.x < 420);
    if (enemyNear && mine < 2 && S.queue.length < 2 && E.canTrain(g, 0, pool[0].id)) E.enqueueUnit(g, 0, pool[0].id);
    else if (S.queue.length === 0 && ultimate && fourTurrets && S.gold >= ultimate.cost * 2 + pool[0].cost * 2) {
      E.enqueueUnit(g, 0, pool[0].id); E.enqueueUnit(g, 0, ultimate.id); E.enqueueUnit(g, 0, ultimate.id); E.enqueueUnit(g, 0, pool[0].id);
    }
    if (E.canEvolve(g, 0)) E.evolve(g, 0);
    if (E.canUseSpecial(g, 0) && (enemies >= 3 || S.baseHp < S.baseMaxHp * 0.5)) E.useSpecial(g, 0);
  },
  // pasivní hráč: jen 1 věž a nic víc (sanity: musí prohrát)
  idle(g) {
    const S = g.sides[0];
    if (!S.turrets[0] && S.gold >= 100) E.buildTurret(g, 0, 0, 0);
  },
};

function play(strategy, ai, difficulty, seed) {
  const g = E.createGame({ seed, difficulty, ai });
  while (!g.over && g.tick < MAX_TICKS) {
    if (g.tick % 10 === 0) STRATEGIES[strategy](g);
    E.tick(g);
  }
  return { won: g.over && g.winner === 0, over: g.over, minutes: g.tick / D.TPS / 60, age: g.sides[0].age, eAge: g.sides[1].age, kills: g.sides[0].stats.kills };
}

const ais = aiArg === "all" ? ["classic", "smart"] : [aiArg];
const diffs = diffArg === "all" ? Object.keys(D.DIFFICULTIES) : [diffArg];
const rows = [];
for (const ai of ais) for (const diff of diffs) for (const strat of Object.keys(STRATEGIES)) {
  const res = [];
  for (let i = 0; i < GAMES; i++) res.push(play(strat, ai, diff, 1000 + i));
  const wins = res.filter(r => r.won).length, unfinished = res.filter(r => !r.over).length;
  const avgMin = res.reduce((a, r) => a + r.minutes, 0) / res.length;
  const avgAge = res.reduce((a, r) => a + r.age, 0) / res.length;
  rows.push({ ai, diff, strat, wins: `${wins}/${GAMES}`, winRate: Math.round(wins / GAMES * 100) + " %", unfinished, avgMin: avgMin.toFixed(1), avgAge: avgAge.toFixed(1) });
}
console.table(rows);
