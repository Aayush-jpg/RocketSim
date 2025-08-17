"""
Rocket model definitions.

This module defines the complete rocket model with component-based architecture
and validation for rocket assembly.
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field, validator
from .components import (
    NoseComponentModel, BodyComponentModel, FinComponentModel,
    MotorComponentModel, ParachuteComponentModel
)

class RocketModel(BaseModel):
    """Complete rocket model with component-based architecture"""
    id: str
    name: str
    rocket_type: str = Field("solid", description="Type of rocket propulsion", pattern="^(solid|liquid|hybrid)$")
    nose_cone: NoseComponentModel
    body_tubes: List[BodyComponentModel]
    fins: List[FinComponentModel]
    motor: MotorComponentModel
    parachutes: List[ParachuteComponentModel]
    
    # Rocket-level properties
    coordinate_system: Literal["tail_to_nose", "nose_to_tail"] = "tail_to_nose"
    rail_guides_position_m: Optional[List[float]] = Field(
        None, 
        description="Rail guide positions from tail in meters"
    )
    
    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError("Rocket name cannot be empty")
        return v.strip()
    
    @validator('body_tubes')
    def validate_body_tubes(cls, v):
        if not v:
            raise ValueError("At least one body tube is required")
        
        # Check for overlapping body tubes
        for i, tube1 in enumerate(v):
            for j, tube2 in enumerate(v[i+1:], i+1):
                if tube1.id == tube2.id:
                    raise ValueError(f"Duplicate body tube ID: {tube1.id}")
        
        return v
    
    @validator('fins')
    def validate_fins(cls, v):
        if not v:
            raise ValueError("At least one fin set is required")
        
        # Check for duplicate fin IDs
        fin_ids = [fin.id for fin in v]
        if len(fin_ids) != len(set(fin_ids)):
            raise ValueError("Duplicate fin IDs found")
        
        return v
    
    @validator('parachutes')
    def validate_parachutes(cls, v):
        if not v:
            raise ValueError("At least one parachute is required")
        
        # Check for duplicate parachute IDs
        chute_ids = [chute.id for chute in v]
        if len(chute_ids) != len(set(chute_ids)):
            raise ValueError("Duplicate parachute IDs found")
        
        # Ensure we have at least one apogee trigger
        apogee_triggers = [chute for chute in v if chute.trigger == "apogee"]
        if not apogee_triggers:
            raise ValueError("At least one parachute must have 'apogee' trigger")
        
        return v
    
    @validator('rail_guides_position_m')
    def validate_rail_guides(cls, v):
        if v is not None:
            if len(v) < 2:
                raise ValueError("At least 2 rail guides are required if specified")
            
            # Check for negative positions
            if any(pos < 0 for pos in v):
                raise ValueError("Rail guide positions must be non-negative")
            
            # Check for duplicate positions
            if len(set(v)) != len(v):
                raise ValueError("Duplicate rail guide positions found")
            
            # Sort positions for consistency
            v.sort()
        
        return v
    
    def get_total_length(self) -> float:
        """Calculate total rocket length"""
        body_length = sum(tube.length_m for tube in self.body_tubes)
        nose_length = self.nose_cone.length_m
        return body_length + nose_length
    
    def get_body_diameter(self) -> float:
        """Get rocket body diameter (from largest body tube)"""
        if not self.body_tubes:
            return 0.0
        return max(tube.outer_radius_m for tube in self.body_tubes) * 2
    
    def get_fin_span(self) -> float:
        """Get maximum fin span"""
        if not self.fins:
            return 0.0
        return max(fin.span_m for fin in self.fins)
    
    def estimate_dry_mass(self) -> float:
        """Estimate rocket dry mass from components"""
        import math
        
        total_mass = 0.0
        
        # Nose cone mass (simplified cone volume calculation)
        nose = self.nose_cone
        nose_volume = math.pi * (nose.base_radius_m or 0.05)**2 * nose.length_m / 3
        nose_shell_volume = nose_volume * (nose.wall_thickness_m / (nose.base_radius_m or 0.05))
        total_mass += nose_shell_volume * nose.material_density_kg_m3
        
        # Body tube masses
        for tube in self.body_tubes:
            tube_volume = math.pi * (tube.outer_radius_m**2 - (tube.outer_radius_m - tube.wall_thickness_m)**2) * tube.length_m
            total_mass += tube_volume * tube.material_density_kg_m3
        
        # Fin masses
        for fin in self.fins:
            fin_area = 0.5 * (fin.root_chord_m + fin.tip_chord_m) * fin.span_m
            fin_volume = fin_area * fin.thickness_m
            fin_mass = fin_volume * fin.material_density_kg_m3
            total_mass += fin_mass * fin.fin_count
        
        return total_mass
    
    def validate_component_positions(self) -> List[str]:
        """Validate component positions don't conflict"""
        warnings = []
        
        # Get total rocket length for validation
        total_length = self.get_total_length()
        
        # Check motor position
        if self.motor.position_from_tail_m > total_length:
            warnings.append(f"Motor position {self.motor.position_from_tail_m}m exceeds rocket length {total_length}m")
        
        # Check parachute positions
        for chute in self.parachutes:
            if chute.position_from_tail_m > total_length:
                warnings.append(f"Parachute '{chute.name}' position {chute.position_from_tail_m}m exceeds rocket length {total_length}m")
        
        # Check rail guide positions
        if self.rail_guides_position_m:
            for pos in self.rail_guides_position_m:
                if pos > total_length:
                    warnings.append(f"Rail guide position {pos}m exceeds rocket length {total_length}m")
        
        return warnings
    
    def get_component_summary(self) -> dict:
        """Get summary of rocket components"""
        return {
            "total_length_m": self.get_total_length(),
            "body_diameter_m": self.get_body_diameter(),
            "max_fin_span_m": self.get_fin_span(),
            "estimated_dry_mass_kg": self.estimate_dry_mass(),
            "component_counts": {
                "body_tubes": len(self.body_tubes),
                "fin_sets": len(self.fins),
                "parachutes": len(self.parachutes),
                "rail_guides": len(self.rail_guides_position_m) if self.rail_guides_position_m else 0
            },
            "position_warnings": self.validate_component_positions()
        }