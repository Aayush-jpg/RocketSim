"""Aerodynamic calculations for rocket simulation."""

import math

def calculate_rocket_mass(rocket_data: dict) -> float:
    """
    Calculate the total mass of the rocket from its components.
    
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