"""Sanity testy ODE modelu."""

from __future__ import annotations

import numpy as np

from sim.model import Inputs, Params, simulate, initial_state, STATE_INDEX, receptor_occupancy
from sim.nanobot import (
    activation_window,
    autonomous_ems,
    bolus_schedule,
    closed_loop_dissipation,
    continuous_activation,
)


def _const(v):
    return lambda t, v=v: v


def _no_intervention():
    return Inputs(
        kcal=_const(0.0),
        protein_g=_const(0.0),
        training=_const(0.0),
        nano_dose=bolus_schedule([], 0.0),
        activation=_const(0.0),
    )


def test_no_calories_loses_fat():
    """Bez příjmu kalorií tělo zhubne (negative energetická bilance)."""
    inp = _no_intervention()
    sol = simulate(30.0, inp, n_points=200)
    assert sol.success
    fat_idx = STATE_INDEX["M_fat"]
    assert sol.y[fat_idx, -1] < sol.y[fat_idx, 0]


def test_eukaloric_no_intervention_is_stable():
    """Při kaloriích blízko maintenance se hmotnost mění málo."""
    # Přibližná maintenance pro 75 kg dospělého: TEE = 22*30 + 4.5*25 + 500 + 400 ≈ 1670 kcal
    # plus dynamická adaptace, vezmeme 1700 kcal (mírný deficit pro stabilitu)
    inp = Inputs(
        kcal=_const(1700.0),
        protein_g=_const(80.0),
        training=_const(0.0),
        nano_dose=bolus_schedule([], 0.0),
        activation=_const(0.0),
    )
    sol = simulate(60.0, inp, n_points=300)
    fat_idx = STATE_INDEX["M_fat"]
    musc_idx = STATE_INDEX["M_muscle"]
    # Tolerance: ±2 kg za 60 dní pro fat, ±1.5 kg pro sval
    assert abs(sol.y[fat_idx, -1] - sol.y[fat_idx, 0]) < 2.0
    assert abs(sol.y[musc_idx, -1] - sol.y[musc_idx, 0]) < 1.5


def test_nano_alone_no_deficit_no_training_does_not_lose_significant_fat():
    """Nano bez deficitu kalorií a bez tréninku má omezený efekt –
    browning bonus může mírně snížit tuk, ale ne dramaticky."""
    dose_times = [float(d) for d in range(0, 60, 7)]
    inp = Inputs(
        kcal=_const(2100.0),  # eukalorie
        protein_g=_const(80.0),
        training=_const(0.0),  # bez tréninku
        nano_dose=bolus_schedule(dose_times, dose=600.0),
        activation=activation_window(
            weekly_days=[0, 1, 2, 3, 4, 5, 6], hours_per_day=6.0
        ),
    )
    sol = simulate(60.0, inp, n_points=400)
    fat_idx = STATE_INDEX["M_fat"]
    delta_fat = sol.y[fat_idx, -1] - sol.y[fat_idx, 0]
    # Nano nesmí nahradit 1000 kcal/den deficitu – limit ~3 kg za 60 dní
    assert delta_fat > -3.0


def test_diet_loses_more_fat_than_no_intervention():
    """Kalorický deficit musí způsobit větší úbytek tuku než maintenance."""
    fat_idx = STATE_INDEX["M_fat"]

    inp_diet = Inputs(
        kcal=_const(1500.0),
        protein_g=_const(120.0),
        training=_const(0.3),
        nano_dose=bolus_schedule([], 0.0),
        activation=_const(0.0),
    )
    inp_eu = Inputs(
        kcal=_const(2100.0),
        protein_g=_const(120.0),
        training=_const(0.3),
        nano_dose=bolus_schedule([], 0.0),
        activation=_const(0.0),
    )
    sol_diet = simulate(60.0, inp_diet, n_points=200)
    sol_eu = simulate(60.0, inp_eu, n_points=200)
    assert sol_diet.y[fat_idx, -1] < sol_eu.y[fat_idx, -1] - 1.0


def test_combined_protocol_loses_fat_and_gains_muscle():
    """Deficit + protein + trénink + nano: úbytek tuku I přírůstek svalu."""
    dose_times = [float(d) for d in range(0, 90, 7)]
    inp = Inputs(
        kcal=_const(1700.0),
        protein_g=_const(130.0),
        training=_const(0.7),
        nano_dose=bolus_schedule(dose_times, dose=600.0),
        activation=activation_window(
            weekly_days=[0, 1, 2, 3, 4, 5, 6], hours_per_day=6.0
        ),
    )
    sol = simulate(90.0, inp, n_points=400)
    fat_idx = STATE_INDEX["M_fat"]
    musc_idx = STATE_INDEX["M_muscle"]
    delta_fat = sol.y[fat_idx, -1] - sol.y[fat_idx, 0]
    delta_musc = sol.y[musc_idx, -1] - sol.y[musc_idx, 0]
    assert delta_fat < -3.0   # alespoň 3 kg úbytku tuku
    assert delta_musc > 1.0   # alespoň 1 kg přírůstku svalu


def test_receptor_occupancy_saturates():
    """Hill funkce: nulová bez aktivace, saturuje s rostoucím N."""
    p = Params()
    s_b3_off, s_mtor_off = receptor_occupancy(N_active=1000.0, activation=0.0, p=p)
    assert s_b3_off == 0.0 and s_mtor_off == 0.0

    s_b3_low, _ = receptor_occupancy(N_active=10.0, activation=1.0, p=p)
    s_b3_high, _ = receptor_occupancy(N_active=1000.0, activation=1.0, p=p)
    assert s_b3_low < s_b3_high
    assert s_b3_high > 0.9


