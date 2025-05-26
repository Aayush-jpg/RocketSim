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
                simulationFidelity="hifi_6dof",
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