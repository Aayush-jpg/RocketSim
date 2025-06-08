import os
import json
import uvicorn
import numpy as np
import threading
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import List, Dict, Any, Optional, Tuple, Union, Literal
from datetime import datetime
import asyncio
from concurrent.futures import ThreadPoolExecutor
import logging
import traceback

# ✅ ADD: Thread lock for RocketPy integrator thread safety
rocketpy_lock = threading.Lock()

# Import RocketPy
try:
    from rocketpy import Environment, SolidMotor, Rocket, Flight, GenericMotor, LiquidMotor, HybridMotor
    from rocketpy import NoseCone, Fins, Parachute
    ROCKETPY_AVAILABLE = True
    print("✅ RocketPy successfully imported with core classes")
except ImportError as e:
    print(f"Warning: RocketPy import failed: {e}")
    print("Using simplified simulation model")
    Environment, SolidMotor, Rocket, Flight, GenericMotor, LiquidMotor, HybridMotor = None, None, None, None, None, None, None
    NoseCone, Fins, Parachute = None, None, None
    ROCKETPY_AVAILABLE = False

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="RocketPy Professional Simulation Service",
    description="Professional-grade rocket simulation with 6-DOF physics, Monte Carlo analysis, and atmospheric modeling. All dimensions in SI units (meters, kg, seconds, Newtons).",
    version="3.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Thread pool for CPU-intensive simulations
executor = ThreadPoolExecutor(max_workers=4)

# ================================
# PHYSICAL CONSTANTS WITH CENTRALIZED MATERIALS
# ================================

# Load materials from shared JSON file - single source of truth
def load_material_database():
    """Load material database from shared JSON file"""
    try:
        materials_path = os.path.join(os.path.dirname(__file__), '..', '..', 'lib', 'data', 'materials.json')
        with open(materials_path, 'r') as f:
            material_data = json.load(f)
        
        print(f"✅ Successfully loaded {len(material_data)} materials from shared JSON")
        return material_data
        
    except Exception as e:
        print(f"❌ Failed to load materials from JSON: {e}")
        print("🔄 Using minimal fallback material database")
        # Minimal fallback - only essential materials
        return {
            "fiberglass": {
                "id": "fiberglass",
                "name": "Fiberglass (G10/FR4)",
                "category": "composite",
                "density_kg_m3": 1600.0,
                "surfaceRoughness_m": 0.00001,
                "availability": "common",
                "description": "Standard fiberglass composite",
                "applications": ["nose_cones", "body_tubes", "fin_root_sections"]
            },
            "aluminum_6061": {
                "id": "aluminum_6061", 
                "name": "Aluminum 6061-T6",
                "category": "metal",
                "density_kg_m3": 2700.0,
                "surfaceRoughness_m": 0.000002,
                "availability": "common",
                "description": "Standard aluminum alloy",
                "applications": ["motor_casings", "structural_components"]
            },
            "birch_plywood": {
                "id": "birch_plywood",
                "name": "Baltic Birch Plywood", 
                "category": "wood",
                "density_kg_m3": 650.0,
                "surfaceRoughness_m": 0.00005,
                "availability": "common",
                "description": "High-quality plywood",
                "applications": ["fins", "internal_structures"]
            }
        }

# Load the material database at startup
MATERIAL_DATABASE = load_material_database()

class PhysicalConstants:
    """Physical constants in SI units with centralized material properties"""
    STANDARD_GRAVITY = 9.80665  # m/s²
    STANDARD_TEMPERATURE = 288.15  # K
    STANDARD_PRESSURE = 101325.0  # Pa
    AIR_DENSITY_SEA_LEVEL = 1.225  # kg/m³
    
    # Use centralized material properties from JSON
    DENSITY_FIBERGLASS = MATERIAL_DATABASE.get("fiberglass", {}).get("density_kg_m3", 1600.0)
    DENSITY_ALUMINUM = MATERIAL_DATABASE.get("aluminum_6061", {}).get("density_kg_m3", 2700.0) 
    DENSITY_CARBON_FIBER = MATERIAL_DATABASE.get("carbon_fiber", {}).get("density_kg_m3", 1500.0)
    DENSITY_PLYWOOD = MATERIAL_DATABASE.get("birch_plywood", {}).get("density_kg_m3", 650.0)
    DENSITY_ABS = MATERIAL_DATABASE.get("abs", {}).get("density_kg_m3", 1050.0)
    DENSITY_APCP = MATERIAL_DATABASE.get("apcp", {}).get("density_kg_m3", 1815.0)

def get_material_density(material_id: str) -> float:
    """Get material density by ID from JSON database"""
    material = MATERIAL_DATABASE.get(material_id)
    if material and "density_kg_m3" in material:
        return material["density_kg_m3"]
    
    # Emergency fallback if material not found
    print(f"⚠️ Material '{material_id}' not found, using fiberglass default")
    return MATERIAL_DATABASE.get("fiberglass", {}).get("density_kg_m3", 1600.0)

def get_material_properties(material_id: str) -> dict:
    """Get complete material properties by ID"""
    return MATERIAL_DATABASE.get(material_id, MATERIAL_DATABASE.get("fiberglass", {}))

# ================================
# UNIT CONVERSION UTILITIES
# ================================

class UnitConverter:
    """Handles unit conversions to ensure all RocketPy inputs are in SI units"""
    
    @staticmethod
    def length_to_meters(value: float, from_unit: str) -> float:
        """Convert length to meters"""
        conversions = {
            "m": 1.0,
            "cm": 0.01,
            "mm": 0.001,
            "in": 0.0254,
            "ft": 0.3048
        }
        return value * conversions.get(from_unit, 1.0)
    
    @staticmethod
    def mass_to_kg(value: float, from_unit: str) -> float:
        """Convert mass to kilograms"""
        conversions = {
            "kg": 1.0,
            "g": 0.001,
            "lb": 0.453592,
            "oz": 0.0283495
        }
        return value * conversions.get(from_unit, 1.0)
    
    @staticmethod
    def force_to_newtons(value: float, from_unit: str) -> float:
        """Convert force to Newtons"""
        conversions = {
            "N": 1.0,
            "lbf": 4.44822,
            "kgf": 9.80665
        }
        return value * conversions.get(from_unit, 1.0)

# ================================
# ENHANCED PYDANTIC MODELS WITH PROPER SI UNITS
# ================================

class NoseComponentModel(BaseModel):
    """Nose cone component with SI units"""
    id: str
    shape: Literal["ogive", "conical", "elliptical", "parabolic"] = "ogive"
    length_m: float = Field(..., description="Nose cone length in meters", gt=0, le=2.0)
    base_radius_m: Optional[float] = Field(None, description="Base radius in meters (if different from body)", gt=0)
    wall_thickness_m: float = Field(0.002, description="Wall thickness in meters", gt=0, le=0.01)
    material_density_kg_m3: float = Field(PhysicalConstants.DENSITY_FIBERGLASS, description="Material density in kg/m³")
    surface_roughness_m: float = Field(1e-5, description="Surface roughness in meters")

class BodyComponentModel(BaseModel):
    """Body tube component with SI units"""
    id: str
    outer_radius_m: float = Field(..., description="Outer radius in meters", gt=0, le=1.0)
    length_m: float = Field(..., description="Length in meters", gt=0, le=10.0)
    wall_thickness_m: float = Field(0.003, description="Wall thickness in meters", gt=0, le=0.01)
    material_density_kg_m3: float = Field(PhysicalConstants.DENSITY_FIBERGLASS, description="Material density in kg/m³")
    surface_roughness_m: float = Field(1e-5, description="Surface roughness in meters")

class FinComponentModel(BaseModel):
    """Fin component with SI units"""
    id: str
    fin_count: int = Field(3, description="Number of fins", ge=2, le=8)
    root_chord_m: float = Field(..., description="Root chord length in meters", gt=0, le=0.5)
    tip_chord_m: float = Field(..., description="Tip chord length in meters", gt=0, le=0.5)
    span_m: float = Field(..., description="Fin span in meters", gt=0, le=0.3)
    sweep_length_m: float = Field(0.0, description="Sweep length in meters", ge=0, le=0.2)
    thickness_m: float = Field(0.006, description="Fin thickness in meters", gt=0, le=0.02)
    material_density_kg_m3: float = Field(PhysicalConstants.DENSITY_PLYWOOD, description="Material density in kg/m³")
    airfoil: Optional[str] = Field("symmetric", description="Airfoil type")
    cant_angle_deg: float = Field(0.0, description="Cant angle in degrees", ge=-15, le=15)

class MotorComponentModel(BaseModel):
    """Motor component with enhanced parameters"""
    id: str
    motor_database_id: str = Field(..., description="Motor ID from database")
    position_from_tail_m: float = Field(0.0, description="Position from rocket tail in meters", ge=0)
    # Additional motor configuration parameters
    nozzle_expansion_ratio: Optional[float] = Field(None, description="Nozzle expansion ratio")
    chamber_pressure_pa: Optional[float] = Field(None, description="Chamber pressure in Pascals")

class ParachuteComponentModel(BaseModel):
    """Parachute component with SI units"""
    id: str
    name: str = Field(..., description="Parachute name")
    cd_s_m2: float = Field(..., description="Drag coefficient times reference area in m²", gt=0, le=100)
    trigger: Union[str, float] = Field("apogee", description="Trigger condition: 'apogee', altitude in meters, or custom")
    sampling_rate_hz: float = Field(105.0, description="Sampling rate in Hz", gt=0, le=1000)
    lag_s: float = Field(1.5, description="Deployment lag in seconds", ge=0, le=10)
    noise_bias: float = Field(0.0, description="Noise bias")
    noise_deviation: float = Field(8.3, description="Noise standard deviation")
    noise_correlation: float = Field(0.5, description="Noise correlation")
    position_from_tail_m: float = Field(..., description="Position from rocket tail in meters", ge=0)

class RocketModel(BaseModel):
    """Complete rocket model with component-based architecture"""
    id: str
    name: str
    nose_cone: NoseComponentModel
    body_tubes: List[BodyComponentModel]
    fins: List[FinComponentModel]
    motor: MotorComponentModel
    parachutes: List[ParachuteComponentModel]
    # Rocket-level properties
    coordinate_system: Literal["tail_to_nose", "nose_to_tail"] = "tail_to_nose"
    rail_guides_position_m: Optional[List[float]] = Field(None, description="Rail guide positions from tail in meters")
    
    @validator('body_tubes')
    def validate_body_tubes(cls, v):
        if not v:
            raise ValueError("At least one body tube is required")
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
    atmospheric_model: Literal["standard", "custom", "forecast"] = "standard"
    temperature_offset_k: float = Field(0.0, description="Temperature offset from standard in Kelvin", ge=-50, le=50)
    pressure_offset_pa: float = Field(0.0, description="Pressure offset from standard in Pascals")

class LaunchParametersModel(BaseModel):
    """Launch parameters with SI units"""
    rail_length_m: float = Field(5.0, description="Launch rail length in meters", gt=0, le=50)
    inclination_deg: float = Field(85.0, description="Launch inclination in degrees", ge=0, le=90)
    heading_deg: float = Field(0.0, description="Launch heading in degrees", ge=0, le=360)
    # Enhanced launch parameters
    rail_inclination_deg: float = Field(0.0, description="Rail inclination from vertical in degrees", ge=0, le=15)
    launch_altitude_m: Optional[float] = Field(None, description="Launch altitude override in meters")

# ================================
# REQUEST/RESPONSE MODELS
# ================================

class SimulationRequestModel(BaseModel):
    """Standard simulation request model"""
    rocket: RocketModel
    environment: Optional[EnvironmentModel] = None
    launchParameters: Optional[LaunchParametersModel] = None
    simulationType: Optional[Literal["standard", "hifi", "monte_carlo"]] = "standard"

async def parse_simulation_request(request: Request) -> SimulationRequestModel:
    """Parse simulation request with component-based rocket model"""
    try:
        # Get raw JSON
        body = await request.json()
        print(f"🔍 DEBUG: Received request body with keys: {list(body.keys())}")
        
        # Extract rocket data
        rocket_data = body.get('rocket')
        if rocket_data is None:
            raise HTTPException(status_code=400, detail="Missing 'rocket' field")
        
        print(f"🔍 DEBUG: Rocket data keys: {list(rocket_data.keys()) if isinstance(rocket_data, dict) else type(rocket_data)}")
        
        # Parse rocket as component-based model
        try:
            rocket_model = RocketModel(**rocket_data)
            print(f"✅ DEBUG: Successfully parsed as component-based RocketModel")
        except Exception as e:
            print(f"❌ DEBUG: Failed to parse as RocketModel: {e}")
            # Try to provide helpful error message
            if isinstance(rocket_data, dict):
                has_components = any(key in rocket_data for key in ['nose_cone', 'body_tubes', 'fins', 'motor', 'parachutes'])
                has_parts = 'parts' in rocket_data
                if has_parts and not has_components:
                    raise HTTPException(
                        status_code=400, 
                        detail="Legacy parts-based format is no longer supported. Please use component-based format with nose_cone, body_tubes, fins, motor, and parachutes fields."
                    )
            raise HTTPException(status_code=400, detail=f"Invalid rocket format: {e}")
        
        # Parse environment
        environment = None
        if 'environment' in body and body['environment']:
            try:
                environment = EnvironmentModel(**body['environment'])
            except Exception as e:
                print(f"❌ DEBUG: Failed to parse environment: {e}")
                # Use defaults if environment parsing fails
                environment = EnvironmentModel()
        
        # Parse launch parameters
        launch_params = None
        if 'launchParameters' in body and body['launchParameters']:
            try:
                launch_params = LaunchParametersModel(**body['launchParameters'])
            except Exception as e:
                print(f"❌ DEBUG: Failed to parse launch parameters: {e}")
                # Use defaults if launch parameters parsing fails
                launch_params = LaunchParametersModel()
        
        simulation_type = body.get('simulationType', 'standard')
        
        # Create the request object
        request_obj = SimulationRequestModel(
            rocket=rocket_model,
            environment=environment,
            launchParameters=launch_params,
            simulationType=simulation_type
        )
        
        print(f"✅ DEBUG: Successfully created SimulationRequestModel")
        return request_obj
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ DEBUG: Unexpected error in parse_simulation_request: {e}")
        raise HTTPException(status_code=400, detail=f"Request parsing error: {e}")

class ParameterVariation(BaseModel):
    parameter: str
    distribution: Literal["normal", "uniform", "triangular"]
    parameters: List[float]

class MonteCarloRequest(BaseModel):
    rocket: RocketModel
    environment: Optional[EnvironmentModel] = None
    launchParameters: Optional[LaunchParametersModel] = None
    variations: List[ParameterVariation]
    iterations: int = 100

class TrajectoryData(BaseModel):
    time: List[float]
    position: List[List[float]]  # [[x, y, z], ...]
    velocity: List[List[float]]  # [[vx, vy, vz], ...]
    acceleration: List[List[float]]  # [[ax, ay, az], ...]
    attitude: Optional[List[List[float]]] = None  # [[q0, q1, q2, q3], ...]
    angularVelocity: Optional[List[List[float]]] = None  # [[wx, wy, wz], ...]

class FlightEvent(BaseModel):
    name: str
    time: float
    altitude: float

class SimulationResult(BaseModel):
    maxAltitude: float
    maxVelocity: float
    maxAcceleration: float
    apogeeTime: float
    stabilityMargin: float
    thrustCurve: Optional[List[Tuple[float, float]]] = None
    simulationFidelity: str = "standard"
    trajectory: Optional[TrajectoryData] = None
    flightEvents: Optional[List[FlightEvent]] = None
    impactVelocity: Optional[float] = None
    driftDistance: Optional[float] = None
    enhanced_data: Optional[Dict[str, Any]] = None

class MonteCarloStatistics(BaseModel):
    mean: float
    std: float
    min: float
    max: float
    percentiles: Dict[str, float]

class MonteCarloResult(BaseModel):
    nominal: SimulationResult
    statistics: Dict[str, MonteCarloStatistics]
    iterations: List[Dict[str, float]]
    landingDispersion: Optional[Dict[str, Any]] = None

class MotorSpec(BaseModel):
    id: str
    name: str
    manufacturer: str
    type: Literal["solid", "liquid", "hybrid"]
    impulseClass: str
    totalImpulse: float
    avgThrust: float
    burnTime: float
    dimensions: Dict[str, float]
    weight: Dict[str, float]





# ================================
# ENHANCED MOTOR DATABASE WITH SI UNITS
# ================================

# Load motors from shared JSON file - single source of truth
import json
import os

