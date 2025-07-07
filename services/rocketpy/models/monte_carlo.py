"""
Monte Carlo simulation models.

This module defines models for Monte Carlo analysis including parameter variations,
statistics, and results with comprehensive validation.
"""

from typing import List, Dict, Any, Literal, Optional
from pydantic import BaseModel, Field, validator
from .rocket import RocketModel
from .environment import EnvironmentModel, LaunchParametersModel
from .simulation import SimulationResult

class ParameterVariation(BaseModel):
    """Parameter variation specification for Monte Carlo analysis"""
    parameter: str = Field(..., description="Parameter path (e.g., 'motor.thrust', 'environment.wind_speed')")
    distribution: Literal["normal", "uniform", "triangular"] = Field(..., description="Statistical distribution type")
    parameters: List[float] = Field(..., description="Distribution parameters")
    
    @validator('parameter')
    def validate_parameter(cls, v):
        if not v or not v.strip():
            raise ValueError("Parameter path cannot be empty")
        
        # Basic validation of parameter path format
        if not '.' in v:
            raise ValueError("Parameter path should contain at least one dot (e.g., 'motor.thrust')")
        
        return v.strip()
    
    @validator('parameters')
    def validate_parameters(cls, v, values):
        if not v:
            raise ValueError("Distribution parameters cannot be empty")
        
        if 'distribution' in values:
            dist = values['distribution']
            
            if dist == "normal":
                if len(v) != 2:
                    raise ValueError("Normal distribution requires exactly 2 parameters: [mean, std_dev]")
                if v[1] <= 0:
                    raise ValueError("Standard deviation must be positive")
            
            elif dist == "uniform":
                if len(v) != 2:
                    raise ValueError("Uniform distribution requires exactly 2 parameters: [min, max]")
                if v[0] >= v[1]:
                    raise ValueError("Uniform distribution: min must be less than max")
            
            elif dist == "triangular":
                if len(v) != 3:
                    raise ValueError("Triangular distribution requires exactly 3 parameters: [min, mode, max]")
                if not (v[0] <= v[1] <= v[2]):
                    raise ValueError("Triangular distribution: must have min ≤ mode ≤ max")
        
        return v

class MonteCarloRequest(BaseModel):
    """Monte Carlo simulation request"""
    rocket: RocketModel
    environment: Optional[EnvironmentModel] = None
    launchParameters: Optional[LaunchParametersModel] = None
    variations: List[ParameterVariation] = Field(..., description="List of parameter variations")
    iterations: int = Field(100, description="Number of Monte Carlo iterations", ge=1, le=10000)
    
    # Advanced options
    seed: Optional[int] = Field(None, description="Random seed for reproducibility")
    parallel: bool = Field(True, description="Run iterations in parallel")
    confidence_level: float = Field(0.95, description="Confidence level for statistics", gt=0, lt=1)
    
    @validator('variations')
    def validate_variations(cls, v):
        if not v:
            raise ValueError("At least one parameter variation is required")
        if len(v) > 50:
            raise ValueError("Cannot vary more than 50 parameters simultaneously")
        
        # Check for duplicate parameters
        parameters = [var.parameter for var in v]
        if len(parameters) != len(set(parameters)):
            raise ValueError("Duplicate parameter variations found")
        
        return v
    
    @validator('iterations')
    def validate_iterations(cls, v):
        if v < 10:
            raise ValueError("At least 10 iterations are recommended for meaningful statistics")
        if v > 10000:
            raise ValueError("Cannot exceed 10,000 iterations")
        return v
    
    @validator('seed')
    def validate_seed(cls, v):
        if v is not None and v < 0:
            raise ValueError("Random seed must be non-negative")
        return v

class MonteCarloStatistics(BaseModel):
    """Statistical summary for a Monte Carlo parameter"""
    mean: float = Field(..., description="Mean value")
    std: float = Field(..., description="Standard deviation")
    min: float = Field(..., description="Minimum value")
    max: float = Field(..., description="Maximum value")
    percentiles: Dict[str, float] = Field(..., description="Percentile values")
    
    @validator('std')
    def validate_std(cls, v):
        if v < 0:
            raise ValueError("Standard deviation cannot be negative")
        return v
    
    @validator('percentiles')
    def validate_percentiles(cls, v):
        # Expected percentiles
        expected_percentiles = ["5", "25", "50", "75", "95", "99"]
        
        for pct in expected_percentiles:
            if pct not in v:
                raise ValueError(f"Missing required percentile: {pct}")
        
        # Validate percentile ordering
        values = [v[pct] for pct in expected_percentiles]
        if values != sorted(values):
            raise ValueError("Percentile values must be in ascending order")
        
        return v

