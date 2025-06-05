"""Component-based tools for the rocket agent."""

import json
from typing import Dict, Any, Optional, List, Union

# Import from agents package (openai-agents) for function_tool decorator
from agents import function_tool

# Import our models and utilities
from utils.models import ComponentProps, RocketProps

# Import centralized materials constants
DENSITY_FIBERGLASS = 1600.0
DENSITY_PLYWOOD = 650.0  
DENSITY_ALUMINUM = 2700.0

@function_tool(strict_mode=False)
def update_nose_cone(
    shape: Optional[str] = None,
    length_m: Optional[float] = None,
    base_radius_m: Optional[float] = None,
    wall_thickness_m: Optional[float] = None,
    material_density_kg_m3: Optional[float] = None,
    color: Optional[str] = None
) -> Dict[str, Any]:
    """Update the nose cone component."""
    props = {}
    if shape is not None:
        props["shape"] = shape
    if length_m is not None:
        props["length_m"] = length_m
    if base_radius_m is not None:
        props["base_radius_m"] = base_radius_m
    if wall_thickness_m is not None:
        props["wall_thickness_m"] = wall_thickness_m
    if material_density_kg_m3 is not None:
        props["material_density_kg_m3"] = material_density_kg_m3
    if color is not None:
        props["color"] = color
    
    return {"action": "update_nose_cone", "props": props}

@function_tool(strict_mode=False)
def update_body_tube(
    index: int,
    outer_radius_m: Optional[float] = None,
    length_m: Optional[float] = None,
    wall_thickness_m: Optional[float] = None,
    material_density_kg_m3: Optional[float] = None,
    color: Optional[str] = None
) -> Dict[str, Any]:
    """Update a specific body tube component (0-indexed)."""
    props = {}
    if outer_radius_m is not None:
        props["outer_radius_m"] = outer_radius_m
    if length_m is not None:
        props["length_m"] = length_m
    if wall_thickness_m is not None:
        props["wall_thickness_m"] = wall_thickness_m
    if material_density_kg_m3 is not None:
        props["material_density_kg_m3"] = material_density_kg_m3
    if color is not None:
        props["color"] = color
    
    return {"action": "update_body_tube", "index": index, "props": props}

@function_tool(strict_mode=False)
def add_body_tube(
    outer_radius_m: float,
    length_m: float,
    wall_thickness_m: Optional[float] = 0.003,
    material_density_kg_m3: Optional[float] = DENSITY_FIBERGLASS,
    color: Optional[str] = None
) -> Dict[str, Any]:
    """Add a new body tube component."""
    props = {
        "outer_radius_m": outer_radius_m,
        "length_m": length_m,
        "wall_thickness_m": wall_thickness_m,
        "material_density_kg_m3": material_density_kg_m3
    }
    if color is not None:
        props["color"] = color
    
    return {"action": "add_body_tube", "props": props}

@function_tool(strict_mode=False)
def remove_body_tube(index: int) -> Dict[str, Any]:
    """Remove a body tube component by index (0-indexed)."""
    return {"action": "remove_body_tube", "index": index}

@function_tool(strict_mode=False)
def update_fins(
    index: int,
    fin_count: Optional[int] = None,
    root_chord_m: Optional[float] = None,
    tip_chord_m: Optional[float] = None,
    span_m: Optional[float] = None,
    sweep_length_m: Optional[float] = None,
    thickness_m: Optional[float] = None,
    cant_angle_deg: Optional[float] = None,
    material_density_kg_m3: Optional[float] = None,
    airfoil: Optional[str] = None,
    color: Optional[str] = None
) -> Dict[str, Any]:
    """Update a specific fin set component (0-indexed)."""
    props = {}
    if fin_count is not None:
        props["fin_count"] = fin_count
    if root_chord_m is not None:
        props["root_chord_m"] = root_chord_m
    if tip_chord_m is not None:
        props["tip_chord_m"] = tip_chord_m
    if span_m is not None:
        props["span_m"] = span_m
    if sweep_length_m is not None:
        props["sweep_length_m"] = sweep_length_m
    if thickness_m is not None:
        props["thickness_m"] = thickness_m
    if cant_angle_deg is not None:
        props["cant_angle_deg"] = cant_angle_deg
    if material_density_kg_m3 is not None:
        props["material_density_kg_m3"] = material_density_kg_m3
    if airfoil is not None:
        props["airfoil"] = airfoil
    if color is not None:
        props["color"] = color
    
    return {"action": "update_fins", "index": index, "props": props}

