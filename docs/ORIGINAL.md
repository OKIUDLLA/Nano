# Age of War (2007, Louissi / Max Games) – referenční data originálu

> Zdroj: dekompilace původního `age_of_war.swf` (archive.org, item `flash_age_of_war`,
> 3 628 478 B, SWF v9, **40 fps**, scéna 650×450, herní svět 1000 px široký).
> ActionScript 2 byl vyexportován nástrojem JPEXS FFDec 22.0.2, časování animací
> a hitzóny jsou z XML exportu struktury SWF. Vše níže jsou **změřená fakta**, ne odhady;
> kde je něco odvozené, je to označeno *(odvozeno)*.
>
> Časy jsou přepočtené z framů: `s = frames / 40`.

## 1. Základní smyčka (přesně podle kódu)

| Pravidlo | Hodnota v originálu |
|---|---|
| Startovní zlato hráče | **175 $** |
| Pasivní příjem | **žádný** – zlato jen za zabité nepřátele |
| Odměna za zabití | `round(cena_jednotky × 1.3)` zlata |
| XP za zabití nepřítele | `odměna × 2` (tj. 2.6× cena zabité jednotky) |
| XP za ztrátu vlastní jednotky | `round(odměna / 2)` (tj. 0.65× cena vlastní jednotky) |
| XP se při evoluci **neodečítá** | prahy jsou kumulativní: **4 000 / 14 000 / 45 000 / 200 000** |
| HP základny | start **500**; při evoluci do věku N `+300 × N` max i aktuální HP (→ 1100, 2000, 3200, 4700) |
| Oprava základny | neexistuje (jen evoluce přidá HP) |
| Fronta výcviku | **5 slotů** (1 ve výcviku + 4 čekající), zlato se strhne při zařazení; při plné frontě se vrátí |
| Sloty věží | 1 zdarma, další za **1 000 / 3 000 / 7 500 $** (max 4) |
| Prodej věže | vrátí **50 %** ceny |
| Special | k dispozici hned od startu; cooldown **2 000 framů = 50 s** |
| Obtížnost | Normal ×1.0, Harder ×1.3, Impossible ×2.0 – násobí **HP i poškození nepřátelských jednotek** (odměny nemění) |
| Výhra / prohra | HP základny < 0 |
| Pauza | ano (menu) |
| Kamera | scroll myší u okrajů (x>550 doprava, x<100 doleva), rozsah 0 … −350 px |

### Geometrie bojiště
- Hráčova základna: hitzóna ≈ x −17 … 154 (šířka 170.9 px, střed ≈ 68), jednotky se rodí na **x = 150**.
- Nepřátelská základna: hitzóna ≈ x 855 … 1026, jednotky se rodí na **x = 860**.
- Věže: ústí na x = 52 (hráč) / 948 (nepřítel), výšky slotů y = −80, −125, −172, −220 nad zemí (země y = 425).
- Vzdálenost mezi spawny ≈ 710 px; rychlost jednotek **0.7 px/frame = 28 px/s** → přechod ≈ 25 s.

## 2. Jednotky (tabulky `EN` + `ES` + animace)

Formát v SWF: `EN[id] = [jméno, cena, doba výcviku (framy)]`,
`ES[id] = [HP, melee dmg, ranged dmg, melee dosah, střelecký dosah]`.
Poškození každého úderu = `dmg − random(0..2)`.
Perioda útoku = délka smyčky animace (u animací se dvěma variantami průměr obou).

