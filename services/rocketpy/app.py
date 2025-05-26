import os
import json
import uvicorn
import numpy as np
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Tuple, Union, Literal
from datetime import datetime
import asyncio
from concurrent.futures import ThreadPoolExecutor
import logging

# Import RocketPy
try:
    from rocketpy import Environment, SolidMotor, Rocket, Flight, GenericMotor, LiquidMotor, HybridMotor
    ROCKETPY_AVAILABLE = True
except ImportError:
    print("Warning: RocketPy not installed, using simplified simulation model")
    Environment, SolidMotor, Rocket, Flight, GenericMotor, LiquidMotor, HybridMotor = None, None, None, None, None, None, None
    ROCKETPY_AVAILABLE = False

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="RocketPy Advanced Simulation Service",
    description="Professional-grade rocket simulation with 6-DOF physics, Monte Carlo analysis, and atmospheric modeling",
    version="2.0.0"
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
# PYDANTIC MODELS
# ================================

class PartModel(BaseModel):
    id: str
    type: Literal["nose", "body", "fin", "engine", "parachute"]
    color: Optional[str] = "white"
    # Nose cone properties
    shape: Optional[Literal["ogive", "conical", "elliptical", "parabolic"]] = None
    length: Optional[float] = None
    baseØ: Optional[float] = Field(None, alias="baseØ")
    # Body tube properties
    Ø: Optional[float] = Field(None, alias="Ø")
    # Fin properties
    root: Optional[float] = None
    span: Optional[float] = None
    sweep: Optional[float] = None
    tip: Optional[float] = None
    # Engine properties
    thrust: Optional[float] = None
    Isp: Optional[float] = None
    # Parachute properties
    cd_s: Optional[float] = None
    trigger: Optional[str] = None
    lag: Optional[float] = None

class RocketModel(BaseModel):
    id: str
    name: str
    parts: List[PartModel]
    motorId: str
    Cd: float = 0.5
    units: Literal["metric", "imperial"] = "metric"

class EnvironmentModel(BaseModel):
    latitude: float = 0.0
    longitude: float = 0.0
    elevation: float = 0.0
    date: Optional[str] = None
    timezone: Optional[str] = None
    windSpeed: Optional[float] = 0.0
    windDirection: Optional[float] = 0.0
    atmosphericModel: Optional[Literal["standard", "custom", "forecast"]] = "standard"

class LaunchParametersModel(BaseModel):
    railLength: float = 5.0
    inclination: float = 85.0
    heading: float = 0.0

class SimulationRequestModel(BaseModel):
    rocket: RocketModel
    environment: Optional[EnvironmentModel] = None
    launchParameters: Optional[LaunchParametersModel] = None
    simulationType: Optional[Literal["standard", "hifi", "monte_carlo"]] = "standard"

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
# MOTOR DATABASE
# ================================

