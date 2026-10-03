/* ============================================================
   Age of War – remake: CHYTRÁ AI ("smart")
   Hraje podle STEJNÝCH pravidel jako hráč: platí zlatem za jednotky
   i věže, zlato má jen z killů, evolvuje za XP, kupuje sloty, prodává
   staré věže, používá special – a umí i Super vojáka.
   Obtížnost u této AI nenásobí HP jednotek, ale mění tempo reakcí a
   ekonomický handicap (násobek odměn za killy a startovní zlato).
   Deterministická (jen state.rng). Funguje v prohlížeči i v Node.
   ============================================================ */
(function (global) {
  "use strict";

  const E = (typeof module !== "undefined" && module.exports) ? require("./engine.js") : global.AoWEngine;
  const D = E.D;
  const { TPS, UNITS, UNITS_BY_AGE, TURRETS, TURRETS_BY_AGE, WORLD_W, BASE_EDGE, MAX_SLOTS } = D;

  // income = pevný příjem (zlato/s) podle věku. Klasická AI originálu má jednotky zdarma a vysílá je
  // v hodnotě zhruba 10 / 37 / 80 / 500 / 1500 zlata/s (viz docs/BALANCE.md) – chytrá AI dostává
  // na Normální zhruba polovinu a utrácí ji rozumně; bez příjmu by proti pasivnímu hráči vyhladověla.
  // Po 15. minutě příjem roste o 4 % za minutu (proti nekonečným patům dvou "želv").
  // maxTurrets = kolik věží si AI postaví (zbytek jde do vln jednotek, ať hra nekončí patem).
  const PRESETS = {
    normal:     { reactTicks: 60, rewardMul: 1.0, startGold: 175, income: [5, 15, 35, 200, 600],    maxTurrets: 2, waveSize: 4, aggression: 0.55 },
    harder:     { reactTicks: 40, rewardMul: 1.3, startGold: 300, income: [8, 24, 55, 320, 950],    maxTurrets: 3, waveSize: 5, aggression: 0.7 },
    impossible: { reactTicks: 20, rewardMul: 1.8, startGold: 600, income: [12, 38, 90, 500, 1500],  maxTurrets: 4, waveSize: 5, aggression: 0.85 },
  };
  const ESCALATION = { afterMin: 15, perMin: 0.04 };

  function rolesOf(state, side) {
    const r = { n: 0, hp: 0, ranged: 0, heavy: 0, infantry: 0, nearBase: 0, frontX: side === 0 ? -Infinity : Infinity };
    for (const u of state.units) {
      if (u.dead || u.side !== side) continue;
      const def = UNITS[u.id];
      r.n++; r.hp += u.hp;
      if (def.isRanged) r.ranged++; else if (def.w > 60 || def.hp >= 600) r.heavy++; else r.infantry++;
      if (side === 0) { r.frontX = Math.max(r.frontX, u.x); if (u.x > BASE_EDGE[1] - 260) r.nearBase++; }
      else { r.frontX = Math.min(r.frontX, u.x); if (u.x < BASE_EDGE[0] + 260) r.nearBase++; }
    }
    return r;
  }

  const Smart = {
    create(state) {
      const p = PRESETS[state.difficulty] || PRESETS.normal;
      // férový souboj: žádné násobení statistik, místo toho ekonomický handicap
      state.rules.enemyMul = 1.0;
      state.rules.aiRewardMul = p.rewardMul;
      state.rules.aiIncome = p.income.slice();
      state.rules.aiEscalation = ESCALATION;
      state.sides[1].gold = p.startGold;
      return { side: 1, t: 0, next: 10, mode: "build", lastSpecial: -9999, uof: 0, turretReview: 0, preset: state.difficulty, wave: 0 };
    },
    update(state, ai) {
      ai.t++;
      if (ai.t < ai.next) return;
      const p = PRESETS[ai.preset] || PRESETS.normal;
      ai.next = ai.t + p.reactTicks + Math.floor(E.rng(state) * p.reactTicks * 0.5);
      const S = state.sides[1], P = state.sides[0];
      const me = rolesOf(state, 1), foe = rolesOf(state, 0);
      const pool = UNITS_BY_AGE[S.age], tpool = TURRETS_BY_AGE[S.age];
      const cheap = pool[0], ranged = pool[1], heavy = pool[2], ultimate = pool[3] || null;
      const threat = foe.nearBase > 0 || (foe.n >= me.n + 2);
      const baseFrac = S.baseHp / S.baseMaxHp;

      // 1) evoluce – vždy, když jde (silnější vše + HP základny)
      if (E.canEvolve(state, 1)) { E.evolve(state, 1); ai.turretReview = 0; }

      // 2) special – při tlaku, nebo když je na bojišti dost cílů
      if (E.canUseSpecial(state, 1)) {
        const key = D.SPECIALS[S.age].key;
        const targets = foe.n;
        const wantHeal = key === "heal" && me.n >= 2 && me.hp < me.n * 0.6 * (heavy.hp);
        if ((key !== "heal" && (targets >= 3 || foe.nearBase >= 1 || (baseFrac < 0.35 && targets >= 1))) || wantHeal) E.useSpecial(state, 1);
      }

      // rozpočet vlny: těžká jednotka + 2× výplň + doplněk; věže a harašení se platí jen z přebytku nad ním
      const wantHeavy = foe.ranged >= 2 || foe.infantry >= 3 || foe.n === 0;
      const core = ultimate && S.gold >= ultimate.cost + cheap.cost * 2 ? ultimate : (wantHeavy ? heavy : (foe.heavy > 0 ? ranged : heavy));
      const fodder = cheap;
      const support = foe.heavy > 0 ? ranged : (core === ultimate ? fodder : heavy);
      const waveCost = core.cost + fodder.cost * 2 + support.cost;
      const surplus = S.gold - waveCost * 1.2;

      // 3) věže a sloty – nejdražší věž svého věku z přebytku (první věž a obrana i bez něj), max podle obtížnosti
      const reserve = threat ? cheap.cost * 2 : cheap.cost;
      const built = S.turrets.filter(t => t).length;
      const freeSlot = S.turrets.findIndex((t, i) => i < S.slots && !t);
      const best = tpool[tpool.length - 1];
      const budget = (built === 0 || threat) ? S.gold - reserve : surplus;
      const bestAffordable = [...tpool].reverse().find(t => budget >= t.cost);
      if (freeSlot >= 0 && built < p.maxTurrets && bestAffordable && (bestAffordable === best || threat || built === 0)) {
        E.buildTurret(state, 1, freeSlot, bestAffordable.id);
      } else {
        // vylepšení: prodat nejslabší věž, když je z přebytku na nejlepší věž tohoto věku
        let worst = -1, worstDps = Infinity;
        for (let i = 0; i < S.slots; i++) { const t = S.turrets[i]; if (!t) continue; const d = TURRETS[t.id]; if (d.dps < worstDps) { worstDps = d.dps; worst = i; } }
        if (worst >= 0 && worstDps < best.dps * 0.6 && surplus >= best.cost - TURRETS[S.turrets[worst].id].sell) {
          E.sellTurret(state, 1, worst); E.buildTurret(state, 1, worst, best.id);
        }
        const slotCost = E.slotCost(state, 1);
        if (freeSlot < 0 && built < p.maxTurrets && slotCost !== null && S.slots < MAX_SLOTS && surplus >= slotCost + tpool[0].cost) E.buySlot(state, 1);
      }

      // 4) jednotky – obrana při tlaku, jinak VLNY: našetří na skupinu (těžká + výplň) a pošle ji najednou
      const r = E.rng(state);
      if (threat && foe.nearBase > 0) {
        if (S.queue.length < 3) {
          const pick = [heavy, ranged, cheap].find(u => E.canTrain(state, 1, u.id));
          if (pick) E.enqueueUnit(state, 1, pick.id);
        }
        if (E.canUseSpecial(state, 1) && D.SPECIALS[S.age].key !== "heal") E.useSpecial(state, 1);
        return;
      }
      if (S.queue.length > 0) return;   // vlna se ještě trénuje
      const n = p.waveSize;
      const pressure = foe.n > me.n + 1;
      // mezi vlnami: harašení jen z přebytku (ať vlnu nerozmělní), při převaze soupeře střelec navíc
      if (S.gold < waveCost) {
        if (pressure && E.canTrain(state, 1, ranged.id) && S.gold >= ranged.cost + fodder.cost) E.enqueueUnit(state, 1, ranged.id);
        return;
      }
      if (S.gold < waveCost * 1.2 && r > p.aggression && foe.n === 0) return;   // bez tlaku chvíli šetří na větší vlnu
      // vlna: 2× výplň vpředu (chytá palbu věží), jádro, doplněk, výplň;
      // v Budoucnosti při velkém přebytku kolona Super vojáků (jediné, co prorazí hradbu věží)
      const plan = (ultimate && S.gold >= ultimate.cost * 3 + fodder.cost * 2)
        ? [fodder, ultimate, ultimate, ultimate, fodder].slice(0, n)
        : [fodder, fodder, core, support, fodder].slice(0, n);
      for (const u of plan) if (!E.canTrain(state, 1, u.id) || !E.enqueueUnit(state, 1, u.id)) break;
      if (surplus > fodder.cost * 4 && r < p.aggression) E.enqueueUnit(state, 1, fodder.id);   // přebytek → ještě výplň
      ai.wave++;
      void P;
    },
  };

  E.registerAI("smart", Smart);
  if (typeof module !== "undefined" && module.exports) module.exports = Smart;
  else global.AoWSmartAI = Smart;
})(typeof window !== "undefined" ? window : globalThis);
