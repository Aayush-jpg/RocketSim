"""
Enhanced simulation environment class.

This module provides the EnhancedSimulationEnvironment class which extends
the base SimulationEnvironment with advanced atmospheric modeling capabilities.
"""

import numpy as np
from datetime import datetime
from typing import Dict, Any

from config import ROCKETPY_AVAILABLE, logger
from models.environment import EnvironmentModel
from simulation.core.environment import SimulationEnvironment

if ROCKETPY_AVAILABLE:
    from rocketpy import Environment

class EnhancedSimulationEnvironment(SimulationEnvironment):
    """Enhanced environment with full atmospheric modeling capabilities"""
    
    def __init__(self, config: EnvironmentModel):
        # Initializes self.env and sets atmospheric model via parent
        super().__init__(config)
        
        if not ROCKETPY_AVAILABLE or not self.env:
            return
            
    def _apply_wind_model(self, config: EnvironmentModel):
        """
        OVERRIDE: Applies the ADVANCED wind model for the enhanced simulation
        if no wind data has been set by a detailed profile.
        """
        if self.env.wind_velocity_x(0) == 0 and self.env.wind_velocity_y(0) == 0:
            if config.wind_speed_m_s and config.wind_speed_m_s > 0:
                self._setup_wind_profile(config)
    
    def _setup_wind_profile(self, config: EnvironmentModel):
        """Setup realistic wind profile with correct meteorological coordinate conversion and boundary layer effects"""
        if not config.wind_speed_m_s or config.wind_speed_m_s <= 0:
            return
            
        try:
            # Create realistic wind profile with altitude variation
            wind_speed = config.wind_speed_m_s
            wind_direction = config.wind_direction_deg or 0
            
            # CRITICAL FIX: Correct meteorological to Cartesian coordinate conversion
            direction_to = wind_direction + 180.0
            
            # Convert to u, v components (u=East, v=North)
            wind_u_surface = wind_speed * np.sin(np.radians(direction_to))
            wind_v_surface = wind_speed * np.cos(np.radians(direction_to))
            
            # Create realistic altitude-varying wind profile with boundary layer effects
            altitudes = [0, 10, 50, 100, 500, 1000, 2000, 5000, 10000, 15000]
            wind_u_profile = []
            wind_v_profile = []
            
            for alt in altitudes:
                if alt <= 1000: # Atmospheric boundary layer
                    alpha = 0.15  # For open terrain
                    z_ref = 10.0
                    altitude_factor = (alt / z_ref) ** alpha if alt > 0 else 0
                else: # Free atmosphere
                    base_factor = (1000 / 10.0) ** alpha
                    altitude_factor = base_factor * (1 + (alt - 1000) / 10000 * 0.5)

                u_at_alt = wind_u_surface * altitude_factor
                v_at_alt = wind_v_surface * altitude_factor
                
                wind_u_profile.append((alt, u_at_alt))
                wind_v_profile.append((alt, v_at_alt))
            
            self.env.set_atmospheric_model(
                type='custom_atmosphere',
                wind_u=wind_u_profile,
                wind_v=wind_v_profile
            )
            
            logger.info(f"Set realistic wind profile: {wind_speed} m/s from {wind_direction}° with boundary layer effects")
            
        except Exception as e:
            logger.warning(f"Failed to set enhanced wind profile: {e}")
    
    def _setup_weather_forecast(self, config: EnvironmentModel):
        """Setup weather forecast integration"""
        if config.date and config.atmospheric_model == "forecast":
            try:
                # Set date for forecast
                date_obj = datetime.fromisoformat(config.date.replace('Z', '+00:00'))
                self.env.set_date(date_obj, timezone=config.timezone or "UTC")
                logger.info(f"Set forecast date: {config.date}")
            except Exception as e:
                logger.warning(f"Failed to set forecast date: {e}")