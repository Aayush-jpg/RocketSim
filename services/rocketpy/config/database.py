"""
Database loading and management for RocketPy simulation service.

This module handles loading and caching of material and motor databases
from JSON files with fallback data for robustness.
"""

import json
import os
from typing import Dict, Any
from .logging import dbg_enter, dbg_exit, log_database_loading
from .constants import MATERIALS_DB_PATH, MOTORS_DB_PATH, update_material_densities

# ================================
# MATERIAL DATABASE
# ================================

def load_material_database() -> Dict[str, Any]:
    """
    Load material database from shared JSON file
    
    Returns:
        Dictionary containing material specifications with fallback data
    """
    dbg_enter("load_material_database")
    try:
        with open(MATERIALS_DB_PATH, 'r') as f:
            material_data = json.load(f)
        
        log_database_loading("material", len(material_data))
        dbg_exit("load_material_database", count=len(material_data))
        return material_data
        
    except Exception as e:
        # Minimal fallback - only essential materials
        fallback_data = {
            "fiberglass": {
                "id": "fiberglass",
                "name": "Fiberglass (G10/FR4)",
                "category": "composite",
                "density_kg_m3": 1600.0,
                "surfaceRoughness_m": 0.00001,
                "availability": "common",
                "description": "Standard fiberglass composite",
                "applications": ["nose_cones", "body_tubes", "fin_root_sections"]
            },
            "aluminum_6061": {
                "id": "aluminum_6061", 
                "name": "Aluminum 6061-T6",
                "category": "metal",
                "density_kg_m3": 2700.0,
                "surfaceRoughness_m": 0.000002,
                "availability": "common",
                "description": "Standard aluminum alloy",
                "applications": ["motor_casings", "structural_components"]
            },
            "birch_plywood": {
                "id": "birch_plywood",
                "name": "Baltic Birch Plywood", 
                "category": "wood",
                "density_kg_m3": 650.0,
                "surfaceRoughness_m": 0.00005,
                "availability": "common",
                "description": "High-quality plywood",
                "applications": ["fins", "internal_structures"]
            },
            "carbon_fiber": {
                "id": "carbon_fiber",
                "name": "Carbon Fiber (3K Twill)",
                "category": "composite",
                "density_kg_m3": 1500.0,
                "surfaceRoughness_m": 0.000005,
                "availability": "common",
                "description": "High-strength carbon fiber composite",
                "applications": ["high_performance_structures", "fins", "nose_cones"]
            },
            "abs": {
                "id": "abs",
                "name": "ABS Plastic",
                "category": "plastic",
                "density_kg_m3": 1050.0,
                "surfaceRoughness_m": 0.00002,
                "availability": "common",
                "description": "3D printable thermoplastic",
                "applications": ["3d_printed_components", "prototyping"]
            },
            "apcp": {
                "id": "apcp",
                "name": "APCP Propellant",
                "category": "propellant",
                "density_kg_m3": 1815.0,
                "surfaceRoughness_m": 0.0001,
                "availability": "restricted",
                "description": "Ammonium perchlorate composite propellant",
                "applications": ["solid_motors"]
            }
        }
        
        log_database_loading("material", len(fallback_data), e)
        dbg_exit("load_material_database", error=str(e), fallback_count=len(fallback_data))
        return fallback_data

# ================================
# MOTOR DATABASE
# ================================

def load_motor_database() -> Dict[str, Any]:
    """
    Load motor database from shared JSON file
    
    Returns:
        Dictionary containing motor specifications with fallback data
    """
    dbg_enter("load_motor_database")
    try:
        with open(MOTORS_DB_PATH, 'r') as f:
            motor_data_raw = json.load(f)

        # Convert frontend format to backend format (camelCase -> snake_case)
        motor_database = {}
        for motor_id, spec in motor_data_raw.items():
            motor_database[motor_id] = {
                "name": spec["name"],
                "manufacturer": spec["manufacturer"],
                "type": spec["type"],
                "impulse_class": spec["impulseClass"],
                "total_impulse_n_s": spec["totalImpulse_Ns"],
                "avg_thrust_n": spec["avgThrust_N"],
                "burn_time_s": spec["burnTime_s"],
                "dimensions": {
                    "outer_diameter_m": spec["dimensions"]["outerDiameter_m"],
                    "length_m": spec["dimensions"]["length_m"]
                },
                "mass": {
                    "propellant_kg": spec["mass"]["propellant_kg"],
                    "total_kg": spec["mass"]["total_kg"]
                },
                "isp_s": spec["isp_s"]
            }
            
            # Add optional configs if present
            if "grainConfig" in spec and spec["grainConfig"]:
                motor_database[motor_id]["grain_config"] = {
                    "grain_number": spec["grainConfig"]["grainNumber"],
                    "grain_density_kg_m3": spec["grainConfig"]["grainDensity_kg_m3"],
                    "grain_outer_radius_m": spec["grainConfig"]["grainOuterRadius_m"],
                    "grain_initial_inner_radius_m": spec["grainConfig"]["grainInitialInnerRadius_m"],
                    "grain_initial_height_m": spec["grainConfig"]["grainInitialHeight_m"]
                }
            
            if "propellantConfig" in spec and spec["propellantConfig"]:
                motor_database[motor_id]["propellant_config"] = {
                    "oxidizer_to_fuel_ratio": spec["propellantConfig"]["oxidizerToFuelRatio"],
                    "chamber_pressure_pa": spec["propellantConfig"]["chamberPressure_pa"],
                    "nozzle_expansion_ratio": spec["propellantConfig"]["nozzleExpansionRatio"]
                }
            
            if "hybridConfig" in spec and spec["hybridConfig"]:
                motor_database[motor_id]["hybrid_config"] = {
                    "grain_density_kg_m3": spec["hybridConfig"]["grainDensity_kg_m3"],
                    "oxidizer_mass_kg": spec["hybridConfig"]["oxidizerMass_kg"],
                    "fuel_mass_kg": spec["hybridConfig"]["fuelMass_kg"],
                    "chamber_pressure_pa": spec["hybridConfig"]["chamberPressure_pa"]
                }
        
        log_database_loading("motor", len(motor_database))
        dbg_exit("load_motor_database", count=len(motor_database))
        return motor_database
        
    except Exception as e:
        # Minimal fallback - only essential motors
        fallback_data = {
            "default-motor": {
                "name": "F32-6", 
                "manufacturer": "Generic", 
                "type": "solid",
                "impulse_class": "F", 
                "total_impulse_n_s": 80, 
                "avg_thrust_n": 32,
                "burn_time_s": 2.5,
                "dimensions": {
                    "outer_diameter_m": 0.029, 
                    "length_m": 0.124
                },
                "mass": {
                    "propellant_kg": 0.040, 
                    "total_kg": 0.070
                },
                "isp_s": 200
            },
            "estes_c6_5": {
                "name": "C6-5",
                "manufacturer": "Estes",
                "type": "solid",
                "impulse_class": "C",
                "total_impulse_n_s": 10.0,
                "avg_thrust_n": 5.0,
                "burn_time_s": 2.0,
                "dimensions": {
                    "outer_diameter_m": 0.018,
                    "length_m": 0.070
                },
                "mass": {
                    "propellant_kg": 0.012,
                    "total_kg": 0.024
                },
                "isp_s": 180
            },
            "aerotech_i200w": {
                "name": "I200W",
                "manufacturer": "AeroTech",
                "type": "solid",
                "impulse_class": "I",
                "total_impulse_n_s": 320.0,
                "avg_thrust_n": 200.0,
                "burn_time_s": 1.6,
                "dimensions": {
                    "outer_diameter_m": 0.038,
                    "length_m": 0.124
                },
                "mass": {
                    "propellant_kg": 0.125,
                    "total_kg": 0.280
                },
                "isp_s": 220
            }
        }
        
        log_database_loading("motor", len(fallback_data), e)
        dbg_exit("load_motor_database", error=str(e), fallback_count=len(fallback_data))
        return fallback_data

