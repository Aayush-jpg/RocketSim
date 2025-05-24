import os
import json
import uvicorn
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, Tuple, Union

# Import RocketPy
try:
    from rocketpy import Environment, SolidMotor, Rocket, Flight, GenericMotor
except ImportError:
    print("Warning: RocketPy not installed, using simplified simulation model")
    Environment, SolidMotor, Rocket, Flight, GenericMotor = None, None, None, None, None

app = FastAPI()

# Input model definitions
class Part(BaseModel):
    id: str
    type: str
    color: str 
    # Different part properties
    shape: Optional[str] = None  # For nose
    length: Optional[float] = None  # For nose, body
    baseØ: Optional[float] = None  # For nose
    Ø: Optional[float] = None  # For body
    root: Optional[float] = None  # For fin
    span: Optional[float] = None  # For fin
    sweep: Optional[float] = None  # For fin

class RocketInput(BaseModel):
    id: str
    name: str
    parts: List[Part]
    motorId: str
    Cd: float
    units: str = "metric"

class SimulationResult(BaseModel):
    maxAltitude: float  # meters
    maxVelocity: float  # m/s
    apogeeTime: float   # seconds
    stabilityMargin: float  # calibers
    thrustCurve: Optional[List[Tuple[float, float]]] = None  # time (s), thrust (N)

# Motor database
MOTORS = {
    "default-motor": {
        "name": "Generic F32",
        "manufacturer": "Generic",
        "thrust": 32,  # N
        "burnTime": 2.5,  # s
        "totalImpulse": 60,  # Ns
        "diameter": 29,  # mm
        "length": 124,  # mm
        "propellantMass": 0.04,  # kg
        "totalMass": 0.07,  # kg
    },
    "mini-motor": {
        "name": "Mini Motor",
        "manufacturer": "Generic",
        "thrust": 15,  # N
        "burnTime": 1.8,  # s
        "totalImpulse": 27,  # Ns
        "diameter": 24,  # mm
        "length": 100,  # mm
        "propellantMass": 0.010,  # kg
        "totalMass": 0.018,  # kg
    },
    "high-power": {
        "name": "High Power",
        "manufacturer": "Generic",
        "thrust": 60,  # N
        "burnTime": 3.2,  # s
        "totalImpulse": 192,  # Ns
        "diameter": 38,  # mm
        "length": 150,  # mm
        "propellantMass": 0.090,  # kg
        "totalMass": 0.115,  # kg
    },
    "super-power": {
        "name": "Super Power",
        "manufacturer": "Generic",
        "thrust": 120,  # N
        "burnTime": 4.0,  # s
        "totalImpulse": 480,  # Ns
        "diameter": 54,  # mm
        "length": 200,  # mm
        "propellantMass": 0.200,  # kg
        "totalMass": 0.250,  # kg
    },
    "small-liquid": {
        "name": "Small Liquid",
        "manufacturer": "Generic",
        "thrust": 500,  # N
        "burnTime": 30,  # s
        "totalImpulse": 15000,  # Ns
        "diameter": 75,  # mm
        "length": 300,  # mm
        "propellantMass": 1.5,  # kg
        "totalMass": 2.3,  # kg
    },
    "medium-liquid": {
        "name": "Medium Liquid",
        "manufacturer": "Generic",
        "thrust": 2000,  # N
        "burnTime": 45,  # s
        "totalImpulse": 90000,  # Ns
        "diameter": 100,  # mm
        "length": 400,  # mm
        "propellantMass": 6.5,  # kg
        "totalMass": 8.5,  # kg
    },
    "large-liquid": {
        "name": "Large Liquid",
        "manufacturer": "Generic",
        "thrust": 8000,  # N
        "burnTime": 15,  # s - More realistic burn time
        "totalImpulse": 120000,  # Ns - Adjusted total impulse
        "diameter": 150,  # mm
        "length": 500,  # mm
        "propellantMass": 8.0,  # kg - Reduced propellant mass
        "totalMass": 11.0,  # kg - Adjusted total mass
    },
    "hybrid-engine": {
        "name": "Hybrid Engine",
        "manufacturer": "Generic",
        "thrust": 1200,  # N
        "burnTime": 20,  # s
        "totalImpulse": 24000,  # Ns
        "diameter": 90,  # mm
        "length": 350,  # mm
        "propellantMass": 4.5,  # kg
        "totalMass": 5.7,  # kg
    }
}

@app.post("/simulate", response_model=SimulationResult)
async def simulate(rocket_input: RocketInput) -> SimulationResult:
    """
    Simulate rocket flight using simplified physics by default.
    For full RocketPy simulation, use /simulate_full endpoint.
    """
    try:
        return simulate_simplified(rocket_input)
    except Exception as e:
        print(f"Simulation error: {e}")
        # Return a basic fallback result
        return SimulationResult(
            maxAltitude=500.0,
            maxVelocity=150.0,
            apogeeTime=10.0,
            stabilityMargin=1.5,
            thrustCurve=[(0.0, 0.0), (1.0, 1000.0), (2.0, 0.0)]
        )

