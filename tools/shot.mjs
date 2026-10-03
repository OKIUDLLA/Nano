/* Screenshot stránky v headless Chromiu (Playwright).
   Použití: node tools/shot.mjs <soubor.html?params> <out.png> [šířka] [výška]
   Příklad:  node tools/shot.mjs "tools/sprite-viewer.html?age=0&freeze=0.35" /tmp/age0.png
   Chromium: použije PLAYWRIGHT_CHROMIUM (výchozí /opt/pw-browsers/chromium), jinak Playwright default. */
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const [, , target, out, w, h] = process.argv;
if (!target || !out) { console.error("usage: node tools/shot.mjs <file.html?params> <out.png> [w] [h]"); process.exit(2); }
const [file, query] = target.split("?");
const url = pathToFileURL(resolve(file)).href + (query ? "?" + query : "");
const exe = process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium";
let browser;
try { browser = await chromium.launch({ headless: true, executablePath: exe }); }
catch (e) { browser = await chromium.launch({ headless: true }); }
const page = await browser.newPage({ viewport: { width: +(w || 1100), height: +(h || 900) }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", e => errors.push("pageerror: " + e.message));
page.on("console", m => { if (m.type() === "error") errors.push("console: " + m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.__ready === true || document.readyState === "complete", null, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(300);
await page.screenshot({ path: out, fullPage: true });
await browser.close();
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("saved", out);
