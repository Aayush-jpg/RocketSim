"""
Core simulation classes for RocketPy simulation service.

This module provides the foundational simulation classes that wrap
RocketPy functionality with enhanced error handling and validation.
"""

from .environment import SimulationEnvironment
from .motor import SimulationMotor
from .rocket import SimulationRocket
from .flight import SimulationFlight
# NOTE: ThreadSafeRocketPyMonteCarlo not auto-imported to avoid circular dependencies
# Import directly: from simulation.core.monte_carlo import ThreadSafeRocketPyMonteCarlo

__all__ = [
    'SimulationEnvironment',
    'SimulationMotor',
    'SimulationRocket', 
    'SimulationFlight'
    # 'ThreadSafeRocketPyMonteCarlo'  # Available but not auto-imported
]