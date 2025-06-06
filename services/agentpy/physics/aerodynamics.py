"""Aerodynamic calculations for rocket simulation."""

import math

def calculate_rocket_mass(rocket_data: dict) -> float:
    """
    Calculate the total mass of the rocket from its components (LEGACY PARTS VERSION).
    
    Args:
        rocket_data: Dictionary containing rocket parts information
        
    Returns:
        float: The total mass of the rocket in kg
    """
    total_mass = 0.05  # Base mass in kg
    for part in rocket_data.get("parts", []):
        part_type = part.get("type", "")
        if part_type == "nose":
            radius_m = part.get("baseØ", 5) / 200; length_m = part.get("length", 15) / 100
            total_mass += (1/3) * math.pi * radius_m**2 * length_m * 1200
        elif part_type == "body":
            radius_m = part.get("Ø", 5) / 200; length_m = part.get("length", 40) / 100
            total_mass += math.pi * radius_m**2 * length_m * 1000 * 0.08
        elif part_type == "fin":
            volume_m3 = (part.get("root", 10)/100) * (part.get("span", 8)/100) * (0.3/100)
            total_mass += volume_m3 * 700 * 4 # 4 fins
    return total_mass

def calculate_rocket_mass_components(rocket_data: dict) -> float:
    """
    Calculate the total mass of the rocket from its components (NEW COMPONENT VERSION).
    
    Args:
        rocket_data: Dictionary containing component-based rocket information
        
    Returns:
        float: The total mass of the rocket in kg
    """
    total_mass = 0.05  # Base structural mass in kg
    
    # Nose cone mass
    nose_cone = rocket_data.get("nose_cone")
    if nose_cone:
        length_m = nose_cone.get("length_m", 0.15)
        base_radius_m = nose_cone.get("base_radius_m", 0.05)
        wall_thickness_m = nose_cone.get("wall_thickness_m", 0.002)
        material_density = nose_cone.get("material_density_kg_m3", 1600.0)
        
        # Nose cone as hollow cone/ogive approximation
        surface_area = math.pi * base_radius_m * math.sqrt(base_radius_m**2 + length_m**2)
        volume = surface_area * wall_thickness_m
        total_mass += volume * material_density
    
    # Body tube masses
    body_tubes = rocket_data.get("body_tubes", [])
    for body_tube in body_tubes:
        length_m = body_tube.get("length_m", 0.4)
        outer_radius_m = body_tube.get("outer_radius_m", 0.05)
        wall_thickness_m = body_tube.get("wall_thickness_m", 0.003)
        material_density = body_tube.get("material_density_kg_m3", 1600.0)
        
        # Body tube as hollow cylinder
        outer_volume = math.pi * outer_radius_m**2 * length_m
        inner_radius = max(0, outer_radius_m - wall_thickness_m)
        inner_volume = math.pi * inner_radius**2 * length_m
        volume = outer_volume - inner_volume
        total_mass += volume * material_density
    
    # Fin masses
    fins = rocket_data.get("fins", [])
    for fin_set in fins:
        root_chord_m = fin_set.get("root_chord_m", 0.08)
        tip_chord_m = fin_set.get("tip_chord_m", 0.04)
        span_m = fin_set.get("span_m", 0.06)
        thickness_m = fin_set.get("thickness_m", 0.006)
        fin_count = fin_set.get("fin_count", 3)
        material_density = fin_set.get("material_density_kg_m3", 700.0)
        
        # Fin as trapezoidal plate
        fin_area = 0.5 * (root_chord_m + tip_chord_m) * span_m
        volume_per_fin = fin_area * thickness_m
        total_mass += volume_per_fin * material_density * fin_count
    
    # Parachute masses (lightweight)
    parachutes = rocket_data.get("parachutes", [])
    for parachute in parachutes:
        # Estimate parachute mass based on cd_s (drag area)
        cd_s_m2 = parachute.get("cd_s_m2", 0.5)
        parachute_mass = cd_s_m2 * 0.1  # ~100g per m² of parachute area
        total_mass += parachute_mass
    
    return total_mass 