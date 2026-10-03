/* Automatický "hráč" v headless Chromiu: spustí hru, klikne na Novou hru, trénuje jednotky,
   staví věž, používá special a po N sekundách udělá screenshot. Vypíše chyby z konzole.
   Použití: node tools/play.mjs <out.png> [sekund=20] [rychlost=3] [obtížnost=normal] */
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const [, , out = "/tmp/play.png", secs = "20", spd = "3", diff = "normal"] = process.argv;
const url = pathToFileURL(resolve("index.html")).href;
const exe = process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium";
let browser;
try { browser = await chromium.launch({ headless: true, executablePath: exe }); } catch (e) { browser = await chromium.launch({ headless: true }); }
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
const errors = [];
page.on("pageerror", e => errors.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error" && !/ERR_FILE_NOT_FOUND|favicon/.test(m.text())) errors.push("console: " + m.text()); });
await page.goto(url);
await page.selectOption("#sel-difficulty", diff);
await page.click("#btn-play");
await page.waitForFunction(() => window.__game && window.__game.tick > 0);
await page.evaluate(s => { window.__app.speed = s; }, +spd);
const t0 = Date.now();
while (Date.now() - t0 < +secs * 1000) {
  await page.evaluate(() => {
    const g = window.__game, E = window.AoWEngine, D = window.AoWData;
    if (!g || g.over) return;
    const S = g.sides[0], pool = D.UNITS_BY_AGE[S.age];
    for (let i = pool.length - 1; i >= 0; i--) if (E.canTrain(g, 0, pool[i].id)) { window.__app.actions.train(pool[i].id); break; }
    if (E.canEvolve(g, 0)) window.__app.actions.evolve();
    if (E.canUseSpecial(g, 0) && E.aliveUnits(g, 1) >= 3) window.__app.actions.special();
    if (!S.turrets[0] && S.gold >= 150) E.buildTurret(g, 0, 0, D.TURRETS_BY_AGE[S.age][0].id);
  });
  await page.waitForTimeout(250);
}
const info = await page.evaluate(() => { const g = window.__game, S = g.sides[0]; return { tick: g.tick, gold: Math.round(S.gold), xp: S.xp, age: S.age, units: g.units.length, pHp: Math.round(S.baseHp), eHp: Math.round(g.sides[1].baseHp), eAge: g.sides[1].age, over: g.over, winner: g.winner, kills: S.stats.kills }; });
console.log(JSON.stringify(info));
await page.screenshot({ path: out });
await browser.close();
if (errors.length) { console.error([...new Set(errors)].slice(0, 20).join("\n")); process.exit(1); }
console.log("saved", out);
