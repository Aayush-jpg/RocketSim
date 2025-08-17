"""
Context builder utility for the Rocket Agent service.
Helps format rocket data and simulation history for the AI agent.
Uses comprehensive models from models.py for rich context.
"""

import json
from typing import Dict, List, Any, Optional
from datetime import datetime
from .models import (
    EnvironmentData, SimulationHistory, AnalysisHistory, 
    ChatRequest
)


class RocketContextBuilder:
    """Builds formatted context strings for the rocket agent using comprehensive models."""
    
    def __init__(self):
        self.context_history = []
    
    def build_rocket_context(self, rocket_data: Dict[str, Any]) -> str:
        """
        Build a comprehensive context string from rocket data.
        
        Args:
            rocket_data: Dictionary containing rocket specifications
            
        Returns:
            Formatted context string for the agent
        """


        
        context_parts = []
        
        # Header
        context_parts.append("=== CURRENT ROCKET CONFIGURATION ===")
        context_parts.append(f"Name: {rocket_data.get('name', 'Unnamed Rocket')}")
        context_parts.append(f"ID: {rocket_data.get('id', 'unknown')}")
        context_parts.append(f"Units: Metric (SI units)")
        
        # ✅ NEW: Read motor from component structure
        motor = rocket_data.get('motor', {})
        motor_id = motor.get('motor_database_id', 'none')
        context_parts.append(f"Motor: {motor_id}")
        
        # ✅ NEW: Calculate drag coefficient from components (placeholder)
        context_parts.append(f"Coordinate System: {rocket_data.get('coordinate_system', 'tail_to_nose')}")
        context_parts.append("")
        
        # ✅ NEW: Component breakdown instead of parts
        nose_cone = rocket_data.get('nose_cone')
        body_tubes = rocket_data.get('body_tubes', [])
        fins = rocket_data.get('fins', [])
        parachutes = rocket_data.get('parachutes', [])
        
        if nose_cone or body_tubes or fins or parachutes or motor_id != 'none':
            context_parts.append("=== ROCKET COMPONENTS ===")
            component_index = 1
            
            # Nose cone
            if nose_cone:
                context_parts.append(f"{component_index}. NOSE CONE:")
                context_parts.append(f"   Shape: {nose_cone.get('shape', 'unknown')}")
                context_parts.append(f"   Length: {nose_cone.get('length_m', 0)*100:.1f}cm")
                context_parts.append(f"   Base Radius: {nose_cone.get('base_radius_m', 0)*100:.1f}cm")
                context_parts.append(f"   Material Density: {nose_cone.get('material_density_kg_m3', 0):.0f} kg/m³")
                context_parts.append(f"   Color: {nose_cone.get('color', 'unknown')}")
                component_index += 1
            
            # Body tubes
            for i, body_tube in enumerate(body_tubes):
                context_parts.append(f"{component_index}. BODY TUBE {i+1}:")
                context_parts.append(f"   Length: {body_tube.get('length_m', 0)*100:.1f}cm")
                context_parts.append(f"   Outer Radius: {body_tube.get('outer_radius_m', 0)*100:.1f}cm")
                context_parts.append(f"   Wall Thickness: {body_tube.get('wall_thickness_m', 0)*1000:.1f}mm")
                context_parts.append(f"   Material Density: {body_tube.get('material_density_kg_m3', 0):.0f} kg/m³")
                context_parts.append(f"   Color: {body_tube.get('color', 'unknown')}")
                component_index += 1
            
            # Fins
            for i, fin in enumerate(fins):
                context_parts.append(f"{component_index}. FIN SET {i+1}:")
                context_parts.append(f"   Fin Count: {fin.get('fin_count', 0)}")
                context_parts.append(f"   Root Chord: {fin.get('root_chord_m', 0)*100:.1f}cm")
                context_parts.append(f"   Tip Chord: {fin.get('tip_chord_m', 0)*100:.1f}cm")
                context_parts.append(f"   Span: {fin.get('span_m', 0)*100:.1f}cm")
                context_parts.append(f"   Thickness: {fin.get('thickness_m', 0)*1000:.1f}mm")
                context_parts.append(f"   Material Density: {fin.get('material_density_kg_m3', 0):.0f} kg/m³")
                context_parts.append(f"   Color: {fin.get('color', 'unknown')}")
                component_index += 1
            
            # Motor
            if motor_id != 'none':
                context_parts.append(f"{component_index}. MOTOR:")
                context_parts.append(f"   Motor ID: {motor_id}")
                context_parts.append(f"   Position: {motor.get('position_from_tail_m', 0)*100:.1f}cm from tail")
                component_index += 1
            
            # Parachutes
            for i, parachute in enumerate(parachutes):
                context_parts.append(f"{component_index}. PARACHUTE {i+1}:")
                context_parts.append(f"   Name: {parachute.get('name', 'unknown')}")
                cd_s_m2 = parachute.get('cd_s_m2', 0)
                context_parts.append(f"   Cd*S: {cd_s_m2:.1f} m²")
                trigger = parachute.get('trigger', 'unknown')
                if isinstance(trigger, (int, float)):
                    context_parts.append(f"   Trigger: {trigger}m altitude")
                else:
                    context_parts.append(f"   Trigger: {trigger}")
                context_parts.append(f"   Color: {parachute.get('color', 'unknown')}")
                component_index += 1
                
            context_parts.append("")
        else:
            context_parts.append("=== ROCKET COMPONENTS ===")
            context_parts.append("No components configured yet.")
            context_parts.append("")
        
        # Design analysis
        analysis = self._analyze_design(rocket_data)
        if analysis:
            context_parts.append("=== DESIGN ANALYSIS ===")
            context_parts.extend(analysis)
            context_parts.append("")
        
        return "\n".join(context_parts)
    

    
    def build_environment_context(self, env_data: Optional[EnvironmentData]) -> str:
        """Build context from environment and weather data."""
        if not env_data:
            return "=== ENVIRONMENT CONDITIONS ===\nNo environmental data available.\n"
        
        context_parts = []
        context_parts.append("=== ENVIRONMENT CONDITIONS ===")
        
        # Basic weather data
        if env_data.temperature is not None:
            context_parts.append(f"Temperature: {env_data.temperature:.1f}°C")
        if env_data.pressure is not None:
            context_parts.append(f"Pressure: {env_data.pressure:.1f} hPa")
        if env_data.humidity is not None:
            context_parts.append(f"Humidity: {env_data.humidity:.1f}%")
        if env_data.dewPoint is not None:
            context_parts.append(f"Dew Point: {env_data.dewPoint:.1f}°C")
        
        # Wind conditions
        if env_data.windSpeed is not None:
            wind_info = f"Wind: {env_data.windSpeed:.1f} m/s"
            if env_data.windDirection is not None:
                wind_dir_names = {
                    0: "N", 45: "NE", 90: "E", 135: "SE", 
                    180: "S", 225: "SW", 270: "W", 315: "NW"
                }
                closest_dir = min(wind_dir_names.keys(), 
                                key=lambda x: abs(x - env_data.windDirection))
                wind_info += f" from {wind_dir_names[closest_dir]} ({env_data.windDirection:.0f}°)"
            context_parts.append(wind_info)
        
        # Visibility and clouds
        if env_data.visibility is not None:
            context_parts.append(f"Visibility: {env_data.visibility:.1f} km")
        if env_data.cloudCover is not None:
            context_parts.append(f"Cloud Cover: {env_data.cloudCover:.1f}%")
        
        # Location information
        if env_data.location:
            loc = env_data.location
            location_info = "Location: "
            if loc.get('city') and loc.get('country'):
                location_info += f"{loc['city']}, {loc['country']}"
            if loc.get('elevation'):
                location_info += f" (elevation: {loc['elevation']}m)"
            if loc.get('lat') and loc.get('lon'):
                location_info += f" [{loc['lat']:.3f}, {loc['lon']:.3f}]"
            context_parts.append(location_info)
        
        # Data source and freshness
        if env_data.weatherSource:
            context_parts.append(f"Data Source: {env_data.weatherSource}")
        if env_data.timestamp:
            context_parts.append(f"Data Time: {env_data.timestamp}")
        
        # Flight recommendations based on conditions
        context_parts.append("")
        context_parts.append("=== FLIGHT CONDITIONS ASSESSMENT ===")
        
        flight_warnings = []
        flight_notes = []
        
        if env_data.windSpeed is not None:
            if env_data.windSpeed > 10:
                flight_warnings.append("🔴 High winds - consider postponing flight")
            elif env_data.windSpeed > 5:
                flight_warnings.append("🟡 Moderate winds - use caution, larger rockets recommended")
            else:
                flight_notes.append("🟢 Low winds - good flying conditions")
        
        if env_data.visibility is not None:
            if env_data.visibility < 5:
                flight_warnings.append("🔴 Poor visibility - unsafe for flight")
            elif env_data.visibility < 10:
                flight_warnings.append("🟡 Limited visibility - keep flights low")
        
        if env_data.temperature is not None:
            if env_data.temperature < 0:
                flight_warnings.append("⚠️ Below freezing - electronics may be affected")
            elif env_data.temperature > 35:
                flight_warnings.append("⚠️ High temperature - motor performance may vary")
        
        if env_data.humidity is not None and env_data.humidity > 85:
            flight_warnings.append("⚠️ High humidity - recovery system may be affected")
        
        for warning in flight_warnings:
            context_parts.append(warning)
        for note in flight_notes:
            context_parts.append(note)
        
        context_parts.append("")
        return "\n".join(context_parts)
    
    def build_simulation_history_context(self, sim_history: Optional[List[SimulationHistory]]) -> str:
        """Build context from simulation history."""
        if not sim_history or len(sim_history) == 0:
            return "=== SIMULATION HISTORY ===\nNo previous simulations available.\n"
        
        context_parts = []
        context_parts.append("=== SIMULATION HISTORY ===")
        
        # Summary of all simulations
        context_parts.append(f"Total simulations: {len(sim_history)}")
        
        # Latest simulation details
        latest = sim_history[-1]
        context_parts.append(f"\nLatest Simulation ({latest.fidelity or 'unknown'} fidelity):")
        
        if latest.maxAltitude is not None:
            context_parts.append(f"  Max Altitude: {latest.maxAltitude:.1f}m")
        if latest.maxVelocity is not None:
            context_parts.append(f"  Max Velocity: {latest.maxVelocity:.1f}m/s")
        if latest.maxAcceleration is not None:
            context_parts.append(f"  Max Acceleration: {latest.maxAcceleration:.1f}m/s²")
        if latest.apogeeTime is not None:
            context_parts.append(f"  Time to Apogee: {latest.apogeeTime:.1f}s")
        if latest.stabilityMargin is not None:
            context_parts.append(f"  Stability Margin: {latest.stabilityMargin:.2f}")
        
        # Flight events
        if latest.flightEvents:
            context_parts.append("  Flight Events:")
            for event in latest.flightEvents:
                event_time = event.get('time', 'unknown')
                event_type = event.get('type', 'unknown')
                event_desc = event.get('description', '')
                context_parts.append(f"    t={event_time}s: {event_type} - {event_desc}")
        
        if latest.timestamp:
            context_parts.append(f"  Simulated: {latest.timestamp}")
        
        # Performance trends if multiple simulations
        if len(sim_history) > 1:
            context_parts.append("\n=== PERFORMANCE TRENDS ===")
            
            altitudes = [s.maxAltitude for s in sim_history if s.maxAltitude is not None]
            if len(altitudes) >= 2:
                trend = "increasing" if altitudes[-1] > altitudes[-2] else "decreasing"
                context_parts.append(f"Altitude trend: {trend} (latest: {altitudes[-1]:.1f}m)")
            
            stability_margins = [s.stabilityMargin for s in sim_history if s.stabilityMargin is not None]
            if len(stability_margins) >= 2:
                trend = "improving" if stability_margins[-1] > stability_margins[-2] else "declining"
                context_parts.append(f"Stability trend: {trend} (latest: {stability_margins[-1]:.2f})")
        
        # Performance assessment
        context_parts.append("\n=== PERFORMANCE ASSESSMENT ===")
        if latest.maxAltitude is not None:
            altitude = latest.maxAltitude
            if altitude < 50:
                context_parts.append("🔴 Low altitude performance - consider motor upgrade")
            elif altitude < 100:
                context_parts.append("🟡 Moderate altitude - good for beginners")
            elif altitude < 300:
                context_parts.append("🟢 Good altitude for sport flying")
            elif altitude < 1000:
                context_parts.append("🔵 High altitude - excellent performance")
            else:
                context_parts.append("🚀 Very high altitude - competition level")
        
        if latest.stabilityMargin is not None:
            margin = latest.stabilityMargin
            if margin < 1.0:
                context_parts.append("⚠️ Unstable - move CG forward or fins aft")
            elif margin < 1.5:
                context_parts.append("🟡 Marginally stable - consider design adjustments")
            elif margin < 3.0:
                context_parts.append("🟢 Well stabilized")
            else:
                context_parts.append("💡 Over-stabilized - could optimize for efficiency")
        
        context_parts.append("")
        return "\n".join(context_parts)
    
    def build_analysis_history_context(self, analysis_history: Optional[List[AnalysisHistory]]) -> str:
        """Build context from analysis history."""
        if not analysis_history or len(analysis_history) == 0:
            return "=== ANALYSIS HISTORY ===\nNo previous analyses available.\n"
        
        context_parts = []
        context_parts.append("=== ANALYSIS HISTORY ===")
        
        latest = analysis_history[-1]
        context_parts.append(f"Total analyses: {len(analysis_history)}")
        
        # Stability analysis
        if latest.stabilityAnalysis:
            context_parts.append("\nLatest Stability Analysis:")
            stability = latest.stabilityAnalysis
            if stability.get('staticMargin'):
                context_parts.append(f"  Static Margin: {stability['staticMargin']:.2f}")
            if stability.get('cpLocation'):
                context_parts.append(f"  CP Location: {stability['cpLocation']:.1f}cm")
            if stability.get('cgLocation'):
                context_parts.append(f"  CG Location: {stability['cgLocation']:.1f}cm")
        
        # Monte Carlo results
        if latest.monteCarloResult:
            context_parts.append("\nMonte Carlo Analysis:")
            mc = latest.monteCarloResult
            if mc.get('meanAltitude'):
                context_parts.append(f"  Mean Altitude: {mc['meanAltitude']:.1f}m")
            if mc.get('stdDeviation'):
                context_parts.append(f"  Std Deviation: {mc['stdDeviation']:.1f}m")
            if mc.get('successRate'):
                context_parts.append(f"  Success Rate: {mc['successRate']:.1f}%")
        
        # Motor analysis
        if latest.motorAnalysis:
            context_parts.append("\nMotor Analysis:")
            motor = latest.motorAnalysis
            if motor.get('totalImpulse'):
                context_parts.append(f"  Total Impulse: {motor['totalImpulse']:.1f}Ns")
            if motor.get('burnTime'):
                context_parts.append(f"  Burn Time: {motor['burnTime']:.1f}s")
            if motor.get('efficiency'):
                context_parts.append(f"  Efficiency: {motor['efficiency']:.1f}%")
        
        # Recovery prediction
        if latest.recoveryPrediction:
            context_parts.append("\nRecovery Prediction:")
            recovery = latest.recoveryPrediction
            if recovery.get('driftDistance'):
                context_parts.append(f"  Drift Distance: {recovery['driftDistance']:.1f}m")
            if recovery.get('landingVelocity'):
                context_parts.append(f"  Landing Velocity: {recovery['landingVelocity']:.1f}m/s")
        
        # Performance metrics
        if latest.performanceMetrics:
            context_parts.append("\nPerformance Metrics:")
            perf = latest.performanceMetrics
            if perf.get('thrustToWeight'):
                context_parts.append(f"  Thrust-to-Weight: {perf['thrustToWeight']:.1f}")
            if perf.get('velocityAtBurnout'):
                context_parts.append(f"  Velocity at Burnout: {perf['velocityAtBurnout']:.1f}m/s")
        
        if latest.timestamp:
            context_parts.append(f"\nAnalyzed: {latest.timestamp}")
        
        context_parts.append("")
        return "\n".join(context_parts)
    
    def build_user_preferences_context(self, preferences: Optional[Dict[str, Any]]) -> str:
        """Build context from user preferences."""
        if not preferences:
            return ""
        
        context_parts = []
        context_parts.append("=== USER PREFERENCES ===")
        
        # Units preference
        if preferences.get('units'):
            context_parts.append(f"Preferred Units: {preferences['units']}")
        
        # Simulation preferences
        if preferences.get('defaultSimulation'):
            context_parts.append(f"Default Simulation: {preferences['defaultSimulation']}")
        
        # Safety preferences
        if preferences.get('safetyLevel'):
            context_parts.append(f"Safety Level: {preferences['safetyLevel']}")
        
        # Experience level
        if preferences.get('experienceLevel'):
            context_parts.append(f"Experience Level: {preferences['experienceLevel']}")
        
        # Preferred rocket types
        if preferences.get('preferredRocketTypes'):
            types = ", ".join(preferences['preferredRocketTypes'])
            context_parts.append(f"Preferred Rocket Types: {types}")
        
        # Flight goals
        if preferences.get('flightGoals'):
            goals = ", ".join(preferences['flightGoals'])
            context_parts.append(f"Flight Goals: {goals}")
        
        context_parts.append("")
        return "\n".join(context_parts)
    
    def build_session_context(self, session_info: Optional[Dict[str, Any]]) -> str:
        """Build context from session information."""
        if not session_info:
            return ""
        
        context_parts = []
        context_parts.append("=== SESSION INFORMATION ===")
        
        if session_info.get('sessionId'):
            context_parts.append(f"Session ID: {session_info['sessionId']}")
        
        if session_info.get('startTime'):
            context_parts.append(f"Session Started: {session_info['startTime']}")
        
        if session_info.get('messageCount'):
            context_parts.append(f"Messages in Session: {session_info['messageCount']}")
        
        if session_info.get('rocketsDesigned'):
            context_parts.append(f"Rockets Designed: {session_info['rocketsDesigned']}")
        
        if session_info.get('simulationsRun'):
            context_parts.append(f"Simulations Run: {session_info['simulationsRun']}")
        
        context_parts.append("")
        return "\n".join(context_parts)
    
    def combine_comprehensive_context(self, 
                                    rocket_data: Dict[str, Any],
                                    environment: Optional[EnvironmentData] = None,
                                    simulation_history: Optional[List[SimulationHistory]] = None,
                                    analysis_history: Optional[List[AnalysisHistory]] = None,
                                    user_preferences: Optional[Dict[str, Any]] = None,
                                    session_info: Optional[Dict[str, Any]] = None,
                                    user_message: str = "") -> str:
        """Combine all comprehensive context information into a single string."""
        contexts = []
        
        # Add timestamp
        contexts.append(f"=== COMPREHENSIVE CONTEXT REPORT ===")
        contexts.append(f"Generated at: {datetime.now().isoformat()}")
        contexts.append("")
        
        # Add rocket context (always present)
        contexts.append(self.build_rocket_context(rocket_data))
        
        # Add environment context
        if environment:
            contexts.append(self.build_environment_context(environment))
        
        # Add simulation history
        if simulation_history:
            contexts.append(self.build_simulation_history_context(simulation_history))
        
        # Add analysis history
        if analysis_history:
            contexts.append(self.build_analysis_history_context(analysis_history))
        
        # Add user preferences
        if user_preferences:
            contexts.append(self.build_user_preferences_context(user_preferences))
        
        # Add session information
        if session_info:
            contexts.append(self.build_session_context(session_info))
        
        # Add current user message
        if user_message:
            contexts.append("=== CURRENT USER REQUEST ===")
            contexts.append(user_message)
            contexts.append("")
        
        # Add comprehensive instructions based on available data
        contexts.append("=== AGENT INSTRUCTIONS ===")
        contexts.append("You are an expert rocket design assistant with access to:")
        contexts.append("")
        contexts.append("⚠️ CRITICAL: When asked about current rocket configuration, you MUST:")
        contexts.append("1. Read the CURRENT ROCKET CONFIGURATION section above")
        contexts.append("2. Report the EXACT values shown in that section")
        contexts.append("3. Do NOT use cached or default values")
        contexts.append("4. Do NOT make assumptions about the configuration")
        contexts.append("")
        
        instruction_items = ["- Current rocket configuration and design analysis"]
        
        if environment:
            instruction_items.append("- Real-time environmental and weather conditions")
        if simulation_history:
            instruction_items.append("- Complete simulation history and performance trends")
        if analysis_history:
            instruction_items.append("- Detailed technical analysis results")
        if user_preferences:
            instruction_items.append("- User preferences and experience level")
        if session_info:
            instruction_items.append("- Current session context and history")
        
        contexts.extend(instruction_items)
        contexts.append("")
        
        contexts.append("Your responsibilities:")
        contexts.append("- Analyze ALL available data when making recommendations")
        contexts.append("- Consider environmental conditions for flight safety")
        contexts.append("- Use simulation history to identify performance trends")
        contexts.append("- Respect user preferences and experience level")
        contexts.append("- Provide specific, actionable design modifications")
        contexts.append("- Explain your reasoning based on the comprehensive data")
        contexts.append("- Prioritize safety and performance optimization")
        contexts.append("")
        
        return "\n".join(contexts)

    def _analyze_design(self, rocket_data: Dict[str, Any]) -> List[str]:
        """Analyze the current rocket design and provide insights."""
        analysis = []
        
        # ✅ NEW: Read component-based structure instead of old parts array
        nose_cone = rocket_data.get('nose_cone')
        body_tubes = rocket_data.get('body_tubes', [])
        fins = rocket_data.get('fins', [])
        motor = rocket_data.get('motor', {})
        parachutes = rocket_data.get('parachutes', [])
        
        # Calculate total length from components
        total_length = 0
        if nose_cone:
            total_length += nose_cone.get('length_m', 0) * 100  # Convert to cm
        for body_tube in body_tubes:
            total_length += body_tube.get('length_m', 0) * 100  # Convert to cm
        
        # Count components
        component_counts = {
            'nose_cone': 1 if nose_cone else 0,
            'body_tubes': len(body_tubes),
            'fins': len(fins),
            'motor': 1 if motor.get('motor_database_id') and motor.get('motor_database_id') != 'none' else 0,
            'parachutes': len(parachutes)
        }
        
        # Total component count
        total_components = sum(component_counts.values())
        
        analysis.append(f"Total estimated length: {total_length:.1f}cm")
        analysis.append(f"Component counts: {component_counts}")
        
        # ✅ NEW: Component-based design checks
        has_nose = bool(nose_cone)
        has_body = len(body_tubes) > 0
        has_fins = len(fins) > 0
        motor_id = motor.get('motor_database_id', 'none')
        has_motor = motor_id and motor_id != 'none'
        has_parachutes = len(parachutes) > 0
        
        # Design validation
        if total_components > 0:
            analysis.append("✓ Rocket has components configured")
            
            if has_nose:
                nose_shape = nose_cone.get('shape', 'unknown')
                nose_length = nose_cone.get('length_m', 0) * 100
                analysis.append(f"✓ Nose cone: {nose_shape}, {nose_length:.1f}cm long")
            else:
                analysis.append("⚠️ Missing nose cone - aerodynamics will be poor")
                
            if has_body:
                total_body_length = sum(bt.get('length_m', 0) for bt in body_tubes) * 100
                analysis.append(f"✓ Body tubes: {len(body_tubes)} sections, {total_body_length:.1f}cm total")
            else:
                analysis.append("⚠️ Missing body tube - no recovery system housing")
                
            if has_fins:
                total_fin_count = sum(fin.get('fin_count', 0) for fin in fins)
                analysis.append(f"✓ Fins: {len(fins)} fin sets, {total_fin_count} total fins")
            else:
                analysis.append("⚠️ Missing fins - rocket will be unstable")
                
            if has_motor:
                analysis.append(f"✓ Motor: {motor_id}")
            else:
                analysis.append("⚠️ No motor selected - rocket won't fly")
        
            if has_parachutes:
                analysis.append(f"✓ Recovery: {len(parachutes)} parachute(s)")
            else:
                analysis.append("⚠️ No recovery system - rocket will crash")
        else:
            analysis.append("❌ No components found - rocket appears empty")
            analysis.append("💡 Add components to begin rocket design")
        
        # Professional design recommendations
        if has_nose and has_body and has_fins and has_motor:
            analysis.append("✅ Complete basic rocket configuration")
            
            # Length-to-diameter ratio check
            if body_tubes:
                avg_diameter = sum(bt.get('outer_radius_m', 0) for bt in body_tubes) / len(body_tubes) * 200  # Convert to cm diameter
                if avg_diameter > 0:
                    length_to_diameter = total_length / avg_diameter
                    if length_to_diameter < 8:
                        analysis.append("💡 Consider longer body for better stability (L/D ratio)")
                    elif length_to_diameter > 15:
                        analysis.append("💡 Very long rocket - ensure structural integrity")
                    else:
                        analysis.append("✓ Good length-to-diameter ratio")
        
        return analysis
    
    def add_to_history(self, context: str, response: str):
        """Add context and response to history for future reference."""
        self.context_history.append({
            'timestamp': datetime.now().isoformat(),
            'context': context,
            'response': response
        })
        
        # Keep only last 10 entries to prevent memory bloat
        if len(self.context_history) > 10:
            self.context_history = self.context_history[-10:]
    
    def get_recent_history_summary(self, max_entries: int = 3) -> str:
        """Get a summary of recent context history."""
        if not self.context_history:
            return "No recent context history available."
        
        recent = self.context_history[-max_entries:]
        summary_parts = ["=== RECENT INTERACTION HISTORY ==="]
        
        for i, entry in enumerate(recent, 1):
            timestamp = entry['timestamp']
            # Extract just the user request from context
            context_lines = entry['context'].split('\n')
            user_request = "No specific request"
            for line in context_lines:
                if line.strip() and not line.startswith('=') and not line.startswith('-'):
                    user_request = line.strip()[:100] + "..." if len(line.strip()) > 100 else line.strip()
                    break
            
            summary_parts.append(f"{i}. {timestamp[:19]} - {user_request}")
        
        summary_parts.append("")
        return "\n".join(summary_parts)


