"""Weather and launch condition assessment tools for rocket agents."""

import json
from typing import Dict, Any, Optional, List
from agents import function_tool
import requests
import os
from datetime import datetime, timedelta
import math

@function_tool(strict_mode=False)
def get_current_weather(
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    use_user_location: bool = True
) -> Dict[str, Any]:
    """
    Get current weather conditions for launch site assessment.
    
    Args:
        latitude: Latitude of launch site (if not provided, uses user location)
        longitude: Longitude of launch site (if not provided, uses user location)
        use_user_location: Whether to use user's current location
    """
    action_data = {
        "action": "get_weather",
        "latitude": latitude,
        "longitude": longitude,
        "use_user_location": use_user_location
    }
    
    return action_data

@function_tool(strict_mode=False)
def assess_launch_conditions(
    include_weather: bool = True,
    safety_level: str = "standard",
    mission_type: str = "recreational"
) -> Dict[str, Any]:
    """
    Assess current conditions for rocket launch safety and success.
    
    Args:
        include_weather: Whether to include real-time weather assessment
        safety_level: Safety assessment level ('basic', 'standard', 'strict')
        mission_type: Type of mission ('recreational', 'educational', 'competitive')
    """
    action_data = {
        "action": "assess_launch_conditions",
        "include_weather": include_weather,
        "safety_level": safety_level,
        "mission_type": mission_type
    }
    
    return action_data

@function_tool(strict_mode=False)
def get_weather_forecast(
    hours_ahead: int = 24,
    include_wind_profile: bool = True,
    location_override: Optional[Dict[str, float]] = None
) -> Dict[str, Any]:
    """
    Get weather forecast for planning future launches.
    
    Args:
        hours_ahead: How many hours ahead to forecast (default 24)
        include_wind_profile: Whether to include wind conditions at altitude
        location_override: Override location {latitude, longitude}
    """
    action_data = {
        "action": "get_forecast",
        "hours_ahead": hours_ahead,
        "include_wind_profile": include_wind_profile,
        "location_override": location_override
    }
    
    return action_data

@function_tool(strict_mode=False)
def analyze_atmospheric_conditions(
    max_altitude: Optional[float] = None,
    include_wind_shear: bool = True,
    density_altitude: bool = True
) -> Dict[str, Any]:
    """
    Analyze atmospheric conditions for rocket flight path prediction.
    
    Args:
        max_altitude: Expected maximum altitude in meters
        include_wind_shear: Whether to analyze wind shear conditions
        density_altitude: Whether to calculate density altitude effects
    """
    action_data = {
        "action": "analyze_atmosphere",
        "max_altitude": max_altitude,
        "include_wind_shear": include_wind_shear,
        "density_altitude": density_altitude
    }
    
    return action_data

@function_tool(strict_mode=False)
def recommend_launch_window(
    duration_hours: int = 6,
    min_conditions: Optional[Dict[str, Any]] = None,
    preferred_conditions: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Find optimal launch windows based on weather conditions.
    
    Args:
        duration_hours: How many hours to analyze (default 6)
        min_conditions: Minimum acceptable conditions
        preferred_conditions: Preferred optimal conditions
    """
    action_data = {
        "action": "recommend_launch_window",
        "duration_hours": duration_hours,
        "min_conditions": min_conditions or {
            "max_wind_speed": 10,  # m/s
            "min_visibility": 5,   # km
            "max_precipitation": 0 # mm/h
        },
        "preferred_conditions": preferred_conditions or {
            "max_wind_speed": 5,   # m/s
            "min_visibility": 10,  # km
            "max_cloud_cover": 25, # %
            "temperature_range": [5, 30]  # °C
        }
    }
    
    return action_data

@function_tool(strict_mode=False)
def set_location(
    latitude: float,
    longitude: float,
    elevation: Optional[float] = None,
    name: Optional[str] = None
) -> Dict[str, Any]:
    """
    Set launch site location for weather and atmospheric calculations.
    
    Args:
        latitude: Latitude in decimal degrees
        longitude: Longitude in decimal degrees
        elevation: Elevation above sea level in meters
        name: Human-readable name for the location
    """
    action_data = {
        "action": "set_location",
        "latitude": latitude,
        "longitude": longitude,
        "elevation": elevation,
        "name": name
    }
    
    return action_data 