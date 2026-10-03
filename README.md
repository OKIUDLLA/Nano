# Věky Války ⚔️ – remake legendární *Age of War*

Remake klasické flashové hry **Age of War** (Louissi / Max Games, 2007) postavený od nuly:
HTML5 Canvas + vanilla JavaScript, **bez buildu, bez assetů, bez serveru** – stačí otevřít
`index.html`. Veškerá grafika je kreslená procedurálně, veškerý zvuk i hudba se syntetizují
ve WebAudio. Hra funguje offline jako PWA.

Pravidla, čísla a chování **Klasického** režimu jsou převzatá z dekompilovaného originálu
(viz [docs/ORIGINAL.md](docs/ORIGINAL.md)) – 16 jednotek, 15 věží, 5 věků, 5 specialů,
fronta výcviku, sloty věží, ekonomika „zlato jen za zabité“, časovaná AI nepřítele i tři
obtížnosti (Normal / Harder / Impossible) jsou 1:1.

## Jak hrát

Otevři `index.html` (nebo hostuj složku jako statický web – pak funguje i instalace PWA).

- **Cíl:** přežij a znič nepřátelskou základnu vpravo dřív, než padne ta tvoje.
- **Jednotky** (karty nebo klávesy 1–4) se řadí do fronty (5 míst), vycvičené jdou samy vpřed a bojují.
- **Zlato** získáš jen za zabité nepřátele (130 % jejich ceny). **Zkušenosti** za zabité (2×) i vlastní padlé (0.5×).
- **Evoluce** (Enter) – při dostatku XP postoupíš do dalšího věku: lepší jednotky, věže, special a HP základny navíc.
- **Věže** – záložka Věže (Q/W/E), pak klik na plošinu základny. Další plošiny stojí 1000 / 3000 / 7500, prodej vrátí polovinu.
- **Special** (Mezerník) – každý věk jiný: déšť meteorů, déšť šípů, léčivá aura, nálet, smrtící paprsek. Obnova 50 s.
- **Základnu nejde opravit** – HP přibývá jen evolucí. Chraň ji za každou cenu!

Další klávesy: `A` přidat slot · `S` prodej věže · `P` pauza · `+`/`-` rychlost 1×/2×/3× · `M` zvuk · `Esc` menu.
Rozehraná hra se automaticky ukládá (tlačítko *Pokračovat* v menu).

## Protivníci a obtížnosti

| Protivník | Popis |
|---|---|
| **Klasický** | přesný port AI originálu: jednotky zdarma, pevný rozvrh evolucí (každých 200 s) a věží, max. 6 jednotek naživu |
| **Chytrý** | nová AI: platí za jednotky i věže, evolvuje za XP, posílá vlny podle složení tvé armády, používá special, umí Super vojáka |

| Obtížnost | Klasický | Chytrý |
|---|---|---|
| Normální | jako originál | reakce 1.5 s, bez bonusu |
| Těžší | nepřátelské jednotky ×1.3 HP a dmg | rychlejší reakce, +30 % zlata za killy, vyšší příjem |
| Nemožná | ×2.0 (jako originál) | okamžité reakce, +80 % zlata, nejvyšší příjem, 4 věže |

Chytrá AI má pevný příjem podle věku (klasická má jednotky zdarma – jinak by proti pasivnímu hráči
vyhladověla); detaily a naměřené win-raty jsou v [docs/BALANCE.md](docs/BALANCE.md).

## Struktura projektu

```
index.html             stránka a HUD
css/style.css          vzhled (kreslené „dřevěné“ UI, responzivní)
js/data.js             DATA – jednotky, věže, věky, specialy (čísla originálu)
js/engine.js           JÁDRO – deterministická simulace 40 ticků/s, bez DOM, běží i v Node
js/ai.js               chytrá AI (klasická je přímo v jádře)
js/sprites/common.js   kreslicí knihovna + registr spritů (kontrakt v hlavičce)
js/sprites/age0-4.js   procedurální sprity jednotek, věží, základen a pozadí pro každý věk
js/render.js           renderer (interpolace mezi ticky, částice, efekty, třes obrazu)
js/audio.js            syntetizované zvuky a 5 hudebních témat (WebAudio, bez souborů)
js/ui.js, js/main.js   HUD, menu, vstupy, herní smyčka, ukládání
sw.js, manifest.webmanifest, icon.svg   PWA
tests/engine.test.mjs  testy jádra (node:test, bez závislostí)
tests/browser.test.mjs testy celé hry v headless Chromiu (Playwright)
tools/sim.mjs          simulační balanc (N her × strategie × AI × obtížnost)
tools/sprite-viewer.html, tools/shot.mjs, tools/play.mjs, tools/audio-check.mjs   vývojové nástroje
docs/ORIGINAL.md       referenční data originálu (z dekompilace SWF)
docs/RESEARCH.md       rešerše (originál, pokračování, žánr, technika)
docs/GDD.md            návrh hry – co a proč přidáváme nad originál
docs/BALANCE.md        metodika a výsledky balancu
```

Klíčový princip: **`js/engine.js` neobsahuje nic z DOM** a používá seedovaný RNG. Stejný seed a
stejné akce dají vždy stejný průběh – proto lze celou hru testovat a balancovat bez prohlížeče.

## Testy a nástroje

```bash
npm test                 # jádro (žádné závislosti)
npm install              # jednorázově: Playwright
npm run test:browser     # celá hra v headless Chromiu
node tools/sim.mjs 20 40 all all           # balanc: 20 her, limit 40 min
node tools/play.mjs out.png 20 3           # automatický hráč + screenshot
node tools/shot.mjs "tools/sprite-viewer.html?age=2&freeze=0.4" out.png   # náhled spritů
```

Chromium pro Playwright se bere z `PLAYWRIGHT_CHROMIUM` (výchozí `/opt/pw-browsers/chromium`), jinak
z instalace Playwrightu (`npx playwright install chromium`). CI (GitHub Actions) spouští obojí.

## Poděkování

Age of War vytvořil **Louissi** (Max Games Studios, 2007). Tento projekt je nekomerční pocta
fanoušků; všechna původní grafika i zvuky byly nahrazeny vlastní procedurální tvorbou.
