
"""
API endpoints for RocketPy simulation service.

This module contains all REST API endpoints for rocket simulation,
analysis, and configuration.
"""

import json
from typing import Dict, List, Any, Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse

from config import ROCKETPY_AVAILABLE, MOTOR_DATABASE, logger
from models.rocket import RocketModel
from models.environment import EnvironmentModel, LaunchParametersModel
from models.simulation import SimulationRequestModel, SimulationResult
from models.components import MotorSpec
from models.monte_carlo import MonteCarloRequest, MonteCarloResult
from simulation import (
    simulate_rocket_6dof,
    simulate_rocket_6dof_enhanced,
    simulate_simplified_fallback,
    run_batch_simulations,
    ThreadSafeRocketPyMonteCarlo
)
from utils.validation import validate_body_tubes

def register_routes(app: FastAPI):
    """Register all API routes with the FastAPI application"""
    
    @app.get("/health")
    async def health_check():
        """Health check with service status and feature availability"""
        return {
            "status": "healthy",
            "service": "RocketPy Professional Simulation Service",
            "version": "3.0.0",
            "rocketpy_available": ROCKETPY_AVAILABLE,
            "features": {
                "high_fidelity_simulation": ROCKETPY_AVAILABLE,
                "monte_carlo_analysis": ROCKETPY_AVAILABLE,
                "atmospheric_modeling": ROCKETPY_AVAILABLE,
                "simplified_fallback": True
            }
        }

    @app.get("/motors", response_model=Dict[str, List[MotorSpec]])
    async def get_motors(
        motor_type: Optional[str] = None,
        manufacturer: Optional[str] = None,
        impulse_class: Optional[str] = None
    ):
        """Get available motors with optional filtering"""
        filtered_motors = {}
        
        for motor_id, motor_data in MOTOR_DATABASE.items():
            # Apply filters
            if motor_type and motor_data.get("type") != motor_type:
                continue
            if manufacturer and motor_data.get("manufacturer") != manufacturer:
                continue
            if impulse_class and motor_data.get("impulse_class") != impulse_class:
                continue
                
            category = motor_data.get("type", "unknown")
            if category not in filtered_motors:
                filtered_motors[category] = []
                
            motor_spec = MotorSpec(
                id=motor_id,
                name=motor_data.get("name", motor_id),
                manufacturer=motor_data.get("manufacturer", "Unknown"),
                type=motor_data.get("type", "solid"),
                impulse_class=motor_data.get("impulse_class", "Unknown"),
                avg_thrust_n=motor_data.get("avg_thrust_n", 0),
                burn_time_s=motor_data.get("burn_time_s", 0),
                total_impulse_ns=motor_data.get("total_impulse_ns", 0)
            )
            filtered_motors[category].append(motor_spec)
        
        return filtered_motors

    @app.post("/simulate", response_model=SimulationResult)
    async def simulate_standard(request: SimulationRequestModel):
        """Standard simulation with component-based models"""
        logger.info("Received standard simulation request. Payload:\n%s", request.model_dump_json(indent=2))
        try:
            validate_body_tubes(request.rocket)
            
            result = await simulate_rocket_6dof(
                request.rocket,
                request.environment,
                request.launchParameters
            )
            return result
        except Exception as e:
            logger.error(f"Standard simulation failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/simulate/hifi", response_model=SimulationResult)
    async def simulate_high_fidelity(request: SimulationRequestModel):
        """High-fidelity simulation with enhanced physics"""
        logger.info(f"🚀 High-fidelity simulation request for rocket: {request.rocket.name}")
        logger.info("Received high-fidelity simulation request. Payload:\n%s", request.model_dump_json(indent=2))
        
        if not ROCKETPY_AVAILABLE:
            logger.warning("RocketPy not available, using simplified fallback")
            return await simulate_simplified_fallback(request.rocket)
        
        try:
            validate_body_tubes(request.rocket)
            
            result = await simulate_rocket_6dof(
                request.rocket,
                request.environment,
                request.launchParameters
            )
            return result
        except Exception as e:
            logger.error(f"High-fidelity simulation failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/simulate/monte-carlo", response_model=MonteCarloResult)
    async def simulate_monte_carlo(request: MonteCarloRequest):
        """Monte Carlo simulation with uncertainty analysis"""
        logger.info(f"🎲 Monte Carlo simulation request with {request.iterations} iterations")
        logger.info("Received Monte Carlo simulation request. Payload:\n%s", request.model_dump_json(indent=2))
        
        if not ROCKETPY_AVAILABLE:
            raise HTTPException(
                status_code=503,
                detail="Monte Carlo simulation requires RocketPy library"
            )
        
        try:
            monte_carlo = ThreadSafeRocketPyMonteCarlo(request)
            result = await monte_carlo.run_native_montecarlo_simulation()
            return result
        except Exception as e:
            logger.error(f"Monte Carlo simulation failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/simulate/batch")
    async def simulate_batch(
        requests: List[SimulationRequestModel], 
        background_tasks: BackgroundTasks
    ):
        """Batch simulation with background processing (max 50 simulations)"""
        logger.info(f"Received batch simulation request with {len(requests)} simulations.")
        try:
            # Validate all requests
            for req in requests:
                validate_body_tubes(req.rocket)
            
            # Process batch in background
            rocket_configs = [req.rocket for req in requests]
            background_tasks.add_task(run_batch_simulations, rocket_configs)
            
            return {
                "status": "batch_started",
                "simulation_count": len(requests),
                "estimated_completion_time": f"{len(requests) * 2} seconds"
            }
        except Exception as e:
            logger.error(f"Batch simulation failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/simulate/enhanced", response_model=SimulationResult)
    async def simulate_enhanced_6dof(request: SimulationRequestModel):
        """Enhanced high-fidelity 6-DOF simulation"""
        logger.info("Received enhanced simulation request. Payload:\n%s", request.model_dump_json(indent=2))
        try:
            validate_body_tubes(request.rocket)
            
            analysis_options = {
                "include_barrowman": True,
                "include_static_margin": True,
                "include_trajectory_analysis": True,
                "include_stability_analysis": True,
                "include_performance_metrics": True,
                "include_atmospheric_analysis": True
            }
            
            result = await simulate_rocket_6dof_enhanced(
                request.rocket,
                request.environment,
                request.launchParameters,
                analysis_options
            )
            return result
        except Exception as e:
            logger.error(f"Enhanced simulation failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/simulate/professional", response_model=SimulationResult)
    async def simulate_professional_grade(request: SimulationRequestModel):
        """Professional-grade simulation with maximum precision settings"""
        logger.info("Received professional-grade simulation request. Payload:\n%s", request.model_dump_json(indent=2))
        if not ROCKETPY_AVAILABLE:
            raise HTTPException(
                status_code=503,
                detail="Professional simulation requires RocketPy library"
            )
        
        try:
            validate_body_tubes(request.rocket)
            
            # Maximum precision analysis options
            analysis_options = {
                "rtol": 1e-10,
                "atol": 1e-14,
                "include_barrowman": True,
                "include_static_margin": True,
                "include_trajectory_analysis": True,
                "include_stability_analysis": True,
                "include_performance_metrics": True,
                "include_atmospheric_analysis": True,
                "high_precision_mode": True
            }
            
            result = await simulate_rocket_6dof_enhanced(
                request.rocket,
                request.environment,
                request.launchParameters,
                analysis_options
            )
            return result
        except Exception as e:
            logger.error(f"Professional simulation failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/simulate/high-altitude", response_model=SimulationResult)
    async def simulate_high_altitude_6dof(request: SimulationRequestModel):
        """Specialized high-altitude simulation (50-100 km) with bijective atmospheric protection"""
        logger.info("Received high-altitude simulation request. Payload:\n%s", request.model_dump_json(indent=2))
        if not ROCKETPY_AVAILABLE:
            raise HTTPException(
                status_code=503,
                detail="High-altitude simulation requires RocketPy library"
            )
        
        try:
            validate_body_tubes(request.rocket)
            
            # Force NRLMSISE-00 for high-altitude simulations
            if not request.environment:
                request.environment = EnvironmentModel()
            request.environment.atmospheric_model = "nrlmsise00"
            
            # High-altitude specific analysis options
            analysis_options = {
                "rtol": 1e-8,
                "atol": 1e-12,
                "bijective_protection": True,
                "force_nrlmsise": True,
                "high_altitude_mode": True,
                "atmospheric_smoothing": True,
                "include_atmospheric_analysis": True
            }
            
            result = await simulate_rocket_6dof_enhanced(
                request.rocket,
                request.environment,
                request.launchParameters,
                analysis_options
            )
            return result
        except Exception as e:
            logger.error(f"High-altitude simulation failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @app.post("/analyze/stability")
    async def analyze_rocket_stability(request: SimulationRequestModel):
        """Comprehensive stability analysis"""
        try:
            validate_body_tubes(request.rocket)
            
            # Calculate basic stability metrics
            fin_count = sum(fin.fin_count for fin in request.rocket.fins)
            nose_length = request.rocket.nose_cone.length_m if request.rocket.nose_cone else 0.3
            body_diameter = max(tube.outer_radius_m * 2 for tube in request.rocket.body_tubes) if request.rocket.body_tubes else 0.1
            
            # Basic stability calculation
            static_margin = 1.0 + fin_count * 0.2
            
            if ROCKETPY_AVAILABLE:
                # Enhanced stability analysis with RocketPy
                try:
                    result = await simulate_rocket_6dof_enhanced(
                        request.rocket,
                        request.environment,
                        request.launchParameters,
                        {"stability_analysis_only": True}
                    )
                    static_margin = getattr(result, 'stabilityMargin', static_margin)
                except Exception:
                    pass
            
            # Stability rating
            if static_margin < 1.0:
                rating = "unstable"
                recommendation = "Add fins or move center of mass forward"
            elif static_margin < 1.5:
                rating = "marginally_stable"
                recommendation = "Consider adding more fin area"
            elif static_margin < 3.0:
                rating = "stable"
                recommendation = "Good stability margin"
            else:
                rating = "overstable"
                recommendation = "May be sluggish in flight, consider reducing fin area"
            
            return {
                "static_margin": static_margin,
                "rating": rating,
                "recommendation": recommendation,
                "cp_location_m": nose_length + body_diameter * 2,
                "cm_location_m": nose_length + body_diameter * 1.5,
                "fin_configuration": {
                    "total_fins": fin_count,
                    "contributes_to_stability": fin_count > 0
                }
            }
        except Exception as e:
            logger.error(f"Stability analysis failed: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    @app.get("/motors/detailed", response_model=Dict[str, Any])
    async def get_detailed_motors():
        """Get detailed motor specifications with performance data"""
        detailed_motors = {}
        
        for motor_id, motor_data in MOTOR_DATABASE.items():
            category = motor_data.get("type", "unknown")
            if category not in detailed_motors:
                detailed_motors[category] = []
            
            # Enhanced motor data with performance metrics
            detailed_motor = {
                "id": motor_id,
                "name": motor_data.get("name", motor_id),
                "manufacturer": motor_data.get("manufacturer", "Unknown"),
                "type": motor_data.get("type", "solid"),
                "impulse_class": motor_data.get("impulse_class", "Unknown"),
                "performance": {
                    "avg_thrust_n": motor_data.get("avg_thrust_n", 0),
                    "max_thrust_n": motor_data.get("max_thrust_n", motor_data.get("avg_thrust_n", 0) * 1.2),
                    "burn_time_s": motor_data.get("burn_time_s", 0),
                    "total_impulse_ns": motor_data.get("total_impulse_ns", 0),
                    "isp_s": motor_data.get("isp_s", 200),
                    "thrust_to_weight": motor_data.get("avg_thrust_n", 0) / (motor_data.get("mass", {}).get("total_kg", 1) * 9.81)
                },
                "mass": motor_data.get("mass", {}),
                "geometry": motor_data.get("geometry", {}),
                "grain_properties": motor_data.get("grain_properties", {})
            }
            detailed_motors[category].append(detailed_motor)
        
        return detailed_motors

    @app.get("/environment/atmospheric-models")
    async def get_atmospheric_models():
        """Get atmospheric modeling options for simulation configuration"""
        models = {
            "standard": {
                "name": "Standard Atmosphere",
                "description": "International Standard Atmosphere (ISA) model",
                "altitude_range_km": [0, 86],
                "capabilities": ["temperature", "pressure", "density"],
                "requirements": [],
                "recommended_for": "General purpose simulations up to 86 km"
            },
            "forecast": {
                "name": "Weather Forecast",
                "description": "Real-time weather data integration",
                "altitude_range_km": [0, 30],
                "capabilities": ["temperature", "pressure", "density", "wind", "humidity"],
                "requirements": ["internet_connection", "date", "location"],
                "recommended_for": "Accurate short-term flight predictions"
            }
        }
        
        if ROCKETPY_AVAILABLE:
            models.update({
                "nrlmsise00": {
                    "name": "NRLMSISE-00",
                    "description": "Naval Research Laboratory atmospheric model",
                    "altitude_range_km": [0, 1000],
                    "capabilities": ["temperature", "pressure", "density", "composition"],
                    "requirements": ["rocketpy"],
                    "recommended_for": "High-altitude simulations (50-100+ km)"
                },
                "custom_atmosphere": {
                    "name": "Custom Atmospheric Profile",
                    "description": "User-defined atmospheric properties",
                    "altitude_range_km": [0, "unlimited"],
                    "capabilities": ["temperature", "pressure", "density", "wind"],
                    "requirements": ["rocketpy", "atmospheric_data"],
                    "recommended_for": "Specialized conditions or research applications"
                }
            })
        
        return {
            "available_models": models,
            "default_model": "standard",
            "rocketpy_required": ["nrlmsise00", "custom_atmosphere"],
            "model_capabilities": {
                "bijective_correction": ROCKETPY_AVAILABLE,
                "high_altitude_support": ROCKETPY_AVAILABLE,
                "real_time_weather": True
            }
        }
