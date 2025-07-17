"""
Simulation request and result models.

This module defines models for simulation requests, results, and trajectory data
with comprehensive validation and type safety.
"""

from typing import List, Dict, Any, Optional, Tuple, Literal
from pydantic import BaseModel, Field, validator
from .rocket import RocketModel
from .environment import EnvironmentModel, LaunchParametersModel

class TrajectoryData(BaseModel):
    """Trajectory data with time-series position, velocity, and acceleration"""
    time: List[float] = Field(..., description="Time points in seconds")
    position: List[List[float]] = Field(..., description="Position vectors [[x, y, z], ...] in meters")
    velocity: List[List[float]] = Field(..., description="Velocity vectors [[vx, vy, vz], ...] in m/s")
    acceleration: List[List[float]] = Field(..., description="Acceleration vectors [[ax, ay, az], ...] in m/s²")
    attitude: Optional[List[List[float]]] = Field(None, description="Quaternions [[q0, q1, q2, q3], ...] for 6-DOF")
    angularVelocity: Optional[List[List[float]]] = Field(None, description="Angular velocity [[wx, wy, wz], ...] in rad/s")
    
    @validator('time')
    def validate_time(cls, v):
        if not v:
            raise ValueError("Time array cannot be empty")
        if any(t < 0 for t in v):
            raise ValueError("Time values must be non-negative")
        if v != sorted(v):
            raise ValueError("Time values must be in ascending order")
        return v
    
    @validator('position')
    def validate_position(cls, v, values):
        if 'time' in values and len(v) != len(values['time']):
            raise ValueError("Position array must have same length as time array")
        for i, pos in enumerate(v):
            if len(pos) != 3:
                raise ValueError(f"Position vector at index {i} must have 3 components [x, y, z]")
        return v
    
    @validator('velocity')
    def validate_velocity(cls, v, values):
        if 'time' in values and len(v) != len(values['time']):
            raise ValueError("Velocity array must have same length as time array")
        for i, vel in enumerate(v):
            if len(vel) != 3:
                raise ValueError(f"Velocity vector at index {i} must have 3 components [vx, vy, vz]")
        return v
    
    @validator('acceleration')
    def validate_acceleration(cls, v, values):
        if 'time' in values and len(v) != len(values['time']):
            raise ValueError("Acceleration array must have same length as time array")
        for i, acc in enumerate(v):
            if len(acc) != 3:
                raise ValueError(f"Acceleration vector at index {i} must have 3 components [ax, ay, az]")
        return v
    
    @validator('attitude')
    def validate_attitude(cls, v, values):
        if v is not None:
            if 'time' in values and len(v) != len(values['time']):
                raise ValueError("Attitude array must have same length as time array")
            for i, quat in enumerate(v):
                if len(quat) != 4:
                    raise ValueError(f"Quaternion at index {i} must have 4 components [q0, q1, q2, q3]")
                # Check quaternion normalization
                norm_sq = sum(q**2 for q in quat)
                if not (0.9 < norm_sq < 1.1):  # Allow some numerical error
                    raise ValueError(f"Quaternion at index {i} is not normalized (norm² = {norm_sq:.3f})")
        return v
    
    @validator('angularVelocity')
    def validate_angular_velocity(cls, v, values):
        if v is not None:
            if 'time' in values and len(v) != len(values['time']):
                raise ValueError("Angular velocity array must have same length as time array")
            for i, omega in enumerate(v):
                if len(omega) != 3:
                    raise ValueError(f"Angular velocity at index {i} must have 3 components [wx, wy, wz]")
        return v

class FlightEvent(BaseModel):
    """Flight event marker with time and state information"""
    name: str = Field(..., description="Event name")
    time: float = Field(..., description="Event time in seconds", ge=0)
    altitude: float = Field(..., description="Altitude at event in meters")
    velocity: Optional[float] = Field(None, description="Velocity magnitude at event in m/s")
    
    @validator('name')
    def validate_name(cls, v):
        if not v or not v.strip():
            raise ValueError("Event name cannot be empty")
        return v.strip()

