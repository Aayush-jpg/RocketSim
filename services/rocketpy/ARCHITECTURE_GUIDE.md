# RocketPy Simulation Service - Architecture Guide for AI Agents

## 📁 Project Structure Overview

This document provides a complete reference for AI agents working with the RocketPy simulation codebase. The monolithic `app.py` (6,398 lines) has been refactored into a modular architecture with clear separation of concerns.

```
/services/rocketpy/
├── app.py                          # Main FastAPI application (70 lines)
├── config/                         # Configuration and constants
│   ├── __init__.py                # Config module exports
│   ├── constants.py               # Physical constants and feature flags
│   ├── database.py                # Material/motor database loaders
│   └── logging.py                 # Centralized logging utilities
├── models/                        # Pydantic data models
│   ├── __init__.py               # Model exports
│   ├── components.py             # Rocket component models
│   ├── environment.py            # Environment and launch models
│   ├── monte_carlo.py            # Monte Carlo analysis models
│   ├── rocket.py                 # Complete rocket configuration
│   └── simulation.py             # Simulation requests/results
├── simulation/                   # Simulation engines
│   ├── __init__.py              # Simulation module exports
│   ├── engine.py                # Core simulation functions
│   ├── enhanced_engine.py       # Enhanced simulation with RocketPy
│   ├── specialized.py           # Batch and specialized simulations
│   ├── core/                    # Standard simulation classes
│   │   ├── __init__.py         # Core simulation exports
│   │   ├── environment.py      # SimulationEnvironment class
│   │   ├── flight.py           # SimulationFlight class
│   │   ├── monte_carlo.py      # ThreadSafeRocketPyMonteCarlo class
│   │   ├── motor.py            # SimulationMotor class
│   │   └── rocket.py           # SimulationRocket class
│   └── enhanced/               # Enhanced simulation classes
│       ├── __init__.py        # Enhanced simulation exports
│       ├── environment.py     # EnhancedSimulationEnvironment class
│       ├── flight.py          # EnhancedSimulationFlight class
│       ├── motor.py           # EnhancedSimulationMotor class
│       └── rocket.py          # EnhancedSimulationRocket class
├── api/                        # REST API layer
│   ├── __init__.py            # API module exports
│   ├── dependencies.py        # FastAPI dependencies
│   ├── endpoints.py           # All REST API endpoints
│   └── middleware.py          # CORS and middleware setup
├── utils/                     # Utility functions
│   ├── __init__.py           # Utils module exports
│   ├── atmospheric.py        # Atmospheric corrections
│   └── validation.py         # Input validation utilities
└── app_original_monolith.py  # Original monolithic app (backup)
```

## 🔧 Core Application File

### `app.py` (70 lines)
**Purpose**: Main FastAPI application orchestrator
**Key Functions**:
- `startup_event()`: Initialize application, log RocketPy availability
- `shutdown_event()`: Cleanup ThreadPoolExecutor on shutdown

**Dependencies**: 
```python
from config import logger, ROCKETPY_AVAILABLE, MOTOR_DATABASE
from api import register_routes, setup_middleware, executor
```

**When to modify**: Only when adding new global middleware, changing FastAPI configuration, or modifying startup/shutdown behavior.

---

## 🔧 Configuration Module (`config/`)

### `config/__init__.py`
**Purpose**: Central configuration exports
**Exports**: All constants, database objects, logging utilities

### `config/constants.py` (200+ lines)
**Purpose**: Physical constants and feature flags
**Key Constants**:
- `ROCKETPY_AVAILABLE`: Boolean flag for RocketPy library availability
- `PhysicalConstants`: Dataclass with physical constants (g, R, etc.)
- Feature flags: `GPU_AVAILABLE`, `NUMBA_AVAILABLE`, etc.

**When to use**: When checking feature availability or accessing physical constants in calculations.

