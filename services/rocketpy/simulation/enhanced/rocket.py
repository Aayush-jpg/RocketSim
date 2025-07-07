"""
Enhanced simulation rocket class.

This module provides the EnhancedSimulationRocket class which extends
the base SimulationRocket with advanced aerodynamic modeling and component analysis.
"""

import numpy as np
from typing import Tuple, Dict, Any

from config import ROCKETPY_AVAILABLE, logger
from models.rocket import RocketModel
from models.components import BodyComponentModel, ParachuteComponentModel
from simulation.core.rocket import SimulationRocket
from .motor import EnhancedSimulationMotor

if ROCKETPY_AVAILABLE:
    from rocketpy import Rocket

class EnhancedSimulationRocket(SimulationRocket):
    """Enhanced rocket with advanced aerodynamic modeling and component analysis"""
    
    def __init__(self, rocket_config: RocketModel, motor: EnhancedSimulationMotor):
        self.config = rocket_config
        
        # Pass the rocket motor configuration to the motor
        if hasattr(motor, 'rocket_motor_config'):
            motor.rocket_motor_config = {
                "motor_database_id": rocket_config.motor.motor_database_id,
                "position_from_tail_m": rocket_config.motor.position_from_tail_m,
                "nozzle_expansion_ratio": rocket_config.motor.nozzle_expansion_ratio,
                "chamber_pressure_pa": rocket_config.motor.chamber_pressure_pa
            }
        
        self.motor = motor
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
        """Calculate enhanced center of mass with detailed component analysis"""
        total_mass = 0.0
        weighted_position = 0.0
        
        # Nose cone contribution
        nose_mass = self._calculate_nose_mass()
        nose_position = self.config.nose_cone.length_m / 2 if self.config.nose_cone else 0.0
        total_mass += nose_mass
        weighted_position += nose_mass * nose_position
        
        # Body tubes contribution
        for i, body in enumerate(self.config.body_tubes):
            body_mass = self._calculate_body_mass(body)
            # Position body tubes sequentially after nose cone
            nose_length = self.config.nose_cone.length_m if self.config.nose_cone else 0.0
            body_position = nose_length + (i * body.length_m) + (body.length_m / 2)
            total_mass += body_mass
            weighted_position += body_mass * body_position
        
        # Fins contribution (at the rear)
        fins_mass = self._calculate_fins_mass()
        fins_position = self._calculate_total_length() - 0.1  # Near the tail
        total_mass += fins_mass
        weighted_position += fins_mass * fins_position
        
        # Motor contribution (if available and properly configured)
        if self.motor and self.motor.motor:
            try:
                motor_mass = self.motor.motor.propellant_initial_mass + self.motor.motor.dry_mass
                motor_position = self._calculate_enhanced_motor_position()
                total_mass += motor_mass
                weighted_position += motor_mass * motor_position
            except:
                # Use motor spec data as fallback
                motor_spec = self.motor.spec
                motor_mass = motor_spec["mass"]["total_kg"]
                motor_position = self.config.motor.position_from_tail_m
                total_mass += motor_mass
                weighted_position += motor_mass * motor_position
        
        # Parachutes contribution
        for parachute in self.config.parachutes:
            parachute_mass = 0.5  # Estimated parachute mass in kg
            total_mass += parachute_mass
            weighted_position += parachute_mass * parachute.position_from_tail_m
        
        if total_mass > 0:
            center_of_mass = weighted_position / total_mass
            logger.debug(f"Enhanced center of mass: {center_of_mass:.3f}m (total mass: {total_mass:.2f}kg)")
            return center_of_mass
        else:
            logger.warning("Zero total mass detected, using geometric center")
            return self._calculate_total_length() / 2
    
    def _calculate_nose_mass(self) -> float:
        """Calculate nose cone mass"""
        if not hasattr(self.config, 'nose_cone') or not self.config.nose_cone:
            return 0.0
        
        nose = self.config.nose_cone
        length = nose.length_m
        
        # ✅ CRITICAL FIX: Ensure base_radius is always defined
        try:
            base_radius = nose.base_radius_m if nose.base_radius_m is not None else self._calculate_enhanced_radius()
        except Exception as e:
            logger.warning(f"Failed to calculate base radius: {e}, using fallback")
            # Fallback to body tube radius if available
            if self.config.body_tubes and len(self.config.body_tubes) > 0:
                base_radius = self.config.body_tubes[0].outer_radius_m
            else:
                base_radius = 0.025  # 50mm diameter fallback
        
        # ✅ Additional safety check
        if base_radius <= 0:
            logger.warning("Invalid base_radius, using default value")
            base_radius = 0.025  # 50mm diameter default
            
        wall_thickness = nose.wall_thickness_m
        material_density = nose.material_density_kg_m3
        
        # Nose cone mass based on volume and material
        volume = np.pi * base_radius**2 * length / 3  # Cone volume
        shell_mass = volume * (wall_thickness / base_radius) * material_density
        return shell_mass
    
    def _calculate_body_mass(self, body: BodyComponentModel) -> float:
        """Calculate individual body tube mass"""
        length = body.length_m
        radius = body.outer_radius_m
        wall_thickness = body.wall_thickness_m
        material_density = body.material_density_kg_m3
        
        # Body tube mass based on surface area and wall thickness
        surface_area = 2 * np.pi * radius * length
        shell_mass = surface_area * wall_thickness * material_density
        return shell_mass
    
    def _calculate_fins_mass(self) -> float:
        """Calculate total fins mass"""
        total_fin_mass = 0.0
        
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
            total_fin_mass += mass_per_fin * fin_count
        
        return total_fin_mass

    def _calculate_enhanced_motor_position(self) -> float:
        """Calculate motor position from tail in enhanced rocket"""
        motor_position = self.config.motor.position_from_tail_m
        
        # If not specified, place motor at 10% of total length from tail
        if motor_position == 0.0:
            total_length = self._calculate_total_length()
            motor_position = total_length * 0.1
        
        logger.debug(f"Enhanced motor position: {motor_position:.3f}m from tail")
        return motor_position
    
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
            # ✅ FIXED: Use numeric drag coefficient instead of NACA airfoil
            self.rocket.add_trapezoidal_fins(
                n=fin_count,                # ✅ Use actual fin count from model
                root_chord=root_chord,
                tip_chord=tip_chord,
                span=span,
                position=0.1,  # Position from tail
                cant_angle=cant_angle,      # ✅ Use actual cant angle
                sweep_length=sweep_length,
                airfoil=None,  # ✅ FIXED: Use default drag calculation instead of external airfoil file
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