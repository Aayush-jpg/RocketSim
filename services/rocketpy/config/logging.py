"""
Logging configuration and debug utilities for RocketPy simulation service.

This module provides centralized logging setup and debug tracing functions.
"""

import os
import logging
from typing import Any, Dict

# ================================
# LOGGING CONFIGURATION
# ================================

# Get log level from environment
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

def setup_logging():
    """Setup centralized logging configuration"""
    logging.basicConfig(
        level=getattr(logging, LOG_LEVEL, logging.INFO),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.StreamHandler(),
            # Add file handler if needed
            # logging.FileHandler('/app/logs/rocketpy.log')
        ]
    )
    
    # Create logger instance
    logger = logging.getLogger("rocketpy")
    logger.info(f"✅ Logging configured at {LOG_LEVEL} level")
    return logger

# Global logger instance
logger = logging.getLogger("rocketpy")

# ================================
# DEBUG UTILITIES
# ================================

def dbg_enter(func_name: str, **kwargs):
    """
    Debug log for function entry.
    
    Args:
        func_name: Name of the function being entered
        **kwargs: Function arguments to log
    """
    if logger.isEnabledFor(logging.DEBUG):
        # Truncate long arguments for cleaner logs
        preview_args = {
            k: (str(v)[:120] + '...') if len(str(v)) > 120 else v 
            for k, v in kwargs.items()
        }
        logger.debug(f"▶️ ENTER: {func_name} | ARGS: {preview_args}")

def dbg_exit(func_name: str, **kwargs):
    """
    Debug log for function exit.
    
    Args:
        func_name: Name of the function being exited
        **kwargs: Return values or exit information to log
    """
    if logger.isEnabledFor(logging.DEBUG):
        # Truncate long return values
        preview_returns = {
            k: (str(v)[:120] + '...') if len(str(v)) > 120 else v 
            for k, v in kwargs.items()
        }
        logger.debug(f"◀️ EXIT: {func_name} | RETURNS: {preview_returns}")

def log_simulation_start(simulation_type: str, request_id: str = None, **details):
    """Log the start of a simulation with relevant details"""
    if request_id:
        logger.info(f"🚀 Starting {simulation_type} simulation [{request_id}]")
    else:
        logger.info(f"🚀 Starting {simulation_type} simulation")
    
    if logger.isEnabledFor(logging.DEBUG) and details:
        logger.debug(f"   Simulation details: {details}")

def log_simulation_success(simulation_type: str, request_id: str = None, duration: float = None, **results):
    """Log successful completion of a simulation"""
    duration_str = f" in {duration:.2f}s" if duration else ""
    if request_id:
        logger.info(f"✅ {simulation_type} simulation completed successfully [{request_id}]{duration_str}")
    else:
        logger.info(f"✅ {simulation_type} simulation completed successfully{duration_str}")
    
    if logger.isEnabledFor(logging.DEBUG) and results:
        logger.debug(f"   Results: {results}")

def log_simulation_error(simulation_type: str, error: Exception, request_id: str = None):
    """Log simulation errors with context"""
    if request_id:
        logger.error(f"❌ {simulation_type} simulation failed [{request_id}]: {error}")
    else:
        logger.error(f"❌ {simulation_type} simulation failed: {error}")
    
    if logger.isEnabledFor(logging.DEBUG):
        import traceback
        logger.debug(f"   Full traceback: {traceback.format_exc()}")

def log_performance_metric(metric_name: str, value: float, unit: str = "", context: Dict[str, Any] = None):
    """Log performance metrics for monitoring"""
    unit_str = f" {unit}" if unit else ""
    logger.info(f"📊 {metric_name}: {value:.3f}{unit_str}")
    
    if logger.isEnabledFor(logging.DEBUG) and context:
        logger.debug(f"   Context: {context}")

def log_feature_availability(feature_name: str, available: bool, details: str = ""):
    """Log feature availability during startup"""
    status = "✅" if available else "⚠️"
    detail_str = f" - {details}" if details else ""
    logger.info(f"{status} {feature_name}: {'Available' if available else 'Not available'}{detail_str}")

def log_database_loading(db_type: str, count: int = None, error: Exception = None):
    """Log database loading results"""
    if error:
        logger.error(f"❌ Failed to load {db_type} database: {error}")
        logger.info(f"🔄 Using fallback {db_type} database")
    else:
        count_str = f" ({count} entries)" if count is not None else ""
        logger.info(f"✅ Successfully loaded {db_type} database{count_str}")

# ================================
# CONTEXT MANAGERS FOR LOGGING
# ================================

class LoggedOperation:
    """Context manager for logging operations with automatic entry/exit"""
    
    def __init__(self, operation_name: str, **context):
        self.operation_name = operation_name
        self.context = context
        self.start_time = None
    
    def __enter__(self):
        import time
        self.start_time = time.time()
        dbg_enter(self.operation_name, **self.context)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        import time
        duration = time.time() - self.start_time if self.start_time else 0
        
        if exc_type is None:
            dbg_exit(self.operation_name, duration=f"{duration:.3f}s", success=True)
        else:
            dbg_exit(self.operation_name, duration=f"{duration:.3f}s", error=str(exc_val))
        
        return False  # Don't suppress exceptions

# ================================
# SPECIALIZED LOGGERS
# ================================

def get_component_logger(component_name: str) -> logging.Logger:
    """Get a logger for a specific component"""
    return logging.getLogger(f"rocketpy.{component_name}")

def get_simulation_logger(simulation_type: str) -> logging.Logger:
    """Get a logger for a specific simulation type"""
    return logging.getLogger(f"rocketpy.simulation.{simulation_type}")

def get_api_logger() -> logging.Logger:
    """Get a logger for API operations"""
    return logging.getLogger("rocketpy.api")

# Initialize logging on module import
if not logger.handlers:
    setup_logging()