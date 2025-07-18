"""
RocketPy simulation engine modules.

This module provides all simulation functionality including core simulation,
enhanced simulation with full RocketPy capabilities, Monte Carlo analysis,
and specialized batch processing.

Main simulation functions:
- simulate_rocket_6dof: Standard high-fidelity 6-DOF simulation
- simulate_rocket_6dof_enhanced: Enhanced simulation with full RocketPy features
- simulate_simplified_fallback: Physics-based fallback when RocketPy unavailable

Core simulation classes are organized into:
- core/: Standard simulation classes (Environment, Motor, Rocket, Flight, MonteCarlo)
- enhanced/: Enhanced simulation classes with advanced modeling capabilities

Usage:
    from simulation import simulate_rocket_6dof, simulate_rocket_6dof_enhanced
    from simulation.core.monte_carlo import ThreadSafeRocketPyMonteCarlo
"""

# Core simulation functions
from .engine import (
    simulate_rocket_6dof,
    simulate_simplified_fallback
)

# Enhanced simulation functions  
from .enhanced_engine import (
    simulate_rocket_6dof_enhanced
)

# Specialized simulation functions
from .specialized import (
    run_batch_simulations
)

# Core simulation classes
from .core import (
    SimulationEnvironment,
    SimulationMotor, 
    SimulationRocket,
    SimulationFlight
)

# Monte Carlo class imported separately to avoid circular dependencies
from .core.monte_carlo import ThreadSafeRocketPyMonteCarlo

# Enhanced simulation classes
from .enhanced import (
    EnhancedSimulationEnvironment,
    EnhancedSimulationMotor,
    EnhancedSimulationRocket, 
    EnhancedSimulationFlight
)

__all__ = [
    # Core simulation functions
    'simulate_rocket_6dof',
    'simulate_simplified_fallback',
    
    # Enhanced simulation functions
    'simulate_rocket_6dof_enhanced',
    
    # Specialized functions
    'run_batch_simulations',
    
    # Core simulation classes
    'SimulationEnvironment',
    'SimulationMotor',
    'SimulationRocket', 
    'SimulationFlight',
    'ThreadSafeRocketPyMonteCarlo',
    
    # Enhanced simulation classes
    'EnhancedSimulationEnvironment',
    'EnhancedSimulationMotor',
    'EnhancedSimulationRocket',
    'EnhancedSimulationFlight'
]