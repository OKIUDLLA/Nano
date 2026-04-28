"""Vykreslování výsledků simulace."""

from __future__ import annotations

from typing import Iterable

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

from .model import STATE_INDEX


def plot_scenario(sol, scenario, out_path: str) -> None:
    """6-panelový graf jednoho scénáře."""
    t = sol.t
    y = sol.y
    idx = STATE_INDEX

    fig, axes = plt.subplots(3, 2, figsize=(11, 10), sharex=True)
    fig.suptitle(f"{scenario.name}: {scenario.description}", fontsize=11)

    ax = axes[0, 0]
    ax.plot(t, y[idx["M_fat"]], color="#c0392b", label="Tuk")
    ax.plot(t, y[idx["M_muscle"]], color="#2980b9", label="Sval")
    ax.set_ylabel("Hmotnost [kg]")
    ax.legend(loc="best")
    ax.grid(alpha=0.3)

    ax = axes[0, 1]
    ax.plot(t, y[idx["M_fat"]] - y[idx["M_fat"], 0], color="#c0392b", label="ΔTuk")
    ax.plot(t, y[idx["M_muscle"]] - y[idx["M_muscle"], 0], color="#2980b9", label="ΔSval")
    ax.axhline(0, color="black", lw=0.5)
    ax.set_ylabel("Změna [kg]")
    ax.legend(loc="best")
    ax.grid(alpha=0.3)

    ax = axes[1, 0]
    ax.plot(t, y[idx["FFA"]], color="#e67e22")
    ax.set_ylabel("FFA [mmol/L]")
    ax.grid(alpha=0.3)

    ax = axes[1, 1]
    ax.plot(t, y[idx["Glc"]], color="#16a085")
    ax.set_ylabel("Glukóza [mmol/L]")
    ax.grid(alpha=0.3)

    ax = axes[2, 0]
    ax.plot(t, y[idx["N_active"]], color="#8e44ad", label="N_active")
    ax.plot(t, y[idx["N_circ"]], color="#9b59b6", linestyle="--", alpha=0.7, label="N_circ")
    ax.set_ylabel("Nano [částic/mL]")
    ax.set_xlabel("Den")
    ax.legend(loc="best")
    ax.grid(alpha=0.3)

    ax = axes[2, 1]
    ax.plot(t, y[idx["beige_frac"]] / 0.15, color="#d35400", label="beige / max")
    ax.set_ylabel("Béžová frakce (norm.)")
    ax.set_xlabel("Den")
    ax.legend(loc="best")
    ax.grid(alpha=0.3)

    fig.tight_layout(rect=(0, 0, 1, 0.96))
    fig.savefig(out_path, dpi=120)
    plt.close(fig)


def plot_comparison(results: Iterable, out_path: str) -> None:
    """Srovnání ΔTuk a ΔSval všech scénářů na jednom obrázku."""
    fig, axes = plt.subplots(1, 2, figsize=(12, 5), sharex=True)

    for sc, sol in results:
        t = sol.t
        axes[0].plot(t, sol.y[STATE_INDEX["M_fat"]] - sol.y[STATE_INDEX["M_fat"], 0], label=sc.name)
        axes[1].plot(t, sol.y[STATE_INDEX["M_muscle"]] - sol.y[STATE_INDEX["M_muscle"], 0], label=sc.name)

    for ax, title in zip(axes, ["Δ Tuk [kg]", "Δ Sval [kg]"]):
        ax.set_title(title)
        ax.set_xlabel("Den")
        ax.axhline(0, color="black", lw=0.5)
        ax.legend(fontsize=8, loc="best")
        ax.grid(alpha=0.3)

    fig.suptitle("Srovnání scénářů", fontsize=12)
    fig.tight_layout(rect=(0, 0, 1, 0.95))
    fig.savefig(out_path, dpi=120)
    plt.close(fig)