class LandingDispersionAnalysis(BaseModel):
    """Landing dispersion analysis results"""
    ellipse_major_axis_m: float = Field(..., description="Major axis of dispersion ellipse in meters")
    ellipse_minor_axis_m: float = Field(..., description="Minor axis of dispersion ellipse in meters")
    ellipse_rotation_deg: float = Field(..., description="Rotation of ellipse in degrees")
    confidence_level: float = Field(..., description="Confidence level for ellipse")
    landing_points: List[List[float]] = Field(..., description="Landing coordinates [[x, y], ...]")
    
    @validator('ellipse_major_axis_m')
    def validate_major_axis(cls, v):
        if v <= 0:
            raise ValueError("Ellipse major axis must be positive")
        return v
    
    @validator('ellipse_minor_axis_m')
    def validate_minor_axis(cls, v, values):
        if v <= 0:
            raise ValueError("Ellipse minor axis must be positive")
        if 'ellipse_major_axis_m' in values and v > values['ellipse_major_axis_m']:
            raise ValueError("Minor axis cannot be larger than major axis")
        return v
    
    @validator('ellipse_rotation_deg')
    def validate_rotation(cls, v):
        return v % 180  # Normalize to 0-180 range
    
    @validator('confidence_level')
    def validate_confidence(cls, v):
        if not 0 < v < 1:
            raise ValueError("Confidence level must be between 0 and 1")
        return v
    
    @validator('landing_points')
    def validate_landing_points(cls, v):
        for i, point in enumerate(v):
            if len(point) != 2:
                raise ValueError(f"Landing point {i} must have 2 coordinates [x, y]")
        return v

class MonteCarloResult(BaseModel):
    """Complete Monte Carlo simulation results"""
    nominal: SimulationResult = Field(..., description="Nominal (mean) simulation result")
    statistics: Dict[str, MonteCarloStatistics] = Field(..., description="Statistical analysis for each parameter")
    iterations: List[Dict[str, float]] = Field(..., description="Individual iteration results")
    
    # Advanced analysis
    landingDispersion: Optional[LandingDispersionAnalysis] = Field(None, description="Landing dispersion analysis")
    correlations: Optional[Dict[str, Dict[str, float]]] = Field(None, description="Parameter correlations")
    sensitivity: Optional[Dict[str, float]] = Field(None, description="Parameter sensitivity analysis")
    
    # Metadata
    successful_iterations: int = Field(..., description="Number of successful iterations")
    failed_iterations: int = Field(..., description="Number of failed iterations")
    execution_time_s: float = Field(..., description="Total execution time in seconds")
    
    @validator('statistics')
    def validate_statistics(cls, v):
        if not v:
            raise ValueError("Statistics cannot be empty")
        
        # Common expected parameters
        expected_params = ["maxAltitude", "maxVelocity", "apogeeTime", "stabilityMargin"]
        for param in expected_params:
            if param not in v:
                raise ValueError(f"Missing statistics for required parameter: {param}")
        
        return v
    
    @validator('iterations')
    def validate_iterations(cls, v):
        if not v:
            raise ValueError("Iterations data cannot be empty")
        return v
    
    @validator('successful_iterations')
    def validate_successful_iterations(cls, v, values):
        if v < 0:
            raise ValueError("Successful iterations cannot be negative")
        if 'iterations' in values and v > len(values['iterations']):
            raise ValueError("Successful iterations cannot exceed total iterations")
        return v
    
    @validator('failed_iterations')
    def validate_failed_iterations(cls, v):
        if v < 0:
            raise ValueError("Failed iterations cannot be negative")
        return v
    
    @validator('execution_time_s')
    def validate_execution_time(cls, v):
        if v <= 0:
            raise ValueError("Execution time must be positive")
        return v
    
    def get_success_rate(self) -> float:
        """Calculate simulation success rate"""
        total = self.successful_iterations + self.failed_iterations
        if total == 0:
            return 0.0
        return self.successful_iterations / total
    
    def get_parameter_statistics(self, parameter: str) -> Optional[MonteCarloStatistics]:
        """Get statistics for a specific parameter"""
        return self.statistics.get(parameter)
    
    def get_correlation(self, param1: str, param2: str) -> Optional[float]:
        """Get correlation between two parameters"""
        if self.correlations and param1 in self.correlations:
            return self.correlations[param1].get(param2)
        return None