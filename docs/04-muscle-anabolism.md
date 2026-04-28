# 04 — Anabolismus svalů: bez tréninku to nepůjde

## Hard-kódovaná pravidla

1. **Bez mechanického zatížení (Piezo1, FAK signály) je nárůst svalu
   limitovaný.** Můžete dodat IGF-1, můžete inhibovat myostatin — bez
   tréninku zůstane efekt mírný (5–10 %).
2. **Bez dostatečného příjmu bílkovin (~1.6 g/kg/den)** chybí substrát.
3. **V kalorickém deficitu** je synthesa horší a breakdown vyšší. Lze sval
   stavět v deficitu, ale jen s vysokým proteinem a tréninkem.

Simulace tyto závislosti respektuje:
```python
synth_drive = leucine_factor * (0.4 + 0.6*training) * (0.4 + 0.6*S_mTOR_eff)
```

## Mechanismus 1: Inhibice myostatinu (GDF8)

### Biologie
- Myostatin je negativní regulátor svalového růstu (Lee & McPherron *Nature*
  1997, *PNAS* 2001).
- Myší knockout (Mstn -/-) má 2× větší svaly. Stejný fenotyp u "double-muscled"
  belgických modrých skotů a u jednoho známého chlapce s mutací MSTN.

### Klinika
- **Stamulumab** (Wyeth, anti-MSTN protilátka) — fáze 2 u DMD, ukončeno pro
  malý efekt.
- **Bimagrumab** (Novartis) — anti-ActRII protilátka, blokuje MSTN i activin.
  Snižovala tuk, mírný anabolický efekt. Fáze 2/3.
- **Trevogrumab, REGN-1033** (Regeneron) — pokračující programy.

Závěr literatury: **anti-MSTN snižuje sarkopenii u starších, ale nedělá z
lidí hulky**. Klinický efekt na svalovou hmotu obvykle +3–7 % za 6 měsíců.

### Cesta nano
LNP-siRNA(MSTN) cílená do myocytů přes ASSLNIA peptid + α7β1 integrin.
siRNA má reverzibilní účinek (resyntéza MSTN po vysazení) — bezpečnostně
preferované oproti CRISPR knockoutu.

Alternativa: **mRNA(follistatin)** — endogenní MSTN antagonista. Genová
terapie follistatinem (Mendell 2017, AAV1-FS-344) ukázala bezpečnost a
mírný efekt u Becker MD.

## Mechanismus 2: Lokální IGF-1 a aktivace mTORC1

### Signální kaskáda
```
IGF-1 → IGF-1R → PI3K → Akt → TSC1/2 inhibice → Rheb-GTP → mTORC1
                                                          → S6K1, 4E-BP1
                                                          → ribozomální syntéza proteinu
                                                          → svalová hypertrofie
```

### Realita
- **Systémové IGF-1** (mecasermin) FDA schváleno pro dwarfismus, ale má
  rakovinová rizika a hypoglykémie.
- **Lokální IGF-1Ea** (mGF, „mechano-growth factor") — splice varianta
  indukovaná tréninkem, lokální působení bez systémových rizik.
- **AAV-IGF1Ea** transgenní myši Sweeney lab. — větší síla, pomalejší
  sarkopenie.

### Cesta nano
LNP-mRNA(IGF-1Ea) lokálně do svalu pod FUS aktivací → tranzientní lokální
signalizace synchronizovaná s tréninkovým oknem. Klíčová synergie: IGF-1 sám
o sobě dělá málo, **IGF-1 + trénink** je silně aditivní.

## Mechanismus 3: Aktivace satelitních buněk

Satelitní buňky (Pax7+) jsou rezidentní svalové kmenové buňky. Aktivují se
při poškození svalu (mikrotrauma z tréninku) a fúzují s existujícími
vlákny → přidání myonukleů → trvalá hypertrofie.

### Cesty
- **HGF** (hepatocyte growth factor) → c-Met → satelitní aktivace.
- **Sphingosine-1-phosphate** (S1P) — chemoatraktant.

### Cesta nano
mRNA(HGF) v lokálním okně po tréninku zesílí přirozenou opravnou reakci.
Bezpečnostně rizikovější (HGF je proangiogenní, prokarcinogenní u některých
nádorů), proto preferujeme úsporné dávkování.

## Realistická hranice
- Zdravý dospělý netrénovaný: +5 kg svalu/rok přirozeně, ~+8–10 kg s nano +
  protein + trénink.
- Starší (sarkopenie): +1–2 kg svalu/6 měsíců — klinicky velmi cenné.
- Sportovec na vrcholu: malý prostor pro další nárůst, většinou ~1–2 kg/rok
  (hard cap genetiky a satellite cell pool).

## Co model NEDĚLÁ

- Neslibuje hypertrofii bez tréninku. V `scenario_nano_only` je `training=0.2`
  (chůze) a sval roste jen mírně (~1.8 kg).
- Neslibuje, že nano nahradí protein. `leucine_factor = min(1, protein/80g)`
  zastropuje synthesu, pokud chybí substrát.

## Bezpečnostní limity

- MSTN-null myši mají větší svaly, ale **horší vytrvalost** (méně vláken
  typu I, oxidativních). Inhibice MSTN by měla být dávkovaná.
- Hyper-mTOR aktivace dlouhodobě = **akcelerace stárnutí, rakovinové
  riziko**. Proto jen lokální, pulzní, FUS-řízené.
- IGF-1 systémově zvyšuje riziko CRC, prostaty. Lokálně mnohem bezpečnější.

## Souhrn

| Cesta | Maximální efekt | Časová škála | Riziko |
|---|---|---|---|
| MSTN inhibice (siRNA) | +5–10 % svalu | týdny–měsíce | nízké, vratné |
| IGF-1Ea lokálně | +10–15 % synthesy | dny | nízké (lokální) |
| HGF / satelitní | +5 % vláken | měsíce | mírné (proangiog.) |
| **Kombinace + trénink + protein** | +10–20 % svalu / 6 mes | – | – |
