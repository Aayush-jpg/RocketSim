"""Design tools for the rocket agent."""

import os
import json
from typing import Dict, Any, Optional

# Import from agents package (openai-agents) for function_tool decorator
from agents import function_tool

# Import our models and utilities
from utils.models import PartProps, RocketProps
from utils.fallbacks import design_rocket_for_altitude

@function_tool
def add_part(type: str, props: PartProps) -> Dict[str, Any]:
    """Add a new rocket component with specified type and properties."""
    return {"action": "add_part", "type": type, "props": props.model_dump(exclude_none=True)}

@function_tool
def update_part(id: str, props: PartProps) -> Dict[str, Any]:
    """Update an existing rocket component with specified ID and new properties."""
    return {"action": "update_part", "id": id, "props": props.model_dump(exclude_none=True)}

@function_tool
def update_rocket(props: RocketProps) -> Dict[str, Any]:
    """Update rocket-level properties like motorId."""
    return {"action": "update_rocket", "props": props.model_dump(exclude_none=True)}

@function_tool
async def altitude_design_tool(rocket_data: Dict[str, Any], target_altitude: float) -> list:
    """Designs rocket components and selects a motor to achieve a target altitude."""
    print(f"Designing rocket to reach {target_altitude}m altitude using altitude_design_tool")
    return await design_rocket_for_altitude(rocket_data, target_altitude) 