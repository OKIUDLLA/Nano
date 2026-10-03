/* Headless ověření js/audio.js v Chromiu (Playwright).
   1) načte tools/audio-test.html, obnoví AudioContext (autoplay povolen flagem),
      zahraje KAŽDÝ efekt, projde všech 5 hudebních témat s měnící se intenzitou,
      prověří mixér/throttle/limit hlasů a hlídá, že nevznikne žádná page/console chyba;
   2) přes AoWAudio.__renderTest (OfflineAudioContext) vyrenderuje všechny SFX
      a všech 5 témat a ověří, že výstup není tichý ani neklipuje (0.05 ≤ peak ≤ 0.98).
   Spuštění: node tools/audio-check.mjs            (exit 1 při selhání) */
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(resolve(__dirname, "audio-test.html")).href;
const exe = process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium";
const PEAK_MIN = 0.05, PEAK_MAX = 0.98, RMS_MIN = 0.0005;   // RMS je jen detektor ticha (krátký blip má přes 2.6 s nutně malé RMS)

let browser;
try { browser = await chromium.launch({ headless: true, executablePath: exe, args: ["--autoplay-policy=no-user-gesture-required"] }); }
catch (e) { browser = await chromium.launch({ headless: true, args: ["--autoplay-policy=no-user-gesture-required"] }); }

const problems = [];
const page = await browser.newPage();
page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") problems.push("console.error: " + m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.__ready === true && window.AoWAudio, null, { timeout: 15000 });

// --- 0) před resume(): všechno musí být no-op bez chyb ---
const pre = await page.evaluate(() => {
  const A = window.AoWAudio;
  return { ready: A.isReady(), play: A.play("coin"), music: A.setMusic(3), stats: A.__stats() };
});
if (pre.ready !== false || pre.play !== false) problems.push("pre-resume: očekáván no-op, dostal " + JSON.stringify(pre));

// --- 1) živý průchod: každý SFX, všechna témata, intenzita, mixér ---
const live = await page.evaluate(async () => {
  const A = window.AoWAudio;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = { errors: [] };
  A.init();
  await A.resume();
  out.ready = A.isReady();
  out.state = A.__stats().state;
  if (!out.ready) return out;

  // throttle: 2. start téhož jména do 45 ms musí být odmítnut
  out.throttle = [A.play("ui_click"), A.play("ui_click")];
  await sleep(60);

  // každý efekt jednou (s volbami), ~80 ms rozestup → cca 3 s
  const names = A.names();
  out.played = 0;
  for (let i = 0; i < names.length; i++) {
    const ok = A.play(names[i], { volume: 0.6 + 0.4 * Math.random(), pitch: 0.9 + 0.2 * Math.random(), pan: (i % 3) - 1 });
    if (ok) out.played++; else out.errors.push("play() vrátilo false pro " + names[i]);
    await sleep(80);
  }
  out.names = names.length;

  // limit hlasů: nasyp 40 různých/stejných efektů naráz, nikdy nesmí být > 24
  for (let i = 0; i < 40; i++) A.play(names[i % names.length] + (i >= names.length ? "" : ""), { volume: Math.random() });
  out.voicesAfterBurst = A.__stats().voices;

  // hudba: každé téma ~700 ms s rostoucí intenzitou (crossfade se překrývá)
  for (let age = 0; age < 5; age++) {
    A.setMusic(age);
    A.setIntensity(age / 4);
    await sleep(700);
  }
  out.tracksDuringXfade = A.__stats().tracks;
  A.setMusic(null);

  // mixér
  A.setVolume({ master: 0.8, sfx: 0.7, music: 0.5 });
  out.vol = A.getVolume();
  A.setMuted(true); out.muted = A.isMuted(); out.playWhileMuted = A.play("coin");
  A.setMuted(false);
  A.setVolume({ master: 1, sfx: 1, music: 1 });
  await sleep(300);
  out.final = A.__stats();
  return out;
});

if (!live.ready) problems.push("AudioContext se nerozběhl (state=" + live.state + ")");
else {
  if (live.played !== live.names) problems.push(`zahráno ${live.played}/${live.names} SFX`);
  if (!(live.throttle[0] === true && live.throttle[1] === false)) problems.push("throttle 45 ms nefunguje: " + JSON.stringify(live.throttle));
  if (live.voicesAfterBurst > 24) problems.push("limit hlasů překročen: " + live.voicesAfterBurst);
  if (live.tracksDuringXfade < 1) problems.push("hudba neběží během crossfade");
  if (live.vol.master !== 0.8 || live.vol.sfx !== 0.7 || live.vol.music !== 0.5) problems.push("getVolume neodpovídá: " + JSON.stringify(live.vol));
  if (live.muted !== true || live.playWhileMuted !== false) problems.push("mute nefunguje");
  problems.push(...live.errors);
}

// --- 2) offline render: všechny SFX + 5 témat ---
const render = await page.evaluate(async () => {
  const A = window.AoWAudio;
  const rows = [];
  for (const n of A.names()) rows.push(await A.__renderTest(n, 2.6));
  for (let i = 0; i < 5; i++) rows.push(await A.__renderTest("music:" + i, 3));
  return rows;
});

console.log("\n== Live pass ==");
console.log(`context=${live.state} ready=${live.ready} sfx played=${live.played}/${live.names} throttle=${JSON.stringify(live.throttle)} voices after 40-shot burst=${live.voicesAfterBurst} (max 24) tracks during crossfade=${live.tracksDuringXfade}`);
console.log(`final stats=${JSON.stringify(live.final)}`);

console.log("\n== Offline render (OfflineAudioContext, 44.1 kHz stereo) ==");
console.log("name".padEnd(20) + "secs".padEnd(6) + "peak".padEnd(8) + "rms".padEnd(9) + "result");
let renderFails = 0;
for (const r of render) {
  let res;
  if (r.error) { res = "ERROR " + r.error; renderFails++; }
  else {
    const bad = [];
    if (r.peak < PEAK_MIN) bad.push("too quiet"); if (r.peak > PEAK_MAX) bad.push("clipping"); if (r.rms < RMS_MIN) bad.push("silent");
    res = bad.length ? "FAIL " + bad.join(",") : "ok";
    if (bad.length) renderFails++;
  }
  console.log(r.name.padEnd(20) + String(r.seconds ?? "-").padEnd(6) + (r.peak != null ? r.peak.toFixed(3) : "-").padEnd(8) + (r.rms != null ? r.rms.toFixed(4) : "-").padEnd(9) + res);
}
if (renderFails) problems.push(`${renderFails} render check(s) failed`);

await browser.close();

console.log("\n== Summary ==");
console.log(`rendered ${render.length} items (${render.length - 5} sfx + 5 music), render failures: ${renderFails}`);
if (problems.length) { console.log("PROBLEMS:\n - " + problems.join("\n - ")); process.exit(1); }
console.log("ALL CHECKS PASSED – no page errors, no console errors, all renders within [0.05, 0.98] peak.");
