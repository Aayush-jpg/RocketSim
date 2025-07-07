"""
API layer for RocketPy simulation service.

This module provides the REST API endpoints, middleware configuration,
and dependency injection for the FastAPI application.

Main components:
- endpoints: All REST API routes and handlers
- middleware: CORS and other middleware configuration
- dependencies: Shared dependencies and thread pool executor

Usage:
    from api.endpoints import register_routes
    from api.middleware import setup_middleware
"""

from .endpoints import register_routes
from .middleware import setup_middleware
from .dependencies import executor

__all__ = [
    'register_routes',
    'setup_middleware', 
    'executor'
]