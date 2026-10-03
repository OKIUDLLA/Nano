/* ============================================================
   Age of War – remake: HERNÍ DATA
   Všechny hodnoty jednotek, věží, věků a specialů jsou převzaté
   z dekompilovaného originálu (viz docs/ORIGINAL.md). Časy jsou
   v TICKÁCH simulace; 1 tick = 1/40 s (originál běžel na 40 fps).

   Soubor nemá závislosti, funguje v prohlížeči (window.AoWData)
   i v Node (module.exports).
   ============================================================ */
(function (global) {
  "use strict";

  const TPS = 40;                 // ticků za sekundu
  const WORLD_W = 1000;           // šířka světa (px)
  const GROUND_Y = 425;           // y země (px)
  const SKY_H = 450;              // výška scény (px)

  // ---------- Věky ----------
  const AGES = [
    { id: 0, key: "stone",       name: "Doba kamenná",  en: "Stone Age",       evolveXp: 4000 },
    { id: 1, key: "castle",      name: "Hradní věk",    en: "Castle Age",      evolveXp: 14000 },
    { id: 2, key: "renaissance", name: "Renesance",     en: "Renaissance Age", evolveXp: 45000 },
    { id: 3, key: "modern",      name: "Moderní věk",   en: "Modern Age",      evolveXp: 200000 },
    { id: 4, key: "future",      name: "Budoucnost",    en: "Future Age",      evolveXp: Infinity },
  ];

  // ---------- Jednotky ----------
  // cost = zlato, train = ticky výcviku, hp, melee/ranged dmg, meleeRange/shootRange (px),
  // w/h = hitzóna (px). Animace: period = délka smyčky (ticky), hitAt = tick úderu
  // uvnitř smyčky (u dvou variant průměr). shoot* = střelba vestoje, walkShoot* = střelba za chůze.
  const UNITS = [
    // --- Doba kamenná ---
    { id: 0,  age: 0, key: "clubman",   name: "Klackař",            en: "Club man",       cost: 15,     train: 40,  hp: 55,   melee: 16,  ranged: 0,   meleeRange: 20,  shootRange: 0,   w: 31.6,  h: 44.3, period: 40,   hitAt: 20 },
    { id: 1,  age: 0, key: "slinger",   name: "Prakovník",          en: "Slingshot man",  cost: 25,     train: 40,  hp: 42,   melee: 10,  ranged: 8,   meleeRange: 20,  shootRange: 100, w: 31.6,  h: 44.3, period: 40,   hitAt: 20, shootPeriod: 32, shootHitAt: 26, walkShootPeriod: 43, walkShootHitAt: 30 },
    { id: 2,  age: 0, key: "dino",      name: "Jezdec na dinu",     en: "Dino rider",     cost: 100,    train: 100, hp: 160,  melee: 40,  ranged: 0,   meleeRange: 45,  shootRange: 0,   w: 81.4,  h: 62.3, period: 45,   hitAt: 21 },
    // --- Hradní věk ---
    { id: 3,  age: 1, key: "swordman",  name: "Mečíř",              en: "Sword man",      cost: 50,     train: 70,  hp: 100,  melee: 35,  ranged: 0,   meleeRange: 20,  shootRange: 0,   w: 31.6,  h: 44.3, period: 48.5, hitAt: 30 },
    { id: 4,  age: 1, key: "archer",    name: "Lučištník",          en: "Archer",         cost: 75,     train: 50,  hp: 80,   melee: 20,  ranged: 9,   meleeRange: 20,  shootRange: 130, w: 31.6,  h: 44.3, period: 48.5, hitAt: 34, shootPeriod: 40, shootHitAt: 15, walkShootPeriod: 40, walkShootHitAt: 16 },
    { id: 5,  age: 1, key: "knight",    name: "Rytíř",              en: "Knight",         cost: 500,    train: 100, hp: 300,  melee: 60,  ranged: 0,   meleeRange: 60,  shootRange: 0,   w: 98.4,  h: 69.0, period: 52,   hitAt: 23 },
    // --- Renesance ---
    { id: 6,  age: 2, key: "dueler",    name: "Duelant",            en: "Dueler",         cost: 200,    train: 100, hp: 200,  melee: 79,  ranged: 0,   meleeRange: 25,  shootRange: 0,   w: 33.5,  h: 51.3, period: 41,   hitAt: 21.5 },
    // Mušketýr v originálu i zblízka střílí (obě animace volají ranged_hit) → melee dmg = ranged dmg
    { id: 7,  age: 2, key: "musketeer", name: "Mušketýr",           en: "Mousquettere",   cost: 400,    train: 100, hp: 160,  melee: 20,  ranged: 20,  meleeRange: 25,  shootRange: 130, w: 33.5,  h: 51.3, period: 46,   hitAt: 13, shootPeriod: 46, shootHitAt: 13, walkShootPeriod: 48, walkShootHitAt: 1 },
    { id: 8,  age: 2, key: "cannoneer", name: "Dělostřelec",        en: "Canoneer",       cost: 1000,   train: 200, hp: 600,  melee: 120, ranged: 0,   meleeRange: 25,  shootRange: 0,   w: 33.5,  h: 51.3, period: 78,   hitAt: 27 },
    // --- Moderní věk ---
    { id: 9,  age: 3, key: "shocktroop",name: "Úderná pěchota",     en: "Melee Infantry", cost: 1500,   train: 100, hp: 350,  melee: 100, ranged: 0,   meleeRange: 25,  shootRange: 0,   w: 33.5,  h: 51.3, period: 30,   hitAt: 14 },
    { id: 10, age: 3, key: "infantry",  name: "Pěšák",              en: "Infantry",       cost: 2000,   train: 100, hp: 300,  melee: 60,  ranged: 30,  meleeRange: 25,  shootRange: 130, w: 33.5,  h: 51.3, period: 21,   hitAt: 7,  shootPeriod: 21, shootHitAt: 7,  walkShootPeriod: 48, walkShootHitAt: 3 },
    { id: 11, age: 3, key: "tank",      name: "Tank",               en: "Tank",           cost: 7000,   train: 300, hp: 1200, melee: 300, ranged: 0,   meleeRange: 100, shootRange: 0,   w: 173.5, h: 57.3, period: 63,   hitAt: 30 },
    // --- Budoucnost ---
    { id: 12, age: 4, key: "godsblade", name: "Boží čepel",         en: "God's Blade",    cost: 5000,   train: 100, hp: 1000, melee: 250, ranged: 0,   meleeRange: 40,  shootRange: 0,   w: 44.5,  h: 69.0, period: 37,   hitAt: 23 },
    { id: 13, age: 4, key: "blaster",   name: "Blaster",            en: "Blaster",        cost: 6000,   train: 100, hp: 800,  melee: 130, ranged: 80,  meleeRange: 40,  shootRange: 130, w: 44.5,  h: 69.0, period: 27.5, hitAt: 16.5, shootPeriod: 14, shootHitAt: 6, walkShootPeriod: 38, walkShootHitAt: 21 },
    { id: 14, age: 4, key: "warmachine",name: "Válečný stroj",      en: "War machine",    cost: 20000,  train: 300, hp: 3000, melee: 600, ranged: 0,   meleeRange: 100, shootRange: 0,   w: 116.5, h: 57.0, period: 90,   hitAt: 13 },
    { id: 15, age: 4, key: "supersoldier", name: "Super voják",     en: "Super Soldier",  cost: 150000, train: 100, hp: 4000, melee: 400, ranged: 400, meleeRange: 40,  shootRange: 150, w: 44.5,  h: 69.0, period: 27.5, hitAt: 16.5, shootPeriod: 14, shootHitAt: 6, walkShootPeriod: 38, walkShootHitAt: 21 },
  ];
  for (const u of UNITS) {
    u.reward = Math.round(u.cost * 1.3);     // zlato pro toho, kdo ji zabije
    u.killXp = u.reward * 2;                 // XP pro toho, kdo ji zabije
    u.lossXp = Math.round(u.reward / 2);     // XP pro majitele, když padne
    u.isRanged = u.shootRange > 0;
    u.dps = +(u.melee / (u.period / TPS)).toFixed(1);
    if (u.isRanged) u.rdps = +(u.ranged / (u.shootPeriod / TPS)).toFixed(1);
  }
  // Jednotky dostupné v daném věku (originál: 3 na věk, Budoucnost 4)
  const UNITS_BY_AGE = AGES.map(a => UNITS.filter(u => u.age === a.id));

  // ---------- Věže ----------
  // period = ticky mezi výstřely, range = dosah (px, euklidovsky od ústí), projectile = typ střely
  // Typy střel: ballistic (7 px/tick, g 0.05), fast (28 px/tick, g 0.02 – ve 4 podkrocích),
  // rocket (zrychluje), laser (téměř okamžitý), oil (proud kapek), shrapnel (po zásahu střepiny)
  const TURRETS = [
    { id: 0,  age: 0, key: "rockslingshot", name: "Kamenný prak",        en: "Rock slingshot",     cost: 100,    period: 30,  dmg: 12,  range: 350, projectile: "ballistic" },
    { id: 1,  age: 0, key: "eggautomatic",  name: "Vaječný automat",     en: "Egg automatic",      cost: 200,    period: 11,  dmg: 5,   range: 300, projectile: "ballistic", speed: 7, lead: 4 },
    { id: 2,  age: 0, key: "primcatapult",  name: "Primitivní katapult", en: "Primitive Catapult", cost: 500,    period: 70,  dmg: 25,  range: 400, projectile: "ballistic" },
    { id: 3,  age: 1, key: "catapult",      name: "Katapult",            en: "Catapult",           cost: 500,    period: 70,  dmg: 40,  range: 400, projectile: "ballistic" },
    { id: 4,  age: 1, key: "firecatapult",  name: "Ohnivý katapult",     en: "Fire Catapult",      cost: 750,    period: 70,  dmg: 50,  range: 400, projectile: "ballistic", fragments: 3, fragmentsGround: 3, fragmentDmg: 10, fragmentKind: "flame" },
    { id: 5,  age: 1, key: "oil",           name: "Vroucí olej",         en: "Oil",                cost: 1000,   period: 100, dmg: 4,   range: 300, projectile: "oil", drops: 20, noAim: true },
    { id: 6,  age: 2, key: "smallcannon",   name: "Malé dělo",           en: "Small Cannon",       cost: 1500,   period: 70,  dmg: 30,  range: 500, projectile: "fast" },
    { id: 7,  age: 2, key: "largecannon",   name: "Velké dělo",          en: "Large Cannon",       cost: 3000,   period: 70,  dmg: 70,  range: 500, projectile: "fast" },
    { id: 8,  age: 2, key: "explosivecannon", name: "Trhavinové dělo",   en: "Explosives Cannon",  cost: 6000,   period: 70,  dmg: 100, range: 500, projectile: "fast", fragments: 3, fragmentsGround: 4, fragmentDmg: 30, fragmentKind: "shrapnel" },
    { id: 9,  age: 3, key: "singleturret",  name: "Kulometná věž",       en: "Single Turret",      cost: 7000,   period: 40,  dmg: 70,  range: 500, projectile: "fast" },
    { id: 10, age: 3, key: "rocketturret",  name: "Raketová věž",        en: "Rocket Turret",      cost: 9000,   period: 50,  dmg: 100, range: 500, projectile: "rocket" },
    { id: 11, age: 3, key: "doubleturret",  name: "Dvojitá věž",         en: "Double Turret",      cost: 14000,  period: 22,  dmg: 60,  range: 500, projectile: "fast" },
    { id: 12, age: 4, key: "titanium",      name: "Titanový střelec",    en: "Titanium Shooter",   cost: 24000,  period: 40,  dmg: 100, range: 400, projectile: "rocket" },
    { id: 13, age: 4, key: "lasercannon",   name: "Laserové dělo",       en: "LazerCannon",        cost: 40000,  period: 10,  dmg: 40,  range: 500, projectile: "laser" },
    { id: 14, age: 4, key: "ionray",        name: "Iontový paprsek",     en: "IonRay",             cost: 100000, period: 10,  dmg: 60,  range: 500, projectile: "laser" },
  ];
  for (const t of TURRETS) {
    t.sell = Math.round(t.cost / 2);
    t.dps = +(t.dmg / (t.period / TPS)).toFixed(1);
  }
  const TURRETS_BY_AGE = AGES.map(a => TURRETS.filter(t => t.age === a.id));

  // Sloty věží: 1. zdarma, další za 1000 / 3000 / 7500
  const SLOT_COSTS = [0, 1000, 3000, 7500];
  const MAX_SLOTS = 4;
  const SLOT_Y = [-80, -125, -172, -220];   // výška slotu nad zemí
  const TURRET_X = 52;                       // x ústí věží (zrcadlově WORLD_W - 52)

  // ---------- Specialy (1 na věk) ----------
  const SPECIALS = [
    { age: 0, key: "meteors", name: "Déšť meteorů",   en: "Meteor shower", duration: 200, every: 9,  dmg: 200,  desc: "5 s padají meteory na náhodná místa bojiště, každý zraní jednu jednotku za 200." },
    { age: 1, key: "arrows",  name: "Déšť šípů",      en: "Arrow rain",    duration: 200, every: 5,  dmg: 200,  desc: "5 s prší šípy, každý zraní jednu jednotku za 200." },
    { age: 2, key: "heal",    name: "Léčivá aura",    en: "Healing aura",  duration: 600, every: 0,  dmg: 0,    desc: "15 s se všechny tvé jednotky léčí rychlostí 40 HP/s." },
    { age: 3, key: "airstrike", name: "Nálet",        en: "Air strike",    duration: 0,   every: 15, dmg: 400,  desc: "Letadlo přeletí bojiště a shazuje bomby (každá 400)." },
    { age: 4, key: "deathray", name: "Smrtící paprsek", en: "Death ray",   duration: 0,   every: 5,  dmg: 1000, desc: "12 úderů z nebe napříč bojištěm, každý zraní jednu jednotku za 1000." },
  ];
  const SPECIAL_COOLDOWN = 2000;  // ticků (50 s)

  // ---------- Základny ----------
  const BASE_HP = 500;
  const BASE_HALF_W = 85.45;       // půlka hitzóny základny
  const BASE_CENTER = { 0: 68, 1: WORLD_W - 68 };          // střed hitzóny (hráč / nepřítel)
  const BASE_EDGE   = { 0: 68 + BASE_HALF_W, 1: WORLD_W - 68 - BASE_HALF_W }; // okraj směrem do bojiště
  const SPAWN_X     = { 0: 150, 1: WORLD_W - 140 };        // originál: 150 / 860
  function evolveHpBonus(newAge) { return 300 * (newAge + 1); } // +600, +900, +1200, +1500

  // ---------- Pohyb / ekonomika ----------
  const UNIT_SPEED = 0.7;          // px / tick
  const START_GOLD = 175;
  const QUEUE_SIZE = 5;
  const UNIT_DEATH_TICKS = 80;
  const REWARD_MUL = 1.3;

  // ---------- Obtížnosti ----------
  const DIFFICULTIES = {
    normal:     { name: "Normální",  en: "Normal",     enemyMul: 1.0 },
    harder:     { name: "Těžší",     en: "Harder",     enemyMul: 1.3 },
    impossible: { name: "Nemožná",   en: "Impossible", enemyMul: 2.0 },
  };

  // ---------- AI originálu (časovaná) ----------
  const CLASSIC_AI = {
    decideEvery: 40,       // ticků
    trainChance: 0.3,
    maxUnits: 6,
    unitLevelAt: [0, 1500, 5000],   // kdy se v rámci věku odemkne 1., 2., 3. jednotka
    evolveEvery: 8000,              // ticků na věk
    // rozvrh věží: [tickVeku, akce...]  akce: {sell:[sloty], build:{slot, turret}, slots:n}
    turretPlan: [
      [ // věk 0
        { at: 1000, build: { slot: 0, turret: 0 } },
        { at: 4000, sell: [0], build: { slot: 0, turret: 1 } },
        { at: 6000, sell: [0], build: { slot: 0, turret: 2 } },
      ],
      [ // věk 1
        { at: 1000, sell: [0], build: { slot: 0, turret: 3 } },
        { at: 4000, slots: 2, sell: [0], build: { slot: 0, turret: 5 } },
        { at: 6000, build: { slot: 1, turret: 4 } },
      ],
      [ // věk 2
        { at: 1000, sell: [0], build: { slot: 0, turret: 6 } },
        { at: 4000, slots: 3, sell: [1], build: { slot: 1, turret: 6 } },
        { at: 6000, sell: [1, 0], build: { slot: 2, turret: 8 } },
      ],
      [ // věk 3
        { at: 5000, build: { slot: 0, turret: 9 } },
        { at: 7000, slots: 3, sell: [2, 0], build: { slot: 1, turret: 10 } },
      ],
      [ // věk 4
        { at: 5000, build: { slot: 0, turret: 12 } },
        { at: 12000, sell: [1, 0, 2], build: { slot: 1, turret: 13 } },
        { at: 20000, slots: 4, sell: [1, 0, 2], build: { slot: 3, turret: 14 } },
      ],
    ],
  };

  const Data = {
    TPS, WORLD_W, GROUND_Y, SKY_H,
    AGES, UNITS, UNITS_BY_AGE, TURRETS, TURRETS_BY_AGE,
    SLOT_COSTS, MAX_SLOTS, SLOT_Y, TURRET_X,
    SPECIALS, SPECIAL_COOLDOWN,
    BASE_HP, BASE_HALF_W, BASE_CENTER, BASE_EDGE, SPAWN_X, evolveHpBonus,
    UNIT_SPEED, START_GOLD, QUEUE_SIZE, UNIT_DEATH_TICKS, REWARD_MUL,
    DIFFICULTIES, CLASSIC_AI,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Data;
  else global.AoWData = Data;
})(typeof window !== "undefined" ? window : globalThis);
