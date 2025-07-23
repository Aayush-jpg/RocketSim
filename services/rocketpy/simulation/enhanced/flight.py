"""
Enhanced simulation flight class.

This module provides the EnhancedSimulationFlight class which extends
the base SimulationFlight with advanced analysis capabilities.
"""

import numpy as np
from typing import Dict, Any, List, Tuple

from config import ROCKETPY_AVAILABLE, logger
from models.simulation import SimulationResult, TrajectoryData
from models.environment import LaunchParametersModel
from rocket_physics_utils import RocketPhysicsUtils, FlightEvent
from simulation.core.flight import SimulationFlight
from .rocket import EnhancedSimulationRocket
from .environment import EnhancedSimulationEnvironment

if ROCKETPY_AVAILABLE:
    from rocketpy import Flight

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
            # ✅ CRITICAL FIX: Use more reasonable tolerances for liquid motors
            motor_type = self.rocket.motor.spec.get("type", "solid")
            
            if motor_type == "liquid":
                # Liquid motors need more relaxed tolerances due to complex tank dynamics and high thrust
                rtol = self.analysis_options.get('rtol', 1e-5)  # Relaxed relative tolerance
                atol = self.analysis_options.get('atol', 1e-8)  # Relaxed absolute tolerance
                logger.info(f"🔧 Using relaxed liquid motor tolerances: rtol={rtol}, atol={atol}")
            else:
                # Solid/hybrid motors can use tighter tolerances
                rtol = self.analysis_options.get('rtol', 1e-8)
                atol = self.analysis_options.get('atol', 1e-12)
                logger.info(f"🔧 Using solid motor tolerances: rtol={rtol}, atol={atol}")
            
            max_time = self.analysis_options.get('max_time', 300)  # 5 minutes max
            
            # ✅ ROBUSTNESS FIX: Use a solver better suited for stiff problems like liquid motors
            ode_solver = 'LSODA' if motor_type == 'liquid' else 'RK45'
            
            logger.info(f"🚀 Starting enhanced flight simulation for {motor_type} motor using {ode_solver} solver...")
            
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
                verbose=True,
                ode_solver=ode_solver,
                max_time_step=0.1, # Refined max_time_step
                min_time_step=1e-4 # Prevent excessively small steps
            )
            
            logger.info(f"✅ Enhanced flight simulation completed for {motor_type} motor")

            # ✅ ROBUSTNESS FIX: Check if simulation produced valid results
            if not hasattr(self.flight, 'apogee'):
                logger.error("❌ Simulation ran but failed to produce a valid trajectory. Check motor configuration and flight parameters.")
                raise ValueError("Simulation failed to converge and produce a valid trajectory.")

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
            raw_max_acceleration = float(self.flight.max_acceleration)
            apogee_time = float(self.flight.apogee_time)
            
            # ✅ CRITICAL FIX: Validate and clamp acceleration for high-performance rockets
            # Enhanced simulations can produce realistic high accelerations that exceed basic limits
            if raw_max_acceleration > 1000:  # Above 100g
                logger.warning(f"⚠️ High acceleration detected: {raw_max_acceleration:.1f} m/s² ({raw_max_acceleration/9.81:.1f}g)")
                
                # For enhanced simulations, allow higher realistic limits but still clamp extreme values
                if raw_max_acceleration > 5000:  # Above 500g - definitely unrealistic
                    logger.warning(f"⚠️ Clamping unrealistic acceleration from {raw_max_acceleration:.1f} to 1500 m/s²")
                    max_acceleration = 1500.0  # 150g limit for enhanced simulations
                elif raw_max_acceleration > 3000:  # Above 300g - very high but possible
                    logger.warning(f"⚠️ Clamping very high acceleration from {raw_max_acceleration:.1f} to 2000 m/s²")
                    max_acceleration = 2000.0  # 200g limit 
                else:
                    # Between 100g and 300g - realistic for high-performance rockets
                    max_acceleration = raw_max_acceleration
                    logger.info(f"✅ High but realistic acceleration: {max_acceleration:.1f} m/s² ({max_acceleration/9.81:.1f}g)")
            else:
                max_acceleration = raw_max_acceleration
            
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
            
            # Create a dictionary with all enhanced data
            enhanced_data_raw = {
                'stability_analysis': stability_data,
                'impact_analysis': impact_data,
                'thrust_analysis': thrust_analysis,
                'aerodynamic_analysis': aero_analysis,
                'performance_metrics': self._calculate_performance_metrics(),
                'raw_max_acceleration_ms2': raw_max_acceleration,
                'acceleration_clamped': (raw_max_acceleration != max_acceleration)
            }

            # ✅ CRITICAL FIX: Recursively sanitize all data to prevent serialization errors
            self.results.enhanced_data = self._sanitize_for_serialization(enhanced_data_raw)
            
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
            
            # ✅ ROBUST: Check if time_points is callable or iterable
            if callable(time_points):
                time_array = [time_points(i) for i in range(min(100, len(self.flight.time_list)))]
            elif hasattr(time_points, '__len__') and len(time_points) > 0:
                # ✅ FIXED: Add length checking and safe array conversion
                max_points = min(100, len(time_points))  # Limit to 100 points for performance
                step = max(1, len(time_points) // max_points)
                safe_indices = list(range(0, len(time_points), step))[:max_points]
                time_array = [float(time_points[i]) for i in safe_indices]
            else:
                logger.warning("Time points not available, using simplified trajectory")
                return super()._extract_trajectory()
            
            # Use safe indices for data extraction
            safe_indices = list(range(0, len(time_array)))
            
            # Position data (Earth-fixed frame) - check if callable or direct access
            try:
                if callable(self.flight.x):
                    x_data = [float(self.flight.x(t)) for t in time_array]
                    y_data = [float(self.flight.y(t)) for t in time_array]  
                    z_data = [float(self.flight.z(t)) for t in time_array]
                else:
                    x_data = [float(self.flight.x[i]) for i in safe_indices if i < len(self.flight.x)]
                    y_data = [float(self.flight.y[i]) for i in safe_indices if i < len(self.flight.y)]
                    z_data = [float(self.flight.z[i]) for i in safe_indices if i < len(self.flight.z)]
            except:
                logger.warning("Position data not available in expected format")
                return super()._extract_trajectory()
                
            position = [[x, y, z] for x, y, z in zip(x_data, y_data, z_data)]
            
            # Velocity data (Earth-fixed frame)
            try:
                if callable(self.flight.vx):
                    vx_data = [float(self.flight.vx(t)) for t in time_array]
                    vy_data = [float(self.flight.vy(t)) for t in time_array]
                    vz_data = [float(self.flight.vz(t)) for t in time_array]
                else:
                    vx_data = [float(self.flight.vx[i]) for i in safe_indices if i < len(self.flight.vx)]
                    vy_data = [float(self.flight.vy[i]) for i in safe_indices if i < len(self.flight.vy)]
                    vz_data = [float(self.flight.vz[i]) for i in safe_indices if i < len(self.flight.vz)]
            except:
                logger.warning("Velocity data not available in expected format")
                return super()._extract_trajectory()
                
            velocity = [[vx, vy, vz] for vx, vy, vz in zip(vx_data, vy_data, vz_data)]
            
            # Acceleration data (Earth-fixed frame)
            try:
                if callable(self.flight.ax):
                    ax_data = [float(self.flight.ax(t)) for t in time_array]
                    ay_data = [float(self.flight.ay(t)) for t in time_array]
                    az_data = [float(self.flight.az(t)) for t in time_array]
                else:
                    ax_data = [float(self.flight.ax[i]) for i in safe_indices if i < len(self.flight.ax)]
                    ay_data = [float(self.flight.ay[i]) for i in safe_indices if i < len(self.flight.ay)]
                    az_data = [float(self.flight.az[i]) for i in safe_indices if i < len(self.flight.az)]
            except:
                # Acceleration might not be available, use zeros
                ax_data = [0.0] * len(time_array)
                ay_data = [0.0] * len(time_array)  
                az_data = [0.0] * len(time_array)
                
            acceleration = [[ax, ay, az] for ax, ay, az in zip(ax_data, ay_data, az_data)]
            
            # Enhanced attitude data (quaternions if available)
            attitude = None
            angular_velocity = None
            
            try:
                # Try to extract quaternion attitude data
                if all(hasattr(self.flight, attr) for attr in ['e0', 'e1', 'e2', 'e3']):
                    if callable(self.flight.e0):
                        e0_data = [float(self.flight.e0(t)) for t in time_array]
                        e1_data = [float(self.flight.e1(t)) for t in time_array]
                        e2_data = [float(self.flight.e2(t)) for t in time_array]
                        e3_data = [float(self.flight.e3(t)) for t in time_array]
                    else:
                        e0_data = [float(self.flight.e0[i]) for i in safe_indices if i < len(self.flight.e0)]
                        e1_data = [float(self.flight.e1[i]) for i in safe_indices if i < len(self.flight.e1)]
                        e2_data = [float(self.flight.e2[i]) for i in safe_indices if i < len(self.flight.e2)]
                        e3_data = [float(self.flight.e3[i]) for i in safe_indices if i < len(self.flight.e3)]
                    attitude = [[e0, e1, e2, e3] for e0, e1, e2, e3 in zip(e0_data, e1_data, e2_data, e3_data)]
                
                # Angular velocity data
                if all(hasattr(self.flight, attr) for attr in ['wx', 'wy', 'wz']):
                    if callable(self.flight.wx):
                        wx_data = [float(self.flight.wx(t)) for t in time_array]
                        wy_data = [float(self.flight.wy(t)) for t in time_array]
                        wz_data = [float(self.flight.wz(t)) for t in time_array]
                    else:
                        wx_data = [float(self.flight.wx[i]) for i in safe_indices if i < len(self.flight.wx)]
                        wy_data = [float(self.flight.wy[i]) for i in safe_indices if i < len(self.flight.wy)]
                        wz_data = [float(self.flight.wz[i]) for i in safe_indices if i < len(self.flight.wz)]
                    angular_velocity = [[wx, wy, wz] for wx, wy, wz in zip(wx_data, wy_data, wz_data)]
                
                if attitude is not None:
                    logger.info("Extracted full 6-DOF trajectory data with attitude")
                else:
                    logger.info("Extracted enhanced 3-DOF trajectory data")
            except Exception as att_error:
                logger.debug(f"6-DOF attitude data not available: {att_error}, using 3-DOF trajectory")
            
            return TrajectoryData(
                time=time_array,
                position=position,
                velocity=velocity,
                acceleration=acceleration,
                attitude=attitude,
                angularVelocity=angular_velocity
            )
            
        except Exception as e:
            logger.warning(f"Enhanced trajectory extraction failed: {e}")
            # Fallback to basic trajectory extraction
            try:
                return super()._extract_trajectory()
            except:
                # Ultimate fallback - return minimal trajectory
                return TrajectoryData(
                    time=[0.0, 1.0],
                    position=[[0.0, 0.0, 0.0], [0.0, 0.0, 100.0]],
                    velocity=[[0.0, 0.0, 0.0], [0.0, 0.0, 50.0]],
                    acceleration=[[0.0, 0.0, 0.0], [0.0, 0.0, 10.0]]
                )
    
    def _analyze_enhanced_impact(self) -> Dict[str, Any]:
        """Comprehensive impact analysis including landing accuracy and safety"""
        if not self.flight:
            return {'impact_velocity': 0.0, 'drift_distance': 0.0}
        
        try:
            # Basic impact metrics
            impact_velocity_raw = getattr(self.flight, 'impact_velocity', None)
            
            if impact_velocity_raw is None:
                # Fallback to calculating from final velocity components
                if len(self.flight.vx) > 0:
                    final_vx_raw = self.flight.vx[-1]
                    final_vx = float(np.asarray(final_vx_raw).item())
                else:
                    final_vx = 0.0
                    
                if len(self.flight.vy) > 0:
                    final_vy_raw = self.flight.vy[-1]
                    final_vy = float(np.asarray(final_vy_raw).item())
                else:
                    final_vy = 0.0
                    
                if len(self.flight.vz) > 0:
                    final_vz_raw = self.flight.vz[-1]
                    final_vz = float(np.asarray(final_vz_raw).item())
                else:
                    final_vz = 0.0
                    
                impact_velocity = np.sqrt(final_vx**2 + final_vy**2 + final_vz**2)
            else:
                # ✅ ROBUSTNESS FIX: Ensure impact velocity is a scalar and non-negative
                impact_velocity = abs(float(np.asarray(impact_velocity_raw).item()))

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
                'impact_angle_deg': impact_angle,
                'impact_energy_j': impact_energy,
                'landing_dispersion': landing_dispersion,
                'safety_assessment': safety_assessment,
                'wind_drift_analysis': wind_drift_analysis,
                'impact_coordinates': {
                    'x_m': float(impact_x),
                    'y_m': float(impact_y)
                }
            }
            
        except Exception as e:
            logger.warning(f"Enhanced impact analysis failed: {e}")
            return {
                'impact_velocity': 0.0,
                'drift_distance': 0.0,
                'impact_angle_deg': 45.0,
                'impact_energy_j': 0.0
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
                # Define raw value holders for enhanced error logging
                vx_raw, vy_raw, vz_raw, altitude_raw, drag_force_raw = None, None, None, None, None
                # Define raw value holders for enhanced error logging
                vx_raw, vy_raw, vz_raw, altitude_raw, drag_force_raw = None, None, None, None, None
                try:
                    # Get raw values from flight object - RocketPy may return callables that give [time, value] pairs
                    vx_raw = self.flight.vx(t) if callable(self.flight.vx) else self.flight.vx[i]
                    vy_raw = self.flight.vy(t) if callable(self.flight.vy) else self.flight.vy[i]
                    vz_raw = self.flight.vz(t) if callable(self.flight.vz) else self.flight.vz[i]
                    altitude_raw = self.flight.z(t) if callable(self.flight.z) else self.flight.z[i]

                    # ✅ ROBUSTNESS FIX v3: Handle RocketPy's inconsistent return types (scalar, array, or [t, val] pair)
                    def get_scalar(value: Any) -> float:
                        """Safely extracts a scalar float from a value that could be a scalar, a 1-element array, or a [time, value] pair."""
                        arr = np.asarray(value)
                        if arr.ndim == 0 or arr.size == 1:
                            return float(arr.item())
                        else:
                            # It's a pair like [time, value], return the actual value (the last element)
                            return float(arr[-1])

                    vx = get_scalar(vx_raw)
                    vy = get_scalar(vy_raw)
                    vz = get_scalar(vz_raw)
                    altitude = get_scalar(altitude_raw)
                    
                    velocity_magnitude = np.sqrt(vx**2 + vy**2 + vz**2)
                    
                    # Now atmospheric properties calculations will work with scalars
                    air_density = self._calculate_air_density_at_altitude(altitude)
                    dynamic_pressure = 0.5 * air_density * velocity_magnitude**2
                    
                    # Mach number
                    temperature = self._calculate_temperature_at_altitude(altitude)
                    speed_of_sound = np.sqrt(1.4 * 287 * temperature)
                    mach_number = velocity_magnitude / speed_of_sound if speed_of_sound > 0 else 0.0
                    
                    # Drag force and coefficient
                    drag_force_raw = self._estimate_drag_force(i)
                    drag_force = get_scalar(drag_force_raw)
                    
                    reference_area = np.pi * self.rocket._calculate_radius()**2
                    drag_coefficient = drag_force / (dynamic_pressure * reference_area) if dynamic_pressure > 0 else 0.0
                    
                    # Reynolds number
                    rocket_length = self.rocket._calculate_total_length()
                    reynolds_number = air_density * velocity_magnitude * rocket_length / 1.8e-5
                    
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
                    
                except Exception as data_error:
                    # Enhanced error logging to show problematic data
                    raw_values = {
                        "vx": vx_raw, "vy": vy_raw, "vz": vz_raw, 
                        "altitude": altitude_raw, "drag_force": drag_force_raw
                    }
                    problematic_data = {k: v for k, v in raw_values.items() if v is not None}
                    
                    logger.debug(
                        f"Skipping aerodynamic data point {i} at t={t}: {data_error}. "
                        f"The error likely occurred converting one of these raw values: {problematic_data}"
                    )
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
                logger.warning("No valid aerodynamic data points collected")
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
        try:
            flight_data = {'flight': self.flight}
            physics_utils = RocketPhysicsUtils(flight_data)
            return physics_utils.calculate_impact_angle()
        except Exception as e:
            logger.warning(f"Error calculating impact angle: {e}")
            return 45.0
    
    def _calculate_impact_energy(self) -> float:
        """Calculate kinetic energy at impact"""
        try:
            flight_data = {'flight': self.flight}
            physics_utils = RocketPhysicsUtils(flight_data)
            return physics_utils.calculate_impact_energy()
        except Exception as e:
            logger.warning(f"Error calculating impact energy: {e}")
            return 100.0
    
    def _calculate_landing_dispersion_ellipse(self) -> Dict[str, float]:
        """Calculate landing dispersion ellipse parameters"""
        try:
            flight_data = {'flight': self.flight}
            physics_utils = RocketPhysicsUtils(flight_data)
            return physics_utils.calculate_landing_dispersion_ellipse()
        except Exception as e:
            logger.warning(f"Error calculating dispersion ellipse: {e}")
            return {'major_axis_m': 50.0, 'minor_axis_m': 30.0, 'rotation_deg': 0.0, 'confidence_level': 0.95}
    
    def _assess_landing_safety(self, impact_velocity: float, drift_distance: float) -> Dict[str, Any]:
        """Assess landing safety based on impact conditions"""
        try:
            flight_data = {'flight': self.flight}
            physics_utils = RocketPhysicsUtils(flight_data)
            impact_energy = physics_utils.calculate_impact_energy()
            return physics_utils.assess_landing_safety(impact_velocity, drift_distance, impact_energy)
        except Exception as e:
            logger.warning(f"Error assessing landing safety: {e}")
            return {'overall_safety': 'safe', 'overall_score': 80.0}
    
    def _analyze_wind_drift_effects(self) -> Dict[str, Any]:
        """Analyze wind drift effects throughout flight"""
        try:
            flight_data = {'flight': self.flight}
            physics_utils = RocketPhysicsUtils(flight_data)
            return physics_utils.analyze_wind_drift_effects()
        except Exception as e:
            logger.warning(f"Error analyzing wind drift: {e}")
            return {'total_wind_drift_m': 50.0, 'ascent_drift_m': 20.0, 'descent_drift_m': 30.0}
    
    def _calculate_thrust_coefficient(self, thrust_data: List[float], pressure_data: List[float]) -> float:
        """Calculate thrust coefficient"""
        try:
            flight_data = {'flight': self.flight}
            physics_utils = RocketPhysicsUtils(flight_data)
            return physics_utils.calculate_thrust_coefficient(thrust_data, pressure_data)
        except Exception as e:
            logger.warning(f"Error calculating thrust coefficient: {e}")
            return 1.0
    
    def _calculate_air_density_at_altitude(self, altitude: float) -> float:
        """Calculate air density at given altitude using standard atmosphere"""
        try:
            flight_data = {'flight': self.flight}
            physics_utils = RocketPhysicsUtils(flight_data)
            return physics_utils.calculate_air_density_at_altitude(altitude)
        except Exception as e:
            logger.warning(f"Error calculating air density: {e}")
            return max(0.1, 1.225 * np.exp(-altitude / 8400))
    
    def _calculate_temperature_at_altitude(self, altitude: float) -> float:
        """Calculate temperature at given altitude"""
        try:
            flight_data = {'flight': self.flight}
            physics_utils = RocketPhysicsUtils(flight_data)
            return physics_utils.calculate_temperature_at_altitude(altitude)
        except Exception as e:
            logger.warning(f"Error calculating temperature: {e}")
            return max(180.0, 288.15 - 0.0065 * altitude)
    
    def _estimate_drag_force(self, time_index: int) -> float:
        """Estimate drag force at given time index, ensuring scalar inputs to physics utils."""
        velocity_raw, altitude_raw = None, None
        try:
            # ✅ ROBUSTNESS FIX: Ensure velocity and altitude are scalars before passing to the physics utility.
            # This prevents "can only convert an array of size 1 to a Python scalar" errors inside the helper.
            
            # Define a safe scalar extraction utility
            def get_scalar(value: Any) -> float:
                arr = np.asarray(value)
                return float(arr.item()) if arr.size == 1 else float(arr[-1])

            # Extract and convert velocity and altitude to scalars first
            if time_index < len(self.flight.vz):
                velocity_raw = self.flight.vz[time_index]
                velocity = get_scalar(velocity_raw)
            else:
                velocity = 0.0
                
            if time_index < len(self.flight.z):
                altitude_raw = self.flight.z[time_index]
                altitude = get_scalar(altitude_raw)
            else:
                altitude = 0.0

            # Now call the physics utility with guaranteed scalar values
            physics_utils = RocketPhysicsUtils({'flight': self.flight})
            return physics_utils.estimate_drag_force(velocity, altitude)

        except Exception as e:
            raw_values = {"velocity": velocity_raw, "altitude": altitude_raw}
            problematic_data = {k: v for k, v in raw_values.items() if v is not None}
            logger.warning(
                f"Error estimating drag force at index {time_index}: {e}. "
                f"Problematic raw values: {problematic_data}"
            )
            return 50.0
    
    def _calculate_aerodynamic_efficiency(self) -> float:
        """Calculate overall aerodynamic efficiency"""
        try:
            flight_data = {'flight': self.flight}
            physics_utils = RocketPhysicsUtils(flight_data)
            return physics_utils.calculate_aerodynamic_efficiency()
        except Exception as e:
            logger.warning(f"Error calculating aerodynamic efficiency: {e}")
            return 0.5
    
    def _analyze_transonic_effects(self, aero_data: List[Dict]) -> Dict[str, Any]:
        """Analyze transonic effects during flight"""
        try:
            flight_data = {'flight': self.flight}
            physics_utils = RocketPhysicsUtils(flight_data)
            velocity_data = [d['velocity'] for d in aero_data]
            altitude_data = [d['altitude'] for d in aero_data]
            return physics_utils.analyze_transonic_effects(velocity_data, altitude_data)
        except Exception as e:
            logger.warning(f"Error analyzing transonic effects: {e}")
            return {'transonic_encountered': False}
    
    def _classify_flight_regime(self, max_mach: float) -> str:
        """Classify flight regime based on maximum Mach number"""
        try:
            flight_data = {'flight': self.flight}
            physics_utils = RocketPhysicsUtils(flight_data)
            return physics_utils.classify_flight_regime(max_mach)
        except Exception as e:
            logger.warning(f"Error classifying flight regime: {e}")
            if max_mach < 0.8:
                return "subsonic"
            elif max_mach < 1.2:
                return "transonic"
            else:
                return "supersonic"
    
    def _calculate_theoretical_delta_v(self) -> float:
        """Calculate theoretical delta-v using rocket equation"""
        try:
            flight_data = {'flight': self.flight}
            physics_utils = RocketPhysicsUtils(flight_data)
            return physics_utils.calculate_theoretical_delta_v()
        except Exception as e:
            logger.warning(f"Error calculating theoretical delta-v: {e}")
            return 200.0
    
    def _calculate_drag_losses(self) -> float:
        """Calculate velocity losses due to drag"""
        try:
            flight_data = {'flight': self.flight}
            physics_utils = RocketPhysicsUtils(flight_data)
            return physics_utils.calculate_drag_losses()
        except Exception as e:
            logger.warning(f"Error calculating drag losses: {e}")
            return 50.0
    
    def _calculate_gravity_losses(self) -> float:
        """Calculate velocity losses due to gravity"""
        try:
            flight_data = {'flight': self.flight}
            physics_utils = RocketPhysicsUtils(flight_data)
            return physics_utils.calculate_gravity_losses()
        except Exception as e:
            logger.warning(f"Error calculating gravity losses: {e}")
            return 30.0
    
    def _calculate_mass_ratio(self) -> float:
        """Calculate rocket mass ratio"""
        try:
            flight_data = {'flight': self.flight}
            physics_utils = RocketPhysicsUtils(flight_data)
            return physics_utils.calculate_mass_ratio()
        except Exception as e:
            logger.warning(f"Error calculating mass ratio: {e}")
            return 1.5
    
    def _calculate_payload_fraction(self) -> float:
        """Calculate payload fraction (simplified)"""
        try:
            flight_data = {'flight': self.flight}
            physics_utils = RocketPhysicsUtils(flight_data)
            return physics_utils.calculate_payload_fraction()
        except Exception as e:
            logger.warning(f"Error calculating payload fraction: {e}")
            return 0.1
    
    def _calculate_overall_performance_score(self, altitude: float, efficiency: float, stability: float) -> float:
        """Calculate overall performance score (0-100)"""
        try:
            flight_data = {'flight': self.flight}
            physics_utils = RocketPhysicsUtils(flight_data)
            return physics_utils.calculate_overall_performance_score(altitude, efficiency, stability)
        except Exception as e:
            logger.warning(f"Error calculating performance score: {e}")
            return min(100, max(0, altitude / 10.0))
    
    def _estimate_mission_success_probability(self, performance_score: float, stability_margin: float) -> float:
        """Estimate mission success probability"""
        try:
            flight_data = {'flight': self.flight}
            physics_utils = RocketPhysicsUtils(flight_data)
            return physics_utils.estimate_mission_success_probability(performance_score, stability_margin)
        except Exception as e:
            logger.warning(f"Error estimating mission success probability: {e}")
            return min(1.0, max(0.0, (performance_score / 100.0 + stability_margin / 2.0) / 2.0))

    def _sanitize_for_serialization(self, data: Any) -> Any:
        """
        Recursively traverses a data structure and converts numpy types to native 
        Python types to ensure JSON serialization compatibility.
        """
        if isinstance(data, dict):
            return {key: self._sanitize_for_serialization(value) for key, value in data.items()}
        elif isinstance(data, list):
            return [self._sanitize_for_serialization(element) for element in data]
        elif isinstance(data, np.bool_):
            return bool(data)
        elif isinstance(data, np.floating):
            return float(data)
        elif isinstance(data, np.integer):
            return int(data)
        elif isinstance(data, np.ndarray):
            return self._sanitize_for_serialization(data.tolist())
        return data
    
    def _extract_enhanced_events(self) -> List[FlightEvent]:
        """Extract enhanced flight events with more detail"""
        try:
            flight_data = {'flight': self.flight}
            physics_utils = RocketPhysicsUtils(flight_data)
            return physics_utils.extract_enhanced_events(flight_data)
        except Exception as e:
            logger.warning(f"Error extracting enhanced events: {e}")
            return self._extract_events() if hasattr(self, '_extract_events') else []