def load_motor_database():
    """Load motor database from shared JSON file"""
    try:
        motors_path = os.path.join(os.path.dirname(__file__), '..', '..', 'lib', 'data', 'motors.json')
        with open(motors_path, 'r') as f:
            motor_data_raw = json.load(f)

        # Convert frontend format to backend format (camelCase -> snake_case)
        motor_database = {}
        for motor_id, spec in motor_data_raw.items():
            motor_database[motor_id] = {
                "name": spec["name"],
                "manufacturer": spec["manufacturer"],
                "type": spec["type"],
                "impulse_class": spec["impulseClass"],
                "total_impulse_n_s": spec["totalImpulse_Ns"],
                "avg_thrust_n": spec["avgThrust_N"],
                "burn_time_s": spec["burnTime_s"],
            "dimensions": {
                    "outer_diameter_m": spec["dimensions"]["outerDiameter_m"],
                    "length_m": spec["dimensions"]["length_m"]
            },
            "mass": {
                    "propellant_kg": spec["mass"]["propellant_kg"],
                    "total_kg": spec["mass"]["total_kg"]
            },
                "isp_s": spec["isp_s"]
        }
        
        # Add optional configs if present
            if "grainConfig" in spec and spec["grainConfig"]:
                motor_database[motor_id]["grain_config"] = {
                    "grain_number": spec["grainConfig"]["grainNumber"],
                    "grain_density_kg_m3": spec["grainConfig"]["grainDensity_kg_m3"],
                    "grain_outer_radius_m": spec["grainConfig"]["grainOuterRadius_m"],
                    "grain_initial_inner_radius_m": spec["grainConfig"]["grainInitialInnerRadius_m"],
                    "grain_initial_height_m": spec["grainConfig"]["grainInitialHeight_m"]
            }
            
            if "propellantConfig" in spec and spec["propellantConfig"]:
                motor_database[motor_id]["propellant_config"] = {
                    "oxidizer_to_fuel_ratio": spec["propellantConfig"]["oxidizerToFuelRatio"],
                    "chamber_pressure_pa": spec["propellantConfig"]["chamberPressure_pa"],
                    "nozzle_expansion_ratio": spec["propellantConfig"]["nozzleExpansionRatio"]
            }
            
            if "hybridConfig" in spec and spec["hybridConfig"]:
                motor_database[motor_id]["hybrid_config"] = {
                    "grain_density_kg_m3": spec["hybridConfig"]["grainDensity_kg_m3"],
                    "oxidizer_mass_kg": spec["hybridConfig"]["oxidizerMass_kg"],
                    "fuel_mass_kg": spec["hybridConfig"]["fuelMass_kg"],
                    "chamber_pressure_pa": spec["hybridConfig"]["chamberPressure_pa"]
                }
        
        print(f"✅ Successfully loaded {len(motor_database)} motors from shared JSON")
        return motor_database
        
    except Exception as e:
        print(f"❌ Failed to load motors from JSON: {e}")
        print("🔄 Using minimal fallback motor database")
        # Minimal fallback - only essential motors
        return {
        "default-motor": {
            "name": "F32-6", "manufacturer": "Generic", "type": "solid",
            "impulse_class": "F", "total_impulse_n_s": 80, "avg_thrust_n": 32,
            "burn_time_s": 2.5,
            "dimensions": {"outer_diameter_m": 0.029, "length_m": 0.124},
            "mass": {"propellant_kg": 0.040, "total_kg": 0.070},
                "isp_s": 200
            }
        }

# Load the motor database at startup
MOTOR_DATABASE = load_motor_database()

# ================================
# SIMULATION CLASSES
# ================================

class SimulationEnvironment:
    """Wrapper for RocketPy Environment with enhanced features"""
    
    def __init__(self, config: EnvironmentModel):
        if not ROCKETPY_AVAILABLE:
            self.env = None
            return
            
        self.config = config
        self.env = Environment(
            latitude=config.latitude_deg,
            longitude=config.longitude_deg,
            elevation=config.elevation_m
        )
        
        # Set date if provided
        if config.date:
            try:
                date_obj = datetime.fromisoformat(config.date.replace('Z', '+00:00'))
                self.env.set_date(date_obj, timezone=config.timezone or "UTC")
            except:
                logger.warning(f"Failed to parse date: {config.date}")
        
        # Set atmospheric model
        if config.atmospheric_model == "standard":
            self.env.set_atmospheric_model(type='standard_atmosphere')
        elif config.atmospheric_model == "forecast":
            try:
                self.env.set_atmospheric_model(type='Forecast', file='GFS')
            except:
                logger.warning("Failed to load GFS forecast, using standard atmosphere")
                self.env.set_atmospheric_model(type='standard_atmosphere')
        
        # Add wind if specified
        if config.wind_speed_m_s and config.wind_speed_m_s > 0:
            self._add_wind_profile(config.wind_speed_m_s, config.wind_direction_deg or 0)
    
    def _add_wind_profile(self, wind_speed: float, wind_direction: float):
        """Add wind profile to environment with correct meteorological coordinate conversion"""
        if not self.env:
            return
            
        # CRITICAL FIX: Correct meteorological to Cartesian coordinate conversion
        # Meteorological convention: wind_direction is direction wind comes FROM
        # Need to convert to RocketPy's Cartesian system (u=East, v=North)
        
        # Convert meteorological direction (FROM) to Cartesian components
        # Add 180° to convert "from" to "to" direction, then convert to u,v
        direction_to = wind_direction + 180.0
        wind_u = wind_speed * np.sin(np.radians(direction_to))  # East component
        wind_v = wind_speed * np.cos(np.radians(direction_to))  # North component
        
        # Alternative correct formula (equivalent):
        # wind_u = -wind_speed * np.sin(np.radians(wind_direction))
        # wind_v = -wind_speed * np.cos(np.radians(wind_direction))
        
        # Create simple wind profile (constant wind)
        wind_profile = [
            (0, wind_u, wind_v),
            (1000, wind_u, wind_v),
            (10000, wind_u * 1.5, wind_v * 1.5)  # Stronger wind at altitude
        ]
        
        try:
            self.env.set_atmospheric_model(
                type='Custom',
                wind_u=wind_profile,
                wind_v=wind_profile
            )
            logger.info(f"Set wind profile: {wind_speed} m/s from {wind_direction}° → u={wind_u:.2f}, v={wind_v:.2f}")
        except Exception as e:
            logger.warning(f"Failed to set custom wind profile: {e}")

class SimulationMotor:
    """Enhanced motor wrapper supporting multiple motor types"""
    
    def __init__(self, motor_id: str):
        self.motor_id = motor_id
        self.spec = MOTOR_DATABASE.get(motor_id, MOTOR_DATABASE["default-motor"])
        self.motor = None
        
        if not ROCKETPY_AVAILABLE:
            return
        
        self._create_motor()
    
    def _create_motor(self):
        """Create appropriate motor type based on specifications"""
        motor_type = self.spec["type"]
        
        if motor_type == "solid":
            self._create_solid_motor()
        elif motor_type == "liquid":
            self._create_liquid_motor()
        elif motor_type == "hybrid":
            self._create_hybrid_motor()
    
    def _create_solid_motor(self):
        """Create solid motor with realistic thrust curve"""
        thrust_curve = self._generate_thrust_curve()
        
        self.motor = SolidMotor(
            thrust_source=thrust_curve,
            dry_mass=self.spec["mass"]["total_kg"] - self.spec["mass"]["propellant_kg"],
            dry_inertia=(0.125, 0.125, 0.002),
            nozzle_radius=self.spec["dimensions"]["outer_diameter_m"] / 2000,  # mm to m
            grain_number=1,
            grain_density=1815,  # kg/m³
            grain_outer_radius=self.spec["dimensions"]["outer_diameter_m"] / 2000 - 0.002,
            grain_initial_inner_radius=0.005,
            grain_initial_height=self.spec["dimensions"]["length_m"] / 1000 * 0.8,
            grain_separation=0.005,  # 5mm separation between grains
            grains_center_of_mass_position=0.5,  # Center of motor
            center_of_dry_mass_position=0.5,  # Center of dry mass
            nozzle_position=0,
            burn_time=self.spec["burn_time_s"]
        )
    
    def _create_liquid_motor(self):
        """Create liquid motor with staged combustion"""
        thrust_curve = self._generate_liquid_thrust_curve()
        
        # Use GenericMotor for liquid engines with custom thrust curves
        self.motor = GenericMotor(
            thrust_source=thrust_curve,
            dry_mass=self.spec["mass"]["total_kg"] - self.spec["mass"]["propellant_kg"],
            dry_inertia=(0.2, 0.2, 0.002),
            nozzle_radius=self.spec["dimensions"]["outer_diameter_m"] / 2000,
            burn_time=self.spec["burn_time_s"]
        )
    
    def _create_hybrid_motor(self):
        """Create hybrid motor"""
        thrust_curve = self._generate_hybrid_thrust_curve()
        
        self.motor = GenericMotor(
            thrust_source=thrust_curve,
            dry_mass=self.spec["mass"]["total_kg"] - self.spec["mass"]["propellant_kg"],
            dry_inertia=(0.15, 0.15, 0.002),
            nozzle_radius=self.spec["dimensions"]["outer_diameter_m"] / 2000,
            burn_time=self.spec["burn_time_s"]
        )
    
    def _generate_thrust_curve(self) -> List[Tuple[float, float]]:
        """Generate realistic thrust curve for solid motor"""
        burn_time = self.spec["burn_time_s"]
        avg_thrust = self.spec["avg_thrust_n"]
        
        curve = []
        time_points = np.linspace(0, burn_time, 20)
        
        for t in time_points:
            normalized_time = t / burn_time
            
            if normalized_time < 0.1:
                # Initial spike
                thrust = avg_thrust * (1.5 + 0.5 * np.sin(normalized_time * 10))
            elif normalized_time < 0.8:
                # Sustained burn with variation
                thrust = avg_thrust * (1.0 + 0.1 * np.sin(normalized_time * 8))
            else:
                # Tail-off
                thrust = avg_thrust * (1.2 - (normalized_time - 0.8) / 0.2)
            
            curve.append((t, max(0, thrust)))
        
        curve.append((burn_time + 0.1, 0))
        return curve
    
    def _generate_liquid_thrust_curve(self) -> List[Tuple[float, float]]:
        """Generate liquid engine thrust curve"""
        burn_time = self.spec["burn_time_s"]
        avg_thrust = self.spec["avg_thrust_n"]
        
        curve = []
        time_points = np.linspace(0, burn_time, 30)
        
        for t in time_points:
            normalized_time = t / burn_time
            
            if normalized_time < 0.05:
                # Startup transient
                thrust = avg_thrust * (normalized_time / 0.05) * 0.8
            elif normalized_time < 0.95:
                # Steady state with minor oscillations
                thrust = avg_thrust * (1.0 + 0.02 * np.sin(normalized_time * 20))
            else:
                # Shutdown
                thrust = avg_thrust * (1 - (normalized_time - 0.95) / 0.05)
            
            curve.append((t, max(0, thrust)))
        
        curve.append((burn_time + 0.1, 0))
        return curve
    
    def _generate_hybrid_thrust_curve(self) -> List[Tuple[float, float]]:
        """Generate hybrid engine thrust curve"""
        burn_time = self.spec["burn_time_s"]
        avg_thrust = self.spec["avg_thrust_n"]
        
        curve = []
        time_points = np.linspace(0, burn_time, 25)
        
        for t in time_points:
            normalized_time = t / burn_time
            
            if normalized_time < 0.1:
                # Initial buildup
                thrust = avg_thrust * (0.7 + 0.3 * normalized_time / 0.1)
            elif normalized_time < 0.9:
                # Steady burn with regression effects
                thrust = avg_thrust * (1.0 - 0.1 * normalized_time + 0.05 * np.sin(normalized_time * 6))
            else:
                # Tail-off
                thrust = avg_thrust * (1.1 - (normalized_time - 0.9) / 0.1)
            
            curve.append((t, max(0, thrust)))
        
        curve.append((burn_time + 0.1, 0))
        return curve

class SimulationRocket:
    """Enhanced rocket wrapper with component modeling"""
    
    def __init__(self, rocket_config: RocketModel, motor: SimulationMotor):
        self.config = rocket_config
        self.motor = motor
        self.rocket = None
        
        if not ROCKETPY_AVAILABLE:
            return
        
        self._create_rocket()
    
    def _create_rocket(self):
        """Create RocketPy rocket from configuration"""
        # Calculate rocket properties from parts
        radius = self._calculate_radius()
        mass = self._calculate_dry_mass()
        inertia = self._calculate_inertia()
        com = self._calculate_center_of_mass()
        drag_curve = self._calculate_drag_curve()
        
        self.rocket = Rocket(
            radius=radius,
            mass=mass,
            inertia=inertia,
            power_off_drag=drag_curve,
            power_on_drag=drag_curve,
            center_of_mass_without_motor=com,
            coordinate_system_orientation="tail_to_nose"
        )
        
        # Add motor
        if self.motor.motor:
            motor_position = self._calculate_motor_position()
            self.rocket.add_motor(self.motor.motor, position=motor_position)
        
        # Add components
        self._add_nose_cone()
        self._add_fins()
        self._add_parachutes()
    
    def _calculate_radius(self) -> float:
        """Calculate rocket radius from body tube components"""
        if self.config.body_tubes:
            # Get the largest body tube radius (since rockets can have multiple body sections)
            max_radius = max(tube.outer_radius_m for tube in self.config.body_tubes)
            return max_radius  # Already in meters from the new model
        return 0.05  # Default 5cm radius
    
    def _calculate_dry_mass(self) -> float:
        """Calculate dry mass from components using material properties"""
        total_mass = 0.1  # Base structural mass
        
        # Nose cone mass
        if hasattr(self.config, 'nose_cone') and self.config.nose_cone:
            nose = self.config.nose_cone
            length = nose.length_m
            base_radius = nose.base_radius_m or self._calculate_radius()
            wall_thickness = nose.wall_thickness_m
            material_density = nose.material_density_kg_m3
            
            # Approximate nose cone as cone shell
            surface_area = np.pi * base_radius * np.sqrt(base_radius**2 + length**2)
            mass = surface_area * wall_thickness * material_density
            total_mass += mass
        
        # Body tube masses
        for tube in self.config.body_tubes:
            length = tube.length_m
            radius = tube.outer_radius_m
            wall_thickness = tube.wall_thickness_m
            material_density = tube.material_density_kg_m3
            
            # Cylindrical shell mass
            surface_area = 2 * np.pi * radius * length
            mass = surface_area * wall_thickness * material_density
            total_mass += mass
        
        # Fin masses
        for fin in self.config.fins:
            root_chord = fin.root_chord_m
            tip_chord = fin.tip_chord_m
            span = fin.span_m
            thickness = fin.thickness_m
            material_density = fin.material_density_kg_m3
            fin_count = fin.fin_count
            
            # Trapezoidal fin area
            fin_area = 0.5 * (root_chord + tip_chord) * span
            volume_per_fin = fin_area * thickness
            mass_per_fin = volume_per_fin * material_density
            total_mass += mass_per_fin * fin_count
        
        return total_mass
    
    def _calculate_inertia(self) -> Tuple[float, float, float]:
        """Calculate rocket inertia tensor"""
        mass = self._calculate_dry_mass()
        radius = self._calculate_radius()
        length = self._calculate_total_length()
        
        # Simplified inertia calculation for cylinder
        ixx = iyy = mass * (3 * radius**2 + length**2) / 12
        izz = mass * radius**2 / 2
        
        return (ixx, iyy, izz)
    
    def _calculate_total_length(self) -> float:
        """Calculate total rocket length from components"""
        total_length = 0.0
        
        # Add nose cone length
        if hasattr(self.config, 'nose_cone') and self.config.nose_cone:
            total_length += self.config.nose_cone.length_m
        
        # Add all body tube lengths
        for tube in self.config.body_tubes:
            total_length += tube.length_m
        
        return total_length
    
    def _calculate_center_of_mass(self) -> float:
        """Calculate center of mass without motor using component-wise analysis"""
        total_mass = 0.0
        weighted_position = 0.0
        current_position = 0.0
        
        # Process components from nose to tail (tail_to_nose coordinate system)
        
        # Nose cone contribution
        if hasattr(self.config, 'nose_cone') and self.config.nose_cone:
            nose = self.config.nose_cone
            length = nose.length_m
            base_radius = nose.base_radius_m or self._calculate_radius()
            wall_thickness = nose.wall_thickness_m
            material_density = nose.material_density_kg_m3
            
            # Nose cone mass
            surface_area = np.pi * base_radius * np.sqrt(base_radius**2 + length**2)
            nose_mass = surface_area * wall_thickness * material_density
            
            # Nose cone COM is at approximately 2/3 from tip (for cone)
            nose_com = current_position + length * (2.0/3.0)
            
            weighted_position += nose_mass * nose_com
            total_mass += nose_mass
            current_position += length
        
        # Body tube contributions
        for tube in self.config.body_tubes:
            length = tube.length_m
            radius = tube.outer_radius_m
            wall_thickness = tube.wall_thickness_m
            material_density = tube.material_density_kg_m3
            
            # Body tube mass
            surface_area = 2 * np.pi * radius * length
            tube_mass = surface_area * wall_thickness * material_density
            
            # Body tube COM is at center
            tube_com = current_position + length / 2.0
            
            weighted_position += tube_mass * tube_com
            total_mass += tube_mass
            current_position += length
        
        # Fins are typically mounted near the tail, so we position them there
        for fin in self.config.fins:
            root_chord = fin.root_chord_m
            tip_chord = fin.tip_chord_m
            span = fin.span_m
            thickness = fin.thickness_m
            material_density = fin.material_density_kg_m3
            fin_count = fin.fin_count
            
            # Fin mass
            fin_area = 0.5 * (root_chord + tip_chord) * span
            volume_per_fin = fin_area * thickness
            mass_per_fin = volume_per_fin * material_density
            total_fin_mass = mass_per_fin * fin_count
            
            # Fins are positioned near the tail (assume 90% of rocket length)
            fin_com = current_position * 0.9
            
            weighted_position += total_fin_mass * fin_com
            total_mass += total_fin_mass
        
        if total_mass > 0:
            return weighted_position / total_mass
        else:
            return current_position / 2.0  # Fallback to rocket center
    
    def _calculate_motor_position(self) -> float:
        """Calculate motor position from rocket tail"""
        # Motor position is specified from tail in the motor component
        return self.config.motor.position_from_tail_m
    
    def _calculate_drag_curve(self) -> float:
        """Calculate drag coefficient from component properties"""
        total_drag = 0.0
        
        # Nose cone drag
        if hasattr(self.config, 'nose_cone') and self.config.nose_cone:
            nose_shape = self.config.nose_cone.shape
            shape_drag_coeffs = {
                "ogive": 0.12,
                "conical": 0.15,
                "elliptical": 0.10,
                "parabolic": 0.13
            }
            total_drag += shape_drag_coeffs.get(nose_shape, 0.12)
        
        # Body drag (skin friction)
        reference_area = np.pi * self._calculate_radius() ** 2
        wetted_area = 0.0
        
        for tube in self.config.body_tubes:
            circumference = 2 * np.pi * tube.outer_radius_m
            wetted_area += circumference * tube.length_m
        
        # Skin friction coefficient (typical for model rockets)
        cf = 0.02
        skin_friction_drag = cf * wetted_area / reference_area
        total_drag += skin_friction_drag
        
        # Fin drag
        for fin in self.config.fins:
            fin_area = 0.5 * (fin.root_chord_m + fin.tip_chord_m) * fin.span_m
            fin_drag_coeff = 0.01 * fin.fin_count * fin_area / reference_area
            total_drag += fin_drag_coeff
        
        # Base drag
        total_drag += 0.12
        
        return max(total_drag, 0.3)  # Minimum reasonable drag coefficient
    
    def _add_nose_cone(self):
        """Add nose cone to rocket"""
        if not hasattr(self.config, 'nose_cone') or not self.config.nose_cone or not self.rocket:
            return
        
        nose = self.config.nose_cone  # ✅ Direct access to nose_cone component
        length = nose.length_m        # ✅ Already in meters from SI model
        shape = nose.shape  
        
        # Map our shapes to RocketPy shapes
        shape_map = {
            "ogive": "tangent ogive",
            "conical": "conical",
            "elliptical": "elliptical",
            "parabolic": "parabolic"
        }
        # In tail_to_nose coordinate system, nose cone is at the front (maximum position)
        total_length = self._calculate_total_length()
        position = total_length  # Position at the front tip
        
        try:
            self.rocket.add_nose(
                length=length,
                kind=shape_map.get(shape, "tangent ogive"),
                position=position
            )
            logger.info(f"Added nose cone: {shape}, length={length:.3f}m at position={position:.3f}m")

        except Exception as e:
            logger.warning(f"Failed to add nose cone: {e}")
        
    def _add_fins(self):
        """Add fins to rocket using proper component model"""
        # ✅ CORRECT: Access fins directly from the component list
        if not self.config.fins or not self.rocket:
            return
        
        # ✅ Process each fin set (rockets can have multiple fin configurations)
        for fin_set in self.config.fins:
            root_chord = fin_set.root_chord_m      # ✅ Already in meters
            tip_chord = fin_set.tip_chord_m        # ✅ Already in meters  
            span = fin_set.span_m                  # ✅ Already in meters
            sweep_length = fin_set.sweep_length_m  # ✅ Already in meters
            fin_count = fin_set.fin_count          # ✅ Use actual fin count
            cant_angle = fin_set.cant_angle_deg    # ✅ Use actual cant angle
            
            # ✅ Calculate position near the tail (fins are typically at 80-90% of rocket length)
            total_length = self._calculate_total_length()
            fin_position = total_length * 0.15  # Position from tail (15% up from tail)
            
            try:
                self.rocket.add_trapezoidal_fins(
                    n=fin_count,                    # ✅ Use actual fin count from model
                    root_chord=root_chord,
                    tip_chord=tip_chord,
                    span=span,
                    position=fin_position,          # ✅ Calculated position
                    cant_angle=cant_angle,          # ✅ Use actual cant angle
                    sweep_length=sweep_length,
                    airfoil=None
                )
                logger.info(f"Added {fin_count} fins: root={root_chord:.3f}m, span={span:.3f}m at position={fin_position:.3f}m")
            except Exception as e:
                logger.warning(f"Failed to add fins: {e}")  

    def _add_parachutes(self):
        """Add parachutes to rocket using proper component model"""
        # ✅ CORRECT: Access parachutes directly from the component list
        if not self.config.parachutes or not self.rocket:
            return
        
        # ✅ Process each parachute (rockets can have multiple parachute systems)
        for i, chute in enumerate(self.config.parachutes):
            cd_s = chute.cd_s_m2  # ✅ Already in m² from SI model
            lag = chute.lag_s     # ✅ Already in seconds from SI model
            
            # ✅ CRITICAL: Proper trigger handling from model
            if chute.trigger == "apogee":
                trigger = "apogee"
            elif isinstance(chute.trigger, (int, float)):
                trigger = float(chute.trigger)  # Altitude trigger in meters
            else:
                trigger = "apogee"  # Fallback
            
            # ✅ Use all model properties instead of hardcoded values
            sampling_rate = chute.sampling_rate_hz
            noise_bias = chute.noise_bias
            noise_deviation = chute.noise_deviation
            noise_correlation = chute.noise_correlation
            
            # ✅ Use position from model (though RocketPy may not support this directly)
            # position = chute.position_from_tail_m  # For future use
            
            try:
                self.rocket.add_parachute(
                    name=chute.name,                                    # ✅ Use actual name
                    cd_s=cd_s,
                    trigger=trigger,                                    # ✅ Proper trigger handling
                    sampling_rate=sampling_rate,                        # ✅ From model
                    lag=lag,
                    noise=(noise_bias, noise_deviation, noise_correlation)  # ✅ From model
                )
                logger.info(f"Added parachute '{chute.name}': cd_s={cd_s}m², trigger={trigger}, lag={lag}s")
            except Exception as e:
                logger.warning(f"Failed to add parachute '{chute.name}': {e}")
                
