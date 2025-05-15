"""Rocket-agents module for the rocket agent API."""

# Import our agent instances 
from .design import design_agent
from .sim import sim_agent
from .metrics import metrics_agent
from .qa import qa_agent
from .router import router_agent
from .qa import get_rocket_details
from .prediction import PREDICTION_AGENT_INSTRUCTIONS

# Expose everything as public exports
__all__ = [
    "design_agent",
    "sim_agent",
    "metrics_agent",
    "qa_agent",
    "router_agent",
    "get_rocket_details",
    "PREDICTION_AGENT_INSTRUCTIONS"
] 