# Enhanced utility functions for comprehensive context
def build_rocket_context(rocket_data: Dict[str, Any]) -> str:
    """Quick function to build rocket context."""
    builder = RocketContextBuilder()
    return builder.build_rocket_context(rocket_data)


def build_comprehensive_context(
    rocket_data: Dict[str, Any],
    environment: Optional[EnvironmentData] = None,
    simulation_history: Optional[List[SimulationHistory]] = None,
    analysis_history: Optional[List[AnalysisHistory]] = None,
    user_preferences: Optional[Dict[str, Any]] = None,
    session_info: Optional[Dict[str, Any]] = None,
    user_message: str = ""
) -> str:
    """Build complete comprehensive context using all available data."""
    builder = RocketContextBuilder()
    return builder.combine_comprehensive_context(
        rocket_data=rocket_data,
        environment=environment,
        simulation_history=simulation_history,
        analysis_history=analysis_history,
        user_preferences=user_preferences,
        session_info=session_info,
        user_message=user_message
    )


def build_context_from_request(request: ChatRequest) -> str:
    """Build context directly from a ChatRequest model."""
    user_message = request.messages[-1]['content'] if request.messages else ""
    
    return build_comprehensive_context(
        rocket_data=request.rocket,
        environment=request.environment,
        simulation_history=request.simulationHistory,
        analysis_history=request.analysisHistory,
        user_preferences=request.userPreferences,
        session_info=request.sessionInfo,
        user_message=user_message
    )

