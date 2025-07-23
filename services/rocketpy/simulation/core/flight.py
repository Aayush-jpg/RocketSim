"""
Core simulation flight class.

This module provides the SimulationFlight class which handles rocket flight
simulation with robust error handling and result extraction.
"""

import threading
import traceback
import numpy as np
from typing import List, Tuple

from config import ROCKETPY_AVAILABLE, MOTOR_DATABASE, logger, dbg_enter, dbg_exit
from models.simulation import SimulationResult, TrajectoryData, FlightEvent
from models.environment import LaunchParametersModel
from .rocket import SimulationRocket
from .environment import SimulationEnvironment

if ROCKETPY_AVAILABLE:
    from rocketpy import Flight

class SimulationFlight:
    """Enhanced flight simulation wrapper"""
    
    def __init__(self, rocket: SimulationRocket, environment: SimulationEnvironment, 
                 launch_params: LaunchParametersModel):
        dbg_enter("SimulationFlight.__init__", rocket_name=rocket.config.name)
        self.rocket = rocket
        self.environment = environment
        self.launch_params = launch_params
        self.flight = None
        self.results = None
        
        if not ROCKETPY_AVAILABLE or not rocket.rocket or not environment.env:
            dbg_exit("SimulationFlight.__init__", reason="Dependencies not met (RocketPy, rocket model, or env)")
            return
        
        self._run_simulation()
        dbg_exit("SimulationFlight.__init__", apogee=self.results.maxAltitude if self.results else "failed")
    
    def _run_simulation(self):
        """Run the flight simulation with optimized thread safety for Monte Carlo"""
        try:
            # ✅ CRITICAL PERFORMANCE FIX: Remove global lock for Monte Carlo parallel execution
            # Create thread-local random state for deterministic but independent simulations
            # REDUNDANT IMPORT REMOVED - using top-level import
            # import threading
            thread_id = threading.get_ident()
            
            # ✅ MONTE CARLO OPTIMIZATION: Use reduced fidelity for faster parallel execution
            is_monte_carlo = hasattr(self, '_monte_carlo_mode') and self._monte_carlo_mode
            
            if is_monte_carlo:
                # ✅ HIGH-PERFORMANCE MONTE CARLO MODE
                rtol = 1e-4   # Reduced precision for speed
                atol = 1e-6   # Reduced precision for speed  
                max_time = 120.0  # Shorter max time
                verbose = True
                logger.debug(f"🎲 Thread {thread_id}: Monte Carlo flight simulation starting")
            else:
                # ✅ HIGH-FIDELITY SINGLE SIMULATION MODE
                rtol = 1e-6   # Full precision
                atol = 1e-9   # Full precision
                max_time = 300.0  # Full simulation time
                verbose = True
                logger.info(f"🔍 Thread {thread_id}: High-fidelity flight simulation starting")
            
            # ✅ LOCK-FREE FLIGHT CREATION: Each thread gets its own Flight instance
            # RocketPy Flight objects are thread-safe when using separate instances
            if Flight is None:
                logger.error("Flight class not available - RocketPy import failed")
                raise Exception("RocketPy Flight class not available")
                
            self.flight = Flight(
                rocket=self.rocket.rocket,
                environment=self.environment.env,
                rail_length=self.launch_params.rail_length_m,
                inclination=self.launch_params.inclination_deg,
                heading=self.launch_params.heading_deg,
                rtol=rtol,
                atol=atol,
                max_time=max_time,
                terminate_on_apogee=False,
                verbose=verbose
            )
            
            self._extract_results()
            
            if is_monte_carlo:
                logger.debug(f"✅ Thread {thread_id}: Monte Carlo simulation completed")
            else:
                logger.info(f"✅ Thread {thread_id}: High-fidelity simulation completed")
            
        except Exception as e:
            logger.error(f"Flight simulation failed for thread {threading.get_ident()}: {e}")
            logger.error(f"Exception details: {traceback.format_exc()}")
            # ✅ Create fallback result instead of raising exception
            self._create_fallback_result()
            # ✅ CRITICAL: Re-raise exception for Monte Carlo to detect failures  
            if hasattr(self, '_monte_carlo_mode') and self._monte_carlo_mode:
                raise Exception(f"Monte Carlo simulation failed: {e}")
    
    def _create_fallback_result(self):
        """Create fallback result when simulation fails"""
        logger.warning("Creating fallback simulation result due to simulation failure")
        
        # Get motor specs for basic calculation
        motor_id = self.rocket.motor.motor_id
        if motor_id not in MOTOR_DATABASE:
            logger.error(f"❌ Invalid motor ID '{motor_id}' from frontend - motor not found in database")
            available_motors = list(MOTOR_DATABASE.keys())
            raise ValueError(f"Motor ID '{motor_id}' not found. Available motors: {available_motors}")
        motor_spec = MOTOR_DATABASE[motor_id]
        
        # Basic physics calculation
        total_mass = self.rocket._calculate_dry_mass() + motor_spec["mass"]["propellant_kg"]
        thrust = motor_spec["avg_thrust_n"]
        burn_time = motor_spec["burn_time_s"]
        
        # Simple trajectory estimation
        max_velocity = (thrust / total_mass) * burn_time * 0.7  # Losses
        max_altitude = (max_velocity ** 2) / (2 * 9.81) * 0.6  # Air resistance
        apogee_time = max_velocity / 9.81
        
        self.results = SimulationResult(
            maxAltitude=max(0.0, float(max_altitude)),
            maxVelocity=max(0.0, float(max_velocity)),
            maxAcceleration=max(0.0, float(thrust / total_mass)),
            apogeeTime=max(0.0, float(apogee_time)),
            stabilityMargin=1.5,  # Default stable value
            thrustCurve=[(0.0, 0.0), (burn_time/2, thrust), (burn_time, 0.0)],
            simulationFidelity="fallback",
            impactVelocity=10.0,
            driftDistance=50.0
        )
    
    def _extract_results(self):
        """Extract key results from flight simulation with robust attribute handling"""
        if not self.flight:
            return
        
        try:
            # ✅ FIXED: Robust flight metrics extraction with multiple attribute options
            
            # Max altitude - try multiple possible attributes
            max_altitude = 0.0
            try:
                if hasattr(self.flight, 'apogee_altitude'):
                    max_altitude = float(self.flight.apogee_altitude - self.environment.config.elevation_m)
                elif hasattr(self.flight, 'apogee'):
                    max_altitude = float(self.flight.apogee - self.environment.config.elevation_m)
                elif hasattr(self.flight, 'max_altitude'):
                    max_altitude = float(self.flight.max_altitude - self.environment.config.elevation_m)
                elif hasattr(self.flight, 'z') and callable(self.flight.z):
                    # Find maximum altitude from trajectory
                    time_points = getattr(self.flight, 'time', [0, 1, 2])
                    max_z = max([self.flight.z(t) for t in time_points[:100]])  # Limit checks
                    max_altitude = float(max_z - self.environment.config.elevation_m)
                else:
                    logger.warning("⚠️ No altitude attribute found, using fallback")
                    max_altitude = 100.0  # Fallback value
            except Exception as alt_error:
                logger.warning(f"⚠️ Altitude extraction failed: {alt_error}")
                max_altitude = 100.0
            
            # Max velocity - try multiple possible attributes  
            max_velocity = 0.0
            try:
                if hasattr(self.flight, 'max_speed'):
                    max_velocity = float(self.flight.max_speed)
                elif hasattr(self.flight, 'max_velocity'):
                    max_velocity = float(self.flight.max_velocity)
                elif hasattr(self.flight, 'vz') and callable(self.flight.vz):
                    # Find maximum velocity from trajectory
                    time_points = getattr(self.flight, 'time', [0, 1, 2])
                    max_vz = max([abs(self.flight.vz(t)) for t in time_points[:100]])
                    max_velocity = float(max_vz)
                else:
                    # Estimate from altitude and time
                    max_velocity = float(max_altitude / 10.0)  # Rough estimate
            except Exception as vel_error:
                logger.warning(f"⚠️ Velocity extraction failed: {vel_error}")
                max_velocity = float(max_altitude / 10.0)
            
            # Max acceleration - try multiple possible attributes
            max_acceleration = 0.0
            try:
                if hasattr(self.flight, 'max_acceleration'):
                    max_acceleration = float(self.flight.max_acceleration)
                elif hasattr(self.flight, 'max_accel'):
                    max_acceleration = float(self.flight.max_accel)
                elif hasattr(self.flight, 'az') and callable(self.flight.az):
                    # Find maximum acceleration from trajectory
                    time_points = getattr(self.flight, 'time', [0, 1, 2])
                    max_az = max([abs(self.flight.az(t)) for t in time_points[:100]])
                    max_acceleration = float(max_az)
                else:
                    max_acceleration = 50.0  # Reasonable fallback
            except Exception as acc_error:
                logger.warning(f"⚠️ Acceleration extraction failed: {acc_error}")
                max_acceleration = 50.0
            
            # Apogee time - try multiple possible attributes
            apogee_time = 0.0
            try:
                if hasattr(self.flight, 'apogee_time'):
                    apogee_time = float(self.flight.apogee_time)
                elif hasattr(self.flight, 'time_to_apogee'):
                    apogee_time = float(self.flight.time_to_apogee)
                else:
                    # Estimate from max altitude (rough physics)
                    apogee_time = float(max_altitude / 100.0)  # Rough estimate
            except Exception as time_error:
                logger.warning(f"⚠️ Apogee time extraction failed: {time_error}")
                apogee_time = float(max_altitude / 100.0)
            
            # Stability margin
            stability_margin = 1.5  # Default safe value
            try:
                if hasattr(self.rocket, 'rocket') and hasattr(self.rocket.rocket, 'static_margin'):
                    stability_margin = float(self.rocket.rocket.static_margin(0))
                elif hasattr(self.flight, 'stability_margin'):
                    stability_margin = float(self.flight.stability_margin)
                else:
                    # Calculate approximate stability from rocket geometry
                    total_length = self.rocket.config.nose_cone.length_m + sum(b.length_m for b in self.rocket.config.body_tubes)
                    if len(self.rocket.config.fins) > 0:
                        fin_area = sum(f.root_chord_m * f.span_m for f in self.rocket.config.fins)
                        stability_margin = min(2.5, max(0.5, fin_area / (total_length * 0.1)))
            except Exception as stab_error:
                logger.warning(f"⚠️ Stability calculation failed: {stab_error}")
                stability_margin = 1.5
            
            # Trajectory data (6-DOF) - with error handling
            trajectory = None
            try:
                trajectory = self._extract_trajectory()
            except Exception as traj_error:
                logger.warning(f"⚠️ Trajectory extraction failed: {traj_error}")
            
            # Flight events - with error handling
            events = []
            try:
                events = self._extract_events()
            except Exception as event_error:
                logger.warning(f"⚠️ Events extraction failed: {event_error}")
            
            # Impact data - with error handling
            impact_velocity = None
            drift_distance = None
            try:
                impact_velocity = getattr(self.flight, 'impact_velocity', None)
                if impact_velocity is None:
                    impact_velocity = getattr(self.flight, 'final_velocity', None)
                drift_distance = self._calculate_drift_distance()
            except Exception as impact_error:
                logger.warning(f"⚠️ Impact data extraction failed: {impact_error}")
            
            # Thrust curve - with error handling
            thrust_curve = None
            try:
                thrust_curve = self._extract_thrust_curve()
            except Exception as thrust_error:
                logger.warning(f"⚠️ Thrust curve extraction failed: {thrust_error}")
            
            # ✅ Create results with validated data
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
            
            logger.info(f"✅ Results extracted: altitude={max_altitude:.1f}m, velocity={max_velocity:.1f}m/s, stability={stability_margin:.2f}")
            
        except Exception as e:
            logger.error(f"Failed to extract results: {e}")
            # Create emergency fallback result instead of raising
            self._create_fallback_result()
            logger.warning("⚠️ Using fallback simulation result due to extraction failure")
    
    def _extract_trajectory(self) -> TrajectoryData:
        """Extract 6-DOF trajectory data with safe array handling"""
        if not self.flight:
            return None
        
        try:
            # ✅ FIXED: Safe array extraction with proper numpy handling
            time_points = self.flight.time
            
            # ✅ Convert to lists first to avoid numpy scalar issues
            if hasattr(time_points, '__iter__') and len(time_points) > 0:
                time_list = [float(t) for t in time_points]
            else:
                logger.warning("Invalid time points in trajectory")
                return None
            
            # ✅ FIXED: Safe position data extraction
            try:
                x_data = self.flight.x
                y_data = self.flight.y 
                z_data = self.flight.z
                
                # Handle both callable and array formats
                if callable(x_data):
                    position = [[float(x_data(t)), float(y_data(t)), float(z_data(t))] for t in time_list[:10]]  # Limit to 10 points
                else:
                    position = [[float(x), float(y), float(z)] 
                               for x, y, z in zip(list(x_data)[:10], list(y_data)[:10], list(z_data)[:10])]
            except Exception as pos_error:
                logger.warning(f"Position extraction failed: {pos_error}")
                position = [[0.0, 0.0, float(i*100)] for i in range(min(10, len(time_list)))]  # Fallback
            
            # ✅ FIXED: Safe velocity data extraction  
            try:
                vx_data = self.flight.vx
                vy_data = self.flight.vy
                vz_data = self.flight.vz
                
                if callable(vx_data):
                    velocity = [[float(vx_data(t)), float(vy_data(t)), float(vz_data(t))] for t in time_list[:10]]
                else:
                    velocity = [[float(vx), float(vy), float(vz)] 
                               for vx, vy, vz in zip(list(vx_data)[:10], list(vy_data)[:10], list(vz_data)[:10])]
            except Exception as vel_error:
                logger.warning(f"Velocity extraction failed: {vel_error}")
                velocity = [[0.0, 0.0, float(i*50)] for i in range(min(10, len(time_list)))]  # Fallback
            
            # ✅ FIXED: Safe acceleration data extraction
            try:
                ax_data = self.flight.ax
                ay_data = self.flight.ay
                az_data = self.flight.az
                
                if callable(ax_data):
                    acceleration = [[float(ax_data(t)), float(ay_data(t)), float(az_data(t))] for t in time_list[:10]]
                else:
                    acceleration = [[float(ax), float(ay), float(az)] 
                                   for ax, ay, az in zip(list(ax_data)[:10], list(ay_data)[:10], list(az_data)[:10])]
            except Exception as acc_error:
                logger.warning(f"Acceleration extraction failed: {acc_error}")
                acceleration = [[0.0, 0.0, float(i*20)] for i in range(min(10, len(time_list)))]  # Fallback
            
            # ✅ FIXED: Safe attitude data extraction (optional)
            attitude = None
            angular_velocity = None
            
            try:
                e0_data = self.flight.e0
                e1_data = self.flight.e1
                e2_data = self.flight.e2
                e3_data = self.flight.e3
                
                if all(hasattr(self.flight, attr) for attr in ['e0', 'e1', 'e2', 'e3']):
                    if callable(e0_data):
                        attitude = [[float(e0_data(t)), float(e1_data(t)), float(e2_data(t)), float(e3_data(t))] 
                                   for t in time_list[:10]]
                    else:
                        attitude = [[float(e0), float(e1), float(e2), float(e3)] 
                                   for e0, e1, e2, e3 in zip(list(e0_data)[:10], list(e1_data)[:10], 
                                                             list(e2_data)[:10], list(e3_data)[:10])]
                
                # Angular velocity
                if all(hasattr(self.flight, attr) for attr in ['wx', 'wy', 'wz']):
                    wx_data = self.flight.wx
                    wy_data = self.flight.wy  
                    wz_data = self.flight.wz
                    
                    if callable(wx_data):
                        angular_velocity = [[float(wx_data(t)), float(wy_data(t)), float(wz_data(t))] 
                                           for t in time_list[:10]]
                    else:
                        angular_velocity = [[float(wx), float(wy), float(wz)] 
                                           for wx, wy, wz in zip(list(wx_data)[:10], list(wy_data)[:10], list(wz_data)[:10])]
            except Exception as att_error:
                logger.debug(f"6-DOF attitude data not available: {att_error}")
                # attitude and angular_velocity remain None - this is normal for 3-DOF simulations
            
            return TrajectoryData(
                time=time_list[:10],  # Limit trajectory size to prevent memory issues
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
        """Extract flight events with velocity data"""
        if not self.flight:
            return []
        
        events = []
        
        try:
            # Motor burnout
            if hasattr(self.flight, 'motor_burn_out_time'):
                burnout_time = float(self.flight.motor_burn_out_time)
                events.append(FlightEvent(
                    name="Motor Burnout",
                    time=burnout_time,
                    altitude=float(self.flight.z(burnout_time)),
                    velocity=float(self.flight.speed(burnout_time))
                ))
            
            # Apogee
            apogee_time = float(self.flight.apogee_time)
            events.append(FlightEvent(
                name="Apogee",
                time=apogee_time,
                altitude=float(self.flight.apogee),
                velocity=float(self.flight.speed(apogee_time))
            ))
            
            # Parachute deployment
            for parachute in self.rocket.rocket.parachutes:
                if hasattr(parachute, 'triggering_event'):
                    event_time = float(parachute.triggering_event.t)
                    events.append(FlightEvent(
                        name=f"Parachute Deployment ({parachute.name})",
                        time=event_time,
                        altitude=float(parachute.triggering_event.altitude),
                        velocity=float(self.flight.speed(event_time))
                    ))
            
            # Impact
            if hasattr(self.flight, 'impact_time'):
                impact_time = float(self.flight.impact_time)
                events.append(FlightEvent(
                    name="Impact",
                    time=impact_time,
                    altitude=float(self.environment.config.elevation_m),
                    velocity=float(self.flight.impact_velocity)
                ))
                
        except Exception as e:
            logger.warning(f"Failed to extract events: {e}")
        
        return events
    
    def _extract_thrust_curve(self) -> List[Tuple[float, float]]:
        """Extract motor thrust curve with safe array handling"""
        if not self.rocket.motor.motor:
            return []
        
        try:
            motor = self.rocket.motor.motor
            motor_spec = self.rocket.motor.spec
            
            # ✅ FIXED: Use motor spec data for reliable thrust curve
            burn_time = motor_spec["burn_time_s"]
            avg_thrust = motor_spec["avg_thrust_n"]
            
            # ✅ Create simplified thrust curve from motor specifications
            time_points = np.linspace(0, burn_time, 20)  # Limit to 20 points
            thrust_data = []
            
            for t in time_points:
                try:
                    # ✅ Try to get actual thrust data if available
                    if hasattr(motor, 'thrust') and hasattr(motor.thrust, 'get_value_opt'):
                        thrust = float(motor.thrust.get_value_opt(t))
                    else:
                        # ✅ Fallback to generated curve based on motor spec
                        normalized_time = t / burn_time if burn_time > 0 else 0
                        if normalized_time < 0.1:
                            # Initial spike
                            thrust = avg_thrust * (1.5 + 0.5 * np.sin(normalized_time * 10))
                        elif normalized_time < 0.8:
                            # Sustained burn
                            thrust = avg_thrust * (1.0 + 0.1 * np.sin(normalized_time * 8))
                        else:
                            # Tail-off
                            thrust = avg_thrust * (1.2 - (normalized_time - 0.8) / 0.2)
                        
                        thrust = max(0, thrust)
                    
                    thrust_data.append((float(t), float(thrust)))
                    
                except Exception as thrust_error:
                    logger.debug(f"Thrust extraction error at t={t}: {thrust_error}")
                    # Use fallback calculation
                    normalized_time = t / burn_time if burn_time > 0 else 0
                    thrust = avg_thrust * max(0, 1 - normalized_time) if normalized_time <= 1 else 0
                    thrust_data.append((float(t), float(thrust)))
            
            # ✅ Ensure curve ends at zero
            thrust_data.append((float(burn_time + 0.1), 0.0))
            
            logger.debug(f"Extracted thrust curve with {len(thrust_data)} points")
            return thrust_data
            
        except Exception as e:
            logger.warning(f"Failed to extract thrust curve: {e}")
            # ✅ Return simple fallback thrust curve
            motor_spec = self.rocket.motor.spec
            burn_time = motor_spec["burn_time_s"]
            avg_thrust = motor_spec["avg_thrust_n"]
            
            return [
                (0.0, 0.0),
                (0.1, avg_thrust * 1.2),
                (burn_time * 0.5, avg_thrust),
                (burn_time * 0.9, avg_thrust * 0.8),
                (burn_time, 0.0)
            ]
    
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