def test_no_negative_masses():
    """Stavy nikdy nesmějí jít do nesmyslných záporných hodnot."""
    inp = _no_intervention()
    sol = simulate(60.0, inp, n_points=200)
    for name in ["M_fat", "M_muscle", "FFA", "Glc", "N_circ", "N_active", "beige_frac"]:
        idx = STATE_INDEX[name]
        assert np.all(sol.y[idx] >= -1e-3), f"{name} went negative"


def test_autonomous_loses_fat_without_diet_or_training():
    """Plně autonomní režim: uživatel jí přebytek a necvičí. Nano sám
    spaluje (forced burn + browning + glykosurie + EMS) → úbytek tuku."""
    dose_times = [float(d) for d in range(0, 90, 7)]
    inp = Inputs(
        kcal=_const(2500.0),       # přebytek
        protein_g=_const(100.0),
        training=_const(0.0),       # žádný trénink
        nano_dose=bolus_schedule(dose_times, 800.0),
        activation=continuous_activation(1.0),
        ems=autonomous_ems(level=0.5, on_hours=8.0),
        autonomous=closed_loop_dissipation(1.0),
    )
    sol = simulate(90.0, inp, n_points=400)
    fat_idx = STATE_INDEX["M_fat"]
    musc_idx = STATE_INDEX["M_muscle"]
    delta_fat = sol.y[fat_idx, -1] - sol.y[fat_idx, 0]
    delta_musc = sol.y[musc_idx, -1] - sol.y[musc_idx, 0]
    assert delta_fat < -2.0, f"Autonomous should lose >2 kg fat, got {delta_fat}"
    assert delta_musc > 2.0, f"Autonomous should gain >2 kg muscle, got {delta_musc}"


def test_autonomous_respects_protein_limit():
    """I plně autonomní režim potřebuje protein jako substrát.
    Nízký protein = omezený růst svalu."""
    dose_times = [float(d) for d in range(0, 90, 7)]
    fat_idx = STATE_INDEX["M_fat"]
    musc_idx = STATE_INDEX["M_muscle"]

    inp_low_protein = Inputs(
        kcal=_const(2500.0),
        protein_g=_const(40.0),    # málo proteinu
        training=_const(0.0),
        nano_dose=bolus_schedule(dose_times, 800.0),
        activation=continuous_activation(1.0),
        ems=autonomous_ems(level=0.5, on_hours=8.0),
        autonomous=closed_loop_dissipation(1.0),
    )
    inp_high_protein = Inputs(
        kcal=_const(2500.0),
        protein_g=_const(120.0),   # dostatek proteinu
        training=_const(0.0),
        nano_dose=bolus_schedule(dose_times, 800.0),
        activation=continuous_activation(1.0),
        ems=autonomous_ems(level=0.5, on_hours=8.0),
        autonomous=closed_loop_dissipation(1.0),
    )
    s_low = simulate(90.0, inp_low_protein, n_points=200)
    s_high = simulate(90.0, inp_high_protein, n_points=200)
    # Vyšší protein → větší přírůstek svalu
    assert (s_high.y[musc_idx, -1] - s_high.y[musc_idx, 0]) > (
        s_low.y[musc_idx, -1] - s_low.y[musc_idx, 0]
    )


def test_autonomous_safety_ceiling():
    """Disipace nesmí překročit safety ceiling (přehřátí, elektrolyty)."""
    p = Params()
    dose_times = [float(d) for d in range(0, 60, 3)]
    inp = Inputs(
        kcal=_const(4000.0),       # extrémní přejídání
        protein_g=_const(80.0),
        training=_const(0.0),
        nano_dose=bolus_schedule(dose_times, 1500.0),
        activation=continuous_activation(1.0),
        ems=autonomous_ems(level=0.8, on_hours=12.0),
        autonomous=closed_loop_dissipation(1.0),
    )
    sol = simulate(60.0, inp, n_points=200)
    fat_idx = STATE_INDEX["M_fat"]
    # I s plnou autonomií se 4000 kcal/den nedá vyrušit → tuk roste
    delta_fat = sol.y[fat_idx, -1] - sol.y[fat_idx, 0]
    assert delta_fat > 0, f"At 4000 kcal/day fat should grow, got Δ={delta_fat}"
    # Ale ne dramaticky, protože hodně se disipuje
    assert delta_fat < 8.0, f"Fat growth bounded by dissipation, got Δ={delta_fat}"


def test_browning_does_not_exceed_max():
    """Béžová frakce nesmí překročit fyziologický strop (~20 % WAT)."""
    p = Params()
    dose_times = [float(d) for d in range(0, 180, 3)]  # extrémní dávkování
    inp = Inputs(
        kcal=_const(2200.0),
        protein_g=_const(100.0),
        training=_const(0.0),
        nano_dose=bolus_schedule(dose_times, dose=2000.0),
        activation=activation_window(
            weekly_days=[0, 1, 2, 3, 4, 5, 6], hours_per_day=12.0
        ),
    )
    sol = simulate(180.0, inp, n_points=400)
    beige_idx = STATE_INDEX["beige_frac"]
    assert sol.y[beige_idx].max() < p.browning_max_fraction + 1e-3
