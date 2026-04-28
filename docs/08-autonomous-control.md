# 08 — Autonomní režim: nano nahrazuje dietu i trénink

> Tento dokument popisuje **uzavřenou smyčku**, ve které uživatel nemusí
> dodržovat dietu ani cvičit. Nano sám reguluje energetickou bilanci a
> svalovou aktivaci. Termodynamika přitom zůstává neporušená — nano jen
> přesune místo, kde se rozhodne, kolik energie tělo vydá.

## Tři pilíře autonomie

```
┌────────────────────────────────────────────────────────────────────┐
│  1. Forced metabolic burn  ──> UCP3 ve svalu, UCP2 v játrech      │
│     (cíl 500 kcal/den nad rámec normálního TEE, BEZ ohledu na     │
│      příjem; pokud strava nestačí, čerpá z tukových rezerv)        │
│  ─────────────────────────────────────────────────────────────    │
│  2. Glykosurie  ──> SGLT-mimetic v ledvinách                      │
│     (vylučování glukózy močí; aktivuje se při hyperglykémii      │
│      i preventivně po jídle)                                       │
│  ─────────────────────────────────────────────────────────────    │
│  3. Nano-EMS  ──> piezoelektrické nano-stimulátory u NMJ          │
│     (8 h denně cyklí svalové skupiny; nahrazuje vědomý trénink   │
│      jako mechanická signalizace pro mTOR a satelitní buňky)      │
└────────────────────────────────────────────────────────────────────┘
```

Každý pilíř má svůj vědecký precedens. Žádný nebyl zatím integrován s
ostatními do jednoho systému.

## Pilíř 1: Forced metabolic burn (UCP3/UCP2)

### Biologický přesah
- **DNP (2,4-dinitrofenol)**: rozpojuje OXPHOS, dissipuje 1000+ kcal/den jako
  teplo. Smrtelně toxický, protože **nemá off-switch**.
- **UCP1 (BAT)**: fyziologický rozpojovač u savců. Saito 2009 — ~250–400
  kcal/den u dospělého.
- **UCP3 ve svalu**: indukovatelný, fyziologický, mírnější než DNP. Aktivace
  přes thiazolidindiony, β3 agonisty, FFA samé.
- **UCP2 v játrech**: zapojen do regulace ROS i termogeneze.

### Cesta nano
LNP-mRNA(UCP3) cílená do svalu (peptid ASSLNIA + α7β1) + LNP-mRNA(UCP2) do
hepatocytů (defaultní jaterní tropismus). FUS/NIR aktivace spouští expresi
**řízeně**: nano má vestavěný senzor (např. fluorescenční glukózový senzor),
který senzuje energetický stav a moduluje expresi UCP3 přes
DD (destabilizační doménu) — TMP přivádí stabilizační molekulu.

### Setpoint místo on/off
Klíčový princip: nano nemá jen "zapnuto/vypnuto", ale **proporcionální**
regulaci. Závazný setpoint = 500 kcal/den nadbytek spalování. Reaguje na:
- Aktuální surplus z jídla → spaluje food first.
- Nedostatek → dosahuje setpointu z tukových zásob (= úbytek tuku).
- Hypoglykémie → setpoint dočasně sníží (safety).

### Bezpečnostní strop
- **Tepelná**: max ~1000 kcal/den dlouhodobě (limit pocení a kožní radiace).
- **Elektrolytová**: zvýšené pocení = ztráta Na+, K+, Mg2+ → suplementace.
- **Cardiac**: zvýšený TEE = vyšší klidová HR. Monitoring přes wearable.

## Pilíř 2: Glykosurie (SGLT-mimetic)

### Biologický přesah
- **SGLT2 inhibitory** (empagliflozin, dapagliflozin, kanagliflozin):
  FDA schválené pro DM2. Blokují reabsorpci glukózy v proximálním tubulu →
  ~75 g glukózy/den vyloučena močí = **~300 kcal/den ztráta**.
- Klinický efekt: −2–4 kg za rok bez dietních změn (EMPA-REG trial).
- Vedlejší účinky: dehydratace, genitální mykotické infekce, vzácně
  euglykemická ketoacidóza.

