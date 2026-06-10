# Věky Války — konkurenční analýza a dlouhodobá roadmapa

> Cíl: dotáhnout hru ze solidního prototypu do vyladěného, návykového titulu.
> Tento dokument je živý — položky se odškrtávají, jak je implementujeme.
> Každá iterace = malá ověřená změna (npm test + npm run test:browser musí zůstat zelené).

---

## 1. Konkurenční analýza

### 1.1 Age of War (Max Games, 2007) — náš hlavní vzor
- **Jádro:** lineární přetahování o území, evoluce 5 věků, 1 jednotka/typ na věk, obranné věže na základně, special útok na věk.
- **Co dělá dobře:** jednoduchá čitelná smyčka, jasná eskalace síly, „evoluce" jako odměna.
- **Co nám chybí oproti němu:** turret sloty s viditelným dostřelem, manuální cílení specialu, „base XP" gate, závěrečná obtížnostní křivka.
- **Poučení:** držet smyčku jednoduchou, ale dát hráči 2–3 smysluplná rozhodnutí za minutu.

### 1.2 Stick War / Stick War: Legacy (Max Games)
- **Jádro:** těžba zdrojů (zlato), ovládání jednotek, formace, mikromanagement, kampaň s mapami.
- **Co dělá dobře:** ovládání jednotek (stáhnout/zaútočit), různé formace, kampaňová progrese, odemykání.
- **Poučení pro nás:** přidat alespoň lehký taktický prvek (povel „ústup/držet linii"), kampaň s úrovněmi a odemykáním.

### 1.3 Clash Royale (Supercell)
- **Jádro:** karty s manou, deck-building, lanes, real-time PvP, rarita a vylepšování karet.
- **Co dělá dobře:** mana ekonomika (tempo), meta z deck-buildingu, krátké napínavé zápasy, progrese sbírkou.
- **Poučení pro nás:** „cooldown/mana" pojetí najímání místo čistě zlata? Spíš ne — ale **deck/loadout** (vyber 6 jednotek z větší nabídky) je skvělý meta-háček.

### 1.4 Plants vs. Zombies (PopCap)
- **Jádro:** lane defense, slunce jako zdroj, druhy jednotek s jasnými rolemi (sluneční, útočné, obranné, AoE), vlny, bossové.
- **Co dělá dobře:** čitelné role jednotek, „aha" momenty kombinací, vlnová dramaturgie, humor a osobitost.
- **Poučení pro nás:** dát jednotkám **jasné role** (tank/DPS/dostřel/AoE/support) a přidat **vlny a bosse**.

### 1.5 Idle/incrementální battlery (Idle Heroes, Swords & Souls, Bloons TD, Cookie Clicker škola)
- **Jádro:** offline/idle příjem, prestige/rebirth, dlouhá křivka vylepšení, automatizace, „number go up".
- **Co dělá dobře:** retence přes meta-progresi, prestige loop, automatizace nudných částí.
- **Poučení pro nás:** **offline příjem**, **prestige (znovuzrození) s trvalými bonusy**, strom vylepšení za měkkou měnu.

### 1.6 Souhrn — kde jsme silní a kde slabí
| Oblast | Stav teď | Cíl |
|---|---|---|
| Základní smyčka | ✅ funguje (věky, jednotky, věže, meteor, auto) | doladit tempo a rozhodování |
| Grafika | ✅ slušná (parallax, vektor, efekty) | animace útoku, polish, UI skiny |
| Zvuk | ❌ žádný | WebAudio SFX + hudba |
| Role jednotek | 🟡 implicitní (melee/střelec/tank) | explicitní role + counter systém |
| Obtížnost | 🟡 jediná, čistě časová AI | volitelná obtížnost + vlny + boss |
| Meta-progrese | ❌ žádná | prestige, strom vylepšení, odemykání |
| Onboarding | ❌ žádný | tutoriál + úvodní obrazovka |
| Retence | ❌ žádná | offline příjem, denní cíl, statistiky |
| Platforma | 🟡 web, lokální save | PWA, cloud save (volitelně) |

---

## 2. Dlouhodobá roadmapa (fázovaná)

Legenda: `[ ]` = TODO, `[x]` = hotovo. Položky jsou řazené tak, aby každá byla
samostatně dodatelná a otestovatelná.

### Fáze 1 — Pocit a polish (juice)
- [x] **F1.1 Statistiky zápasu** v jádře (kills, zlato vyděláno, jednotky vyslané, doba hry) + zobrazení na konci. *(engine + test)*
- [x] **F1.2 Animace útoku** jednotek (výpad/úder při zásahu) navázaná na efekty. *(render)*
- [ ] **F1.3 Zvuky (WebAudio)** — výstřel, zásah, najmutí, evoluce, meteor, výhra/prohra; bez assetů (syntéza). Tlačítko mute. *(render/ui)*
- [ ] **F1.4 Úvodní obrazovka + pauza** (Start/Pokračovat/Restart, ovládání). *(ui)*
- [ ] **F1.5 Obrazovka konce** s rozpisem statistik a tlačítkem „znovu". *(ui)*

### Fáze 2 — Hloubka soubojů
- [ ] **F2.1 Explicitní role jednotek** (tank/dps/střelec/AoE/support) + popisky v obchodě. *(engine data + ui)*
- [ ] **F2.2 Counter systém** (bonusové poškození podle role, např. kopiník vs. zvíře). *(engine + test)*
- [ ] **F2.3 AoE útoky** (mág/dělo zasáhne více jednotek). *(engine + test)*
- [ ] **F2.4 Vylepšení věží** (upgrade existující věže místo jen nákupu nové). *(engine + test)*
- [ ] **F2.5 Více specialů** na výběr (meteor / léčení / zrychlení) s cooldownem. *(engine + ui)*

### Fáze 3 — Obsah a obtížnost
- [x] **F3.1 Volba obtížnosti** (lehká/střední/těžká → příjem a tempo AI). *(engine + test + ui)*
- [ ] **F3.2 Vlnový režim** (přibývající vlny nepřátel, mezi nimi klid na nákup). *(engine + test)*
- [ ] **F3.3 Bossové** na konci věků (silná jednotka se schopností). *(engine + test)*
- [ ] **F3.4 Kampaň** s několika úrovněmi a rostoucí obtížností + odemykání. *(engine + ui)*
- [ ] **F3.5 Rozšíření rosteru** (4.–5. jednotka na věk, podpůrné typy). *(engine data)*

### Fáze 4 — Meta-progrese a retence
- [ ] **F4.1 Offline příjem** (zlato/XP za dobu mimo hru, strop). *(engine + test)*
- [ ] **F4.2 Prestige / znovuzrození** za trvalou měkkou měnu + bonusy. *(engine + test)*
- [ ] **F4.3 Strom vylepšení** (trvalé bonusy: příjem, HP základny, sleva jednotek). *(engine + ui)*
- [ ] **F4.4 Loadout** — vyber 6 jednotek z širší nabídky před zápasem. *(engine + ui)*
- [ ] **F4.5 Denní cíl / výzvy** + perzistentní statistiky a rekordy. *(engine + ui)*

### Fáze 5 — Platforma a kvalita
- [ ] **F5.1 PWA** (manifest + service worker, hratelné offline, instalovatelné). *(infra)*
- [ ] **F5.2 Responsivní ovládání** + dotyk pro mobil. *(ui/css)*
- [ ] **F5.3 Lokalizace** (CZ/EN přepínač). *(ui)*
- [ ] **F5.4 Nastavení** (hlasitost, kvalita efektů, reset dat). *(ui)*
- [ ] **F5.5 CI** — GitHub Actions spouštějící `npm test` na každém PR. *(infra)*

### Průběžně (každá iterace)
- Udržet `npm test` (jádro) i `npm run test:browser` (headless) zelené.
- Po každé funkci přidat/aktualizovat test a krátký záznam do CHANGELOG (sekce níže).
- Držet oddělení: logika v `js/engine.js`, grafika v `js/render.js`, UI/vstupy v `js/game.js`.

---

## 3. Changelog iterací
- **F1.1** Statistiky zápasu (zabití, vyděláno, vysláno, věže) + rozpis na konci hry.
- **F3.1** Volba obtížnosti (lehká/střední/těžká) ovlivňující příjem a tempo AI.
- **F1.2** Animace útoku (výpad, švih zbraně, záblesk u hlavně, zpětný ráz tanku).
