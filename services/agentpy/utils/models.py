"""Pydantic models for API requests and tool parameters."""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Literal

class ChatRequest(BaseModel):
    """Request model for the main /reason endpoint."""
    messages: List[Dict[str, str]]
    rocket: Dict[str, Any]

class AgentRequest(BaseModel):
    """Request model for the /reason-with-agent endpoint."""
    messages: List[Dict[str, str]]
    rocket: Dict[str, Any]
    agent: Optional[str] = "master"  # Which agent to use

class PartProps(BaseModel):
    """Properties for a rocket part that can be modified."""
    color: Optional[str] = None
    shape: Optional[str] = None
    length: Optional[float] = None
    baseØ: Optional[float] = Field(None, alias="baseØ")
    Ø: Optional[float] = Field(None, alias="Ø")
    root: Optional[float] = None
    span: Optional[float] = None
    sweep: Optional[float] = None
    
    model_config = {
        "extra": "forbid",  # Forbid extra properties
        "populate_by_name": True  # Allow population by name to handle aliases
    }

class RocketProps(BaseModel):
    """Properties for a rocket that can be modified."""
    motorId: Optional[str] = None
    Cd: Optional[float] = None
    units: Optional[str] = None
    
    model_config = {
        "extra": "forbid"  # Forbid extra properties
    } 