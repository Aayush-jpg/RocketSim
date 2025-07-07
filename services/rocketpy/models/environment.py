"""
Environment and launch parameter models.

This module defines models for atmospheric conditions, weather data,
and launch parameters with comprehensive validation.
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field, validator
from datetime import datetime

class AtmosphericProfileModel(BaseModel):
    """
    Detailed atmospheric profile data, typically from a weather forecast service.
    This model allows the frontend to be the single source of truth for atmospheric conditions.
    """
    altitude: List[float] = Field(..., description="Altitude points in meters")
    temperature: List[float] = Field(..., description="Temperature at each altitude point in Kelvin")
    pressure: List[float] = Field(..., description="Pressure at each altitude point in Pascals")
    density: List[float] = Field(..., description="Density at each altitude point in kg/m³")
    windU: List[float] = Field(..., description="Wind's U-component (East) at each altitude point in m/s")
    windV: List[float] = Field(..., description="Wind's V-component (North) at each altitude point in m/s")
    
    @validator('altitude')
    def validate_altitude(cls, v):
        if not v:
            raise ValueError("Altitude array cannot be empty")
        if any(alt < 0 for alt in v):
            raise ValueError("Altitude values must be non-negative")
        if v != sorted(v):
            raise ValueError("Altitude values must be in ascending order")
        return v
    
    @validator('temperature')
    def validate_temperature(cls, v, values):
        if 'altitude' in values and len(v) != len(values['altitude']):
            raise ValueError("Temperature array must have same length as altitude array")
        if any(temp <= 0 for temp in v):
            raise ValueError("Temperature values must be positive (in Kelvin)")
        if any(temp > 1000 for temp in v):
            raise ValueError("Temperature values seem unrealistic (> 1000K)")
        return v
    
    @validator('pressure')
    def validate_pressure(cls, v, values):
        if 'altitude' in values and len(v) != len(values['altitude']):
            raise ValueError("Pressure array must have same length as altitude array")
        if any(press <= 0 for press in v):
            raise ValueError("Pressure values must be positive")
        # Check for reasonable pressure decrease with altitude
        if len(v) > 1:
            for i in range(1, len(v)):
                if v[i] > v[i-1]:
                    # Allow small increases but warn about major non-monotonic behavior
                    if v[i] / v[i-1] > 1.1:  # More than 10% increase
                        raise ValueError(f"Significant pressure increase with altitude at index {i} (may cause bijective errors)")
        return v
    
    @validator('density')
    def validate_density(cls, v, values):
        if 'altitude' in values and len(v) != len(values['altitude']):
            raise ValueError("Density array must have same length as altitude array")
        if any(dens <= 0 for dens in v):
            raise ValueError("Density values must be positive")
        return v
    
    @validator('windU')
    def validate_wind_u(cls, v, values):
        if 'altitude' in values and len(v) != len(values['altitude']):
            raise ValueError("WindU array must have same length as altitude array")
        if any(abs(wind) > 200 for wind in v):
            raise ValueError("Wind speeds seem unrealistic (> 200 m/s)")
        return v
    
    @validator('windV')
    def validate_wind_v(cls, v, values):
        if 'altitude' in values and len(v) != len(values['altitude']):
            raise ValueError("WindV array must have same length as altitude array")
        if any(abs(wind) > 200 for wind in v):
            raise ValueError("Wind speeds seem unrealistic (> 200 m/s)")
        return v

class EnvironmentModel(BaseModel):
    """Environmental conditions with proper units"""
    latitude_deg: float = Field(0.0, description="Latitude in degrees", ge=-90, le=90)
    longitude_deg: float = Field(0.0, description="Longitude in degrees", ge=-180, le=180)
    elevation_m: float = Field(0.0, description="Elevation above sea level in meters", ge=-500, le=8848)
    date: Optional[str] = Field(None, description="Date in ISO format (YYYY-MM-DD)")
    timezone: Optional[str] = Field("UTC", description="Timezone")
    wind_speed_m_s: float = Field(0.0, description="Wind speed in m/s", ge=0, le=100)
    wind_direction_deg: float = Field(0.0, description="Wind direction in degrees (meteorological convention)", ge=0, le=360)
    atmospheric_model: Literal["standard", "custom", "forecast", "nrlmsise"] = "standard"
    temperature_offset_k: float = Field(0.0, description="Temperature offset from standard in Kelvin", ge=-50, le=50)
    pressure_offset_pa: float = Field(0.0, description="Pressure offset from standard in Pascals")
    
    # Optional field for high-fidelity atmospheric data from the frontend
    atmospheric_profile: Optional[AtmosphericProfileModel] = Field(
        None, 
        description="Detailed atmospheric data profile from frontend weather service."
    )
    
    @validator('date')
    def validate_date(cls, v):
        if v is not None:
            try:
                # Try to parse as ISO date
                datetime.fromisoformat(v.replace('Z', '+00:00'))
            except ValueError:
                raise ValueError("Date must be in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)")
        return v
    
    @validator('wind_direction_deg')
    def validate_wind_direction(cls, v):
        # Normalize wind direction to 0-360 range
        return v % 360
    
    @validator('atmospheric_model')
    def validate_atmospheric_model(cls, v):
        if v == "custom" and not hasattr(cls, 'atmospheric_profile'):
            raise ValueError("Custom atmospheric model requires atmospheric_profile data")
        return v
    
    def get_wind_components(self) -> tuple:
        """Get wind components (U, V) from speed and direction"""
        import math
        
        # Convert meteorological convention to mathematical
        wind_dir_rad = math.radians(270 - self.wind_direction_deg)
        
        wind_u = self.wind_speed_m_s * math.cos(wind_dir_rad)  # East component
        wind_v = self.wind_speed_m_s * math.sin(wind_dir_rad)  # North component
        
        return wind_u, wind_v
    
    def is_high_altitude_simulation(self) -> bool:
        """Check if this simulation requires high-altitude atmospheric modeling"""
        if self.atmospheric_profile:
            max_altitude = max(self.atmospheric_profile.altitude)
            return max_altitude > 30000  # Above 30km
        return self.atmospheric_model == "nrlmsise"

class LaunchParametersModel(BaseModel):
    """Launch parameters with SI units"""
    rail_length_m: float = Field(5.0, description="Launch rail length in meters", gt=0, le=50)
    inclination_deg: float = Field(85.0, description="Launch inclination in degrees", ge=0, le=90)
    heading_deg: float = Field(0.0, description="Launch heading in degrees", ge=0, le=360)
    
    # Enhanced launch parameters
    rail_inclination_deg: float = Field(0.0, description="Rail inclination from vertical in degrees", ge=0, le=15)
    launch_altitude_m: Optional[float] = Field(None, description="Launch altitude override in meters")
    
    @validator('inclination_deg')
    def validate_inclination(cls, v):
        if v < 45:
            raise ValueError("Launch inclination should be at least 45° for safety")
        return v
    
    @validator('heading_deg')
    def validate_heading(cls, v):
        # Normalize heading to 0-360 range
        return v % 360
    
    @validator('rail_inclination_deg')
    def validate_rail_inclination(cls, v):
        if v > 10:
            raise ValueError("Rail inclination > 10° may cause rail clearance issues")
        return v
    
    @validator('launch_altitude_m')
    def validate_launch_altitude(cls, v):
        if v is not None:
            if v < -500:
                raise ValueError("Launch altitude cannot be below -500m")
            if v > 8848:
                raise ValueError("Launch altitude cannot exceed Mt. Everest height")
        return v
    
    def get_rail_vector(self) -> tuple:
        """Get rail direction unit vector"""
        import math
        
        # Convert angles to radians
        inclination_rad = math.radians(self.inclination_deg)
        heading_rad = math.radians(self.heading_deg)
        rail_inclination_rad = math.radians(self.rail_inclination_deg)
        
        # Calculate rail direction vector
        # Apply rail inclination to the launch inclination
        effective_inclination = inclination_rad + rail_inclination_rad
        
        x = math.sin(effective_inclination) * math.sin(heading_rad)
        y = math.sin(effective_inclination) * math.cos(heading_rad)
        z = math.cos(effective_inclination)
        
        return x, y, z
    
    def estimate_rail_departure_velocity(self, thrust_n: float, mass_kg: float) -> float:
        """Estimate velocity at rail departure"""
        import math
        
        # Simple energy approach: F * d = 0.5 * m * v²
        # Assuming average thrust and accounting for gravity component
        gravity_component = 9.81 * math.cos(math.radians(self.inclination_deg))
        net_acceleration = thrust_n / mass_kg - gravity_component
        
        if net_acceleration <= 0:
            return 0.0
        
        # v = sqrt(2 * a * d)
        velocity = math.sqrt(2 * net_acceleration * self.rail_length_m)
        return max(0.0, velocity)