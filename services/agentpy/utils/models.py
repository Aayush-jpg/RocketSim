"""Pydantic models for API requests and tool parameters."""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Literal

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

class ComprehensiveContext(BaseModel):
    """Complete context information for agents."""
    rocket: Dict[str, Any]
    environment: Optional[EnvironmentData] = None
    simulationHistory: Optional[List[SimulationHistory]] = None
    analysisHistory: Optional[List[AnalysisHistory]] = None
    userPreferences: Optional[Dict[str, Any]] = None
    sessionInfo: Optional[Dict[str, Any]] = None

class ChatRequest(BaseModel):
    """Request model for the main /reason endpoint."""
    messages: List[Dict[str, str]]
    rocket: Dict[str, Any]
    # Enhanced context (optional for backward compatibility)
    environment: Optional[EnvironmentData] = None
    simulationHistory: Optional[List[SimulationHistory]] = None
    analysisHistory: Optional[List[AnalysisHistory]] = None
    userPreferences: Optional[Dict[str, Any]] = None
    sessionInfo: Optional[Dict[str, Any]] = None

class AgentRequest(BaseModel):
    """Request model for the /reason-with-agent endpoint."""
    messages: List[Dict[str, str]]
    rocket: Dict[str, Any]
    agent: Optional[str] = "master"  # Which agent to use
    # Enhanced context (optional for backward compatibility)
    environment: Optional[EnvironmentData] = None
    simulationHistory: Optional[List[SimulationHistory]] = None
    analysisHistory: Optional[List[AnalysisHistory]] = None
    userPreferences: Optional[Dict[str, Any]] = None
    sessionInfo: Optional[Dict[str, Any]] = None

class PartProps(BaseModel):
    """Properties for a rocket part that can be modified."""
    color: Optional[str] = None
    shape: Optional[str] = None
    length: Optional[float] = None
    baseØ: Optional[float] = Field(None, alias="baseØ")
    Ø: Optional[float] = Field(None, alias="Ø")
    root: Optional[float] = None
    span: Optional[float] = None
    sweep: Optional[float] = None
    
    model_config = {
        "extra": "forbid",  # Forbid extra properties
        "populate_by_name": True  # Allow population by name to handle aliases
    }

class RocketProps(BaseModel):
    """Properties for a rocket that can be modified."""
    motorId: Optional[str] = None
    Cd: Optional[float] = None
    units: Optional[str] = None
    
    model_config = {
        "extra": "forbid"  # Forbid extra properties
    } 