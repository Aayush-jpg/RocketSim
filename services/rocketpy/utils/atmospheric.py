"""
Atmospheric correction and modeling utilities.

This module provides functions for atmospheric profile correction,
monotonic pressure profile enforcement, and atmospheric model configuration.
"""

import numpy as np
from typing import Dict, Any, Tuple
from scipy.ndimage import uniform_filter1d
from config.logging import logger, dbg_enter, dbg_exit
from config.constants import AtmosphericConfig

def ensure_monotonic_pressure_profile(pressure_data: np.ndarray, 
                                    altitude_data: np.ndarray, 
                                    smoothing_window: int = 5) -> Tuple[np.ndarray, np.ndarray]:
    """
    CRITICAL for high-altitude simulations (50-100 km)!
    
    Ensure pressure profile is monotonically decreasing with altitude.
    This function addresses the 'Function is not bijective' error that occurs
    when NRLMSISE atmospheric models produce non-monotonic pressure profiles
    due to temperature inversions or atmospheric disturbances in the mesosphere/thermosphere.
    
    Args:
        pressure_data: Pressure values in Pa
        altitude_data: Altitude values in m
        smoothing_window: Window size for smoothing filter
        
    Returns:
        Tuple of (smoothed_pressure, altitude) arrays ensuring monotonicity
    """
    try:
        logger.info(f"🌡️ Ensuring monotonic pressure profile for {len(altitude_data)} altitude points")
        
        # Convert to numpy arrays if needed
        pressure_data = np.asarray(pressure_data)
        altitude_data = np.asarray(altitude_data)
        
        # Sort by altitude to ensure proper ordering
        sorted_indices = np.argsort(altitude_data)
        alt_sorted = altitude_data[sorted_indices]
        press_sorted = pressure_data[sorted_indices]
        
        # Check for non-monotonic pressure issues
        pressure_diff = np.diff(press_sorted)
        non_monotonic_count = np.sum(pressure_diff >= 0)
        
        if non_monotonic_count > 0:
            logger.warning(f"⚠️ Found {non_monotonic_count} non-monotonic pressure points in atmospheric profile")
            logger.info("🔧 Applying atmospheric profile correction for high-altitude simulation")
        
        # Apply smoothing to reduce oscillations (especially important for NRLMSISE-00)
        if len(press_sorted) > smoothing_window:
            press_smoothed = uniform_filter1d(press_sorted, size=smoothing_window, mode='nearest')
            logger.info(f"✅ Applied smoothing filter with window size {smoothing_window}")
        else:
            press_smoothed = press_sorted.copy()
        
        # Ensure monotonic decrease with altitude
        corrections_made = 0
        for i in range(1, len(press_smoothed)):
            if press_smoothed[i] >= press_smoothed[i-1]:
                # Force monotonic decrease with small gradient
                press_smoothed[i] = press_smoothed[i-1] * 0.999
                corrections_made += 1
        
        if corrections_made > 0:
            logger.info(f"🔧 Made {corrections_made} monotonic corrections to pressure profile")
        
        # Verify the result is now monotonic
        pressure_diff = np.diff(press_smoothed)
        if not np.all(pressure_diff < 0):
            logger.warning("⚠️ Profile still not monotonic after correction, using linear interpolation fallback")
            # Fallback: create strictly monotonic profile using interpolation
            target_pressures = np.linspace(press_smoothed[0], press_smoothed[-1], len(press_smoothed))
            # Ensure strictly decreasing
            for i in range(1, len(target_pressures)):
                if target_pressures[i] >= target_pressures[i-1]:
                    target_pressures[i] = target_pressures[i-1] * 0.999
            press_smoothed = target_pressures
            logger.info("✅ Applied linear interpolation fallback for monotonic profile")
        
        logger.info(f"✅ Monotonic pressure profile ensured: {alt_sorted[0]:.0f}m to {alt_sorted[-1]:.0f}m")
        return press_smoothed, alt_sorted
        
    except Exception as e:
        logger.error(f"❌ Error in pressure profile smoothing: {e}")
        logger.warning("🔄 Returning original atmospheric data (may cause bijective errors)")
        # Return original data if smoothing fails
        return pressure_data, altitude_data