@function_tool(strict_mode=False)
def update_fin_set(
    index: int,
    fin_count: Optional[int] = None,
    root_chord_m: Optional[float] = None,
    tip_chord_m: Optional[float] = None,
    span_m: Optional[float] = None,
    sweep_length_m: Optional[float] = None,
    thickness_m: Optional[float] = None,
    cant_angle_deg: Optional[float] = None,
    material_density_kg_m3: Optional[float] = None,
    airfoil: Optional[str] = None,
    color: Optional[str] = None
) -> Dict[str, Any]:
    """Update a specific fin set component (0-indexed)."""
    props = {}
    if fin_count is not None:
        props["fin_count"] = fin_count
    if root_chord_m is not None:
        props["root_chord_m"] = root_chord_m
    if tip_chord_m is not None:
        props["tip_chord_m"] = tip_chord_m
    if span_m is not None:
        props["span_m"] = span_m
    if sweep_length_m is not None:
        props["sweep_length_m"] = sweep_length_m
    if thickness_m is not None:
        props["thickness_m"] = thickness_m
    if cant_angle_deg is not None:
        props["cant_angle_deg"] = cant_angle_deg
    if material_density_kg_m3 is not None:
        props["material_density_kg_m3"] = material_density_kg_m3
    if airfoil is not None:
        props["airfoil"] = airfoil
    if color is not None:
        props["color"] = color
    
    return {"action": "update_fin_set", "index": index, "props": props}

@function_tool(strict_mode=False)
def add_fin_set(
    fin_count: int,
    root_chord_m: float,
    tip_chord_m: float,
    span_m: float,
    sweep_length_m: Optional[float] = 0.0,
    thickness_m: Optional[float] = 0.006,
    cant_angle_deg: Optional[float] = 0.0,
    material_density_kg_m3: Optional[float] = DENSITY_PLYWOOD,
    airfoil: Optional[str] = "symmetric",
    color: Optional[str] = None
) -> Dict[str, Any]:
    """Add a new fin set component."""
    props = {
        "fin_count": fin_count,
        "root_chord_m": root_chord_m,
        "tip_chord_m": tip_chord_m,
        "span_m": span_m,
        "sweep_length_m": sweep_length_m,
        "thickness_m": thickness_m,
        "cant_angle_deg": cant_angle_deg,
        "material_density_kg_m3": material_density_kg_m3,
        "airfoil": airfoil
    }
    if color is not None:
        props["color"] = color
    
    return {"action": "add_fin_set", "props": props}

@function_tool(strict_mode=False)
def remove_fin_set(index: int) -> Dict[str, Any]:
    """Remove a fin set component by index (0-indexed)."""
    return {"action": "remove_fin_set", "index": index}

@function_tool(strict_mode=False)
def update_motor(
    motor_database_id: Optional[str] = None,
    position_from_tail_m: Optional[float] = None,
    nozzle_expansion_ratio: Optional[float] = None,
    chamber_pressure_pa: Optional[float] = None
) -> Dict[str, Any]:
    """Update motor component properties."""
    props = {}
    if motor_database_id is not None:
        props["motor_database_id"] = motor_database_id
    if position_from_tail_m is not None:
        props["position_from_tail_m"] = position_from_tail_m
    if nozzle_expansion_ratio is not None:
        props["nozzle_expansion_ratio"] = nozzle_expansion_ratio
    if chamber_pressure_pa is not None:
        props["chamber_pressure_pa"] = chamber_pressure_pa
    
    return {"action": "update_motor", "props": props}

@function_tool(strict_mode=False)
def update_parachute(
    index: int,
    name: Optional[str] = None,
    cd_s_m2: Optional[float] = None,
    trigger: Optional[Union[str, float]] = None,
    lag_s: Optional[float] = None,
    position_from_tail_m: Optional[float] = None,
    sampling_rate_hz: Optional[float] = None,
    noise_bias: Optional[float] = None,
    noise_deviation: Optional[float] = None,
    noise_correlation: Optional[float] = None,
    color: Optional[str] = None
) -> Dict[str, Any]:
    """Update a specific parachute component (0-indexed)."""
    props = {}
    if name is not None:
        props["name"] = name
    if cd_s_m2 is not None:
        props["cd_s_m2"] = cd_s_m2
    if trigger is not None:
        props["trigger"] = trigger
    if lag_s is not None:
        props["lag_s"] = lag_s
    if position_from_tail_m is not None:
        props["position_from_tail_m"] = position_from_tail_m
    if sampling_rate_hz is not None:
        props["sampling_rate_hz"] = sampling_rate_hz
    if noise_bias is not None:
        props["noise_bias"] = noise_bias
    if noise_deviation is not None:
        props["noise_deviation"] = noise_deviation
    if noise_correlation is not None:
        props["noise_correlation"] = noise_correlation
    if color is not None:
        props["color"] = color
    
    return {"action": "update_parachute", "index": index, "props": props}