| id | Věk | Jméno | Cena | Výcvik | HP | Melee dmg | Ranged dmg | Melee dosah | Střel. dosah | Perioda útoku | DPS (melee / ranged) | Šířka hitzóny | Odměna $ / XP |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 Stone | Club man | 15 | 1.0 s | 55 | 16 | – | 20 | – | 1.00 s | 16 | 31.6 | 20 / 40 |
| 2 | 1 Stone | Slingshot man | 25 | 1.0 s | 42 | 10 | 8 | 20 | 100 | 1.00 s / 0.80 s (chůze 1.08 s) | 10 / 10 | 31.6 *(odv.)* | 33 / 66 |
| 3 | 1 Stone | Dino rider | 100 | 2.5 s | 160 | 40 | – | 45 | – | 1.13 s | 35.6 | 81.4 | 130 / 260 |
| 4 | 2 Castle | Sword man | 50 | 1.75 s | 100 | 35 | – | 20 | – | 1.21 s | 28.9 | 31.6 | 65 / 130 |
| 5 | 2 Castle | Archer | 75 | 1.25 s | 80 | 20 | 9 | 20 | 130 | 1.21 s / 1.00 s | 16.5 / 9 | 31.6 *(odv.)* | 98 / 196 |
| 6 | 2 Castle | Knight | 500 | 2.5 s | 300 | 60 | – | 60 | – | 1.30 s | 46 | 98.4 | 650 / 1300 |
| 7 | 3 Renaissance | Dueler | 200 | 2.5 s | 200 | 79 | – | 25 | – | 1.03 s | 77 | 33.5 | 260 / 520 |
| 8 | 3 Renaissance | Mousquettere | 400 | 2.5 s | 160 | 40 (nepoužito) | 20 | 25 | 130 | 1.15 s (i zblízka střílí) | 17.4 | 33.5 *(odv.)* | 520 / 1040 |
| 9 | 3 Renaissance | Canoneer | 1 000 | 5.0 s | 600 | 120 | – | 25 | – | 1.95 s | 61.5 | 33.5 *(odv.)* | 1300 / 2600 |
| 10 | 4 Modern | Melee Infantry | 1 500 | 2.5 s | 350 | 100 | – | 25 | – | 0.75 s | 133 | 33.5 *(odv.)* | 1950 / 3900 |
| 11 | 4 Modern | Infantry | 2 000 | 2.5 s | 300 | 60 | 30 | 25 | 130 | 0.53 s / 0.53 s (chůze 1.2 s) | 114 / 57 | 33.5 *(odv.)* | 2600 / 5200 |
| 12 | 4 Modern | Tank | 7 000 | 7.5 s | 1 200 | 300 | – | 100 | – | 1.58 s | 190 | 173.5 | 9100 / 18200 |
| 13 | 5 Future | God's Blade | 5 000 | 2.5 s | 1 000 | 250 | – | 40 | – | 0.93 s | 270 | 44.5 | 6500 / 13000 |
| 14 | 5 Future | Blaster | 6 000 | 2.5 s | 800 | 130 | 80 | 40 | 130 | 0.69 s / 0.35 s (chůze 0.95 s) | 189 / 229 | 44.5 *(odv.)* | 7800 / 15600 |
| 15 | 5 Future | War machine | 20 000 | 7.5 s | 3 000 | 600 | – | 100 | – | 2.25 s | 267 | 116.5 | 26000 / 52000 |
| 16 | 5 Future | Super Soldier | 150 000 | 2.5 s | 4 000 | 400 | 400 | 40 | 150 | 0.69 s / 0.35 s | 582 / 1143 | 44.5 | 195000 / 390000 |

Poznámky z kódu:
- Střelci (`range_shoot > 0`) útočí **zblízka melee hodnotou**, pokud je cíl blíž než melee dosah, jinak střílí, pokud je v dostřelu. Mousquettere má pro oba režimy stejnou animaci volající `ranged_hit` → jeho melee dmg 40 se nikdy nepoužije.
- Super Soldier používá grafiku Blasteru (stejný sprite), jen jiné hodnoty.
- Smrt: 80 framů (2 s) animace, pak zmizí.
- Odměna/XP platí symetricky i pro nepřítele (jeho zlato se ale ve skutečnosti nepoužívá – viz AI).

### Pohyb a boj (ze skriptu `ennemy`)
- Každých 5 framů jednotka přepočítá: nejbližší **jakoukoli** jednotku před sebou (`closest_dist`) a nejbližší **nepřátelskou** (`ed`, měřeno od okraje hitzóny cíle). Základny jsou v seznamu cílů jako jednotky s hitzónou 170.9 px.
- Jde dopředu, dokud `|closest_dist| > limit`, kde `limit = ½ vlastní hitzóna + ½ hitzóna předchozí jednotky + 2 px` → jednotky se řadí do zástupu, netlačí se.
- Útok zblízka, když `|ed| < melee dosah`; jinak střelba, když `|ed| < střelecký dosah` (střelci střílí i při chůzi – `shootwalk`).
- Žádné counter bonusy, žádný AoE u jednotek, žádné kolize mezi stranami kromě zastavení.

## 3. Věže (tabulky `TU` + `TS`)

Formát: `TU[id] = [jméno, cena, ?]`, `TS[id] = [perioda střelby (framy), id střely, dmg, dosah]`.
Věž každých 10 framů vybere **nejbližší** nepřátelskou jednotku (euklidovsky od ústí) a střílí, je-li blíž než dosah; otáčí se k cíli (kromě Oil).

