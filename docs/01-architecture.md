# 01 — Architektura nanorobotu

## Vrstvený design (zvenku dovnitř)

```
┌─────────────────────────────────────────────────────────┐
│  Cílicí ligand (peptid / scFv / aptamer)               │   ← rozpoznání tkáně
│  ──────────────────────────────────────────────────    │
│  PEG-lipid plášť (stealth, snižuje opsonizaci)         │   ← ochrana před RES
│  ──────────────────────────────────────────────────    │
│  Ionizovatelný lipid (LNP) NEBO DNA origami šasi        │   ← strukturální obal
│  ──────────────────────────────────────────────────    │
│  Aktivační senzor (NIR-cleavable / pH / FUS-responzive)│   ← logické hradlo
│  ──────────────────────────────────────────────────    │
│  Náklad (mRNA / siRNA / Cas13 RNP / malá molekula)     │   ← terapeutický efekt
└─────────────────────────────────────────────────────────┘
```

Velikost: **80–120 nm**. Pod 8 nm filtruje ledvina (rychlá clearance), nad
200 nm pohlcuje retikuloendoteliální systém (Kupfferovy buňky v játrech).
Pásmo 80–120 nm je zlatý standard pro systémové LNP terapeutiky a využívá
ho mRNA-1273 (Moderna), BNT162b2 (Pfizer) i Onpattro (Alnylam, patisiran).

## Volba šasi

### Lipidové nanočástice (LNP)
- **Praxe**: Onpattro (FDA 2018), COVID-19 mRNA vakcíny, Hou et al. *Nature
  Nanotech.* 2021 (extrahepatální cílení).
- **Výhody**: zaveden GMP výroba, bezpečnostní profil studovaný na milionech
  pacientů, snadné enkapsulace mRNA/siRNA.
- **Limity**: defaultní tropismus do jater (ApoE → LDL receptor). Pro tukovou/
  svalovou tkáň je nutná SORT (Selective ORgan Targeting, Cheng 2020) nebo
  konjugace specifického ligandu.

### DNA origami
- **Praxe**: Rothemund 2006 (origami concept), Douglas et al. *Science* 2012
  („logic-gated nanorobot" otevírající se na povrchových markerech), Li 2018
  (anti-tumor origami in vivo).
- **Výhody**: programovatelná logika („AND" hradlo na 2 markery → vyšší
  selektivita), přesná geometrie, řízené uvolnění.
- **Limity**: imunogenicita CpG motivů, stabilita v séru (potřeba PEG/lipid
  obalení), drahá výroba ve velkém měřítku.

### Polymerní nanočástice (PLGA, PLA-PEG)
- **Praxe**: Eligard, Lupron Depot — schválené depotní formy.
- **Výhody**: pomalé řízené uvolňování (týdny), biodegradabilní.
- **Limity**: pomalá kinetika nehodí se pro on-demand FUS aktivaci.

**Volba pro tento návrh**: hybridní LNP-origami. LNP poskytuje obal a kapacitu
pro mRNA, vnitřní DNA origami nese „AND" hradlo (otevře se jen při současném
rozpoznání dvou markerů), což snižuje off-target vůči játrům.

## Náklad (cargo)

| Cílová tkáň | Náklad | Mechanismus |
|---|---|---|
| Bílý adipocyt | mRNA(PRDM16 + PGC-1α) | indukce browningu → UCP1 |
| Bílý adipocyt | malá molekula CL-316,243 nebo mirabegron | β3-AR agonismus → lipolýza |
| Bílý adipocyt | mRNA(FGF21) | systémové zvýšení energetického výdeje |
| Myocyt | siRNA(MSTN) | inhibice myostatinu |
| Myocyt | mRNA(IGF-1Ea) | aktivace mTORC1 + satelitní buňky |

mRNA je **modifikovaná pseudouridinem** (Karikó & Weissman 2005) pro snížení
imunogenicity. Cas13 (RNA-targeting CRISPR, Abudayyeh 2017) lze použít místo
siRNA – nehostí genomový edit a je vratná.

## Aktivační senzor

Tři kompatibilní spouštěče, lze je kombinovat (logické "AND"):

1. **Fokusovaný ultrazvuk (FUS)**: Insightec ExAblate má FDA klearanci pro
   neurologii a thalamotomii. Mechanismus: termální (~ 42–45 °C) nebo
   mikrobubliny otevírají strukturu — viz Mead 2017 (FUS-otevíraná hematoencefalická
   bariéra). Pro náš nano: termolabilní DNA helix (Tm ≈ 43 °C) se rozpadá v
   ohnisku → uvolnění nákladu.

2. **NIR světlo (700–1100 nm)**: hluboká penetrace tkáně (~5 cm), použito v
   PDT (photodynamic therapy). o-nitrobenzyl linkery se štěpí 365–405 nm,
   pro hlubší tkáně dvoufotonová absorpce 800 nm.

3. **pH responzivní**: ionizovatelné lipidy se protonizují v endozomu (pH 5.5)
   a destabilizují membránu → endozomální únik.

## Energetika

V intersticiu **není potřeba aktivní pohon** — vzdálenosti < 100 µm pokryje
difuze a tok intersticiální tekutiny. Spekulativní „nanopropellers" (helikální
nanostruktury otáčené magnetickým polem, Ghosh & Fischer 2009) jsou
laboratorní prototyp; nejsou součástí tohoto designu.

Energie pro chemickou reakci nákladu (např. enzymatický uvolňovací mechanismus)
pochází z nukleotidů zabudovaných v origami (ATP analog) nebo z lokální
glukózy.

## Životní cyklus

```
i.v. infuze → cirkulace (t½ ≈ 24 h) → extravazace cévami tukové/svalové tkáně
            → cílení AND-hradlem → endocytóza → endozomální únik
            → uvolnění mRNA → translace → terapeutický protein → degradace
            → DNA origami degradována nukleázami (~3 dny)
            → lipidy zpracovány hepatocyty
```

Půlka populace odeznívá za ~24 h v plazmě, ~3 dny v tkáni. Týdenní dávkování
udržuje terapeutickou koncentraci, viz simulace v `sim/scenarios.py`.

## Co je dnes možné a co ne

| Komponenta | Stav |
|---|---|
| LNP s mRNA | klinicky schválené (COVID, Onpattro) |
| Pseudouridinová modifikace | rutinní |
| FUS-řízené uvolňování | klinické fáze 2 (BBB opening) |
| Cílení peptidem CKGGRAKDC na vaskulaturu WAT | preklinika u myší |
| AAV9 tropismus pro sval | klinicky schválené (Zolgensma, Elevidys) |
| AND-hradlové origami | proof-of-concept *in vitro* (Douglas 2012) |
| Trvalá in-vivo perzistence týdny | jen pro AAV; LNP odeznívají rychleji |
| Závislé řízení dvou tkání jedním systémem | **nedosaženo** |

Tento design tedy spojuje existující stavební bloky do hypotetického
celku, který v jednom těle ještě nebyl ověřen.