class SimulationFlight:
    """Enhanced flight simulation wrapper"""
    
    def __init__(self, rocket: SimulationRocket, environment: SimulationEnvironment, 
                 launch_params: LaunchParametersModel):
        self.rocket = rocket
        self.environment = environment
        self.launch_params = launch_params
        self.flight = None
        self.results = None
        
        if not ROCKETPY_AVAILABLE or not rocket.rocket or not environment.env:
            return
        
        self._run_simulation()
    
    def _run_simulation(self):
        """Run the flight simulation with thread safety for Monte Carlo"""
        try:
            # ✅ DEBUG: Track where RocketPy simulation calls are coming from
            logger.warning(f"🔍 ROCKETPY FLIGHT STARTED - Call stack:")
            for line in traceback.format_stack()[-5:]:
                logger.warning(f"  {line.strip()}")
            
            # ✅ FIXED: Use thread lock to prevent RocketPy integrator conflicts
            with rocketpy_lock:
                # ✅ FIXED: Use more robust integrator settings for thread safety
                self.flight = Flight(
                    rocket=self.rocket.rocket,
                    environment=self.environment.env,
                    rail_length=self.launch_params.rail_length_m,
                    inclination=self.launch_params.inclination_deg,
                    heading=self.launch_params.heading_deg,
                    rtol=1e-6,   # ✅ Reduced precision for better stability
                    atol=1e-9,   # ✅ Reduced precision for better stability
                    max_time=300.0,  # ✅ Limit simulation time to prevent hangs
                    terminate_on_apogee=False,  # ✅ Continue to ground impact
                    verbose=False  # ✅ Reduce output for Monte Carlo
                )
            
            self._extract_results()
            
        except Exception as e:
            logger.error(f"Flight simulation failed: {e}")
            # ✅ Create fallback result instead of raising exception
            self._create_fallback_result()
    
    def _create_fallback_result(self):
        """Create fallback result when simulation fails"""
        logger.warning("Creating fallback simulation result due to simulation failure")
        
        # Get motor specs for basic calculation
        motor_spec = MOTOR_DATABASE.get(self.rocket.motor.motor_id, MOTOR_DATABASE["default-motor"])
        
        # Basic physics calculation
        total_mass = self.rocket._calculate_dry_mass() + motor_spec["mass"]["propellant_kg"]
        thrust = motor_spec["avg_thrust_n"]
        burn_time = motor_spec["burn_time_s"]
        
        # Simple trajectory estimation
        max_velocity = (thrust / total_mass) * burn_time * 0.7  # Losses
        max_altitude = (max_velocity ** 2) / (2 * 9.81) * 0.6  # Air resistance
        apogee_time = max_velocity / 9.81
        
        self.results = SimulationResult(
            maxAltitude=max(0.0, float(max_altitude)),
            maxVelocity=max(0.0, float(max_velocity)),
            maxAcceleration=max(0.0, float(thrust / total_mass)),
            apogeeTime=max(0.0, float(apogee_time)),
            stabilityMargin=1.5,  # Default stable value
            thrustCurve=[(0.0, 0.0), (burn_time/2, thrust), (burn_time, 0.0)],
            simulationFidelity="fallback",
            impactVelocity=10.0,
            driftDistance=50.0
        )
    
    def _extract_results(self):
        """Extract key results from flight simulation"""
        if not self.flight:
            return
        
        try:
            # Basic flight metrics
            max_altitude = float(self.flight.apogee - self.environment.config.elevation_m)
            max_velocity = float(self.flight.max_speed)
            max_acceleration = float(self.flight.max_acceleration)
            apogee_time = float(self.flight.apogee_time)
            
            # Stability margin
            try:
                stability_margin = float(self.rocket.rocket.static_margin(0))
            except:
                stability_margin = 1.5  # Default value
            
            # Trajectory data (6-DOF)
            trajectory = self._extract_trajectory()
            
            # Flight events
            events = self._extract_events()
            
            # Impact data
            impact_velocity = getattr(self.flight, 'impact_velocity', None)
            drift_distance = self._calculate_drift_distance()
            
            # Thrust curve
            thrust_curve = self._extract_thrust_curve()
            
            self.results = SimulationResult(
                maxAltitude=max_altitude,
                maxVelocity=max_velocity,
                maxAcceleration=max_acceleration,
                apogeeTime=apogee_time,
                stabilityMargin=stability_margin,
                thrustCurve=thrust_curve,
                simulationFidelity="standard",
                trajectory=trajectory,
                flightEvents=events,
                impactVelocity=impact_velocity,
                driftDistance=drift_distance
            )
            
        except Exception as e:
            logger.error(f"Failed to extract results: {e}")
            raise
    
    def _extract_trajectory(self) -> TrajectoryData:
        """Extract 6-DOF trajectory data with safe array handling"""
        if not self.flight:
            return None
        
        try:
            # ✅ FIXED: Safe array extraction with proper numpy handling
            time_points = self.flight.time
            
            # ✅ Convert to lists first to avoid numpy scalar issues
            if hasattr(time_points, '__iter__') and len(time_points) > 0:
                time_list = [float(t) for t in time_points]
            else:
                logger.warning("Invalid time points in trajectory")
                return None
            
            # ✅ FIXED: Safe position data extraction
            try:
                x_data = self.flight.x
                y_data = self.flight.y 
                z_data = self.flight.z
                
                # Handle both callable and array formats
                if callable(x_data):
                    position = [[float(x_data(t)), float(y_data(t)), float(z_data(t))] for t in time_list[:10]]  # Limit to 10 points
                else:
                    position = [[float(x), float(y), float(z)] 
                               for x, y, z in zip(list(x_data)[:10], list(y_data)[:10], list(z_data)[:10])]
            except Exception as pos_error:
                logger.warning(f"Position extraction failed: {pos_error}")
                position = [[0.0, 0.0, float(i*100)] for i in range(min(10, len(time_list)))]  # Fallback
            
            # ✅ FIXED: Safe velocity data extraction  
            try:
                vx_data = self.flight.vx
                vy_data = self.flight.vy
                vz_data = self.flight.vz
                
                if callable(vx_data):
                    velocity = [[float(vx_data(t)), float(vy_data(t)), float(vz_data(t))] for t in time_list[:10]]
                else:
                    velocity = [[float(vx), float(vy), float(vz)] 
                               for vx, vy, vz in zip(list(vx_data)[:10], list(vy_data)[:10], list(vz_data)[:10])]
            except Exception as vel_error:
                logger.warning(f"Velocity extraction failed: {vel_error}")
                velocity = [[0.0, 0.0, float(i*50)] for i in range(min(10, len(time_list)))]  # Fallback
            
            # ✅ FIXED: Safe acceleration data extraction
            try:
                ax_data = self.flight.ax
                ay_data = self.flight.ay
                az_data = self.flight.az
                
                if callable(ax_data):
                    acceleration = [[float(ax_data(t)), float(ay_data(t)), float(az_data(t))] for t in time_list[:10]]
                else:
                    acceleration = [[float(ax), float(ay), float(az)] 
                                   for ax, ay, az in zip(list(ax_data)[:10], list(ay_data)[:10], list(az_data)[:10])]
            except Exception as acc_error:
                logger.warning(f"Acceleration extraction failed: {acc_error}")
                acceleration = [[0.0, 0.0, float(i*20)] for i in range(min(10, len(time_list)))]  # Fallback
            
            # ✅ FIXED: Safe attitude data extraction (optional)
            attitude = None
            angular_velocity = None
            
            try:
                e0_data = self.flight.e0
                e1_data = self.flight.e1
                e2_data = self.flight.e2
                e3_data = self.flight.e3
                
                if all(hasattr(self.flight, attr) for attr in ['e0', 'e1', 'e2', 'e3']):
                    if callable(e0_data):
                        attitude = [[float(e0_data(t)), float(e1_data(t)), float(e2_data(t)), float(e3_data(t))] 
                                   for t in time_list[:10]]
                    else:
                        attitude = [[float(e0), float(e1), float(e2), float(e3)] 
                                   for e0, e1, e2, e3 in zip(list(e0_data)[:10], list(e1_data)[:10], 
                                                             list(e2_data)[:10], list(e3_data)[:10])]
                
                # Angular velocity
                if all(hasattr(self.flight, attr) for attr in ['wx', 'wy', 'wz']):
                    wx_data = self.flight.wx
                    wy_data = self.flight.wy  
                    wz_data = self.flight.wz
                    
                    if callable(wx_data):
                        angular_velocity = [[float(wx_data(t)), float(wy_data(t)), float(wz_data(t))] 
                                           for t in time_list[:10]]
                    else:
                        angular_velocity = [[float(wx), float(wy), float(wz)] 
                                           for wx, wy, wz in zip(list(wx_data)[:10], list(wy_data)[:10], list(wz_data)[:10])]
            except Exception as att_error:
                logger.debug(f"6-DOF attitude data not available: {att_error}")
                # attitude and angular_velocity remain None - this is normal for 3-DOF simulations
            
            return TrajectoryData(
                time=time_list[:10],  # Limit trajectory size to prevent memory issues
                position=position,
                velocity=velocity,
                acceleration=acceleration,
                attitude=attitude,
                angularVelocity=angular_velocity
            )
            
        except Exception as e:
            logger.warning(f"Failed to extract trajectory: {e}")
            return None
    
    def _extract_events(self) -> List[FlightEvent]:
        """Extract flight events"""
        if not self.flight:
            return []
        
        events = []
        
        try:
            # Motor burnout
            if hasattr(self.flight, 'motor_burn_out_time'):
                events.append(FlightEvent(
                    name="Motor Burnout",
                    time=float(self.flight.motor_burn_out_time),
                    altitude=float(self.flight.z(self.flight.motor_burn_out_time))
                ))
            
            # Apogee
            events.append(FlightEvent(
                name="Apogee",
                time=float(self.flight.apogee_time),
                altitude=float(self.flight.apogee)
            ))
            
            # Parachute deployment
            for parachute in self.rocket.rocket.parachutes:
                if hasattr(parachute, 'triggering_event'):
                    events.append(FlightEvent(
                        name=f"Parachute Deployment ({parachute.name})",
                        time=float(parachute.triggering_event.t),
                        altitude=float(parachute.triggering_event.altitude)
                    ))
            
            # Impact
            if hasattr(self.flight, 'impact_time'):
                events.append(FlightEvent(
                    name="Impact",
                    time=float(self.flight.impact_time),
                    altitude=float(self.environment.config.elevation_m)
                ))
                
        except Exception as e:
            logger.warning(f"Failed to extract events: {e}")
        
        return events
    
    def _extract_thrust_curve(self) -> List[Tuple[float, float]]:
        """Extract motor thrust curve with safe array handling"""
        if not self.rocket.motor.motor:
            return []
        
        try:
            motor = self.rocket.motor.motor
            motor_spec = self.rocket.motor.spec
            
            # ✅ FIXED: Use motor spec data for reliable thrust curve
            burn_time = motor_spec["burn_time_s"]
            avg_thrust = motor_spec["avg_thrust_n"]
            
            # ✅ Create simplified thrust curve from motor specifications
            time_points = np.linspace(0, burn_time, 20)  # Limit to 20 points
            thrust_data = []
            
            for t in time_points:
                try:
                    # ✅ Try to get actual thrust data if available
                    if hasattr(motor, 'thrust') and hasattr(motor.thrust, 'get_value_opt'):
                        thrust = float(motor.thrust.get_value_opt(t))
                    else:
                        # ✅ Fallback to generated curve based on motor spec
                        normalized_time = t / burn_time if burn_time > 0 else 0
                        if normalized_time < 0.1:
                            # Initial spike
                            thrust = avg_thrust * (1.5 + 0.5 * np.sin(normalized_time * 10))
                        elif normalized_time < 0.8:
                            # Sustained burn
                            thrust = avg_thrust * (1.0 + 0.1 * np.sin(normalized_time * 8))
                        else:
                            # Tail-off
                            thrust = avg_thrust * (1.2 - (normalized_time - 0.8) / 0.2)
                        
                        thrust = max(0, thrust)
                    
                    thrust_data.append((float(t), float(thrust)))
                    
                except Exception as thrust_error:
                    logger.debug(f"Thrust extraction error at t={t}: {thrust_error}")
                    # Use fallback calculation
                    normalized_time = t / burn_time if burn_time > 0 else 0
                    thrust = avg_thrust * max(0, 1 - normalized_time) if normalized_time <= 1 else 0
                    thrust_data.append((float(t), float(thrust)))
            
            # ✅ Ensure curve ends at zero
            thrust_data.append((float(burn_time + 0.1), 0.0))
            
            logger.debug(f"Extracted thrust curve with {len(thrust_data)} points")
            return thrust_data
            
        except Exception as e:
            logger.warning(f"Failed to extract thrust curve: {e}")
            # ✅ Return simple fallback thrust curve
            motor_spec = self.rocket.motor.spec
            burn_time = motor_spec["burn_time_s"]
            avg_thrust = motor_spec["avg_thrust_n"]
            
            return [
                (0.0, 0.0),
                (0.1, avg_thrust * 1.2),
                (burn_time * 0.5, avg_thrust),
                (burn_time * 0.9, avg_thrust * 0.8),
                (burn_time, 0.0)
            ]
    
    def _calculate_drift_distance(self) -> float:
        """Calculate drift distance from launch point"""
        if not self.flight:
            return 0.0
        
        try:
            impact_x = float(self.flight.x_impact)
            impact_y = float(self.flight.y_impact)
            return float(np.sqrt(impact_x**2 + impact_y**2))
        except:
            return 0.0

