"""
Enhanced simulation engine functions.

This module provides enhanced simulation functions with full RocketPy
integration and advanced analysis capabilities.
"""

import asyncio
import traceback
from concurrent.futures import ThreadPoolExecutor
from typing import Optional, Dict, Any

from config import ROCKETPY_AVAILABLE, logger
from models.rocket import RocketModel
from models.environment import EnvironmentModel, LaunchParametersModel
from models.simulation import SimulationResult
from .enhanced.environment import EnhancedSimulationEnvironment
from .enhanced.motor import EnhancedSimulationMotor
from .enhanced.rocket import EnhancedSimulationRocket
from .enhanced.flight import EnhancedSimulationFlight
from .engine import simulate_simplified_fallback

# Thread pool executor for non-blocking simulation execution
executor = ThreadPoolExecutor(max_workers=4)

async def simulate_rocket_6dof_enhanced(rocket_config: RocketModel, 
                                      environment_config: EnvironmentModel = None,
                                      launch_params: LaunchParametersModel = None,
                                      analysis_options: Dict[str, Any] = None) -> SimulationResult:
    """Run enhanced high-fidelity 6-DOF simulation with full RocketPy capabilities"""
    
    if not ROCKETPY_AVAILABLE:
        return await simulate_simplified_fallback(rocket_config)
    
    try:
        # Set defaults
        if environment_config is None:
            environment_config = EnvironmentModel()
        if launch_params is None:
            launch_params = LaunchParametersModel()
        if analysis_options is None:
            analysis_options = {}
        
        # Run enhanced simulation in thread pool
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            executor, 
            _run_enhanced_simulation_sync, 
            rocket_config, 
            environment_config, 
            launch_params,
            analysis_options
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Enhanced 6-DOF simulation failed: {e}")
        return await simulate_simplified_fallback(rocket_config)

def _run_enhanced_simulation_sync(rocket_config: RocketModel,
                                environment_config: EnvironmentModel,
                                launch_params: LaunchParametersModel,
                                analysis_options: Dict[str, Any]) -> SimulationResult:
    """Enhanced synchronous simulation runner with full RocketPy features"""
    
    logger.info(f"🔴 Creating enhanced simulation objects...")
    
    try:
        # Create enhanced simulation objects with dynamic configuration
        logger.info(f"🔴 Creating enhanced environment...")
        environment = EnhancedSimulationEnvironment(environment_config)
        logger.info(f"🔴 Environment created successfully")
    
        # Pass the actual rocket motor configuration to the motor
        rocket_motor_config = {
            "motor_database_id": rocket_config.motor.motor_database_id,
            "position_from_tail_m": rocket_config.motor.position_from_tail_m,
            "nozzle_expansion_ratio": rocket_config.motor.nozzle_expansion_ratio,
            "chamber_pressure_pa": rocket_config.motor.chamber_pressure_pa
        }
        
        logger.info(f"🔴 Creating enhanced motor: {rocket_config.motor.motor_database_id}")
        motor = EnhancedSimulationMotor(rocket_config.motor.motor_database_id, rocket_motor_config)
        logger.info(f"🔴 Motor created successfully")
            
        logger.info(f"🔴 Creating enhanced rocket: {rocket_config.name}")
        rocket = EnhancedSimulationRocket(rocket_config, motor)
        logger.info(f"🔴 Rocket created successfully")
            
        logger.info(f"🔴 Starting enhanced flight simulation...")
        flight = EnhancedSimulationFlight(rocket, environment, launch_params, analysis_options)
        logger.info(f"🔴 Flight simulation completed")
        
        if flight.results:
            logger.info(f"🔴 Simulation successful - returning results")
            logger.info(f"ENHANCED SIMULATION RESULT: {flight.results.dict()}")
            return flight.results
        else:
            logger.error(f"🔴 ❌ Enhanced simulation failed to produce results")
            raise Exception("Enhanced simulation failed to produce results")
            
    except Exception as e:
        logger.error(f"🔴 ❌ Enhanced simulation sync failed: {str(e)}")
        logger.error(f"🔴 ❌ Full traceback: {traceback.format_exc()}")
        raise