### Cesta nano
Nano dodává krátkodobě působící SGLT-mimetikum (peptidový inhibitor SGLT2)
do tubulárních buněk ledviny. Aktivace **on demand**: senzor detekuje
postprandiální hyperglykémii → pulzní uvolnění inhibitoru → glykosurie po
dobu 2–4 hodin.

Výhoda nano před perorální dávkou: lze **vypnout** (např. před cvičením
nebo na lačno), což snižuje riziko ketoacidózy.

## Pilíř 3: Nano-EMS

### Biologický přesah
- **EMS u ICU pacientů** (Wischmeyer 2019, Jones 2024 systematic review):
  perkutánní elektrická stimulace svalů u ventilovaných pacientů zachová
  nebo mírně zvyšuje svalovou hmotu **bez vědomé kontrakce**.
- **AAV-IGF1** transgenní myši: hypertrofie bez tréninku, ale méně než s
  tréninkem.
- **Mendell 2017** (AAV-follistatin): inhibice MSTN v lidských svalech →
  mírná hypertrofie bez tréninku.

### Cesta nano
Piezoelektrické nano-stimulátory (Wang lab. 2017, ZnO nanopiezo) implantované
poblíž neuromuskulárních spojení. Aktivovány externě (ultrazvuk → piezo
generuje napětí → depolarizace nervu → kontrakce).

Alternativa: nano uvolňuje **acetylcholinový analog** v okně FUS aktivace
poblíž NMJ → krátká kontrakce. Bezpečnější (žádné drátky), ale méně
přesné než elektrická stimulace.

### Komfortní rozsah
- 8 h/den při 30–50 % maximální stimulace.
- Cyklování svalových skupin (kvadriceps, hamstringy, hýždě, břicho, záda,
  paže).
- Frekvence kontrakcí: ~30 Hz (rezistentní trénink-mimetic).
- Pacient cítí jemné cukání, někdy ne (subliminální).

### Limit
Bez **dostatku proteinu** (~1.2–1.6 g/kg/den) je EMS marný — chybí substrát.
**Toto je jediná zbývající "dietní" povinnost** v autonomním režimu: jíst
přiměřeně proteinů. Žádný kalorický deficit, žádný trénink, ale aspoň
nějaký steak / tofu / vejce.

## Co autonomní režim NEDOKÁŽE

Termodynamika není obejitá. Limity vyplývající ze simulace
(`scenario_autonomous_lazy_glutton`):

1. **Dlouhodobý extrém >3000 kcal/den**: dissipace je stropována ~1000 kcal/den.
   Když uživatel přejídá nad tento strop, tuk **stále roste**. Nano není
   bez-limitní.
2. **Bez proteinu**: sval se nezvětší, ať EMS dělá cokoliv (chybí substrát).
3. **Mikro-nutriční deficity**: vitaminy, minerály musí být v jídle. Nano
   je nesyntetizuje.

## Trade-offy oproti lifestyle režimu

| Parametr | Lifestyle (04-combined) | Autonomní (06) |
|---|---|---|
| Příjem kcal/den | 1700 (deficit) | 2500 (přebytek) |
| Trénink | 0.7/1.0 (vysoký) | 0 |
| Nano dávka | nižší | vyšší |
| Aktivace | 6 h FUS okno | trvalá (implantát) |
| Bezpečnostní rizika | nízká | vyšší (UCP3 dlouhodobě) |
| Komfort uživatele | náročné | žádné úsilí |
| Reverzibilita | týden | týdny–měsíce |
| Náklady | nižší | vyšší (implantát + dávky) |
| Δ tuk za 90 d | −6.3 kg | −3.7 kg |
| Δ sval za 90 d | +2.3 kg | +3.5 kg |

**Pozn.**: lifestyle režim je rychlejší v úbytku tuku. Autonomní je rychlejší
v přírůstku svalu (díky kontinuálnímu EMS). Volba závisí na preferencích a
toleranci rizik.

## Dlouhodobá rizika autonomního režimu

### Trvalá UCP3 indukce
- **Rychlejší stárnutí mitochondrií**: chronické rozpojení může degradovat
  mitochondriální kvalitu (ROS, mitofagie). Studie u DNP-uživatelů (před
  jeho zákazem 1938) ukázala neuropatie, kataraktu.
- **Mitigace**: cyklování — 6 týdnů on, 2 týdny off.

