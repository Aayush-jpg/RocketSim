"""Trajectory calculations and rocket design optimization functions."""

import math
from .constants import GRAVITATIONAL_ACCELERATION
from .aerodynamics import calculate_rocket_mass
from .propulsion import PROPULSION_SYSTEMS, select_engine_for_altitude

def calculate_max_altitude(total_mass, thrust, burn_time, specific_impulse, drag_coef, rocket_data):
    """
    Calculate the maximum altitude a rocket can reach based on its parameters.
    
    Args:
        total_mass: Total mass of the rocket in kg
        thrust: Engine thrust in N
        burn_time: Engine burn time in seconds
        specific_impulse: Engine specific impulse in seconds
        drag_coef: Drag coefficient
        rocket_data: Dictionary containing rocket configuration
        
    Returns:
        float: Maximum altitude in meters
    """
    body_part = next((p for p in rocket_data.get("parts", []) if p.get("type") == "body"), None)
    diameter = body_part.get("Ø", 5) if body_part else 5
    frontal_area = math.pi * (diameter / 200)**2
    effective_drag = drag_coef * 0.8 if thrust > 500 else drag_coef
    
    exhaust_velocity = specific_impulse * GRAVITATIONAL_ACCELERATION
    prop_mass = (thrust * burn_time) / exhaust_velocity # Tsiolkovsky for prop_mass
    dry_mass = total_mass - prop_mass
    if dry_mass <= 0 or total_mass <= dry_mass : # dry_mass must be less than total_mass
        print(f"Warning: Invalid mass values (total: {total_mass}, dry: {dry_mass}, prop: {prop_mass}). Using estimated dry_mass.")
        # Estimate dry_mass as a fraction of total_mass if calculation is off
        # This is a fallback, ideally PROPULSION_SYSTEMS should have consistent propellant_mass
        engine_details = PROPULSION_SYSTEMS.get(rocket_data.get('motorId', 'default-motor'), PROPULSION_SYSTEMS['default-motor'])
        prop_mass = engine_details['propellant_mass']
        dry_mass = total_mass - prop_mass
        if dry_mass <= 0: return 0 # Still invalid

    ideal_delta_v = exhaust_velocity * math.log(total_mass / dry_mass)
    
    propulsion_type = "solid"
    motor_id = rocket_data.get("motorId", "")
    if "liquid" in motor_id: propulsion_type = "liquid"
    elif "hybrid" in motor_id: propulsion_type = "hybrid"

    efficiency_factor, gravity_loss_factor = (0.85, 0.85) if propulsion_type == "liquid" else (0.78, 0.8) if propulsion_type == "hybrid" else (0.7, 0.75)
    
    gravity_loss = burn_time * GRAVITATIONAL_ACCELERATION * gravity_loss_factor
    delta_v = ideal_delta_v - gravity_loss
    drag_factor = 1.0 - (0.3 * effective_drag * frontal_area)
    
    max_altitude = 0
    if propulsion_type == "liquid":
        powered_altitude = max(0, (thrust / total_mass - GRAVITATIONAL_ACCELERATION) * (burn_time**2) / 2) * 0.8
        effective_delta_v = delta_v * drag_factor * efficiency_factor
        ballistic_altitude = (effective_delta_v**2) / (2 * GRAVITATIONAL_ACCELERATION)
        max_altitude = powered_altitude + ballistic_altitude
    else:
        effective_delta_v = delta_v * drag_factor * efficiency_factor
        max_altitude = (effective_delta_v**2) / (2 * GRAVITATIONAL_ACCELERATION)
        
    if max_altitude > 10000: max_altitude *= (1.0 + (math.log10(max_altitude/10000) * 0.3))
    return max_altitude

def physics_based_rocket_design(rocket_data, target_altitude):
    """
    Design a rocket to reach a specific altitude using physics-based calculations.
    
    Args:
        rocket_data: Dictionary containing current rocket configuration
        target_altitude: Target altitude in meters
        
    Returns:
        list: A list of actions to modify the rocket design
    """
    actions = []
    rocket_dry_mass = calculate_rocket_mass(rocket_data)
    selected_engine_id = select_engine_for_altitude(target_altitude, rocket_dry_mass)
    selected_engine = PROPULSION_SYSTEMS[selected_engine_id]
    actions.append({"action": "update_rocket", "props": {"motorId": selected_engine_id}})

    body_part = next((p for p in rocket_data.get("parts", []) if p.get("type") == "body"), None)
    nose_part = next((p for p in rocket_data.get("parts", []) if p.get("type") == "nose"), None)
    fin_part = next((p for p in rocket_data.get("parts", []) if p.get("type") == "fin"), None)

    is_liquid = "liquid" in selected_engine_id
    is_high_power_solid = "super-power" in selected_engine_id

    if body_part:
        base_length = body_part.get("length", 40)
        thrust_factor = math.sqrt(selected_engine['thrust'] / 32)
        altitude_factor = math.pow(max(100, target_altitude) / 500, 0.25) # Avoid log(0) or small numbers
        
        if is_liquid: new_length = min(250, max(100, 120 * thrust_factor * 0.6))
        elif is_high_power_solid: new_length = min(120, max(60, 80 * altitude_factor)) # Adjusted for high power solid
        else: new_length = min(120, max(40, base_length * thrust_factor * altitude_factor))
        actions.append({"action": "update_part", "id": body_part["id"], "props": {"length": round(new_length, 1)}})
        
        if is_liquid:
            current_diameter = body_part.get("Ø", 5)
            new_diameter = min(15, max(8, current_diameter * 1.6))
            if new_diameter > current_diameter:
                actions.append({"action": "update_part", "id": body_part["id"], "props": {"Ø": round(new_diameter, 1)}})
                if nose_part: # Match nose base diameter
                    actions.append({"action": "update_part", "id": nose_part["id"], "props": {"baseØ": round(new_diameter, 1)}})


    if fin_part:
        velocity_factor = 1.1 if target_altitude < 1000 else 1.3 if target_altitude < 5000 else 1.5 if target_altitude < 20000 else 1.8
        if is_liquid: velocity_factor *= 1.3
        
        new_root = min(25, max(10, fin_part.get("root", 10) * velocity_factor))
        new_span = min(20, max(8, fin_part.get("span", 8) * velocity_factor))

        if body_part and is_liquid: # Proportional fins for liquid rockets
            body_len = body_part.get("length", new_length if 'new_length' in locals() else 80) # Use updated length if available
            body_dia = body_part.get("Ø", new_diameter if 'new_diameter' in locals() else 5)
            new_root = max(new_root, body_len * 0.15)
            new_span = max(new_span, body_dia * 1.5) # Adjusted span factor

        actions.append({"action": "update_part", "id": fin_part["id"], "props": {"root": round(new_root, 1), "span": round(new_span, 1)}})

    if nose_part and (is_liquid or target_altitude > 1000): # Ogive for higher performance
        if nose_part.get("shape", "ogive") != "ogive":
            actions.append({"action": "update_part", "id": nose_part["id"], "props": {"shape": "ogive"}})
            
    actions.append({"action": "run_sim", "fidelity": "quick"})
    print(f"[physics_based_rocket_design] Generated actions: {actions}")
    return actions 