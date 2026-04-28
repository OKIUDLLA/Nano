# 05 — Řídicí smyčka: dávkování, aktivace, zpětná vazba

## Tři regulační vrstvy

```
┌──────────────────────────────────────────────────────────────┐
│  1. Pomalá smyčka (týdny): dávkování LNP, biomarkery        │   ← lékař
│  ────────────────────────────────────────────────────       │
│  2. Střední smyčka (dny): FUS aktivace, browning rampa      │   ← protokol
│  ────────────────────────────────────────────────────       │
│  3. Rychlá smyčka (minuty): senzory FFA/Glc/HR              │   ← zařízení
└──────────────────────────────────────────────────────────────┘
```

## Vrstva 1: Dávkování

### Default schéma
- **Indukce**: 3× týdně po dobu 2 týdnů, dávka X mg/kg.
- **Údržba**: 1× týdně, dávka X/2 mg/kg.
- **Pauza**: každé 3 měsíce 4-týdenní washout pro snížení anti-PEG titrů.

### Měřené biomarkery (1× měsíčně)
- **Tělesná složení**: DXA, MRI nebo InBody — gold standard pro tuk/sval.
- **Plazma**: FFA, glukóza, HbA1c, FGF21, lipidogram, jaterní enzymy
  (ALT/AST), CK (svalová poškození), kreatinin.
- **Anti-PEG**: ELISA na anti-PEG IgM/IgG.
- **Imunogenicita**: cytokinový panel (IL-6, TNF-α, IFN-γ).

### Adaptace dávky
- ALT > 3× ULN → pauza, vyšetření jater.
- CK extrémně vysoké → pauza, vyloučit rabdomyolýzu.
- Anti-PEG > 10 % nad baseline → přechod na poly-sarkosin alternativu.

## Vrstva 2: FUS / NIR aktivace

### Praktický protokol
- **FUS sezení**: 30–60 minut, 1–2× denně.
- **Cílení**: subkutánní tuk (břicho, hýždě, stehna) a vybrané svalové
  skupiny.
- **Frekvence**: 1.0–1.5 MHz, intenzita SUB-ablativní (~1–3 W/cm²).
- **Mikrobubliny** (Definity, Optison) jako adjuvant pro mechanickou cavitaci
  → otevření endotelové bariéry.

### Časování s aktivitou
**Klíčový princip**: FUS-řízené uvolnění β3 agonisty NEbo IGF-1 mRNA musí být
**synchronizováno s aktivitou nebo jídlem** pro synergii:

- Před cardio → β3 aktivace v WAT → FFA do oběhu → cardio je oxiduje.
- Po silovém tréninku → IGF-1 mRNA do svalu → mTOR pulzace v anabolic window.

Bez této synchronizace efekt klesá o 50–70 % (lipolýza bez oxidace =
re-esterifikace).

## Vrstva 3: Wearable senzory + on-body kontrolér

### Co měřit kontinuálně
- **CGM** (kontinuální měření glukózy): Dexcom, FreeStyle Libre — schválené,
  dostupné.
- **CGM-FFA**: prototypy (Diamontech, kombinované senzory NIR-spektroskopií).
- **HR, HRV, teplota kůže**: smart watch.

### PID regulace
Software v telefonu upraví:
- Načasování FUS sezení (vyhne se hypoglykémii).
- Doporučení příjmu kalorií / proteinu.
- Případně dávku β3 antagonisty (atenolol-like) jako emergency brake.

```python
# Pseudokod regulátoru
if HR > 110 and at_rest:
    abort_FUS()
if FFA > 1.0_mmol_per_L for 4 hours:
    reduce_b3_dose()
if ketones > 1.5_mmol_per_L:
    suggest_carb_intake()
```

## Anti-magic sanity checks

Algoritmus sleduje:
1. **Reálná termodynamika**: pokud `kcal_in - TEE = 0` a hmotnost klesá,
   data jsou nespolehlivá (sklady glykogenu, voda) — neagresivnit nano.
2. **Plateau detection**: pokud 2 týdny bez změny tuku, **NEZVYŠOVAT** dávku
   automaticky (riziko toxicity), nýbrž zkontrolovat příjem kalorií.
3. **Muscle quality**: nárůst svalové hmoty bez nárůstu síly = otok / edém,
   ne pravá hypertrofie.

## Co se NEautomatizuje
- Schvalování dávky pro nového pacienta.
- Reakce na závažné nežádoucí účinky.
- Změna cílové tkáně (přesměrování z tuku na sval) — vyžaduje nový design
  cílicího ligandu.

## Souhrn
Řídicí smyčka má tři hierarchické úrovně. Nejcitlivější je
**synchronizace FUS s aktivitou** — nano je nástroj, ne kouzlo. Bez člověka,
který hýbe svým tělem a jí adekvátně, je terapie z velké části marná.
