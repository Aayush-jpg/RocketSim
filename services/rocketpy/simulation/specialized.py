"""
Specialized simulation functions.

This module provides specialized simulation functions for specific use cases
such as batch processing, batch simulations, and background task execution.
"""

import asyncio
from typing import List
from concurrent.futures import ThreadPoolExecutor

from config import logger
from models.rocket import RocketModel
from models.environment import EnvironmentModel, LaunchParametersModel
from models.simulation import SimulationResult
from .engine import simulate_rocket_6dof

# Thread pool executor for batch simulations
executor = ThreadPoolExecutor(max_workers=4)

async def run_batch_simulations(configs: List[RocketModel]) -> List[SimulationResult]:
    """
    Background task runner for batch simulations.
    
    This function processes multiple rocket configurations in parallel,
    handling individual simulation failures gracefully.
    """
    results = []
    
    for i, config in enumerate(configs):
        try:
            logger.info(f"Running batch simulation {i+1}/{len(configs)}")
            result = await simulate_rocket_6dof(config)
            results.append(result)
        except Exception as e:
            logger.error(f"Batch simulation {i+1} failed: {e}")
            # Continue with other simulations even if one fails
            error_result = SimulationResult(
                maxAltitude=0.0,
                maxVelocity=0.0,
                maxAcceleration=0.0,
                apogeeTime=0.0,
                stabilityMargin=0.0,
                thrustCurve=[],
                simulationFidelity="error",
                error=str(e)
            )
            results.append(error_result)
    
    logger.info(f"Completed batch simulation: {len(results)} results")
    return results