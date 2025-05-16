"""Simulation tools for the rocket agent."""

import json
from typing import Dict, Any, Literal, Optional
from agents import function_tool

@function_tool(strict_mode=False)
def run_simulation(fidelity: Literal["quick", "hifi"] = "quick") -> Dict[str, Any]:
    """Run a rocket simulation with specified fidelity ('quick' or 'hifi')."""
    return {"action": "run_sim", "fidelity": fidelity} 