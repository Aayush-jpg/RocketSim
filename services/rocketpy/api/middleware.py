"""
API middleware for RocketPy simulation service.

This module configures CORS and other middleware for the FastAPI application.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

def setup_middleware(app: FastAPI):
    """Setup middleware for the FastAPI application"""
    
    # CORS middleware - allow all origins for development
    # In production, this should be restricted to specific domains
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # In production: ["https://your-frontend-domain.com"]
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )