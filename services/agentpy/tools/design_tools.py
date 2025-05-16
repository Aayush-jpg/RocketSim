"""Design tools for the rocket agent."""

import os
import json
from typing import Dict, Any, Optional, List

# Import from agents package (openai-agents) for function_tool decorator
from agents import function_tool

# Import our models and utilities
from utils.models import PartProps, RocketProps
from utils.fallbacks import design_rocket_for_altitude

@function_tool(strict_mode=False)
def add_part(type: str, props: Dict[str, Any]) -> Dict[str, Any]:
    """Add a new rocket component with specified type and properties."""
    # Convert dict to PartProps for validation, then back to dict
    validated_props = PartProps(**props).model_dump(exclude_none=True)
    return {"action": "add_part", "type": type, "props": validated_props}

@function_tool(strict_mode=False)
def update_part(id: str, props: Dict[str, Any]) -> Dict[str, Any]:
    """Update an existing rocket component with specified ID and new properties."""
    # Convert dict to PartProps for validation, then back to dict
    validated_props = PartProps(**props).model_dump(exclude_none=True)
    return {"action": "update_part", "id": id, "props": validated_props}

@function_tool(strict_mode=False)
def update_rocket(props: Dict[str, Any]) -> Dict[str, Any]:
    """Update rocket-level properties like motorId."""
    # Convert dict to RocketProps for validation, then back to dict
    validated_props = RocketProps(**props).model_dump(exclude_none=True)
    return {"action": "update_rocket", "props": validated_props}

@function_tool(strict_mode=False)
async def altitude_design_tool(rocket_data: Dict[str, Any], target_altitude: float) -> List[Dict[str, Any]]:
    """
    Designs rocket components and selects a motor to achieve a target altitude.
    This tool performs comprehensive modifications to all relevant rocket parts
    to optimize for the specified altitude target.
    
    Args:
        rocket_data: Current rocket configuration
        target_altitude: Target altitude in meters
        
    Returns:
        List of actions to modify parts, update motor, and simulate
    """
    print(f"⭐ ALTITUDE DESIGN TOOL CALLED: Target = {target_altitude}m")
    
    # Create default parts if rocket is empty
    actions = []
    has_parts = bool(rocket_data.get("parts", []))
    
    # If no parts in rocket, create a basic rocket first
    if not has_parts:
        print("No parts found in rocket, creating default rocket parts")
        actions.append({"action": "add_part", "type": "nose", "props": {"shape": "ogive", "length": 20, "baseØ": 8}})
        actions.append({"action": "add_part", "type": "body", "props": {"length": 60, "Ø": 8}})
        actions.append({"action": "add_part", "type": "fin", "props": {"root": 12, "span": 8, "sweep": 15}})
    
    # Get optimization actions from the altitude design function
    altitude_actions = await design_rocket_for_altitude(rocket_data, target_altitude)
    print(f"⭐ Altitude design returned {len(altitude_actions)} actions: {json.dumps(altitude_actions)}")
    
    # Add altitude optimization actions
    actions.extend(altitude_actions)
    
    # Ensure we have a simulation action at the end
    if not any(a.get("action") == "run_sim" and a.get("fidelity") == "hifi" for a in actions):
        actions.append({"action": "run_sim", "fidelity": "hifi"})
    
    return actions




