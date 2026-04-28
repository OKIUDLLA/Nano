"""Populační dynamika nanorobotů a externí aktivace.

Modeluje dvě podpopulace:
- N_active: koncentrace aktivních nanorobotů v cílové tkáni [particles/mL]
- N_circ:   koncentrace cirkulujících nanorobotů v plazmě [particles/mL]

Pharmakokinetika je zjednodušený dvoukompartmentový model:
plazma → tkáň → jaterní/renální clearance.
Hodnoty poločasu (~1 den v plazmě, ~3 dny v tkáni) odpovídají publikovaným
LNP studiím (Akinc 2019, Hou 2021).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import numpy as np


@dataclass
class NanoPK:
    plasma_half_life_days: float = 1.0
    tissue_half_life_days: float = 3.0
    plasma_to_tissue_rate: float = 0.8  # 1/den

    @property
    def k_plasma_clear(self) -> float:
        return np.log(2) / self.plasma_half_life_days

    @property
    def k_tissue_clear(self) -> float:
        return np.log(2) / self.tissue_half_life_days


def bolus_schedule(times_days: list[float], dose: float, width_days: float = 0.1):
    """Vrací funkci infuze(t) [particles/mL/den], která je nenulová
    krátký okamžik kolem každého času podání. width_days simuluje IV infuzi.
    """
    times = np.asarray(times_days, dtype=float)

    def infusion(t: float) -> float:
        if times.size == 0:
            return 0.0
        in_pulse = (t >= times) & (t < times + width_days)
        if not np.any(in_pulse):
            return 0.0
        return dose / width_days

    return infusion


def activation_window(
    weekly_days: list[int],
    hours_per_day: float = 0.5,
    start_hour: float = 10.0,
):
    """Modeluje fokusovaný ultrazvuk / NIR aktivaci.
    weekly_days: dny v týdnu (0=pondělí) kdy se zapíná.
    Vrací funkci 0..1 podle toho, zda je čas v aktivačním okně.
    """
    days = set(weekly_days)
    hpd = hours_per_day / 24.0
    start_frac = start_hour / 24.0

    def window(t: float) -> float:
        day_of_week = int(np.floor(t)) % 7
        if day_of_week not in days:
            return 0.0
        frac_of_day = t - np.floor(t)
        if start_frac <= frac_of_day < start_frac + hpd:
            return 1.0
        return 0.0

    return window