### `config/database.py` (250+ lines)
**Purpose**: Material and motor database management
**Key Functions**:
- `load_material_database()`: Load materials from JSON with fallback
- `load_motor_database()`: Load motors from JSON with fallback
**Key Objects**:
- `MATERIAL_DATABASE`: Dict of material properties
- `MOTOR_DATABASE`: Dict of motor specifications

**When to use**: When accessing motor or material properties in simulations.

### `config/logging.py` (150+ lines)
**Purpose**: Centralized logging and debug utilities
**Key Functions**:
- `setup_logging()`: Configure logging based on environment
- `dbg_enter(func_name)`: Function entry debugging
- `dbg_exit(func_name, result)`: Function exit debugging
**Key Objects**:
- `logger`: Configured logger instance

**When to use**: For all logging throughout the application.

---

## 📊 Data Models Module (`models/`)

### `models/__init__.py`
**Purpose**: Exports all Pydantic models
**Exports**: All component, rocket, environment, and simulation models

### `models/components.py` (150+ lines)
**Purpose**: Individual rocket component models
**Key Classes**:
- `NoseComponentModel`: Nose cone specifications
- `BodyComponentModel`: Body tube specifications  
- `FinComponentModel`: Fin specifications
- `MotorModel`: Motor configuration

**When to use**: When defining or validating individual rocket components.

### `models/rocket.py` (200+ lines)
**Purpose**: Complete rocket configuration model
**Key Classes**:
- `RocketModel`: Main rocket configuration with components list
**Key Functions**:
- Component assembly validation
- Mass and geometry calculations

**When to use**: When handling complete rocket configurations in API endpoints or simulations.

### `models/environment.py` (250+ lines)
**Purpose**: Environmental conditions and launch parameters
**Key Classes**:
- `EnvironmentModel`: Atmospheric conditions, location, weather
- `LaunchParametersModel`: Launch rail, angles, timing

**When to use**: When configuring simulation environmental conditions.

### `models/simulation.py` (300+ lines)
**Purpose**: Simulation requests and results
**Key Classes**:
- `SimulationRequestModel`: Complete simulation request
- `SimulationResult`: Simulation output data
- `TrajectoryData`: Flight trajectory information

**When to use**: In API endpoints for request/response handling.

### `models/monte_carlo.py` (250+ lines)
**Purpose**: Monte Carlo analysis models
**Key Classes**:
- `MonteCarloRequest`: Monte Carlo simulation request
- `MonteCarloResult`: Statistical analysis results
- `ParameterDistribution`: Input parameter uncertainties

**When to use**: For Monte Carlo uncertainty analysis simulations.

---

## 🚀 Simulation Engine Module (`simulation/`)

### `simulation/__init__.py`
**Purpose**: Exports all simulation functions and classes
**Exports**: Core and enhanced simulation functions, all simulation classes

### `simulation/engine.py` (166 lines)
**Purpose**: Core simulation functions
**Key Functions**:
- `simulate_rocket_6dof(rocket_config, environment_config, launch_params)`: Main 6-DOF simulation
- `simulate_simplified_fallback(rocket_config)`: Physics-based fallback simulation
- `_run_simulation_sync()`: Synchronous simulation runner for threading

**When to use**: For standard rocket simulations with basic RocketPy features.

### `simulation/enhanced_engine.py` (105 lines)
**Purpose**: Enhanced simulation with full RocketPy capabilities
**Key Functions**:
- `simulate_rocket_6dof_enhanced(rocket_config, environment_config, launch_params, analysis_options)`: Enhanced simulation with advanced analysis
- `_run_enhanced_simulation_sync()`: Enhanced synchronous runner

**When to use**: For high-fidelity simulations requiring advanced RocketPy features.

### `simulation/specialized.py` (54 lines)
**Purpose**: Specialized simulation functions
**Key Functions**:
- `run_batch_simulations(configs)`: Process multiple rocket configurations in parallel

**When to use**: For batch processing and background simulation tasks.

---

## 🔧 Core Simulation Classes (`simulation/core/`)