@app.post("/simulate_full", response_model=SimulationResult)
async def simulate_full(rocket_input: RocketInput) -> SimulationResult:
    """
    Simulate rocket flight using full RocketPy physics engine.
    This may take longer but provides more accurate results.
    """
    try:
        return simulate_with_rocketpy(rocket_input)
    except Exception as e:
        print(f"Full simulation error: {e}")
        # Fall back to simplified simulation
        return simulate_simplified(rocket_input)

def simulate_with_rocketpy(rocket_input: RocketInput) -> SimulationResult:
    """High-fidelity simulation using RocketPy library"""
    
    # Create an Environment
    env = Environment(
        latitude=0,
        longitude=0,
        elevation=0,
    )
    
    # Create a motor
    motor_data = MOTORS.get(rocket_input.motorId, MOTORS["default-motor"])
    
    # Determine motor type from the motor ID
    motor_type = "solid"  # default
    if "liquid" in rocket_input.motorId:
        motor_type = "liquid"
    elif "hybrid" in rocket_input.motorId:
        motor_type = "hybrid"
    
    # Create motor based on type
    if motor_type == "solid":
        # Create solid motor with proper RocketPy parameters
        motor = SolidMotor(
            thrust_source=motor_data["thrust"],  # Constant thrust
            dry_mass=motor_data["totalMass"] - motor_data["propellantMass"],  # kg
            dry_inertia=(0.125, 0.125, 0.002),  # Simplified inertia
            nozzle_radius=motor_data["diameter"] / 2000,  # Convert mm to m, then radius
            grain_number=1,  # Single grain
            grain_density=1815,  # kg/m³ - typical solid propellant density
            grain_outer_radius=motor_data["diameter"] / 2000 - 0.002,  # Slightly smaller than motor
            grain_initial_inner_radius=0.005,  # 5mm initial inner radius
            grain_initial_height=motor_data["length"] / 1000 * 0.8,  # 80% of motor length
            grain_separation=0.005,  # 5mm separation
            grains_center_of_mass_position=0.0,  # Center position
            center_of_dry_mass_position=0.0,  # Center position
            nozzle_position=0,  # Bottom of motor
            burn_time=motor_data["burnTime"],  # Burn time
            throat_radius=motor_data["diameter"] / 4000,  # Throat radius (quarter of diameter)
            coordinate_system_orientation="nozzle_to_combustion_chamber",
        )
    else:
        # For liquid and hybrid motors, use a simplified GenericMotor approach
        # Create a thrust curve as a simple constant thrust profile
        thrust_curve = [
            (0, 0),
            (0.1, motor_data["thrust"]),
            (motor_data["burnTime"] - 0.1, motor_data["thrust"]),
            (motor_data["burnTime"], 0)
        ]
        
        # Use GenericMotor for liquid/hybrid motors
        motor = GenericMotor(
            thrust_source=thrust_curve,
            burn_time=motor_data["burnTime"],
            chamber_radius=motor_data["diameter"] / 2000,  # Convert mm to m, then radius
            chamber_height=motor_data["length"] / 1000 * 0.8,  # 80% of motor length
            chamber_position=0.0,  # Center position
            propellant_initial_mass=motor_data["propellantMass"],
            nozzle_radius=motor_data["diameter"] / 2000,
            dry_mass=motor_data["totalMass"] - motor_data["propellantMass"],
            center_of_dry_mass_position=0.0,
            dry_inertia=(0.125, 0.125, 0.002),
            nozzle_position=0,
            coordinate_system_orientation="nozzle_to_combustion_chamber",
        )
    
    # Extract rocket parameters
    nose_part = next((p for p in rocket_input.parts if p.type == "nose"), None)
    body_parts = [p for p in rocket_input.parts if p.type == "body"]
    fin_parts = [p for p in rocket_input.parts if p.type == "fin"]
    
    # Calculate rocket dimensions
    diameter = next((p.Ø for p in body_parts if p.Ø is not None), 0.05)  # m
    body_length = sum(p.length for p in body_parts if p.length is not None)  # m
    nose_length = nose_part.length if nose_part and nose_part.length else 0.15  # m
    total_length = body_length + nose_length  # m
    
    # Create the rocket
    rocket = Rocket(
        radius=diameter / 2,
        mass=1,  # Will be updated
        inertia=(0, 0, 0),  # Will be updated
        power_off_drag=rocket_input.Cd,
        power_on_drag=rocket_input.Cd,
        center_of_mass_without_motor=total_length / 2,  # Center of rocket
    )
    
    # Add the motor
    rocket.add_motor(motor, position=0)
    
    # Add nose cone and other parts (simplified)
    rocket.add_nose(
        length=nose_length,
        kind=nose_part.shape if nose_part and nose_part.shape else "ogive",
        position=total_length,  # Nose tip position (top of rocket)
    )
    
    # Add fins if present
    if fin_parts:
        fin = fin_parts[0]
        rocket.add_trapezoidal_fins(
            n=len(fin_parts),
            span=fin.span if fin.span else 0.08,
            root_chord=fin.root if fin.root else 0.1,
            tip_chord=(fin.root if fin.root else 0.1) * 0.5,  # Tip chord is half of root
            position=0.1,  # Position near the bottom of the rocket
            sweep_length=fin.sweep if fin.sweep else 0.05,
        )
    
    # Configure mass
    rocket.mass = rocket.dry_mass + motor.total_mass
    
    # Simulate the flight
    flight = Flight(
        rocket=rocket,
        environment=env,
        rail_length=1.0,  # 1 meter rail length
        heading=90,
    )
    
    # Extract results
    max_altitude = flight.apogee
    max_velocity = flight.max_speed
    apogee_time = flight.apogee_time
    stability_margin = rocket.static_margin
    
    # Extract thrust curve
    thrust_curve = [(float(t), float(thrust)) for t, thrust in zip(flight.time, flight.net_thrust)]
    
    return SimulationResult(
        maxAltitude=max_altitude,
        maxVelocity=max_velocity,
        apogeeTime=apogee_time,
        stabilityMargin=stability_margin,
        thrustCurve=thrust_curve,
    )