| id | Věk | Jméno | Cena | Perioda | Dmg | Dosah | DPS | Střela / chování |
|---|---|---|---|---|---|---|---|---|
| 1 | 1 | Rock slingshot | 100 | 0.75 s | 12 | 350 | 16 | balistický kámen (7 px/f, g 0.05) |
| 2 | 1 | Egg automatic | 200 | 0.275 s | 5 | 300 | 18 | rychlá vejce |
| 3 | 1 | Primitive Catapult | 500 | 1.75 s | 25 | 400 | 14 | balistický balvan |
| 4 | 2 | Catapult | 500 | 1.75 s | 40 | 400 | 23 | balistický |
| 5 | 2 | Fire Catapult | 750 | 1.75 s | 50 | 400 | 29 | ohnivá koule |
| 6 | 2 | Oil | 1 000 | 2.5 s | 4 / kapka | 300 | až ~32, více cílů | 1 s proud ≈ 20 kapek, každá zraní jeden cíl; neotáčí se |
| 7 | 3 | Small Cannon | 1 500 | 1.75 s | 30 | 500 | 17 | rychlá koule (28 px/f) |
| 8 | 3 | Large Cannon | 3 000 | 1.75 s | 70 | 500 | 40 | rychlá koule |
| 9 | 3 | Explosives Cannon | 6 000 | 1.75 s | 100 | 500 | 57 + střepiny | po zásahu 7 střepin × 30 dmg (AoE) |
| 10 | 4 | Single Turret | 7 000 | 1.0 s | 70 | 500 | 70 | kulka |
| 11 | 4 | Rocket Turret | 9 000 | 1.25 s | 100 | 500 | 80 | raketa se zrychlením |
| 12 | 4 | Double Turret | 14 000 | 0.55 s | 60 | 500 | 109 | kulky |
| 13 | 5 | Titanium Shooter | 24 000 | 1.0 s | 100 | 400 | 100 | projektil |
| 14 | 5 | LazerCannon | 40 000 | 0.25 s | 40 | 500 | 160 | laser |
| 15 | 5 | IonRay | 100 000 | 0.25 s | 60 | 500 | 240 | paprsek |

## 4. Specialy (1 na věk, cooldown 50 s, dostupný hned od startu)

| Věk | Special | Mechanika v kódu |
|---|---|---|
| 1 Stone | Déšť meteorů | 5 s; každých 9 framů 1 meteor (≈22), **200 dmg** na zasaženou jednotku, x náhodně 200–700, úhel 80–100°, třes obrazu ±5 px |
| 2 Castle | Déšť šípů | 5 s; každých 5 framů 1 šíp (≈40), **200 dmg**, stejná oblast, třes ±2 px |
| 3 Renaissance | Léčivá aura | 15 s; **všechny vlastní jednotky +1 HP/frame (40 HP/s)** do maxima |
| 4 Modern | Nálet | letadlo z x −100 → 1000 rychlostí 4 px/f; každých 15 framů bomba **400 dmg** dokud x < 700 (≈13 bomb) |
| 5 Future | Iontový paprsek | 12 úderů **1000 dmg** na x = 180, 230, … 730, každých 5 framů (1.5 s sweep); každý úder zraní jednu jednotku v místě |

Všechny specialy zraňují jen nepřátele; škody se nemění obtížností.

## 5. AI nepřítele (skript `base_comp`) – řízená časovačem, bez ekonomiky

- Jednotky nepřítele **nic nestojí** (`ecash` je překlep, nikdy se nekontroluje) → AI je čistě časovaná.
- Každých 40 framů (1 s): s pravděpodobností **30 %** se rozhodne trénovat. Trénuje jen, když netrénuje (`u_timer < −5`) a má **méně než 6 jednotek naživu**.
- Výběr jednotky: náhodně z prvních `unit_level` jednotek svého věku; `unit_level` = 1 od začátku věku, **2 po 37.5 s**, **3 po 125 s** věku. Doba výcviku dle tabulky.
- **Evoluce každých 200 s** (8000 framů) bez ohledu na XP; základna +300×věk HP. Do věku 5 za 13 min 20 s.
- Věže podle pevného rozvrhu (čas od začátku věku):
  - Věk 1: 25 s Rock slingshot; 100 s prodat → Egg automatic; 150 s prodat → Primitive Catapult.
  - Věk 2: 25 s → Catapult; 100 s 2. slot, slot1 → Oil; 150 s slot2 Fire Catapult.
  - Věk 3: 25 s slot1 → Small Cannon; 100 s 3. slot, slot2 → Small Cannon; 150 s prodat 1+2, slot3 Explosives Cannon.
  - Věk 4: 125 s slot1 Single Turret; 175 s prodat 1+3, slot2 Rocket Turret.
  - Věk 5: 125 s slot1 Titanium; 300 s prodat vše, slot2 LazerCannon; 500 s 4. slot, prodat vše, slot4 IonRay.
