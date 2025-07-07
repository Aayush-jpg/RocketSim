"""
Input validation utilities for RocketPy simulation service.

This module provides validation functions for coordinates, motor IDs,
atmospheric models, and other input parameters.
"""

import re
from typing import List, Dict, Any, Optional, Tuple
from config.logging import logger
from config.constants import AtmosphericConfig

def validate_coordinates(latitude: float, longitude: float) -> Tuple[bool, Optional[str]]:
    """
    Validate latitude and longitude coordinates
    
    Args:
        latitude: Latitude in degrees (-90 to 90)
        longitude: Longitude in degrees (-180 to 180)
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        # Check latitude range
        if not (-90.0 <= latitude <= 90.0):
            return False, f"Latitude {latitude} out of range (-90° to 90°)"
        
        # Check longitude range
        if not (-180.0 <= longitude <= 180.0):
            return False, f"Longitude {longitude} out of range (-180° to 180°)"
        
        # Check for exactly (0,0) coordinates (known NRLMSISE issues)
        if abs(latitude) < 0.01 and abs(longitude) < 0.01:
            logger.warning("⚠️ Coordinates very close to (0,0) - NRLMSISE may be unreliable")
        
        return True, None
        
    except (TypeError, ValueError) as e:
        return False, f"Invalid coordinate format: {e}"

def validate_motor_id(motor_id: str, motor_database: Dict[str, Any]) -> Tuple[bool, Optional[str], Optional[List[str]]]:
    """
    Validate motor ID exists in database
    
    Args:
        motor_id: Motor identifier to validate
        motor_database: Motor database dictionary
        
    Returns:
        Tuple of (is_valid, error_message, available_motors)
    """
    try:
        if not motor_id:
            return False, "Motor ID cannot be empty", list(motor_database.keys())
        
        if motor_id in motor_database:
            return True, None, None
        
        # Motor not found
        available_motors = list(motor_database.keys())
        return False, f"Motor ID '{motor_id}' not found", available_motors
        
    except Exception as e:
        return False, f"Motor validation error: {e}", []

def validate_atmospheric_model(model_name: str) -> Tuple[bool, Optional[str]]:
    """
    Validate atmospheric model name
    
    Args:
        model_name: Atmospheric model identifier
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        if not model_name:
            return False, "Atmospheric model cannot be empty"
        
        if model_name.lower() in AtmosphericConfig.AVAILABLE_MODELS:
            return True, None
        
        available_models = ", ".join(AtmosphericConfig.AVAILABLE_MODELS)
        return False, f"Atmospheric model '{model_name}' not supported. Available: {available_models}"
        
    except Exception as e:
        return False, f"Atmospheric model validation error: {e}"

