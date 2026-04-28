"""Předdefinované simulační scénáře.

Každý scénář vrátí (sol, popis) připravený k vizualizaci. Spuštění
`python -m sim.scenarios` vygeneruje všechny grafy do figs/.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np

from .model import Inputs, Params, simulate, initial_state
from .nanobot import bolus_schedule, activation_window


@dataclass
class Scenario:
    name: str
    description: str
    inputs: Inputs
    days: float = 90.0


def _const(v):
    return lambda t, v=v: v


def scenario_baseline() -> Scenario:
    """Izokalorická dieta, žádná intervence – kontrolní křivka."""
    return Scenario(
        name="01-baseline",
        description="Izokalorická strava, mírná aktivita, žádný nano. 90 dní.",
        inputs=Inputs(
            kcal=_const(2100.0),
            protein_g=_const(80.0),
            training=_const(0.2),
            nano_dose=bolus_schedule([], 0.0),
            activation=_const(0.0),
        ),
    )


def scenario_diet_only() -> Scenario:
    """Kalorický deficit 500 kcal/den, žádné nano – referenční hubnutí."""
    return Scenario(
        name="02-diet-only",
        description="Deficit 500 kcal/den, 100 g protein, žádný nano. 90 dní.",
        inputs=Inputs(
            kcal=_const(1600.0),
            protein_g=_const(100.0),
            training=_const(0.2),
            nano_dose=bolus_schedule([], 0.0),
            activation=_const(0.0),
        ),
    )


def scenario_nano_only() -> Scenario:
    """Eukalorie + nano s denním 6h FUS-řízeným uvolňováním β3 agonisty.
    Demonstruje samostatný efekt browningu bez dietní intervence."""
    dose_times = [float(d) for d in range(0, 90, 7)]  # 1× týdně
    return Scenario(
        name="03-nano-only",
        description="Eukalorie, 80 g protein, nano 1×/týden + denní 6h FUS okno. 90 dní.",
        inputs=Inputs(
            kcal=_const(2100.0),
            protein_g=_const(80.0),
            training=_const(0.2),
            nano_dose=bolus_schedule(dose_times, dose=600.0),
            activation=activation_window(
                weekly_days=[0, 1, 2, 3, 4, 5, 6], hours_per_day=6.0
            ),
        ),
    )


def scenario_combined() -> Scenario:
    """Realistická kombinace: mírný deficit + dostatek proteinu + trénink + nano."""
    dose_times = [float(d) for d in range(0, 90, 7)]
    return Scenario(
        name="04-combined",
        description="Deficit 400 kcal/den, 130 g protein, trénink 0.7, nano + denní FUS. 90 dní.",
        inputs=Inputs(
            kcal=_const(1700.0),
            protein_g=_const(130.0),
            training=_const(0.7),
            nano_dose=bolus_schedule(dose_times, dose=600.0),
            activation=activation_window(
                weekly_days=[0, 1, 2, 3, 4, 5, 6], hours_per_day=6.0
            ),
        ),
    )


def scenario_overshoot() -> Scenario:
    """Hranice systému: lehký kalorický přebytek + agresivní nano režim.
    Demonstruje, že nano částečně kompenzuje přebytek (browning bonus),
    ale nezvrátí silně pozitivní energetickou bilanci."""
    dose_times = [float(d) for d in range(0, 90, 4)]
    return Scenario(
        name="05-overshoot",
        description="Přebytek 200 kcal/den, agresivní nano + denní 8h FUS. 90 dní.",
        inputs=Inputs(
            kcal=_const(2300.0),
            protein_g=_const(100.0),
            training=_const(0.3),
            nano_dose=bolus_schedule(dose_times, dose=800.0),
            activation=activation_window(
                weekly_days=[0, 1, 2, 3, 4, 5, 6], hours_per_day=8.0
            ),
        ),
    )


ALL_SCENARIOS: list[Callable[[], Scenario]] = [
    scenario_baseline,
    scenario_diet_only,
    scenario_nano_only,
    scenario_combined,
    scenario_overshoot,
]


def run_all(out_dir: str = "figs"):
    from pathlib import Path
    from .plot import plot_scenario, plot_comparison

    Path(out_dir).mkdir(parents=True, exist_ok=True)
    results = []
    for factory in ALL_SCENARIOS:
        sc = factory()
        sol = simulate(sc.days, sc.inputs)
        plot_scenario(sol, sc, out_path=f"{out_dir}/{sc.name}.png")
        results.append((sc, sol))
        print(
            f"[{sc.name}] M_fat: {sol.y[0,0]:.2f} → {sol.y[0,-1]:.2f} kg, "
            f"M_muscle: {sol.y[1,0]:.2f} → {sol.y[1,-1]:.2f} kg"
        )

    plot_comparison(results, out_path=f"{out_dir}/00-comparison.png")
    return results


if __name__ == "__main__":
    run_all()
