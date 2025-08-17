"""Pydantic models for API requests and tool parameters."""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Literal, Union

# ===========================
# ENVIRONMENT AND CONTEXT MODELS
# ===========================

class EnvironmentData(BaseModel):
    """Environment and weather conditions."""
    temperature: Optional[float] = None  # °C
    pressure: Optional[float] = None     # hPa
    humidity: Optional[float] = None     # %
    windSpeed: Optional[float] = None    # m/s
    windDirection: Optional[float] = None # degrees
    visibility: Optional[float] = None   # km
    cloudCover: Optional[float] = None   # %
    dewPoint: Optional[float] = None     # °C
    location: Optional[Dict[str, Any]] = None  # {lat, lon, elevation, city, country}
    weatherSource: Optional[str] = None  # API source used
    timestamp: Optional[str] = None      # when data was fetched

class SimulationHistory(BaseModel):
    """Previous simulation results."""
    maxAltitude: Optional[float] = None
    maxVelocity: Optional[float] = None
    maxAcceleration: Optional[float] = None
    apogeeTime: Optional[float] = None
    stabilityMargin: Optional[float] = None
    thrustCurve: Optional[List[List[float]]] = None
    trajectory: Optional[Dict[str, Any]] = None
    flightEvents: Optional[List[Dict[str, Any]]] = None
    fidelity: Optional[str] = None       # quick, hifi, etc.
    timestamp: Optional[str] = None      # when simulation was run

class AnalysisHistory(BaseModel):
    """Previous analysis results."""
    stabilityAnalysis: Optional[Dict[str, Any]] = None
    monteCarloResult: Optional[Dict[str, Any]] = None
    motorAnalysis: Optional[Dict[str, Any]] = None
    recoveryPrediction: Optional[Dict[str, Any]] = None
    performanceMetrics: Optional[Dict[str, Any]] = None
    timestamp: Optional[str] = None

# ===========================
# COMPONENT-BASED ROCKET MODELS
# ===========================

class NoseComponentModel(BaseModel):
    """Component-based nose cone with SI units."""
    id: str
    shape: Literal["ogive", "conical", "elliptical", "parabolic"] = "ogive"
    length_m: float = Field(..., description="Length in meters", gt=0, le=2.0)
    base_radius_m: Optional[float] = Field(None, description="Base radius in meters", gt=0)
    wall_thickness_m: float = Field(0.002, description="Wall thickness in meters", gt=0, le=0.01)
    material_id: str = Field("fiberglass", description="Material ID from materials database")
    material_density_kg_m3: float = Field(1600.0, description="Material density in kg/m³ (calculated from material_id)")
    surface_roughness_m: float = Field(1e-5, description="Surface roughness in meters")
    color: Optional[str] = None

class BodyComponentModel(BaseModel):
    """Component-based body tube with SI units."""
    id: str
    outer_radius_m: float = Field(..., description="Outer radius in meters", gt=0, le=1.0)
    length_m: float = Field(..., description="Length in meters", gt=0, le=10.0)
    wall_thickness_m: float = Field(0.003, description="Wall thickness in meters", gt=0, le=0.01)
    material_id: str = Field("fiberglass", description="Material ID from materials database")
    material_density_kg_m3: float = Field(1600.0, description="Material density in kg/m³ (calculated from material_id)")
    surface_roughness_m: float = Field(1e-5, description="Surface roughness in meters")
    color: Optional[str] = None

class FinComponentModel(BaseModel):
    """Component-based fin with SI units."""
    id: str
    fin_count: int = Field(3, description="Number of fins", ge=2, le=8)
    root_chord_m: float = Field(..., description="Root chord in meters", gt=0, le=0.5)
    tip_chord_m: float = Field(..., description="Tip chord in meters", gt=0, le=0.5)
    span_m: float = Field(..., description="Span in meters", gt=0, le=0.3)
    sweep_length_m: float = Field(0.0, description="Sweep length in meters", ge=0, le=0.2)
    thickness_m: float = Field(0.006, description="Thickness in meters", gt=0, le=0.02)
    position_from_tail_m: float = Field(0.1, description="Position from rocket tail in meters", ge=0, le=10.0)
    material_id: str = Field("birch_plywood", description="Material ID from materials database")
    material_density_kg_m3: float = Field(650.0, description="Material density in kg/m³ (calculated from material_id)")
    airfoil: Optional[str] = Field("symmetric", description="Airfoil type")
    cant_angle_deg: float = Field(0.0, description="Cant angle in degrees", ge=-15, le=15)
    color: Optional[str] = None

class MotorComponentModel(BaseModel):
    """Component-based motor with database reference."""
    id: str
    motor_database_id: str = Field(..., description="Motor ID from database")
    position_from_tail_m: float = Field(0.0, description="Position from tail in meters", ge=0)
    nozzle_expansion_ratio: Optional[float] = Field(None, description="Nozzle expansion ratio")
    chamber_pressure_pa: Optional[float] = Field(None, description="Chamber pressure in Pascals")

