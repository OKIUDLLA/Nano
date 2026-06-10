/* Headless ověření celé hry v reálném prohlížeči (Playwright + Chromium).
   Načte index.html, klikne v UI a ověří, že se mění herní stav i HUD.
   Spuštění: npm run test:browser
   Pozn.: vyžaduje `npx playwright install chromium`.                 */
import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexUrl = pathToFileURL(resolve(__dirname, "..", "index.html")).href;

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (e) {
  console.error("⚠️  Modul 'playwright' není nainstalován – přeskočeno. Spusť `npm install`.");
  process.exit(0);
}

let browser;
try {
  browser = await chromium.launch({ headless: true });
} catch (e) {
  console.error("⚠️  Chromium není k dispozici – přeskočeno. Spusť `npx playwright install chromium`.");
  console.error("    Důvod: " + e.message.split("\n")[0]);
  process.exit(0);
}

async function newPage() {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(indexUrl);
  await page.waitForFunction(() => window.__game && window.Engine);
  return { page, context };
}

test("stránka se načte a vystaví herní stav", async () => {
  const { page, context } = await newPage();
  const gold = await page.evaluate(() => window.__game.gold);
  assert.ok(gold >= 80 && gold < 90, "zlato startuje kolem 80 (plus pasivní příjem), bylo " + gold);
  const hasCanvas = await page.evaluate(() => !!document.querySelector("#game"));
  assert.equal(hasCanvas, true);
  await context.close();
});

test("kliknutí na kartu jednotky najme jednotku", async () => {
  const { page, context } = await newPage();
  const before = await page.evaluate(() => window.__game.units.length);
  await page.click(".unit-card");
  await page.waitForFunction((n) => window.__game.units.length > n, before);
  const after = await page.evaluate(() => window.__game.units.length);
  assert.ok(after > before, "po kliknutí přibyla jednotka");
  const playerUnits = await page.evaluate(() => window.__game.units.filter(u => u.side === "player").length);
  assert.ok(playerUnits >= 1);
  await context.close();
});

test("postavení věže přes tlačítko změní stav", async () => {
  const { page, context } = await newPage();
  await page.evaluate(() => { window.__game.gold = 100000; });
  await page.waitForFunction(() => !document.getElementById("tower-btn").disabled);
  await page.click("#tower-btn");
  await page.waitForFunction(() => window.Engine.towerCount(window.__game, "player") >= 1);
  const towers = await page.evaluate(() => window.Engine.towerCount(window.__game, "player"));
  assert.ok(towers >= 1);
  await context.close();
});

test("evoluce přes tlačítko posune věk", async () => {
  const { page, context } = await newPage();
  await page.evaluate(() => { window.__game.xp = window.Engine.AGES[0].evolveCost + 5; });
  await page.waitForFunction(() => !document.getElementById("evolve-btn").disabled);
  await page.click("#evolve-btn");
  await page.waitForFunction(() => window.__game.age >= 1);
  // HUD text se aktualizuje v dalším snímku smyčky – počkáme na něj
  await page.waitForFunction(() => document.getElementById("age-name").textContent === "Antika");
  const age = await page.evaluate(() => window.__game.age);
  assert.equal(age, 1);
  await context.close();
});

test("meteor přes tlačítko nastaví cooldown", async () => {
  const { page, context } = await newPage();
  await page.click("#special-btn");
  await page.waitForFunction(() => window.__game.specialCd > 0);
  const cd = await page.evaluate(() => window.__game.specialCd);
  assert.ok(cd > 0);
  await context.close();
});

test.after(async () => { if (browser) await browser.close(); });
