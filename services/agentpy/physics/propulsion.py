"""Propulsion systems and related functions for rocket simulation."""

import math

# Propulsion systems database with realistic values
PROPULSION_SYSTEMS = {
    "mini-motor": {"type": "solid", "thrust": 15, "burn_time": 1.8, "specific_impulse": 180, "propellant_mass": 0.010, "dry_mass": 0.008, "total_impulse": 27},
    "default-motor": {"type": "solid", "thrust": 32, "burn_time": 2.4, "specific_impulse": 200, "propellant_mass": 0.040, "dry_mass": 0.015, "total_impulse": 76.8},
    "high-power": {"type": "solid", "thrust": 60, "burn_time": 3.2, "specific_impulse": 220, "propellant_mass": 0.090, "dry_mass": 0.025, "total_impulse": 192},
    "super-power": {"type": "solid", "thrust": 120, "burn_time": 4.0, "specific_impulse": 240, "propellant_mass": 0.200, "dry_mass": 0.050, "total_impulse": 480},
    "small-liquid": {"type": "liquid", "thrust": 500, "burn_time": 30, "specific_impulse": 300, "propellant_mass": 1.5, "dry_mass": 0.8, "total_impulse": 15000, "mixture_ratio": 2.1, "chamber_pressure": 1.5},
    "medium-liquid": {"type": "liquid", "thrust": 2000, "burn_time": 45, "specific_impulse": 320, "propellant_mass": 6.5, "dry_mass": 2.0, "total_impulse": 90000, "mixture_ratio": 2.3, "chamber_pressure": 2.0},
    "large-liquid": {"type": "liquid", "thrust": 8000, "burn_time": 60, "specific_impulse": 340, "propellant_mass": 24.0, "dry_mass": 5.0, "total_impulse": 480000, "mixture_ratio": 2.4, "chamber_pressure": 3.0},
    "hybrid-engine": {"type": "hybrid", "thrust": 1200, "burn_time": 20, "specific_impulse": 280, "propellant_mass": 4.5, "dry_mass": 1.2, "total_impulse": 24000, "oxidizer_flux": 350}
}

def select_engine_for_altitude(target_altitude, current_dry_mass):
    """
    Select an appropriate engine to reach the target altitude based on the current dry mass.
    
    Args:
        target_altitude: The desired altitude in meters
        current_dry_mass: The current dry mass of the rocket in kg
        
    Returns:
        str: ID of the selected engine
    """
    altitude_thresholds = {"mini-motor": 200, "default-motor": 500, "high-power": 1500, "super-power": 3000, 
                          "small-liquid": 10000, "hybrid-engine": 15000, "medium-liquid": 25000, "large-liquid": 80000}
    
    # Direct threshold selection for very high altitudes
    if target_altitude > 25000: return "large-liquid"
    if target_altitude > 10000: return "medium-liquid" # Covers 10-25km
    if target_altitude > 3000 and target_altitude <= 15000 : # Hybrid or Small Liquid
         # Prefer hybrid if it fits, else small liquid
        if target_altitude <= altitude_thresholds["hybrid-engine"]: return "hybrid-engine"
        return "small-liquid" # Covers 3-10km, or up to 15km if hybrid not chosen

    sorted_engines = sorted(PROPULSION_SYSTEMS.items(), key=lambda x: x[1]['total_impulse'])
    selected_engine_id = sorted_engines[0][0]

    for engine_id, engine_data in sorted_engines:
        total_mass = current_dry_mass + engine_data['propellant_mass'] + engine_data['dry_mass']
        
        # Import inside function to avoid circular imports
        from .constants import GRAVITATIONAL_ACCELERATION
        
        exhaust_velocity = engine_data['specific_impulse'] * GRAVITATIONAL_ACCELERATION
        # Ensure propellant_mass is positive and less than total_mass for log
        prop_mass = engine_data['propellant_mass']
        if prop_mass <= 0 or total_mass <= prop_mass: continue # Skip invalid engine data for this calc

        dry_mass_for_calc = total_mass - prop_mass
        if dry_mass_for_calc <=0: continue

        delta_v = exhaust_velocity * math.log(total_mass / dry_mass_for_calc) - engine_data['burn_time'] * GRAVITATIONAL_ACCELERATION
        estimated_altitude = ( (delta_v * 0.7)**2) / (2 * GRAVITATIONAL_ACCELERATION) # 0.7 drag factor
        if estimated_altitude > 10000: estimated_altitude *= 1.2
        
        if estimated_altitude >= target_altitude * 0.8:
            selected_engine_id = engine_id
            break 
            
    # Threshold safety check
    current_engine_threshold = altitude_thresholds.get(selected_engine_id, 0)
    if target_altitude > current_engine_threshold * 1.2:
        for engine_id_thresh, max_alt_thresh in sorted(altitude_thresholds.items(), key=lambda x: x[1]):
            if max_alt_thresh >= target_altitude:
                selected_engine_id = engine_id_thresh
                break
        else: # If target still exceeds all, pick largest
            if target_altitude > altitude_thresholds.get(selected_engine_id, 0):
                 selected_engine_id = "large-liquid"

    print(f"Final engine selection for {target_altitude}m: {selected_engine_id}")
    return selected_engine_id