- Obtížnost násobí HP a dmg nepřátelských jednotek (1.0 / 1.3 / 2.0).

## 6. UI a prezentace originálu
- HUD: dřevěné prkno – „Money“, „Exp“, progress bar výcviku, 5 ikon fronty, „Menu“ (jednotky / věže / prodej / evoluce / přidat slot), tlačítko „Special“ s kruhovým odpočtem.
- Při stavbě věže se kurzor změní na siluetu věže a klikne se na slot na základně.
- Hover na tlačítko zobrazí cenu a jméno (`"15$ - Club man"`, `"4000 Xp - Evolve to next age"`).
- Grafika: kreslený vektorový styl, jednotky ~30–45 px široké (tank 174 px), základna jako hromada kamení s dřevěným lešením pro sloty věží; obloha, zelené kopce, stromy.
- Menu: Play / Instructions / Extras; volba obtížnosti Normal / Harder / Impossible; kvalita High/Medium/Low.
- Text instrukcí: *„The goal of the game is to survive and destroy the ennemy base. … You cannot repair your base, but it will gain health points everytime you evolve to the next age.“*

## 7. Odvozené poznatky pro remake
- Ekonomika je **čistě zabíjecí**: bez killů nejsou peníze – proto tempo určuje to, kolik AI pošle; AI posílá ~1 jednotku za (výcvik + ~3 s), max 6 naživu.
- Odměna 1.3× ceny + 2.6× XP znamená, že každá výměna 1:1 je pro hráče zisková; snowball je vestavěný.
- Super Soldier (150 000 $, 1143 DPS ranged, 4000 HP) je legendární „end-game“ jednotka – prakticky nezastavitelná.
- Věže jsou v originálu slabé proti pozdním jednotkám (IonRay 240 DPS vs. Super Soldier 4000 HP) → hra se rozhoduje jednotkami.
- Nejčastější kritika (viz RESEARCH.md): AI je předvídatelná, Impossible je jen číselný násobek, zdlouhavý mid-game, žádný obsah po výhře.

## 8. Surová data (pro reprodukovatelnost)
```
EN = ["",["Club man",15,40],["Slingshot man",25,40],["Dino rider",100,100],["Sword man",50,70],["Archer",75,50],["Knight",500,100],["Dueler",200,100],["Mousquettere",400,100],["Canoneer",1000,200],["Melee Infantry",1500,100],["Infantry",2000,100],["Tank",7000,300],["God's Blade",5000,100],["Blaster",6000,100],["War machine",20000,300],["Super Soldier",150000,100]];
TU = ["",["Rock slingshot",100,20],["Egg automatic",200,30],["Primitive Catapult",500,40],["Catapult",500,20],["Fire Catapult",750,30],["Oil",1000,40],["Small Cannon",1500,20],["Large Cannon",3000,30],["Explosives Cannon",6000,40],["Single Turret",7000,20],["Rocket Turret",9000,30],["Double Turret",14000,40],["Titanium Shooter",24000,20],["LazerCannon",40000,30],["IonRay",100000,40]];
TS = ["",[30,1,12,350],[11,2,5,300],[70,3,25,400],[70,3,40,400],[70,4,50,400],[100,5,4,300],[70,6,30,500],[70,6,70,500],[70,7,100,500],[40,8,70,500],[50,9,100,500],[22,8,60,500],[40,12,100,400],[10,10,40,500],[10,11,60,500]];
ES = ["",[55,16,0,20,0],[42,10,8,20,100],[160,40,0,45,0],[100,35,0,20,0],[80,20,9,20,130],[300,60,0,60,0],[200,79,0,25,0],[160,40,20,25,130],[600,120,0,25,0],[350,100,0,25,0],[300,60,30,25,130],[1200,300,0,100,0],[1000,250,0,40,0],[800,130,80,40,130],[3000,600,0,100,0],[4000,400,400,40,150]];
EV = [4000,14000,45000,200000];
```
Periody útoku (framy, z délek animačních smyček): 1:40 · 2:40/32/43 · 3:45 · 4:47+50 · 5:(47+50)/40/40 · 6:52 · 7:36+46 · 8:46/46/48 · 9:78 · 10:30 · 11:21/21/48 · 12:63 · 13:37 · 14:(31+24)/14/38 · 15:90 · 16:(31+24)/14/38
(formát melee / shoot / shootwalk; `a+b` = dvě náhodné varianty).
