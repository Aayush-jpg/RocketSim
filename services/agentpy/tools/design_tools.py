"""Design tools for the rocket agent - UPDATED FOR COMPONENT ARCHITECTURE."""

import os
import json
from typing import Dict, Any, Optional, List

# Import from agents package (openai-agents) for function_tool decorator
from agents import function_tool

# Import our models and utilities - UPDATED to use ComponentProps
from utils.models import ComponentProps, RocketProps
from utils.fallbacks import design_rocket_for_altitude

# ========================================
# UPDATED COMPONENT-BASED TOOLS
# ========================================

@function_tool(strict_mode=False)
def update_nose_cone(props: Dict[str, Any]) -> Dict[str, Any]:
    """Update the rocket's nose cone with specified properties."""
    # Convert dict to ComponentProps for validation, then back to dict
    validated_props = ComponentProps(**props).model_dump(exclude_none=True)
    return {"action": "update_nose_cone", "props": validated_props}

@function_tool(strict_mode=False)
def update_body_tube(props: Dict[str, Any], index: int = 0) -> Dict[str, Any]:
    """Update a body tube with specified properties. Index specifies which body tube (default: 0)."""
    # Convert dict to ComponentProps for validation, then back to dict
    validated_props = ComponentProps(**props).model_dump(exclude_none=True)
    return {"action": "update_body_tube", "props": validated_props, "index": index}

@function_tool(strict_mode=False)
def update_fins(props: Dict[str, Any], index: int = 0) -> Dict[str, Any]:
    """Update fins with specified properties. Index specifies which fin set (default: 0)."""
    # Convert dict to ComponentProps for validation, then back to dict
    validated_props = ComponentProps(**props).model_dump(exclude_none=True)
    return {"action": "update_fins", "props": validated_props, "index": index}

@function_tool(strict_mode=False)
def update_motor(props: Dict[str, Any]) -> Dict[str, Any]:
    """Update the rocket's motor with specified properties."""
    # Convert dict to ComponentProps for validation, then back to dict
    validated_props = ComponentProps(**props).model_dump(exclude_none=True)
    return {"action": "update_motor", "props": validated_props}

@function_tool(strict_mode=False)
def update_parachute(props: Dict[str, Any], index: int = 0) -> Dict[str, Any]:
    """Update a parachute with specified properties. Index specifies which parachute (default: 0)."""
    # Convert dict to ComponentProps for validation, then back to dict
    validated_props = ComponentProps(**props).model_dump(exclude_none=True)
    return {"action": "update_parachute", "props": validated_props, "index": index}

@function_tool(strict_mode=False)
def update_rocket_properties(props: Dict[str, Any]) -> Dict[str, Any]:
    """Update rocket-level properties like coordinate system."""
    # Convert dict to RocketProps for validation, then back to dict
    validated_props = RocketProps(**props).model_dump(exclude_none=True)
    return {"action": "update_rocket_properties", "props": validated_props}


# ========================================
# ALTITUDE DESIGN TOOL (UPDATED)
# ========================================

@function_tool(strict_mode=False)
async def altitude_design_tool(target_altitude: float, rocket_data: Dict[str, Any] = None) -> str:
    """
    Designs rocket components and selects a motor to achieve a target altitude.
    This tool performs comprehensive modifications to all relevant rocket parts
    to optimize for the specified altitude target.
    
    Args:
        target_altitude: Target altitude in meters
        rocket_data: Current rocket configuration (optional, will use default if not provided)
        
    Returns:
        JSON string of actions to modify components, update motor, and simulate
    """
    print(f"⭐ ALTITUDE DESIGN TOOL CALLED: Target = {target_altitude}m")
    
    # Use default rocket data if not provided - UPDATED for component structure
    if rocket_data is None:
        rocket_data = {
            "id": "rocket1",
            "name": "Default Rocket",
            "nose_cone": {
                "id": "default_nose",
                "shape": "ogive",
                "length_m": 0.15,
                "base_radius_m": 0.05,
                "wall_thickness_m": 0.002,
                "material_density_kg_m3": 1500.0
            },
            "body_tubes": [{
                "id": "default_body",
                "outer_radius_m": 0.05,
                "length_m": 0.6,
                "wall_thickness_m": 0.002,
                "material_density_kg_m3": 1500.0
            }],
            "fins": [{
                "id": "default_fins",
                "fin_count": 3,
                "root_chord_m": 0.12,
                "tip_chord_m": 0.04,
                "span_m": 0.08,
                "sweep_length_m": 0.05,
                "thickness_m": 0.003,
                "cant_angle_deg": 0.0,
                "material_density_kg_m3": 700.0
            }],
            "motor": {
                "id": "default_motor",
                "motor_database_id": "C6-5",
                "position_from_tail_m": 0.0
            },
            "parachutes": [{
                "id": "default_parachute",
                "name": "Main Chute",
                "cd_s_m2": 0.5,
                "trigger": "apogee",
                "lag_s": 0.0
            }],
            "coordinate_system": "tail_to_nose"
        }
    
    # Create default components if rocket is empty or missing components
    actions = []
    has_nose = bool(rocket_data.get("nose_cone"))
    has_body = bool(rocket_data.get("body_tubes", []))
    has_fins = bool(rocket_data.get("fins", []))
    has_motor = bool(rocket_data.get("motor"))
    has_parachutes = bool(rocket_data.get("parachutes", []))
    
    # If missing components, create basic ones first
    if not has_nose:
        print("No nose cone found, will create default via component action")
        actions.append({
            "action": "update_nose_cone", 
            "props": {"shape": "ogive", "length_m": 0.2, "base_radius_m": 0.08}
        })
    
    if not has_body:
        print("No body tubes found, will create default via component action")
        actions.append({
            "action": "update_body_tube", 
            "props": {"outer_radius_m": 0.08, "length_m": 0.6}, 
            "index": 0
        })
    
    if not has_fins:
        print("No fins found, will create default via component action")
        actions.append({
            "action": "update_fins", 
            "props": {"root_chord_m": 0.12, "span_m": 0.08, "sweep_length_m": 0.05}, 
            "index": 0
        })
    
    # Get optimization actions from the altitude design function
    altitude_actions = await design_rocket_for_altitude(rocket_data, target_altitude)
    print(f"⭐ Altitude design returned {len(altitude_actions)} actions: {json.dumps(altitude_actions)}")
    
    # Add altitude optimization actions
    actions.extend(altitude_actions)
    
    # Ensure we have a simulation action at the end
    if not any(a.get("action") == "run_sim" and a.get("fidelity") == "hifi" for a in actions):
        actions.append({"action": "run_sim", "fidelity": "hifi"})
    
    # Return as JSON string since that's what the agent expects
    return json.dumps(actions)