def validate_altitude_range(min_altitude: float, max_altitude: float, model_name: str = "standard") -> Tuple[bool, Optional[str]]:
    """
    Validate altitude range for given atmospheric model
    
    Args:
        min_altitude: Minimum altitude in meters
        max_altitude: Maximum altitude in meters
        model_name: Atmospheric model name
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        # Basic range checks
        if min_altitude < 0:
            return False, "Minimum altitude cannot be negative"
        
        if max_altitude <= min_altitude:
            return False, "Maximum altitude must be greater than minimum altitude"
        
        # Model-specific range checks
        if model_name.lower() in AtmosphericConfig.MODEL_CAPABILITIES:
            model_range = AtmosphericConfig.MODEL_CAPABILITIES[model_name.lower()]["altitude_range_m"]
            
            if max_altitude > model_range[1]:
                return False, f"Maximum altitude {max_altitude}m exceeds {model_name} model limit of {model_range[1]}m"
            
            if min_altitude < model_range[0]:
                return False, f"Minimum altitude {min_altitude}m below {model_name} model minimum of {model_range[0]}m"
        
        return True, None
        
    except Exception as e:
        return False, f"Altitude range validation error: {e}"

def validate_simulation_parameters(parameters: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """
    Validate simulation parameters
    
    Args:
        parameters: Dictionary of simulation parameters
        
    Returns:
        Tuple of (is_valid, list_of_errors)
    """
    errors = []
    
    try:
        # Validate time parameters
        if "max_time" in parameters:
            max_time = parameters["max_time"]
            if max_time <= 0:
                errors.append("Maximum simulation time must be positive")
            elif max_time > 3600:  # 1 hour limit
                errors.append("Maximum simulation time cannot exceed 3600 seconds")
        
        # Validate tolerance parameters
        if "rtol" in parameters:
            rtol = parameters["rtol"]
            if rtol <= 0 or rtol >= 1:
                errors.append("Relative tolerance must be between 0 and 1")
        
        if "atol" in parameters:
            atol = parameters["atol"]
            if atol <= 0:
                errors.append("Absolute tolerance must be positive")
        
        # Validate step size parameters
        if "max_step" in parameters:
            max_step = parameters["max_step"]
            if max_step <= 0:
                errors.append("Maximum step size must be positive")
        
        # Validate rail length
        if "rail_length" in parameters:
            rail_length = parameters["rail_length"]
            if rail_length <= 0:
                errors.append("Rail length must be positive")
            elif rail_length > 100:  # 100m rail limit
                errors.append("Rail length cannot exceed 100 meters")
        
        # Validate inclination
        if "inclination" in parameters:
            inclination = parameters["inclination"]
            if not (0 <= inclination <= 90):
                errors.append("Launch inclination must be between 0° and 90°")
        
        # Validate heading
        if "heading" in parameters:
            heading = parameters["heading"]
            if not (0 <= heading < 360):
                errors.append("Launch heading must be between 0° and 360°")
        
        return len(errors) == 0, errors
        
    except Exception as e:
        return False, [f"Parameter validation error: {e}"]

def validate_rocket_mass(dry_mass: float, propellant_mass: float) -> Tuple[bool, Optional[str]]:
    """
    Validate rocket mass parameters
    
    Args:
        dry_mass: Rocket dry mass in kg
        propellant_mass: Propellant mass in kg
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        if dry_mass <= 0:
            return False, "Dry mass must be positive"
        
        if propellant_mass < 0:
            return False, "Propellant mass cannot be negative"
        
        total_mass = dry_mass + propellant_mass
        
        # Reasonable mass limits for model rockets
        if total_mass > 100:  # 100 kg limit
            return False, f"Total mass {total_mass:.2f} kg exceeds safety limit of 100 kg"
        
        if total_mass < 0.001:  # 1 gram minimum
            return False, f"Total mass {total_mass:.6f} kg too small (minimum 0.001 kg)"
        
        # Check mass ratio
        if propellant_mass > 0:
            mass_ratio = total_mass / dry_mass
            if mass_ratio > 20:
                return False, f"Mass ratio {mass_ratio:.2f} too high (maximum 20)"
        
        return True, None
        
    except Exception as e:
        return False, f"Mass validation error: {e}"

def validate_dimensions(length: float, diameter: float, dimension_type: str = "component") -> Tuple[bool, Optional[str]]:
    """
    Validate component dimensions
    
    Args:
        length: Length in meters
        diameter: Diameter in meters
        dimension_type: Type of component for context
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        if length <= 0:
            return False, f"{dimension_type} length must be positive"
        
        if diameter <= 0:
            return False, f"{dimension_type} diameter must be positive"
        
        # Reasonable dimension limits
        if length > 10:  # 10 meter limit
            return False, f"{dimension_type} length {length:.3f}m exceeds limit of 10m"
        
        if diameter > 1:  # 1 meter diameter limit
            return False, f"{dimension_type} diameter {diameter:.3f}m exceeds limit of 1m"
        
        if length < 0.001:  # 1mm minimum
            return False, f"{dimension_type} length {length:.6f}m too small (minimum 0.001m)"
        
        if diameter < 0.001:  # 1mm minimum
            return False, f"{dimension_type} diameter {diameter:.6f}m too small (minimum 0.001m)"
        
        # Check aspect ratio
        aspect_ratio = length / diameter
        if aspect_ratio > 1000:
            return False, f"{dimension_type} aspect ratio {aspect_ratio:.1f} too high (maximum 1000)"
        
        if aspect_ratio < 0.1:
            return False, f"{dimension_type} aspect ratio {aspect_ratio:.3f} too low (minimum 0.1)"
        
        return True, None
        
    except Exception as e:
        return False, f"Dimension validation error: {e}"

def validate_material_properties(density: float, material_name: str = "material") -> Tuple[bool, Optional[str]]:
    """
    Validate material density
    
    Args:
        density: Material density in kg/m³
        material_name: Name of material for context
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        if density <= 0:
            return False, f"{material_name} density must be positive"
        
        # Reasonable density limits
        if density > 20000:  # Denser than tungsten
            return False, f"{material_name} density {density:.1f} kg/m³ too high (maximum 20000)"
        
        if density < 0.1:  # Lighter than aerogel
            return False, f"{material_name} density {density:.3f} kg/m³ too low (minimum 0.1)"
        
        return True, None
        
    except Exception as e:
        return False, f"Material validation error: {e}"

