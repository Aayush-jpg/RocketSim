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
        rocket_data: Dictionary containing rocket configuration (component-based)
        
    Returns:
        float: Maximum altitude in meters
    """
    body_tubes = rocket_data.get("body_tubes", [])
    if body_tubes:
        diameter_m = body_tubes[0].get("outer_radius_m", 0.05) * 2  # Convert radius to diameter
    else:
        diameter_m = 0.1  # Default 10cm diameter
    
    frontal_area = math.pi * (diameter_m / 2)**2
    effective_drag = drag_coef * 0.8 if thrust > 500 else drag_coef
    
    exhaust_velocity = specific_impulse * GRAVITATIONAL_ACCELERATION
    prop_mass = (thrust * burn_time) / exhaust_velocity # Tsiolkovsky for prop_mass
    dry_mass = total_mass - prop_mass
    if dry_mass <= 0 or total_mass <= dry_mass : # dry_mass must be less than total_mass
        print(f"Warning: Invalid mass values (total: {total_mass}, dry: {dry_mass}, prop: {prop_mass}). Using estimated dry_mass.")
        motor = rocket_data.get('motor', {})
        motor_id = motor.get('motor_database_id', 'default-motor')
        engine_details = PROPULSION_SYSTEMS.get(motor_id, PROPULSION_SYSTEMS['default-motor'])
        prop_mass = engine_details['propellant_mass']
        dry_mass = total_mass - prop_mass
        if dry_mass <= 0: return 0 # Still invalid

    ideal_delta_v = exhaust_velocity * math.log(total_mass / dry_mass)
    
    propulsion_type = "solid"
    motor_id = rocket_data.get("motor", {}).get("motor_database_id", "default-motor")
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
        rocket_data: Dictionary containing current rocket configuration (component-based)
        target_altitude: Target altitude in meters
        
    Returns:
        list: A list of actions to modify the rocket design using component tools
    """
    actions = []
    rocket_dry_mass = calculate_rocket_mass(rocket_data)
    selected_engine_id = select_engine_for_altitude(target_altitude, rocket_dry_mass)
    selected_engine = PROPULSION_SYSTEMS[selected_engine_id]
    
    actions.append({"action": "update_motor", "props": {"motor_database_id": selected_engine_id}})

    nose_cone = rocket_data.get("nose_cone")
    body_tubes = rocket_data.get("body_tubes", [])
    fins = rocket_data.get("fins", [])

    is_liquid = "liquid" in selected_engine_id
    is_high_power_solid = "super-power" in selected_engine_id

    if body_tubes:
        body_tube = body_tubes[0]
        base_length_m = body_tube.get("length_m", 0.4)
        thrust_factor = math.sqrt(selected_engine['thrust'] / 32)
        altitude_factor = math.pow(max(100, target_altitude) / 500, 0.25)
        
        if is_liquid: 
            new_length_m = min(2.5, max(1.0, 1.2 * thrust_factor * 0.6))
        elif is_high_power_solid: 
            new_length_m = min(1.2, max(0.6, 0.8 * altitude_factor))
        else: 
            new_length_m = min(1.2, max(0.4, base_length_m * thrust_factor * altitude_factor))
        
        actions.append({
            "action": "update_body_tube", 
            "index": 0,
            "props": {"length_m": round(new_length_m, 3)}
        })
        
        if is_liquid:
            current_radius_m = body_tube.get("outer_radius_m", 0.05)
            new_radius_m = min(0.075, max(0.04, current_radius_m * 1.6))
            if new_radius_m > current_radius_m:
                actions.append({
                    "action": "update_body_tube", 
                    "index": 0,
                    "props": {"outer_radius_m": round(new_radius_m, 4)}
                })
                
                if nose_cone:
                    actions.append({
                        "action": "update_nose_cone", 
                        "props": {"base_radius_m": round(new_radius_m, 4)}
                    })

    if fins:
        fin_set = fins[0]
        velocity_factor = 1.1 if target_altitude < 1000 else 1.3 if target_altitude < 5000 else 1.5 if target_altitude < 20000 else 1.8
        if is_liquid: velocity_factor *= 1.3
        
        current_root_m = fin_set.get("root_chord_m", 0.08)
        current_span_m = fin_set.get("span_m", 0.06)
        
        new_root_m = min(0.25, max(0.08, current_root_m * velocity_factor))
        new_span_m = min(0.20, max(0.06, current_span_m * velocity_factor))

        if body_tubes and is_liquid:
            body_len_m = body_tubes[0].get("length_m", new_length_m if 'new_length_m' in locals() else 0.8)
            body_radius_m = body_tubes[0].get("outer_radius_m", 0.05)
            new_root_m = max(new_root_m, body_len_m * 0.15)
            new_span_m = max(new_span_m, body_radius_m * 3.0)

        actions.append({
            "action": "update_fins", 
            "index": 0,
            "props": {
                "root_chord_m": round(new_root_m, 3), 
                "span_m": round(new_span_m, 3)
            }
        })

    if nose_cone and (is_liquid or target_altitude > 1000):
        if nose_cone.get("shape", "ogive") != "ogive":
            actions.append({
                "action": "update_nose_cone", 
                "props": {"shape": "ogive"}
            })
            
    actions.append({"action": "run_sim", "fidelity": "quick"})
    print(f"[physics_based_rocket_design] Generated component-based actions: {actions}")
    return actions 