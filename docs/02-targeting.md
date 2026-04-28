# 02 — Cílení: jak rozeznat adipocyt od myocytu

Off-target distribuce je hlavní příčina toxicity systémových nano-terapeutik
(typicky 60–90 % dávky končí v játrech). Tento návrh kombinuje **trojí
selektivitu**: cévní cílení peptidem, povrchový marker tkáně, a logické
hradlo „AND".

## Adipocyty (bílá tuková tkáň, WAT)

### Endotel cévního zásobení tukové tkáně
- **Peptid CKGGRAKDC** vázající **prohibitin** na luminálním povrchu endotelu
  cév zásobujících WAT (Kolonin et al. *Nat Med* 2004).
- Originální studie použila peptid spojený s proapoptotickou KLAKLAKLAK
  sekvencí → redukce tělesné hmotnosti u obézních myší o 30 % za 4 týdny.
- **Náš design**: stejné cílení, ale **netoxický** signální náklad
  (β3 agonista, mRNA pro PRDM16). Etický rozdíl: nesabotovat tkáň, ale
  modulovat ji.

### Receptory na povrchu adipocytu
- **β3-adrenergní receptor (ADRB3)**: hojný na hnědém i bílém tuku, sporadický
  jinde. Mirabegron (FDA 2012, indikace overactive bladder) se na něj váže
  → využívá se off-label u BAT-stimulačních studií.
- **Adiponectin receptory** (AdipoR1/2): horší selektivita.
- **Leptin receptor**: spíš v hypotalamu.

### Aptamer alternativa
SELEX-vybrané RNA aptamery proti adipocytárním povrchovým proteinům jsou
publikovány (Liu 2011), ale méně klinicky ověřené než peptidy.

## Myocyty (kosterní sval)

### AAV9 jako tropismus inspirace
- AAV9 přirozeně tropický k srdečnímu a kosternímu svalu — využito
  Zolgensma (Novartis, SMA, FDA 2019) a Elevidys (Sarepta, DMD, FDA 2023).
- Mechanismus: vazba na N-linked galaktózu na povrchu myocytů.
- Pro nano: konjugace galaktosylované postranní řetězce na PEG-lipid napodobuje
  AAV9 tropismus.

### Peptidy a integriny
- **ASSLNIA** (Samoylova & Smith *Muscle Nerve* 1999): phage-display vybraný
  peptid, váže se na svalová vlákna.
- **Integrin α7β1**: hlavní laminin-vazebný integrin v dospělém kosterním
  svalu, vyšší exprese po tréninku (Mecham 1998).
- **Dystroglykan**: cílen v Duchenne studiích.

## Logické „AND" hradlo (Douglas 2012)

Origami nanorobot je uzavřen DNA „klipem", který drží šasi zavřené dokud
se neváží **dvě** rozpoznávací domény současně. Tím:

```
P(otevření | 1 marker mimo cíl)  → e.g. 1 %    (false positive)
P(otevření | 2 markery v cíli)   → ~95 %       (true positive)
```

Pro WAT volíme „AND(prohibitin, ADRB3)", pro sval „AND(galaktóza, α7β1)".

## Selektivita FUS aktivace

Fokusovaný ultrazvuk přidává **prostorovou selektivitu**: i když nano kolují
v celém těle, uvolnění nákladu (otevření termolabilního zámku) probíhá jen
v ohnisku FUS. Klinický FUS systém má rozlišení ~3 mm³.

Tím dosáhneme dvojí ochrany:
1. **Molekulární AND** (cílení) — sníží distribuci do off-target tkání.
2. **Prostorový OR** (FUS) — i když nano je všude, aktivuje se jen v ošetřené
   oblasti tukové či svalové tkáně.

## Co tato vrstvená selektivita neřeší

- **Játra**: i s prohibitin cílením skončí 30–60 % dávky v Kupfferových
  buňkách. Mitigace: PEGylace (snižuje opsonizaci), lower-dose / častější
  podání.
- **Slezina**: macrofágy zachytí část. Klinicky tolerované u schválených
  LNP.
- **Anti-PEG protilátky** po opakovaných dávkách (Yang 2016) — monitorovat
  titry, případně přepnout na alternativní stealth (poly-sarkosin).

## Souhrn

Trojí selektivita (cévní peptid + AND hradlo + FUS aktivace) je **dosažitelná
kombinace existujících technik**. Nic z toho zatím nebylo integrováno do
jediného produktu, ale každá vrstva existuje samostatně v klinickém
nebo preklinickém vývoji.
