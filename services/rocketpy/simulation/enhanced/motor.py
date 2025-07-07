"""
Enhanced simulation motor class.

This module provides the EnhancedSimulationMotor class which extends
the base SimulationMotor with realistic characteristics and advanced modeling.
"""

import numpy as np
from typing import List, Tuple

from config import ROCKETPY_AVAILABLE, logger
from simulation.core.motor import SimulationMotor

if ROCKETPY_AVAILABLE:
    from rocketpy import SolidMotor, LiquidMotor, HybridMotor, Fluid, CylindricalTank, MassFlowRateBasedTank

class EnhancedSimulationMotor(SimulationMotor):
    """Enhanced motor simulation with realistic characteristics and component-based configuration"""
    
    def __init__(self, motor_id: str, rocket_motor_config=None):
        super().__init__(motor_id)
        
        # Store the actual rocket motor configuration from frontend
        self.rocket_motor_config = rocket_motor_config or {}
            
        # Enhanced motor modeling
        self._setup_enhanced_motor()
    
    def _setup_enhanced_motor(self):
        """Setup enhanced motor with realistic characteristics using rocket configuration"""
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
                nozzle_radius=self.spec["dimensions"]["outer_diameter_m"] / 2,
                grain_number=self._calculate_grain_number(),
                grain_density=1815,  # kg/m³ - typical APCP
                grain_outer_radius=self.spec["dimensions"]["outer_diameter_m"] / 2 - 0.002,
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
            # Get motor configuration from the actual rocket motor component (from frontend)
            rocket_motor = self.rocket_motor_config
            
            # Calculate propellant masses from motor spec (dynamic, not hardcoded)
            total_propellant_kg = self.spec["mass"]["propellant_kg"]
            
            # Use rocket motor configuration for propellant ratios if available
            if rocket_motor.get("nozzle_expansion_ratio") or rocket_motor.get("chamber_pressure_pa"):
                # Advanced configuration - calculate ratios based on rocket motor config
                chamber_pressure = rocket_motor.get("chamber_pressure_pa", 2000000)  # Default 20 bar
                expansion_ratio = rocket_motor.get("nozzle_expansion_ratio", 10)
                
                # Calculate optimal oxidizer/fuel ratio based on chamber conditions
                # This makes the motor configuration completely dynamic
                if chamber_pressure > 1500000:  # High pressure = more oxidizer
                    oxidizer_ratio = 0.75
                else:
                    oxidizer_ratio = 0.65
                    
                fuel_ratio = 1.0 - oxidizer_ratio
                logger.info(f"Using dynamic propellant ratios based on rocket config: chamber_pressure={chamber_pressure}Pa, expansion_ratio={expansion_ratio}")
                
            elif "propellant_config" in self.spec and self.spec["propellant_config"]:
                # Use motor database propellant config if available
                propellant_config = self.spec["propellant_config"]
                oxidizer_ratio = propellant_config.get("oxidizer_to_fuel_ratio", 2.3) / (propellant_config.get("oxidizer_to_fuel_ratio", 2.3) + 1)
                fuel_ratio = 1.0 - oxidizer_ratio
                logger.info(f"Using motor spec propellant config: O/F ratio = {propellant_config.get('oxidizer_to_fuel_ratio', 2.3)}")
            else:
                # Fallback ratios
                oxidizer_ratio = 0.7
                fuel_ratio = 0.3
                logger.info("Using default propellant ratios (no rocket config found)")
            
            oxidizer_mass_kg = total_propellant_kg * oxidizer_ratio
            fuel_mass_kg = total_propellant_kg * fuel_ratio
            
            # Use motor dimensions from spec (dynamic)
            motor_length = self.spec["dimensions"]["length_m"]
            motor_radius = self.spec["dimensions"]["outer_diameter_m"] / 2
            
            # Use rocket motor position configuration
            motor_position = rocket_motor.get("position_from_tail_m", 0.0)
            
            # Calculate tank dimensions proportionally (configurable based on motor size)
            oxidizer_tank_length = motor_length * 0.4  # 40% of motor length
            fuel_tank_length = motor_length * 0.3      # 30% of motor length
            tank_radius = motor_radius * 0.85          # 85% of motor radius to fit inside
            
            # CRITICAL FIX: Calculate proper tank height to prevent overfill
            required_gas_volume = 0.005  # From RocketPy error logs
            tank_cross_section = 3.14159 * tank_radius**2
            min_tank_height_for_gas = (required_gas_volume / tank_cross_section) * 3.0  # 3x safety factor for enhanced
            tank_height = max(max(oxidizer_tank_length, fuel_tank_length), min_tank_height_for_gas)
            
            logger.info(f"🔧 Enhanced tank sizing: radius={tank_radius:.3f}m, height={tank_height:.3f}m, volume={tank_cross_section * tank_height:.6f}m³")
            
            # ✅ CRITICAL FIX: Use proper RocketPy tank pattern to prevent division by zero
            # Import required RocketPy classes for tanks
            from rocketpy import Fluid, CylindricalTank, MassFlowRateBasedTank
            
            # Define fluids (using N2O/Ethanol example from RocketPy docs)
            oxidizer_liq = Fluid(name="N2O_l", density=1220)
            oxidizer_gas = Fluid(name="N2O_g", density=1.9277)
            fuel_liq = Fluid(name="ethanol_l", density=789)
            fuel_gas = Fluid(name="ethanol_g", density=1.59)
            
            # Define tank geometry with enhanced height calculation
            tank_geometry = CylindricalTank(radius=tank_radius, height=tank_height, spherical_caps=True)
            
            # CRITICAL FIX: Calculate safe gas mass for enhanced motor
            enhanced_safe_gas_mass = 0.001  # Even smaller for enhanced precision
            
            # Create oxidizer tank with proper mass flow rates
            oxidizer_tank = MassFlowRateBasedTank(
                name="oxidizer tank",
                geometry=tank_geometry,
                flux_time=self.spec["burn_time_s"],
                initial_liquid_mass=oxidizer_mass_kg,
                initial_gas_mass=enhanced_safe_gas_mass,  # Reduced gas mass
                liquid_mass_flow_rate_in=0,
                liquid_mass_flow_rate_out=lambda t: oxidizer_mass_kg / self.spec["burn_time_s"] * np.exp(-0.1 * t),  # Exponential decay
                gas_mass_flow_rate_in=0,
                gas_mass_flow_rate_out=0,
                liquid=oxidizer_liq,
                gas=oxidizer_gas,
            )
            
            # Create fuel tank with proper mass flow rates
            fuel_tank = MassFlowRateBasedTank(
                name="fuel tank",
                geometry=tank_geometry,
                flux_time=self.spec["burn_time_s"],
                initial_liquid_mass=fuel_mass_kg,
                initial_gas_mass=enhanced_safe_gas_mass,  # Reduced gas mass
                liquid_mass_flow_rate_in=0,
                liquid_mass_flow_rate_out=lambda t: fuel_mass_kg / self.spec["burn_time_s"] * np.exp(-0.1 * t),  # Exponential decay
                gas_mass_flow_rate_in=0,
                gas_mass_flow_rate_out=lambda t: enhanced_safe_gas_mass / self.spec["burn_time_s"] * np.exp(-0.1 * t),  # Gas flow out
                liquid=fuel_liq,
                gas=fuel_gas,
            )
            
            # ✅ FIXED: Create LiquidMotor with proper RocketPy constructor parameters
            self.motor = LiquidMotor(
                thrust_source=thrust_curve,
                dry_mass=self.spec["mass"]["total_kg"] - total_propellant_kg,
                dry_inertia=(0.2, 0.2, 0.002),
                nozzle_radius=motor_radius * 0.7,  # Nozzle throat radius
                center_of_dry_mass_position=motor_length / 2,
                nozzle_position=0,
                burn_time=self.spec["burn_time_s"],
                coordinate_system_orientation="nozzle_to_combustion_chamber",
            )
            
            # ✅ CRITICAL: Add tanks to the motor (this prevents division by zero)
            self.motor.add_tank(tank=oxidizer_tank, position=motor_length * 0.7)  # Oxidizer towards combustion chamber
            self.motor.add_tank(tank=fuel_tank, position=motor_length * 0.3)     # Fuel towards nozzle
            
            logger.info(f"✅ Created enhanced liquid motor: {self.spec['name']} with {oxidizer_mass_kg:.3f}kg oxidizer + {fuel_mass_kg:.3f}kg fuel (ratio: {oxidizer_ratio:.2f}:{fuel_ratio:.2f}) at position {motor_position}m")
            
        except Exception as e:
            logger.warning(f"❌ Enhanced liquid motor creation failed: {e}")
            logger.info("🔄 Using enhanced solid motor fallback for liquid motor")
            # ✅ Fallback to enhanced solid motor instead of broken liquid motor
            self._create_enhanced_solid_motor()
    
    def _create_enhanced_hybrid_motor(self):
        """Create enhanced hybrid motor with regression modeling"""
        thrust_curve = self._generate_hybrid_thrust_curve()
        
        try:
            # Enhanced hybrid motor
            self.motor = HybridMotor(
                thrust_source=thrust_curve,
                dry_mass=self.spec["mass"]["total_kg"] - self.spec["mass"]["propellant_kg"],
                dry_inertia=(0.15, 0.15, 0.002),
                nozzle_radius=self.spec["dimensions"]["outer_diameter_m"] / 2,
                burn_time=self.spec["burn_time_s"],
                center_of_dry_mass_position=0.5,
                nozzle_position=0,
                grain_number=1,
                grain_density=920,  # kg/m³ - typical HTPB
                grain_outer_radius=self.spec["dimensions"]["outer_diameter_m"] / 2 - 0.005,
                grain_initial_inner_radius=0.01,
                grain_initial_height=self.spec["dimensions"]["length_m"] * 0.6,
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
        motor_length = self.spec["dimensions"]["length_m"]
        if motor_length < 0.1:
            return 1
        elif motor_length < 0.2:
            return 2
        else:
            return max(1, int(motor_length / 0.1))
    
    def _calculate_initial_bore(self) -> float:
        """Calculate initial bore radius for optimal performance"""
        outer_radius = self.spec["dimensions"]["outer_diameter_m"] / 2 - 0.002
        return outer_radius * 0.3  # 30% of outer radius
    
    def _calculate_grain_height(self) -> float:
        """Calculate grain height based on motor dimensions"""
        total_length = self.spec["dimensions"]["length_m"]
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