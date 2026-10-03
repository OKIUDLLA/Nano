/* Prohlížečové testy celé hry (Playwright + headless Chromium).
   Spuštění: npm run test:browser  (vyžaduje `npm install`; Chromium z PLAYWRIGHT_CHROMIUM nebo Playwright default)
   Pokud Chromium není k dispozici, testy SELŽOU (ne přeskočí) – ať to v CI nepropadne tiše. */
import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexUrl = pathToFileURL(resolve(__dirname, "..", "index.html")).href;
const exe = process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium";

let browser;
test.before(async () => {
  try { browser = await chromium.launch({ headless: true, executablePath: exe }); }
  catch (e) { browser = await chromium.launch({ headless: true }); }
});
test.after(async () => { if (browser) await browser.close(); });

async function newGame(opts) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !/ERR_FILE_NOT_FOUND|favicon/.test(m.text())) errors.push(m.text()); });
  await page.goto(indexUrl);
  await page.waitForFunction(() => window.AoWEngine && window.AoWUI);
  if (opts && opts.difficulty) await page.selectOption("#sel-difficulty", opts.difficulty);
  if (!(opts && opts.noStart)) {
    await page.click("#btn-play");
    await page.waitForFunction(() => window.__game && window.__game.tick > 0);
  }
  return { page, context, errors };
}

test("menu → nová hra: vystaví stav, HUD ukazuje 175 zlata a Dobu kamennou, bez chyb", async () => {
  const { page, context, errors } = await newGame();
  const gold = await page.textContent("#gold");
  assert.equal(gold.trim(), "175");
  assert.equal((await page.textContent("#age-name")).trim(), "Doba kamenná");
  assert.equal(await page.locator("#unit-cards .card").count(), 3);
  assert.equal(await page.locator("#turret-cards .card").count(), 3);
  assert.deepEqual(errors, []);
  await context.close();
});

test("klik na kartu jednotky zařadí do fronty a strhne zlato; klávesa 2 také", async () => {
  const { page, context, errors } = await newGame();
  await page.click("#unit-cards .card >> nth=0");
  await page.waitForFunction(() => window.__game.sides[0].queue.length >= 1 || window.__game.units.length >= 1);
  const gold = await page.evaluate(() => window.__game.sides[0].gold);
  assert.ok(gold <= 160, "zlato kleslo o 15, je " + gold);
  await page.keyboard.press("2");
  await page.waitForFunction(() => window.__game.sides[0].stats.goldSpent >= 40);
  await page.waitForFunction(() => window.__game.units.some(u => u.side === 0));
  assert.deepEqual(errors, []);
  await context.close();
});

test("stavba věže: karta → klik na plošinu základny; prodej vrátí polovinu", async () => {
  const { page, context, errors } = await newGame();
  await page.evaluate(() => { window.__game.sides[0].gold = 5000; });
  await page.click(".tab[data-tab=turrets]");
  await page.click("#turret-cards .card >> nth=0");
  await page.waitForFunction(() => window.AoWUI.placing === 0);
  // klik na plošinu slotu 0 (svět x=52, y=345) → převod do CSS souřadnic canvasu
  const pt = await page.evaluate(() => { const r = window.__app.renderer; return { x: (52 - r.camX) * r.zoom, y: (345 - r.camY) * r.zoom }; });
  const box = await page.locator("#game").boundingBox();
  await page.mouse.click(box.x + pt.x, box.y + pt.y);
  await page.waitForFunction(() => window.__game.sides[0].turrets[0] && window.__game.sides[0].turrets[0].id === 0);
  let gold = await page.evaluate(() => window.__game.sides[0].gold);
  assert.ok(gold < 5000 && gold >= 4900 - 50, "věž stála 100 (zlato " + gold + ")");
  await page.click("#btn-sell");
  await page.mouse.click(box.x + pt.x, box.y + pt.y);
  await page.waitForFunction(() => !window.__game.sides[0].turrets[0]);
  const gold2 = await page.evaluate(() => window.__game.sides[0].gold);
  assert.ok(gold2 - gold >= 49 && gold2 - gold <= 51, "prodej vrátil 50");
  assert.deepEqual(errors, []);
  await context.close();
});