### `simulation/core/environment.py` (782+ lines)
**Purpose**: Standard environment simulation
**Key Classes**:
- `SimulationEnvironment`: Basic atmospheric modeling
**Key Functions**:
- `_apply_wind_model()`: Apply wind conditions
- `_setup_weather_forecast()`: Weather integration

**When to use**: For standard environmental conditions in simulations.

### `simulation/core/motor.py` (299+ lines)
**Purpose**: Motor simulation implementation
**Key Classes**:
- `SimulationMotor`: Basic motor modeling
**Key Functions**:
- Motor thrust curve generation
- Propellant mass calculations

**When to use**: For standard motor modeling in rocket simulations.

### `simulation/core/rocket.py` (359+ lines)
**Purpose**: Rocket physics and configuration
**Key Classes**:
- `SimulationRocket`: Component-based rocket modeling
**Key Functions**:
- `_calculate_enhanced_center_of_mass()`: Mass distribution analysis
- Drag and stability calculations

**When to use**: For rocket configuration and physics calculations.

### `simulation/core/flight.py` (534+ lines)
**Purpose**: Flight simulation execution
**Key Classes**:
- `SimulationFlight`: 6-DOF flight simulation wrapper
**Key Functions**:
- `_extract_results()`: Extract simulation results
- Thread-safe execution management

**When to use**: For executing rocket flight simulations.

### `simulation/core/monte_carlo.py` (1,315+ lines)
**Purpose**: Monte Carlo uncertainty analysis
**Key Classes**:
- `ThreadSafeRocketPyMonteCarlo`: Process-isolated Monte Carlo simulation
**Key Functions**:
- `run_monte_carlo()`: Execute Monte Carlo analysis
- `_run_parallel_process_montecarlo()`: Parallel processing with LSODA isolation

**When to use**: For uncertainty quantification and statistical analysis.

---

## 🚀 Enhanced Simulation Classes (`simulation/enhanced/`)

### `simulation/enhanced/environment.py` (80+ lines)
**Purpose**: Advanced atmospheric modeling
**Key Classes**:
- `EnhancedSimulationEnvironment`: NRLMSISE-00 and custom atmosphere support
**Key Functions**:
- `_setup_wind_profile()`: Realistic wind profiles with boundary layer effects

**When to use**: For high-altitude simulations requiring advanced atmospheric modeling.

### `simulation/enhanced/motor.py` (300+ lines)
**Purpose**: Advanced motor modeling
**Key Classes**:
- `EnhancedSimulationMotor`: Dynamic propellant calculations
**Key Functions**:
- `_create_enhanced_liquid_motor()`: Liquid motor with propellant flow modeling

**When to use**: For detailed motor performance analysis.

### `simulation/enhanced/rocket.py` (525+ lines)
**Purpose**: Advanced rocket modeling
**Key Classes**:
- `EnhancedSimulationRocket`: Enhanced drag modeling and component analysis
**Key Functions**:
- `_calculate_enhanced_drag_curves()`: Power-on vs power-off drag analysis

**When to use**: For detailed aerodynamic analysis and performance optimization.

### `simulation/enhanced/flight.py` (800+ lines)
**Purpose**: Advanced flight simulation
**Key Classes**:
- `EnhancedSimulationFlight`: Full 6-DOF trajectory with attitude data
**Key Functions**:
- `_extract_enhanced_trajectory()`: Comprehensive trajectory analysis with quaternions

**When to use**: For detailed flight analysis and mission success probability.

---

## 🌐 API Layer Module (`api/`)

### `api/__init__.py`
**Purpose**: API module exports
**Exports**: Route registration, middleware setup, thread executor

### `api/endpoints.py` (403 lines)
**Purpose**: All REST API endpoints
**Key Functions**:
- `register_routes(app)`: Register all routes with FastAPI app
- **Health & Info Endpoints**:
  - `GET /health`: Service health check
  - `GET /motors`: Available motors with filtering
  - `GET /motors/detailed`: Detailed motor specifications
  - `GET /environment/atmospheric-models`: Available atmospheric models
