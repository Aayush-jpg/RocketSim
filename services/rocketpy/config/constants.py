"""
Physical constants and feature flags for RocketPy simulation service.

This module centralizes all physical constants, feature availability checks,
and configuration variables used throughout the application.
"""

import os
import threading
from concurrent.futures import ThreadPoolExecutor

# ================================
# FEATURE AVAILABILITY FLAGS
# ================================

# MSISE00 library availability
try:
    import msise00
    MSISE_AVAILABLE = True
except ImportError:
    MSISE_AVAILABLE = False

# Process pool availability
try:
    from concurrent.futures import ProcessPoolExecutor
    PROCESS_POOL_AVAILABLE = True
    print("✅ Process pool executor available for parallel computing")
except ImportError:
    PROCESS_POOL_AVAILABLE = False
    print("⚠️ Process pool not available")

# Multiprocessing availability
try:
    import multiprocessing as mp
    MULTIPROCESSING_AVAILABLE = True
    print("✅ Multiprocessing available for distributed computing")
except ImportError:
    MULTIPROCESSING_AVAILABLE = False
    print("⚠️ Multiprocessing not available")

# GPU acceleration availability
try:
    import cupy as cp
    GPU_AVAILABLE = True
    print("✅ GPU acceleration available via CuPy")
except ImportError:
    GPU_AVAILABLE = False
    print("⚠️ GPU acceleration not available, using CPU")

# Numba JIT compilation availability
try:
    import numba
    from numba import jit, cuda
    NUMBA_AVAILABLE = True
    print("✅ Numba JIT compilation available")
except ImportError:
    NUMBA_AVAILABLE = False
    print("⚠️ Numba not available")
    # Create dummy decorator
    def jit(*args, **kwargs):
        def decorator(func):
            return func
        return decorator

# Dask distributed computing availability
try:
    from dask.distributed import Client, as_completed
    import dask
    from dask import delayed
    DASK_AVAILABLE = True
    print("✅ Dask distributed computing available")
except ImportError:
    DASK_AVAILABLE = False
    print("⚠️ Dask not available")

# Advanced solvers availability
try:
    from assimulo.solvers import Radau5ODE, LSODA, BDF
    from assimulo.problem import Explicit_Problem
    ADVANCED_SOLVERS_AVAILABLE = True
    print("✅ Advanced stiff ODE solvers available (Radau5, BDF)")
except ImportError:
    ADVANCED_SOLVERS_AVAILABLE = False
    print("⚠️ Advanced solvers not available, using scipy fallback")

# Ambiance atmospheric modeling availability
try:
    import ambiance
    AMBIANCE_AVAILABLE = True
    print("✅ Ambiance atmospheric modeling available")
except ImportError:
    AMBIANCE_AVAILABLE = False

# Advanced statistics availability
try:
    from scipy import stats
    from sklearn.preprocessing import StandardScaler
    from sklearn.decomposition import PCA
    ADVANCED_STATS_AVAILABLE = True
    print("✅ Advanced statistical tools available")
except ImportError:
    ADVANCED_STATS_AVAILABLE = False

# Atmospheric data processing availability
try:
    import xarray as xr
    import netCDF4
    ATMOSPHERIC_DATA_PROCESSING_AVAILABLE = True
    print("✅ Professional atmospheric data processing available")
except ImportError:
    ATMOSPHERIC_DATA_PROCESSING_AVAILABLE = False

# RocketPy availability
try:
    from rocketpy import Environment, SolidMotor, Rocket, Flight, GenericMotor, LiquidMotor, HybridMotor
    from rocketpy import NoseCone, Fins, Parachute
    from rocketpy import MonteCarlo
    from rocketpy.stochastic import (
        StochasticEnvironment, StochasticFlight, StochasticNoseCone, StochasticRocket,
        StochasticSolidMotor, StochasticTrapezoidalFins, StochasticParachute
    )
    ROCKETPY_AVAILABLE = True
    print("✅ RocketPy successfully imported with core classes")
except ImportError as e:
    print(f"Warning: RocketPy import failed: {e}")
    print("Using simplified simulation model")
    Environment, SolidMotor, Rocket, Flight, GenericMotor, LiquidMotor, HybridMotor = None, None, None, None, None, None, None
    NoseCone, Fins, Parachute = None, None, None
    MonteCarlo, StochasticEnvironment, StochasticFlight, StochasticNoseCone, StochasticRocket, StochasticSolidMotor, StochasticTrapezoidalFins, StochasticParachute = [None] * 8
    ROCKETPY_AVAILABLE = False

# Combined feature flags
THREAD_SAFE_NRLMSISE_AVAILABLE = PROCESS_POOL_AVAILABLE and MSISE_AVAILABLE

# ================================
# THREADING CONFIGURATION
# ================================

# Thread lock for RocketPy integrator thread safety
rocketpy_lock = threading.Lock()

# Thread pool for CPU-intensive simulations
executor = ThreadPoolExecutor(max_workers=4)

# ================================
# PHYSICAL CONSTANTS
# ================================