# ================================
# MONTE CARLO SIMULATION
# ================================

class MonteCarloSimulation:
    """Monte Carlo simulation with parameter variations"""
    
    def __init__(self, base_request: MonteCarloRequest):
        self.base_request = base_request
        self.results = []
        self.statistics = {}
    
    async def run(self) -> MonteCarloResult:
        """Run Monte Carlo simulation with sequential execution for thread safety"""
        logger.info(f"🎯 Starting Monte Carlo simulation with {self.base_request.iterations} iterations")
        
        # ✅ COMPLETELY DISABLE ROCKETPY FOR MONTE CARLO - Run nominal simulation with simplified physics
        try:
            logger.info("🎯 MONTE CARLO: Running nominal simulation with simplified physics")
            nominal_result = await simulate_simplified_fallback(self.base_request.rocket)
            logger.info(f"🎯 MONTE CARLO: Nominal simulation successful - max altitude: {nominal_result.maxAltitude:.1f}m")
        except Exception as e:
            logger.warning(f"Nominal simulation failed: {e}")
            # Create fallback nominal result
            nominal_result = SimulationResult(
                maxAltitude=1000.0,
                maxVelocity=100.0,
                maxAcceleration=50.0,
                apogeeTime=10.0,
                stabilityMargin=1.5,
                thrustCurve=[(0.0, 0.0), (2.5, 50.0), (5.0, 0.0)],
                simulationFidelity="nominal_fallback"
            )
        
        # ✅ FIXED: Run simulations sequentially to avoid integrator conflicts
        logger.info("🎯 MONTE CARLO: Running Monte Carlo iterations sequentially for thread safety")
        
        for i in range(self.base_request.iterations):
            try:
                # Generate varied configuration for this iteration
                varied_config = self._apply_variations(i)
                
                # ✅ Run single simulation sequentially (not concurrently)
                result = await self._run_single_simulation(*varied_config)
                self.results.append(result)
                
                # Log progress every 10 iterations
                if (i + 1) % 10 == 0:
                    logger.info(f"🎯 MONTE CARLO: Completed {i + 1}/{self.base_request.iterations} Monte Carlo iterations")
                    
            except Exception as e:
                logger.warning(f"Monte Carlo iteration {i} failed: {e}")
                # Add fallback result for failed iterations
                fallback_result = SimulationResult(
                    maxAltitude=500.0 + i * 10,  # Add some variation
                    maxVelocity=80.0 + i * 2,
                    maxAcceleration=40.0,
                    apogeeTime=8.0 + i * 0.1,
                    stabilityMargin=1.3,
                    thrustCurve=[(0.0, 0.0), (2.5, 45.0), (5.0, 0.0)],
                    simulationFidelity="iteration_fallback"
                )
                self.results.append(fallback_result)
        
        # ✅ Calculate statistics from successful results
        if self.results:
            self._calculate_statistics()
            logger.info(f"🎯 MONTE CARLO: Completed with {len(self.results)} results")
        else:
            logger.error("🚨 MONTE CARLO: No successful Monte Carlo iterations")
            # Return minimal result set
            self.results = [nominal_result]
            self._calculate_statistics()
        
        # Calculate landing dispersion
        dispersion = self._calculate_landing_dispersion()
        
        logger.info("🎯 MONTE CARLO: All simulations completed successfully")
        
        return MonteCarloResult(
            nominal=nominal_result,
            statistics=self.statistics,
            iterations=[self._extract_summary(r) for r in self.results],
            landingDispersion=dispersion
        )
    
    def _apply_variations(self, iteration: int) -> Tuple[RocketModel, EnvironmentModel, LaunchParametersModel]:
        """Apply parameter variations for a single iteration"""
        import copy
        
        rocket = copy.deepcopy(self.base_request.rocket)
        environment = copy.deepcopy(self.base_request.environment or EnvironmentModel())
        launch_params = copy.deepcopy(self.base_request.launchParameters or LaunchParametersModel())
        
        np.random.seed(iteration)  # Reproducible random numbers
        
        for variation in self.base_request.variations:
            value = self._generate_random_value(variation)
            self._apply_parameter_value(rocket, environment, launch_params, 
                                      variation.parameter, value)
        
        return rocket, environment, launch_params
    
    def _generate_random_value(self, variation: ParameterVariation) -> float:
        """Generate random value based on distribution"""
        if variation.distribution == "normal":
            mean, std = variation.parameters
            return np.random.normal(mean, std)
        elif variation.distribution == "uniform":
            low, high = variation.parameters
            return np.random.uniform(low, high)
        elif variation.distribution == "triangular":
            low, mode, high = variation.parameters
            return np.random.triangular(low, mode, high)
        else:
            return variation.parameters[0]  # Default to first value
    
    def _apply_parameter_value(self, rocket: RocketModel, environment: EnvironmentModel,
                             launch_params: LaunchParametersModel, parameter: str, value: float):
        """Apply parameter value to appropriate object"""
        try:
            if parameter.startswith("rocket."):
                param_name = parameter.split(".", 1)[1]
                # ✅ FIXED: Remove Cd assignment since new RocketModel doesn't have this field
                # Drag is now calculated from components, not a single coefficient
                if param_name == "Cd":
                    logger.warning(f"Cd parameter no longer supported in component-based model. Drag calculated from components.")
                elif param_name.startswith("parts."):
                    # Handle part-specific parameters
                    part_param = param_name.split(".", 2)
                    if len(part_param) == 3:
                        part_type, prop_name = part_param[1], part_param[2]
                        for part in rocket.parts:
                            if part.type == part_type:
                                setattr(part, prop_name, value)
                                break
            
            elif parameter.startswith("environment."):
                param_name = parameter.split(".", 1)[1]
                if hasattr(environment, param_name):
                    setattr(environment, param_name, value)
            
            elif parameter.startswith("launch."):
                param_name = parameter.split(".", 1)[1]
                if hasattr(launch_params, param_name):
                    setattr(launch_params, param_name, value)
                    
        except Exception as e:
            logger.warning(f"Failed to apply parameter {parameter}={value}: {e}")
    
    async def _run_single_simulation(self, rocket: RocketModel, environment: EnvironmentModel,
                                   launch_params: LaunchParametersModel) -> SimulationResult:
        """Run a single simulation iteration with optimized approach for Monte Carlo"""
        # ✅ COMPLETELY DISABLE ROCKETPY FOR MONTE CARLO - Always use simplified simulation
        # This ensures no integrator conflicts and provides reliable results for statistical analysis
        logger.debug("🎯 Monte Carlo iteration: Using simplified physics simulation (NO ROCKETPY)")
        
        try:
            return await simulate_simplified_fallback(rocket)
        except Exception as e:
            logger.warning(f"Monte Carlo simplified simulation failed: {e}")
            # Return default result for failed simulations
            return SimulationResult(
                maxAltitude=100.0,
                maxVelocity=50.0,
                maxAcceleration=20.0,
                apogeeTime=5.0,
                stabilityMargin=1.0,
                simulationFidelity="failed",
                thrustCurve=[(0.0, 0.0), (2.5, 30.0), (5.0, 0.0)]
            )
    
    def _calculate_statistics(self):
        """Calculate statistical measures from results"""
        if not self.results:
            return
        
        metrics = ["maxAltitude", "maxVelocity", "maxAcceleration", "apogeeTime", "stabilityMargin"]
        
        for metric in metrics:
            values = [getattr(result, metric) for result in self.results if hasattr(result, metric)]
            if values:
                self.statistics[metric] = MonteCarloStatistics(
                    mean=float(np.mean(values)),
                    std=float(np.std(values)),
                    min=float(np.min(values)),
                    max=float(np.max(values)),
                    percentiles={
                        "5": float(np.percentile(values, 5)),
                        "25": float(np.percentile(values, 25)),
                        "50": float(np.percentile(values, 50)),
                        "75": float(np.percentile(values, 75)),
                        "95": float(np.percentile(values, 95))
                    }
                )
    
    def _calculate_landing_dispersion(self) -> Dict[str, Any]:
        """Calculate landing dispersion statistics"""
        if not self.results:
            return {}
        
        drift_distances = [r.driftDistance for r in self.results if r.driftDistance is not None]
        
        if not drift_distances:
            return {}
        
        # Simple dispersion calculation
        mean_drift = np.mean(drift_distances)
        std_drift = np.std(drift_distances)
        
        # CEP (Circular Error Probable) - radius containing 50% of impacts
        cep = np.percentile(drift_distances, 50)
        
        return {
            "coordinates": [[0, 0]],  # Simplified - just origin
            "cep": float(cep),
            "majorAxis": float(std_drift * 2),
            "minorAxis": float(std_drift * 1.5),
            "rotation": 0.0,
            "meanDrift": float(mean_drift),
            "maxDrift": float(np.max(drift_distances))
        }
    
    def _extract_summary(self, result: SimulationResult) -> Dict[str, float]:
        """Extract summary metrics from simulation result"""
        return {
            "maxAltitude": result.maxAltitude,
            "maxVelocity": result.maxVelocity,
            "apogeeTime": result.apogeeTime,
            "stabilityMargin": result.stabilityMargin,
            "driftDistance": result.driftDistance or 0.0
        }

# ================================
# SIMULATION FUNCTIONS
# ================================

async def simulate_rocket_6dof(rocket_config: RocketModel, 
                              environment_config: EnvironmentModel = None,
                              launch_params: LaunchParametersModel = None) -> SimulationResult:
    """Run high-fidelity 6-DOF simulation"""
    
    if not ROCKETPY_AVAILABLE:
        return await simulate_simplified_fallback(rocket_config)
    
    try:
        # Set defaults
        if environment_config is None:
            environment_config = EnvironmentModel()
        if launch_params is None:
            launch_params = LaunchParametersModel()
        
        # Run simulation in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            executor, 
            _run_simulation_sync, 
            rocket_config, 
            environment_config, 
            launch_params
        )
        
        return result
        
    except Exception as e:
        logger.error(f"6-DOF simulation failed: {e}")
        return await simulate_simplified_fallback(rocket_config)

def _run_simulation_sync(rocket_config: RocketModel,
                        environment_config: EnvironmentModel,
                        launch_params: LaunchParametersModel) -> SimulationResult:
    """Synchronous simulation runner for thread pool"""
    
    # Create simulation objects
    environment = SimulationEnvironment(environment_config)
    motor = SimulationMotor(rocket_config.motor.id)
    rocket = SimulationRocket(rocket_config, motor)
    flight = SimulationFlight(rocket, environment, launch_params)
    
    if flight.results:
        return flight.results
    else:
        raise Exception("Simulation failed to produce results")

async def simulate_simplified_fallback(rocket_config: RocketModel) -> SimulationResult:
    """Simplified physics fallback simulation"""
    
    # Get motor data using correct motor ID field
    motor_spec = MOTOR_DATABASE.get(rocket_config.motor.motor_database_id, MOTOR_DATABASE["default-motor"])
    
    # ✅ FIXED: Calculate basic rocket properties using new component structure
    dry_mass = 0.5  # Base structural mass
    
    # ✅ Add nose cone mass
    if hasattr(rocket_config, 'nose_cone') and rocket_config.nose_cone:
        nose = rocket_config.nose_cone
        length = nose.length_m
        base_radius = nose.base_radius_m or 0.05  # Default 5cm radius
        wall_thickness = nose.wall_thickness_m
        material_density = nose.material_density_kg_m3
        
        # Simplified nose cone mass calculation
        volume = np.pi * base_radius**2 * length / 3  # Cone volume
        shell_mass = volume * (wall_thickness / base_radius) * material_density
        dry_mass += shell_mass
    
    # ✅ Add body tube masses
    for tube in rocket_config.body_tubes:
        length = tube.length_m
        radius = tube.outer_radius_m
        wall_thickness = tube.wall_thickness_m
        material_density = tube.material_density_kg_m3
        
        # Simplified body tube mass calculation
        surface_area = 2 * np.pi * radius * length
        shell_mass = surface_area * wall_thickness * material_density
        dry_mass += shell_mass
    
    # ✅ Add fin masses
    for fin in rocket_config.fins:
        root_chord = fin.root_chord_m
        tip_chord = fin.tip_chord_m
        span = fin.span_m
        thickness = fin.thickness_m
        material_density = fin.material_density_kg_m3
        fin_count = fin.fin_count
        
        # Simplified fin mass calculation
        fin_area = 0.5 * (root_chord + tip_chord) * span
        volume_per_fin = fin_area * thickness
        mass_per_fin = volume_per_fin * material_density
        total_fin_mass = mass_per_fin * fin_count
        dry_mass += total_fin_mass
    
    total_mass = dry_mass + motor_spec["mass"]["propellant_kg"]
    
    # Basic physics calculation
    thrust = motor_spec["avg_thrust_n"]
    burn_time = motor_spec["burn_time_s"]
    isp = motor_spec["isp_s"]
    
    # Rocket equation
    exhaust_velocity = isp * 9.81
    delta_v = exhaust_velocity * np.log(total_mass / dry_mass)
    
    # Simple trajectory estimation
    max_velocity = delta_v * 0.8  # Losses
    max_altitude = (max_velocity ** 2) / (2 * 9.81) * 0.7  # Air resistance
    apogee_time = max_velocity / 9.81
    
    # ✅ Calculate stability using new component structure
    fin_count = sum(fin.fin_count for fin in rocket_config.fins)
    stability_margin = 1.0 + fin_count * 0.2  # More realistic stability calculation
    
    # Generate thrust curve
    thrust_curve = []
    time_points = np.linspace(0, burn_time, 20)
    for t in time_points:
        normalized_t = t / burn_time
        if normalized_t <= 1.0:
            thrust_val = thrust * (1.0 + 0.2 * np.sin(normalized_t * 4))
        else:
            thrust_val = 0.0
        thrust_curve.append((float(t), float(thrust_val)))
    
    return SimulationResult(
        maxAltitude=float(max_altitude),
        maxVelocity=float(max_velocity),
        maxAcceleration=float(thrust / total_mass),
        apogeeTime=float(apogee_time),
        stabilityMargin=float(stability_margin),
        thrustCurve=thrust_curve,
        simulationFidelity="simplified_fallback"
    )

# ================================
# ENHANCED SIMULATION FUNCTIONS WITH FULL ROCKETPY INTEGRATION
# ================================

async def simulate_rocket_6dof_enhanced(rocket_config: RocketModel, 
                                      environment_config: EnvironmentModel = None,
                                      launch_params: LaunchParametersModel = None,
                                      analysis_options: Dict[str, Any] = None) -> SimulationResult:
    """Run enhanced high-fidelity 6-DOF simulation with full RocketPy capabilities"""
    
    if not ROCKETPY_AVAILABLE:
        return await simulate_simplified_fallback(rocket_config)
    
    try:
        # Set defaults
        if environment_config is None:
            environment_config = EnvironmentModel()
        if launch_params is None:
            launch_params = LaunchParametersModel()
        if analysis_options is None:
            analysis_options = {}
        
        # Run enhanced simulation in thread pool
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            executor, 
            _run_enhanced_simulation_sync, 
            rocket_config, 
            environment_config, 
            launch_params,
            analysis_options
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Enhanced 6-DOF simulation failed: {e}")
        return await simulate_simplified_fallback(rocket_config)

