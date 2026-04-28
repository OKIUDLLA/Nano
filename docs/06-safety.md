# 06 — Bezpečnost, kill-switch a etika

## Hierarchie rizik

```
GENOMIC IRREVERSIBLE  ← NE: žádné DNA editace germ-line (zákaz mezinárodní)
GENOMIC SOMATIC       ← omezeně: pouze za přísných IRB podmínek
EPIGENETIC            ← možno: PRDM16 indukce přes mRNA tranzientně
RNA-LEVEL             ← preferováno: siRNA, Cas13, mRNA terapie
PROTEIN-LEVEL         ← bezpečné: proteinové dodání lokálně
SMALL-MOLECULE        ← bezpečné: β3 agonista pod nano kontrolou
```

Tento návrh se drží **RNA a malé molekuly** vrstvy → reverzibilní, vyladitelné,
nejmenší dlouhodobá rizika.

## Kill-switch

### Tier 1: Cílový protein
mRNA náklad obsahuje **destabilizační doménu (DD)**, např. FKBP12-DD nebo
DHFR-DD (Banaszynski 2006, Iwamoto 2010). Bez ligandu (Shield-1, TMP) je
protein degradován proteasomem za <1 hodinu. Pacient bere TMP každých 12 h.
**Vysadit lék = okamžitě zastavit účinek**.

### Tier 2: Anti-pojistka
Inhalační/i.v. **β3 antagonista** (atenolol off-label) blokuje akutní
lipolýzu. Použití: bouřková epizoda hypertermie, FFA toxicita.

### Tier 3: Imunitní clearance
Pokud je nutné odstranit nano kompletně:
- Plazmaferéza odstraní cirkulující LNP.
- Anti-PEG protilátky (terapeuticky aplikované) urychlí clearance tkáňové
  populace.

### Tier 4: Genetický kill-switch (jen pro Cas13 systém)
Cas13 RNP má omezenou životnost (~48 h). Pokud je výjimečně nutná genová
úprava (nepravděpodobné), lze ji ukončit dodáním **anti-CRISPR proteinu**
(AcrIIA, AcrVIA — Pawluk 2018).

## Imunogenicita

### Riziko
- **PEG anti-PEG IgM**: opakované dávky → akcelerovaná clearance, anafylaxe
  (vzácně, ~1:10 000 u COVID vakcín).
- **mRNA cap / 5'UTR**: bez modifikace pseudouridinem → silná IFN-α odpověď.
- **DNA origami CpG motifs**: TLR9 aktivace.

### Mitigace
- Pseudouridinová mRNA (rutinní).
- PEG-cykling: alternující PEG vs. polysarkosin (PSar) každé 2 měsíce.
- Premedikace antihistaminiky u rizikových pacientů.
- Monitorování titrů anti-PEG IgM před každou dávkou.

## Off-target lipolýza

### Riziko
β3 stimulace v perivaskulárním tuku (PVAT) kolem koronárek → uvolnění
adipokinů s prozánětlivými efekty na endotel.

### Mitigace
- AND hradlo (prohibitin + ADRB3) výrazně snižuje aktivaci v
  ne-cílových depech.
- Monitoring CRP, IL-6.

## Off-target mTOR

### Riziko
mTOR aktivace **stará buňky** rychleji. Trvalá hyperaktivace = vyšší
incidence rakoviny (Loewith & Hall 2011).

### Mitigace
- IGF-1 mRNA jen lokálně, ne systémově.
- Pulzní dávkování (mTOR aktivní jen 4–6 h po FUS, pak rapamycin-sensitive
  návrat).
- Vyloučení pacientů s aktivními neoplaziemi.

## FFA toxicita

### Riziko
Vysoká plazmatická FFA (> 1.5 mmol/L) trvale → lipotoxicita
β-buněk pankreatu → diabetes; akumulace ektopického tuku v játrech, srdci.

### Mitigace
- Synchronizace lipolýzy s oxidací (cardio okno).
- Tier 2 kill-switch (β3 antagonista) jako rescue.
- CGM-FFA monitoring s automatickou pauzou nad 1.2 mmol/L.

## Etické limity

### CO ANO
- **Sarkopenie** (svalová atrofie u starších, pooperační, neurodegenerativní).
- **Kachexie** (rakovinová, AIDS, srdeční selhání).
- **Obezita s metabolickým syndromem** — diabetes 2. typu, NASH.
- **Sval po míšním poranění** (svalová atrofie z denervace).

### CO POD PŘÍSNÝMI PODMÍNKAMI
- Esthetic obezita bez komorbidit — pouze po vyčerpání konzervativních metod
  (dieta, fyzioterapie, schválená farmakoterapie typu GLP-1 agonisté
  semaglutid, tirzepatid).
- Sportovní výkon (anti-doping zákazy WADA platí).

### CO NIKDY
- **Germ-line editace** (zárodečné buňky) — Asilomar konsensus, mezinárodní
  smlouvy.
- **Vylepšování zdravých sportovců** mimo regulovaný systém.
- **Nezletilí** mimo terapeutickou indikaci (svalové dystrofie).

## Klinický vývoj — realistická časová osa

| Fáze | Čas | Co se ověřuje |
|---|---|---|
| Preklinika in vitro | 1 rok | Cell line testování každého modulu |
| Preklinika in vivo (myš, prase) | 2 roky | PK/PD, toxikologie, efekt |
| GMP výroba scale-up | 1 rok | Reprodukovatelnost, čistota |
| Fáze 1 (zdraví dobrovolníci) | 1 rok | Bezpečnost, dose escalation |
| Fáze 2 (specifická populace) | 2 roky | Účinnost, optimální dávka |
| Fáze 3 (registrační) | 3 roky | Pivotal trial, srovnání s SOC |
| FDA / EMA review | 1 rok | Schválení |

**Minimum 11 let**, optimisticky. Realisticky 15+. Projekt jako tento
(integrace 3+ technologií) může trvat 20.

## Souhrn

Bezpečnost má 4 vrstvy kill-switche, monitoring biomarkerů, etické limity
odvozené od stávajícího bioetického konsensu. Cílem je terapie pro reálné
medicínské stavy, ne kosmetický gadget.