async def get_atmospheric_models() -> Dict[str, Any]:
    """
    Get atmospheric modeling options for simulation configuration
    
    Returns:
        Dictionary containing available atmospheric models and their capabilities
    """
    dbg_enter("get_atmospheric_models")
    
    models_data = {
        "available_models": AtmosphericConfig.AVAILABLE_MODELS,
        "default_model": AtmosphericConfig.DEFAULT_MODEL,
        "descriptions": AtmosphericConfig.MODEL_DESCRIPTIONS,
        "capabilities": AtmosphericConfig.MODEL_CAPABILITIES
    }
    
    dbg_exit("get_atmospheric_models", models_count=len(models_data["available_models"]))
    return models_data

def create_standard_atmosphere_profile(max_altitude: float = 30000, 
                                     altitude_step: float = 100) -> Dict[str, np.ndarray]:
    """
    Create standard atmosphere profile data
    
    Args:
        max_altitude: Maximum altitude in meters
        altitude_step: Altitude step size in meters
        
    Returns:
        Dictionary with altitude, pressure, temperature, and density arrays
    """
    try:
        # Create altitude array
        altitudes = np.arange(0, max_altitude + altitude_step, altitude_step)
        
        # Standard atmosphere calculations
        temperatures = np.zeros_like(altitudes)
        pressures = np.zeros_like(altitudes)
        densities = np.zeros_like(altitudes)
        
        # Constants
        T0 = 288.15  # Sea level temperature (K)
        P0 = 101325.0  # Sea level pressure (Pa)
        rho0 = 1.225  # Sea level density (kg/m³)
        L = 0.0065  # Lapse rate (K/m)
        g = 9.80665  # Gravity (m/s²)
        R = 287.04  # Gas constant for air (J/kg/K)
        
        for i, h in enumerate(altitudes):
            if h <= 11000:  # Troposphere
                temperatures[i] = T0 - L * h
                pressures[i] = P0 * (temperatures[i] / T0) ** (g / (R * L))
                densities[i] = rho0 * (temperatures[i] / T0) ** ((g / (R * L)) - 1)
            else:  # Stratosphere (simplified)
                temperatures[i] = 216.65  # Constant temperature
                pressures[i] = 22632.1 * np.exp(-g * (h - 11000) / (R * temperatures[i]))
                densities[i] = pressures[i] / (R * temperatures[i])
        
        return {
            "altitude": altitudes,
            "temperature": temperatures,
            "pressure": pressures,
            "density": densities
        }
        
    except Exception as e:
        logger.error(f"Error creating standard atmosphere profile: {e}")
        # Return minimal profile
        return {
            "altitude": np.array([0, max_altitude]),
            "temperature": np.array([288.15, 216.65]),
            "pressure": np.array([101325.0, 1000.0]),
            "density": np.array([1.225, 0.01])
        }

def interpolate_atmospheric_data(altitude_target: float, 
                               altitude_data: np.ndarray,
                               property_data: np.ndarray) -> float:
    """
    Interpolate atmospheric property at target altitude
    
    Args:
        altitude_target: Target altitude for interpolation
        altitude_data: Array of altitude values
        property_data: Array of atmospheric property values
        
    Returns:
        Interpolated property value
    """
    try:
        # Ensure data is sorted by altitude
        sorted_indices = np.argsort(altitude_data)
        alt_sorted = altitude_data[sorted_indices]
        prop_sorted = property_data[sorted_indices]
        
        # Interpolate
        interpolated_value = np.interp(altitude_target, alt_sorted, prop_sorted)
        return float(interpolated_value)
        
    except Exception as e:
        logger.error(f"Error interpolating atmospheric data: {e}")
        # Return first value as fallback
        return float(property_data[0]) if len(property_data) > 0 else 0.0