# ================================
# DATABASE INITIALIZATION
# ================================

def initialize_databases():
    """
    Initialize all databases and update dependent configurations
    
    Returns:
        Tuple of (material_database, motor_database)
    """
    dbg_enter("initialize_databases")
    
    # Load databases
    material_database = load_material_database()
    motor_database = load_motor_database()
    
    # Update material densities in constants
    update_material_densities(material_database)
    
    dbg_exit("initialize_databases", 
             materials_count=len(material_database), 
             motors_count=len(motor_database))
    
    return material_database, motor_database

# ================================
# DATABASE ACCESS HELPERS
# ================================

def get_material_properties(material_id: str, material_database: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get material properties by ID with fallback
    
    Args:
        material_id: Material identifier
        material_database: Material database dictionary
        
    Returns:
        Material properties dictionary
    """
    if material_id in material_database:
        return material_database[material_id]
    
    # Fallback to fiberglass if material not found
    fallback = material_database.get("fiberglass", {
        "density_kg_m3": 1600.0,
        "surfaceRoughness_m": 0.00001,
        "name": "Unknown Material (Fiberglass default)"
    })
    
    return fallback

def get_motor_properties(motor_id: str, motor_database: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get motor properties by ID with validation
    
    Args:
        motor_id: Motor identifier
        motor_database: Motor database dictionary
        
    Returns:
        Motor properties dictionary
        
    Raises:
        ValueError: If motor ID not found and no fallback available
    """
    if motor_id in motor_database:
        return motor_database[motor_id]
    
    # Check for default motor as fallback
    if "default-motor" in motor_database:
        return motor_database["default-motor"]
    
    # No fallback available
    available_motors = list(motor_database.keys())
    raise ValueError(f"Motor ID '{motor_id}' not found. Available motors: {available_motors}")

def validate_motor_database(motor_database: Dict[str, Any]) -> bool:
    """
    Validate motor database structure and required fields
    
    Args:
        motor_database: Motor database to validate
        
    Returns:
        True if valid, False otherwise
    """
    required_fields = [
        "name", "manufacturer", "type", "impulse_class",
        "total_impulse_n_s", "avg_thrust_n", "burn_time_s",
        "dimensions", "mass", "isp_s"
    ]
    
    for motor_id, motor_spec in motor_database.items():
        for field in required_fields:
            if field not in motor_spec:
                return False
        
        # Validate nested structures
        if "outer_diameter_m" not in motor_spec.get("dimensions", {}):
            return False
        if "propellant_kg" not in motor_spec.get("mass", {}):
            return False
    
    return True

def validate_material_database(material_database: Dict[str, Any]) -> bool:
    """
    Validate material database structure and required fields
    
    Args:
        material_database: Material database to validate
        
    Returns:
        True if valid, False otherwise
    """
    required_fields = ["id", "name", "density_kg_m3"]
    
    for material_id, material_spec in material_database.items():
        for field in required_fields:
            if field not in material_spec:
                return False
    
    return True

# ================================
# GLOBAL DATABASE INSTANCES
# ================================

# Load databases on module import
MATERIAL_DATABASE, MOTOR_DATABASE = initialize_databases()

# Validate databases
if not validate_material_database(MATERIAL_DATABASE):
    from .logging import logger
    logger.warning("⚠️ Material database validation failed - some features may not work correctly")

if not validate_motor_database(MOTOR_DATABASE):
    from .logging import logger
    logger.warning("⚠️ Motor database validation failed - some features may not work correctly")