class ParachuteComponentModel(BaseModel):
    """Component-based parachute with deployment parameters."""
    id: str
    name: str = Field(..., description="Parachute name")
    cd_s_m2: float = Field(..., description="Drag coefficient × area in m²", gt=0, le=100)
    trigger: Union[str, float] = Field("apogee", description="Trigger condition")
    sampling_rate_hz: float = Field(105.0, description="Sampling rate in Hz", gt=0, le=1000)
    lag_s: float = Field(1.5, description="Deployment lag in seconds", ge=0, le=10)
    noise_bias: float = Field(0.0, description="Noise bias")
    noise_deviation: float = Field(8.3, description="Noise standard deviation")
    noise_correlation: float = Field(0.5, description="Noise correlation")
    position_from_tail_m: float = Field(..., description="Position from tail in meters", ge=0)
    color: Optional[str] = None

class ComponentRocketModel(BaseModel):
    """Component-based rocket model."""
    id: str
    name: str
    rocket_type: str = Field("solid", description="Type of rocket propulsion", pattern="^(solid|liquid|hybrid)$")
    nose_cone: NoseComponentModel
    body_tubes: List[BodyComponentModel]
    fins: List[FinComponentModel]
    motor: MotorComponentModel
    parachutes: List[ParachuteComponentModel]
    coordinate_system: Literal["tail_to_nose", "nose_to_tail"] = "tail_to_nose"
    rail_guides_position_m: Optional[List[float]] = Field(None, description="Rail guide positions")


# ===========================
# UNIFIED REQUEST MODELS
# ===========================

class ComprehensiveContext(BaseModel):
    """Complete context information for agents."""
    rocket: Union[Dict[str, Any], ComponentRocketModel]
    environment: Optional[EnvironmentData] = None
    simulationHistory: Optional[List[SimulationHistory]] = None
    analysisHistory: Optional[List[AnalysisHistory]] = None
    userPreferences: Optional[Dict[str, Any]] = None
    sessionInfo: Optional[Dict[str, Any]] = None

class ChatRequest(BaseModel):
    """Request model for the main /reason endpoint."""
    messages: List[Dict[str, str]]
    rocket: Union[Dict[str, Any], ComponentRocketModel]
    # Enhanced context (optional for backward compatibility)
    environment: Optional[EnvironmentData] = None
    simulationHistory: Optional[List[SimulationHistory]] = None
    analysisHistory: Optional[List[AnalysisHistory]] = None
    userPreferences: Optional[Dict[str, Any]] = None
    sessionInfo: Optional[Dict[str, Any]] = None

class AgentRequest(BaseModel):
    """Request model for the /reason-with-agent endpoint."""
    messages: List[Dict[str, str]]
    rocket: Union[Dict[str, Any], ComponentRocketModel]
    agent: Optional[str] = "master"  # Which agent to use
    # Enhanced context (optional for backward compatibility)
    environment: Optional[EnvironmentData] = None
    simulationHistory: Optional[List[SimulationHistory]] = None
    analysisHistory: Optional[List[AnalysisHistory]] = None
    userPreferences: Optional[Dict[str, Any]] = None
    sessionInfo: Optional[Dict[str, Any]] = None

# ===========================
# TOOL PARAMETER MODELS
# ===========================

class ComponentProps(BaseModel):
    """Properties for component-based modifications."""
    # Nose cone properties
    shape: Optional[str] = None
    length_m: Optional[float] = None
    base_radius_m: Optional[float] = None
    wall_thickness_m: Optional[float] = None
    # Body tube properties
    outer_radius_m: Optional[float] = None
    # Fin properties
    fin_count: Optional[int] = None
    root_chord_m: Optional[float] = None
    tip_chord_m: Optional[float] = None
    span_m: Optional[float] = None
    sweep_length_m: Optional[float] = None
    thickness_m: Optional[float] = None
    cant_angle_deg: Optional[float] = None
    # Motor properties
    motor_database_id: Optional[str] = None
    position_from_tail_m: Optional[float] = None
    # Parachute properties
    name: Optional[str] = None
    cd_s_m2: Optional[float] = None
    trigger: Optional[Union[str, float]] = None
    lag_s: Optional[float] = None
    # Common properties
    color: Optional[str] = None
    material_density_kg_m3: Optional[float] = None
    
    model_config = {
        "extra": "forbid"
    }

class RocketProps(BaseModel):
    """Properties for a rocket that can be modified."""
    # Component-based rocket properties
    coordinate_system: Optional[Literal["tail_to_nose", "nose_to_tail"]] = None
    rail_guides_position_m: Optional[List[float]] = None
    
    model_config = {
        "extra": "forbid"  # Forbid extra properties
    } 