@function_tool(strict_mode=False)
def add_parachute(
    name: str,
    cd_s_m2: float,
    trigger: Union[str, float] = "apogee",
    lag_s: Optional[float] = 1.5,
    position_from_tail_m: Optional[float] = 0.0,
    sampling_rate_hz: Optional[float] = 105.0,
    noise_bias: Optional[float] = 0.0,
    noise_deviation: Optional[float] = 8.3,
    noise_correlation: Optional[float] = 0.5,
    color: Optional[str] = None
) -> Dict[str, Any]:
    """Add a new parachute component."""
    props = {
        "name": name,
        "cd_s_m2": cd_s_m2,
        "trigger": trigger,
        "lag_s": lag_s,
        "position_from_tail_m": position_from_tail_m,
        "sampling_rate_hz": sampling_rate_hz,
        "noise_bias": noise_bias,
        "noise_deviation": noise_deviation,
        "noise_correlation": noise_correlation
    }
    if color is not None:
        props["color"] = color
    
    return {"action": "add_parachute", "props": props}

@function_tool(strict_mode=False)
def remove_parachute(index: int) -> Dict[str, Any]:
    """Remove a parachute component by index (0-indexed)."""
    return {"action": "remove_parachute", "index": index}

@function_tool(strict_mode=False)
def update_rocket_properties(
    coordinate_system: Optional[str] = None,
    rail_guides_position_m: Optional[List[float]] = None
) -> Dict[str, Any]:
    """Update rocket-level properties."""
    props = {}
    if coordinate_system is not None:
        props["coordinate_system"] = coordinate_system
    if rail_guides_position_m is not None:
        props["rail_guides_position_m"] = rail_guides_position_m
    
    return {"action": "update_rocket_properties", "props": props}

@function_tool(strict_mode=False)
def analyze_component_mass() -> Dict[str, Any]:
    """Analyze the mass distribution of rocket components."""
    return {"action": "analyze_component_mass"}

@function_tool(strict_mode=False)
def optimize_fin_design(target_stability_margin: float = 2.0) -> Dict[str, Any]:
    """Optimize fin design for a target stability margin."""
    return {
        "action": "optimize_fin_design", 
        "props": {"target_stability_margin": target_stability_margin}
    }

@function_tool(strict_mode=False)
def scale_rocket(scale_factor: float) -> Dict[str, Any]:
    """Scale the entire rocket by a factor (e.g., 1.2 = 20% larger)."""
    return {"action": "scale_rocket", "props": {"scale_factor": scale_factor}}

# Professional engineering tools
@function_tool(strict_mode=False)
def calculate_center_of_mass() -> Dict[str, Any]:
    """Calculate the rocket's center of mass from component properties."""
    return {"action": "calculate_center_of_mass"}

@function_tool(strict_mode=False)
def calculate_center_of_pressure() -> Dict[str, Any]:
    """Calculate the rocket's center of pressure from aerodynamic analysis."""
    return {"action": "calculate_center_of_pressure"}

@function_tool(strict_mode=False)
def generate_manufacturing_tolerances() -> Dict[str, Any]:
    """Generate manufacturing tolerance specifications for components."""
    return {"action": "generate_manufacturing_tolerances"}

@function_tool(strict_mode=False)
def validate_structural_integrity() -> Dict[str, Any]:
    """Validate structural integrity of the rocket design."""
    return {"action": "validate_structural_integrity"}

@function_tool(strict_mode=False)
def run_simulation(fidelity: str = "quick") -> Dict[str, Any]:
    """Run a flight simulation with the current rocket configuration."""
    if fidelity not in ["quick", "hifi", "professional"]:
        fidelity = "quick"
    return {"action": "run_sim", "fidelity": fidelity} 