def sanitize_string_input(input_string: str, max_length: int = 100, allowed_chars: str = None) -> str:
    """
    Sanitize string input for safety
    
    Args:
        input_string: Input string to sanitize
        max_length: Maximum allowed length
        allowed_chars: Regex pattern for allowed characters
        
    Returns:
        Sanitized string
    """
    try:
        if not input_string:
            return ""
        
        # Remove control characters and non-printable characters
        sanitized = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', input_string)
        
        # Apply character filter if provided
        if allowed_chars:
            sanitized = re.sub(f'[^{allowed_chars}]', '', sanitized)
        
        # Truncate to max length
        if len(sanitized) > max_length:
            sanitized = sanitized[:max_length]
        
        return sanitized.strip()
        
    except Exception as e:
        logger.error(f"String sanitization error: {e}")
        return ""

def validate_monte_carlo_parameters(iterations: int, variations: List[Dict[str, Any]]) -> Tuple[bool, List[str]]:
    """
    Validate Monte Carlo simulation parameters
    
    Args:
        iterations: Number of Monte Carlo iterations
        variations: List of parameter variations
        
    Returns:
        Tuple of (is_valid, list_of_errors)
    """
    errors = []
    
    try:
        # Validate iteration count
        if iterations <= 0:
            errors.append("Number of iterations must be positive")
        elif iterations > 10000:
            errors.append("Number of iterations cannot exceed 10000")
        
        # Validate variations
        if not variations:
            errors.append("At least one parameter variation is required")
        elif len(variations) > 50:
            errors.append("Too many parameter variations (maximum 50)")
        
        # Validate each variation
        for i, variation in enumerate(variations):
            if "parameter" not in variation:
                errors.append(f"Variation {i+1}: 'parameter' field is required")
            
            if "distribution" not in variation:
                errors.append(f"Variation {i+1}: 'distribution' field is required")
            elif variation["distribution"] not in ["normal", "uniform", "triangular"]:
                errors.append(f"Variation {i+1}: Unsupported distribution '{variation['distribution']}'")
            
            if "parameters" not in variation:
                errors.append(f"Variation {i+1}: 'parameters' field is required")
            elif not isinstance(variation["parameters"], list):
                errors.append(f"Variation {i+1}: 'parameters' must be a list")
            else:
                params = variation["parameters"]
                if variation["distribution"] == "normal" and len(params) != 2:
                    errors.append(f"Variation {i+1}: Normal distribution requires exactly 2 parameters (mean, std)")
                elif variation["distribution"] == "uniform" and len(params) != 2:
                    errors.append(f"Variation {i+1}: Uniform distribution requires exactly 2 parameters (min, max)")
                elif variation["distribution"] == "triangular" and len(params) != 3:
                    errors.append(f"Variation {i+1}: Triangular distribution requires exactly 3 parameters (min, mode, max)")
        
        return len(errors) == 0, errors
        
    except Exception as e:
        return False, [f"Monte Carlo validation error: {e}"]

def validate_body_tubes(rocket_config) -> None:
    """
    Validate rocket body tube configuration
    
    This function validates that the rocket configuration has proper body tubes
    and throws an HTTPException if validation fails.
    
    Args:
        rocket_config: RocketModel instance to validate
        
    Raises:
        HTTPException: If validation fails
    """
    from fastapi import HTTPException
    
    try:
        # Check if body tubes exist
        if not hasattr(rocket_config, 'body_tubes') or not rocket_config.body_tubes:
            raise HTTPException(
                status_code=400,
                detail="Rocket configuration must include at least one body tube"
            )
        
        # Validate each body tube
        for i, tube in enumerate(rocket_config.body_tubes):
            if tube.length_m <= 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Body tube {i+1}: Length must be positive"
                )
            
            if tube.outer_radius_m <= 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Body tube {i+1}: Outer radius must be positive"
                )
            
            if tube.wall_thickness_m <= 0:
                raise HTTPException(
                    status_code=400,
                    detail=f"Body tube {i+1}: Wall thickness must be positive"
                )
            
            if tube.wall_thickness_m >= tube.outer_radius_m:
                raise HTTPException(
                    status_code=400,
                    detail=f"Body tube {i+1}: Wall thickness cannot be greater than or equal to outer radius"
                )
        
        logger.info(f"✅ Body tube validation passed for {len(rocket_config.body_tubes)} tubes")
        
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        logger.error(f"❌ Body tube validation error: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Body tube validation failed: {str(e)}"
        )