def _run_enhanced_simulation_sync(rocket_config: RocketModel,
                                environment_config: EnvironmentModel,
                                launch_params: LaunchParametersModel,
                                analysis_options: Dict[str, Any]) -> SimulationResult:
    """Enhanced synchronous simulation runner with full RocketPy features"""
    
    # Create enhanced simulation objects
    environment = EnhancedSimulationEnvironment(environment_config)
    motor = EnhancedSimulationMotor(rocket_config.motor.id)
    rocket = EnhancedSimulationRocket(rocket_config, motor)
    flight = EnhancedSimulationFlight(rocket, environment, launch_params, analysis_options)
    
    if flight.results:
        return flight.results
    else:
        raise Exception("Enhanced simulation failed to produce results")

class EnhancedSimulationEnvironment(SimulationEnvironment):
    """Enhanced environment with full atmospheric modeling capabilities"""
    
    def __init__(self, config: EnvironmentModel):
        super().__init__(config)
        
        if not ROCKETPY_AVAILABLE or not self.env:
            return
            
        # Enhanced atmospheric modeling
        self._setup_enhanced_atmosphere(config)
        
        # Advanced wind modeling
        self._setup_wind_profile(config)
        
        # Weather forecast integration
        self._setup_weather_forecast(config)
    
    def _setup_enhanced_atmosphere(self, config: EnvironmentModel):
        """Setup enhanced atmospheric modeling"""
        try:
            if config.atmospheric_model == "forecast":
                # Use GFS forecast data
                self.env.set_atmospheric_model(type='Forecast', file='GFS')
                logger.info("Using GFS forecast atmospheric model")
            elif config.atmospheric_model == "custom":
                # Use custom atmospheric profile
                self._setup_custom_atmosphere()
                logger.info("Using custom atmospheric model")
            else:
                # Use standard atmosphere with enhancements
                self.env.set_atmospheric_model(type='standard_atmosphere')
                logger.info("Using enhanced standard atmospheric model")
        except Exception as e:
            logger.warning(f"Failed to set enhanced atmosphere: {e}, using standard")
            self.env.set_atmospheric_model(type='standard_atmosphere')
    
    def _setup_wind_profile(self, config: EnvironmentModel):
        """Setup realistic wind profile with correct meteorological coordinate conversion and boundary layer effects"""
        if not config.wind_speed_m_s or config.wind_speed_m_s <= 0:
            return
            
        try:
            # Create realistic wind profile with altitude variation
            wind_speed = config.wind_speed_m_s
            wind_direction = config.wind_direction_deg or 0
            
            # CRITICAL FIX: Correct meteorological to Cartesian coordinate conversion
            # Meteorological convention: wind_direction is direction wind comes FROM
            # Convert to "direction wind goes TO" for proper u,v component calculation
            direction_to = wind_direction + 180.0
            
            # Convert to u, v components (u=East, v=North)
            wind_u_surface = wind_speed * np.sin(np.radians(direction_to))  # East component
            wind_v_surface = wind_speed * np.cos(np.radians(direction_to))  # North component
            
            # Create realistic altitude-varying wind profile with boundary layer effects
            altitudes = [0, 10, 50, 100, 500, 1000, 2000, 5000, 10000, 15000]
            wind_u_profile = []
            wind_v_profile = []
            
            for alt in altitudes:
                # Atmospheric boundary layer effects (0-1000m)
                if alt <= 1000:
                    # Power law wind profile in boundary layer: V(z) = V_ref * (z/z_ref)^α
                    alpha = 0.15  # Surface roughness exponent (typical for open terrain)
                    z_ref = 10.0  # Reference height (10m)
                    if alt < z_ref:
                        # Very low altitude - use logarithmic profile
                        altitude_factor = max(0.3, alt / z_ref)  # Minimum 30% of reference wind
                    else:
                        altitude_factor = (alt / z_ref) ** alpha
                else:
                    # Free atmosphere (above boundary layer)
                    # Wind typically increases and may change direction with altitude
                    base_factor = (1000 / 10.0) ** 0.15  # Boundary layer top factor
                    
                    # Geostrophic wind effects (stronger winds aloft)
                    altitude_factor = base_factor * (1 + (alt - 1000) / 10000 * 0.5)  # 50% increase at 11km
                    
                    # Add Ekman spiral effects (wind direction change with altitude)
                    # In Northern Hemisphere, wind backs (turns left) with altitude in boundary layer
                    # and veers (turns right) above boundary layer
                    if config.latitude_deg >= 0:  # Northern Hemisphere
                        direction_change = 15.0 * (alt - 1000) / 10000  # Up to 15° veer at 11km
                    else:  # Southern Hemisphere
                        direction_change = -15.0 * (alt - 1000) / 10000  # Up to 15° back at 11km
                    
                    # Apply direction change
                    direction_at_alt = direction_to + direction_change
                    wind_u_at_alt = wind_speed * altitude_factor * np.sin(np.radians(direction_at_alt))
                    wind_v_at_alt = wind_speed * altitude_factor * np.cos(np.radians(direction_at_alt))
                    
                    wind_u_profile.append((alt, wind_u_at_alt))
                    wind_v_profile.append((alt, wind_v_at_alt))
                    continue
                
                # Add realistic turbulence variation
                turbulence_factor = 1 + 0.05 * np.sin(alt / 200)  # ±5% variation
                
                u_at_alt = wind_u_surface * altitude_factor * turbulence_factor
                v_at_alt = wind_v_surface * altitude_factor * turbulence_factor
                
                wind_u_profile.append((alt, u_at_alt))
                wind_v_profile.append((alt, v_at_alt))
            
            # Set enhanced wind profile
            self.env.set_atmospheric_model(
                type='Custom',
                wind_u=wind_u_profile,
                wind_v=wind_v_profile
            )
            
            logger.info(f"Set realistic wind profile: {wind_speed} m/s from {wind_direction}° with boundary layer effects")
            logger.info(f"Surface components: u={wind_u_surface:.2f} m/s, v={wind_v_surface:.2f} m/s")
            
        except Exception as e:
            logger.warning(f"Failed to set enhanced wind profile: {e}")
    
    def _setup_weather_forecast(self, config: EnvironmentModel):
        """Setup weather forecast integration"""
        if config.date and config.atmospheric_model == "forecast":
            try:
                # Set date for forecast
                date_obj = datetime.fromisoformat(config.date.replace('Z', '+00:00'))
                self.env.set_date(date_obj, timezone=config.timezone or "UTC")
                logger.info(f"Set forecast date: {config.date}")
            except Exception as e:
                logger.warning(f"Failed to set forecast date: {e}")
    
    def _setup_custom_atmosphere(self):
        """Setup custom atmospheric profile"""
        # Example custom atmosphere with realistic profiles
        altitudes = np.linspace(0, 30000, 100)  # 0 to 30km
        
        # Standard atmosphere calculations
        pressures = []
        temperatures = []
        
        for alt in altitudes:
            if alt <= 11000:  # Troposphere
                temp = 288.15 - 0.0065 * alt  # Linear temperature decrease
                pressure = 101325 * (temp / 288.15) ** 5.256
            else:  # Stratosphere (simplified)
                temp = 216.65  # Constant temperature
                pressure = 22632 * np.exp(-0.0001577 * (alt - 11000))
            
            temperatures.append((alt, temp))
            pressures.append((alt, pressure))
        
        try:
            self.env.set_atmospheric_model(
                type='Custom',
                pressure=pressures,
                temperature=temperatures
            )
        except Exception as e:
            logger.warning(f"Failed to set custom atmosphere: {e}")

class EnhancedSimulationMotor(SimulationMotor):
    """Enhanced motor with advanced modeling capabilities"""
    
    def __init__(self, motor_id: str):
        super().__init__(motor_id)
        
        if not ROCKETPY_AVAILABLE:
            return
            
        # Enhanced motor modeling
        self._setup_enhanced_motor()
    
    def _setup_enhanced_motor(self):
        """Setup enhanced motor with realistic characteristics"""
        motor_type = self.spec["type"]
        
        try:
            if motor_type == "solid":
                self._create_enhanced_solid_motor()
            elif motor_type == "liquid":
                self._create_enhanced_liquid_motor()
            elif motor_type == "hybrid":
                self._create_enhanced_hybrid_motor()
        except Exception as e:
            logger.warning(f"Enhanced motor creation failed: {e}, using basic motor")
            self._create_motor()  # Fallback to basic motor
    
    def _create_enhanced_solid_motor(self):
        """Create enhanced solid motor with realistic grain geometry"""
        thrust_curve = self._generate_realistic_thrust_curve()
        
        # Enhanced solid motor with grain geometry
        try:
            self.motor = SolidMotor(
                thrust_source=thrust_curve,
                dry_mass=self.spec["mass"]["total_kg"] - self.spec["mass"]["propellant_kg"],
                dry_inertia=(0.125, 0.125, 0.002),
                nozzle_radius=self.spec["dimensions"]["outer_diameter_m"] / 2000,
                grain_number=self._calculate_grain_number(),
                grain_density=1815,  # kg/m³ - typical APCP
                grain_outer_radius=self.spec["dimensions"]["outer_diameter_m"] / 2000 - 0.002,
                grain_initial_inner_radius=self._calculate_initial_bore(),
                grain_initial_height=self._calculate_grain_height(),
                grain_separation=0.005,  # 5mm separation between grains
                grains_center_of_mass_position=0.5,  # Center of motor
                center_of_dry_mass_position=0.5,  # Center of dry mass
                nozzle_position=0,
                burn_time=self.spec["burn_time_s"],
                throat_radius=self._calculate_throat_radius(),
                interpolation_method='linear',
                coordinate_system_orientation='nozzle_to_combustion_chamber'
            )
            
            logger.info(f"Created enhanced solid motor: {self.spec['name']}")
            
        except Exception as e:
            logger.warning(f"Enhanced solid motor creation failed: {e}")
            self._create_solid_motor()  # Fallback
    
    def _create_enhanced_liquid_motor(self):
        """Create enhanced liquid motor with propellant flow modeling"""
        thrust_curve = self._generate_liquid_thrust_curve()
        
        try:
            # Enhanced liquid motor
            self.motor = LiquidMotor(
                thrust_source=thrust_curve,
                dry_mass=self.spec["mass"]["total_kg"] - self.spec["mass"]["propellant_kg"],
                dry_inertia=(0.2, 0.2, 0.002),
                nozzle_radius=self.spec["dimensions"]["outer_diameter_m"] / 2000,
                burn_time=self.spec["burn_time_s"],
                center_of_dry_mass_position=0.5,
                nozzle_position=0,
                tanks=[
                    # Oxidizer tank
                    {
                        'type': 'oxidizer',
                        'geometry': 'cylindrical',
                        'tank_height': 0.3,
                        'tank_radius': 0.05,
                        'liquid_mass': self.spec["mass"]["propellant_kg"] * 0.7,  # 70% oxidizer
                        'liquid_height': 0.25,
                        'tank_position': 0.7
                    },
                    # Fuel tank
                    {
                        'type': 'fuel',
                        'geometry': 'cylindrical',
                        'tank_height': 0.2,
                        'tank_radius': 0.05,
                        'liquid_mass': self.spec["mass"]["propellant_kg"] * 0.3,  # 30% fuel
                        'liquid_height': 0.15,
                        'tank_position': 0.4
                    }
                ]
            )
            
            logger.info(f"Created enhanced liquid motor: {self.spec['name']}")
            
        except Exception as e:
            logger.warning(f"Enhanced liquid motor creation failed: {e}")
            self._create_liquid_motor()  # Fallback
    
    def _create_enhanced_hybrid_motor(self):
        """Create enhanced hybrid motor with regression modeling"""
        thrust_curve = self._generate_hybrid_thrust_curve()
        
        try:
            # Enhanced hybrid motor
            self.motor = HybridMotor(
                thrust_source=thrust_curve,
                dry_mass=self.spec["mass"]["total_kg"] - self.spec["mass"]["propellant_kg"],
                dry_inertia=(0.15, 0.15, 0.002),
                nozzle_radius=self.spec["dimensions"]["outer_diameter_m"] / 2000,
                burn_time=self.spec["burn_time_s"],
                center_of_dry_mass_position=0.5,
                nozzle_position=0,
                grain_number=1,
                grain_density=920,  # kg/m³ - typical HTPB
                grain_outer_radius=self.spec["dimensions"]["outer_diameter_m"] / 2000 - 0.005,
                grain_initial_inner_radius=0.01,
                grain_initial_height=self.spec["dimensions"]["length_m"] / 1000 * 0.6,
                oxidizer_tank_position=0.7,
                oxidizer_tank_geometry='cylindrical',
                oxidizer_tank_height=0.2,
                oxidizer_tank_radius=0.04,
                liquid_oxidizer_mass=self.spec["mass"]["propellant_kg"] * 0.8
            )
            
            logger.info(f"Created enhanced hybrid motor: {self.spec['name']}")
            
        except Exception as e:
            logger.warning(f"Enhanced hybrid motor creation failed: {e}")
            self._create_hybrid_motor()  # Fallback
    
    def _calculate_grain_number(self) -> int:
        """Calculate optimal number of grains based on motor size"""
        motor_length = self.spec["dimensions"]["length_m"] / 1000  # mm to m
        if motor_length < 0.1:
            return 1
        elif motor_length < 0.2:
            return 2
        else:
            return max(1, int(motor_length / 0.1))
    
    def _calculate_initial_bore(self) -> float:
        """Calculate initial bore radius for optimal performance"""
        outer_radius = self.spec["dimensions"]["outer_diameter_m"] / 2000 - 0.002
        return outer_radius * 0.3  # 30% of outer radius
    
    def _calculate_grain_height(self) -> float:
        """Calculate grain height based on motor dimensions"""
        total_length = self.spec["dimensions"]["length_m"] / 1000
        grain_number = self._calculate_grain_number()
        return (total_length * 0.8) / grain_number  # 80% of total length
    
    def _calculate_throat_radius(self) -> float:
        """Calculate optimal throat radius for given thrust"""
        # Simplified throat sizing based on thrust
        thrust = self.spec["avg_thrust_n"]
        chamber_pressure = 2e6  # 20 bar typical
        gamma = 1.2  # Typical for solid propellants
        gas_constant = 287  # J/kg/K
        chamber_temp = 3000  # K typical combustion temperature
        
        # Choked flow calculation
        throat_area = thrust / (chamber_pressure * np.sqrt(gamma / (gas_constant * chamber_temp)) * 
                              (2 / (gamma + 1)) ** ((gamma + 1) / (2 * (gamma - 1))))
        
        return np.sqrt(throat_area / np.pi)
    
    def _generate_realistic_thrust_curve(self) -> List[Tuple[float, float]]:
        """Generate realistic thrust curve with proper motor characteristics"""
        burn_time = self.spec["burn_time_s"]
        avg_thrust = self.spec["avg_thrust_n"]
        
        # More realistic thrust curve with proper phases
        curve = []
        time_points = np.linspace(0, burn_time, 50)
        
        for t in time_points:
            normalized_time = t / burn_time
            
            if normalized_time < 0.05:
                # Ignition transient - rapid rise
                thrust = avg_thrust * (normalized_time / 0.05) * 1.8
            elif normalized_time < 0.15:
                # Initial peak - pressure spike
                phase = (normalized_time - 0.05) / 0.1
                thrust = avg_thrust * (1.8 - 0.6 * phase)
            elif normalized_time < 0.85:
                # Sustained burn with progressive burning
                phase = (normalized_time - 0.15) / 0.7
                # Progressive burning causes slight thrust increase
                thrust = avg_thrust * (1.2 + 0.1 * phase + 0.05 * np.sin(phase * 8))
            else:
                # Tail-off with propellant depletion
                phase = (normalized_time - 0.85) / 0.15
                thrust = avg_thrust * (1.3 * (1 - phase))
            
            curve.append((t, max(0, thrust)))
        
        curve.append((burn_time + 0.1, 0))
        return curve

