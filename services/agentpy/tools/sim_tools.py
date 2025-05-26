"""Enhanced simulation tools for the rocket agent with full RocketPy capabilities."""

import json
from typing import Dict, Any, Literal, Optional, List
from agents import function_tool

@function_tool(strict_mode=False)
def run_simulation(
    fidelity: Literal["quick", "standard", "hifi", "monte_carlo"] = "standard",
    environment_conditions: Optional[Dict[str, Any]] = None,
    launch_parameters: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Run a rocket simulation with specified fidelity and parameters.
    
    Args:
        fidelity: Simulation type - 'quick' (simplified), 'standard' (basic RocketPy), 
                 'hifi' (6-DOF), or 'monte_carlo' (statistical analysis)
        environment_conditions: Weather and atmospheric conditions
        launch_parameters: Launch site and rail parameters
    """
    action_data = {
        "action": "run_simulation",
        "fidelity": fidelity
    }
    
    if environment_conditions:
        action_data["environment"] = environment_conditions
    
    if launch_parameters:
        action_data["launch_parameters"] = launch_parameters
    
    return action_data

@function_tool(strict_mode=False)
def analyze_trajectory(
    include_3d_path: bool = True,
    include_velocity_profile: bool = True,
    include_acceleration_profile: bool = True,
    include_attitude_data: bool = False
) -> Dict[str, Any]:
    """
    Analyze the rocket's flight trajectory with detailed data.
    
    Args:
        include_3d_path: Include 3D position data over time
        include_velocity_profile: Include velocity components over time
        include_acceleration_profile: Include acceleration data
        include_attitude_data: Include 6-DOF attitude quaternions (for advanced analysis)
    """
    return {
        "action": "analyze_trajectory",
        "include_3d_path": include_3d_path,
        "include_velocity_profile": include_velocity_profile,
        "include_acceleration_profile": include_acceleration_profile,
        "include_attitude_data": include_attitude_data
    }

@function_tool(strict_mode=False)
def run_monte_carlo_analysis(
    iterations: int = 100,
    parameter_variations: Optional[List[Dict[str, Any]]] = None,
    analyze_dispersion: bool = True
) -> Dict[str, Any]:
    """
    Run Monte Carlo simulation to analyze design robustness and landing dispersion.
    
    Args:
        iterations: Number of simulation runs (50-1000 recommended)
        parameter_variations: List of parameters to vary with their distributions
        analyze_dispersion: Calculate landing dispersion statistics
    """
    variations = parameter_variations or [
        {
            "parameter": "environment.windSpeed",
            "distribution": "uniform",
            "parameters": [0, 10]  # 0-10 m/s wind
        },
        {
            "parameter": "rocket.Cd",
            "distribution": "normal", 
            "parameters": [0.5, 0.05]  # Mean 0.5, std 0.05
        },
        {
            "parameter": "launch.inclination",
            "distribution": "normal",
            "parameters": [85, 2]  # 85° ± 2°
        }
    ]
    
    return {
        "action": "run_monte_carlo",
        "iterations": iterations,
        "variations": variations,
        "analyze_dispersion": analyze_dispersion
    }

@function_tool(strict_mode=False)
def optimize_design(
    optimization_target: Literal["max_altitude", "stability_margin", "landing_accuracy"] = "max_altitude",
    constraints: Optional[Dict[str, Any]] = None,
    optimization_method: Literal["gradient_descent", "genetic_algorithm", "grid_search"] = "gradient_descent"
) -> Dict[str, Any]:
    """
    Optimize the rocket design for a specific target while respecting constraints.
    
    Args:
        optimization_target: What to optimize - altitude, stability, or landing accuracy
        constraints: Design constraints (mass limits, size limits, etc.)
        optimization_method: Algorithm to use for optimization
    """
    return {
        "action": "optimize_design",
        "target": optimization_target,
        "constraints": constraints or {},
        "method": optimization_method
    }

@function_tool(strict_mode=False)
def analyze_stability(
    flight_phase: Literal["powered", "coast", "all"] = "all",
    include_static_margin: bool = True,
    include_dynamic_stability: bool = False,
    wind_conditions: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    Perform detailed stability analysis of the rocket design.
    
    Args:
        flight_phase: Which flight phase to analyze
        include_static_margin: Calculate static stability margin
        include_dynamic_stability: Perform dynamic stability analysis (advanced)
        wind_conditions: Wind conditions for stability analysis
    """
    return {
        "action": "analyze_stability",
        "flight_phase": flight_phase,
        "include_static_margin": include_static_margin,
        "include_dynamic_stability": include_dynamic_stability,
        "wind_conditions": wind_conditions
    }

@function_tool(strict_mode=False)
def set_environment_conditions(
    latitude: float = 0.0,
    longitude: float = 0.0,
    elevation: float = 0.0,
    wind_speed: float = 0.0,
    wind_direction: float = 0.0,
    atmospheric_model: Literal["standard", "forecast", "custom"] = "standard",
    date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Set environmental conditions for the simulation.
    
    Args:
        latitude: Launch site latitude in degrees
        longitude: Launch site longitude in degrees  
        elevation: Elevation above sea level in meters
        wind_speed: Wind speed in m/s
        wind_direction: Wind direction in degrees (0 = North)
        atmospheric_model: Type of atmospheric model to use
        date: Date for weather forecast (ISO format)
    """
    return {
        "action": "set_environment",
        "latitude": latitude,
        "longitude": longitude,
        "elevation": elevation,
        "wind_speed": wind_speed,
        "wind_direction": wind_direction,
        "atmospheric_model": atmospheric_model,
        "date": date
    }

@function_tool(strict_mode=False)
def set_launch_parameters(
    rail_length: float = 5.0,
    inclination: float = 85.0,
    heading: float = 0.0,
    launch_site_name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Configure launch parameters and rail settings.
    
    Args:
        rail_length: Launch rail length in meters
        inclination: Rail inclination from vertical in degrees (0 = vertical)
        heading: Launch heading in degrees (0 = North)
        launch_site_name: Name of the launch site for reference
    """
    return {
        "action": "set_launch_parameters",
        "rail_length": rail_length,
        "inclination": inclination,
        "heading": heading,
        "launch_site_name": launch_site_name
    }

@function_tool(strict_mode=False)
def analyze_motor_performance(
    motor_id: str,
    analyze_thrust_curve: bool = True,
    analyze_efficiency: bool = True,
    compare_alternatives: bool = False
) -> Dict[str, Any]:
    """
    Analyze motor performance characteristics and suggest optimizations.
    
    Args:
        motor_id: ID of the motor to analyze
        analyze_thrust_curve: Analyze the thrust curve shape and characteristics
        analyze_efficiency: Calculate motor efficiency metrics
        compare_alternatives: Compare with alternative motor options
    """
    return {
        "action": "analyze_motor",
        "motor_id": motor_id,
        "analyze_thrust_curve": analyze_thrust_curve,
        "analyze_efficiency": analyze_efficiency,
        "compare_alternatives": compare_alternatives
    }

@function_tool(strict_mode=False)
def export_simulation_data(
    format_type: Literal["csv", "json", "kml", "matlab"] = "json",
    include_trajectory: bool = True,
    include_events: bool = True,
    include_motor_data: bool = True
) -> Dict[str, Any]:
    """
    Export simulation results in various formats for analysis or visualization.
    
    Args:
        format_type: Export format - CSV, JSON, KML (Google Earth), or MATLAB
        include_trajectory: Include trajectory data in export
        include_events: Include flight events (burnout, apogee, etc.)
        include_motor_data: Include motor performance data
    """
    return {
        "action": "export_data",
        "format": format_type,
        "include_trajectory": include_trajectory,
        "include_events": include_events,
        "include_motor_data": include_motor_data
    }

@function_tool(strict_mode=False)
def predict_recovery(
    parachute_cd_s: float = 1.0,
    deployment_altitude: float = 500.0,
    deployment_delay: float = 1.5,
    analyze_drift: bool = True
) -> Dict[str, Any]:
    """
    Predict recovery system performance and landing location.
    
    Args:
        parachute_cd_s: Parachute drag coefficient × area (m²)
        deployment_altitude: Deployment altitude in meters AGL
        deployment_delay: Deployment delay after trigger in seconds
        analyze_drift: Analyze wind drift effects on landing location
    """
    return {
        "action": "predict_recovery",
        "parachute_cd_s": parachute_cd_s,
        "deployment_altitude": deployment_altitude,
        "deployment_delay": deployment_delay,
        "analyze_drift": analyze_drift
    }

@function_tool(strict_mode=False)
def run_professional_simulation(
    fidelity: Literal["enhanced", "professional", "monte_carlo"] = "enhanced",
    environment_conditions: Optional[Dict[str, Any]] = None,
    launch_parameters: Optional[Dict[str, Any]] = None,
    analysis_options: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Run professional-grade rocket simulation with maximum fidelity and comprehensive analysis.
    
    Args:
        fidelity: Simulation type - 'enhanced' (6-DOF), 'professional' (maximum fidelity), 
                 or 'monte_carlo' (statistical analysis)
        environment_conditions: Advanced weather and atmospheric conditions
        launch_parameters: Professional launch site and rail parameters
        analysis_options: Advanced analysis configuration
    """
    action_data = {
        "action": "run_professional_simulation",
        "fidelity": fidelity
    }
    
    if environment_conditions:
        action_data["environment"] = environment_conditions
    
    if launch_parameters:
        action_data["launch_parameters"] = launch_parameters
        
    if analysis_options:
        action_data["analysis_options"] = analysis_options
    
    return action_data

@function_tool(strict_mode=False)
def analyze_comprehensive_stability(
    include_static_analysis: bool = True,
    include_dynamic_analysis: bool = True,
    include_cp_cm_analysis: bool = True,
    wind_conditions: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    Perform comprehensive stability analysis using professional RocketPy capabilities.
    
    Args:
        include_static_analysis: Calculate static stability margin
        include_dynamic_analysis: Perform dynamic stability analysis
        include_cp_cm_analysis: Analyze center of pressure and center of mass
        wind_conditions: Wind conditions for stability analysis under load
    """
    return {
        "action": "analyze_comprehensive_stability",
        "include_static_analysis": include_static_analysis,
        "include_dynamic_analysis": include_dynamic_analysis,
        "include_cp_cm_analysis": include_cp_cm_analysis,
        "wind_conditions": wind_conditions
    }

@function_tool(strict_mode=False)
def analyze_comprehensive_performance(
    include_thrust_analysis: bool = True,
    include_aerodynamic_analysis: bool = True,
    include_efficiency_metrics: bool = True,
    include_optimization_suggestions: bool = True
) -> Dict[str, Any]:
    """
    Perform comprehensive performance analysis with professional metrics.
    
    Args:
        include_thrust_analysis: Analyze motor performance and thrust characteristics
        include_aerodynamic_analysis: Analyze drag, lift, and aerodynamic efficiency
        include_efficiency_metrics: Calculate specific impulse, TWR, and other metrics
        include_optimization_suggestions: Provide design optimization recommendations
    """
    return {
        "action": "analyze_comprehensive_performance",
        "include_thrust_analysis": include_thrust_analysis,
        "include_aerodynamic_analysis": include_aerodynamic_analysis,
        "include_efficiency_metrics": include_efficiency_metrics,
        "include_optimization_suggestions": include_optimization_suggestions
    }

@function_tool(strict_mode=False)
def optimize_rocket_design(
    optimization_target: Literal["max_altitude", "stability_margin", "landing_accuracy", "efficiency"] = "max_altitude",
    constraints: Optional[Dict[str, Any]] = None,
    optimization_method: Literal["gradient_descent", "genetic_algorithm", "grid_search", "professional"] = "professional"
) -> Dict[str, Any]:
    """
    Optimize rocket design using professional algorithms and RocketPy analysis.
    
    Args:
        optimization_target: What to optimize - altitude, stability, accuracy, or efficiency
        constraints: Design constraints (mass limits, size limits, material constraints)
        optimization_method: Algorithm to use for optimization
    """
    return {
        "action": "optimize_rocket_design",
        "target": optimization_target,
        "constraints": constraints or {},
        "method": optimization_method
    }

@function_tool(strict_mode=False)
def run_advanced_monte_carlo(
    iterations: int = 500,
    parameter_variations: Optional[List[Dict[str, Any]]] = None,
    analyze_dispersion: bool = True,
    include_sensitivity_analysis: bool = True,
    confidence_level: float = 0.95
) -> Dict[str, Any]:
    """
    Run advanced Monte Carlo simulation with professional statistical analysis.
    
    Args:
        iterations: Number of simulation runs (100-2000 recommended for professional use)
        parameter_variations: Advanced parameter variations with realistic distributions
        analyze_dispersion: Calculate comprehensive landing dispersion statistics
        include_sensitivity_analysis: Perform sensitivity analysis on key parameters
        confidence_level: Statistical confidence level for results (0.90-0.99)
    """
    # Professional parameter variations if none provided
    if parameter_variations is None:
        parameter_variations = [
            {
                "parameter": "environment.windSpeed",
                "distribution": "normal",
                "parameters": [3.0, 2.0]  # 3 m/s mean, 2 m/s std
            },
            {
                "parameter": "environment.windDirection",
                "distribution": "uniform",
                "parameters": [0, 360]  # Random wind direction
            },
            {
                "parameter": "rocket.Cd",
                "distribution": "normal", 
                "parameters": [0.5, 0.03]  # Mean 0.5, std 0.03 (6% variation)
            },
            {
                "parameter": "launch.inclination",
                "distribution": "normal",
                "parameters": [85, 1.5]  # 85° ± 1.5° (professional tolerance)
            },
            {
                "parameter": "rocket.parts.body.length",
                "distribution": "normal",
                "parameters": [1.0, 0.02]  # 2% manufacturing tolerance
            },
            {
                "parameter": "rocket.parts.fin.span",
                "distribution": "normal",
                "parameters": [1.0, 0.03]  # 3% manufacturing tolerance
            }
        ]
    
    return {
        "action": "run_advanced_monte_carlo",
        "iterations": iterations,
        "variations": parameter_variations,
        "analyze_dispersion": analyze_dispersion,
        "include_sensitivity_analysis": include_sensitivity_analysis,
        "confidence_level": confidence_level
    }

@function_tool(strict_mode=False)
def set_professional_environment(
    latitude: float = 0.0,
    longitude: float = 0.0,
    elevation: float = 0.0,
    atmospheric_model: Literal["standard", "forecast", "custom", "research"] = "forecast",
    wind_model: Literal["constant", "linear", "realistic", "turbulent"] = "realistic",
    wind_speed: float = 0.0,
    wind_direction: float = 0.0,
    temperature_offset: float = 0.0,
    pressure_offset: float = 0.0,
    date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Set professional environmental conditions with advanced atmospheric modeling.
    
    Args:
        latitude: Launch site latitude in degrees (high precision)
        longitude: Launch site longitude in degrees (high precision)
        elevation: Elevation above sea level in meters
        atmospheric_model: Advanced atmospheric model type
        wind_model: Professional wind modeling approach
        wind_speed: Surface wind speed in m/s
        wind_direction: Wind direction in degrees (0 = North)
        temperature_offset: Temperature offset from standard atmosphere (°C)
        pressure_offset: Pressure offset from standard atmosphere (Pa)
        date: Date for weather forecast (ISO format with timezone)
    """
    return {
        "action": "set_professional_environment",
        "latitude": latitude,
        "longitude": longitude,
        "elevation": elevation,
        "atmospheric_model": atmospheric_model,
        "wind_model": wind_model,
        "wind_speed": wind_speed,
        "wind_direction": wind_direction,
        "temperature_offset": temperature_offset,
        "pressure_offset": pressure_offset,
        "date": date
    }

@function_tool(strict_mode=False)
def analyze_motor_performance_detailed(
    motor_id: str,
    analyze_thrust_curve: bool = True,
    analyze_efficiency: bool = True,
    analyze_grain_geometry: bool = True,
    analyze_nozzle_performance: bool = True,
    compare_alternatives: bool = True
) -> Dict[str, Any]:
    """
    Perform detailed motor performance analysis using professional RocketPy capabilities.
    
    Args:
        motor_id: ID of the motor to analyze
        analyze_thrust_curve: Detailed thrust curve analysis with phases
        analyze_efficiency: Calculate combustion and nozzle efficiency
        analyze_grain_geometry: Analyze grain geometry and burn characteristics
        analyze_nozzle_performance: Analyze nozzle design and performance
        compare_alternatives: Compare with alternative motor options
    """
    return {
        "action": "analyze_motor_performance_detailed",
        "motor_id": motor_id,
        "analyze_thrust_curve": analyze_thrust_curve,
        "analyze_efficiency": analyze_efficiency,
        "analyze_grain_geometry": analyze_grain_geometry,
        "analyze_nozzle_performance": analyze_nozzle_performance,
        "compare_alternatives": compare_alternatives
    }

@function_tool(strict_mode=False)
def generate_flight_report(
    include_executive_summary: bool = True,
    include_detailed_analysis: bool = True,
    include_recommendations: bool = True,
    include_safety_analysis: bool = True,
    include_certification_data: bool = False,
    report_format: Literal["professional", "competition", "research", "certification"] = "professional"
) -> Dict[str, Any]:
    """
    Generate comprehensive flight analysis report with professional documentation.
    
    Args:
        include_executive_summary: Include executive summary with key findings
        include_detailed_analysis: Include detailed technical analysis
        include_recommendations: Include design and performance recommendations
        include_safety_analysis: Include safety margin and risk analysis
        include_certification_data: Include data for certification requirements
        report_format: Format style for the report
    """
    return {
        "action": "generate_flight_report",
        "include_executive_summary": include_executive_summary,
        "include_detailed_analysis": include_detailed_analysis,
        "include_recommendations": include_recommendations,
        "include_safety_analysis": include_safety_analysis,
        "include_certification_data": include_certification_data,
        "report_format": report_format
    }

@function_tool(strict_mode=False)
def validate_design_requirements(
    safety_requirements: Optional[Dict[str, Any]] = None,
    performance_requirements: Optional[Dict[str, Any]] = None,
    regulatory_requirements: Optional[Dict[str, Any]] = None,
    competition_requirements: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Validate rocket design against professional requirements and standards.
    
    Args:
        safety_requirements: Safety margin and risk requirements
        performance_requirements: Performance targets and constraints
        regulatory_requirements: Regulatory compliance requirements (NAR, TRA, etc.)
        competition_requirements: Competition-specific requirements
    """
    return {
        "action": "validate_design_requirements",
        "safety_requirements": safety_requirements or {
            "min_stability_margin": 1.0,
            "max_acceleration": 15.0,  # G's
            "min_recovery_altitude": 150.0  # meters
        },
        "performance_requirements": performance_requirements or {
            "min_altitude": 100.0,
            "target_altitude": 500.0,
            "max_drift": 500.0  # meters
        },
        "regulatory_requirements": regulatory_requirements or {
            "max_motor_impulse": "H",
            "max_weight": 1.5,  # kg
            "recovery_required": True
        },
        "competition_requirements": competition_requirements
    } 