class PhysicalConstants:
    """Physical constants in SI units"""
    
    # Basic physical constants
    STANDARD_GRAVITY = 9.80665  # m/s²
    STANDARD_TEMPERATURE = 288.15  # K (15°C)
    STANDARD_PRESSURE = 101325.0  # Pa (1 atm)
    AIR_DENSITY_SEA_LEVEL = 1.225  # kg/m³
    
    # Atmospheric model constants
    LAPSE_RATE = 0.0065  # K/m (tropospheric lapse rate)
    SCALE_HEIGHT = 8400  # m (atmospheric scale height)
    GAS_CONSTANT_AIR = 287.04  # J/(kg·K)
    SPECIFIC_HEAT_RATIO = 1.4  # Ratio of specific heats for air
    
    # Material densities (will be updated from database after loading)
    DENSITY_FIBERGLASS = 1600.0  # kg/m³ (default, updated from database)
    DENSITY_ALUMINUM = 2700.0   # kg/m³ (default, updated from database)
    DENSITY_CARBON_FIBER = 1500.0  # kg/m³ (default, updated from database)
    DENSITY_PLYWOOD = 650.0     # kg/m³ (default, updated from database)
    DENSITY_ABS = 1050.0        # kg/m³ (default, updated from database)
    DENSITY_APCP = 1815.0       # kg/m³ (default, updated from database)

# ================================
# SOLVER CONFIGURATION
# ================================

class SolverConfig:
    """Configuration for numerical solvers"""
    
    # Default solver hierarchy for stability
    SOLVER_HIERARCHY = [
        {'name': 'LSODA', 'method': 'LSODA', 'rtol': 1e-6, 'atol': 1e-9, 'timeout': 30},
        {'name': 'Radau', 'method': 'Radau', 'rtol': 1e-5, 'atol': 1e-8, 'timeout': 45},  
        {'name': 'BDF', 'method': 'BDF', 'rtol': 1e-4, 'atol': 1e-7, 'timeout': 60},
        {'name': 'RK45', 'method': 'RK45', 'rtol': 1e-3, 'atol': 1e-6, 'timeout': 90}
    ]
    
    # Default tolerances
    DEFAULT_RTOL = 1e-6
    DEFAULT_ATOL = 1e-9
    DEFAULT_TIMEOUT = 60  # seconds
    
    # Memory limits
    MAX_MEMORY_MB = 512
    MAX_TRAJECTORY_POINTS = 100000

# ================================
# ATMOSPHERIC MODEL CONFIGURATION
# ================================

class AtmosphericConfig:
    """Configuration for atmospheric models"""
    
    AVAILABLE_MODELS = ["standard", "custom", "forecast", "nrlmsise"]
    DEFAULT_MODEL = "standard"
    
    MODEL_DESCRIPTIONS = {
        "standard": "International Standard Atmosphere (ISA) - Reliable baseline model",
        "forecast": "Real-time weather data from GFS - Most accurate for actual launches", 
        "custom": "User-defined atmospheric conditions - For research and specialized applications",
        "nrlmsise": "NASA's NRLMSISE-00 model for high-altitude flights (0-120km)"
    }
    
    MODEL_CAPABILITIES = {
        "standard": {
            "altitude_range_m": [0, 30000],
            "accuracy": "baseline",
            "data_sources": ["ISA tables"],
            "features": ["temperature_profile", "pressure_profile", "density_calculation"]
        },
        "forecast": {
            "altitude_range_m": [0, 20000], 
            "accuracy": "high",
            "data_sources": ["GFS", "real_time_weather"],
            "features": ["real_wind_data", "temperature_profiles", "pressure_data", "humidity"]
        },
        "custom": {
            "altitude_range_m": [0, 100000],
            "accuracy": "user_defined",
            "data_sources": ["user_input"],
            "features": ["custom_profiles", "research_applications"]
        },
        "nrlmsise": {
            "altitude_range_m": [0, 120000],
            "accuracy": "high_altitude",
            "data_sources": ["NRLMSISE-00"],
            "features": ["extended_altitude", "space_applications"]
        }
    }

# ================================
# APPLICATION CONFIGURATION
# ================================

# Logging configuration
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# Simulation timeouts
SIMULATION_TIMEOUT = int(os.getenv("SIMULATION_TIMEOUT", "300"))  # seconds
MONTE_CARLO_TIMEOUT = int(os.getenv("MONTE_CARLO_TIMEOUT", "1800"))  # seconds

# Resource limits
MAX_CONCURRENT_SIMULATIONS = int(os.getenv("MAX_CONCURRENT_SIMULATIONS", "10"))
MAX_MONTE_CARLO_ITERATIONS = int(os.getenv("MAX_MONTE_CARLO_ITERATIONS", "1000"))

# Database paths
MATERIALS_DB_PATH = os.getenv("MATERIALS_DB_PATH", "/app/lib/data/materials.json")
MOTORS_DB_PATH = os.getenv("MOTORS_DB_PATH", "/app/lib/data/motors.json")

def update_material_densities(material_database):
    """Update physical constants with actual material database values"""
    if material_database:
        PhysicalConstants.DENSITY_FIBERGLASS = material_database.get("fiberglass", {}).get("density_kg_m3", 1600.0)
        PhysicalConstants.DENSITY_ALUMINUM = material_database.get("aluminum_6061", {}).get("density_kg_m3", 2700.0) 
        PhysicalConstants.DENSITY_CARBON_FIBER = material_database.get("carbon_fiber", {}).get("density_kg_m3", 1500.0)
        PhysicalConstants.DENSITY_PLYWOOD = material_database.get("birch_plywood", {}).get("density_kg_m3", 650.0)
        PhysicalConstants.DENSITY_ABS = material_database.get("abs", {}).get("density_kg_m3", 1050.0)
        PhysicalConstants.DENSITY_APCP = material_database.get("apcp", {}).get("density_kg_m3", 1815.0)