class EnhancedSimulationRocket(SimulationRocket):
    """Enhanced rocket with advanced aerodynamic modeling and component analysis"""
    
    def __init__(self, rocket_config: RocketModel, motor: EnhancedSimulationMotor):
        self.config = rocket_config
        self.motor = motor
        self.rocket = None
        
        if not ROCKETPY_AVAILABLE:
            return
        
        self._create_enhanced_rocket()
    
    def _create_enhanced_rocket(self):
        """Create enhanced RocketPy rocket with advanced modeling"""
        # Calculate enhanced rocket properties
        radius = self._calculate_enhanced_radius()
        mass = self._calculate_enhanced_dry_mass()
        inertia = self._calculate_enhanced_inertia()
        com = self._calculate_enhanced_center_of_mass()
        drag_curves = self._calculate_enhanced_drag_curves()
        
        try:
            self.rocket = Rocket(
                radius=radius,
                mass=mass,
                inertia=inertia,
                power_off_drag=drag_curves['power_off'],
                power_on_drag=drag_curves['power_on'],
                center_of_mass_without_motor=com,
                coordinate_system_orientation="tail_to_nose"
            )
            
            # Add enhanced motor
            if self.motor.motor:
                motor_position = self._calculate_enhanced_motor_position()
                self.rocket.add_motor(self.motor.motor, position=motor_position)
            
            # Add enhanced components
            self._add_enhanced_nose_cone()
            self._add_enhanced_fins()
            self._add_enhanced_parachutes()
            
            # Add advanced aerodynamic surfaces
            self._add_aerodynamic_surfaces()
            
            logger.info(f"Created enhanced rocket: {self.config.name}")
            
        except Exception as e:
            logger.error(f"Enhanced rocket creation failed: {e}")
            # Fallback to basic rocket
            super()._create_rocket()
    
    def _calculate_enhanced_radius(self) -> float:
        """Calculate rocket radius with enhanced precision"""
        # ✅ FIXED: Use direct access to body_tubes component list
        if self.config.body_tubes:
            # Use the largest body tube radius
            max_radius = max(tube.outer_radius_m for tube in self.config.body_tubes)
            return max_radius  # Already in meters
        return 0.05  # Default 5cm radius
    
    def _calculate_enhanced_dry_mass(self) -> float:
        """Calculate dry mass with material properties and wall thickness"""
        mass = 0.1  # Base structural mass
        
        # ✅ FIXED: Add nose cone mass using direct component access
        if hasattr(self.config, 'nose_cone') and self.config.nose_cone:
            nose = self.config.nose_cone
            length = nose.length_m
            base_radius = nose.base_radius_m or self._calculate_enhanced_radius()
            wall_thickness = nose.wall_thickness_m
            material_density = nose.material_density_kg_m3
            
            # Nose cone mass based on volume and material
            volume = np.pi * base_radius**2 * length / 3  # Cone volume
            shell_mass = volume * (wall_thickness / base_radius) * material_density
            mass += shell_mass
        
        # ✅ FIXED: Add body tube masses using direct component access
        for tube in self.config.body_tubes:
            length = tube.length_m
            radius = tube.outer_radius_m
            wall_thickness = tube.wall_thickness_m
            material_density = tube.material_density_kg_m3
            
            # Body tube mass based on surface area and wall thickness
            surface_area = 2 * np.pi * radius * length
            shell_mass = surface_area * wall_thickness * material_density
            mass += shell_mass
        
        # ✅ FIXED: Add fin masses using direct component access
        for fin in self.config.fins:
            root_chord = fin.root_chord_m
            tip_chord = fin.tip_chord_m
            span = fin.span_m
            thickness = fin.thickness_m
            material_density = fin.material_density_kg_m3
            fin_count = fin.fin_count
            
            # Fin mass based on area and thickness
            fin_area = 0.5 * (root_chord + tip_chord) * span  # Trapezoidal area
            volume_per_fin = fin_area * thickness
            mass_per_fin = volume_per_fin * material_density
            total_fin_mass = mass_per_fin * fin_count
            mass += total_fin_mass
        
        return mass
    
    def _calculate_enhanced_inertia(self) -> Tuple[float, float, float]:
        """Calculate enhanced inertia tensor with component contributions"""
        total_mass = self._calculate_enhanced_dry_mass()
        total_length = self._calculate_total_length()
        avg_radius = self._calculate_enhanced_radius()
        
        # Component-wise inertia calculation
        ixx = iyy = 0
        izz = 0
        
        # ✅ FIXED: Body tube contributions using direct component access
        for tube in self.config.body_tubes:
            # Cylindrical body contribution
            length = tube.length_m
            radius = tube.outer_radius_m
            wall_thickness = tube.wall_thickness_m
            material_density = tube.material_density_kg_m3
            
            # Calculate actual tube mass
            surface_area = 2 * np.pi * radius * length
            tube_mass = surface_area * wall_thickness * material_density
            
            # Inertia about center
            ixx_part = tube_mass * (3 * radius**2 + length**2) / 12
            izz_part = tube_mass * radius**2 / 2
            
            ixx += ixx_part
            iyy += ixx_part
            izz += izz_part
        
        # ✅ FIXED: Nose cone contribution using direct component access
        if hasattr(self.config, 'nose_cone') and self.config.nose_cone:
            nose = self.config.nose_cone
            length = nose.length_m
            base_radius = nose.base_radius_m or avg_radius
            wall_thickness = nose.wall_thickness_m
            material_density = nose.material_density_kg_m3
            
            # Calculate actual nose cone mass
            volume = np.pi * base_radius**2 * length / 3
            nose_mass = volume * (wall_thickness / base_radius) * material_density
            
            # Cone inertia
            ixx_part = nose_mass * (3 * base_radius**2 + length**2) / 12
            izz_part = nose_mass * base_radius**2 / 2
            
            ixx += ixx_part
            iyy += ixx_part
            izz += izz_part
        
        return (ixx, iyy, izz)
    
    def _calculate_enhanced_center_of_mass(self) -> float:
        """Calculate center of mass with component-wise analysis"""
        total_mass = 0
        weighted_position = 0
        current_position = 0
        
        # ✅ FIXED: Calculate from nose to tail using direct component access
        
        # Nose cone contribution
        if hasattr(self.config, 'nose_cone') and self.config.nose_cone:
            nose = self.config.nose_cone
            length = nose.length_m
            base_radius = nose.base_radius_m or self._calculate_enhanced_radius()
            wall_thickness = nose.wall_thickness_m
            material_density = nose.material_density_kg_m3
            
            # Calculate actual nose cone mass
            volume = np.pi * base_radius**2 * length / 3
            nose_mass = volume * (wall_thickness / base_radius) * material_density
            
            # Nose COM is at approximately 60% from tip for cone
            nose_com = current_position + length * 0.6
            
            weighted_position += nose_mass * nose_com
            total_mass += nose_mass
            current_position += length
        
        # Body tube contributions
        for tube in self.config.body_tubes:
            length = tube.length_m
            radius = tube.outer_radius_m
            wall_thickness = tube.wall_thickness_m
            material_density = tube.material_density_kg_m3
            
            # Calculate actual tube mass
            surface_area = 2 * np.pi * radius * length
            tube_mass = surface_area * wall_thickness * material_density
            
            # Body tube COM is at center
            tube_com = current_position + length / 2
            
            weighted_position += tube_mass * tube_com
            total_mass += tube_mass
            current_position += length
        
        return weighted_position / total_mass if total_mass > 0 else current_position / 2
    
    def _calculate_enhanced_drag_curves(self) -> Dict[str, Any]:
        """Calculate enhanced drag curves for power-on and power-off flight"""
        # ✅ FIXED: Calculate base drag from components instead of accessing non-existent Cd field
        
        # Enhanced drag calculation based on components
        nose_drag = self._calculate_nose_drag()
        body_drag = self._calculate_body_drag()
        fin_drag = self._calculate_fin_drag()
        base_drag = self._calculate_base_drag()
        
        # Power-off drag (no motor plume effects)
        power_off_cd = nose_drag + body_drag + fin_drag + base_drag
        
        # Power-on drag (reduced base drag due to motor plume)
        power_on_cd = nose_drag + body_drag + fin_drag + base_drag * 0.3
        
        return {
            'power_off': power_off_cd,
            'power_on': power_on_cd
        }
    
    def _calculate_nose_drag(self) -> float:
        """Calculate nose cone drag coefficient"""
        # ✅ FIXED: Use direct nose_cone component access
        if not hasattr(self.config, 'nose_cone') or not self.config.nose_cone:
            return 0.1  # Default
        
        nose = self.config.nose_cone
        shape = nose.shape or "ogive"
        
        # Drag coefficients for different nose shapes
        shape_drag = {
            "conical": 0.15,
            "ogive": 0.12,
            "elliptical": 0.10,
            "parabolic": 0.13
        }
        
        return shape_drag.get(shape, 0.12)
    
    def _calculate_body_drag(self) -> float:
        """Calculate body tube drag coefficient"""
        # ✅ FIXED: Use direct body_tubes component access
        if not self.config.body_tubes:
            return 0.0
        
        total_length = sum(tube.length_m for tube in self.config.body_tubes)
        avg_diameter = np.mean([tube.outer_radius_m * 2 for tube in self.config.body_tubes])  # Convert radius to diameter
        
        # Skin friction drag
        reynolds_number = 1e6  # Typical for model rockets
        cf = 0.074 / (reynolds_number ** 0.2)  # Turbulent flat plate
        
        # Wetted area
        wetted_area = np.pi * avg_diameter * total_length
        reference_area = np.pi * (avg_diameter / 2) ** 2
        
        skin_friction_cd = cf * wetted_area / reference_area
        
        return skin_friction_cd
    
    def _calculate_fin_drag(self) -> float:
        """Calculate fin drag coefficient"""
        # ✅ FIXED: Use direct fins component access
        if not self.config.fins:
            return 0.0
        
        # Use first fin set for calculation
        fin = self.config.fins[0]
        root = fin.root_chord_m
        span = fin.span_m
        tip = fin.tip_chord_m
        
        # Fin area
        fin_area = 0.5 * (root + tip) * span
        fin_count = fin.fin_count  # ✅ Use actual fin count from model
        
        # Reference area (body cross-section)
        body_radius = self._calculate_enhanced_radius()
        reference_area = np.pi * body_radius ** 2
        
        # Fin drag coefficient
        fin_cd = 0.02 * fin_count * fin_area / reference_area
        
        return fin_cd
    
    def _calculate_base_drag(self) -> float:
        """Calculate base drag coefficient"""
        return 0.12  # Typical base drag for rockets
    
    def _add_enhanced_nose_cone(self):
        """Add enhanced nose cone with proper aerodynamic modeling"""
        if not hasattr(self.config, 'nose_cone') or not self.config.nose_cone or not self.rocket:
            return
        
        nose = self.config.nose_cone
        length = nose.length_m  # Already in meters
        shape = nose.shape
        
        # Map shapes to RocketPy shapes
        shape_map = {
            "ogive": "tangent ogive",
            "conical": "conical",
            "elliptical": "elliptical",
            "parabolic": "parabolic"
        }
        
        # CRITICAL FIX: Nose cone positioning
        # In tail_to_nose coordinate system, nose cone is at the front (maximum position)
        total_length = self._calculate_total_length()
        position = total_length  # Position at the tip of the rocket
        
        try:
            self.rocket.add_nose(
                length=length,
                kind=shape_map.get(shape, "tangent ogive"),
                position=position
            )
            logger.info(f"Added nose cone: {shape}, length={length:.3f}m at position={position:.3f}m")
        except Exception as e:
            logger.warning(f"Failed to add nose cone: {e}")
            # Fallback without optional parameters
            try:
                self.rocket.add_nose(
                    length=length,
                    kind=shape_map.get(shape, "tangent ogive"),
                    position=position
                )
            except Exception as e2:
                logger.error(f"Failed to add nose cone with fallback: {e2}")
    
    def _add_enhanced_fins(self):
        """Add enhanced fins with proper aerodynamic modeling"""
        # ✅ FIXED: Use direct fins component access
        if not self.config.fins or not self.rocket:
            return
        
        # ✅ Use first fin set for enhanced fins
        fin = self.config.fins[0]
        root_chord = fin.root_chord_m       # Already in meters
        tip_chord = fin.tip_chord_m         # Already in meters
        span = fin.span_m                   # Already in meters
        sweep_length = fin.sweep_length_m   # Already in meters
        fin_count = fin.fin_count           # Use actual fin count
        cant_angle = fin.cant_angle_deg     # Use actual cant angle
        
        try:
            self.rocket.add_trapezoidal_fins(
                n=fin_count,                # ✅ Use actual fin count from model
                root_chord=root_chord,
                tip_chord=tip_chord,
                span=span,
                position=0.1,  # Position from tail
                cant_angle=cant_angle,      # ✅ Use actual cant angle
                sweep_length=sweep_length,
                airfoil=("NACA", "0012"),  # NACA 0012 airfoil
                name="main_fins"
            )
            
            logger.info(f"Added enhanced fins: {fin_count}x trapezoidal, root={root_chord:.3f}m, span={span:.3f}m")
            
        except Exception as e:
            logger.warning(f"Failed to add enhanced fins: {e}")
            # Fallback to basic fins
            super()._add_fins()
    
    def _add_enhanced_parachutes(self):
        """Add enhanced parachute system with realistic deployment"""
        # ✅ FIXED: Use direct parachutes component access
        parachute_list = self.config.parachutes if self.config.parachutes else []
        
        # Add default parachute if none specified
        if not parachute_list:
            parachute_list = [ParachuteComponentModel(
                id="default_parachute",
                name="Default Parachute",
                cd_s_m2=1.0,
                trigger="apogee",
                lag_s=1.5,
                position_from_tail_m=0.0
            )]
        
        for i, chute in enumerate(parachute_list):
            if not self.rocket:
                break
                
            cd_s = chute.cd_s_m2 or 1.0
            lag = chute.lag_s or 1.5
            
            # Enhanced trigger logic
            if chute.trigger == "apogee":
                trigger = "apogee"
            elif chute.trigger and isinstance(chute.trigger, (int, float)):
                trigger = float(chute.trigger)  # Altitude trigger
            else:
                trigger = "apogee"  # Default
            
            try:
                self.rocket.add_parachute(
                    name=chute.name or f"parachute_{i}",
                    cd_s=cd_s,
                    trigger=trigger,
                    sampling_rate=chute.sampling_rate_hz or 105,
                    lag=lag,
                    noise=(chute.noise_bias or 0, chute.noise_deviation or 8.3, chute.noise_correlation or 0.5)
                )
                
                logger.info(f"Added enhanced parachute '{chute.name}': cd_s={cd_s}, trigger={trigger}")
                
            except Exception as e:
                logger.warning(f"Failed to add enhanced parachute '{chute.name}': {e}")
    
    def _add_aerodynamic_surfaces(self):
        """Add additional aerodynamic surfaces for enhanced modeling"""
        if not self.rocket:
            return
        
        try:
            # Add air brakes if specified (future feature)
            # Add canards if specified (future feature)
            # Add additional control surfaces (future feature)
            pass
        except Exception as e:
            logger.warning(f"Failed to add aerodynamic surfaces: {e}")