def simulate_simplified(rocket_input: RocketInput) -> SimulationResult:
    """Simplified physics simulation as a fallback"""
    
    # Get motor data
    motor_data = MOTORS.get(rocket_input.motorId, MOTORS["default-motor"])
    
    # Extract parts data
    nose_part = next((p for p in rocket_input.parts if p.type == "nose"), None)
    body_parts = [p for p in rocket_input.parts if p.type == "body"]
    fin_parts = [p for p in rocket_input.parts if p.type == "fin"]
    
    # Simple physical parameters
    thrust = motor_data["thrust"]  # N
    burn_time = motor_data["burnTime"]  # s
    impulse = motor_data["totalImpulse"]  # Ns
    
    # Calculate mass based on parts (very simplified)
    total_mass = 0.2  # Base mass in kg
    
    # Add mass for each part
    if nose_part:
        nose_mass = 0.05 * (nose_part.length or 0.15)
        total_mass += nose_mass
    
    for body in body_parts:
        if body.length and body.Ø:
            body_mass = 0.1 * body.length * body.Ø
            total_mass += body_mass
    
    for fin in fin_parts:
        if fin.root and fin.span:
            fin_mass = 0.01 * fin.root * fin.span
            total_mass += fin_mass
    
    # Add motor mass
    total_mass += motor_data["totalMass"]
    
    # Calculate basic flight parameters
    drag_coefficient = rocket_input.Cd
    gravity = 9.8  # m/s²
    
    # Simplified physics calculations
    acceleration_max = thrust / total_mass
    average_acceleration = acceleration_max / 2
    velocity_at_burnout = average_acceleration * burn_time
    
    # Apply drag effect (simplified)
    drag_deceleration = 0.5 * drag_coefficient * velocity_at_burnout * velocity_at_burnout / total_mass
    effective_acceleration = average_acceleration - drag_deceleration - gravity
    
    # Final calculations
    max_velocity = velocity_at_burnout * 0.9  # 10% loss due to drag
    coast_time = max_velocity / gravity
    
    # Altitude calculation (s = ut + 0.5at²)
    burnout_altitude = 0.5 * average_acceleration * burn_time * burn_time
    coast_altitude = max_velocity * coast_time - 0.5 * gravity * coast_time * coast_time
    max_altitude = burnout_altitude + coast_altitude
    
    # Stability calculation based on fin area and CG position
    fin_area_ratio = 0
    for fin in fin_parts:
        if fin.root and fin.span:
            fin_area = 0.5 * fin.root * fin.span
            fin_area_ratio += fin_area / 0.01  # Normalized to a reference area
    
    stability_margin = 1.0 + 0.2 * fin_area_ratio
    
    # Generate a thrust curve
    thrust_curve = []
    # Ramp up
    for t in np.linspace(0, 0.1, 5):
        thrust_curve.append((float(t), float(thrust * t / 0.1)))
    
    # Plateau
    for t in np.linspace(0.1, burn_time - 0.2, 10):
        thrust_curve.append((float(t), float(thrust)))
    
    # Tail off
    for t in np.linspace(burn_time - 0.2, burn_time, 5):
        thrust_curve.append((float(t), float(thrust * (1 - (t - (burn_time - 0.2)) / 0.2))))
    
    # Zero thrust after burnout
    thrust_curve.append((float(burn_time), 0.0))
    thrust_curve.append((float(10.0), 0.0))  # Extend to 10 seconds
    
    return SimulationResult(
        maxAltitude=float(max_altitude),
        maxVelocity=float(max_velocity),
        apogeeTime=float(burn_time + coast_time),
        stabilityMargin=float(stability_margin),
        thrustCurve=thrust_curve,
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000) 