"""
API dependencies for RocketPy simulation service.

This module provides dependency injection functions for FastAPI routes.
"""

from concurrent.futures import ThreadPoolExecutor

# Thread pool executor for CPU-intensive simulations
# Shared across all simulation endpoints
executor = ThreadPoolExecutor(max_workers=4)