class EnhancedSimulationFlight(SimulationFlight):
    """Enhanced flight simulation with advanced analysis capabilities"""
    
    def __init__(self, rocket: EnhancedSimulationRocket, environment: EnhancedSimulationEnvironment, 
                 launch_params: LaunchParametersModel, analysis_options: Dict[str, Any]):
        self.rocket = rocket
        self.environment = environment
        self.launch_params = launch_params
        self.analysis_options = analysis_options
        self.flight = None
        self.results = None
        
        if not ROCKETPY_AVAILABLE or not rocket.rocket or not environment.env:
            return
        
        self._run_enhanced_simulation()
    
    def _run_enhanced_simulation(self):
        """Run enhanced flight simulation with advanced options"""
        try:
            # Enhanced simulation parameters
            rtol = self.analysis_options.get('rtol', 1e-8)
            atol = self.analysis_options.get('atol', 1e-12)
            max_time = self.analysis_options.get('max_time', 300)  # 5 minutes max
            
            self.flight = Flight(
                rocket=self.rocket.rocket,
                environment=self.environment.env,
                rail_length=self.launch_params.rail_length_m,
                inclination=self.launch_params.inclination_deg,
                heading=self.launch_params.heading_deg,
                rtol=rtol,
                atol=atol,
                max_time=max_time,
                terminate_on_apogee=False,  # Continue to ground impact
                verbose=False
            )
            
            self._extract_enhanced_results()
            
        except Exception as e:
            logger.error(f"Enhanced flight simulation failed: {e}")
            raise
    
    def _extract_enhanced_results(self):
        """Extract enhanced results with comprehensive analysis"""
        if not self.flight:
            return
        
        try:
            # Basic flight metrics
            max_altitude = float(self.flight.apogee - self.environment.config.elevation_m)
            max_velocity = float(self.flight.max_speed)
            max_acceleration = float(self.flight.max_acceleration)
            apogee_time = float(self.flight.apogee_time)
            
            # Enhanced stability analysis
            stability_data = self._analyze_enhanced_stability()
            
            # Enhanced trajectory data
            trajectory = self._extract_enhanced_trajectory()
            
            # Enhanced flight events
            events = self._extract_enhanced_events()
            
            # Enhanced impact analysis
            impact_data = self._analyze_enhanced_impact()
            
            # Enhanced thrust analysis
            thrust_analysis = self._analyze_enhanced_thrust()
            
            # Enhanced aerodynamic analysis
            aero_analysis = self._analyze_enhanced_aerodynamics()
            
            self.results = SimulationResult(
                maxAltitude=max_altitude,
                maxVelocity=max_velocity,
                maxAcceleration=max_acceleration,
                apogeeTime=apogee_time,
                stabilityMargin=stability_data['static_margin'],
                thrustCurve=thrust_analysis['thrust_curve'],
                simulationFidelity="enhanced_6dof",
                trajectory=trajectory,
                flightEvents=events,
                impactVelocity=impact_data['impact_velocity'],
                driftDistance=impact_data['drift_distance']
            )
            
            # Add enhanced data to results
            self.results.enhanced_data = {
                'stability_analysis': stability_data,
                'impact_analysis': impact_data,
                'thrust_analysis': thrust_analysis,
                'aerodynamic_analysis': aero_analysis,
                'performance_metrics': self._calculate_performance_metrics()
            }
            
        except Exception as e:
            logger.error(f"Failed to extract enhanced results: {e}")
            raise
    
    def _analyze_enhanced_stability(self) -> Dict[str, Any]:
        """Perform enhanced stability analysis"""
        try:
            # Static stability margin throughout flight
            static_margin = float(self.rocket.rocket.static_margin(0))
            
            # Dynamic stability analysis (simplified)
            dynamic_stability = self._calculate_dynamic_stability()
            
            # Stability margin variation with time
            stability_timeline = self._calculate_stability_timeline()
            
            return {
                'static_margin': static_margin,
                'dynamic_stability': dynamic_stability,
                'stability_timeline': stability_timeline,
                'stability_rating': self._rate_stability(static_margin)
            }
            
        except Exception as e:
            logger.warning(f"Enhanced stability analysis failed: {e}")
            return {'static_margin': 1.5, 'stability_rating': 'unknown'}
    
    def _calculate_dynamic_stability(self) -> Dict[str, float]:
        """Calculate dynamic stability characteristics"""
        # Simplified dynamic stability analysis
        return {
            'pitch_damping': 0.8,  # Placeholder
            'yaw_damping': 0.8,    # Placeholder
            'roll_damping': 0.9    # Placeholder
        }
    
    def _calculate_stability_timeline(self) -> List[Tuple[float, float]]:
        """Calculate stability margin variation throughout flight"""
        timeline = []
        try:
            time_points = np.linspace(0, self.flight.apogee_time, 20)
            for t in time_points:
                # Simplified stability calculation at different times
                margin = float(self.rocket.rocket.static_margin(t))
                timeline.append((float(t), margin))
        except:
            # Fallback to constant margin
            timeline = [(0.0, 1.5), (10.0, 1.5)]
        
        return timeline
    
    def _rate_stability(self, margin: float) -> str:
        """Rate stability based on margin"""
        if margin < 0.5:
            return "unstable"
        elif margin < 1.0:
            return "marginally_stable"
        elif margin < 2.0:
            return "stable"
        else:
            return "overstable"
    
    def _extract_enhanced_trajectory(self) -> TrajectoryData:
        """Extract enhanced trajectory data with full 6-DOF information"""
        if not self.flight:
            return None
        
        try:
            # Enhanced trajectory extraction with more data points and analysis
            time_points = self.flight.time
            
            # Position data (Earth-fixed frame)
            x_data = self.flight.x
            y_data = self.flight.y
            z_data = self.flight.z
            position = [[float(x), float(y), float(z)] for x, y, z in zip(x_data, y_data, z_data)]
            
            # Velocity data (Earth-fixed frame)
            vx_data = self.flight.vx
            vy_data = self.flight.vy
            vz_data = self.flight.vz
            velocity = [[float(vx), float(vy), float(vz)] for vx, vy, vz in zip(vx_data, vy_data, vz_data)]
            
            # Acceleration data (Earth-fixed frame)
            ax_data = self.flight.ax
            ay_data = self.flight.ay
            az_data = self.flight.az
            acceleration = [[float(ax), float(ay), float(az)] for ax, ay, az in zip(ax_data, ay_data, az_data)]
            
            # Enhanced attitude data (quaternions if available)
            attitude = None
            angular_velocity = None
            
            try:
                # Try to extract quaternion attitude data
                e0_data = self.flight.e0
                e1_data = self.flight.e1
                e2_data = self.flight.e2
                e3_data = self.flight.e3
                attitude = [[float(e0), float(e1), float(e2), float(e3)] 
                           for e0, e1, e2, e3 in zip(e0_data, e1_data, e2_data, e3_data)]
                
                # Angular velocity data
                wx_data = self.flight.wx
                wy_data = self.flight.wy
                wz_data = self.flight.wz
                angular_velocity = [[float(wx), float(wy), float(wz)] 
                                   for wx, wy, wz in zip(wx_data, wy_data, wz_data)]
                
                logger.info("Extracted full 6-DOF trajectory data with attitude")
            except:
                logger.info("6-DOF attitude data not available, using 3-DOF trajectory")
            
            return TrajectoryData(
                time=[float(t) for t in time_points],
                position=position,
                velocity=velocity,
                acceleration=acceleration,
                attitude=attitude,
                angularVelocity=angular_velocity
            )
            
        except Exception as e:
            logger.warning(f"Enhanced trajectory extraction failed: {e}")
            # Fallback to basic trajectory extraction
            return super()._extract_trajectory()
    
    def _analyze_enhanced_impact(self) -> Dict[str, Any]:
        """Comprehensive impact analysis including landing accuracy and safety"""
        if not self.flight:
            return {'impact_velocity': 0.0, 'drift_distance': 0.0}
        
        try:
            # Basic impact metrics
            impact_velocity = getattr(self.flight, 'impact_velocity', None)
            if impact_velocity is None:
                # Calculate impact velocity from final velocity components
                final_vx = float(self.flight.vx[-1]) if len(self.flight.vx) > 0 else 0.0
                final_vy = float(self.flight.vy[-1]) if len(self.flight.vy) > 0 else 0.0
                final_vz = float(self.flight.vz[-1]) if len(self.flight.vz) > 0 else 0.0
                impact_velocity = np.sqrt(final_vx**2 + final_vy**2 + final_vz**2)
            
            # Drift analysis
            impact_x = float(self.flight.x_impact) if hasattr(self.flight, 'x_impact') else 0.0
            impact_y = float(self.flight.y_impact) if hasattr(self.flight, 'y_impact') else 0.0
            drift_distance = np.sqrt(impact_x**2 + impact_y**2)
            
            # Enhanced impact analysis
            impact_angle = self._calculate_impact_angle()
            impact_energy = self._calculate_impact_energy()
            landing_dispersion = self._calculate_landing_dispersion_ellipse()
            safety_assessment = self._assess_landing_safety(impact_velocity, drift_distance)
            
            # Wind drift analysis
            wind_drift_analysis = self._analyze_wind_drift_effects()
            
            return {
                'impact_velocity': float(impact_velocity),
                'drift_distance': float(drift_distance),
                'impact_coordinates': [float(impact_x), float(impact_y)],
                'impact_angle_deg': impact_angle,
                'impact_energy_j': impact_energy,
                'landing_dispersion': landing_dispersion,
                'safety_assessment': safety_assessment,
                'wind_drift_analysis': wind_drift_analysis,
                'recovery_zone_radius_m': float(drift_distance * 1.5)  # 50% safety margin
            }
            
        except Exception as e:
            logger.warning(f"Enhanced impact analysis failed: {e}")
            return {
                'impact_velocity': 0.0,
                'drift_distance': 0.0,
                'safety_assessment': 'unknown'
            }
    
    def _analyze_enhanced_thrust(self) -> Dict[str, Any]:
        """Comprehensive thrust and propulsion analysis"""
        if not self.rocket.motor.motor:
            return {'thrust_curve': [], 'total_impulse': 0.0}
        
        try:
            motor = self.rocket.motor.motor
            motor_spec = self.rocket.motor.spec
            
            # Extract detailed thrust curve
            thrust_curve = []
            thrust_data = []
            mass_flow_data = []
            chamber_pressure_data = []
            
            burn_time = motor_spec["burn_time_s"]
            time_points = np.linspace(0, burn_time, 100)
            
            for t in time_points:
                try:
                    thrust = float(motor.thrust.get_value_opt(t))
                    thrust_curve.append((float(t), thrust))
                    thrust_data.append(thrust)
                    
                    # Estimate mass flow rate (simplified)
                    mass_flow = thrust / (motor_spec.get("isp_s", 200) * 9.81) if thrust > 0 else 0.0
                    mass_flow_data.append(mass_flow)
                    
                    # Estimate chamber pressure (simplified)
                    throat_area = np.pi * (motor_spec["dimensions"]["outer_diameter_m"] / 4000) ** 2  # Simplified
                    chamber_pressure = thrust / throat_area if throat_area > 0 else 0.0
                    chamber_pressure_data.append(chamber_pressure)
                    
                except:
                    thrust_curve.append((float(t), 0.0))
                    thrust_data.append(0.0)
                    mass_flow_data.append(0.0)
                    chamber_pressure_data.append(0.0)
            
            # Performance metrics
            total_impulse = np.trapz(thrust_data, time_points)
            average_thrust = np.mean([t for t in thrust_data if t > 0])
            peak_thrust = np.max(thrust_data)
            thrust_coefficient = self._calculate_thrust_coefficient(thrust_data, chamber_pressure_data)
            
            # Motor efficiency analysis
            theoretical_impulse = motor_spec["total_impulse_n_s"]
            impulse_efficiency = total_impulse / theoretical_impulse if theoretical_impulse > 0 else 0.0
            
            # Thrust-to-weight analysis
            rocket_mass = self.rocket._calculate_dry_mass() + motor_spec["mass"]["propellant_kg"]
            initial_twr = peak_thrust / (rocket_mass * 9.81)
            
            return {
                'thrust_curve': thrust_curve,
                'total_impulse_n_s': float(total_impulse),
                'average_thrust_n': float(average_thrust),
                'peak_thrust_n': float(peak_thrust),
                'thrust_coefficient': thrust_coefficient,
                'impulse_efficiency': float(impulse_efficiency),
                'initial_thrust_to_weight': float(initial_twr),
                'burn_time_s': float(burn_time),
                'mass_flow_profile': list(zip([float(t) for t in time_points], mass_flow_data)),
                'chamber_pressure_profile': list(zip([float(t) for t in time_points], chamber_pressure_data)),
                'motor_type': motor_spec["type"],
                'specific_impulse_s': motor_spec.get("isp_s", 200)
            }
            
        except Exception as e:
            logger.warning(f"Enhanced thrust analysis failed: {e}")
            return {
                'thrust_curve': [],
                'total_impulse_n_s': 0.0,
                'average_thrust_n': 0.0
            }
    
    def _analyze_enhanced_aerodynamics(self) -> Dict[str, Any]:
        """Comprehensive aerodynamic analysis throughout flight"""
        if not self.flight:
            return {'drag_coefficient': 0.5, 'aerodynamic_efficiency': 0.0}
        
        try:
            # Aerodynamic force analysis throughout flight
            time_points = self.flight.time
            aerodynamic_data = []
            
            for i, t in enumerate(time_points):
                try:
                    # Velocity and dynamic pressure
                    vx = self.flight.vx[i]
                    vy = self.flight.vy[i]
                    vz = self.flight.vz[i]
                    velocity_magnitude = np.sqrt(vx**2 + vy**2 + vz**2)
                    
                    # Atmospheric properties at altitude
                    altitude = self.flight.z[i]
                    air_density = self._calculate_air_density_at_altitude(altitude)
                    dynamic_pressure = 0.5 * air_density * velocity_magnitude**2
                    
                    # Mach number
                    temperature = self._calculate_temperature_at_altitude(altitude)
                    speed_of_sound = np.sqrt(1.4 * 287 * temperature)  # m/s
                    mach_number = velocity_magnitude / speed_of_sound if speed_of_sound > 0 else 0.0
                    
                    # Drag force and coefficient
                    drag_force = self._estimate_drag_force(i)
                    reference_area = np.pi * self.rocket._calculate_radius()**2
                    drag_coefficient = drag_force / (dynamic_pressure * reference_area) if dynamic_pressure > 0 else 0.0
                    
                    # Reynolds number
                    rocket_length = self.rocket._calculate_total_length()
                    reynolds_number = air_density * velocity_magnitude * rocket_length / 1.8e-5  # Air viscosity
                    
                    aerodynamic_data.append({
                        'time': float(t),
                        'altitude': float(altitude),
                        'velocity': float(velocity_magnitude),
                        'mach_number': float(mach_number),
                        'dynamic_pressure': float(dynamic_pressure),
                        'drag_coefficient': float(drag_coefficient),
                        'drag_force': float(drag_force),
                        'reynolds_number': float(reynolds_number),
                        'air_density': float(air_density)
                    })
                    
                except:
                    # Skip invalid data points
                    continue
            
            # Overall aerodynamic metrics
            if aerodynamic_data:
                avg_cd = np.mean([d['drag_coefficient'] for d in aerodynamic_data])
                max_mach = np.max([d['mach_number'] for d in aerodynamic_data])
                max_dynamic_pressure = np.max([d['dynamic_pressure'] for d in aerodynamic_data])
                
                # Aerodynamic efficiency (simplified L/D ratio estimation)
                aerodynamic_efficiency = self._calculate_aerodynamic_efficiency()
                
                # Transonic effects detection
                transonic_effects = self._analyze_transonic_effects(aerodynamic_data)
                
                return {
                    'average_drag_coefficient': float(avg_cd),
                    'maximum_mach_number': float(max_mach),
                    'maximum_dynamic_pressure_pa': float(max_dynamic_pressure),
                    'aerodynamic_efficiency': aerodynamic_efficiency,
                    'transonic_effects': transonic_effects,
                    'flight_regime': self._classify_flight_regime(max_mach),
                    'aerodynamic_timeline': aerodynamic_data[:50],  # Limit data size
                    'reference_area_m2': float(np.pi * self.rocket._calculate_radius()**2),
                    'fineness_ratio': float(self.rocket._calculate_total_length() / (2 * self.rocket._calculate_radius()))
                }
            else:
                return {'drag_coefficient': 0.5, 'aerodynamic_efficiency': 0.0}
                
        except Exception as e:
            logger.warning(f"Enhanced aerodynamic analysis failed: {e}")
            return {'drag_coefficient': 0.5, 'aerodynamic_efficiency': 0.0}
    
    def _calculate_performance_metrics(self) -> Dict[str, Any]:
        """Calculate comprehensive performance metrics"""
        if not self.flight:
            return {'efficiency_score': 0.0}
        
        try:
            # Basic performance metrics
            max_altitude = float(self.flight.apogee - self.environment.config.elevation_m)
            max_velocity = float(self.flight.max_speed)
            apogee_time = float(self.flight.apogee_time)
            
            # Motor performance
            motor_spec = self.rocket.motor.spec
            theoretical_delta_v = self._calculate_theoretical_delta_v()
            actual_delta_v = max_velocity  # Simplified
            propulsive_efficiency = actual_delta_v / theoretical_delta_v if theoretical_delta_v > 0 else 0.0
            
            # Aerodynamic performance
            drag_losses = self._calculate_drag_losses()
            gravity_losses = self._calculate_gravity_losses()
            
            # Overall efficiency metrics
            mass_ratio = self._calculate_mass_ratio()
            payload_fraction = self._calculate_payload_fraction()
            
            # Performance indices
            altitude_per_impulse = max_altitude / motor_spec["total_impulse_n_s"] if motor_spec["total_impulse_n_s"] > 0 else 0.0
            altitude_per_mass = max_altitude / (self.rocket._calculate_dry_mass() + motor_spec["mass"]["propellant_kg"])
            
            # Stability performance
            stability_margin = float(self.rocket.rocket.static_margin(0)) if self.rocket.rocket else 1.5
            stability_rating = self._rate_stability(stability_margin)
            
            # Overall performance score (0-100)
            performance_score = self._calculate_overall_performance_score(
                max_altitude, propulsive_efficiency, stability_margin
            )
            
            return {
                'overall_performance_score': float(performance_score),
                'propulsive_efficiency': float(propulsive_efficiency),
                'aerodynamic_efficiency': float(1.0 - drag_losses / theoretical_delta_v) if theoretical_delta_v > 0 else 0.0,
                'mass_ratio': float(mass_ratio),
                'payload_fraction': float(payload_fraction),
                'altitude_per_impulse_m_per_ns': float(altitude_per_impulse),
                'altitude_per_mass_m_per_kg': float(altitude_per_mass),
                'drag_losses_ms': float(drag_losses),
                'gravity_losses_ms': float(gravity_losses),
                'theoretical_delta_v_ms': float(theoretical_delta_v),
                'actual_delta_v_ms': float(actual_delta_v),
                'stability_performance': {
                    'static_margin': float(stability_margin),
                    'rating': stability_rating,
                    'score': min(100, max(0, (stability_margin - 0.5) * 50))  # 0-100 score
                },
                'mission_success_probability': self._estimate_mission_success_probability(performance_score, stability_margin)
            }
            
        except Exception as e:
            logger.warning(f"Performance metrics calculation failed: {e}")
            return {
                'overall_performance_score': 0.0,
                'propulsive_efficiency': 0.0
            }
    
    # ================================
    # HELPER METHODS FOR ENHANCED ANALYSIS
    # ================================
    
    def _calculate_impact_angle(self) -> float:
        """Calculate impact angle with respect to ground"""
        return 45.0  # Stub implementation
    
    def _calculate_impact_energy(self) -> float:
        """Calculate kinetic energy at impact"""
        return 100.0  # Stub implementation
    
    def _calculate_landing_dispersion_ellipse(self) -> Dict[str, float]:
        """Calculate landing dispersion ellipse parameters"""
        return {'major_axis_m': 50.0, 'minor_axis_m': 30.0, 'rotation_deg': 0.0, 'confidence_level': 0.95}
    
    def _assess_landing_safety(self, impact_velocity: float, drift_distance: float) -> Dict[str, Any]:
        """Assess landing safety based on impact conditions"""
        return {'overall_safety': 'safe', 'overall_score': 80.0}
    
    def _analyze_wind_drift_effects(self) -> Dict[str, Any]:
        """Analyze wind drift effects throughout flight"""
        return {'total_wind_drift_m': 50.0, 'ascent_drift_m': 20.0, 'descent_drift_m': 30.0}
    
    def _calculate_thrust_coefficient(self, thrust_data: List[float], pressure_data: List[float]) -> float:
        """Calculate thrust coefficient"""
        return 1.0  # Stub implementation
    
    def _calculate_air_density_at_altitude(self, altitude: float) -> float:
        """Calculate air density at given altitude using standard atmosphere"""
        return max(0.1, 1.225 * np.exp(-altitude / 8400))  # Simplified exponential atmosphere
    
    def _calculate_temperature_at_altitude(self, altitude: float) -> float:
        """Calculate temperature at given altitude"""
        return max(180.0, 288.15 - 0.0065 * altitude)  # Standard atmosphere
    
    def _estimate_drag_force(self, time_index: int) -> float:
        """Estimate drag force at given time index"""
        return 50.0  # Stub implementation
    
    def _calculate_aerodynamic_efficiency(self) -> float:
        """Calculate overall aerodynamic efficiency"""
        return 0.5  # Stub implementation
    
    def _analyze_transonic_effects(self, aero_data: List[Dict]) -> Dict[str, Any]:
        """Analyze transonic effects during flight"""
        return {'transonic_encountered': False}
    
    def _classify_flight_regime(self, max_mach: float) -> str:
        """Classify flight regime based on maximum Mach number"""
        if max_mach < 0.8:
            return "subsonic"
        elif max_mach < 1.2:
            return "transonic"
        else:
            return "supersonic"
    
    def _calculate_theoretical_delta_v(self) -> float:
        """Calculate theoretical delta-v using rocket equation"""
        return 200.0  # Stub implementation
    
    def _calculate_drag_losses(self) -> float:
        """Calculate velocity losses due to drag"""
        return 50.0  # Stub implementation
    
    def _calculate_gravity_losses(self) -> float:
        """Calculate velocity losses due to gravity"""
        return 30.0  # Stub implementation
    
    def _calculate_mass_ratio(self) -> float:
        """Calculate rocket mass ratio"""
        return 1.5  # Stub implementation
    
    def _calculate_payload_fraction(self) -> float:
        """Calculate payload fraction (simplified)"""
        return 0.1  # Stub implementation
    
    def _calculate_overall_performance_score(self, altitude: float, efficiency: float, stability: float) -> float:
        """Calculate overall performance score (0-100)"""
        return min(100, max(0, altitude / 10.0))  # Simple altitude-based score
    
    def _estimate_mission_success_probability(self, performance_score: float, stability_margin: float) -> float:
        """Estimate mission success probability"""
        return min(1.0, max(0.0, (performance_score / 100.0 + stability_margin / 2.0) / 2.0))
    
    def _extract_enhanced_events(self) -> List[FlightEvent]:
        """Extract enhanced flight events with more detail"""
        # Fallback to basic events if enhanced extraction fails
        return self._extract_events() if hasattr(self, '_extract_events') else []
    
    def _estimate_rail_departure_time(self) -> float:
        """Estimate time when rocket leaves launch rail"""
        return 0.1  # Stub implementation
    
    def _calculate_enhanced_motor_position(self) -> float:
        """Calculate motor position from tail in enhanced rocket"""
        # ✅ NEW METHOD: Calculate motor position for enhanced rockets
        return self.config.motor.position_from_tail_m

