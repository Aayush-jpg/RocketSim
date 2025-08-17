"""
Component models for rocket simulation.

This module defines Pydantic models for all rocket components including
nose cones, body tubes, fins, motors, and parachutes with full validation.
"""

from typing import List, Dict, Any, Optional, Union, Literal
from pydantic import BaseModel, Field, validator

class NoseComponentModel(BaseModel):
    """Nose cone component with SI units"""
    id: str
    shape: Literal["ogive", "conical", "elliptical", "parabolic"] = "ogive"
    length_m: float = Field(..., description="Nose cone length in meters", gt=0, le=2.0)
    base_radius_m: Optional[float] = Field(None, description="Base radius in meters (if different from body)", gt=0)
    wall_thickness_m: float = Field(0.002, description="Wall thickness in meters", gt=0, le=0.01)
    material_id: str = Field("fiberglass", description="Material ID from materials database")
    material_density_kg_m3: float = Field(1600.0, description="Material density in kg/m³ (calculated from material_id)")
    surface_roughness_m: float = Field(1e-5, description="Surface roughness in meters")
    
    @validator('length_m')
    def validate_length(cls, v):
        if v <= 0:
            raise ValueError("Nose cone length must be positive")
        return v

class BodyComponentModel(BaseModel):
    """Body tube component with SI units"""
    id: str
    outer_radius_m: float = Field(..., description="Outer radius in meters", gt=0, le=1.0)
    length_m: float = Field(..., description="Length in meters", gt=0, le=10.0)
    wall_thickness_m: float = Field(0.003, description="Wall thickness in meters", gt=0, le=0.01)
    material_id: str = Field("fiberglass", description="Material ID from materials database")
    material_density_kg_m3: float = Field(1600.0, description="Material density in kg/m³ (calculated from material_id)")
    surface_roughness_m: float = Field(1e-5, description="Surface roughness in meters")
    
    @validator('wall_thickness_m')
    def validate_wall_thickness(cls, v, values):
        if 'outer_radius_m' in values and v >= values['outer_radius_m']:
            raise ValueError("Wall thickness must be less than outer radius")
        return v

class FinComponentModel(BaseModel):
    """Fin component with SI units"""
    id: str
    fin_count: int = Field(3, description="Number of fins", ge=2, le=8)
    root_chord_m: float = Field(..., description="Root chord length in meters", gt=0, le=0.5)
    tip_chord_m: float = Field(..., description="Tip chord length in meters", gt=0, le=0.5)
    span_m: float = Field(..., description="Fin span in meters", gt=0, le=0.3)
    sweep_length_m: float = Field(0.0, description="Sweep length in meters", ge=0, le=0.2)
    thickness_m: float = Field(0.006, description="Fin thickness in meters", gt=0, le=0.02)
    position_from_tail_m: float = Field(0.1, description="Position from rocket tail in meters", ge=0, le=10.0)
    material_id: str = Field("birch_plywood", description="Material ID from materials database")
    material_density_kg_m3: float = Field(650.0, description="Material density in kg/m³ (calculated from material_id)")
    airfoil: Optional[str] = Field("symmetric", description="Airfoil type")
    cant_angle_deg: float = Field(0.0, description="Cant angle in degrees", ge=-15, le=15)
    
    @validator('tip_chord_m')
    def validate_tip_chord(cls, v, values):
        if 'root_chord_m' in values and v > values['root_chord_m']:
            raise ValueError("Tip chord cannot be larger than root chord")
        return v
    
    @validator('sweep_length_m')
    def validate_sweep_length(cls, v, values):
        if 'span_m' in values and v > values['span_m']:
            raise ValueError("Sweep length cannot be larger than span")
        return v

class MotorComponentModel(BaseModel):
    """Motor component with enhanced parameters"""
    id: str
    motor_database_id: str = Field(..., description="Motor ID from database")
    position_from_tail_m: float = Field(0.0, description="Position from rocket tail in meters", ge=0)
    # Additional motor configuration parameters
    nozzle_expansion_ratio: Optional[float] = Field(None, description="Nozzle expansion ratio", gt=1)
    chamber_pressure_pa: Optional[float] = Field(None, description="Chamber pressure in Pascals", gt=0)
    
    @validator('motor_database_id')
    def validate_motor_id(cls, v):
        if not v or not v.strip():
            raise ValueError("Motor database ID cannot be empty")
        return v.strip()

class ParachuteComponentModel(BaseModel):
    """Parachute component with SI units"""
    id: str
    name: str = Field(..., description="Parachute name")
    cd_s_m2: float = Field(..., description="Drag coefficient times reference area in m²", gt=0, le=100)
    trigger: Union[str, float] = Field("apogee", description="Trigger condition: 'apogee', altitude in meters, or custom")
    sampling_rate_hz: float = Field(105.0, description="Sampling rate in Hz", gt=0, le=1000)
    lag_s: float = Field(1.5, description="Deployment lag in seconds", ge=0, le=10)
    noise_bias: float = Field(0.0, description="Noise bias")
    noise_deviation: float = Field(8.3, description="Noise standard deviation", ge=0)
    noise_correlation: float = Field(0.5, description="Noise correlation", ge=0, le=1)
    position_from_tail_m: float = Field(..., description="Position from rocket tail in meters", ge=0)
    
    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError("Parachute name cannot be empty")
        return v.strip()
    
    @validator('trigger')
    def validate_trigger(cls, v):
        if isinstance(v, str):
            valid_triggers = ["apogee", "drogue", "main"]
            if v.lower() not in valid_triggers:
                raise ValueError(f"String trigger must be one of: {valid_triggers}")
        elif isinstance(v, (int, float)):
            if v < 0:
                raise ValueError("Altitude trigger must be non-negative")
        else:
            raise ValueError("Trigger must be a string or number")
        return v

class MotorSpec(BaseModel):
    """Motor specification from database"""
    id: str
    name: str
    manufacturer: str
    type: Literal["solid", "liquid", "hybrid"]
    impulseClass: str
    totalImpulse: float = Field(..., description="Total impulse in N⋅s", gt=0)
    avgThrust: float = Field(..., description="Average thrust in N", gt=0)
    burnTime: float = Field(..., description="Burn time in seconds", gt=0)
    dimensions: Dict[str, float] = Field(..., description="Motor dimensions")
    weight: Dict[str, float] = Field(..., description="Motor weights")
    
    @validator('impulseClass')
    def validate_impulse_class(cls, v):
        valid_classes = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O']
        if v.upper() not in valid_classes:
            raise ValueError(f"Invalid impulse class. Must be one of: {valid_classes}")
        return v.upper()
    
    @validator('dimensions')
    def validate_dimensions(cls, v):
        required_fields = ['outerDiameter_m', 'length_m']
        for field in required_fields:
            if field not in v:
                raise ValueError(f"Missing required dimension: {field}")
            if v[field] <= 0:
                raise ValueError(f"Dimension {field} must be positive")
        return v
    
    @validator('weight')
    def validate_weight(cls, v):
        required_fields = ['propellant_kg', 'total_kg']
        for field in required_fields:
            if field not in v:
                raise ValueError(f"Missing required weight: {field}")
            if v[field] <= 0:
                raise ValueError(f"Weight {field} must be positive")
        
        if v['propellant_kg'] >= v['total_kg']:
            raise ValueError("Propellant weight must be less than total weight")
        return v