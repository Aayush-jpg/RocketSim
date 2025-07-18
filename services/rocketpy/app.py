"""
RocketPy Professional Simulation Service - Main Application

Streamlined FastAPI application that orchestrates all simulation components.
All business logic has been extracted to focused modules for maintainability.

Architecture:
- config/: Configuration, constants, and database loaders
- models/: Pydantic data models for requests/responses  
- simulation/: Core and enhanced simulation engines
- api/: REST API endpoints and middleware
- utils/: Atmospheric corrections and validation utilities

This refactored architecture provides:
- Clear separation of concerns
- Modular, testable components
- Maintainable codebase structure
- Professional-grade simulation capabilities
"""

import uvicorn
from fastapi import FastAPI

# Core configuration
from config import logger, ROCKETPY_AVAILABLE, MOTOR_DATABASE

# API layer
from api import register_routes, setup_middleware, executor

# Initialize FastAPI application
app = FastAPI(
    title="RocketPy Professional Simulation Service",
    description=(
        "Professional-grade rocket simulation with 6-DOF physics, Monte Carlo analysis, "
        "and atmospheric modeling. All dimensions in SI units (meters, kg, seconds, Newtons)."
    ),
    version="3.0.0"
)

# Setup middleware (CORS, etc.)
setup_middleware(app)

# Register all API routes
register_routes(app)

@app.on_event("startup")
async def startup_event():
    """Initialize application on startup"""
    logger.info("🚀 RocketPy Professional Simulation Service starting up...")
    logger.info(f"   RocketPy Library Available: {'✅' if ROCKETPY_AVAILABLE else '❌'}")
    logger.info(f"   Motor Database Loaded: {len(MOTOR_DATABASE)} motors")
    logger.info("🚀 Service ready for rocket simulations!")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on application shutdown"""
    logger.info("🛑 RocketPy Professional Simulation Service shutting down...")
    executor.shutdown(wait=True)
    logger.info("🛑 Service shutdown complete")

# Development server
if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host="0.0.0.0", 
        port=8000,
        reload=True,
        log_level="info"
    ) 