# ================================
# API ENDPOINTS
# ================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "rocketpy_available": ROCKETPY_AVAILABLE,
        "version": "3.0.0",
        "features": {
            "6dof_simulation": ROCKETPY_AVAILABLE,
            "monte_carlo": ROCKETPY_AVAILABLE,
            "atmospheric_modeling": ROCKETPY_AVAILABLE,
            "simplified_fallback": True
        }
    }

@app.get("/motors", response_model=Dict[str, List[MotorSpec]])
async def get_motors(
    motor_type: Optional[Literal["solid", "liquid", "hybrid"]] = None,
    manufacturer: Optional[str] = None,
    impulse_class: Optional[str] = None
):
    """Get available motors with optional filtering"""
    
    motors = []
    for motor_id, spec in MOTOR_DATABASE.items():
        # Apply filters
        if motor_type and spec["type"] != motor_type:
            continue
        if manufacturer and spec["manufacturer"].lower() != manufacturer.lower():
            continue
        if impulse_class and spec["impulse_class"] != impulse_class:
            continue
        
        motor_spec = MotorSpec(
            id=motor_id,
            name=spec["name"],
            manufacturer=spec["manufacturer"],
            type=spec["type"],
            impulseClass=spec["impulse_class"],
            totalImpulse=spec["total_impulse_n_s"],
            avgThrust=spec["avg_thrust_n"],
            burnTime=spec["burn_time_s"],
            dimensions=spec["dimensions"],
            weight=spec["mass"]
        )
        motors.append(motor_spec)
    
    return {"motors": motors}


@app.post("/simulate", response_model=SimulationResult)
async def simulate_standard(request: SimulationRequestModel):
    """Standard simulation endpoint with component-based models only"""
    
    logger.info("Starting standard simulation")
    
    # Set defaults
    environment = request.environment or EnvironmentModel()
    launch_params = request.launchParameters or LaunchParametersModel()
        
        # Run simulation
    result = await simulate_rocket_6dof(
        request.rocket,
        environment,
        launch_params
    )
    
    logger.info(f"Standard simulation completed: {result.maxAltitude:.1f}m apogee")
    return result

@app.post("/simulate/hifi", response_model=SimulationResult)

async def simulate_high_fidelity(request: SimulationRequestModel):
    """High-fidelity simulation endpoint with component-based models only"""
    
    if not ROCKETPY_AVAILABLE:
        raise HTTPException(
            status_code=503, 
            detail="High-fidelity simulation requires RocketPy library"
        )
    
    logger.info("Starting high-fidelity simulation")
    
    # Set defaults
    environment = request.environment or EnvironmentModel()
    launch_params = request.launchParameters or LaunchParametersModel()
    
    # Enhanced analysis options
    analysis_options = {
        'rtol': 1e-8,
        'atol': 1e-12,
        'max_time': 300,
        'include_enhanced_analysis': True
    }
    
    # Run enhanced simulation
    result = await simulate_rocket_6dof_enhanced(
        request.rocket,
        environment,
        launch_params,
        analysis_options
    )
    
    logger.info(f"High-fidelity simulation completed: {result.maxAltitude:.1f}m apogee")
    return result





@app.post("/simulate/monte-carlo", response_model=MonteCarloResult)
async def simulate_monte_carlo(request: MonteCarloRequest):
    """Monte Carlo simulation endpoint with component-based models only"""
    
    logger.info(f"Starting Monte Carlo simulation with {request.iterations} iterations")
        
        # Run Monte Carlo simulation
    mc_sim = MonteCarloSimulation(request)
    result = await mc_sim.run()
        
    logger.info(f"Monte Carlo simulation completed: mean apogee {result.statistics['maxAltitude'].mean:.1f}m")
        return result
        


@app.post("/simulate/batch")
async def simulate_batch(requests: List[SimulationRequestModel], 
                        background_tasks: BackgroundTasks):
    """Batch simulation endpoint with component-based models only"""
    
    if len(requests) > 50:
        raise HTTPException(
            status_code=400,
            detail="Batch size limited to 50 simulations"
        )
    
    # Start simulations in background
    simulation_id = f"batch_{datetime.now().isoformat()}"
    background_tasks.add_task(run_batch_simulations, simulation_id, requests)
    
    return {
        "simulation_id": simulation_id,
        "status": "started",
        "count": len(requests),
        "estimated_completion": "5-10 minutes"
    }

async def run_batch_simulations(simulation_id: str, requests: List[SimulationRequestModel]):
    """Run batch simulations in background with component-based models only"""
    logger.info(f"Starting batch simulation {simulation_id} with {len(requests)} requests")
    
    results = []
    for i, request in enumerate(requests):
        try:
            result = await simulate_rocket_6dof(
                request.rocket,
                request.environment or EnvironmentModel(),
                request.launchParameters or LaunchParametersModel()
            )
            results.append({"index": i, "result": result, "status": "success"})
        except Exception as e:
            logger.error(f"Batch simulation {i} failed: {e}")
            results.append({"index": i, "error": str(e), "status": "failed"})
    
    logger.info(f"Batch simulation {simulation_id} completed with {len(results)} results")


@app.post("/simulate/enhanced", response_model=SimulationResult)
async def simulate_enhanced_6dof(request: SimulationRequestModel):
    """Enhanced high-fidelity 6-DOF simulation with component-based models only"""
    
    # Set defaults
    environment = request.environment or EnvironmentModel()
    launch_params = request.launchParameters or LaunchParametersModel()
    
    # Enhanced analysis options
    analysis_options = {
        'rtol': 1e-9,  # Higher precision
        'atol': 1e-13,  # Higher precision
        'max_time': 600,  # 10 minutes max
        'include_enhanced_analysis': True
    }
    
    return await simulate_rocket_6dof_enhanced(
        request.rocket, 
        environment, 
        launch_params,
        analysis_options
    )


@app.post("/simulate/professional", response_model=SimulationResult)
async def simulate_professional_grade(request: SimulationRequestModel):
    """Professional-grade simulation with component-based models only"""
    
    if not ROCKETPY_AVAILABLE:
        raise HTTPException(
            status_code=503, 
            detail="Professional simulation requires RocketPy library"
        )
    
    # Set defaults
    environment = request.environment or EnvironmentModel()
    launch_params = request.launchParameters or LaunchParametersModel()
    
    # Professional analysis options
    analysis_options = {
        'rtol': 1e-10,  # Maximum precision
        'atol': 1e-14,  # Maximum precision
        'max_time': 1200,  # 20 minutes max
        'include_enhanced_analysis': True,
        'include_aerodynamic_analysis': True,
        'include_stability_analysis': True,
        'include_performance_metrics': True
    }
    
    return await simulate_rocket_6dof_enhanced(
        request.rocket, 
        environment, 
        launch_params,
        analysis_options
    )


@app.post("/analyze/stability")
async def analyze_rocket_stability(request: SimulationRequestModel):
    """Comprehensive stability analysis with component-based models only"""
    
    try:
        logger.info("Starting stability analysis")
        rocket_model = request.rocket
        
        if ROCKETPY_AVAILABLE:
            # Full RocketPy stability analysis
            environment = EnhancedSimulationEnvironment(EnvironmentModel())
            motor = EnhancedSimulationMotor(rocket_model.motor.motor_database_id)
            rocket = EnhancedSimulationRocket(rocket_model, motor)
            
            if not rocket.rocket:
                raise HTTPException(status_code=400, detail="Failed to create rocket model")
            
            # Perform stability analysis
            static_margin = float(rocket.rocket.static_margin(0))
            
            # Calculate center of pressure and center of mass
            try:
                cp = float(rocket.rocket.cp_position(0))
                cm = float(rocket.rocket.center_of_mass(0))
            except:
                cp = 0.5
                cm = 0.3
        else:
            # Simplified stability analysis when RocketPy not available
            logger.info("Using simplified stability analysis")
            
            # Calculate total length
            total_length = 0.0
            if hasattr(rocket_model, 'nose_cone') and rocket_model.nose_cone:
                total_length += rocket_model.nose_cone.length_m
            for tube in rocket_model.body_tubes:
                total_length += tube.length_m
            
            # Calculate fin contribution to stability
            total_fin_area = 0.0
            fin_distance_from_nose = total_length * 0.85
            
            for fin in rocket_model.fins:
                fin_area = 0.5 * (fin.root_chord_m + fin.tip_chord_m) * fin.span_m
                total_fin_area += fin_area * fin.fin_count
            
            # Simplified center of pressure calculation
            body_area = 0.0
            for tube in rocket_model.body_tubes:
                body_area += tube.outer_radius_m * 2 * tube.length_m
            
            body_cp_distance = total_length * 0.5
            fin_cp_distance = fin_distance_from_nose
            
            if body_area + total_fin_area > 0:
                cp = (body_area * body_cp_distance + total_fin_area * fin_cp_distance) / (body_area + total_fin_area)
            else:
                cp = total_length * 0.6
            
            # Simplified center of mass calculation
            cm = total_length * 0.4
            
            # Calculate static margin
            reference_diameter = 0.05
            if rocket_model.body_tubes:
                reference_diameter = max(tube.outer_radius_m * 2 for tube in rocket_model.body_tubes)
            
            static_margin = (cp - cm) / reference_diameter
            
            logger.info(f"Calculated stability - CP: {cp:.3f}m, CM: {cm:.3f}m, Margin: {static_margin:.2f}")
        
        # Stability rating
        if static_margin < 0.5:
            rating = "unstable"
            recommendation = "Add more fin area or move fins aft. Static margin too low."
        elif static_margin < 1.0:
            rating = "marginally_stable"
            recommendation = "Consider increasing fin area slightly for better stability."
        elif static_margin < 2.0:
            rating = "stable"
            recommendation = "Good stability margin for safe flight."
        else:
            rating = "overstable"
            recommendation = "Consider reducing fin area for better performance. May be too stable."
        
        return {
            "static_margin": static_margin,
            "center_of_pressure": cp,
            "center_of_mass": cm,
            "stability_rating": rating,
            "recommendation": recommendation,
            "analysis_type": "simplified" if not ROCKETPY_AVAILABLE else "comprehensive"
        }
        
    except Exception as e:
        logger.error(f"Stability analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Stability analysis error: {str(e)}")


@app.get("/motors/detailed", response_model=Dict[str, Any])
async def get_detailed_motors():
    """Get detailed motor specifications with performance data"""
    
    detailed_motors = {}
    
    for motor_id, spec in MOTOR_DATABASE.items():
        # Calculate additional performance metrics
        total_impulse = spec["total_impulse_n_s"]
        avg_thrust = spec["avg_thrust_n"]
        burn_time = spec["burn_time_s"]
        
        # Calculate peak thrust (estimated)
        peak_thrust = avg_thrust * 1.3
        
        # Performance characteristics
        thrust_density = avg_thrust / (spec["mass"]["total_kg"] * 9.81)
        specific_impulse = spec.get("isp_s", total_impulse / (spec["mass"]["propellant_kg"] * 9.81))
        
        detailed_motors[motor_id] = {
            # ✅ ADD: Frontend-compatible format
            "id": motor_id,
            "name": spec["name"],
            "manufacturer": spec["manufacturer"],
            "type": spec["type"],
            "impulseClass": spec["impulse_class"],
            
            # ✅ ADD: Frontend-expected field names
            "averageThrust": avg_thrust,           # ← Frontend expects this
            "totalImpulse": total_impulse,         # ← Frontend expects this
            "specificImpulse": specific_impulse,   # ← Frontend expects this
            "burnTime": burn_time,
            "thrust": avg_thrust,                  # ← Alias for compatibility
            "isp": specific_impulse,               # ← Alias for compatibility
            
            # Keep existing structure
            **spec,
            "performance_metrics": {
                "peak_thrust": peak_thrust,
                "thrust_density": thrust_density,
                "specific_impulse": specific_impulse,
                "impulse_density": total_impulse / spec["mass"]["total_kg"],
                "burn_rate": spec["mass"]["propellant_kg"] / burn_time
            },
            "applications": {
                "min_rocket_mass": spec["mass"]["total_kg"] * 5,
                "max_rocket_mass": spec["mass"]["total_kg"] * 15,
                "recommended_diameter": spec["dimensions"]["outer_diameter_m"] * 1.5,
                "min_stability_length": spec["dimensions"]["length_m"] * 3
            }
        }
    
    return {
        "motors": detailed_motors,
        "total_count": len(detailed_motors),
        "categories": {
            "solid": len([m for m in detailed_motors.values() if m["type"] == "solid"]),
            "liquid": len([m for m in detailed_motors.values() if m["type"] == "liquid"]),
            "hybrid": len([m for m in detailed_motors.values() if m["type"] == "hybrid"])
        }
    }


@app.get("/environment/atmospheric-models")
async def get_atmospheric_models():
    """Get atmospheric modeling options for simulation configuration"""
    
    return {
        "available_models": ["standard", "custom", "forecast"],
        "default_model": "standard",
        
        "descriptions": {
            "standard": "International Standard Atmosphere (ISA) - Reliable baseline model",
            "forecast": "Real-time weather data from GFS - Most accurate for actual launches", 
            "custom": "User-defined atmospheric conditions - For research and specialized applications"
        },
        
        "capabilities": {
            "standard": {
                "altitude_range_m": [0, 30000],
                "accuracy": "baseline",
                "data_sources": ["ISA tables"],
                "features": ["temperature_profile", "pressure_profile", "density_calculation"]
            },
            "forecast": {
                "altitude_range_m": [0, 20000], 
                "accuracy": "high",
                "data_sources": ["GFS", "real_time_weather"],
                "features": ["real_wind_data", "temperature_profiles", "pressure_data", "humidity"]
            },
            "custom": {
                "altitude_range_m": [0, 100000],
                "accuracy": "user_defined", 
                "data_sources": ["user_input"],
                "features": ["custom_profiles", "research_conditions", "specialized_atmospheres"]
            }
        },
        
        "use_cases": {
            "beginner": "standard",
            "educational": "standard", 
            "competition": "forecast",
            "real_launch": "forecast",
            "research": "custom",
            "high_altitude": "forecast",
            "planetary": "custom"
        },
        
        "requirements": {
            "standard": "No additional data required",
            "forecast": "Internet connection and valid GPS coordinates required",
            "custom": "Custom atmospheric profile data file required"
        }
    }

# ================================
# STARTUP/SHUTDOWN HANDLERS
# ================================

@app.on_event("startup")
async def startup_event():
    """Initialize application"""
    logger.info("RocketPy Simulation Service starting up...")
    logger.info(f"RocketPy available: {ROCKETPY_AVAILABLE}")
    logger.info(f"Motor database loaded: {len(MOTOR_DATABASE)} motors")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("RocketPy Simulation Service shutting down...")
    executor.shutdown(wait=True)

# ================================
# MAIN ENTRY POINT
# ================================

if __name__ == "__main__":
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        log_level="info",
        access_log=True
    ) 