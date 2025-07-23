"""
Core simulation environment class.

This module provides the SimulationEnvironment class which wraps RocketPy's
Environment with enhanced features, error handling, and atmospheric modeling.
"""

import os
import json
import numpy as np
import requests
import signal
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from scipy import interpolate
from scipy.ndimage import uniform_filter1d

from config import ROCKETPY_AVAILABLE, logger, dbg_enter, dbg_exit
from models.environment import EnvironmentModel, AtmosphericProfileModel
from utils.atmospheric import ensure_monotonic_pressure_profile

if ROCKETPY_AVAILABLE:
    from rocketpy import Environment

class SimulationEnvironment:
    """Wrapper for RocketPy Environment with enhanced features"""
    
    def __init__(self, config: EnvironmentModel):
        dbg_enter("SimulationEnvironment.__init__", model=config.atmospheric_model, lat=config.latitude_deg, lon=config.longitude_deg)
        if not ROCKETPY_AVAILABLE:
            self.env = None
            dbg_exit("SimulationEnvironment.__init__", reason="RocketPy not available")
            return
            
        self.config = config
        self.env = Environment(
            latitude=config.latitude_deg,
            longitude=config.longitude_deg,
            elevation=config.elevation_m
        )
        
        # ✅ CRITICAL FIX: Set date if provided using correct RocketPy format
        if config.date:
            try:
                # Parse date string and extract components for RocketPy
                date_str = config.date
                
                # Handle various date formats
                if 'T' in date_str:
                    # Handle datetime format like "2025-06-19T19:07:04.724Z"
                    date_str = date_str.split('T')[0]
                
                # Remove any remaining time zone indicators
                date_str = date_str.replace('Z', '').strip()
                
                # Handle corrupted date strings (extract valid date part)
                if len(date_str) < 10 or not date_str.count('-') >= 2:
                    # Handle cases like "20T18:13:18.906Z" - try to reconstruct
                    logger.warning(f"⚠️ Corrupted date string detected: '{config.date}', using current date as fallback")
                    # Use current date as fallback for corrupted strings
                    now = datetime.now()
                    year, month, day = now.year, now.month, now.day
                else:
                    # Normal date parsing
                    date_parts = date_str.split('-')
                    if len(date_parts) >= 3:
                        # Validate year part - should be 4 digits
                        year_str = date_parts[0].strip()
                        if len(year_str) != 4 or not year_str.isdigit():
                            raise ValueError(f"Invalid year format: {year_str}")
                        
                        year = int(year_str)
                        month = int(date_parts[1])
                        day = int(date_parts[2])
                    else:
                        raise ValueError(f"Invalid date format: {date_str}")
                
                # ✅ FIXED: Use RocketPy's set_date method with tuple format
                self.env.set_date((year, month, day))
                logger.info(f"✅ Environment date set to: {year}-{month:02d}-{day:02d}")
            except Exception as e:
                logger.warning(f"⚠️ Failed to parse date '{config.date}': {e}, using current date")
                # Fallback to current date
                now = datetime.now()
                self.env.set_date((now.year, now.month, now.day))
                logger.info(f"✅ Fallback date set to: {now.strftime('%Y-%m-%d')}")
        else:
            # Set current date if no date provided
            try:
                now = datetime.now()
                self.env.set_date((now.year, now.month, now.day))
                logger.info(f"✅ Default date set to current: {now.strftime('%Y-%m-%d')}")
            except Exception as e:
                logger.warning(f"⚠️ Failed to set default date: {e}")
        
        # --- RESTRUCTURED LOGIC: Prioritize the selected atmospheric model ---

        model_type = config.atmospheric_model
        logger.info(f"🌐 Selected atmospheric model after precedence checks: {model_type}")

        # Apply atmospheric model using the safe method with comprehensive error handling
        self._apply_atmospheric_model_safe(config)
                
        # Apply wind to the environment if available
        if config.wind_speed_m_s and config.wind_speed_m_s > 0:
            self._apply_wind_model(config)

        dbg_exit("SimulationEnvironment.__init__", effective_model=model_type)
    
    def _apply_wind_model(self, config: EnvironmentModel):
        """Apply wind model to environment with correct meteorological coordinate conversion"""
        if not self.env:
            return
            
        try:
            # Convert meteorological direction (FROM) to Cartesian components
            direction_to = config.wind_direction_deg + 180.0
            wind_u = config.wind_speed_m_s * np.sin(np.radians(direction_to))  # East component
            wind_v = config.wind_speed_m_s * np.cos(np.radians(direction_to))  # North component
            
            # Create wind profile (constant wind)
            wind_u_profile = [
                (0, wind_u),
                (1000, wind_u),
                (10000, wind_u * 1.5)  # Stronger at altitude
            ]
            
            wind_v_profile = [
                (0, wind_v),
                (1000, wind_v),
                (10000, wind_v * 1.5)  # Stronger at altitude
            ]
            
            self.env.set_atmospheric_model(
                type='custom_atmosphere',
                wind_u=wind_u_profile,
                wind_v=wind_v_profile
            )
            logger.info(f"✅ Applied wind: {config.wind_speed_m_s} m/s from {config.wind_direction_deg}°")
        except Exception as e:
            logger.warning(f"⚠️ Failed to apply wind model: {e}")

    def _apply_atmospheric_model_safe(self, environment: EnvironmentModel):
        """Apply atmospheric model with comprehensive error handling and fallbacks"""
        try:
            if environment.atmospheric_model == "nrlmsise":
                logger.info("🌍 Attempting NRLMSISE-00 atmospheric model...")
                
                # Check if we have valid coordinates
                if abs(environment.latitude_deg) > 90 or abs(environment.longitude_deg) > 180:
                    logger.warning(f"⚠️ Invalid coordinates for NRLMSISE: {environment.latitude_deg}, {environment.longitude_deg}")
                    logger.info("🔄 Falling back to standard atmosphere")
                    self.env.set_atmospheric_model(type='standard_atmosphere')
                    return
                
                # Check if we're at exactly (0,0) coordinates (known NRLMSISE issues)
                if (abs(environment.latitude_deg) < 0.01 and abs(environment.longitude_deg) < 0.01):
                    logger.warning("⚠️ NRLMSISE unreliable at exactly (0,0) coordinates, using standard atmosphere")
                    self.env.set_atmospheric_model(type='standard_atmosphere')
                    return
                
                try:
                    # Try to create NRLMSISE profile with timeout
                    def timeout_handler(signum, frame):
                        raise TimeoutError("NRLMSISE-00 computation timed out")
                    
                    # Set 30-second timeout for NRLMSISE
                    signal.signal(signal.SIGALRM, timeout_handler)
                    signal.alarm(30)
                    
                    try:
                        # Create minimal test profile first
                        test_altitudes = [0, 1000, 5000]  # Test with just 3 points
                        profile = self._create_nrlmsise_profile_safe(environment, test_altitudes)
                        
                        if profile and len(profile.altitude) >= 3:
                            # Test successful, create full profile
                            full_altitudes = list(range(0, 50000, 1000))  # 0-50km in 1km steps
                            full_profile = self._create_nrlmsise_profile_safe(environment, full_altitudes)
                            
                            if full_profile:
                                self._apply_atmospheric_profile_to_rocketpy(full_profile)
                                logger.info("✅ NRLMSISE-00 atmospheric model applied successfully")
                                return
                        
                        # If we get here, NRLMSISE failed
                        raise Exception("NRLMSISE profile creation failed")
                        
                    finally:
                        signal.alarm(0)  # Cancel the alarm
                        
                except (TimeoutError, Exception) as e:
                    logger.warning(f"⚠️ NRLMSISE-00 failed: {e}")
                    logger.info("🔄 Falling back to standard atmosphere")
                    self.env.set_atmospheric_model(type='standard_atmosphere')
                    return
                    
            elif environment.atmospheric_model == "forecast":
                logger.info("🌤️ Using forecast atmospheric model")
                if environment.atmospheric_profile:
                    try:
                        self._apply_atmospheric_profile_to_rocketpy(environment.atmospheric_profile)
                        logger.info("✅ Forecast atmospheric profile applied")
                    except Exception as e:
                        logger.warning(f"⚠️ Forecast profile failed: {e}, using standard atmosphere")
                        self.env.set_atmospheric_model(type='standard_atmosphere')
                else:
                    # If no profile, still attempt to set forecast, RocketPy will use forecast data
                    # for the given coordinates and date.
                    logger.info("📝 No atmospheric profile provided, using forecast model with location data.")
                    self.env.set_atmospheric_model(type='forecast')
                return
                
            elif environment.atmospheric_model == "custom":
                if hasattr(environment, 'atmospheric_profile') and environment.atmospheric_profile:
                    logger.info("🌍 Using custom atmospheric profile from frontend")
                    self._apply_atmospheric_profile_to_rocketpy(environment.atmospheric_profile)
                else:
                    logger.error("❌ Frontend requested custom atmospheric model but no profile provided")
                    raise ValueError("Custom atmospheric model requires atmospheric profile data from frontend")
                return

            elif environment.atmospheric_model == "standard":
                logger.info("🌍 Using standard atmosphere as requested by frontend")
                self.env.set_atmospheric_model(type='standard_atmosphere')
                return

            else:
                logger.error(f"❌ Unsupported atmospheric model: {environment.atmospheric_model}")
                raise ValueError(f"Atmospheric model '{environment.atmospheric_model}' not supported")
                
        except Exception as e:
            logger.error(f"❌ Atmospheric model application failed: {e}")
            logger.info("🔄 Using standard atmosphere as final fallback")
            try:
                self.env.set_atmospheric_model(type='standard_atmosphere')
            except Exception as fallback_error:
                logger.error(f"❌ Even standard atmosphere failed: {fallback_error}")
                # Continue without atmospheric model - RocketPy will use defaults

    def _create_nrlmsise_profile_safe(self, environment: EnvironmentModel, altitudes: list):
        """Create NRLMSISE profile with comprehensive error handling"""
        try:
            # ✅ FIXED: More robust import handling
            try:
                from nrlmsise00 import msise_model
            except ImportError:
                try:
                    from nrlmsise00.nrlmsise00 import msise_model
                except ImportError:
                    logger.warning("⚠️ NRLMSISE-00 library not available - trying alternative import")
                    # Try alternative NRLMSISE implementations
                    try:
                        import nrlmsise00 as nrl
                        msise_model = nrl.msise_model
                    except ImportError:
                        logger.warning("⚠️ No NRLMSISE-00 implementation found")
                        return None
            
            # Parse date or use current
            try:
                if environment.date:
                    dt = datetime.fromisoformat(environment.date.replace('Z', '+00:00'))
                else:
                    dt = datetime.now()
            except:
                dt = datetime.now()
            
            # Create profile arrays
            profile_data = {
                'altitude': [],
                'temperature': [],
                'pressure': [],
                'density': []
            }
            
            # ✅ FIXED: Reduce altitude range to prevent crashes
            safe_altitudes = [alt for alt in altitudes if alt <= 50000]  # Limit to 50km
            if not safe_altitudes:
                safe_altitudes = [0, 1000, 5000, 10000]  # Default safe range
            
            successful_points = 0
            max_attempts = min(len(safe_altitudes), 10)  # Limit attempts
            
            for i, alt_m in enumerate(safe_altitudes[:max_attempts]):
                try:
                    alt_km = alt_m / 1000.0
                    
                    # ✅ FIXED: Add coordinate validation
                    if not (-90 <= environment.latitude_deg <= 90) or not (-180 <= environment.longitude_deg <= 180):
                        logger.warning(f"⚠️ Invalid coordinates: {environment.latitude_deg}, {environment.longitude_deg}")
                        break
                    
                    # Call NRLMSISE with safe parameters and timeout protection
                    try:
                        # 🚀 ENHANCED: Try to use real-time geomagnetic data first
                        output = None
                        download_success = False
                        
                        try:
                            # First attempt: Download real-time space weather indices
                            logger.info(f"🌐 Attempting to download real-time space weather data for altitude {alt_km}km...")
                            
                            # Try to get real-time space weather data for this location
                            real_time_indices = self._get_real_time_space_weather_indices(dt, environment.latitude_deg, environment.longitude_deg)
                            
                            if real_time_indices:
                                output = msise_model(
                                    dt, alt_km, environment.latitude_deg, environment.longitude_deg,
                                    f107a=real_time_indices['f107a'], 
                                    f107=real_time_indices['f107'], 
                                    ap=real_time_indices['ap']
                                )
                                download_success = True
                                logger.info(f"🌟 Real-time space weather data downloaded: F10.7={real_time_indices['f107']}, Ap={real_time_indices['ap']}")
                            else:
                                raise Exception("Real-time space weather data unavailable")
                                
                        except Exception as download_error:
                            logger.warning(f"⚠️ Real-time space weather download failed: {download_error}")
                            logger.info(f"🔄 Falling back to conservative geomagnetic indices...")
                            
                            # Fallback: Use safer geomagnetic indices to prevent download failures
                            output = msise_model(
                                dt, alt_km, environment.latitude_deg, environment.longitude_deg,
                                f107a=120, f107=120, ap=7  # More conservative values
                            )
                            download_success = False
                        
                        # Log which data source was used (only on first successful point)
                        if i == 0 and output is not None:
                            if download_success:
                                logger.info("🌟 Using NRLMSISE with real-time space weather data")
                            else:
                                logger.info("📊 Using NRLMSISE with conservative space weather indices")
                    
                    except Exception as nrl_error:
                        logger.warning(f"⚠️ NRLMSISE call failed at {alt_km}km: {nrl_error}")
                        if i == 0:  # If first point fails, abort
                            break
                        continue
                    
                    # ✅ FIXED: Correct NRLMSISE tuple parsing
                    temp_k = None
                    density_kg_m3 = None
                    
                    # NRLMSISE returns a tuple: (densities_list, [total_density, temperature])
                    if isinstance(output, tuple) and len(output) >= 2:
                        if isinstance(output[1], list) and len(output[1]) >= 2:
                            # output[1][0] = total density (g/cm³)
                            # output[1][1] = temperature (K)
                            density_kg_m3 = output[1][0] / 1000.0  # Convert g/cm³ to kg/m³
                            temp_k = output[1][1]  # Temperature in K
                    
                    # Fallback: Try old object-style attributes (for compatibility)
                    if temp_k is None or density_kg_m3 is None:
                        if hasattr(output, 'T') and len(output.T) > 1:
                            temp_k = output.T[1]  # Neutral temperature
                        elif hasattr(output, 'Tn'):
                            temp_k = output.Tn
                        elif hasattr(output, 'temp'):
                            temp_k = output.temp
                        
                        if hasattr(output, 'rho'):
                            density_kg_m3 = output.rho * 1000  # Convert g/cm³ to kg/m³
                        elif hasattr(output, 'den'):
                            density_kg_m3 = output.den * 1000
                    
                    # Validate extracted data
                    if (temp_k is not None and density_kg_m3 is not None and 
                        not np.isnan(temp_k) and not np.isnan(density_kg_m3) and
                        temp_k > 100 and temp_k < 2000 and  # Reasonable temperature range
                        density_kg_m3 > 0 and density_kg_m3 < 10):  # Reasonable density range
                        
                        # Calculate pressure using ideal gas law
                        # P = ρRT/M, where R = 287 J/(kg·K) for air
                        pressure_pa = density_kg_m3 * 287 * temp_k
                        
                        profile_data['altitude'].append(alt_m)
                        profile_data['temperature'].append(temp_k)
                        profile_data['pressure'].append(pressure_pa)
                        profile_data['density'].append(density_kg_m3)
                        successful_points += 1
                    else:
                        logger.warning(f"⚠️ Invalid NRLMSISE data at {alt_km}km: T={temp_k}, ρ={density_kg_m3}")
                        if successful_points == 0 and i < 3:  # Continue trying first few points
                            continue
                        break
                        
                except Exception as e:
                    logger.warning(f"⚠️ NRLMSISE failed at {alt_m}m: {e}")
                    if successful_points == 0 and i < 3:  # Continue trying first few points
                        continue
                    break
            
            # Validate we have enough data points
            if successful_points < 2:
                logger.warning(f"⚠️ Insufficient NRLMSISE data points: {successful_points}")
                return None
            
            logger.info(f"✅ NRLMSISE profile created with {successful_points} points")
            
            # Create atmospheric profile object
            class AtmosphericProfile:
                def __init__(self, data):
                    self.altitude = data['altitude']
                    self.temperature = data['temperature']
                    self.pressure = data['pressure']
                    self.density = data['density']
            
            return AtmosphericProfile(profile_data)
            
        except ImportError as import_error:
            logger.warning(f"⚠️ NRLMSISE-00 library not available: {import_error}")
            return None
        except Exception as e:
            logger.warning(f"⚠️ NRLMSISE profile creation failed: {e}")
            return None

    def _get_real_time_space_weather_indices(self, date_time, latitude_deg=None, longitude_deg=None) -> dict:
        """
        Download real-time space weather indices from NOAA/NASA sources for specific location.
        
        Args:
            date_time: Target date/time for the data
            latitude_deg: User's launch site latitude in degrees
            longitude_deg: User's launch site longitude in degrees
            
        Returns:
            dict: Space weather indices or None if download fails
                {
                    'f107': float,      # Current F10.7 radio flux
                    'f107a': float,     # 81-day average F10.7
                    'ap': float         # Daily geomagnetic index (location-adjusted)
                }
        """
        try:
            # Format date for API request
            query_date = date_time.strftime('%Y-%m-%d') if isinstance(date_time, datetime) else datetime.now().strftime('%Y-%m-%d')
            
            # Log location for space weather context
            if latitude_deg is not None and longitude_deg is not None:
                location_context = self._get_geomagnetic_location_context(latitude_deg, longitude_deg)
                logger.info(f"🌍 Downloading space weather for location: {latitude_deg:.3f}°N, {longitude_deg:.3f}°E ({location_context})")
            else:
                logger.info(f"🌍 Downloading global space weather data")
            
            # Try multiple sources for space weather data
            sources = [
                self._fetch_noaa_space_weather_latest,
                self._fetch_noaa_space_weather_historical, 
                self._fetch_fallback_space_weather
            ]
            
            for source_func in sources:
                try:
                    indices = source_func(query_date, latitude_deg, longitude_deg)
                    if indices and all(key in indices for key in ['f107', 'f107a', 'ap']):
                        logger.info(f"🌐 Space weather data source: {source_func.__name__}")
                        return indices
                except Exception as e:
                    logger.warning(f"⚠️ Space weather source {source_func.__name__} failed: {e}")
                    continue
            
            logger.warning("⚠️ All space weather sources failed")
            return None
            
        except Exception as e:
            logger.warning(f"⚠️ Space weather download system failed: {e}")
            return None

    def _get_geomagnetic_location_context(self, latitude_deg: float, longitude_deg: float) -> str:
        """Determine geomagnetic location context for space weather effects"""
        abs_lat = abs(latitude_deg)
        
        if abs_lat > 65:
            return "Auroral Zone - High geomagnetic activity"
        elif abs_lat > 50:
            return "Sub-auroral Zone - Moderate geomagnetic effects"
        elif abs_lat < 20:
            return "Equatorial Zone - Enhanced ionospheric effects"
        else:
            return "Mid-latitude Zone - Standard geomagnetic conditions"

    def _fetch_noaa_space_weather_latest(self, date_str: str, latitude_deg: float = None, longitude_deg: float = None) -> dict:
        """Fetch latest space weather data from NOAA Space Weather Prediction Center"""
        
        # NEW WORKING NOAA ENDPOINTS
        f107_url = "https://services.swpc.noaa.gov/json/solar-cycle/f10-7cm-flux.json"
        kp_url = "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json"
        
        try:
            # Download F10.7 solar flux data
            logger.info(f"🌐 Downloading real F10.7 data from NOAA...")
            f107_response = requests.get(f107_url, timeout=10)
            f107_response.raise_for_status()
            
            f107_data = f107_response.json()
            if f107_data and len(f107_data) > 0:
                # Get most recent F10.7 value
                latest_f107_entry = f107_data[-1]  # Most recent entry
                f107 = float(latest_f107_entry.get('f10.7', 120.0))
                f107a = f107  # Use same value for 81-day average approximation
                logger.info(f"✅ Real F10.7 downloaded: {f107}")
            else:
                f107 = f107a = 120.0
                
            # Download planetary K-index data
            logger.info(f"🌐 Downloading real Kp data from NOAA...")
            kp_response = requests.get(kp_url, timeout=10)
            kp_response.raise_for_status()
            
            kp_data = kp_response.json()
            if kp_data and len(kp_data) > 0:
                # Get most recent Kp value and convert to Ap
                latest_kp_entry = kp_data[-1]  # Most recent entry
                kp = float(latest_kp_entry.get('estimated_kp', 2.0))
                ap = self._kp_to_ap(kp)
                
                # Apply location-specific geomagnetic adjustments
                if latitude_deg is not None:
                    ap = self._adjust_geomagnetic_index_for_location(ap, latitude_deg, longitude_deg)
                    logger.info(f"✅ Real Kp: {kp}, Ap: {ap} (location-adjusted for {latitude_deg:.1f}°N)")
                else:
                    logger.info(f"✅ Real Kp downloaded: {kp}, converted to Ap: {ap}")
            else:
                ap = 7.0
                
            logger.info(f"🌟 Real-time space weather: F10.7={f107}, Ap={ap}")
            return {
                'f107': f107,
                'f107a': f107a, 
                'ap': ap
            }
                
        except Exception as e:
            raise Exception(f"NOAA latest data fetch failed: {e}")

    def _adjust_geomagnetic_index_for_location(self, ap: float, latitude_deg: float, longitude_deg: float) -> float:
        """Adjust geomagnetic index based on geographic location"""
        abs_lat = abs(latitude_deg)
        
        # Auroral zones (>65°) experience enhanced geomagnetic effects
        if abs_lat > 65:
            enhancement_factor = 1.5 + (abs_lat - 65) * 0.02  # 1.5x to 2.0x
            return min(ap * enhancement_factor, 400.0)  # Cap at Ap=400
            
        # Sub-auroral zones (50-65°) experience moderate enhancement
        elif abs_lat > 50:
            enhancement_factor = 1.2 + (abs_lat - 50) * 0.02  # 1.2x to 1.5x
            return ap * enhancement_factor
            
        # Equatorial zones (<20°) can have enhanced ionospheric effects
        elif abs_lat < 20:
            # Equatorial electrojet and scintillation effects
            equatorial_factor = 1.1 + (20 - abs_lat) * 0.01  # 1.1x to 1.3x
            return ap * equatorial_factor
            
        # Mid-latitudes (20-50°) use standard values
        else:
            return ap

    def _fetch_noaa_space_weather_historical(self, date_str: str, latitude_deg: float = None, longitude_deg: float = None) -> dict:
        """Fetch historical space weather data from NOAA archives"""
        from datetime import datetime
        
        try:
            # NOAA historical space weather archive (corrected URL)
            url = "https://services.swpc.noaa.gov/json/solar-cycle/f10-7cm-flux.json"
            
            logger.info(f"🌐 Downloading historical F10.7 data from NOAA...")
            response = requests.get(url, timeout=15)
            response.raise_for_status()
            
            data = response.json()
            
            # Find closest date match
            target_date = datetime.strptime(date_str, '%Y-%m-%d')
            closest_entry = None
            min_diff = float('inf')
            
            for entry in data:
                try:
                    # Parse NOAA format: "2025-05" -> "2025-05-01"
                    time_tag = entry.get('time-tag', '')
                    if len(time_tag) == 7:  # "YYYY-MM" format
                        entry_date = datetime.strptime(time_tag + '-01', '%Y-%m-%d')
                        diff = abs((entry_date - target_date).days)
                        if diff < min_diff:
                            min_diff = diff
                            closest_entry = entry
                except:
                    continue
            
            if closest_entry:
                f107 = float(closest_entry.get('f10.7', 120.0))
                ap = 7.0  # Default for historical data
                
                # Apply location-specific adjustments for historical data too
                if latitude_deg is not None:
                    ap = self._adjust_geomagnetic_index_for_location(ap, latitude_deg, longitude_deg)
                    logger.info(f"✅ Historical F10.7: {f107} (within {min_diff} days), Ap: {ap} (location-adjusted)")
                else:
                    logger.info(f"✅ Historical F10.7 found: {f107} (within {min_diff} days)")
                
                return {
                    'f107': f107,
                    'f107a': f107,  # Use same value
                    'ap': ap
                }
                
        except Exception as e:
            raise Exception(f"NOAA historical data fetch failed: {e}")

    def _fetch_current_ap_index(self) -> float:
        """Fetch current Ap geomagnetic index"""
        try:
            # NOAA geomagnetic data (corrected URL)
            url = "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json" 
            
            response = requests.get(url, timeout=8)
            response.raise_for_status()
            
            data = response.json()
            if data and len(data) > 0:
                latest = data[-1]  # Get most recent entry
                # Parse NOAA format: {"kp_index": 2, "estimated_kp": 2.33, ...}
                kp = float(latest.get('estimated_kp', 2.0))
                ap = self._kp_to_ap(kp)
                logger.info(f"✅ Current Kp: {kp}, Ap: {ap}")
                return ap
                
        except Exception as e:
            logger.warning(f"⚠️ Ap index fetch failed: {e}")
        
        return 7.0  # Conservative default

    def _kp_to_ap(self, kp: float) -> float:
        """Convert Kp index to Ap index (approximate)"""
        # Standard Kp to Ap conversion table
        kp_to_ap_map = {
            0.0: 0, 0.3: 2, 0.7: 3, 1.0: 4, 1.3: 5, 1.7: 6, 2.0: 7, 2.3: 9,
            2.7: 12, 3.0: 15, 3.3: 18, 3.7: 22, 4.0: 27, 4.3: 32, 4.7: 39,
            5.0: 48, 5.3: 56, 5.7: 67, 6.0: 80, 6.3: 94, 6.7: 111, 7.0: 132,
            7.3: 154, 7.7: 179, 8.0: 207, 8.3: 236, 8.7: 300, 9.0: 400
        }
        
        # Find closest Kp value
        closest_kp = min(kp_to_ap_map.keys(), key=lambda x: abs(x - kp))
        return float(kp_to_ap_map[closest_kp])

    def _fetch_fallback_space_weather(self, date_str: str, latitude_deg: float = None, longitude_deg: float = None) -> dict:
        """Fallback space weather data based on solar cycle estimates"""
        from datetime import datetime
        
        try:
            # Solar cycle 25 estimates (2019-2030)
            current_year = datetime.now().year
            
            # Approximate solar cycle activity
            if current_year < 2024:
                # Solar minimum period
                f107 = 80 + (current_year - 2019) * 8  # Gradual increase
                f107a = f107 - 5
                ap = 5
            elif current_year < 2026:
                # Solar maximum period
                f107 = 140 + (current_year - 2024) * 20  # Peak activity
                f107a = f107 - 10
                ap = 15
            else:
                # Solar declining period
                f107 = 160 - (current_year - 2025) * 10  # Gradual decrease
                f107a = f107 - 5
                ap = 10
            
            # Apply location-specific adjustments
            if latitude_deg is not None:
                ap = self._adjust_geomagnetic_index_for_location(ap, latitude_deg, longitude_deg)
                logger.info(f"📊 Using solar cycle estimate for {current_year}: F10.7={f107}, Ap={ap} (location-adjusted for {latitude_deg:.1f}°N)")
            else:
                logger.info(f"📊 Using solar cycle estimate for {current_year}: F10.7={f107}, Ap={ap}")
            
            # Ensure reasonable bounds
            f107 = max(80, min(200, f107))
            f107a = max(80, min(180, f107a))
            ap = max(2, min(400, ap))  # Updated upper bound for high-latitude locations
            
            return {
                'f107': float(f107),
                'f107a': float(f107a),
                'ap': float(ap)
            }
            
        except Exception as e:
            raise Exception(f"Fallback space weather failed: {e}")

    def _apply_atmospheric_profile_to_rocketpy(self, profile):
        """Apply atmospheric profile to RocketPy environment with bijective protection"""
        try:
            from scipy.interpolate import interp1d
            
            # CRITICAL: Check altitude range for high-altitude simulations
            max_altitude = max(profile.altitude)
            logger.info(f"🔍 Atmospheric profile altitude range: 0 to {max_altitude:.0f}m")
            
            # CRITICAL: Ensure monotonic pressure profile for high-altitude simulations (50-100 km)
            if max_altitude > 50000:  # Above 50 km, bijective issues common
                logger.warning(f"⚠️ High-altitude profile detected ({max_altitude/1000:.1f} km) - applying bijective protection")
                
                # Apply monotonic pressure correction
                corrected_pressure, corrected_altitude = ensure_monotonic_pressure_profile(
                    np.array(profile.pressure), 
                    np.array(profile.altitude),
                    smoothing_window=7  # Larger window for high-altitude data
                )
                
                # Use corrected data for interpolation
                altitude_data = corrected_altitude
                pressure_data = corrected_pressure
                temperature_data = np.array(profile.temperature)
                
                # Ensure temperature data matches corrected altitude
                if len(temperature_data) != len(altitude_data):
                    temp_interp_orig = interp1d(profile.altitude, profile.temperature, 
                                             kind='linear', bounds_error=False, fill_value='extrapolate')
                    temperature_data = temp_interp_orig(altitude_data)
                    
                logger.info(f"✅ Applied bijective protection for high-altitude atmospheric profile")
            else:
                # Standard processing for lower altitudes
                altitude_data = np.array(profile.altitude)
                pressure_data = np.array(profile.pressure)
                temperature_data = np.array(profile.temperature)
                logger.info(f"📊 Standard atmospheric profile processing (altitude < 50 km)")
            
            # Create interpolation functions with protected data
            temp_interp = interp1d(
                altitude_data, temperature_data,
                kind='linear', bounds_error=False, fill_value='extrapolate'
            )
            press_interp = interp1d(
                altitude_data, pressure_data,
                kind='linear', bounds_error=False, fill_value='extrapolate'
            )
            
            # Validate interpolation functions
            test_altitudes = [0, 1000, 10000, 30000]
            if max_altitude > 50000:
                test_altitudes.extend([50000, 70000, 90000])
                
            for test_alt in test_altitudes:
                if test_alt <= max_altitude:
                    test_pressure = press_interp(test_alt)
                    test_temp = temp_interp(test_alt)
                    if not (np.isfinite(test_pressure) and np.isfinite(test_temp)):
                        raise ValueError(f"Non-finite atmospheric values at {test_alt}m altitude")
            
            # Apply to RocketPy environment
            self.env.set_atmospheric_model(
                type='custom_atmosphere',
                pressure=press_interp,
                temperature=temp_interp
            )
            
            logger.info(f"✅ Applied high-altitude atmospheric profile with {len(altitude_data)} data points")
            logger.info(f"📊 Pressure range: {min(pressure_data):.1f} to {max(pressure_data):.1f} Pa")
            logger.info(f"🌡️ Temperature range: {min(temperature_data):.1f} to {max(temperature_data):.1f} K")
            
        except Exception as e:
            logger.error(f"❌ Failed to apply atmospheric profile: {e}")
            logger.error(f"🔍 Profile details: altitudes={len(profile.altitude)}, max_alt={max(profile.altitude):.0f}m")
            raise