- **Simulation Endpoints**:
  - `POST /simulate`: Standard simulation
  - `POST /simulate/hifi`: High-fidelity simulation
  - `POST /simulate/enhanced`: Enhanced simulation with advanced analysis
  - `POST /simulate/professional`: Maximum precision simulation
  - `POST /simulate/high-altitude`: Specialized high-altitude simulation (50-100km)
  - `POST /simulate/monte-carlo`: Monte Carlo uncertainty analysis
  - `POST /simulate/batch`: Batch simulation processing
- **Analysis Endpoints**:
  - `POST /analyze/stability`: Comprehensive stability analysis

**When to use**: When adding new API endpoints or modifying existing ones.

### `api/middleware.py` (18 lines)
**Purpose**: FastAPI middleware configuration
**Key Functions**:
- `setup_middleware(app)`: Configure CORS and other middleware

**When to use**: When adding authentication, rate limiting, or other middleware.

### `api/dependencies.py` (9 lines)
**Purpose**: FastAPI dependency injection
**Key Objects**:
- `executor`: ThreadPoolExecutor for CPU-intensive simulations

**When to use**: When adding shared dependencies for API endpoints.

---

## 🛠️ Utilities Module (`utils/`)

### `utils/__init__.py`
**Purpose**: Utility module exports
**Exports**: Atmospheric corrections and validation functions

### `utils/atmospheric.py` (300+ lines)
**Purpose**: Atmospheric data processing and corrections
**Key Functions**:
- `ensure_monotonic_pressure_profile(pressure_data, altitude_data)`: Fix atmospheric profile bijective errors for high-altitude simulations

**When to use**: For high-altitude simulations (50-100km) with NRLMSISE-00 atmospheric model.

### `utils/validation.py` (400+ lines)
**Purpose**: Input validation utilities
**Key Functions**:
- `validate_coordinates(lat, lon)`: Validate geographic coordinates
- `validate_motor_id(motor_id)`: Validate motor database ID
- `validate_body_tubes(rocket_config)`: Validate rocket configuration

**When to use**: In API endpoints for input validation before simulation.

---

## 🎯 Usage Patterns for AI Agents

### 🔍 When to Use Each Module:

1. **Adding New Simulation Features**:
   - Modify `simulation/enhanced/` classes for advanced physics
   - Update `models/simulation.py` for new result types
   - Add API endpoints in `api/endpoints.py`

2. **Adding New Rocket Components**:
   - Add component model to `models/components.py`
   - Update `models/rocket.py` for assembly logic
   - Modify simulation classes to handle new component

3. **Environmental/Atmospheric Changes**:
   - Modify `simulation/core/environment.py` or `simulation/enhanced/environment.py`
   - Update `utils/atmospheric.py` for corrections
   - Extend `models/environment.py` for new parameters

4. **Database Updates**:
   - Modify `config/database.py` for new data sources
   - Update fallback databases in the same file

5. **API Changes**:
   - Add endpoints in `api/endpoints.py`
   - Update middleware in `api/middleware.py`
   - Modify models in `models/` for request/response

### 🚨 Critical Dependencies:

- **RocketPy Library**: Optional dependency with graceful fallbacks
- **Thread Safety**: All simulations use ThreadPoolExecutor for non-blocking execution
- **Error Handling**: All functions have try/catch with fallbacks to simplified physics
- **Logging**: Use `from config import logger` for all logging operations

### 🔧 Import Patterns:

```python
# Configuration and constants
from config import logger, ROCKETPY_AVAILABLE, MOTOR_DATABASE

# Data models
from models.rocket import RocketModel
from models.simulation import SimulationResult

# Simulation functions
from simulation import simulate_rocket_6dof, simulate_rocket_6dof_enhanced

# API components
from api import register_routes, setup_middleware

# Utilities
from utils.atmospheric import ensure_monotonic_pressure_profile
from utils.validation import validate_body_tubes
```

This architecture provides clear separation of concerns, making it easy for AI agents to understand where to make changes and how different components interact.