# ROCKETv1 Version 2 - Technical Documentation

**Version**: 2.0.0  
**Last Updated**: December 2024  
**Architecture**: Microservices + Next.js + React Three Fiber + OpenAI Agents SDK  

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Core Components](#core-components)
6. [Backend Services](#backend-services)
7. [API Documentation](#api-documentation)
8. [Data Models](#data-models)
9. [State Management](#state-management)
10. [Real-Time Weather Integration](#real-time-weather-integration)
11. [Agent System](#agent-system)
12. [3D Visualization](#3d-visualization)
13. [Simulation Engine](#simulation-engine)
14. [Deployment](#deployment)
15. [Development Workflow](#development-workflow)
16. [Performance Optimization](#performance-optimization)
17. [Security](#security)
18. [Testing](#testing)
19. [Troubleshooting](#troubleshooting)

---

## 🎯 System Overview

ROCKETv1 Version 2 is a comprehensive rocket design and simulation platform that combines:

- **Interactive 3D Design**: Real-time rocket visualization using React Three Fiber
- **AI-Powered Assistant**: OpenAI Agents SDK for intelligent design guidance
- **Professional Simulation**: RocketPy integration for high-fidelity physics
- **Real-World Data**: Live weather integration for accurate atmospheric conditions
- **Educational Focus**: Designed for STEM education and rocket enthusiasts

### Key Features

- 🚀 **Interactive Rocket Designer**: Drag-and-drop 3D rocket assembly
- 🤖 **AI Assistant**: Natural language rocket design and optimization
- 📊 **Professional Analysis**: Stability, performance, and Monte Carlo analysis
- 🌍 **Real Weather Data**: Live atmospheric conditions from multiple APIs
- 📈 **Advanced Simulations**: 6-DOF flight dynamics with RocketPy
- 🎓 **Educational Tools**: Built for classroom and self-learning environments

---

## 🏗️ Architecture

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Agent Service │    │  RocketPy API   │
│   (Next.js)     │◄──►│   (Python)      │◄──►│   (Python)      │
│                 │    │                 │    │                 │
│ • React Three   │    │ • OpenAI Agents │    │ • Physics Sim   │
│ • Zustand Store │    │ • Tool Routing  │    │ • 6-DOF Flight  │
│ • Weather API   │    │ • Multi-Agent   │    │ • Monte Carlo   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  External APIs  │
                    │                 │
                    │ • OpenWeatherMap│
                    │ • WeatherAPI    │
                    │ • NOAA GFS      │
                    │ • USGS Elevation│
                    └─────────────────┘
```

### Service Communication

```
Frontend ──HTTP──► Next.js API Routes ──HTTP──► Python Services
    │                      │                         │
    │                      │                         ├─► AgentPy (Port 8002)
    │                      │                         └─► RocketPy (Port 8000)
    │                      │
    └──WebSocket/Events────┘ (Real-time updates)
```

### Data Flow

```
User Input → AI Agent → Tool Selection → Backend API → Simulation → Results → UI Update
     │                                                                          │
     └─────────────────── Real-time 3D Visualization ◄─────────────────────────┘
```

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **3D Graphics**: React Three Fiber + Three.js
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **State Management**: Zustand
- **Type Safety**: TypeScript

### Backend Services
- **Agent Service**: Python + FastAPI + OpenAI Agents SDK
- **Physics Service**: Python + FastAPI + RocketPy
- **Weather APIs**: Multiple providers (OpenWeatherMap, NOAA, etc.)

### Infrastructure
- **Containerization**: Docker + Docker Compose
- **Development**: Hot reload, TypeScript compilation
- **Deployment**: Vercel (Frontend) + Cloud Run/Railway (Backend)

### External APIs
- **OpenAI**: GPT-4 for AI agent reasoning
- **OpenWeatherMap**: Primary weather data source
- **WeatherAPI**: Backup weather provider
- **NOAA GFS**: Advanced atmospheric data
- **USGS**: Elevation data for US locations

---

## 📁 Project Structure

```
ROCKETv1/
├── 📁 app/                          # Next.js App Router
│   ├── 📁 api/                      # API Routes
│   │   ├── 📁 agent/                # AI Agent proxy
│   │   ├── 📁 analyze/              # Analysis endpoints
│   │   ├── 📁 motors/               # Motor data API
│   │   ├── 📁 optimize/             # Design optimization
│   │   ├── 📁 simulate/             # Simulation endpoints
│   │   └── 📁 weather/              # Weather data API
│   ├── globals.css                  # Global styles
│   ├── layout.tsx                   # Root layout
│   └── page.tsx                     # Main application page
├── 📁 components/                   # React Components
│   ├── 📁 panels/                   # Main UI panels
│   │   ├── 📁 pro-mode/             # Advanced analysis tabs
│   │   ├── IntegratedChatPanel.tsx  # AI chat interface
│   │   ├── LeftPanel.tsx            # Rocket parts library
│   │   ├── MiddlePanel.tsx          # 3D visualization
│   │   └── RightPanel.tsx           # Analysis & chat
│   ├── 📁 ui/                       # Reusable UI components
│   ├── ChatPanel.tsx                # Basic chat component
│   ├── LocationPermissionDialog.tsx # Weather permission UI
│   └── WeatherStatus.tsx            # Weather display
├── 📁 lib/                          # Utility libraries
│   ├── 📁 ai/                       # AI-related utilities
│   │   └── actions.ts               # Action dispatcher
│   ├── 📁 services/                 # External services
│   │   └── weather.ts               # Weather service
│   └── store.ts                     # Zustand state store
├── 📁 services/                     # Backend microservices
│   ├── 📁 agentpy/                  # AI Agent service
│   │   ├── 📁 physics/              # Physics calculations
│   │   ├── 📁 rocket_agents/        # Specialized agents
│   │   ├── 📁 tools/                # Agent tools
│   │   ├── 📁 utils/                # Utility functions
│   │   ├── app.py                   # FastAPI application
│   │   ├── Dockerfile               # Container config
│   │   └── requirements.txt         # Python dependencies
│   └── 📁 rocketpy/                 # Physics simulation service
│       ├── app.py                   # RocketPy FastAPI app
│       ├── Dockerfile               # Container config
│       └── requirements.txt         # Python dependencies
├── 📁 types/                        # TypeScript definitions
│   └── rocket.d.ts                  # Core type definitions
├── docker-compose.yml               # Multi-service orchestration
├── next.config.js                   # Next.js configuration
├── package.json                     # Node.js dependencies
├── tailwind.config.js               # Tailwind CSS config
└── tsconfig.json                    # TypeScript config
```

---

## 🧩 Core Components

### 1. Main Application (`app/page.tsx`)
**Purpose**: Root application component that orchestrates the entire UI
**Key Features**:
- Three-panel layout (Parts Library | 3D Viewer | Analysis/Chat)
- Responsive design with collapsible panels
- Global state management integration
- Event handling for cross-component communication

**Dependencies**:
- `LeftPanel`: Rocket parts library and controls
- `MiddlePanel`: 3D visualization and simulation display
- `RightPanel`: AI chat and analysis tools

### 2. Left Panel (`components/panels/LeftPanel.tsx`)
**Purpose**: Rocket parts library and design controls
**Key Features**:
- Drag-and-drop part selection
- Motor configuration interface
- Rocket properties editor (name, drag coefficient, units)
- Part management (add/remove/modify)

**State Integration**:
- Reads from: `useRocket` store for current rocket configuration
- Updates: Rocket parts, motor selection, rocket properties

### 3. Middle Panel (`components/panels/MiddlePanel.tsx`)
**Purpose**: 3D rocket visualization and simulation display
**Key Features**:
- Real-time 3D rocket rendering using React Three Fiber
- Interactive camera controls (orbit, zoom, pan)
- Simulation visualization (trajectory, flight path)
- Performance metrics overlay
- Animation system for flight simulation playback

**3D Components**:
- `RocketMesh`: Main rocket geometry renderer
- `TrajectoryLine`: Flight path visualization
- `EnvironmentGrid`: Reference grid and coordinate system
- `CameraController`: Interactive camera management

### 4. Right Panel (`components/panels/RightPanel.tsx`)
**Purpose**: AI assistant and advanced analysis interface
**Key Features**:
- Dual mode: Chat Mode vs Pro Mode
- Integrated metrics display with expandable details
- Tab-based navigation for different analysis types
- Real-time performance indicators

**Modes**:
- **Chat Mode**: AI assistant for natural language interaction
- **Pro Mode**: Advanced analysis tabs (Simulation, Stability, Monte Carlo, etc.)

### 5. Integrated Chat Panel (`components/panels/IntegratedChatPanel.tsx`)
**Purpose**: AI-powered chat interface with inline metrics
**Key Features**:
- Natural language rocket design commands
- Inline performance metrics display
- Real-time simulation feedback
- Context-aware suggestions

### 6. Pro Mode Tabs (`components/panels/pro-mode/`)

#### SimulationTab.tsx
- **Purpose**: Advanced simulation controls and results
- **Features**: Multiple fidelity levels, real-time progress, detailed results

#### StabilityTab.tsx
- **Purpose**: Comprehensive stability analysis
- **Features**: Static/dynamic stability, center of pressure/mass, recommendations

#### MonteCarloTab.tsx
- **Purpose**: Statistical analysis with parameter variations
- **Features**: 50-500 iterations, landing dispersion, sensitivity analysis

#### MotorTab.tsx
- **Purpose**: Motor performance analysis
- **Features**: Thrust curves, efficiency ratings, motor recommendations

#### TrajectoryTab.tsx
- **Purpose**: Flight path analysis and visualization
- **Features**: 3D trajectory, phase breakdown, performance metrics

#### RecoveryTab.tsx
- **Purpose**: Parachute and recovery system analysis
- **Features**: Terminal velocity, descent time, drift calculations

---

## 🔧 Backend Services

### 1. Agent Service (`services/agentpy/`)

#### Core Application (`app.py`)
**Purpose**: OpenAI Agents SDK integration for intelligent rocket design
**Key Components**:

```python
# Main agent configuration
agent = Agent(
    name="Rocket‑Cursor AI",
    instructions="Expert assistant for model‑rocket design...",
    tools=[add_part, update_part, run_simulation, ...],
    model="gpt-4o-mini",
    temperature=0.6,
)

# Multi-agent system
agents = {
    "router": router_agent,      # Routes requests to specialized agents
    "design": design_agent,      # Handles rocket design tasks
    "simulation": sim_agent,     # Manages simulation requests
    "metrics": metrics_agent,    # Analyzes performance data
    "master": master_agent       # Coordinates complex workflows
}
```

**API Endpoints**:
- `POST /reason`: Main reasoning endpoint for chat interactions
- `POST /design`: Specialized design optimization
- `POST /analyze`: Performance analysis requests

#### Agent Tools (`tools/`)
**Purpose**: Specialized functions that agents can call
**Available Tools**:
- `add_part()`: Add rocket components
- `update_part()`: Modify existing parts
- `run_simulation()`: Execute simulations
- `analyze_stability()`: Stability analysis
- `optimize_design()`: Design optimization
- `run_monte_carlo()`: Statistical analysis

#### Specialized Agents (`rocket_agents/`)
- **DesignAgent**: Rocket component design and optimization
- **SimulationAgent**: Simulation management and analysis
- **MetricsAgent**: Performance evaluation and recommendations
- **RouterAgent**: Request routing and workflow coordination

### 2. RocketPy Service (`services/rocketpy/`)

#### Core Application (`app.py`)
**Purpose**: Professional-grade rocket physics simulation
**Key Features**:
- 6-DOF flight dynamics simulation
- Advanced atmospheric modeling
- Monte Carlo analysis with parameter variations
- Professional motor modeling
- Comprehensive stability analysis

**Enhanced Simulation Classes**:
```python
class EnhancedSimulationEnvironment:
    # Advanced atmospheric modeling with GFS data
    # Custom wind profiles and atmospheric layers
    
class EnhancedSimulationMotor:
    # Detailed motor modeling with grain geometry
    # Thrust curve analysis and performance metrics
    
class EnhancedSimulationRocket:
    # Professional rocket modeling
    # Component-wise mass and aerodynamic properties
    
class EnhancedSimulationFlight:
    # High-precision 6-DOF simulation
    # Advanced numerical integration (rtol=1e-9)
```

**API Endpoints**:
- `POST /simulate`: Standard simulation
- `POST /simulate/enhanced`: Enhanced 6-DOF simulation
- `POST /simulate/professional`: Maximum fidelity simulation
- `POST /simulate/monte-carlo`: Statistical analysis
- `POST /analyze/stability`: Comprehensive stability analysis
- `POST /analyze/performance`: Performance metrics
- `POST /optimize/design`: Design optimization
- `GET /motors`: Motor database access
- `GET /motors/detailed`: Detailed motor specifications

---

## 📡 API Documentation

### Frontend API Routes (`app/api/`)

#### Agent Proxy (`/api/agent`)
```typescript
POST /api/agent
Body: {
  history: ChatMessage[],
  rocket: Rocket
}
Response: {
  final_output: string,
  actions: Action[]
}
```

#### Simulation (`/api/simulate`)
```typescript
POST /api/simulate
Body: {
  rocket: Rocket,
  environment?: EnvironmentConfig,
  launchParameters?: LaunchParameters,
  fidelity: "standard" | "enhanced" | "professional"
}
Response: SimulationResult
```

#### Analysis Endpoints
```typescript
POST /api/analyze/stability
POST /api/analyze/performance
POST /api/optimize/design
POST /api/motors/detailed
GET /api/weather/gfs
```

### Backend Service APIs

#### AgentPy Service (Port 8002)
```python
POST /reason
POST /design
POST /analyze
```

#### RocketPy Service (Port 8000)
```python
POST /simulate
POST /simulate/enhanced
POST /simulate/professional
POST /simulate/monte-carlo
POST /analyze/stability
POST /analyze/performance
POST /optimize/design
GET /motors
GET /motors/detailed
```

---

## 📊 Data Models

### Core Types (`types/rocket.d.ts`)

#### Rocket Components
```typescript
interface PartBase {
  id: string;
  type: string;
  color: string;
}

interface Nose extends PartBase {
  type: "nose";
  shape: "ogive" | "conical";
  length: number;
  baseØ: number;
}

interface Body extends PartBase {
  type: "body";
  Ø: number;
  length: number;
}

interface Fin extends PartBase {
  type: "fin";
  root: number;
  span: number;
  sweep: number;
}
```

#### Rocket Configuration
```typescript
interface Rocket {
  id: string;
  name: string;
  parts: Part[];
  motorId: string;
  Cd: number;
  units: "metric" | "imperial";
}
```

#### Simulation Results
```typescript
interface SimulationResult {
  maxAltitude?: number;
  maxVelocity?: number;
  maxAcceleration?: number;
  apogeeTime?: number;
  stabilityMargin?: number;
  thrustCurve?: [number, number][];
  trajectory?: TrajectoryData;
  flightEvents?: FlightEvent[];
  // Analysis results
  stabilityAnalysis?: StabilityAnalysis;
  performanceAnalysis?: any;
  motorAnalysis?: MotorAnalysis;
}
```

#### Advanced Analysis Types
```typescript
interface MonteCarloResult {
  nominal: SimulationResult;
  statistics: { [key: string]: MonteCarloStatistics };
  iterations: Array<{[key: string]: number}>;
  landingDispersion?: LandingDispersion;
}

interface StabilityAnalysis {
  staticMargin: number;
  centerOfPressure?: number;
  centerOfMass?: number;
  stabilityRating?: string;
  recommendations?: string[];
}
```

---

## 🗄️ State Management

### Zustand Store (`lib/store.ts`)

#### Core State Structure
```typescript
interface RocketState {
  // Core rocket data
  rocket: Rocket;
  
  // Simulation results
  sim: SimulationResult | null;
  
  // Advanced analysis results
  stabilityAnalysis: StabilityAnalysis | null;
  monteCarloResult: MonteCarloResult | null;
  motorAnalysis: MotorAnalysis | null;
  recoveryPrediction: RecoveryPrediction | null;
  
  // UI state
  isSimulating: boolean;
  simulationProgress: number;
  lastSimulationType: string;
  
  // Actions
  updateRocket: (fn: (rocket: Rocket) => Rocket) => void;
  setSim: (sim: SimulationResult | null) => void;
  setStabilityAnalysis: (analysis: StabilityAnalysis | null) => void;
  setMonteCarloResult: (result: MonteCarloResult | null) => void;
  setMotorAnalysis: (analysis: MotorAnalysis | null) => void;
  setRecoveryPrediction: (prediction: RecoveryPrediction | null) => void;
}
```

#### State Updates
- **Immutable Updates**: All state changes use immutable patterns
- **Selective Updates**: Components subscribe to specific state slices
- **Event-Driven**: Actions trigger UI updates via custom events

### Global State Management
```typescript
// Global environment conditions
window.environmentConditions = {
  latitude: number,
  longitude: number,
  elevation: number,
  windSpeed: number,
  windDirection: number,
  atmosphericModel: string,
  // Real weather data
  temperature?: number,
  pressure?: number,
  humidity?: number
};
```

---

## 🌍 Real-Time Weather Integration

### Weather Service (`lib/services/weather.ts`)

#### Core Features
- **Multi-Provider Support**: OpenWeatherMap, WeatherAPI, NOAA GFS
- **Intelligent Fallbacks**: Automatic failover between data sources
- **Global Coverage**: Worldwide weather data with regional accuracy
- **Caching Strategy**: 30-minute weather cache, 5-minute location cache

#### Data Sources Priority
1. **Primary**: Open-Meteo (Free GFS data)
2. **Enhanced**: OpenWeatherMap (Professional atmospheric profiles)
3. **Backup**: WeatherAPI (Commercial with historical data)
4. **Fallback**: Standard atmosphere with location adjustments

#### Weather Data Types
```typescript
interface WeatherData {
  temperature: number;    // °C
  pressure: number;       // hPa
  humidity: number;       // %
  windSpeed: number;      // m/s
  windDirection: number;  // degrees
  visibility: number;     // km
  cloudCover: number;     // %
  dewPoint: number;       // °C
  timestamp: string;
  source: string;
}

interface AtmosphericProfile {
  altitude: number[];     // meters
  temperature: number[];  // K
  pressure: number[];     // Pa
  density: number[];      // kg/m³
  windU: number[];        // m/s (east component)
  windV: number[];        // m/s (north component)
}
```

#### Location Services
- **Browser Geolocation**: High-accuracy GPS positioning
- **Elevation APIs**: USGS (US) and Open-Elevation (global)
- **Reverse Geocoding**: City/country identification
- **Timezone Detection**: Accurate local time calculation

### Weather API Integration (`app/api/weather/gfs/route.ts`)

#### GFS Data Processing
```typescript
// Multi-source weather data fetching
async function fetchWeatherData(lat: number, lon: number) {
  try {
    // 1. Try NOAA GFS data
    const gfsData = await fetchNOAAGFS(lat, lon);
    if (gfsData) return gfsData;
    
    // 2. Try Open-Meteo
    const openMeteoData = await fetchOpenMeteoGFS(lat, lon);
    if (openMeteoData) return openMeteoData;
    
    // 3. Try WeatherAPI
    const weatherApiData = await fetchWeatherAPIData(lat, lon);
    if (weatherApiData) return weatherApiData;
    
    // 4. Fallback to estimated profile
    return generateEstimatedProfile(lat, lon);
  } catch (error) {
    return generateStandardAtmosphere(lat, lon);
  }
}
```

#### Atmospheric Profile Generation
- **Multi-Level Data**: 10+ pressure levels from surface to 100 hPa
- **Wind Components**: U/V wind vectors at each level
- **Temperature Profiles**: Realistic lapse rates and stratospheric data
- **Density Calculations**: Accurate air density for drag calculations

---

## 🤖 Agent System

### OpenAI Agents SDK Integration

#### Multi-Agent Architecture
```python
# Router Agent - Coordinates requests
router_agent = Agent(
    name="Router Agent",
    instructions="Route requests to appropriate specialized agents",
    tools=[route_to_design, route_to_simulation, route_to_analysis]
)

# Design Agent - Rocket design and optimization
design_agent = Agent(
    name="Design Agent", 
    instructions="Expert in rocket component design and optimization",
    tools=[add_part, update_part, optimize_design, validate_design]
)

# Simulation Agent - Physics simulation management
simulation_agent = Agent(
    name="Simulation Agent",
    instructions="Manages rocket simulations and analysis",
    tools=[run_simulation, run_monte_carlo, analyze_trajectory]
)
```

#### Agent Tools System
```python
@function_tool
def add_part(type: str, props: dict) -> str:
    """Insert a new rocket component."""
    return json.dumps({"action": "add_part", "type": type, "props": props})

@function_tool
def run_professional_simulation(fidelity: str, environment: dict) -> str:
    """Run high-fidelity rocket simulation."""
    return json.dumps({
        "action": "run_professional_simulation",
        "fidelity": fidelity,
        "environment": environment
    })

@function_tool
def analyze_comprehensive_stability(wind_conditions: dict) -> str:
    """Perform comprehensive stability analysis."""
    return json.dumps({
        "action": "analyze_comprehensive_stability",
        "wind_conditions": wind_conditions
    })
```

#### Direct Action Handlers (`services/agentpy/utils/direct_actions.py`)
**Purpose**: Handle common rocket modifications with intelligent defaults
**Features**:
- Smart parameter interpretation (multipliers vs absolute values)
- Context-aware recommendations
- Detailed response generation

```python
def handle_body_extension(rocket: dict, value: float = None) -> dict:
    """Handle body extension with sensible defaults."""
    # Intelligent value interpretation
    if value is None:
        new_length = current_length * 1.3  # 30% increase
    elif value < 5:
        new_length = current_length * value  # Multiplier
    else:
        new_length = current_length + value  # Addition
    
    return {
        "message": f"Extended body from {current_length}cm to {new_length}cm",
        "actions": [{"action": "update_part", "id": part_id, "props": {"length": new_length}}]
    }
```

### Action Dispatcher (`lib/ai/actions.ts`)

#### Action Processing Pipeline
```typescript
export function dispatchActions(actions: any[]) {
  actions.forEach((action) => {
    switch (action.action) {
      case "add_part":
        updateRocket((r) => {
          r.parts.push({
            id: crypto.randomUUID(),
            type: action.type,
            ...action.props
          });
          return r;
        });
        break;
        
      case "run_professional_simulation":
        handleProfessionalSimulation(action);
        break;
        
      case "analyze_comprehensive_stability":
        handleStabilityAnalysis(action);
        break;
        
      // ... other actions
    }
  });
}
```

#### Advanced Action Handlers
- **Professional Simulation**: Multi-fidelity simulation execution
- **Stability Analysis**: Comprehensive stability evaluation
- **Performance Analysis**: Detailed performance metrics
- **Design Optimization**: Automated design improvements
- **Monte Carlo Analysis**: Statistical simulation analysis

---

## 🎨 3D Visualization

### React Three Fiber Integration (`components/panels/MiddlePanel.tsx`)

#### 3D Scene Architecture
```typescript
<Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
  <Suspense fallback={<LoadingSpinner />}>
    {/* Lighting setup */}
    <ambientLight intensity={0.4} />
    <directionalLight position={[10, 10, 5]} intensity={0.8} />
    
    {/* Main rocket visualization */}
    <RocketVisualization rocket={rocket} />
    
    {/* Simulation trajectory */}
    {sim?.trajectory && (
      <TrajectoryVisualization trajectory={sim.trajectory} />
    )}
    
    {/* Interactive controls */}
    <OrbitControls enablePan enableZoom enableRotate />
    
    {/* Environment elements */}
    <EnvironmentGrid />
    <GroundPlane />
  </Suspense>
</Canvas>
```

#### Rocket Mesh Generation
```typescript
function RocketVisualization({ rocket }: { rocket: Rocket }) {
  const meshes = useMemo(() => {
    return rocket.parts.map((part) => {
      switch (part.type) {
        case 'nose':
          return <NoseCone key={part.id} part={part as Nose} />;
        case 'body':
          return <BodyTube key={part.id} part={part as Body} />;
        case 'fin':
          return <FinSet key={part.id} part={part as Fin} />;
        default:
          return null;
      }
    });
  }, [rocket.parts]);
  
  return <group>{meshes}</group>;
}
```

#### Component Geometries
- **Nose Cone**: Parametric ogive/conical geometry generation
- **Body Tube**: Cylindrical geometry with accurate dimensions
- **Fin Set**: Trapezoidal fin geometry with sweep angle
- **Motor**: Visual representation with thrust vectoring

#### Trajectory Visualization
```typescript
function TrajectoryVisualization({ trajectory }: { trajectory: TrajectoryData }) {
  const points = useMemo(() => {
    return trajectory.position.map(([x, y, z]) => new Vector3(x, z, y));
  }, [trajectory]);
  
  return (
    <Line
      points={points}
      color="orange"
      lineWidth={3}
      dashed={false}
    />
  );
}
```

#### Animation System
- **Flight Playback**: Animated rocket movement along trajectory
- **Real-time Updates**: Smooth transitions during simulation
- **Camera Tracking**: Automatic camera following during flight
- **Performance Optimization**: LOD system for complex geometries

---

## 🔬 Simulation Engine

### RocketPy Integration

#### Enhanced Simulation Classes

##### EnhancedSimulationEnvironment
```python
class EnhancedSimulationEnvironment:
    def __init__(self, latitude=0, longitude=0, elevation=0):
        # Advanced atmospheric modeling
        self.environment = Environment(
            latitude=latitude,
            longitude=longitude,
            elevation=elevation
        )
        
        # Real weather data integration
        if weather_data:
            self.set_atmospheric_model_from_weather(weather_data)
        
        # Custom wind profiles
        self.set_wind_profile(wind_data)
```

##### EnhancedSimulationMotor
```python
class EnhancedSimulationMotor:
    def __init__(self, motor_config):
        # Detailed motor modeling
        self.motor = SolidMotor(
            dry_mass=motor_config['dry_mass'],
            dry_inertia=motor_config['dry_inertia'],
            nozzle_radius=motor_config['nozzle_radius'],
            grain_number=motor_config['grain_number'],
            grain_density=motor_config['grain_density'],
            grain_outer_radius=motor_config['grain_outer_radius'],
            grain_initial_inner_radius=motor_config['grain_initial_inner_radius'],
            grain_initial_height=motor_config['grain_initial_height'],
            thrust_source=motor_config['thrust_curve']
        )
        
        # Performance analysis
        self.calculate_performance_metrics()
```

##### EnhancedSimulationFlight
```python
class EnhancedSimulationFlight:
    def __init__(self, rocket, environment, rail_length=5.0):
        # High-precision simulation
        self.flight = Flight(
            rocket=rocket,
            environment=environment,
            rail_length=rail_length,
            inclination=85,
            heading=0,
            rtol=1e-9,  # High precision
            atol=1e-13
        )
        
        # Advanced analysis
        self.add_advanced_sensors()
        self.calculate_stability_margins()
```

#### Simulation Fidelity Levels

##### Standard Simulation
- **Purpose**: Quick design validation
- **Features**: Basic trajectory calculation, simplified aerodynamics
- **Performance**: ~1-2 seconds execution time
- **Accuracy**: ±10% for typical model rockets

##### Enhanced Simulation
- **Purpose**: Detailed analysis with real atmospheric data
- **Features**: 6-DOF dynamics, real weather integration, advanced aerodynamics
- **Performance**: ~5-10 seconds execution time
- **Accuracy**: ±5% for well-characterized rockets

##### Professional Simulation
- **Purpose**: Maximum fidelity for critical applications
- **Features**: High-precision integration, detailed motor modeling, atmospheric turbulence
- **Performance**: ~30-60 seconds execution time
- **Accuracy**: ±2% for professional applications

#### Monte Carlo Analysis
```python
def run_monte_carlo_simulation(rocket, environment, iterations=100):
    """Statistical analysis with parameter variations."""
    
    # Parameter variation ranges
    variations = {
        'wind_speed': (0.8, 1.2),      # ±20% wind variation
        'drag_coefficient': (0.9, 1.1), # ±10% drag variation
        'motor_thrust': (0.95, 1.05),   # ±5% thrust variation
        'launch_angle': (-2, 2),        # ±2° launch angle variation
        'mass': (0.98, 1.02)           # ±2% mass variation
    }
    
    results = []
    for i in range(iterations):
        # Apply random variations
        varied_params = apply_variations(variations)
        
        # Run simulation with variations
        flight = run_simulation_with_params(rocket, environment, varied_params)
        results.append(extract_metrics(flight))
    
    # Statistical analysis
    return calculate_statistics(results)
```

---

## 🚀 Deployment

### Docker Configuration

#### Multi-Service Architecture (`docker-compose.yml`)
```yaml
version: '3.8'
services:
  web:
    build: ./
    ports:
      - "3000:3000"
    environment:
      - AGENT_URL=http://agentpy:8002
      - ROCKETPY_URL=http://rocketpy:8000
    depends_on:
      - agentpy
      - rocketpy
    env_file:
      - .env

  agentpy:
    build: ./services/agentpy
    ports:
      - "8002:8002"
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    env_file:
      - .env

  rocketpy:
    build: ./services/rocketpy
    ports:
      - "8000:8000"
    env_file:
      - .env
```

#### Frontend Dockerfile
```dockerfile
FROM node:18-alpine AS base
WORKDIR /app

# Dependencies
COPY package*.json ./
RUN npm ci --only=production

# Build
COPY . .
RUN npm run build

# Production
FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./.next/static
COPY --from=base /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
```

#### Backend Service Dockerfiles
```dockerfile
# AgentPy Service
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8002
CMD ["python", "app.py"]

# RocketPy Service  
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "app.py"]
```

### Production Deployment

#### Vercel (Frontend)
```bash
# Deploy to Vercel
vercel --prod

# Environment variables
AGENT_URL=https://your-agent-service.railway.app
NEXT_PUBLIC_OPENWEATHER_API_KEY=your-api-key
```

#### Railway/Cloud Run (Backend)
```bash
# Deploy AgentPy service
railway deploy --service agentpy

# Deploy RocketPy service  
railway deploy --service rocketpy
```

### Environment Configuration

#### Production Environment Variables
```bash
# Core services
OPENAI_API_KEY=sk-your-openai-key
AGENT_URL=https://agentpy-service.railway.app
ROCKETPY_URL=https://rocketpy-service.railway.app

# Weather APIs
NEXT_PUBLIC_OPENWEATHER_API_KEY=your-openweather-key
WEATHERAPI_KEY=your-weatherapi-key
NEXT_PUBLIC_NOAA_API_KEY=your-noaa-key

# Optional services
NEXT_PUBLIC_TIMEZONE_API_KEY=your-timezone-key
```

---

## 💻 Development Workflow

### Local Development Setup

#### Prerequisites
```bash
# Required software
- Node.js 18+
- Python 3.11+
- Docker & Docker Compose
- Git
```

#### Quick Start
```bash
# Clone repository
git clone https://github.com/your-org/ROCKETv1.git
cd ROCKETv1

# Install frontend dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your API keys

# Start all services
docker-compose up -d

# Start frontend development server
npm run dev
```

#### Development Commands
```bash
# Frontend development
npm run dev          # Start Next.js dev server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking

# Backend services
docker-compose up agentpy    # Start agent service only
docker-compose up rocketpy   # Start physics service only
docker-compose logs -f       # View service logs

# Full stack development
docker-compose up -d         # Start all backend services
npm run dev                  # Start frontend with hot reload
```

### Code Organization

#### Frontend Structure
```typescript
// Component organization
components/
├── panels/           # Main UI panels
├── ui/              # Reusable components  
├── forms/           # Form components
└── visualization/   # 3D and chart components

// Utility organization
lib/
├── ai/              # AI-related utilities
├── services/        # External service integrations
├── utils/           # General utilities
└── hooks/           # Custom React hooks
```

#### Backend Structure
```python
# AgentPy service organization
services/agentpy/
├── rocket_agents/   # Specialized AI agents
├── tools/          # Agent tool functions
├── utils/          # Utility functions
└── physics/        # Physics calculations

# RocketPy service organization  
services/rocketpy/
├── simulation/     # Simulation classes
├── analysis/       # Analysis functions
├── motors/         # Motor database
└── utils/          # Utility functions
```

### Testing Strategy

#### Frontend Testing
```bash
# Unit tests
npm run test

# Component testing
npm run test:components

# E2E testing
npm run test:e2e
```

#### Backend Testing
```bash
# Python unit tests
cd services/agentpy
python -m pytest tests/

cd services/rocketpy  
python -m pytest tests/
```

---

## ⚡ Performance Optimization

### Frontend Optimization

#### React Optimization
```typescript
// Component memoization
const RocketVisualization = memo(({ rocket }) => {
  const meshes = useMemo(() => generateMeshes(rocket), [rocket]);
  return <group>{meshes}</group>;
});

// State optimization
const useRocketParts = () => {
  return useRocket(state => state.rocket.parts, shallow);
};
```

#### 3D Performance
```typescript
// LOD system for complex geometries
function AdaptiveRocketMesh({ rocket, distance }) {
  const lod = distance > 50 ? 'low' : distance > 20 ? 'medium' : 'high';
  return <RocketMesh rocket={rocket} levelOfDetail={lod} />;
}

// Instanced rendering for repeated elements
function FinSet({ fins }) {
  return (
    <instancedMesh args={[geometry, material, fins.length]}>
      {fins.map((fin, i) => (
        <Instance key={fin.id} position={fin.position} />
      ))}
    </instancedMesh>
  );
}
```

#### Bundle Optimization
```javascript
// next.config.js
module.exports = {
  experimental: {
    optimizeCss: true,
    optimizeImages: true,
  },
  webpack: (config) => {
    config.optimization.splitChunks.chunks = 'all';
    return config;
  }
};
```

### Backend Optimization

#### Simulation Performance
```python
# Vectorized calculations
import numpy as np

def calculate_trajectory_vectorized(time_points, initial_conditions):
    """Vectorized trajectory calculation for performance."""
    return np.vectorize(trajectory_function)(time_points, initial_conditions)

# Caching expensive calculations
from functools import lru_cache

@lru_cache(maxsize=128)
def calculate_aerodynamic_coefficients(mach_number, angle_of_attack):
    """Cache aerodynamic calculations."""
    return expensive_aero_calculation(mach_number, angle_of_attack)
```

#### API Optimization
```python
# Async request handling
import asyncio
from fastapi import BackgroundTasks

@app.post("/simulate/async")
async def run_simulation_async(rocket_data: dict, background_tasks: BackgroundTasks):
    """Run simulation in background for long-running tasks."""
    task_id = generate_task_id()
    background_tasks.add_task(run_simulation_background, rocket_data, task_id)
    return {"task_id": task_id, "status": "started"}
```

### Caching Strategy

#### Frontend Caching
```typescript
// Weather data caching
const weatherCache = new Map<string, WeatherData>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

function getCachedWeather(location: string): WeatherData | null {
  const cached = weatherCache.get(location);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached;
  }
  return null;
}
```

#### Backend Caching
```python
# Redis caching for simulation results
import redis
import json

redis_client = redis.Redis(host='localhost', port=6379, db=0)

def cache_simulation_result(rocket_hash: str, result: dict):
    """Cache simulation results for identical rockets."""
    redis_client.setex(
        f"sim:{rocket_hash}", 
        3600,  # 1 hour TTL
        json.dumps(result)
    )
```

---

## 🔒 Security

### API Security

#### Authentication & Authorization
```typescript
// API route protection
import { verifyApiKey } from '@/lib/auth';

export async function POST(request: Request) {
  const apiKey = request.headers.get('x-api-key');
  if (!verifyApiKey(apiKey)) {
    return new Response('Unauthorized', { status: 401 });
  }
  // ... handle request
}
```

#### Rate Limiting
```python
# FastAPI rate limiting
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/simulate")
@limiter.limit("10/minute")
async def simulate_rocket(request: Request, rocket_data: dict):
    """Rate-limited simulation endpoint."""
    return await run_simulation(rocket_data)
```

### Data Protection

#### Environment Variables
```bash
# Secure environment variable handling
# Never commit .env files
# Use different keys for development/production
# Rotate API keys regularly

# Development
OPENAI_API_KEY=sk-dev-key-here

# Production  
OPENAI_API_KEY=sk-prod-key-here
```

#### Input Validation
```python
# Pydantic validation
from pydantic import BaseModel, validator

class RocketData(BaseModel):
    name: str
    parts: List[Part]
    motorId: str
    
    @validator('name')
    def validate_name(cls, v):
        if len(v) > 100:
            raise ValueError('Name too long')
        return v
    
    @validator('parts')
    def validate_parts(cls, v):
        if len(v) > 50:
            raise ValueError('Too many parts')
        return v
```

### CORS Configuration
```typescript
// Next.js API CORS
export async function POST(request: Request) {
  const response = await handleRequest(request);
  
  response.headers.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return response;
}
```

---

## 🧪 Testing

### Frontend Testing

#### Component Testing
```typescript
// React Testing Library
import { render, screen, fireEvent } from '@testing-library/react';
import { RocketVisualization } from '@/components/RocketVisualization';

describe('RocketVisualization', () => {
  test('renders rocket parts correctly', () => {
    const mockRocket = {
      id: '1',
      name: 'Test Rocket',
      parts: [
        { id: '1', type: 'nose', shape: 'ogive', length: 10, baseØ: 5 },
        { id: '2', type: 'body', Ø: 5, length: 30 }
      ]
    };
    
    render(<RocketVisualization rocket={mockRocket} />);
    
    expect(screen.getByTestId('nose-cone')).toBeInTheDocument();
    expect(screen.getByTestId('body-tube')).toBeInTheDocument();
  });
});
```

#### Integration Testing
```typescript
// API integration tests
import { testApiHandler } from 'next-test-api-route-handler';
import handler from '@/app/api/simulate/route';

describe('/api/simulate', () => {
  test('returns simulation results', async () => {
    await testApiHandler({
      handler,
      test: async ({ fetch }) => {
        const response = await fetch({
          method: 'POST',
          body: JSON.stringify({
            rocket: mockRocket,
            fidelity: 'standard'
          })
        });
        
        expect(response.status).toBe(200);
        const result = await response.json();
        expect(result.maxAltitude).toBeGreaterThan(0);
      }
    });
  });
});
```

### Backend Testing

#### Unit Testing
```python
# pytest for Python services
import pytest
from app import create_simulation

def test_simulation_creation():
    """Test simulation object creation."""
    rocket_data = {
        'name': 'Test Rocket',
        'parts': [
            {'type': 'nose', 'length': 10, 'shape': 'ogive'},
            {'type': 'body', 'length': 30, 'diameter': 5}
        ],
        'motorId': 'default-motor'
    }
    
    simulation = create_simulation(rocket_data)
    assert simulation is not None
    assert simulation.rocket.name == 'Test Rocket'

def test_simulation_execution():
    """Test simulation execution."""
    result = run_simulation(mock_rocket_data)
    
    assert result['maxAltitude'] > 0
    assert result['maxVelocity'] > 0
    assert result['stabilityMargin'] > 0
```

#### API Testing
```python
# FastAPI testing
from fastapi.testclient import TestClient
from app import app

client = TestClient(app)

def test_simulate_endpoint():
    """Test simulation API endpoint."""
    response = client.post(
        "/simulate",
        json={
            "rocket": mock_rocket_data,
            "fidelity": "standard"
        }
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "maxAltitude" in data
    assert data["maxAltitude"] > 0
```

### End-to-End Testing

#### Playwright E2E Tests
```typescript
// e2e/rocket-design.spec.ts
import { test, expect } from '@playwright/test';

test('complete rocket design workflow', async ({ page }) => {
  await page.goto('/');
  
  // Add rocket parts
  await page.click('[data-testid="add-nose-cone"]');
  await page.click('[data-testid="add-body-tube"]');
  await page.click('[data-testid="add-fins"]');
  
  // Configure rocket
  await page.fill('[data-testid="rocket-name"]', 'Test Rocket');
  await page.selectOption('[data-testid="motor-select"]', 'default-motor');
  
  // Run simulation
  await page.click('[data-testid="run-simulation"]');
  
  // Verify results
  await expect(page.locator('[data-testid="max-altitude"]')).toBeVisible();
  await expect(page.locator('[data-testid="stability-margin"]')).toBeVisible();
});
```

---

## 🔧 Troubleshooting

### Common Issues

#### Frontend Issues

##### Build Errors
```bash
# TypeScript compilation errors
npm run type-check

# ESLint errors
npm run lint --fix

# Dependency conflicts
rm -rf node_modules package-lock.json
npm install
```

##### 3D Rendering Issues
```typescript
// WebGL context loss
useEffect(() => {
  const handleContextLoss = (event) => {
    event.preventDefault();
    console.warn('WebGL context lost, attempting recovery...');
    // Implement recovery logic
  };
  
  canvas.addEventListener('webglcontextlost', handleContextLoss);
  return () => canvas.removeEventListener('webglcontextlost', handleContextLoss);
}, []);
```

##### State Management Issues
```typescript
// Zustand devtools for debugging
import { devtools } from 'zustand/middleware';

const useRocket = create(
  devtools(
    (set, get) => ({
      // ... state definition
    }),
    { name: 'rocket-store' }
  )
);
```

#### Backend Issues

##### Service Connection Errors
```bash
# Check service health
curl http://localhost:8002/health
curl http://localhost:8000/health

# View service logs
docker-compose logs agentpy
docker-compose logs rocketpy

# Restart services
docker-compose restart agentpy rocketpy
```

##### Python Dependency Issues
```bash
# Rebuild Python services
docker-compose build --no-cache agentpy
docker-compose build --no-cache rocketpy

# Check Python environment
docker-compose exec agentpy python --version
docker-compose exec agentpy pip list
```

##### OpenAI API Issues
```python
# API key validation
import openai

try:
    openai.api_key = os.getenv("OPENAI_API_KEY")
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": "test"}],
        max_tokens=1
    )
    print("API key valid")
except Exception as e:
    print(f"API key invalid: {e}")
```

#### Weather API Issues

##### Location Permission Denied
```typescript
// Fallback location handling
const handleLocationError = (error: GeolocationPositionError) => {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      // Use IP-based location or manual input
      return getLocationFromIP();
    case error.POSITION_UNAVAILABLE:
      // Use default location
      return getDefaultLocation();
    case error.TIMEOUT:
      // Retry with different options
      return retryLocationRequest();
  }
};
```

##### Weather API Rate Limits
```typescript
// Implement exponential backoff
const fetchWithRetry = async (url: string, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.status === 429) {
        // Rate limited, wait and retry
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        continue;
      }
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
    }
  }
};
```

### Performance Issues

#### Slow Simulations
```python
# Optimize simulation parameters
flight = Flight(
    rocket=rocket,
    environment=environment,
    rail_length=5.0,
    rtol=1e-6,  # Reduce precision for speed
    atol=1e-9,
    max_time_step=0.1  # Increase time step
)
```

#### Memory Issues
```typescript
// Cleanup 3D resources
useEffect(() => {
  return () => {
    // Dispose of geometries and materials
    scene.traverse((object) => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
  };
}, []);
```

### Debugging Tools

#### Frontend Debugging
```typescript
// React DevTools
// Redux DevTools (for Zustand)
// Three.js Inspector
// Performance profiler

// Custom debug utilities
const debug = {
  logRocketState: () => console.log(useRocket.getState()),
  logSimulationData: () => console.log(useRocket.getState().sim),
  exportState: () => JSON.stringify(useRocket.getState(), null, 2)
};

// Make available globally in development
if (process.env.NODE_ENV === 'development') {
  window.debug = debug;
}
```

#### Backend Debugging
```python
# Logging configuration
import logging

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Performance profiling
import cProfile
import pstats

def profile_simulation(rocket_data):
    """Profile simulation performance."""
    profiler = cProfile.Profile()
    profiler.enable()
    
    result = run_simulation(rocket_data)
    
    profiler.disable()
    stats = pstats.Stats(profiler)
    stats.sort_stats('cumulative')
    stats.print_stats(10)
    
    return result
```

---

## 📚 Additional Resources

### Documentation Links
- [Next.js Documentation](https://nextjs.org/docs)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- [OpenAI Agents SDK](https://github.com/openai/agents-sdk)
- [RocketPy Documentation](https://docs.rocketpy.org/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)

### API References
- [OpenWeatherMap API](https://openweathermap.org/api)
- [WeatherAPI Documentation](https://www.weatherapi.com/docs/)
- [NOAA API](https://www.weather.gov/documentation/services-web-api)

### Educational Resources
- [Rocket Propulsion Elements](https://www.rocket-propulsion.com/)
- [Model Rocket Safety Code](https://www.nar.org/safety-information/model-rocket-safety-code/)
- [Aerodynamics of Model Rockets](https://www.apogeerockets.com/education)

---

**ROCKETv1 Version 2** represents a significant advancement in educational rocket simulation technology, combining cutting-edge AI, professional physics simulation, and real-world data integration to create an unparalleled learning and design platform.

For support, feature requests, or contributions, please visit our [GitHub repository](https://github.com/your-org/ROCKETv1) or contact the development team.

---

*Last updated: December 2024*  
*Version: 2.0.0*  
*License: MIT* 