test("evoluce přes HUD, special přes mezerník, pauza přes P", async () => {
  const { page, context, errors } = await newGame();
  await page.evaluate(() => { window.__game.sides[0].xp = 4000; });
  await page.waitForFunction(() => !document.getElementById("btn-evolve").disabled);
  await page.click("#btn-evolve");
  await page.waitForFunction(() => window.__game.sides[0].age === 1);
  await page.waitForFunction(() => document.getElementById("age-name").textContent === "Hradní věk");
  assert.equal(await page.locator("#unit-cards .card").count(), 3);
  assert.equal((await page.textContent("#unit-cards .card >> nth=0 >> .name")).trim(), "Mečíř");
  await page.keyboard.press(" ");
  await page.waitForFunction(() => window.__game.sides[0].specialCd > 1000);
  const tick = await page.evaluate(() => window.__game.tick);
  await page.keyboard.press("p");
  await page.waitForFunction(() => window.__app.paused === true);
  await page.waitForTimeout(300);
  const tick2 = await page.evaluate(() => window.__game.tick);
  assert.equal(tick2 >= tick && tick2 - tick <= 15, true, "v pauze simulace stojí");
  await page.keyboard.press("p");
  await page.waitForFunction(t => window.__game.tick > t + 5, tick2);
  assert.deepEqual(errors, []);
  await context.close();
});

test("ukládání: po reloadu lze pokračovat ve stejné hře", async () => {
  const { page, context, errors } = await newGame();
  await page.evaluate(() => { window.__game.sides[0].gold = 777; });
  await page.waitForTimeout(3500); // autosave každé 3 s
  await page.click("#btn-menu");
  await page.reload();
  await page.waitForFunction(() => window.AoWUI);
  await page.waitForSelector("#btn-continue:not(.hidden)");
  await page.click("#btn-continue");
  await page.waitForFunction(() => window.__game && window.__game.tick > 10);
  const gold = await page.evaluate(() => window.__game.sides[0].gold);
  assert.ok(gold >= 700 && gold <= 777, "zlato z uložené hry (" + gold + ")");
  assert.deepEqual(errors, []);
  await context.close();
});

test("konec hry: zničení základny zobrazí obrazovku se statistikami", async () => {
  const { page, context, errors } = await newGame();
  await page.evaluate(() => { window.__game.sides[1].baseHp = -1; });
  await page.waitForFunction(() => window.__game.over === true);
  await page.waitForSelector("#gameover:not(.hidden)", { timeout: 5000 });
  assert.equal((await page.textContent("#go-title")).trim(), "Vítězství!");
  assert.ok((await page.locator("#go-stats tr").count()) >= 8);
  assert.deepEqual(errors, []);
  await context.close();
});

test("hra ve vysoké rychlosti 60 s bez chyb v konzoli (sprity, zvuk, UI)", async () => {
  const { page, context, errors } = await newGame({ difficulty: "harder" });
  await page.evaluate(() => { window.__app.speed = 3; });
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    await page.evaluate(() => {
      const g = window.__game, E = window.AoWEngine, D = window.AoWData; if (!g || g.over) return;
      const S = g.sides[0], pool = D.UNITS_BY_AGE[S.age];
      for (let i = pool.length - 1; i >= 0; i--) if (E.canTrain(g, 0, pool[i].id)) { window.__app.actions.train(pool[i].id); break; }
      if (E.canEvolve(g, 0)) window.__app.actions.evolve();
      if (E.canUseSpecial(g, 0)) window.__app.actions.special();
      if (!S.turrets[0] && S.gold >= 150) E.buildTurret(g, 0, 0, D.TURRETS_BY_AGE[S.age][0].id);
      if (S.gold > 50000) { S.xp = Math.max(S.xp, 200000); }
    });
    await page.waitForTimeout(250);
  }
  const tick = await page.evaluate(() => window.__game.tick);
  assert.ok(tick > 40 * 40, "simulace běžela zrychleně (tick " + tick + ")");
  assert.deepEqual(errors, []);
  await context.close();
});
