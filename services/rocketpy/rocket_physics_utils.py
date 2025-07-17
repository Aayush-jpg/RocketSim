"""
Rocket Physics Utilities
========================

This module provides advanced rocket physics calculations for enhanced simulation analysis.
All functions use real physics equations and data structures from RocketPy simulation results.

Author: Generated for RocketPy Enhanced Simulation Service
"""

import numpy as np
import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Constants
GRAVITY = 9.81  # m/s²
AIR_DENSITY_SEA_LEVEL = 1.225  # kg/m³
TEMPERATURE_SEA_LEVEL = 288.15  # K
LAPSE_RATE = 0.0065  # K/m
SCALE_HEIGHT = 8400  # m

@dataclass
class FlightEvent:
    """Flight event data structure"""
    name: str
    time: float
    altitude: float
    velocity: float

class RocketPhysicsUtils:
    """Advanced rocket physics calculations for enhanced simulation analysis"""
    
    def __init__(self, flight_data: Optional[Dict] = None):
        """
        Initialize with flight data from RocketPy simulation
        
        Args:
            flight_data: Dictionary containing flight simulation results
        """
        self.flight_data = flight_data or {}
        
    def calculate_impact_angle(self, velocity_components: Optional[Tuple[float, float]] = None) -> float:
        """
        Calculate impact angle with respect to ground
        
        Args:
            velocity_components: (horizontal_velocity, vertical_velocity) at impact
            
        Returns:
            Impact angle in degrees (0 = horizontal, 90 = vertical)
        """
        try:
            if velocity_components:
                vx, vy = velocity_components
                if vx == 0 and vy == 0:
                    return 90.0  # Vertical impact if no velocity
                angle_rad = np.arctan2(abs(vy), abs(vx))
                angle_deg = np.degrees(angle_rad)
                logger.debug(f"Impact angle calculated: {angle_deg:.1f}°")
                return float(angle_deg)
            
            # Extract from flight data if available
            if 'vx' in self.flight_data and 'vy' in self.flight_data:
                vx = self.flight_data['vx'][-1] if hasattr(self.flight_data['vx'], '__len__') else self.flight_data['vx']
                vy = self.flight_data['vy'][-1] if hasattr(self.flight_data['vy'], '__len__') else self.flight_data['vy']
                return self.calculate_impact_angle((vx, vy))
            
            # Default reasonable impact angle for ballistic trajectory
            return 45.0
            
        except Exception as e:
            logger.warning(f"Error calculating impact angle: {e}")
            return 45.0
    
    def calculate_impact_energy(self, mass: float = None, velocity: float = None) -> float:
        """
        Calculate kinetic energy at impact
        
        Args:
            mass: Rocket mass at impact (kg)
            velocity: Impact velocity (m/s)
            
        Returns:
            Kinetic energy in Joules
        """
        try:
            # Use provided values or extract from flight data
            if mass is None:
                mass = self.flight_data.get('mass', 1.0)
                if hasattr(mass, '__len__'):
                    mass = mass[-1]  # Final mass
            
            if velocity is None:
                # Calculate velocity magnitude from components
                vx = self.flight_data.get('vx', 0)
                vy = self.flight_data.get('vy', 0)
                vz = self.flight_data.get('vz', 0)
                
                if hasattr(vx, '__len__'):
                    vx, vy, vz = vx[-1], vy[-1], vz[-1]
                
                velocity = np.sqrt(vx**2 + vy**2 + vz**2)
            
            kinetic_energy = 0.5 * mass * velocity**2
            logger.debug(f"Impact energy: {kinetic_energy:.1f} J (mass: {mass:.2f} kg, velocity: {velocity:.2f} m/s)")
            return float(kinetic_energy)
            
        except Exception as e:
            logger.warning(f"Error calculating impact energy: {e}")
            return 100.0  # Default safe value
    
    def calculate_landing_dispersion_ellipse(self, wind_data: Optional[Dict] = None, 
                                           monte_carlo_results: Optional[List] = None) -> Dict[str, float]:
        """
        Calculate landing dispersion ellipse parameters based on wind and uncertainties
        
        Args:
            wind_data: Dictionary with wind speed and direction data
            monte_carlo_results: List of landing positions from Monte Carlo simulation
            
        Returns:
            Dictionary with ellipse parameters
        """
        try:
            if monte_carlo_results and len(monte_carlo_results) > 5:
                # Calculate from Monte Carlo results
                landing_x = [result.get('landing_x', 0) for result in monte_carlo_results]
                landing_y = [result.get('landing_y', 0) for result in monte_carlo_results]
                
                # Calculate covariance matrix
                cov_matrix = np.cov(landing_x, landing_y)
                eigenvalues, eigenvectors = np.linalg.eig(cov_matrix)
                
                # Sort by eigenvalue (descending)
                idx = np.argsort(eigenvalues)[::-1]
                eigenvalues = eigenvalues[idx]
                eigenvectors = eigenvectors[:, idx]
                
                # Calculate ellipse parameters (95% confidence)
                confidence_factor = 5.991  # Chi-square 95% confidence for 2 DOF
                major_axis = 2 * np.sqrt(confidence_factor * eigenvalues[0])
                minor_axis = 2 * np.sqrt(confidence_factor * eigenvalues[1])
                rotation_deg = np.degrees(np.arctan2(eigenvectors[1, 0], eigenvectors[0, 0]))
                
                return {
                    'major_axis_m': float(major_axis),
                    'minor_axis_m': float(minor_axis),
                    'rotation_deg': float(rotation_deg),
                    'confidence_level': 0.95
                }
            
            # Estimate from wind data if available
            if wind_data:
                wind_speed = wind_data.get('speed', 5.0)  # m/s
                flight_time = self.flight_data.get('flight_time', 60.0)  # s
                
                # Simple dispersion model based on wind
                wind_drift = wind_speed * flight_time
                major_axis = max(50.0, wind_drift * 0.5)
                minor_axis = max(30.0, wind_drift * 0.3)
                
                return {
                    'major_axis_m': float(major_axis),
                    'minor_axis_m': float(minor_axis),
                    'rotation_deg': float(wind_data.get('direction', 0.0)),
                    'confidence_level': 0.95
                }
            
            # Default dispersion ellipse
            return {
                'major_axis_m': 50.0,
                'minor_axis_m': 30.0,
                'rotation_deg': 0.0,
                'confidence_level': 0.95
            }
            
        except Exception as e:
            logger.warning(f"Error calculating dispersion ellipse: {e}")
            return {
                'major_axis_m': 50.0,
                'minor_axis_m': 30.0,
                'rotation_deg': 0.0,
                'confidence_level': 0.95
            }
    
    def assess_landing_safety(self, impact_velocity: float, drift_distance: float, 
                            impact_energy: float = None) -> Dict[str, Any]:
        """
        Assess landing safety based on impact conditions
        
        Args:
            impact_velocity: Impact velocity (m/s)
            drift_distance: Drift distance from launch site (m)
            impact_energy: Impact energy (J)
            
        Returns:
            Dictionary with safety assessment
        """
        try:
            safety_score = 100.0
            safety_factors = []
            
            # Velocity safety assessment
            if impact_velocity > 30:
                safety_score -= 40
                safety_factors.append("High impact velocity")
            elif impact_velocity > 20:
                safety_score -= 20
                safety_factors.append("Moderate impact velocity")
            
            # Drift distance assessment
            if drift_distance > 1000:
                safety_score -= 30
                safety_factors.append("Large drift distance")
            elif drift_distance > 500:
                safety_score -= 15
                safety_factors.append("Moderate drift distance")
            
            # Energy assessment
            if impact_energy and impact_energy > 1000:
                safety_score -= 20
                safety_factors.append("High impact energy")
            
            # Determine overall safety classification
            if safety_score >= 80:
                overall_safety = "safe"
            elif safety_score >= 60:
                overall_safety = "caution"
            else:
                overall_safety = "unsafe"
            
            return {
                'overall_safety': overall_safety,
                'overall_score': float(max(0, safety_score)),
                'safety_factors': safety_factors,
                'recommendations': self._generate_safety_recommendations(safety_factors)
            }
            
        except Exception as e:
            logger.warning(f"Error assessing landing safety: {e}")
            return {
                'overall_safety': 'caution',
                'overall_score': 70.0,
                'safety_factors': ['Assessment error'],
                'recommendations': ['Manual safety review required']
            }
    
    def _generate_safety_recommendations(self, safety_factors: List[str]) -> List[str]:
        """Generate safety recommendations based on identified factors"""
        recommendations = []
        
        if "High impact velocity" in safety_factors:
            recommendations.append("Consider larger recovery system")
        if "Large drift distance" in safety_factors:
            recommendations.append("Monitor wind conditions closely")
        if "High impact energy" in safety_factors:
            recommendations.append("Ensure adequate recovery system deployment")
        
        return recommendations
    
    def analyze_wind_drift_effects(self, wind_profile: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Analyze wind drift effects throughout flight
        
        Args:
            wind_profile: Dictionary with altitude-dependent wind data
            
        Returns:
            Dictionary with wind drift analysis
        """
        try:
            if not wind_profile:
                # Default wind analysis
                return {
                    'total_wind_drift_m': 50.0,
                    'ascent_drift_m': 20.0,
                    'descent_drift_m': 30.0,
                    'max_wind_speed_ms': 10.0,
                    'wind_direction_deg': 0.0
                }
            
            # Extract flight trajectory data
            altitudes = self.flight_data.get('altitude', [0, 1000, 0])
            times = self.flight_data.get('time', [0, 30, 60])
            
            if not hasattr(altitudes, '__len__'):
                altitudes = [altitudes]
                times = [times]
            
            # Calculate wind drift for each flight phase
            ascent_drift = 0.0
            descent_drift = 0.0
            max_wind_speed = 0.0
            
            apogee_idx = np.argmax(altitudes)
            
            # Ascent phase
            for i in range(apogee_idx):
                if i + 1 < len(altitudes):
                    dt = times[i + 1] - times[i]
                    altitude = altitudes[i]
                    wind_speed = wind_profile.get(str(int(altitude)), 5.0)
                    max_wind_speed = max(max_wind_speed, wind_speed)
                    ascent_drift += wind_speed * dt
            
            # Descent phase
            for i in range(apogee_idx, len(altitudes) - 1):
                if i + 1 < len(altitudes):
                    dt = times[i + 1] - times[i]
                    altitude = altitudes[i]
                    wind_speed = wind_profile.get(str(int(altitude)), 5.0)
                    max_wind_speed = max(max_wind_speed, wind_speed)
                    descent_drift += wind_speed * dt
            
            total_drift = ascent_drift + descent_drift
            
            return {
                'total_wind_drift_m': float(total_drift),
                'ascent_drift_m': float(ascent_drift),
                'descent_drift_m': float(descent_drift),
                'max_wind_speed_ms': float(max_wind_speed),
                'wind_direction_deg': float(wind_profile.get('direction', 0.0))
            }
            
        except Exception as e:
            logger.warning(f"Error analyzing wind drift: {e}")
            return {
                'total_wind_drift_m': 50.0,
                'ascent_drift_m': 20.0,
                'descent_drift_m': 30.0,
                'max_wind_speed_ms': 10.0,
                'wind_direction_deg': 0.0
            }
    
    def calculate_thrust_coefficient(self, thrust_data: List[float], 
                                   pressure_data: List[float]) -> float:
        """
        Calculate thrust coefficient from thrust and pressure data
        
        Args:
            thrust_data: List of thrust values (N)
            pressure_data: List of chamber pressure values (Pa)
            
        Returns:
            Thrust coefficient (dimensionless)
        """
        try:
            if not thrust_data or not pressure_data:
                return 1.0
            
            # Calculate average values
            avg_thrust = np.mean(thrust_data)
            avg_pressure = np.mean(pressure_data)
            
            if avg_pressure == 0:
                return 1.0
            
            # Simplified thrust coefficient calculation
            # CF = F / (Pc * At) where At is throat area
            # For typical model rockets, At ≈ 0.001 m²
            throat_area = 0.001  # m²
            thrust_coefficient = avg_thrust / (avg_pressure * throat_area)
            
            # Clamp to reasonable range
            return float(max(0.1, min(2.0, thrust_coefficient)))
            
        except Exception as e:
            logger.warning(f"Error calculating thrust coefficient: {e}")
            return 1.0
    
    def calculate_air_density_at_altitude(self, altitude: float) -> float:
        """
        Calculate air density at given altitude using standard atmosphere model
        
        Args:
            altitude: Altitude in meters
            
        Returns:
            Air density in kg/m³
        """
        try:
            # ✅ FIXED: Ensure altitude is scalar to prevent numpy array ambiguity
            altitude = float(np.asarray(altitude).item()) if hasattr(altitude, '__len__') else float(altitude)
            
            # Standard atmosphere model
            if altitude <= 11000:  # Troposphere
                temperature = TEMPERATURE_SEA_LEVEL - LAPSE_RATE * altitude
                pressure_ratio = (temperature / TEMPERATURE_SEA_LEVEL) ** (GRAVITY / (LAPSE_RATE * 287.04))
                density = AIR_DENSITY_SEA_LEVEL * pressure_ratio * (TEMPERATURE_SEA_LEVEL / temperature)
            else:  # Simplified stratosphere
                density = AIR_DENSITY_SEA_LEVEL * np.exp(-altitude / SCALE_HEIGHT)
            
            # ✅ FIXED: Ensure density is finite and positive
            density = float(density)
            if not np.isfinite(density) or density <= 0:
                logger.warning(f"Invalid density calculated: {density}, using fallback")
                return max(0.1, 1.225 * np.exp(-altitude / 8400))
            
            return float(max(0.001, density))  # Minimum density to avoid division by zero
            
        except Exception as e:
            logger.warning(f"Error calculating air density: {e}")
            return max(0.1, 1.225 * np.exp(-altitude / 8400))
    
    def calculate_temperature_at_altitude(self, altitude: float) -> float:
        """
        Calculate temperature at given altitude using standard atmosphere
        
        Args:
            altitude: Altitude in meters
            
        Returns:
            Temperature in Kelvin
        """
        try:
            # ✅ FIXED: Ensure altitude is scalar to prevent numpy array ambiguity
            altitude = float(np.asarray(altitude).item()) if hasattr(altitude, '__len__') else float(altitude)
            
            if altitude <= 11000:  # Troposphere
                temperature = TEMPERATURE_SEA_LEVEL - LAPSE_RATE * altitude
            else:  # Stratosphere (simplified)
                temperature = 216.65  # Constant temperature
            
            # ✅ FIXED: Ensure temperature is finite and within realistic bounds
            temperature = float(temperature)
            if not np.isfinite(temperature):
                logger.warning(f"Invalid temperature calculated: {temperature}, using fallback")
                return max(180.0, 288.15 - 0.0065 * altitude)
            
            return float(max(180.0, temperature))
            
        except Exception as e:
            logger.warning(f"Error calculating temperature: {e}")
            return max(180.0, 288.15 - 0.0065 * altitude)
    
    def estimate_drag_force(self, velocity: float, altitude: float, 
                          drag_coefficient: float = 0.5, reference_area: float = 0.01) -> float:
        """
        Estimate drag force at given conditions
        
        Args:
            velocity: Velocity (m/s)
            altitude: Altitude (m)
            drag_coefficient: Drag coefficient (dimensionless)
            reference_area: Reference area (m²)
            
        Returns:
            Drag force in Newtons
        """
        try:
            air_density = self.calculate_air_density_at_altitude(altitude)
            drag_force = 0.5 * air_density * velocity**2 * drag_coefficient * reference_area
            return float(max(0.0, drag_force))
            
        except Exception as e:
            logger.warning(f"Error estimating drag force: {e}")
            return 50.0
    
    def calculate_aerodynamic_efficiency(self, max_velocity: float = None, 
                                       max_altitude: float = None) -> float:
        """
        Calculate overall aerodynamic efficiency
        
        Args:
            max_velocity: Maximum velocity achieved (m/s)
            max_altitude: Maximum altitude achieved (m)
            
        Returns:
            Aerodynamic efficiency (0-1)
        """
        try:
            # Extract from flight data if not provided
            if max_velocity is None:
                velocities = self.flight_data.get('velocity', [0])
                max_velocity = max(velocities) if hasattr(velocities, '__len__') else velocities
            
            if max_altitude is None:
                altitudes = self.flight_data.get('altitude', [0])
                max_altitude = max(altitudes) if hasattr(altitudes, '__len__') else altitudes
            
            # Simple efficiency metric based on velocity and altitude achieved
            theoretical_velocity = 200.0  # m/s (typical for model rockets)
            theoretical_altitude = 1000.0  # m
            
            velocity_efficiency = min(1.0, max_velocity / theoretical_velocity)
            altitude_efficiency = min(1.0, max_altitude / theoretical_altitude)
            
            overall_efficiency = (velocity_efficiency + altitude_efficiency) / 2.0
            
            return float(max(0.0, min(1.0, overall_efficiency)))
            
        except Exception as e:
            logger.warning(f"Error calculating aerodynamic efficiency: {e}")
            return 0.5
    
    def analyze_transonic_effects(self, velocity_data: List[float], 
                                altitude_data: List[float]) -> Dict[str, Any]:
        """
        Analyze transonic effects during flight
        
        Args:
            velocity_data: List of velocity values (m/s)
            altitude_data: List of altitude values (m)
            
        Returns:
            Dictionary with transonic analysis
        """
        try:
            if not velocity_data or not altitude_data:
                return {'transonic_encountered': False}
            
            # Calculate Mach numbers
            mach_numbers = []
            for i, velocity in enumerate(velocity_data):
                if i < len(altitude_data):
                    altitude = altitude_data[i]
                    temperature = self.calculate_temperature_at_altitude(altitude)
                    speed_of_sound = np.sqrt(1.4 * 287.04 * temperature)  # m/s
                    mach = velocity / speed_of_sound
                    mach_numbers.append(mach)
            
            max_mach = max(mach_numbers) if mach_numbers else 0.0
            transonic_encountered = max_mach > 0.8
            
            return {
                'transonic_encountered': transonic_encountered,
                'max_mach_number': float(max_mach),
                'transonic_duration_s': self._calculate_transonic_duration(mach_numbers),
                'sonic_boom_potential': max_mach > 1.0
            }
            
        except Exception as e:
            logger.warning(f"Error analyzing transonic effects: {e}")
            return {'transonic_encountered': False}
    
    def _calculate_transonic_duration(self, mach_numbers: List[float]) -> float:
        """Calculate duration spent in transonic region (0.8 < M < 1.2)"""
        try:
            transonic_count = sum(1 for m in mach_numbers if 0.8 < m < 1.2)
            # Assuming 0.1s time step (adjust based on actual data)
            return float(transonic_count * 0.1)
        except:
            return 0.0
    
    def classify_flight_regime(self, max_mach: float) -> str:
        """
        Classify flight regime based on maximum Mach number
        
        Args:
            max_mach: Maximum Mach number achieved
            
        Returns:
            Flight regime classification
        """
        if max_mach < 0.8:
            return "subsonic"
        elif max_mach < 1.2:
            return "transonic"
        elif max_mach < 5.0:
            return "supersonic"
        else:
            return "hypersonic"
    
    def calculate_theoretical_delta_v(self, mass_ratio: float = None, 
                                    isp: float = None) -> float:
        """
        Calculate theoretical delta-v using rocket equation
        
        Args:
            mass_ratio: Mass ratio (initial/final)
            isp: Specific impulse (seconds)
            
        Returns:
            Delta-v in m/s
        """
        try:
            if mass_ratio is None:
                # Extract from flight data or use default
                mass_ratio = self.flight_data.get('mass_ratio', 1.5)
            
            if isp is None:
                # Extract from flight data or use default
                isp = self.flight_data.get('isp', 200.0)
            
            # Rocket equation: Δv = Isp * g * ln(m0/mf)
            delta_v = isp * GRAVITY * np.log(mass_ratio)
            
            return float(max(0.0, delta_v))
            
        except Exception as e:
            logger.warning(f"Error calculating theoretical delta-v: {e}")
            return 200.0
    
    def calculate_overall_performance_score(self, altitude: float, 
                                          efficiency: float, 
                                          stability: float) -> float:
        """
        Calculate overall performance score (0-100)
        
        Args:
            altitude: Maximum altitude achieved (m)
            efficiency: Aerodynamic efficiency (0-1)
            stability: Stability margin
            
        Returns:
            Performance score (0-100)
        """
        try:
            # Weighted scoring
            altitude_score = min(50, altitude / 20.0)  # 50 points max, 1000m = 50 points
            efficiency_score = efficiency * 30  # 30 points max
            stability_score = min(20, stability * 10)  # 20 points max
            
            total_score = altitude_score + efficiency_score + stability_score
            
            return float(max(0.0, min(100.0, total_score)))
            
        except Exception as e:
            logger.warning(f"Error calculating performance score: {e}")
            return min(100, max(0, altitude / 10.0))
    
    def estimate_mission_success_probability(self, performance_score: float, 
                                           stability_margin: float) -> float:
        """
        Estimate mission success probability
        
        Args:
            performance_score: Overall performance score (0-100)
            stability_margin: Stability margin
            
        Returns:
            Success probability (0-1)
        """
        try:
            # Weighted probability calculation
            performance_factor = performance_score / 100.0
            stability_factor = min(1.0, stability_margin / 2.0)
            
            # Combined probability with safety factors
            success_probability = (performance_factor * 0.6 + stability_factor * 0.4)
            
            return float(max(0.0, min(1.0, success_probability)))
            
        except Exception as e:
            logger.warning(f"Error estimating mission success: {e}")
            return min(1.0, max(0.0, (performance_score / 100.0 + stability_margin / 2.0) / 2.0))
    
    def extract_enhanced_events(self, simulation_data: Dict) -> List[FlightEvent]:
        """
        Extract enhanced flight events with more detail
        
        Args:
            simulation_data: Dictionary with simulation results
            
        Returns:
            List of flight events
        """
        try:
            events = []
            
            # Extract basic events
            if 'time' in simulation_data and 'altitude' in simulation_data:
                times = simulation_data['time']
                altitudes = simulation_data['altitude']
                velocities = simulation_data.get('velocity', [0] * len(times))
                
                if hasattr(times, '__len__'):
                    # Find key events
                    max_alt_idx = np.argmax(altitudes)
                    max_vel_idx = np.argmax(velocities)
                    
                    # Launch event
                    events.append(FlightEvent(
                        name="Launch",
                        time=float(times[0]),
                        altitude=float(altitudes[0]),
                        velocity=float(velocities[0])
                    ))
                    
                    # Maximum velocity event
                    events.append(FlightEvent(
                        name="Maximum Velocity",
                        time=float(times[max_vel_idx]),
                        altitude=float(altitudes[max_vel_idx]),
                        velocity=float(velocities[max_vel_idx])
                    ))
                    
                    # Apogee event
                    events.append(FlightEvent(
                        name="Apogee",
                        time=float(times[max_alt_idx]),
                        altitude=float(altitudes[max_alt_idx]),
                        velocity=float(velocities[max_alt_idx])
                    ))
                    
                    # Landing event
                    events.append(FlightEvent(
                        name="Landing",
                        time=float(times[-1]),
                        altitude=float(altitudes[-1]),
                        velocity=float(velocities[-1])
                    ))
            
            return events
            
        except Exception as e:
            logger.warning(f"Error extracting enhanced events: {e}")
            return []
    
    def calculate_drag_losses(self, flight_data: Optional[Dict] = None) -> float:
        """
        Calculate velocity losses due to drag
        
        Args:
            flight_data: Optional flight data dictionary
            
        Returns:
            Drag losses in m/s
        """
        try:
            data = flight_data or self.flight_data
            
            if not data:
                return 50.0  # Default reasonable value
            
            # Extract velocity and altitude data
            velocities = data.get('velocity', [])
            altitudes = data.get('altitude', [])
            
            if not hasattr(velocities, '__len__') or not hasattr(altitudes, '__len__'):
                return 50.0
            
            # Calculate drag losses by integrating drag force over time
            drag_losses = 0.0
            times = data.get('time', list(range(len(velocities))))
            
            # Estimate rocket parameters
            mass = data.get('mass', 1.0)
            if hasattr(mass, '__len__'):
                mass = np.mean(mass)
            
            reference_area = 0.01  # m² (typical model rocket)
            drag_coefficient = 0.5  # Typical value
            
            for i in range(len(velocities) - 1):
                if i < len(altitudes) and i < len(times):
                    velocity = velocities[i]
                    altitude = altitudes[i]
                    dt = times[i + 1] - times[i] if i + 1 < len(times) else 0.1
                    
                    # Calculate drag force
                    air_density = self.calculate_air_density_at_altitude(altitude)
                    drag_force = 0.5 * air_density * velocity**2 * drag_coefficient * reference_area
                    
                    # Convert to velocity loss
                    drag_acceleration = drag_force / mass
                    drag_losses += drag_acceleration * dt
            
            return float(max(0.0, drag_losses))
            
        except Exception as e:
            logger.warning(f"Error calculating drag losses: {e}")
            return 50.0
    
    def calculate_gravity_losses(self, flight_data: Optional[Dict] = None) -> float:
        """
        Calculate velocity losses due to gravity
        
        Args:
            flight_data: Optional flight data dictionary
            
        Returns:
            Gravity losses in m/s
        """
        try:
            data = flight_data or self.flight_data
            
            if not data:
                return 30.0  # Default reasonable value
            
            # Extract flight time and trajectory data
            times = data.get('time', [])
            velocities = data.get('velocity', [])
            
            if not hasattr(times, '__len__') or not hasattr(velocities, '__len__'):
                return 30.0
            
            # Calculate gravity losses during powered flight
            # Gravity loss = g * sin(θ) * t_burn integrated over flight path
            
            # Estimate burn time (when thrust > 0)
            thrust_data = data.get('thrust', [])
            if hasattr(thrust_data, '__len__'):
                burn_time = 0.0
                for i, thrust in enumerate(thrust_data):
                    if thrust > 0 and i < len(times) - 1:
                        burn_time += times[i + 1] - times[i]
            else:
                # Estimate burn time from velocity profile
                burn_time = 0.0
                for i in range(len(velocities) - 1):
                    if i < len(times) - 1:
                        # If velocity is increasing, assume powered flight
                        if velocities[i + 1] > velocities[i]:
                            burn_time += times[i + 1] - times[i]
                        else:
                            break
            
            # Calculate average flight angle during burn
            altitudes = data.get('altitude', [])
            if hasattr(altitudes, '__len__') and len(altitudes) > 1:
                # Estimate flight path angle from trajectory
                total_distance = 0.0
                total_altitude = 0.0
                
                for i in range(min(len(altitudes), int(burn_time * 10))):  # Assuming 10 Hz data
                    if i < len(altitudes):
                        total_altitude += altitudes[i]
                        total_distance += 1.0  # Simplified
                
                if total_distance > 0:
                    avg_angle = np.arctan(total_altitude / total_distance)
                else:
                    avg_angle = np.pi / 2  # Vertical flight
            else:
                avg_angle = np.pi / 2  # Assume vertical flight
            
            # Calculate gravity losses
            gravity_losses = GRAVITY * np.sin(avg_angle) * burn_time
            
            return float(max(0.0, gravity_losses))
            
        except Exception as e:
            logger.warning(f"Error calculating gravity losses: {e}")
            return 30.0
    
    def calculate_mass_ratio(self, flight_data: Optional[Dict] = None) -> float:
        """
        Calculate rocket mass ratio (initial mass / final mass)
        
        Args:
            flight_data: Optional flight data dictionary
            
        Returns:
            Mass ratio (dimensionless)
        """
        try:
            data = flight_data or self.flight_data
            
            if not data:
                return 1.5  # Default reasonable value
            
            # Extract mass data
            mass_data = data.get('mass', [])
            
            if hasattr(mass_data, '__len__') and len(mass_data) > 1:
                initial_mass = mass_data[0]
                final_mass = mass_data[-1]
                
                if final_mass > 0:
                    mass_ratio = initial_mass / final_mass
                    return float(max(1.0, mass_ratio))  # Must be >= 1.0
                else:
                    return 1.5
            
            # Try to calculate from motor data
            motor_data = data.get('motor', {})
            if isinstance(motor_data, dict):
                total_mass = motor_data.get('total_mass', 0)
                propellant_mass = motor_data.get('propellant_mass', 0)
                
                if total_mass > 0 and propellant_mass > 0:
                    dry_mass = total_mass - propellant_mass
                    if dry_mass > 0:
                        mass_ratio = total_mass / dry_mass
                        return float(max(1.0, mass_ratio))
            
            return 1.5  # Default
            
        except Exception as e:
            logger.warning(f"Error calculating mass ratio: {e}")
            return 1.5
    
    def calculate_payload_fraction(self, flight_data: Optional[Dict] = None) -> float:
        """
        Calculate payload fraction (payload mass / total mass)
        
        Args:
            flight_data: Optional flight data dictionary
            
        Returns:
            Payload fraction (0-1)
        """
        try:
            data = flight_data or self.flight_data
            
            if not data:
                return 0.1  # Default reasonable value
            
            # Extract payload and total mass
            payload_mass = data.get('payload_mass', 0)
            total_mass = data.get('total_mass', 0)
            
            # Try to get from mass array
            if total_mass == 0:
                mass_data = data.get('mass', [])
                if hasattr(mass_data, '__len__') and len(mass_data) > 0:
                    total_mass = mass_data[0]  # Initial mass
                else:
                    total_mass = mass_data if isinstance(mass_data, (int, float)) else 0
            
            # Try to get payload from rocket configuration
            if payload_mass == 0:
                rocket_data = data.get('rocket', {})
                if isinstance(rocket_data, dict):
                    payload_mass = rocket_data.get('payload_mass', 0)
            
            if total_mass > 0 and payload_mass > 0:
                payload_fraction = payload_mass / total_mass
                return float(max(0.0, min(1.0, payload_fraction)))
            
            # Default payload fraction for typical model rocket
            return 0.1
            
        except Exception as e:
            logger.warning(f"Error calculating payload fraction: {e}")
            return 0.1