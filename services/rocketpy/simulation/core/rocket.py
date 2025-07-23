"""
Core simulation rocket class.

This module provides the SimulationRocket class which handles creation of
rocket configurations with component modeling and mass calculations.
"""

import numpy as np
from typing import Tuple

from config import ROCKETPY_AVAILABLE, logger, dbg_enter, dbg_exit
from models.rocket import RocketModel
from .motor import SimulationMotor

if ROCKETPY_AVAILABLE:
    from rocketpy import Rocket

class SimulationRocket:
    """Enhanced rocket wrapper with component modeling"""
    
    def __init__(self, rocket_config: RocketModel, motor: SimulationMotor):
        dbg_enter("SimulationRocket.__init__", name=rocket_config.name, motor_id=motor.motor_id)
        self.config = rocket_config
        self.motor = motor
        self.rocket = None
        
        if not ROCKETPY_AVAILABLE:
            dbg_exit("SimulationRocket.__init__", reason="RocketPy not available")
            return
        
        self._create_rocket()
        dbg_exit("SimulationRocket.__init__", rocket_mass=self.rocket.mass if self.rocket else "N/A")
    
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
        # ✅ FIXED: Use a realistic base mass for structural components not modeled.
        # The previous value of 0.1kg was far too low, causing unrealistic apogees.
        total_mass = 2.5  # Base structural mass in kg
        
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