### Trvalá glykosurie
- **Genitální mykotické infekce** (běžné u SGLT2 inhibitorů, ~5 % pacientů).
- **Dehydratace** → adekvátní hydratace povinná (3 L vody/den).
- **Euglykemická ketoacidóza** vzácně, hlavně při onemocnění → kill-switch
  vypne při horečce.

### Trvalá EMS
- **Únava svalů**: stálá kontrakce může vést k mikrofraktorám, zánětu.
- **Kosti**: EMS bez gravitačního zatížení nezpevní kosti tak jako trénink.
  Doporučuje se občasný odpor (chůze).
- **Svalová asymetrie**: pokud nano není perfektně symetrické v dávkování.

### Behavioral
- **Atrofie motivace**: pokud nano dělá vše, ztráta benefit cvičení pro
  duševní zdraví, kosti, kardiorespirační zdatnost.
- **Hyperphagia**: bez práce na zhubnutí může uživatel jíst víc, dosáhne
  stropu dissipace, dynamika se obrátí.

## Etické úvahy

Autonomní režim **rozšiřuje** medicínské použití — hodí se pro:
- **Imobilní pacienty** (paraplegie, ICU, pokročilá demence).
- **Sarkopenii a kachexii** u nemocí, kde trénink není možný.
- **Morbidní obezitu** kde dieta selhala a chirurgie není vhodná.

Použití u **zdravých dospělých** je zde diskutabilní:
- Atrofie agency (pacient přestane být aktivní hráč ve vlastním zdraví).
- Dependency: pokud nano selže (porucha, anti-PEG), uživatel rychle dozadu.
- Kulturní/sociální: dlouhodobé efekty na „lidskou kondici" neznámé.

Kompromis: **autonomní mode jako safety net**, ne primární strategie. Pacienti
mohou cvičit a jíst dle libosti; nano kompenzuje výchylky a chrání před
relapsem (jojo efekt).

## Implementace v simulaci

```python
from sim.model import Inputs
from sim.nanobot import (
    bolus_schedule, continuous_activation,
    autonomous_ems, closed_loop_dissipation,
)

inp = Inputs(
    kcal=lambda t: 2500.0,                      # přebytek
    protein_g=lambda t: 100.0,                  # adekvátní protein
    training=lambda t: 0.0,                     # ŽÁDNÝ trénink
    nano_dose=bolus_schedule([0,7,14,...,84], 800.0),
    activation=continuous_activation(1.0),       # implantát trvale on
    ems=autonomous_ems(0.5, on_hours=8.0),       # 8h/den autonomně
    autonomous=closed_loop_dissipation(1.0),     # forced burn ON
)
```

Spuštění: `python -m sim.scenarios` vygeneruje `figs/06-autonomous.png` a
`figs/07-autonomous-limit.png`.

## Klíčové parametry (Params)

| Parametr | Hodnota | Význam |
|---|---|---|
| `target_burn_kcal_per_day` | 500 | forced burn setpoint |
| `active_dissipation_max` | 600 | UCP3+UCP2 kapacita |
| `glycosuria_max` | 300 | SGLT-mimetic kapacita |
| `dissipation_safety_ceiling` | 1000 | absolutní strop |
| `ems_synth_factor` | 0.85 | EMS jako training-equivalent |
| `ems_break_suppression` | 0.4 | EMS chrání protein |
| `ems_kcal_per_day` | 200 | spotřeba EMS samé |

Tyto parametry lze ladit pro různé klinické scénáře (sarkopenie u
80letého má jiný profil než morbidní obezita u 35letého).

## Souhrn

Autonomní režim je **technologicky dosažitelná konfigurace** existujících
modulů (SGLT2 inhibice, UCP3 indukce, EMS, nano dodávání). Termodynamika
je dodržena: nano přemístí výdaj energie z dobrovolného (cvičení) na
metabolický (rozpojené OXPHOS) a ledvinný (glykosurie). Uživatel
má zbývat jediný úkol — jíst přiměřeně protein.

Cena: vyšší dlouhodobá rizika (mitochondriální stárnutí, infekce,
dependency) a vyšší náklady. Hodí se primárně pro **medicínské
indikace**, kde lifestyle režim selhal nebo není možný.
