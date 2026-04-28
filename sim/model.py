"""Kompartmentální ODE model: tělesné složení pod nanorobotickou intervencí.

Stavový vektor y:
    0  M_fat       [kg]            tuková tkáň
    1  M_muscle    [kg]            kosterní sval
    2  FFA         [mmol/L]        plazmatické volné mastné kyseliny
    3  Glc         [mmol/L]        glykémie
    4  N_circ      [částic/mL]     cirkulující nanoroboti (plazma)
    5  N_active    [částic/mL]     aktivní nanoroboti v cílové tkáni
    6  beige_frac  [0..0.20]       podíl WAT konvertovaný na béžový tuk

Model podporuje dva režimy:
- "lifestyle-driven": uživatel diet+trénink, nano je multiplikátor
- "autonomous": uzavřená smyčka — nano sám reguluje energetickou bilanci
  přes UCP3/UCP2 indukci (aktivní disipace tepla), glycosurii (vylučování
  glukózy ledvinami jako SGLT2 inhibitory), a nano-EMS neuromuskulární
  stimulaci (bez vědomého úsilí uživatele)

β3-AR a mTORC1 obsazení receptorů jsou počítány algebraicky (Hill funkce
N_active a aktivačního okna). Pomalé procesy (browning, růst svalu) jsou ODE.

Konstanty jsou kalibrovány na publikovaná čísla (NIH Hall body-weight model,
Cypess 2015 BAT termogeneze, SGLT2 inhibitor klinické studie EMPA-REG,
EMS u ICU pacientů Wischmeyer 2019). Model je ilustrativní – ne klinicky
prediktivní.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import numpy as np
from scipy.integrate import solve_ivp

from .nanobot import NanoPK


@dataclass
class Params:
    # --- Energetika ---
    bmr_per_kg_lean: float = 22.0          # kcal/den/kg svalu (Cunningham)
    bmr_per_kg_fat: float = 4.5            # kcal/den/kg tuku
    bmr_organs: float = 500.0              # mozek, srdce, ledviny
    activity_kcal_baseline: float = 400.0  # nesedavá aktivita
    activity_kcal_training: float = 350.0  # přídavek při full training stim
    kcal_per_kg_fat: float = 7700.0
    kcal_per_kg_muscle_synth: float = 4500.0
    kcal_per_kg_muscle_breakdown: float = 1800.0

    # --- Browning (UCP1 termogeneze) ---
    browning_max_kcal_per_day: float = 350.0   # Cypess 2015: max BAT TEE u člověka
    browning_buildup_rate: float = 0.05        # 1/den (~2 týdny na saturaci)
    browning_decay_rate: float = 0.01          # 1/den (deaktivace bez β3)
    browning_max_fraction: float = 0.20        # max podíl WAT → béžový

    # --- Lipolýza & FFA ---
    basal_lipolysis: float = 0.20              # mmol/L/den
    b3_max_lipolysis: float = 1.5              # mmol/L/den při saturaci β3
    deficit_lipolysis_gain: float = 0.0008     # mmol/L/den per kcal deficit
    ffa_oxidation_k: float = 4.0               # 1/den, návrat k baseline
    ffa_basal: float = 0.4                     # mmol/L

    # --- Glykémie (zjednodušená homeostáza) ---
    glc_basal: float = 5.0                     # mmol/L
    glc_homeostasis_k: float = 6.0             # 1/den
    randle_ffa_to_glc: float = 0.15            # FFA tlumí glc oxidaci → Glc ↑

    # --- Sval: synthesa & breakdown ---
    basal_synth_g_per_kg: float = 1.2          # g/kg/den
    max_synth_g_per_kg: float = 3.5
    basal_break_g_per_kg: float = 1.2
    deficit_break_per_1000kcal: float = 0.5    # relativní zvýšení rozpadu
    leucine_threshold_g: float = 80.0
    mtor_break_suppression: float = 0.3        # mTOR potlačí proteolýzu
    training_synth_factor: float = 1.5

    # --- Nanorobot dynamika v tkáni ---
    nano_plasma_to_tissue: float = 0.8         # 1/den
    nano_clearance_plasma: float = np.log(2) / 1.0
    nano_clearance_tissue: float = np.log(2) / 3.0

    # Hill kinetika receptorového obsazení
    b3_K: float = 60.0                         # částic/mL pro polovinu max β3
    b3_n: float = 2.0
    mtor_K: float = 60.0
    mtor_n: float = 2.0

    # selektivita: fakce dávky, která jde do tukové vs. svalové tkáně
    fraction_to_adipose: float = 0.5           # zbytek do svalu (logické AND
    fraction_to_muscle: float = 0.5            # cílení rozdělí náklad)

    # --- Autonomní termoregulace (UCP3 svalový + UCP2 jaterní/tukový) ---
    # Hodnota odpovídá maximální termogenezi pozorované u DNP-like uncouplerů
    # bez akutní toxicity (Geisler 2019 review): ~600 kcal/den nad rámec BAT.
    active_dissipation_max: float = 600.0      # kcal/den, řízeno closed-loop
    # Glycosuria: SGLT2 inhibitory (empagliflozin) ztrácí ~75 g glukózy/den
    # = ~300 kcal/den. Nano-řízený SGLT-mimetic na požádání.
    glycosuria_max: float = 300.0              # kcal/den
    # Maximum kombinované disipace (limit tepelné homeostázy + bezpečnosti)
    dissipation_safety_ceiling: float = 1000.0 # kcal/den
    # Cílový "burn setpoint" v autonomním režimu — kolik energie navíc nano
    # spaluje BEZ ohledu na příjem. Když strava nestačí, čerpá se z tuku.
    # 500 kcal/den ≈ klinický efekt semaglutid/tirzepatid trial (Wegovy).
    target_burn_kcal_per_day: float = 500.0

    # --- Nano-EMS: autonomní neuromuskulární stimulace ---
    # ICU studie (Wischmeyer 2019, EMS u ventilovaných pacientů): EMS udržuje
    # / mírně zvyšuje sval bez vědomé kontrakce. AAV-IGF1 myší + EMS dohromady.
    ems_synth_factor: float = 0.85             # ekvivalent training stimu
    ems_break_suppression: float = 0.4         # potlačení proteolýzy
    ems_kcal_per_day: float = 200.0            # kcal/den spotřebované EMS samotnou


@dataclass
class Inputs:
    """Časově proměnné vstupy.

    `ems` a `autonomous` jsou volitelné — None = lifestyle režim (uživatel
    sám). Pokud nastaveny, aktivuje se uzavřená smyčka, kde nano sám
    reguluje energetickou bilanci a neuromuskulární aktivaci bez vědomého
    úsilí uživatele.
    """
    kcal: Callable[[float], float]
    protein_g: Callable[[float], float]
    training: Callable[[float], float]      # 0..1 (vědomé cvičení uživatele)
    nano_dose: Callable[[float], float]     # částic/mL/den infuze
    activation: Callable[[float], float]    # 0..1 (FUS/NIR / autonomní řízení)
    ems: Callable[[float], float] | None = None         # 0..1 nano-EMS intenzita
    autonomous: Callable[[float], float] | None = None  # 0..1 closed-loop disipace

    def __post_init__(self):
        if self.ems is None:
            self.ems = lambda t: 0.0
        if self.autonomous is None:
            self.autonomous = lambda t: 0.0


def _hill(x: float, K: float, n: float) -> float:
    if x <= 0:
        return 0.0
    return x**n / (K**n + x**n)


def receptor_occupancy(N_active: float, activation: float, p: Params) -> tuple[float, float]:
    """Vrací (S_b3_eff, S_mTOR_eff) pro daný počet aktivních nanorobotů a
    aktuální aktivační okno (FUS/NIR). Bez aktivace = 0."""
    n_adip = N_active * p.fraction_to_adipose
    n_musc = N_active * p.fraction_to_muscle
    s_b3 = activation * _hill(n_adip, p.b3_K, p.b3_n)
    s_mtor = activation * _hill(n_musc, p.mtor_K, p.mtor_n)
    return s_b3, s_mtor


def derivs(t: float, y: np.ndarray, p: Params, inp: Inputs) -> list[float]:
    M_fat, M_muscle, FFA, Glc, N_circ, N_active, beige = y

    M_fat = max(M_fat, 0.5)
    M_muscle = max(M_muscle, 5.0)

    # --- Vstupy ---
    kcal_in = inp.kcal(t)
    protein = inp.protein_g(t)
    training = float(np.clip(inp.training(t), 0.0, 1.0))
    dose = inp.nano_dose(t)
    activation = float(np.clip(inp.activation(t), 0.0, 1.0))
    ems_in = float(np.clip(inp.ems(t), 0.0, 1.0))
    autonomous = float(np.clip(inp.autonomous(t), 0.0, 1.0))

    # --- Nano dynamika ---
    dN_circ = dose - p.nano_plasma_to_tissue * N_circ - p.nano_clearance_plasma * N_circ
    dN_active = p.nano_plasma_to_tissue * N_circ - p.nano_clearance_tissue * N_active

    # Receptorové obsazení (algebraické – velmi rychlé proti dnům simulace)
    S_b3_eff, S_mTOR_eff = receptor_occupancy(N_active, activation, p)

    # Účinek EMS — vyžaduje N_active ve svalu (potřebujeme nano u NMJ
    # uvolňující ACh-mimetik nebo piezo nano-stimulátor). Bez nano není EMS.
    nano_in_muscle_factor = _hill(N_active * p.fraction_to_muscle, p.mtor_K, p.mtor_n)
    ems_eff = ems_in * nano_in_muscle_factor

    # --- Browning ---
    dbeige = (
        p.browning_buildup_rate * S_b3_eff * (p.browning_max_fraction - beige)
        - p.browning_decay_rate * beige
    )

    # --- Energetika: bazální TEE před autonomní disipací ---
    bmr = p.bmr_per_kg_lean * M_muscle + p.bmr_per_kg_fat * M_fat + p.bmr_organs
    activity_voluntary = p.activity_kcal_baseline + p.activity_kcal_training * training
    # browning: pasivní termogeneze béžového tuku
    browning_bonus = p.browning_max_kcal_per_day * (beige / p.browning_max_fraction)
    # EMS spotřebovává energii (svalové kontrakce stojí ATP)
    ems_kcal = p.ems_kcal_per_day * ems_eff
    tee_base = bmr + activity_voluntary + browning_bonus + ems_kcal

    # --- Sval (potřebuje znát deficit pro proteolýzu — počítej zatím proxy) ---
    leucine_factor = float(np.clip(protein / p.leucine_threshold_g, 0.0, 1.0))
    # EMS funguje jako mechanická signalizace stejně jako vědomý trénink
    effective_load = max(training, p.ems_synth_factor * ems_eff)
    synth_drive = leucine_factor * (0.4 + 0.6 * effective_load) * (0.4 + 0.6 * S_mTOR_eff)
    synth_g_per_kg = (
        p.basal_synth_g_per_kg
        + (p.max_synth_g_per_kg - p.basal_synth_g_per_kg) * synth_drive
    )
    synth_g = synth_g_per_kg * M_muscle

    proxy_deficit = max(0.0, tee_base - kcal_in)
    break_g_per_kg = p.basal_break_g_per_kg * (
        1.0 + p.deficit_break_per_1000kcal * proxy_deficit / 1000.0
    )
    # mTOR i EMS potlačují proteolýzu (mTOR přes 4E-BP1, EMS přes mechanostat)
    break_suppression = max(
        p.mtor_break_suppression * S_mTOR_eff,
        p.ems_break_suppression * ems_eff,
    )
    break_g_per_kg *= 1.0 - break_suppression
    break_g = break_g_per_kg * M_muscle

    dM_muscle = (synth_g - break_g) / 1000.0  # kg/den

    kcal_to_muscle = (
        (synth_g / 1000.0) * p.kcal_per_kg_muscle_synth
        - (break_g / 1000.0) * p.kcal_per_kg_muscle_breakdown
    )

    # --- Autonomní disipace energie (closed-loop) ---
    # Sensor v nanorobotu sleduje energetickou bilanci a aktivuje:
    #   - UCP3 ve svalu, UCP2 v játrech (rozpojení OXPHOS, energie jako teplo)
    #   - SGLT-mimetic v ledvinách (glykosurii — vylučování glukózy močí)
    # Klíčové: forced_burn běží I bez surplus, čímž čerpá z tuku
    # (analog SGLT2 inhibitorů a DNP — fungují i v eukalorii nebo deficitu).

    surplus_pre = max(0.0, kcal_in - tee_base - kcal_to_muscle)

    # Kapacity disipace
    ucp_capacity = p.active_dissipation_max * autonomous * activation * nano_in_muscle_factor
    glc_drive = float(np.clip((Glc - p.glc_basal) / 2.0 + 0.5, 0.0, 1.0))
    glycosuria_capacity = p.glycosuria_max * autonomous * activation * glc_drive
    combined_capacity = ucp_capacity + glycosuria_capacity

    # Forced burn: programovatelný setpoint (váhový cíl)
    forced_burn_demand = autonomous * activation * p.target_burn_kcal_per_day
    forced_actual = min(forced_burn_demand, combined_capacity)
    # Reaktivní disipace: zbytek kapacity utratíme na food surplus
    remaining_cap = max(0.0, combined_capacity - forced_actual)
    reactive_actual = min(surplus_pre, remaining_cap)
    dissipated = min(forced_actual + reactive_actual, p.dissipation_safety_ceiling)

    # Rozpočet podle dvou cest (pro FFA / Glc dynamiku)
    glyco_share = (
        glycosuria_capacity / max(combined_capacity, 1e-6)
        if combined_capacity > 0
        else 0.0
    )
    glycosuria_actual = dissipated * glyco_share
    ucp_actual = dissipated - glycosuria_actual

    # --- Tuk ---
    available_kcal = kcal_in - tee_base - kcal_to_muscle - dissipated
    dM_fat = available_kcal / p.kcal_per_kg_fat

    if M_fat <= 1.0 and dM_fat < 0:
        dM_fat = 0.0

    # --- FFA: lipolýza + povinná oxidace tlačená UCP3 ---
    deficit_for_lipolysis = max(0.0, -available_kcal)
    lipolysis = (
        p.basal_lipolysis
        + p.b3_max_lipolysis * S_b3_eff
        + p.deficit_lipolysis_gain * deficit_for_lipolysis
        # autonomní disipace povinně oxiduje FFA
        + 0.5 * (ucp_actual / 1000.0)
    )
    # UCP3 také zrychluje oxidaci FFA (rozpojení = energie z FFA jako teplo)
    ffa_oxid_extra = 0.5 * autonomous * activation * (FFA - p.ffa_basal)
    ffa_oxid = p.ffa_oxidation_k * (FFA - p.ffa_basal) + ffa_oxid_extra
    dFFA = lipolysis - ffa_oxid

    # --- Glykémie ---
    randle = p.randle_ffa_to_glc * max(0.0, FFA - p.ffa_basal)
    # Glycosuria odbourává glukózu — modelujeme to jako další clearance term
    glycosuria_clearance_k = 4.0 * (glycosuria_actual / max(p.glycosuria_max, 1.0))
    dGlc = (
        -p.glc_homeostasis_k * (Glc - p.glc_basal - randle)
        - glycosuria_clearance_k * max(0.0, Glc - p.glc_basal)
    )

    return [dM_fat, dM_muscle, dFFA, dGlc, dN_circ, dN_active, dbeige]


def initial_state(M_fat: float = 25.0, M_muscle: float = 30.0) -> np.ndarray:
    """Defaultní 75 kg dospělý: ~33 % tuku, ~40 % svalu (zbytek kosti, orgány, voda)."""
    return np.array(
        [
            M_fat,        # M_fat
            M_muscle,     # M_muscle
            0.4,          # FFA mmol/L
            5.0,          # Glc mmol/L
            0.0,          # N_circ
            0.0,          # N_active
            0.0,          # beige fraction
        ],
        dtype=float,
    )


def simulate(
    t_end_days: float,
    inputs: Inputs,
    params: Params | None = None,
    y0: np.ndarray | None = None,
    n_points: int = 1000,
):
    p = params or Params()
    y0 = y0 if y0 is not None else initial_state()
    t_eval = np.linspace(0.0, t_end_days, n_points)
    sol = solve_ivp(
        fun=lambda t, y: derivs(t, y, p, inputs),
        t_span=(0.0, t_end_days),
        y0=y0,
        t_eval=t_eval,
        method="LSODA",
        rtol=1e-6,
        atol=1e-8,
        max_step=0.25,
    )
    return sol


STATE_NAMES = [
    "M_fat",
    "M_muscle",
    "FFA",
    "Glc",
    "N_circ",
    "N_active",
    "beige_frac",
]
STATE_INDEX = {name: i for i, name in enumerate(STATE_NAMES)}
