"""
Configuration module for RocketPy simulation service.

This module provides centralized configuration, constants, and database management.
"""

from .constants import *
from .database import MATERIAL_DATABASE, MOTOR_DATABASE, load_material_database, load_motor_database
from .logging import setup_logging, dbg_enter, dbg_exit, logger

__all__ = [
    # Constants
    'ROCKETPY_AVAILABLE', 'MSISE_AVAILABLE', 'GPU_AVAILABLE', 'NUMBA_AVAILABLE',
    'DASK_AVAILABLE', 'PROCESS_POOL_AVAILABLE', 'MULTIPROCESSING_AVAILABLE',
    'THREAD_SAFE_NRLMSISE_AVAILABLE', 'ADVANCED_SOLVERS_AVAILABLE',
    'AMBIANCE_AVAILABLE', 'ADVANCED_STATS_AVAILABLE', 'ATMOSPHERIC_DATA_PROCESSING_AVAILABLE',
    'PhysicalConstants',
    
    # Database
    'MATERIAL_DATABASE', 'MOTOR_DATABASE', 'load_material_database', 'load_motor_database',
    
    # Logging
    'setup_logging', 'dbg_enter', 'dbg_exit', 'logger'
]