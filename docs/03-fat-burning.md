# 03 — Spalování tuku: tři mechanismy bez magie

## Výchozí termodynamika

**Tuk se ztrácí, jen když se dlouhodobě uvolní víc energie z tukového skladu,
než se ho doplní stravou.** Žádná molekula tuhle bilanci neobejde — může
jen ovlivnit vstup (chuť k jídlu) nebo výstup (TEE, total energy expenditure).

Tělesný tuk obsahuje ~7 700 kcal/kg využitelné energie. Pro úbytek 1 kg/týden
je nutný deficit ~1 100 kcal/den. Nano přidá **maximálně ~250–350 kcal/den**
přes browning — pomáhá, ale nenahradí dietu. Přesně to ukazuje scénář
`03-nano-only` v simulaci.

## Mechanismus 1: Akutní lipolýza přes β3-AR

### Signální kaskáda
```
β3-AR agonista → Gs → adenylát cykláza → cAMP ↑ → PKA
              → fosforylace HSL (hormone-sensitive lipase) a perilipinu
              → ATGL získá přístup k lipidové kapce
              → triglyceridy → diacylglyceroly → monoacylglyceroly → glycerol + FFA
              → FFA do oběhu
```

### Realita
- **Mirabegron** (FDA 2012 pro overactive bladder): u dospělých indukoval
  detekovatelné BAT FDG-uptake (Cypess 2015). Akutní efekt na lipolýzu
  reálný.
- **CL-316,243**: experimentální β3 agonista, robustní efekt u myší, slabší
  u člověka (rozdíl exprese ADRB3 mezi druhy).
- **Ataluren / mirabegron + cold exposure**: další zesílení lipolýzy.

### Co dělá nano navíc oproti perorálnímu mirabegronu?
- **Lokalizace**: nano-uvolnění uvnitř tukové tkáně → vyšší lokální
  koncentrace bez systémových kardiovaskulárních efektů.
- **Časování**: FUS-řízené uvolnění synchronizuje lipolýzu s časem fyzické
  aktivity, kdy FFA mohou být oxidovány. Bez tohoto časování FFA
  reesterifikují zpět na triglyceridy v játrech (futile cycle, žádný úbytek
  tuku — to je hlavní důvod, proč β3 agonisté samotní nedělají z lidí
  hubené stroje).

### Limit
**Bez kalorického deficitu nebo zvýšeného výdeje (oxidace)**, FFA uvolněné
lipolýzou se prostě reesterifikují. Tukový sklad se nezmění. Tato realita
je v simulaci modelována jako rovnováha lipolýzy a oxidace FFA s návratem
k baseline.

## Mechanismus 2: Browning bílé tukové tkáně

### Biologie
- **Bílý tuk (WAT)**: dlouhodobý sklad, jedna velká lipidová kapka, málo
  mitochondrií, neexprimuje UCP1.
- **Hnědý tuk (BAT)**: termogenní, mnoho mitochondrií, UCP1 (uncoupling
  protein 1) odděluje protonový gradient od ATP syntézy → energie se
  rozpustí jako teplo.
- **Béžový tuk**: WAT konvertovaný k UCP1+ fenotypu vlivem chronického
  β3 stimulu, chladu, nebo PRDM16/PGC-1α.

### Klíčové zdroje
- Cohen & Spiegelman *Cell* 2014: review browningu.
- Cypess et al. *Cell Metab* 2015: mirabegron u člověka aktivuje BAT.
- Sharma et al. (FGF21): browning amplifikátor.
- Saito et al. *Diabetes* 2009: BAT u dospělého člověka.

### Energetický příspěvek
Plně aktivovaný BAT u dospělého spaluje ~250–400 kcal/den (Cypess 2015,
Yoneshiro 2013). Pokud přidáme 10–15 % WAT konverzi na béžový (max
fyziologicky dosažitelné), získáme dalších 50–100 kcal/den.

V modelu: `browning_max_kcal_per_day = 350`, `browning_max_fraction = 0.20`.

### Cesta nano
```
LNP-mRNA(PRDM16, PGC-1α) → adipocyt → translace → indukce UCP1
                        → konverze WAT na béžový fenotyp (dny–týdny)
                        → trvalý termogenní bonus
```

mRNA je tranzientní — produkce proteinu týdny, ale béžový fenotyp si
buňka může udržet dlouhodobě (epigenetické přeprogramování). Pro
dlouhodobý efekt jsou potřeba opakované dávky.

## Mechanismus 3: FGF21 systémově

FGF21 (fibroblast growth factor 21) je metabolický hormon:
- Zvyšuje energetický výdej.
- Zlepšuje citlivost na inzulin.
- Indukuje browning autokrinně.

### Klinika
- **Akero (efruxifermin)**, **89bio (pegozafermin)**: FGF21 analogy ve fázi
  2/3 pro NASH. Reálné metabolické zlepšení u pacientů.
- Vedlejší efekty: GI, poklesy IGF-1, kostní marker změny — vyžaduje
  monitorování.

### Cesta nano
LNP s mRNA(FGF21) cílená do hepatocytů (jaterní default tropismus LNP zde
funguje ve prospěch). Týdenní dávka udržuje plazmatickou hladinu FGF21.

## Co NEdoporučuje tento model

- **DNP (2,4-dinitrofenol)**: rozpojuje OXPHOS systémově, hubne efektivně,
  ale **smrtelně toxický** (hypertermie, multiorgánové selhání). Známé
  úmrtí kulturistů.
- **Tyroidální hormon nadbytek**: ano, hubne, ale ničí sval, kost, srdce.
- **Liposukce**: mechanická, ne metabolická, vrací se rychle.

Naše tři mechanismy byly vybrány jako **modulační, ne destruktivní**.

## Souhrn
| Mechanismus | Akce | Příspěvek (kcal/den) | Vyžaduje |
|---|---|---|---|
| Akutní lipolýza | β3 → HSL/ATGL | 0 (bez oxidace) | synchronizaci s aktivitou |
| Browning | mRNA PRDM16/PGC-1α | 50–350 | týdny chronické indukce |
| FGF21 | systémový hormon | 100–200 | týdenní dávky |

**Maximum kombinovaného nano přínosu**: ~400–500 kcal/den. To je ~50 % toho,
co dělá střední dieta (deficit 800–1000 kcal/den). Nano je **doplněk**,
ne náhrada.
