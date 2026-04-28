# Nano: vědecky podložený koncept nanorobota pro řízenou lipolýzu a svalovou anabolismus

Repozitář obsahuje **designový dokument** + **numerickou simulaci** popisující,
jak by mohl být postaven systém nanorobotů, který:

1. řízeně spouští lipolýzu v bílé tukové tkáni (akutní β3-AR signál + dlouhodobý
   browning přes mRNA pro PRDM16/PGC-1α);
2. lokálně podporuje anabolismus kosterního svalu (siRNA proti myostatinu +
   mRNA pro IGF-1Ea);
3. je řízen buď externě (fokusovaný ultrazvuk / NIR) nebo **plně autonomně**
   přes implantovaný řídicí modul s uzavřenou smyčkou.

Vše je opřené o publikované studie. Co je dnes klinicky možné, co je v
preklinice a co je extrapolace, je explicitně rozlišeno v `docs/`.

## Dva režimy

- **Lifestyle režim** (scénáře 01–05): nano je **multiplikátor** uživatelovy
  diety a tréninku. Bez deficitu kalorií tuk neklesne dramaticky, bez tréninku
  sval nenaroste dramaticky.
- **Autonomní režim** (scénáře 06–07): nano **nahrazuje** dietu i trénink přes
  forced metabolic burn (UCP3/UCP2), glykosurii a nano-EMS. Uživatel jí jak
  chce, necvičí. Detail viz `docs/08-autonomous-control.md`.

## Co toto NENÍ

- Není to recept ani návod na výrobu zařízení.
- Není to medical advice. Simulace je pedagogická, ne prediktivní pro
  konkrétního pacienta.
- I autonomní režim má **termodynamické a substrátové limity** —
  extrémní přejídání (>3000 kcal/den) ani nano nezvládne, a bez
  proteinu sval neporoste, ať EMS dělá cokoliv.

## Struktura

```
Nano/
├── README.md                  ← tento soubor
├── docs/
│   ├── 01-architecture.md     ← vrstvený design nanorobotu (LNP + DNA origami)
│   ├── 02-targeting.md        ← jak rozeznat adipocyt vs. myocyt (peptidy, AND hradlo)
│   ├── 03-fat-burning.md      ← lipolýza, browning, FGF21
│   ├── 04-muscle-anabolism.md ← myostatin, mTOR, satelitní buňky
│   ├── 05-control-loop.md     ← FUS aktivace, dávkování, biomarkery
│   ├── 06-safety.md           ← kill-switch, imunogenicita, etika
│   ├── 07-references.md       ← primární zdroje
│   └── 08-autonomous-control.md ← uzavřená smyčka: forced burn + glykosurie + EMS
├── sim/
│   ├── model.py               ← ODE model tělesného složení (scipy)
│   ├── nanobot.py             ← farmakokinetika nanorobotů
│   ├── scenarios.py           ← 5 předdefinovaných scénářů
│   └── plot.py                ← vizualizace
├── tests/
│   └── test_model.py          ← sanity testy (mass balance, hranice)
├── figs/                      ← vygenerované grafy
└── requirements.txt
```

## Spuštění

```bash
pip install -r requirements.txt

# Spustit všechny scénáře (90denní simulace) a vygenerovat grafy
python -m sim.scenarios

# Spustit testy
pytest tests/
```

## Scénáře a interpretace

7 scénářů — 5 lifestyle + 2 autonomní:

| # | Scénář | kcal | Protein | Trénink | Nano | Výsledek (90 dní) |
|---|---|---|---|---|---|---|
| 01 | Baseline | 2100 | 80 g | nízký | – | +2 kg tuku, +1.3 kg svalu |
| 02 | Pouze dieta | 1600 | 100 g | nízký | – | −3.6 kg tuku, +1 kg svalu |
| 03 | Lifestyle nano | 2100 | 80 g | nízký | ✓ FUS | +0.8 kg tuku, +1.9 kg svalu |
| 04 | Lifestyle kombinace | 1700 | 130 g | vysoký | ✓ FUS | **−6.3 kg tuku, +2.3 kg svalu** |
| 05 | Lifestyle limit | 2300 | 100 g | mírný | ✓ agresivně | +1.7 kg tuku, +2.5 kg svalu |
| **06** | **Autonomní** | **2500** | **100 g** | **0** | **✓ trvalý implantát + EMS** | **−3.7 kg tuku, +3.5 kg svalu** |
| 07 | Autonomní limit | 3000 | 60 g | 0 | ✓ max | +1.8 kg tuku, +3.0 kg svalu |

**Scénář 06** ukazuje plně autonomní režim: uživatel jí přebytek (2500 kcal),
necvičí, a přesto ztratí tuk a získá sval. Mechanismus: forced burn 500 kcal/den
přes UCP3/UCP2 + glykosurie + nano-EMS. **Scénář 07** ukazuje hranice systému:
extrémní přejídání (3000 kcal) + málo proteinu → nano nezvládne všechno.

### Příklad výstupu

Po `python -m sim.scenarios` vznikne v `figs/`:
- `00-comparison.png` — srovnání ΔTuk a ΔSval všech 5 scénářů.
- `01-baseline.png` až `05-overshoot.png` — detaily jednotlivých scénářů
  (hmota, FFA, glukóza, populace nanorobotů, browning frakce).

## Model — co se simuluje

Stavový vektor (7 proměnných):
- `M_fat`, `M_muscle` [kg] — kompartmenty tělesné kompozice.
- `FFA`, `Glc` [mmol/L] — plazmatické metabolity.
- `N_circ`, `N_active` [částic/mL] — populace nanorobotů
  (dvoukompartmentový PK model, t½ plazma 1 d, tkáň 3 d).
- `beige_frac` [0..0.20] — podíl bílého tuku konvertovaný na béžový (UCP1+).

Receptorové obsazení β3-AR a mTORC1 je počítáno algebraicky (Hill funkce
N_active a aktivačního okna) — obsazení receptoru je v měřítku dnů
prakticky okamžité, browning a změny hmoty jsou pomalé ODE.

Konstanty kalibrovány na publikované hodnoty:
- 1 kg tuku = 7700 kcal (Hall NIH model).
- BMR = 22 × M_lean + 4.5 × M_fat + organy (Cunningham + úpravy).
- Browning max = 350 kcal/den při saturaci (Cypess 2015 BAT).
- Myostatin inhibice + IGF-1 + trénink → +5–15 % svalu / 6 měsíců (Mendell 2017,
  bimagrumab fáze 2).

## Realistická časová osa do klinické reality

| Fáze | Roky |
|---|---|
| Preklinika in vitro | 1 |
| Preklinika in vivo | 2 |
| GMP scale-up | 1 |
| Fáze 1 | 1 |
| Fáze 2 | 2 |
| Fáze 3 | 3 |
| FDA/EMA review | 1 |
| **Minimum** | **11 let** |

Realisticky 15–20 let pro integrovaný produkt řídící obě tkáně.

## Cílová indikace

Tento koncept směřuje na **medicínské stavy**, ne kosmetiku:
- sarkopenie u stárnoucích / pooperačních pacientů,
- kachexie (rakovinová, AIDS, srdeční selhání),
- obezita s metabolickým syndromem (komorbidní s diabetem 2. typu, NASH),
- svalová atrofie po míšním poranění.

Použití u zdravých sportovců spadá pod WADA zákazy. Použití u nezletilých
mimo terapeutickou indikaci je eticky vyloučeno.

## Licence

Educational / research use only. Není farmaceutický produkt.