class SimulationResult(BaseModel):
    """Complete simulation result with trajectory and analysis"""
    maxAltitude: float = Field(..., description="Maximum altitude reached in meters")
    maxVelocity: float = Field(..., description="Maximum velocity reached in m/s")
    maxAcceleration: float = Field(..., description="Maximum acceleration in m/s²")
    apogeeTime: float = Field(..., description="Time to apogee in seconds")
    stabilityMargin: float = Field(..., description="Static stability margin")
    
    # Optional detailed data
    thrustCurve: Optional[List[Tuple[float, float]]] = Field(None, description="Thrust curve [(time, thrust), ...]")
    simulationFidelity: str = Field("standard", description="Simulation fidelity level")
    trajectory: Optional[TrajectoryData] = Field(None, description="Complete trajectory data")
    flightEvents: Optional[List[FlightEvent]] = Field(None, description="Key flight events")
    
    # Landing analysis
    impactVelocity: Optional[float] = Field(None, description="Impact velocity in m/s")
    driftDistance: Optional[float] = Field(None, description="Drift distance from launch site in meters")
    
    # Enhanced analysis data
    enhanced_data: Optional[Dict[str, Any]] = Field(None, description="Additional analysis results")
    
    @validator('maxAltitude')
    def validate_max_altitude(cls, v):
        if v < 0:
            raise ValueError("Maximum altitude cannot be negative")
        if v > 200000:  # 200 km seems like a reasonable upper limit for model rockets
            raise ValueError("Maximum altitude seems unrealistic (> 200 km)")
        return v
    
    @validator('maxVelocity')
    def validate_max_velocity(cls, v):
        if v < 0:
            raise ValueError("Maximum velocity cannot be negative")
        if v > 5000:  # 5 km/s seems like upper limit for model rockets
            raise ValueError("Maximum velocity seems unrealistic (> 5 km/s)")
        return v
    
    @validator('maxAcceleration')
    def validate_max_acceleration(cls, v):
        if v < 0:
            raise ValueError("Maximum acceleration cannot be negative")
        if v > 2500:  # 250g - absolute maximum for any rocket simulation
            raise ValueError(f"Maximum acceleration seems unrealistic (> 2500 m/s² / 250g). Got: {v:.1f} m/s² ({v/9.81:.1f}g)")
        # Allow higher accelerations for enhanced simulations (up to 2500 m/s² / 250g)
        return v
    
    @validator('apogeeTime')
    def validate_apogee_time(cls, v):
        if v < 0:
            raise ValueError("Apogee time cannot be negative")
        if v > 3600:  # 1 hour seems like reasonable upper limit
            raise ValueError("Apogee time seems unrealistic (> 1 hour)")
        return v
    
    @validator('stabilityMargin')
    def validate_stability_margin(cls, v):
        if v < 0:
            raise ValueError("Stability margin should be positive for stable flight")
        return v
    
    @validator('thrustCurve')
    def validate_thrust_curve(cls, v):
        if v is not None:
            for i, (time, thrust) in enumerate(v):
                if time < 0:
                    raise ValueError(f"Thrust curve time at index {i} cannot be negative")
                if thrust < 0:
                    raise ValueError(f"Thrust value at index {i} cannot be negative")
            
            # Check time ordering
            times = [point[0] for point in v]
            if times != sorted(times):
                raise ValueError("Thrust curve times must be in ascending order")
        return v
    
    @validator('impactVelocity')
    def validate_impact_velocity(cls, v):
        if v is not None and v < 0:
            raise ValueError("Impact velocity cannot be negative")
        return v
    
    @validator('driftDistance')
    def validate_drift_distance(cls, v):
        if v is not None and v < 0:
            raise ValueError("Drift distance cannot be negative")
        return v

class SimulationRequestModel(BaseModel):
    """Standard simulation request model"""
    rocket: RocketModel
    environment: Optional[EnvironmentModel] = None
    launchParameters: Optional[LaunchParametersModel] = None
    simulationType: Optional[Literal["standard", "hifi", "monte_carlo", "professional", "enhanced_6dof"]] = "standard"
    
    # Additional simulation options
    maxTime: Optional[float] = Field(None, description="Maximum simulation time in seconds", gt=0, le=3600)
    timeStep: Optional[float] = Field(None, description="Integration time step in seconds", gt=0, le=1.0)
    rtol: Optional[float] = Field(None, description="Relative tolerance for ODE solver", gt=0, le=1e-3)
    atol: Optional[float] = Field(None, description="Absolute tolerance for ODE solver", gt=0, le=1e-6)
    
    @validator('simulationType')
    def validate_simulation_type(cls, v):
        valid_types = ["standard", "hifi", "monte_carlo", "professional", "enhanced_6dof"]
        if v not in valid_types:
            raise ValueError(f"Invalid simulation type. Must be one of: {valid_types}")
        return v
    
    @validator('maxTime')
    def validate_max_time(cls, v):
        if v is not None and v > 3600:
            raise ValueError("Maximum simulation time cannot exceed 1 hour")
        return v
    
    @validator('timeStep')
    def validate_time_step(cls, v):
        if v is not None and v > 1.0:
            raise ValueError("Time step cannot exceed 1 second")
        return v

class BatchSimulationRequest(BaseModel):
    """Batch simulation request for multiple rockets"""
    requests: List[SimulationRequestModel] = Field(..., description="List of simulation requests")
    parallel: bool = Field(True, description="Run simulations in parallel")
    
    @validator('requests')
    def validate_requests(cls, v):
        if not v:
            raise ValueError("At least one simulation request is required")
        if len(v) > 100:
            raise ValueError("Cannot process more than 100 simulations in a batch")
        return v

class BatchSimulationResult(BaseModel):
    """Results from batch simulation"""
    results: List[SimulationResult] = Field(..., description="Individual simulation results")
    summary: Dict[str, Any] = Field(..., description="Batch summary statistics")
    
    @validator('results')
    def validate_results(cls, v, values):
        if not v:
            raise ValueError("Results array cannot be empty")
        return v