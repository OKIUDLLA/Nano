"""Kompartmentální ODE model: tělesné složení pod nanorobotickou intervencí.

Stavový vektor y:
    0  M_fat       [kg]            tuková tkáň
    1  M_muscle    [kg]            kosterní sval
    2  FFA         [mmol/L]        plazmatické volné mastné kyseliny
    3  Glc         [mmol/L]        glykémie
    4  N_circ      [částic/mL]     cirkulující nanoroboti (plazma)
    5  N_active    [částic/mL]     aktivní nanoroboti v cílové tkáni
    6  beige_frac  [0..0.15]       podíl WAT konvertovaný na béžový tuk

β3-AR a mTORC1 obsazení receptorů jsou počítány algebraicky (Hill funkce
N_active a aktivačního okna) – obsazení receptoru je v měřítku dnů
prakticky okamžité. Pomalé procesy (browning, růst svalu) jsou ODE.

Konstanty jsou kalibrovány na publikovaná čísla (NIH Hall body-weight model,
Müller 2015 metabolic adaptation, Cypess 2009 BAT termogeneze). Model je
ilustrativní – ne klinicky prediktivní.
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


@dataclass
class Inputs:
    """Časově proměnné vstupy."""
    kcal: Callable[[float], float]
    protein_g: Callable[[float], float]
    training: Callable[[float], float]      # 0..1
    nano_dose: Callable[[float], float]     # částic/mL/den infuze
    activation: Callable[[float], float]    # 0..1 (FUS/NIR okno)


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

    # --- Nano dynamika ---
    dN_circ = dose - p.nano_plasma_to_tissue * N_circ - p.nano_clearance_plasma * N_circ
    dN_active = p.nano_plasma_to_tissue * N_circ - p.nano_clearance_tissue * N_active

    # Receptorové obsazení (algebraické – velmi rychlé proti dnům simulace)
    S_b3_eff, S_mTOR_eff = receptor_occupancy(N_active, activation, p)

    # --- Browning ---
    # Pomalá adaptace: chronická β3 stimulace integrovaná přes čas → β3 efektivní
    # zde není okamžitý (jen v aktivačním okně), proto použijeme i informaci
    # o průměrné aktivaci za poslední den. Aproximujeme to průměrem během
    # aktivačního okna: přepsáno přes β3_eff přímo.
    dbeige = (
        p.browning_buildup_rate * S_b3_eff * (p.browning_max_fraction - beige)
        - p.browning_decay_rate * beige
    )

    # --- Energetika (TEE) ---
    bmr = p.bmr_per_kg_lean * M_muscle + p.bmr_per_kg_fat * M_fat + p.bmr_organs
    activity = p.activity_kcal_baseline + p.activity_kcal_training * training
    # browning bonus: béžový tuk pálí stále (nezávisle na okamžitém β3)
    browning_bonus = p.browning_max_kcal_per_day * (beige / p.browning_max_fraction)
    tee = bmr + activity + browning_bonus

    net_kcal = kcal_in - tee
    deficit = max(0.0, -net_kcal)
    surplus = max(0.0, net_kcal)

    # --- Sval ---
    leucine_factor = float(np.clip(protein / p.leucine_threshold_g, 0.0, 1.0))
    synth_drive = leucine_factor * (0.4 + 0.6 * training) * (0.4 + 0.6 * S_mTOR_eff)
    synth_g_per_kg = p.basal_synth_g_per_kg + (p.max_synth_g_per_kg - p.basal_synth_g_per_kg) * synth_drive
    synth_g = synth_g_per_kg * M_muscle

    break_g_per_kg = p.basal_break_g_per_kg * (1.0 + p.deficit_break_per_1000kcal * deficit / 1000.0)
    break_g_per_kg *= (1.0 - p.mtor_break_suppression * S_mTOR_eff)
    break_g = break_g_per_kg * M_muscle

    dM_muscle = (synth_g - break_g) / 1000.0  # kg/den

    # ATP cena synthesy / energie z rozpadu
    kcal_to_muscle = (
        (synth_g / 1000.0) * p.kcal_per_kg_muscle_synth
        - (break_g / 1000.0) * p.kcal_per_kg_muscle_breakdown
    )

    # --- Tuk: zbytek energetické bilance (po nákladech sval) ---
    available_kcal = net_kcal - kcal_to_muscle
    dM_fat = available_kcal / p.kcal_per_kg_fat

    if M_fat <= 1.0 and dM_fat < 0:
        dM_fat = 0.0

    # --- FFA ---
    lipolysis = (
        p.basal_lipolysis
        + p.b3_max_lipolysis * S_b3_eff
        + p.deficit_lipolysis_gain * deficit
    )
    ffa_oxid = p.ffa_oxidation_k * (FFA - p.ffa_basal)
    dFFA = lipolysis - ffa_oxid

    # --- Glykémie (Randle: vyšší FFA → menší glc oxidace → mírná hyperglykémie) ---
    randle = p.randle_ffa_to_glc * max(0.0, FFA - p.ffa_basal)
    dGlc = -p.glc_homeostasis_k * (Glc - p.glc_basal - randle)

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
