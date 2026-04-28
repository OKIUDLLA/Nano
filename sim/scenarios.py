"""Předdefinované simulační scénáře.

Každý scénář vrátí (sol, popis) připravený k vizualizaci. Spuštění
`python -m sim.scenarios` vygeneruje všechny grafy do figs/.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np

from .model import Inputs, Params, simulate, initial_state
from .nanobot import (
    autonomous_ems,
    activation_window,
    bolus_schedule,
    closed_loop_dissipation,
    continuous_activation,
)


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


def scenario_autonomous() -> Scenario:
    """**Plně autonomní režim** — uživatel jí kolik chce, necvičí. Nano sám:
    - běží trvale (implantovaný řídicí modul, žádné FUS sezení)
    - aktivuje UCP3 v svalu + UCP2 v játrech (forced burn 500 kcal/den)
    - aktivuje SGLT-mimetic glykosurii při zvýšené glykémii
    - 8 h denně cyklí svalové skupiny přes nano-EMS
    - žádné vědomé úsilí uživatele kromě přiměřeného příjmu proteinu

    Demonstruje, že systém **nahrazuje** dietu i trénink — neslouží jako
    motivační doplněk."""
    dose_times = [float(d) for d in range(0, 90, 7)]
    return Scenario(
        name="06-autonomous",
        description=(
            "Přebytek 2500 kcal/den, 100 g protein, ŽÁDNÝ trénink. "
            "Nano běží trvale: forced burn + glykosurie + autonomní EMS. 90 dní."
        ),
        inputs=Inputs(
            kcal=_const(2500.0),
            protein_g=_const(100.0),
            training=_const(0.0),
            nano_dose=bolus_schedule(dose_times, dose=800.0),
            activation=continuous_activation(1.0),
            ems=autonomous_ems(level=0.5, on_hours=8.0, start_hour=8.0),
            autonomous=closed_loop_dissipation(1.0),
        ),
    )


def scenario_autonomous_lazy_glutton() -> Scenario:
    """Extrémní test: přejídání (3000 kcal/den) + nulový trénink + nízký
    protein (60 g/den). Ukazuje, kde je hranice systému — i s plnou
    autonomií se přejídání nedá vyrušit, pokud chybí substrát pro sval
    a kapacita disipace je překročena."""
    dose_times = [float(d) for d in range(0, 90, 7)]
    return Scenario(
        name="07-autonomous-limit",
        description=(
            "Přejídání 3000 kcal/den, 60 g protein (málo), 0 trénink. "
            "Nano na maximum. Ukazuje hranice systému. 90 dní."
        ),
        inputs=Inputs(
            kcal=_const(3000.0),
            protein_g=_const(60.0),
            training=_const(0.0),
            nano_dose=bolus_schedule(dose_times, dose=1000.0),
            activation=continuous_activation(1.0),
            ems=autonomous_ems(level=0.5, on_hours=8.0),
            autonomous=closed_loop_dissipation(1.0),
        ),
    )


ALL_SCENARIOS: list[Callable[[], Scenario]] = [
    scenario_baseline,
    scenario_diet_only,
    scenario_nano_only,
    scenario_combined,
    scenario_overshoot,
    scenario_autonomous,
    scenario_autonomous_lazy_glutton,
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
