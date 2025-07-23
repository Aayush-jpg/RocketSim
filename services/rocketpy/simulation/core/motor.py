"""
Core simulation motor class.

This module provides the SimulationMotor class which handles creation of
different motor types (solid, liquid, hybrid) with proper thrust curves.
"""

import numpy as np
from typing import List, Tuple, Dict, Any

from config import ROCKETPY_AVAILABLE, MOTOR_DATABASE, logger, dbg_enter, dbg_exit

if ROCKETPY_AVAILABLE:
    from rocketpy import SolidMotor, LiquidMotor, GenericMotor, Fluid, CylindricalTank, MassFlowRateBasedTank

class SimulationMotor:
    """Enhanced motor wrapper supporting multiple motor types"""
    
    def __init__(self, motor_id: str):
        dbg_enter("SimulationMotor.__init__", motor_id=motor_id)
        self.motor_id = motor_id
        # ✅ FIXED: Validate frontend motor ID instead of silent fallback
        if motor_id not in MOTOR_DATABASE:
            if motor_id != "default-motor":
                logger.error(f"❌ Invalid motor ID '{motor_id}' from frontend - motor not found in database")
                available_motors = list(MOTOR_DATABASE.keys())
                raise ValueError(f"Motor ID '{motor_id}' not found. Available motors: {available_motors}")
        self.spec = MOTOR_DATABASE[motor_id]
        self.motor = None
        
        if not ROCKETPY_AVAILABLE:
            dbg_exit("SimulationMotor.__init__", reason="RocketPy not available")
            return
        
        self._create_motor()
        dbg_exit("SimulationMotor.__init__", motor_type=self.spec.get("type"))
    
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
            nozzle_radius=self.spec["dimensions"]["outer_diameter_m"] / 2,
            grain_number=1,
            grain_density=1815,  # kg/m³
            grain_outer_radius=self.spec["dimensions"]["outer_diameter_m"] / 2 - 0.002,
            grain_initial_inner_radius=0.005,
            grain_initial_height=self.spec["dimensions"]["length_m"] * 0.8,
            grain_separation=0.005,  # 5mm separation between grains
            grains_center_of_mass_position=0.5,  # Center of motor
            center_of_dry_mass_position=0.5,  # Center of dry mass
            nozzle_position=0,
            burn_time=self.spec["burn_time_s"]
        )
    
    def _create_liquid_motor(self):
        """Create liquid motor with staged combustion"""
        thrust_curve = self._generate_liquid_thrust_curve()
        
        propellant_total_mass = self.spec["mass"]["propellant_kg"]
        
        # ✅ FIXED: Use proper RocketPy tank pattern to prevent division by zero
        try:
            # Calculate propellant ratios
            oxidizer_ratio = 0.7  # 70% oxidizer (typical for N2O/Ethanol)
            fuel_ratio = 0.3      # 30% fuel
            oxidizer_mass_kg = propellant_total_mass * oxidizer_ratio
            fuel_mass_kg = propellant_total_mass * fuel_ratio
            
            # Motor dimensions
            motor_length = self.spec["dimensions"]["length_m"]
            motor_radius = self.spec["dimensions"]["outer_diameter_m"] / 2
            tank_radius = motor_radius * 0.8  # Tanks fit inside motor
            
            # CRITICAL FIX: Calculate tank height to accommodate gas volume
            # Gas volume must be < tank total volume
            required_gas_volume = 0.005  # From RocketPy error logs
            tank_cross_section = 3.14159 * tank_radius**2
            min_tank_height = (required_gas_volume / tank_cross_section) * 2.5  # 2.5x safety factor
            tank_height = max(motor_length * 0.6, min_tank_height)
            
            logger.info(f"🔧 Tank sizing: radius={tank_radius:.3f}m, height={tank_height:.3f}m, volume={tank_cross_section * tank_height:.6f}m³")
            
            # Define fluids
            oxidizer_liq = Fluid(name="N2O_l", density=1220)
            oxidizer_gas = Fluid(name="N2O_g", density=1.9277)
            fuel_liq = Fluid(name="ethanol_l", density=789)
            fuel_gas = Fluid(name="ethanol_g", density=1.59)
            
            # Define tank geometry with proper height calculation
            tank_geometry = CylindricalTank(radius=tank_radius, height=tank_height, spherical_caps=True)
            
            # CRITICAL FIX: Calculate safe gas mass to prevent overfill
            # Gas mass must correspond to volume that fits in tank
            safe_gas_mass = 0.001  # Reduced from 0.01 to prevent overfill
            
            # Create oxidizer tank
            oxidizer_tank = MassFlowRateBasedTank(
                name="oxidizer tank",
                geometry=tank_geometry,
                flux_time=self.spec["burn_time_s"],
                initial_liquid_mass=oxidizer_mass_kg,
                initial_gas_mass=safe_gas_mass,  # Reduced gas mass
                liquid_mass_flow_rate_in=0,
                liquid_mass_flow_rate_out=lambda t: oxidizer_mass_kg / self.spec["burn_time_s"],  # Constant flow
                gas_mass_flow_rate_in=0,
                gas_mass_flow_rate_out=0,
                liquid=oxidizer_liq,
                gas=oxidizer_gas,
            )
            
            # Create fuel tank
            fuel_tank = MassFlowRateBasedTank(
                name="fuel tank",
                geometry=tank_geometry,
                flux_time=self.spec["burn_time_s"],
                initial_liquid_mass=fuel_mass_kg,
                initial_gas_mass=safe_gas_mass,  # Reduced gas mass
                liquid_mass_flow_rate_in=0,
                liquid_mass_flow_rate_out=lambda t: fuel_mass_kg / self.spec["burn_time_s"],  # Constant flow
                gas_mass_flow_rate_in=0,
                gas_mass_flow_rate_out=0,
                liquid=fuel_liq,
                gas=fuel_gas,
            )
            
            # Create liquid motor with minimal required parameters
            self.motor = LiquidMotor(
                thrust_source=thrust_curve,
                dry_mass=self.spec["mass"]["total_kg"] - propellant_total_mass,
                dry_inertia=(0.2, 0.2, 0.002),
                nozzle_radius=self.spec["dimensions"]["outer_diameter_m"] / 4,
                center_of_dry_mass_position=self.spec["dimensions"]["length_m"] / 2,
                nozzle_position=0.0,
                burn_time=self.spec["burn_time_s"]
            )
            
            # ✅ CRITICAL: Add tanks to prevent division by zero
            self.motor.add_tank(tank=oxidizer_tank, position=motor_length * 0.6)
            self.motor.add_tank(tank=fuel_tank, position=motor_length * 0.4)
            
            logger.info(f"✅ Created liquid motor with propellant: {propellant_total_mass:.1f}kg")
            
        except Exception as e:
            logger.warning(f"Liquid motor creation failed: {e}")
            # Fallback to SolidMotor if LiquidMotor fails
            logger.info("🔄 Falling back to solid motor equivalent")
            self._create_solid_motor_fallback(thrust_curve, propellant_total_mass)
    
    def _create_solid_motor_fallback(self, thrust_curve, propellant_mass):
        """Fallback to solid motor when liquid motor fails"""
        try:
            # ✅ FIXED: Add all required parameters for SolidMotor
            self.motor = SolidMotor(
                thrust_source=thrust_curve,
                dry_mass=self.spec["mass"]["total_kg"] - propellant_mass,
                dry_inertia=(0.2, 0.2, 0.002),
                nozzle_radius=self.spec["dimensions"]["outer_diameter_m"] / 4,
                grain_number=1,
                grain_density=1815,  # APCP density
                grain_outer_radius=self.spec["dimensions"]["outer_diameter_m"] / 2 - 0.005,
                grain_initial_inner_radius=0.015,
                grain_initial_height=self.spec["dimensions"]["length_m"] * 0.6,
                nozzle_position=0.0,
                burn_time=self.spec["burn_time_s"],
                # ✅ ADD: Missing required parameters
                grain_separation=0.005,  # 5mm separation between grains
                grains_center_of_mass_position=self.spec["dimensions"]["length_m"] * 0.3,  # 30% from nose
                center_of_dry_mass_position=self.spec["dimensions"]["length_m"] / 2  # Center of motor
            )
            logger.info(f"✅ Created solid motor fallback: {propellant_mass:.1f}kg propellant")
        except Exception as fallback_error:
            logger.error(f"❌ Both liquid and solid motor creation failed: {fallback_error}")
            # Final fallback to GenericMotor
            logger.info("🔄 Final fallback to GenericMotor")
            self._create_generic_motor_fallback(thrust_curve, propellant_mass)
    
    def _create_generic_motor_fallback(self, thrust_curve, propellant_mass):
        """Final fallback to GenericMotor"""
        try:
            self.motor = GenericMotor(
                thrust_source=thrust_curve,
                dry_mass=self.spec["mass"]["total_kg"] - propellant_mass,
                dry_inertia=(0.2, 0.2, 0.002),
                nozzle_radius=self.spec["dimensions"]["outer_diameter_m"] / 4,
                burn_time=self.spec["burn_time_s"]
            )
            logger.info(f"✅ Created generic motor fallback: {propellant_mass:.1f}kg propellant")
        except Exception as final_error:
            logger.error(f"❌ All motor creation methods failed: {final_error}")
            raise
    
    def _create_hybrid_motor(self):
        """Create hybrid motor"""
        thrust_curve = self._generate_hybrid_thrust_curve()
        
        propellant_mass = self.spec["mass"]["propellant_kg"]
        motor_length = self.spec["dimensions"]["length_m"]
        motor_radius = self.spec["dimensions"]["outer_diameter_m"] / 2
        
        self.motor = GenericMotor(
            thrust_source=thrust_curve,
            dry_mass=self.spec["mass"]["total_kg"] - propellant_mass,
            dry_inertia=(0.15, 0.15, 0.002),
            nozzle_radius=motor_radius,
            burn_time=self.spec["burn_time_s"],
            # ✅ ADD: Missing required parameters for hybrid motors
            chamber_radius=motor_radius * 0.8,  # 80% of outer radius
            chamber_height=motor_length * 0.7,  # 70% of motor length
            chamber_position=motor_length / 2,  # Centered in the motor
            propellant_initial_mass=propellant_mass
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