def validate_atmospheric_profile(pressure_data: np.ndarray, 
                               altitude_data: np.ndarray,
                               temperature_data: np.ndarray = None) -> Dict[str, Any]:
    """
    Validate atmospheric profile data for consistency
    
    Args:
        pressure_data: Pressure values in Pa
        altitude_data: Altitude values in m
        temperature_data: Optional temperature values in K
        
    Returns:
        Dictionary with validation results and issues
    """
    issues = []
    warnings = []
    
    try:
        # Check array lengths
        if len(pressure_data) != len(altitude_data):
            issues.append("Pressure and altitude arrays have different lengths")
        
        if temperature_data is not None and len(temperature_data) != len(altitude_data):
            issues.append("Temperature and altitude arrays have different lengths")
        
        # Check for valid ranges
        if np.any(pressure_data <= 0):
            issues.append("Non-positive pressure values found")
        
        if np.any(altitude_data < 0):
            issues.append("Negative altitude values found")
        
        if temperature_data is not None and np.any(temperature_data <= 0):
            issues.append("Non-positive temperature values found")
        
        # Check for monotonicity
        pressure_diff = np.diff(pressure_data[np.argsort(altitude_data)])
        if np.any(pressure_diff >= 0):
            warnings.append("Non-monotonic pressure profile detected (may cause bijective errors)")
        
        # Check for reasonable values
        if np.max(pressure_data) > 200000:  # > 2 atm
            warnings.append("Unusually high pressure values detected")
        
        if np.min(pressure_data) < 0.1:  # < 0.1 Pa
            warnings.append("Unusually low pressure values detected")
        
        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "warnings": warnings,
            "data_points": len(altitude_data),
            "altitude_range": [float(np.min(altitude_data)), float(np.max(altitude_data))],
            "pressure_range": [float(np.min(pressure_data)), float(np.max(pressure_data))]
        }
        
    except Exception as e:
        return {
            "valid": False,
            "issues": [f"Validation error: {e}"],
            "warnings": [],
            "data_points": 0,
            "altitude_range": [0, 0],
            "pressure_range": [0, 0]
        }

def correct_atmospheric_discontinuities(altitude_data: np.ndarray,
                                     pressure_data: np.ndarray,
                                     temperature_data: np.ndarray = None,
                                     max_jump_ratio: float = 1.5) -> Dict[str, np.ndarray]:
    """
    Correct sudden discontinuities in atmospheric data
    
    Args:
        altitude_data: Altitude values in m
        pressure_data: Pressure values in Pa
        temperature_data: Optional temperature values in K
        max_jump_ratio: Maximum allowed ratio between consecutive values
        
    Returns:
        Dictionary with corrected atmospheric data
    """
    try:
        # Sort data by altitude
        sorted_indices = np.argsort(altitude_data)
        alt_corrected = altitude_data[sorted_indices].copy()
        press_corrected = pressure_data[sorted_indices].copy()
        temp_corrected = temperature_data[sorted_indices].copy() if temperature_data is not None else None
        
        # Correct pressure discontinuities
        corrections_made = 0
        for i in range(1, len(press_corrected)):
            ratio = press_corrected[i-1] / press_corrected[i] if press_corrected[i] > 0 else float('inf')
            if ratio > max_jump_ratio:
                # Smooth the discontinuity
                press_corrected[i] = press_corrected[i-1] / max_jump_ratio
                corrections_made += 1
        
        # Correct temperature discontinuities if provided
        if temp_corrected is not None:
            for i in range(1, len(temp_corrected)):
                temp_diff = abs(temp_corrected[i] - temp_corrected[i-1])
                if temp_diff > 50:  # > 50K jump
                    # Smooth the discontinuity
                    temp_corrected[i] = temp_corrected[i-1] + np.sign(temp_corrected[i] - temp_corrected[i-1]) * 50
                    corrections_made += 1
        
        if corrections_made > 0:
            logger.info(f"🔧 Corrected {corrections_made} atmospheric discontinuities")
        
        result = {
            "altitude": alt_corrected,
            "pressure": press_corrected
        }
        
        if temp_corrected is not None:
            result["temperature"] = temp_corrected
        
        return result
        
    except Exception as e:
        logger.error(f"Error correcting atmospheric discontinuities: {e}")
        # Return original data
        result = {
            "altitude": altitude_data,
            "pressure": pressure_data
        }
        if temperature_data is not None:
            result["temperature"] = temperature_data
        return result