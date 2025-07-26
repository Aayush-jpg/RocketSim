"""
Core simulation engine functions.

This module provides the primary simulation functions for rocket flight
simulation including standard 6-DOF and simplified fallback simulations.
"""

import asyncio
import numpy as np
from concurrent.futures import ThreadPoolExecutor
from typing import Optional, Dict, Any

from config import ROCKETPY_AVAILABLE, MOTOR_DATABASE, logger
from models.rocket import RocketModel
from models.environment import EnvironmentModel, LaunchParametersModel
from models.simulation import SimulationResult
from .core.environment import SimulationEnvironment
from .core.motor import SimulationMotor
from .core.rocket import SimulationRocket
from .core.flight import SimulationFlight

# Thread pool executor for non-blocking simulation execution
executor = ThreadPoolExecutor(max_workers=4)

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
    motor = SimulationMotor(rocket_config.motor.motor_database_id)
    rocket = SimulationRocket(rocket_config, motor)
    flight = SimulationFlight(rocket, environment, launch_params)
    
    if flight.results:
        # ✅ ADDED: Explicitly populate flightEvents for standard simulation
        if not flight.results.flightEvents:
            flight.results.flightEvents = flight._extract_events()
            
        logger.info(f"STANDARD SIMULATION RESULT: {flight.results.dict()}")
        return flight.results
    else:
        raise Exception("Simulation failed to produce results")

async def simulate_simplified_fallback(rocket_config: RocketModel) -> SimulationResult:
    """Simplified physics fallback simulation"""
    
    # Get motor data using correct motor ID field
    motor_id = rocket_config.motor.motor_database_id
    if motor_id not in MOTOR_DATABASE:
        logger.error(f"❌ Invalid motor ID '{motor_id}' from frontend - motor not found in database")
        available_motors = list(MOTOR_DATABASE.keys())
        raise ValueError(f"Motor ID '{motor_id}' not found. Available motors: {available_motors}")
    motor_spec = MOTOR_DATABASE[motor_id]
    
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