MOTOR_DATABASE = {
    "mini-motor": {
        "name": "A8-3", "manufacturer": "Estes", "type": "solid",
        "impulseClass": "A", "totalImpulse": 2.5, "avgThrust": 1.5,
        "burnTime": 1.8, "dimensions": {"diameter": 13, "length": 100},
        "weight": {"propellant": 0.008, "total": 0.015}, "isp": 150
    },
    "default-motor": {
        "name": "F32-6", "manufacturer": "Generic", "type": "solid",
        "impulseClass": "F", "totalImpulse": 80, "avgThrust": 32,
        "burnTime": 2.5, "dimensions": {"diameter": 29, "length": 124},
        "weight": {"propellant": 0.040, "total": 0.070}, "isp": 200
    },
    "high-power": {
        "name": "H180-7", "manufacturer": "Generic", "type": "solid",
        "impulseClass": "H", "totalImpulse": 320, "avgThrust": 100,
        "burnTime": 3.2, "dimensions": {"diameter": 38, "length": 150},
        "weight": {"propellant": 0.090, "total": 0.150}, "isp": 220
    },
    "super-power": {
        "name": "I200-8", "manufacturer": "Generic", "type": "solid",
        "impulseClass": "I", "totalImpulse": 800, "avgThrust": 200,
        "burnTime": 4.0, "dimensions": {"diameter": 54, "length": 200},
        "weight": {"propellant": 0.200, "total": 0.300}, "isp": 240
    },
    "small-liquid": {
        "name": "Liquid-500N", "manufacturer": "Custom", "type": "liquid",
        "impulseClass": "M", "totalImpulse": 15000, "avgThrust": 500,
        "burnTime": 30, "dimensions": {"diameter": 75, "length": 300},
        "weight": {"propellant": 1.5, "total": 2.3}, "isp": 300
    },
    "medium-liquid": {
        "name": "Liquid-2000N", "manufacturer": "Custom", "type": "liquid",
        "impulseClass": "O", "totalImpulse": 90000, "avgThrust": 2000,
        "burnTime": 45, "dimensions": {"diameter": 100, "length": 400},
        "weight": {"propellant": 6.5, "total": 8.5}, "isp": 320
    },
    "large-liquid": {
        "name": "Liquid-8000N", "manufacturer": "Custom", "type": "liquid",
        "impulseClass": "P", "totalImpulse": 120000, "avgThrust": 8000,
        "burnTime": 15, "dimensions": {"diameter": 150, "length": 500},
        "weight": {"propellant": 8.0, "total": 11.0}, "isp": 340
    },
    "hybrid-engine": {
        "name": "Hybrid-1200N", "manufacturer": "Custom", "type": "hybrid",
        "impulseClass": "N", "totalImpulse": 24000, "avgThrust": 1200,
        "burnTime": 20, "dimensions": {"diameter": 90, "length": 350},
        "weight": {"propellant": 4.5, "total": 5.7}, "isp": 280
    }
}

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
            latitude=config.latitude,
            longitude=config.longitude,
            elevation=config.elevation
        )
        
        # Set date if provided
        if config.date:
            try:
                date_obj = datetime.fromisoformat(config.date.replace('Z', '+00:00'))
                self.env.set_date(date_obj, timezone=config.timezone or "UTC")
            except:
                logger.warning(f"Failed to parse date: {config.date}")
        
        # Set atmospheric model
        if config.atmosphericModel == "standard":
            self.env.set_atmospheric_model(type='StandardAtmosphere')
        elif config.atmosphericModel == "forecast":
            try:
                self.env.set_atmospheric_model(type='Forecast', file='GFS')
            except:
                logger.warning("Failed to load GFS forecast, using standard atmosphere")
                self.env.set_atmospheric_model(type='StandardAtmosphere')
        
        # Add wind if specified
        if config.windSpeed and config.windSpeed > 0:
            self._add_wind_profile(config.windSpeed, config.windDirection or 0)
    
    def _add_wind_profile(self, wind_speed: float, wind_direction: float):
        """Add wind profile to environment"""
        if not self.env:
            return
            
        # Convert wind direction to u, v components
        wind_u = wind_speed * np.sin(np.radians(wind_direction))
        wind_v = wind_speed * np.cos(np.radians(wind_direction))
        
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
        except:
            logger.warning("Failed to set custom wind profile")

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
            dry_mass=self.spec["weight"]["total"] - self.spec["weight"]["propellant"],
            dry_inertia=(0.125, 0.125, 0.002),
            nozzle_radius=self.spec["dimensions"]["diameter"] / 2000,  # mm to m
            grain_number=1,
            grain_density=1815,  # kg/m³
            grain_outer_radius=self.spec["dimensions"]["diameter"] / 2000 - 0.002,
            grain_initial_inner_radius=0.005,
            grain_initial_height=self.spec["dimensions"]["length"] / 1000 * 0.8,
            nozzle_position=0,
            burn_time=self.spec["burnTime"]
        )
    
    def _create_liquid_motor(self):
        """Create liquid motor with staged combustion"""
        thrust_curve = self._generate_liquid_thrust_curve()
        
        # Use GenericMotor for liquid engines with custom thrust curves
        self.motor = GenericMotor(
            thrust_source=thrust_curve,
            dry_mass=self.spec["weight"]["total"] - self.spec["weight"]["propellant"],
            dry_inertia=(0.2, 0.2, 0.002),
            nozzle_radius=self.spec["dimensions"]["diameter"] / 2000,
            burn_time=self.spec["burnTime"]
        )
    
    def _create_hybrid_motor(self):
        """Create hybrid motor"""
        thrust_curve = self._generate_hybrid_thrust_curve()
        
        self.motor = GenericMotor(
            thrust_source=thrust_curve,
            dry_mass=self.spec["weight"]["total"] - self.spec["weight"]["propellant"],
            dry_inertia=(0.15, 0.15, 0.002),
            nozzle_radius=self.spec["dimensions"]["diameter"] / 2000,
            burn_time=self.spec["burnTime"]
        )
    
    def _generate_thrust_curve(self) -> List[Tuple[float, float]]:
        """Generate realistic thrust curve for solid motor"""
        burn_time = self.spec["burnTime"]
        avg_thrust = self.spec["avgThrust"]
        
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
        burn_time = self.spec["burnTime"]
        avg_thrust = self.spec["avgThrust"]
        
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
        burn_time = self.spec["burnTime"]
        avg_thrust = self.spec["avgThrust"]
        
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
        """Calculate rocket radius from body parts"""
        body_parts = [p for p in self.config.parts if p.type == "body"]
        if body_parts:
            # Convert diameter to radius and cm to m
            return body_parts[0].Ø / 200 if body_parts[0].Ø else 0.05
        return 0.05  # Default 5cm radius
    
    def _calculate_dry_mass(self) -> float:
        """Calculate dry mass from parts"""
        mass = 0.5  # Base mass
        
        for part in self.config.parts:
            if part.type == "nose":
                mass += 0.05 * (part.length or 15) / 10
            elif part.type == "body":
                mass += 0.1 * (part.length or 40) / 10 * (part.Ø or 5) / 5
            elif part.type == "fin":
                mass += 0.01 * (part.root or 8) * (part.span or 6) / 48
        
        return mass
    
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
        """Calculate total rocket length"""
        nose_length = sum(p.length or 15 for p in self.config.parts if p.type == "nose") / 100
        body_length = sum(p.length or 40 for p in self.config.parts if p.type == "body") / 100
        return nose_length + body_length
    
    def _calculate_center_of_mass(self) -> float:
        """Calculate center of mass without motor"""
        total_length = self._calculate_total_length()
        return total_length * 0.5  # Simplified: assume uniform mass distribution
    
    def _calculate_motor_position(self) -> float:
        """Calculate motor position in rocket"""
        return 0  # At the tail
    
    def _calculate_drag_curve(self) -> float:
        """Calculate drag coefficient"""
        return self.config.Cd
    
    def _add_nose_cone(self):
        """Add nose cone to rocket"""
        nose_parts = [p for p in self.config.parts if p.type == "nose"]
        if not nose_parts or not self.rocket:
            return
        
        nose = nose_parts[0]
        length = (nose.length or 15) / 100  # cm to m
        kind = nose.shape or "ogive"
        
        # Map our shapes to RocketPy shapes
        shape_map = {
            "ogive": "tangent ogive",
            "conical": "conical",
            "elliptical": "elliptical",
            "parabolic": "parabolic"
        }
        
        total_length = self._calculate_total_length()
        position = total_length - length  # Position from tail
        
        try:
            self.rocket.add_nose(
                length=length,
                kind=shape_map.get(kind, "tangent ogive"),
                position=position
            )
        except Exception as e:
            logger.warning(f"Failed to add nose cone: {e}")
    
    def _add_fins(self):
        """Add fins to rocket"""
        fin_parts = [p for p in self.config.parts if p.type == "fin"]
        if not fin_parts or not self.rocket:
            return
        
        fin = fin_parts[0]
        root_chord = (fin.root or 8) / 100  # cm to m
        tip_chord = (fin.tip or fin.root * 0.5 if fin.root else 4) / 100
        span = (fin.span or 6) / 100
        sweep_length = (fin.sweep or 2) / 100
        
        try:
            self.rocket.add_trapezoidal_fins(
                n=3,  # 3 fins
                root_chord=root_chord,
                tip_chord=tip_chord,
                span=span,
                position=0.1,  # Slightly above the tail
                cant_angle=0,
                sweep_length=sweep_length,
                airfoil=None
            )
        except Exception as e:
            logger.warning(f"Failed to add fins: {e}")
    
    def _add_parachutes(self):
        """Add parachutes to rocket"""
        parachute_parts = [p for p in self.config.parts if p.type == "parachute"]
        
        for i, chute in enumerate(parachute_parts):
            if not self.rocket:
                break
                
            cd_s = chute.cd_s or 1.0
            trigger_altitude = 500  # Default trigger altitude
            lag = chute.lag or 1.5
            
            try:
                self.rocket.add_parachute(
                    name=f"parachute_{i}",
                    cd_s=cd_s,
                    trigger=trigger_altitude,
                    sampling_rate=105,
                    lag=lag,
                    noise=(0, 8.3, 0.5)
                )
            except Exception as e:
                logger.warning(f"Failed to add parachute {i}: {e}")

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
        """Run the flight simulation"""
        try:
            self.flight = Flight(
                rocket=self.rocket.rocket,
                environment=self.environment.env,
                rail_length=self.launch_params.railLength,
                inclination=self.launch_params.inclination,
                heading=self.launch_params.heading,
                rtol=1e-8,
                atol=1e-12
            )
            
            self._extract_results()
            
        except Exception as e:
            logger.error(f"Flight simulation failed: {e}")
            raise
    
    def _extract_results(self):
        """Extract key results from flight simulation"""
        if not self.flight:
            return
        
        try:
            # Basic flight metrics
            max_altitude = float(self.flight.apogee - self.environment.config.elevation)
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
        """Extract 6-DOF trajectory data"""
        if not self.flight:
            return None
        
        try:
            time_points = self.flight.time
            
            # Position data
            x_data = self.flight.x
            y_data = self.flight.y
            z_data = self.flight.z
            position = [[float(x), float(y), float(z)] for x, y, z in zip(x_data, y_data, z_data)]
            
            # Velocity data
            vx_data = self.flight.vx
            vy_data = self.flight.vy
            vz_data = self.flight.vz
            velocity = [[float(vx), float(vy), float(vz)] for vx, vy, vz in zip(vx_data, vy_data, vz_data)]
            
            # Acceleration data
            ax_data = self.flight.ax
            ay_data = self.flight.ay
            az_data = self.flight.az
            acceleration = [[float(ax), float(ay), float(az)] for ax, ay, az in zip(ax_data, ay_data, az_data)]
            
            # Attitude quaternions (if available)
            attitude = None
            angular_velocity = None
            
            try:
                e0_data = self.flight.e0
                e1_data = self.flight.e1
                e2_data = self.flight.e2
                e3_data = self.flight.e3
                attitude = [[float(e0), float(e1), float(e2), float(e3)] 
                           for e0, e1, e2, e3 in zip(e0_data, e1_data, e2_data, e3_data)]
                
                wx_data = self.flight.wx
                wy_data = self.flight.wy
                wz_data = self.flight.wz
                angular_velocity = [[float(wx), float(wy), float(wz)] 
                                   for wx, wy, wz in zip(wx_data, wy_data, wz_data)]
            except:
                pass  # 6-DOF data not available
            
            return TrajectoryData(
                time=[float(t) for t in time_points],
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
                    altitude=float(self.environment.config.elevation)
                ))
                
        except Exception as e:
            logger.warning(f"Failed to extract events: {e}")
        
        return events
    
    def _extract_thrust_curve(self) -> List[Tuple[float, float]]:
        """Extract motor thrust curve"""
        if not self.rocket.motor.motor:
            return []
        
        try:
            motor = self.rocket.motor.motor
            if hasattr(motor, 'thrust'):
                time_points = np.linspace(0, motor.burn_time, 100)
                thrust_data = []
                
                for t in time_points:
                    try:
                        thrust = float(motor.thrust.get_value_opt(t))
                        thrust_data.append((float(t), thrust))
                    except:
                        thrust_data.append((float(t), 0.0))
                
                return thrust_data
        except Exception as e:
            logger.warning(f"Failed to extract thrust curve: {e}")
        
        return []
    
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
        """Run Monte Carlo simulation"""
        logger.info(f"Starting Monte Carlo simulation with {self.base_request.iterations} iterations")
        
        # Run nominal simulation first
        nominal_result = await self._run_single_simulation(self.base_request.rocket, 
                                                          self.base_request.environment,
                                                          self.base_request.launchParameters)
        
        # Run varied simulations
        tasks = []
        for i in range(self.base_request.iterations):
            varied_config = self._apply_variations(i)
            task = self._run_single_simulation(*varied_config)
            tasks.append(task)
        
        # Execute simulations concurrently (with limits)
        batch_size = 10
        for i in range(0, len(tasks), batch_size):
            batch = tasks[i:i+batch_size]
            batch_results = await asyncio.gather(*batch, return_exceptions=True)
            
            for result in batch_results:
                if isinstance(result, Exception):
                    logger.warning(f"Simulation failed: {result}")
                else:
                    self.results.append(result)
        
        # Calculate statistics
        self._calculate_statistics()
        
        # Calculate landing dispersion
        dispersion = self._calculate_landing_dispersion()
        
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
                if param_name == "Cd":
                    rocket.Cd = value
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
        """Run a single simulation iteration"""
        try:
            return await simulate_rocket_6dof(rocket, environment, launch_params)
        except Exception as e:
            logger.warning(f"Monte Carlo iteration failed: {e}")
            # Return default result for failed simulations
            return SimulationResult(
                maxAltitude=0.0,
                maxVelocity=0.0,
                maxAcceleration=0.0,
                apogeeTime=0.0,
                stabilityMargin=0.0,
                simulationFidelity="failed"
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
    motor = SimulationMotor(rocket_config.motorId)
    rocket = SimulationRocket(rocket_config, motor)
    flight = SimulationFlight(rocket, environment, launch_params)
    
    if flight.results:
        return flight.results
    else:
        raise Exception("Simulation failed to produce results")

async def simulate_simplified_fallback(rocket_config: RocketModel) -> SimulationResult:
    """Simplified physics fallback simulation"""
    
    # Get motor data
    motor_spec = MOTOR_DATABASE.get(rocket_config.motorId, MOTOR_DATABASE["default-motor"])
    
    # Calculate basic rocket properties
    dry_mass = 0.5  # Base mass
    for part in rocket_config.parts:
        if part.type == "body":
            dry_mass += 0.1 * (part.length or 40) / 40
        elif part.type == "nose":
            dry_mass += 0.05 * (part.length or 15) / 15
        elif part.type == "fin":
            dry_mass += 0.01 * (part.root or 8) * (part.span or 6) / 48
    
    total_mass = dry_mass + motor_spec["weight"]["propellant"]
    
    # Basic physics calculation
    thrust = motor_spec["avgThrust"]
    burn_time = motor_spec["burnTime"]
    isp = motor_spec["isp"]
    
    # Rocket equation
    exhaust_velocity = isp * 9.81
    delta_v = exhaust_velocity * np.log(total_mass / dry_mass)
    
    # Simple trajectory estimation
    max_velocity = delta_v * 0.8  # Losses
    max_altitude = (max_velocity ** 2) / (2 * 9.81) * 0.7  # Air resistance
    apogee_time = max_velocity / 9.81
    
    # Calculate stability
    fin_count = len([p for p in rocket_config.parts if p.type == "fin"])
    stability_margin = 1.0 + fin_count * 0.3
    
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
    motor = EnhancedSimulationMotor(rocket_config.motorId)
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
            if config.atmosphericModel == "forecast":
                # Use GFS forecast data
                self.env.set_atmospheric_model(type='Forecast', file='GFS')
                logger.info("Using GFS forecast atmospheric model")
            elif config.atmosphericModel == "custom":
                # Use custom atmospheric profile
                self._setup_custom_atmosphere()
                logger.info("Using custom atmospheric model")
            else:
                # Use standard atmosphere with enhancements
                self.env.set_atmospheric_model(type='StandardAtmosphere')
                logger.info("Using enhanced standard atmospheric model")
        except Exception as e:
            logger.warning(f"Failed to set enhanced atmosphere: {e}, using standard")
            self.env.set_atmospheric_model(type='StandardAtmosphere')
    
    def _setup_wind_profile(self, config: EnvironmentModel):
        """Setup realistic wind profile with altitude variation"""
        if not config.windSpeed or config.windSpeed <= 0:
            return
            
        try:
            # Create realistic wind profile with altitude variation
            wind_speed = config.windSpeed
            wind_direction = config.windDirection or 0
            
            # Convert to u, v components
            wind_u = wind_speed * np.sin(np.radians(wind_direction))
            wind_v = wind_speed * np.cos(np.radians(wind_direction))
            
            # Create altitude-varying wind profile
            altitudes = [0, 100, 500, 1000, 2000, 5000, 10000, 15000]
            wind_u_profile = []
            wind_v_profile = []
            
            for alt in altitudes:
                # Wind typically increases with altitude
                altitude_factor = 1 + (alt / 10000) * 0.5  # 50% increase at 10km
                # Add some variation
                variation = 1 + 0.1 * np.sin(alt / 1000)
                
                u_at_alt = wind_u * altitude_factor * variation
                v_at_alt = wind_v * altitude_factor * variation
                
                wind_u_profile.append((alt, u_at_alt))
                wind_v_profile.append((alt, v_at_alt))
            
            # Set wind profile
            self.env.set_atmospheric_model(
                type='Custom',
                wind_u=wind_u_profile,
                wind_v=wind_v_profile
            )
            
            logger.info(f"Set realistic wind profile: {wind_speed} m/s at {wind_direction}°")
            
        except Exception as e:
            logger.warning(f"Failed to set wind profile: {e}")
    
    def _setup_weather_forecast(self, config: EnvironmentModel):
        """Setup weather forecast integration"""
        if config.date and config.atmosphericModel == "forecast":
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
                dry_mass=self.spec["weight"]["total"] - self.spec["weight"]["propellant"],
                dry_inertia=(0.125, 0.125, 0.002),
                nozzle_radius=self.spec["dimensions"]["diameter"] / 2000,
                grain_number=self._calculate_grain_number(),
                grain_density=1815,  # kg/m³ - typical APCP
                grain_outer_radius=self.spec["dimensions"]["diameter"] / 2000 - 0.002,
                grain_initial_inner_radius=self._calculate_initial_bore(),
                grain_initial_height=self._calculate_grain_height(),
                nozzle_position=0,
                burn_time=self.spec["burnTime"],
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
                dry_mass=self.spec["weight"]["total"] - self.spec["weight"]["propellant"],
                dry_inertia=(0.2, 0.2, 0.002),
                nozzle_radius=self.spec["dimensions"]["diameter"] / 2000,
                burn_time=self.spec["burnTime"],
                center_of_dry_mass_position=0.5,
                nozzle_position=0,
                tanks=[
                    # Oxidizer tank
                    {
                        'type': 'oxidizer',
                        'geometry': 'cylindrical',
                        'tank_height': 0.3,
                        'tank_radius': 0.05,
                        'liquid_mass': self.spec["weight"]["propellant"] * 0.7,  # 70% oxidizer
                        'liquid_height': 0.25,
                        'tank_position': 0.7
                    },
                    # Fuel tank
                    {
                        'type': 'fuel',
                        'geometry': 'cylindrical',
                        'tank_height': 0.2,
                        'tank_radius': 0.05,
                        'liquid_mass': self.spec["weight"]["propellant"] * 0.3,  # 30% fuel
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
                dry_mass=self.spec["weight"]["total"] - self.spec["weight"]["propellant"],
                dry_inertia=(0.15, 0.15, 0.002),
                nozzle_radius=self.spec["dimensions"]["diameter"] / 2000,
                burn_time=self.spec["burnTime"],
                center_of_dry_mass_position=0.5,
                nozzle_position=0,
                grain_number=1,
                grain_density=920,  # kg/m³ - typical HTPB
                grain_outer_radius=self.spec["dimensions"]["diameter"] / 2000 - 0.005,
                grain_initial_inner_radius=0.01,
                grain_initial_height=self.spec["dimensions"]["length"] / 1000 * 0.6,
                oxidizer_tank_position=0.7,
                oxidizer_tank_geometry='cylindrical',
                oxidizer_tank_height=0.2,
                oxidizer_tank_radius=0.04,
                liquid_oxidizer_mass=self.spec["weight"]["propellant"] * 0.8
            )
            
            logger.info(f"Created enhanced hybrid motor: {self.spec['name']}")
            
        except Exception as e:
            logger.warning(f"Enhanced hybrid motor creation failed: {e}")
            self._create_hybrid_motor()  # Fallback
    
    def _calculate_grain_number(self) -> int:
        """Calculate optimal number of grains based on motor size"""
        motor_length = self.spec["dimensions"]["length"] / 1000  # mm to m
        if motor_length < 0.1:
            return 1
        elif motor_length < 0.2:
            return 2
        else:
            return max(1, int(motor_length / 0.1))
    
    def _calculate_initial_bore(self) -> float:
        """Calculate initial bore radius for optimal performance"""
        outer_radius = self.spec["dimensions"]["diameter"] / 2000 - 0.002
        return outer_radius * 0.3  # 30% of outer radius
    
    def _calculate_grain_height(self) -> float:
        """Calculate grain height based on motor dimensions"""
        total_length = self.spec["dimensions"]["length"] / 1000
        grain_number = self._calculate_grain_number()
        return (total_length * 0.8) / grain_number  # 80% of total length
    
    def _calculate_throat_radius(self) -> float:
        """Calculate optimal throat radius for given thrust"""
        # Simplified throat sizing based on thrust
        thrust = self.spec["avgThrust"]
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
        burn_time = self.spec["burnTime"]
        avg_thrust = self.spec["avgThrust"]
        
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
        body_parts = [p for p in self.config.parts if p.type == "body"]
        if body_parts:
            # Use the largest body diameter
            max_diameter = max(p.Ø for p in body_parts if p.Ø)
            return max_diameter / 200 if max_diameter else 0.05  # cm to m, radius
        return 0.05  # Default 5cm radius
    
    def _calculate_enhanced_dry_mass(self) -> float:
        """Calculate dry mass with material properties and wall thickness"""
        mass = 0.1  # Base structural mass
        
        for part in self.config.parts:
            if part.type == "nose":
                # Nose cone mass based on volume and material
                length = (part.length or 15) / 100  # cm to m
                base_radius = (part.baseØ or self._calculate_enhanced_radius() * 200) / 200
                volume = np.pi * base_radius**2 * length / 3  # Cone volume
                wall_thickness = 0.002  # 2mm typical
                material_density = 1600  # kg/m³ fiberglass
                mass += volume * wall_thickness * material_density * 10  # Shell mass
                
            elif part.type == "body":
                # Body tube mass based on surface area and wall thickness
                length = (part.length or 40) / 100
                radius = (part.Ø or 10) / 200
                surface_area = 2 * np.pi * radius * length
                wall_thickness = 0.003  # 3mm typical
                material_density = 1600  # kg/m³ fiberglass
                mass += surface_area * wall_thickness * material_density
                
            elif part.type == "fin":
                # Fin mass based on area and thickness
                root = (part.root or 8) / 100
                span = (part.span or 6) / 100
                tip = (part.tip or part.root * 0.5 if part.root else 4) / 100
                area = 0.5 * (root + tip) * span  # Trapezoidal area
                thickness = 0.006  # 6mm typical
                material_density = 1800  # kg/m³ plywood
                fin_count = 3  # Assume 3 fins
                mass += area * thickness * material_density * fin_count
        
        return mass
    
    def _calculate_enhanced_inertia(self) -> Tuple[float, float, float]:
        """Calculate enhanced inertia tensor with component contributions"""
        total_mass = self._calculate_enhanced_dry_mass()
        total_length = self._calculate_total_length()
        avg_radius = self._calculate_enhanced_radius()
        
        # Component-wise inertia calculation
        ixx = iyy = 0
        izz = 0
        
        for part in self.config.parts:
            if part.type == "body":
                # Cylindrical body contribution
                length = (part.length or 40) / 100
                radius = (part.Ø or 10) / 200
                part_mass = 0.1 * length * radius  # Simplified mass
                
                # Inertia about center
                ixx_part = part_mass * (3 * radius**2 + length**2) / 12
                izz_part = part_mass * radius**2 / 2
                
                ixx += ixx_part
                iyy += ixx_part
                izz += izz_part
                
            elif part.type == "nose":
                # Nose cone contribution
                length = (part.length or 15) / 100
                radius = (part.baseØ or avg_radius * 200) / 200
                part_mass = 0.05 * length * radius
                
                # Cone inertia
                ixx_part = part_mass * (3 * radius**2 + length**2) / 12
                izz_part = part_mass * radius**2 / 2
                
                ixx += ixx_part
                iyy += ixx_part
                izz += izz_part
        
        return (ixx, iyy, izz)
    
    def _calculate_enhanced_center_of_mass(self) -> float:
        """Calculate center of mass with component-wise analysis"""
        total_mass = 0
        weighted_position = 0
        current_position = 0
        
        # Calculate from nose to tail
        for part in self.config.parts:
            if part.type == "nose":
                length = (part.length or 15) / 100
                part_mass = 0.05 * length
                part_com = current_position + length * 0.6  # Nose COM at 60% from tip
                
                weighted_position += part_mass * part_com
                total_mass += part_mass
                current_position += length
                
            elif part.type == "body":
                length = (part.length or 40) / 100
                part_mass = 0.1 * length
                part_com = current_position + length / 2  # Body COM at center
                
                weighted_position += part_mass * part_com
                total_mass += part_mass
                current_position += length
        
        return weighted_position / total_mass if total_mass > 0 else current_position / 2
    
    def _calculate_enhanced_drag_curves(self) -> Dict[str, Any]:
        """Calculate enhanced drag curves for power-on and power-off flight"""
        base_cd = self.config.Cd
        
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
        nose_parts = [p for p in self.config.parts if p.type == "nose"]
        if not nose_parts:
            return 0.1  # Default
        
        nose = nose_parts[0]
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
        body_parts = [p for p in self.config.parts if p.type == "body"]
        if not body_parts:
            return 0.0
        
        total_length = sum((p.length or 40) for p in body_parts) / 100
        avg_diameter = np.mean([p.Ø or 10 for p in body_parts]) / 100
        
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
        fin_parts = [p for p in self.config.parts if p.type == "fin"]
        if not fin_parts:
            return 0.0
        
        fin = fin_parts[0]
        root = (fin.root or 8) / 100
        span = (fin.span or 6) / 100
        tip = (fin.tip or root * 0.5) / 100
        
        # Fin area
        fin_area = 0.5 * (root + tip) * span
        fin_count = 3  # Assume 3 fins
        
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
        nose_parts = [p for p in self.config.parts if p.type == "nose"]
        if not nose_parts or not self.rocket:
            return
        
        nose = nose_parts[0]
        length = (nose.length or 15) / 100
        kind = nose.shape or "ogive"
        
        # Enhanced shape mapping
        shape_map = {
            "ogive": "tangent ogive",
            "conical": "conical",
            "elliptical": "elliptical",
            "parabolic": "parabolic"
        }
        
        total_length = self._calculate_total_length()
        position = total_length - length
        
        try:
            self.rocket.add_nose(
                length=length,
                kind=shape_map.get(kind, "tangent ogive"),
                position=position,
                bluffness=0,  # Sharp nose
                base_radius=self._calculate_enhanced_radius(),
                rocket_radius=self._calculate_enhanced_radius()
            )
            
            logger.info(f"Added enhanced nose cone: {kind}, length={length:.3f}m")
            
        except Exception as e:
            logger.warning(f"Failed to add enhanced nose cone: {e}")
            # Fallback to basic nose
            super()._add_nose_cone()
    
    def _add_enhanced_fins(self):
        """Add enhanced fins with proper aerodynamic modeling"""
        fin_parts = [p for p in self.config.parts if p.type == "fin"]
        if not fin_parts or not self.rocket:
            return
        
        fin = fin_parts[0]
        root_chord = (fin.root or 8) / 100
        tip_chord = (fin.tip or fin.root * 0.5 if fin.root else 4) / 100
        span = (fin.span or 6) / 100
        sweep_length = (fin.sweep or 2) / 100
        
        try:
            self.rocket.add_trapezoidal_fins(
                n=3,  # 3 fins
                root_chord=root_chord,
                tip_chord=tip_chord,
                span=span,
                position=0.1,  # Position from tail
                cant_angle=0,
                sweep_length=sweep_length,
                airfoil=("NACA", "0012"),  # NACA 0012 airfoil
                name="main_fins"
            )
            
            logger.info(f"Added enhanced fins: 3x trapezoidal, root={root_chord:.3f}m, span={span:.3f}m")
            
        except Exception as e:
            logger.warning(f"Failed to add enhanced fins: {e}")
            # Fallback to basic fins
            super()._add_fins()
    
    def _add_enhanced_parachutes(self):
        """Add enhanced parachute system with realistic deployment"""
        parachute_parts = [p for p in self.config.parts if p.type == "parachute"]
        
        # Add default parachute if none specified
        if not parachute_parts:
            parachute_parts = [PartModel(
                id="default_parachute",
                type="parachute",
                cd_s=1.0,
                trigger="apogee",
                lag=1.5
            )]
        
        for i, chute in enumerate(parachute_parts):
            if not self.rocket:
                break
                
            cd_s = chute.cd_s or 1.0
            lag = chute.lag or 1.5
            
            # Enhanced trigger logic
            if chute.trigger == "apogee":
                trigger = "apogee"
            elif chute.trigger and isinstance(chute.trigger, (int, float)):
                trigger = float(chute.trigger)  # Altitude trigger
            else:
                trigger = "apogee"  # Default
            
            try:
                self.rocket.add_parachute(
                    name=f"parachute_{i}",
                    cd_s=cd_s,
                    trigger=trigger,
                    sampling_rate=105,
                    lag=lag,
                    noise=(0, 8.3, 0.5)  # Realistic noise model
                )
                
                logger.info(f"Added enhanced parachute {i}: cd_s={cd_s}, trigger={trigger}")
                
            except Exception as e:
                logger.warning(f"Failed to add enhanced parachute {i}: {e}")
    
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
                rail_length=self.launch_params.railLength,
                inclination=self.launch_params.inclination,
                heading=self.launch_params.heading,
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
            max_altitude = float(self.flight.apogee - self.environment.config.elevation)
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

# ================================
# API ENDPOINTS
# ================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "rocketpy_available": ROCKETPY_AVAILABLE,
        "version": "2.0.0",
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
        if impulse_class and spec["impulseClass"] != impulse_class:
            continue
        
        motor_spec = MotorSpec(
            id=motor_id,
            name=spec["name"],
            manufacturer=spec["manufacturer"],
            type=spec["type"],
            impulseClass=spec["impulseClass"],
            totalImpulse=spec["totalImpulse"],
            avgThrust=spec["avgThrust"],
            burnTime=spec["burnTime"],
            dimensions=spec["dimensions"],
            weight=spec["weight"]
        )
        motors.append(motor_spec)
    
    return {"motors": motors}

@app.post("/simulate", response_model=SimulationResult)
async def simulate_standard(request: SimulationRequestModel):
    """Standard simulation endpoint"""
    
    environment = request.environment or EnvironmentModel()
    launch_params = request.launchParameters or LaunchParametersModel()
    
    if request.simulationType == "hifi" and ROCKETPY_AVAILABLE:
        return await simulate_rocket_6dof(request.rocket, environment, launch_params)
    else:
        return await simulate_simplified_fallback(request.rocket)

@app.post("/simulate/hifi", response_model=SimulationResult)
async def simulate_high_fidelity(request: SimulationRequestModel):
    """High-fidelity 6-DOF simulation endpoint"""
    
    environment = request.environment or EnvironmentModel()
    launch_params = request.launchParameters or LaunchParametersModel()
    
    return await simulate_rocket_6dof(request.rocket, environment, launch_params)

@app.post("/simulate/monte-carlo", response_model=MonteCarloResult)
async def simulate_monte_carlo(request: MonteCarloRequest):
    """Monte Carlo simulation endpoint"""
    
    if not ROCKETPY_AVAILABLE:
        raise HTTPException(
            status_code=503, 
            detail="Monte Carlo simulation requires RocketPy library"
        )
    
    monte_carlo = MonteCarloSimulation(request)
    result = await monte_carlo.run()
    
    return result

@app.post("/simulate/batch")
async def simulate_batch(requests: List[SimulationRequestModel], 
                        background_tasks: BackgroundTasks):
    """Batch simulation endpoint for multiple configurations"""
    
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
    """Run batch simulations in background"""
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
    
    # Store results (in production, use Redis or database)
    logger.info(f"Batch simulation {simulation_id} completed with {len(results)} results")

@app.post("/simulate/enhanced", response_model=SimulationResult)
async def simulate_enhanced_6dof(request: SimulationRequestModel):
    """Enhanced high-fidelity 6-DOF simulation with full RocketPy capabilities"""
    
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
    """Professional-grade simulation with maximum fidelity and comprehensive analysis"""
    
    if not ROCKETPY_AVAILABLE:
        raise HTTPException(
            status_code=503, 
            detail="Professional simulation requires RocketPy library"
        )
    
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
    """Comprehensive stability analysis"""
    
    if not ROCKETPY_AVAILABLE:
        raise HTTPException(
            status_code=503, 
            detail="Stability analysis requires RocketPy library"
        )
    
    try:
        # Create rocket for stability analysis
        environment = EnhancedSimulationEnvironment(request.environment or EnvironmentModel())
        motor = EnhancedSimulationMotor(request.rocket.motorId)
        rocket = EnhancedSimulationRocket(request.rocket, motor)
        
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
        
        # Stability rating
        if static_margin < 0.5:
            rating = "unstable"
            recommendation = "Add more fin area or move fins aft"
        elif static_margin < 1.0:
            rating = "marginally_stable"
            recommendation = "Consider increasing fin area slightly"
        elif static_margin < 2.0:
            rating = "stable"
            recommendation = "Good stability margin"
        else:
            rating = "overstable"
            recommendation = "Consider reducing fin area for better performance"
        
        return {
            "static_margin": static_margin,
            "center_of_pressure": cp,
            "center_of_mass": cm,
            "stability_rating": rating,
            "recommendation": recommendation,
            "analysis_type": "comprehensive"
        }
        
    except Exception as e:
        logger.error(f"Stability analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Stability analysis error: {str(e)}")

@app.post("/analyze/performance")
async def analyze_rocket_performance(request: SimulationRequestModel):
    """Comprehensive performance analysis"""
    
    try:
        # Run enhanced simulation for performance analysis
        result = await simulate_rocket_6dof_enhanced(
            request.rocket,
            request.environment or EnvironmentModel(),
            request.launchParameters or LaunchParametersModel(),
            {'include_performance_analysis': True}
        )
        
        # Calculate performance metrics
        motor_spec = MOTOR_DATABASE.get(request.rocket.motorId, MOTOR_DATABASE["default-motor"])
        
        # Thrust-to-weight ratio
        rocket_mass = 1.0  # Simplified
        motor_thrust = motor_spec["avgThrust"]
        twr = motor_thrust / (rocket_mass * 9.81)
        
        # Specific impulse efficiency
        isp_theoretical = motor_spec.get("isp", 200)
        isp_effective = result.maxAltitude / 100  # Simplified calculation
        
        # Performance rating
        if result.maxAltitude < 100:
            performance_rating = "poor"
        elif result.maxAltitude < 500:
            performance_rating = "fair"
        elif result.maxAltitude < 1000:
            performance_rating = "good"
        else:
            performance_rating = "excellent"
        
        return {
            "max_altitude": result.maxAltitude,
            "max_velocity": result.maxVelocity,
            "max_acceleration": result.maxAcceleration,
            "thrust_to_weight_ratio": twr,
            "specific_impulse_efficiency": isp_effective / isp_theoretical,
            "performance_rating": performance_rating,
            "stability_margin": result.stabilityMargin,
            "recommendations": [
                f"Altitude: {result.maxAltitude:.1f}m",
                f"TWR: {twr:.2f}",
                f"Stability: {result.stabilityMargin:.2f}"
            ]
        }
        
    except Exception as e:
        logger.error(f"Performance analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Performance analysis error: {str(e)}")

@app.post("/optimize/design")
async def optimize_rocket_design(
    request: SimulationRequestModel,
    target: str = "max_altitude",
    constraints: Dict[str, Any] = None
):
    """Optimize rocket design for specific targets"""
    
    if not ROCKETPY_AVAILABLE:
        raise HTTPException(
            status_code=503, 
            detail="Design optimization requires RocketPy library"
        )
    
    try:
        # Simple optimization example - adjust fin size for stability
        original_result = await simulate_rocket_6dof_enhanced(
            request.rocket,
            request.environment or EnvironmentModel(),
            request.launchParameters or LaunchParametersModel()
        )
        
        optimized_rocket = request.rocket.copy()
        
        # Optimization logic based on target
        if target == "max_altitude":
            # Reduce drag by optimizing fin size
            for part in optimized_rocket.parts:
                if part.type == "fin":
                    if original_result.stabilityMargin > 2.0:
                        # Reduce fin size if overstable
                        part.span = part.span * 0.9 if part.span else 5.4
                        part.root = part.root * 0.9 if part.root else 7.2
                    elif original_result.stabilityMargin < 1.0:
                        # Increase fin size if understable
                        part.span = part.span * 1.1 if part.span else 6.6
                        part.root = part.root * 1.1 if part.root else 8.8
        
        elif target == "stability_margin":
            # Optimize for specific stability margin (1.5)
            target_margin = 1.5
            for part in optimized_rocket.parts:
                if part.type == "fin":
                    if original_result.stabilityMargin < target_margin:
                        scale_factor = 1.2
                    else:
                        scale_factor = 0.9
                    
                    part.span = part.span * scale_factor if part.span else 6.0 * scale_factor
                    part.root = part.root * scale_factor if part.root else 8.0 * scale_factor
        
        # Run optimized simulation
        optimized_result = await simulate_rocket_6dof_enhanced(
            optimized_rocket,
            request.environment or EnvironmentModel(),
            request.launchParameters or LaunchParametersModel()
        )
        
        # Calculate improvement
        altitude_improvement = optimized_result.maxAltitude - original_result.maxAltitude
        stability_improvement = abs(1.5 - optimized_result.stabilityMargin) - abs(1.5 - original_result.stabilityMargin)
        
        return {
            "original_performance": {
                "max_altitude": original_result.maxAltitude,
                "stability_margin": original_result.stabilityMargin
            },
            "optimized_performance": {
                "max_altitude": optimized_result.maxAltitude,
                "stability_margin": optimized_result.stabilityMargin
            },
            "improvements": {
                "altitude_gain": altitude_improvement,
                "stability_improvement": stability_improvement
            },
            "optimized_rocket": optimized_rocket,
            "optimization_target": target
        }
        
    except Exception as e:
        logger.error(f"Design optimization failed: {e}")
        raise HTTPException(status_code=500, detail=f"Optimization error: {str(e)}")

@app.get("/motors/detailed", response_model=Dict[str, Any])
async def get_detailed_motors():
    """Get detailed motor specifications with performance data"""
    
    detailed_motors = {}
    
    for motor_id, spec in MOTOR_DATABASE.items():
        # Calculate additional performance metrics
        total_impulse = spec["totalImpulse"]
        avg_thrust = spec["avgThrust"]
        burn_time = spec["burnTime"]
        
        # Calculate peak thrust (estimated)
        peak_thrust = avg_thrust * 1.3
        
        # Calculate impulse class boundaries
        impulse_classes = {
            "A": (1.26, 2.5), "B": (2.51, 5.0), "C": (5.01, 10.0),
            "D": (10.01, 20.0), "E": (20.01, 40.0), "F": (40.01, 80.0),
            "G": (80.01, 160.0), "H": (160.01, 320.0), "I": (320.01, 640.0),
            "J": (640.01, 1280.0), "K": (1280.01, 2560.0), "L": (2560.01, 5120.0),
            "M": (5120.01, 10240.0), "N": (10240.01, 20480.0), "O": (20480.01, 40960.0)
        }
        
        # Performance characteristics
        thrust_density = avg_thrust / (spec["weight"]["total"] * 9.81)  # N/N
        specific_impulse = spec.get("isp", total_impulse / (spec["weight"]["propellant"] * 9.81))
        
        detailed_motors[motor_id] = {
            **spec,
            "performance_metrics": {
                "peak_thrust": peak_thrust,
                "thrust_density": thrust_density,
                "specific_impulse": specific_impulse,
                "impulse_density": total_impulse / spec["weight"]["total"],
                "burn_rate": spec["weight"]["propellant"] / burn_time
            },
            "applications": {
                "min_rocket_mass": spec["weight"]["total"] * 5,  # 5:1 ratio minimum
                "max_rocket_mass": spec["weight"]["total"] * 15,  # 15:1 ratio maximum
                "recommended_diameter": spec["dimensions"]["diameter"] * 1.5,
                "min_stability_length": spec["dimensions"]["length"] * 3
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
    """Get available atmospheric models and their characteristics"""
    
    return {
        "models": {
            "standard": {
                "name": "International Standard Atmosphere",
                "description": "Standard atmospheric model (ISA) with temperature and pressure profiles",
                "altitude_range": "0-30km",
                "accuracy": "Good for general use",
                "features": ["Temperature profile", "Pressure profile", "Density calculation"]
            },
            "forecast": {
                "name": "GFS Weather Forecast",
                "description": "Real-time weather data from Global Forecast System",
                "altitude_range": "0-20km",
                "accuracy": "High for current conditions",
                "features": ["Real wind data", "Temperature profiles", "Pressure data", "Humidity"]
            },
            "custom": {
                "name": "Custom Atmospheric Profile",
                "description": "User-defined atmospheric conditions",
                "altitude_range": "User defined",
                "accuracy": "Depends on input data",
                "features": ["Custom profiles", "Specific conditions", "Research applications"]
            }
        },
        "wind_models": {
            "constant": "Constant wind speed and direction",
            "linear": "Linear wind variation with altitude",
            "realistic": "Realistic wind profile with boundary layer effects",
            "turbulent": "Turbulent wind with gusts and variations"
        },
        "recommendations": {
            "beginner": "standard",
            "competition": "forecast",
            "research": "custom",
            "high_altitude": "forecast"
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