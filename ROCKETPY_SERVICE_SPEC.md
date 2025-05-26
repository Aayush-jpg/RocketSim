# RocketPy Service Specification
## High-Fidelity Simulation Microservice for Rocket-Cursor AI

*Technical specification for the RocketPy-powered simulation service and its integration with the overall platform architecture.*

---

## 🏗️ **Service Architecture**

### **System Overview**
```
┌─────────────────────┐      ┌───────────────────┐     ┌────────────────────┐
│                     │      │                   │     │                    │
│  React Frontend     │<────>│  Next.js API      │<───>│  RocketPy Service  │
│  (Design UI)        │      │  (Gateway)        │     │  (Simulation)      │
│                     │      │                   │     │                    │
└─────────────────────┘      └───────────────────┘     └────────────────────┘
        ▲                            ▲                          ▲
        │                            │                          │
        ▼                            ▼                          ▼
┌─────────────────────┐      ┌───────────────────┐     ┌────────────────────┐
│                     │      │                   │     │                    │
│  Zustand Store      │<────>│  Database Service │<───>│  Data Processing   │
│  (State Management) │      │  (MongoDB)        │     │  (Results Analysis)│
│                     │      │                   │     │                    │
└─────────────────────┘      └───────────────────┘     └────────────────────┘
```

### **Service Responsibilities**
1. **RocketPy Service**: High-fidelity 6-DOF simulations, Monte Carlo analysis
2. **Next.js API**: Request validation, authentication, rate limiting, response formatting
3. **React Frontend**: User interface, visualization, input collection
4. **Zustand Store**: Client-side state management, simulation results caching
5. **Database Service**: Permanent storage of designs, simulation results, user preferences
6. **Data Processing**: Post-simulation analysis, optimization suggestions

---

## 🔌 **Service Interface**

### **Core Endpoints**

#### **1. `/simulate`**
- **Method**: POST
- **Description**: Run standard fidelity simulation (default)
- **Request Body**:
  ```json
  {
    "rocket": {
      "id": "string",
      "name": "string",
      "parts": [
        {
          "id": "string",
          "type": "nose|body|fin",
          "color": "string",
          "position": "number",
          "properties": { ... }
        }
      ],
      "motorId": "string",
      "Cd": "number"
    },
    "environment": {
      "latitude": "number",
      "longitude": "number",
      "elevation": "number",
      "date": "string (ISO)",
      "windSpeed": "number",
      "windDirection": "number"
    },
    "launchParameters": {
      "railLength": "number",
      "inclination": "number",
      "heading": "number"
    }
  }
  ```
- **Response Body**:
  ```json
  {
    "maxAltitude": "number",
    "maxVelocity": "number",
    "maxAcceleration": "number",
    "apogeeTime": "number",
    "stabilityMargin": "number",
    "thrustCurve": [["time", "thrust"]],
    "simulationFidelity": "string"
  }
  ```

#### **2. `/simulate/hifi`**
- **Method**: POST
- **Description**: Run high-fidelity 6-DOF simulation
- **Request/Response**: Same as `/simulate` with additional trajectory data
- **Response Additions**:
  ```json
  {
    "trajectory": {
      "time": ["number"],
      "position": [["x", "y", "z"]],
      "velocity": [["vx", "vy", "vz"]],
      "acceleration": [["ax", "ay", "az"]],
      "attitude": [["q0", "q1", "q2", "q3"]],
      "angularVelocity": [["wx", "wy", "wz"]]
    },
    "flightEvents": [
      {
        "name": "string",
        "time": "number",
        "altitude": "number"
      }
    ]
  }
  ```

#### **3. `/simulate/monte-carlo`**
- **Method**: POST
- **Description**: Run Monte Carlo analysis with parameter variations
- **Request Body**: Basic simulation request plus:
  ```json
  {
    "variations": [
      {
        "parameter": "string (dot notation)",
        "distribution": "normal|uniform|triangular",
        "parameters": ["number", "number"]
      }
    ],
    "iterations": "number (default: 100)"
  }
  ```
- **Response Body**:
  ```json
  {
    "nominal": { /* Standard sim results */ },
    "statistics": {
      "apogee": {
        "mean": "number",
        "std": "number",
        "min": "number",
        "max": "number",
        "percentiles": {
          "5": "number",
          "50": "number",
          "95": "number"
        }
      },
      /* Same format for other metrics */
    },
    "iterations": [
      { /* Summary of each iteration */ }
    ],
    "landingDispersion": {
      "coordinates": [["x", "y"]],
      "cep": "number",
      "majorAxis": "number",
      "minorAxis": "number",
      "rotation": "number"
    }
  }
  ```

#### **4. `/motors`**
- **Method**: GET
- **Description**: Get available motors with specifications
- **Query Parameters**:
  - `type`: solid|hybrid|liquid
  - `manufacturer`: string
  - `impulse`: min_impulse-max_impulse
- **Response Body**:
  ```json
  {
    "motors": [
      {
        "id": "string",
        "name": "string",
        "manufacturer": "string",
        "type": "string",
        "impulseClass": "string",
        "totalImpulse": "number",
        "avgThrust": "number",
        "burnTime": "number",
        "dimensions": {
          "diameter": "number",
          "length": "number"
        },
        "weight": {
          "propellant": "number",
          "total": "number"
        }
      }
    ]
  }
  ```

#### **5. `/weather`**
- **Method**: GET
- **Description**: Get weather data for launch location
- **Query Parameters**:
  - `latitude`: number
  - `longitude`: number
  - `date`: ISO string
- **Response Body**:
  ```json
  {
    "source": "GFS|GEFS|Historical",
    "resolution": "string",
    "altitude": ["number"],
    "pressure": ["number"],
    "temperature": ["number"],
    "windU": ["number"],
    "windV": ["number"],
    "humidity": ["number"]
  }
  ```

---

## 🖥️ **Service Implementation**

### **Technology Stack**
- **Language**: Python 3.11+
- **Framework**: FastAPI
- **Containerization**: Docker + Docker Compose
- **Compute**: CPU-optimized instances (Monte Carlo is CPU-bound)
- **Dependencies**:
  - RocketPy (core simulation)
  - NumPy (numerical computations)
  - Pandas (data analysis)
  - Pydantic (data validation)
  - Redis (optional, for result caching)

### **Container Specification**
```yaml
# Docker Compose excerpt
services:
  rocketpy:
    build: ./services/rocketpy
    ports:
      - "8000:8000"
    environment:
      - MAX_WORKERS=4
      - SIMULATION_TIMEOUT=60
      - CACHE_RESULTS=true
      - MONGO_URI=${MONGO_URI}
    volumes:
      - ./data/motors:/app/data/motors
      - ./data/weather:/app/data/weather
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### **Resource Requirements**
- **CPU**: 2-4 cores (8+ for Monte Carlo)
- **Memory**: 2-4GB baseline (8GB+ for Monte Carlo)
- **Storage**: 1GB for code + 10GB for cached simulation results
- **Network**: Standard bandwidth, <100 req/min expected

---

## 🔄 **Data Flow**

### **Simulation Request Flow**
1. User configures rocket in UI
2. Client sends design to Next.js API
3. API validates request and forwards to RocketPy service
4. RocketPy service:
   - Validates physics parameters
   - Constructs simulation objects
   - Runs simulation with appropriate fidelity
   - Processes and returns results
5. API formats response and returns to client
6. Client displays results and visualizations

### **Data Storage Strategy**
- **Motor Database**: Pre-loaded CSV/ENG files, indexed by ID
- **Simulation Results**: 
  - Short-term: Redis cache with TTL
  - Long-term: MongoDB for persistent storage
- **User Designs**: MongoDB with revision history
- **Weather Data**: Downloaded on-demand, cached for 6 hours

### **Caching Strategy**
- **Level 1**: Client-side caching of recent simulation results
- **Level 2**: API-level caching of identical requests (5 minute TTL)
- **Level 3**: Service-level caching of intermediate calculations
- **Cache Key**: Hash of rocket design + environment + launch parameters

---

## 🔐 **Security & Scaling**

### **Security Considerations**
- **Input Validation**: Strict schema validation on all inputs
- **Rate Limiting**: 60 requests per hour per user for high-fidelity sims
- **Authentication**: JWT token passed through API gateway
- **Isolation**: RocketPy service has no direct internet access
- **Code Security**: No eval() or exec() of user inputs

### **Scaling Strategy**
- **Horizontal Scaling**: Multiple RocketPy service instances
- **Load Balancing**: Round-robin for simulation requests
- **Dedicated Workers**: Separate instance pool for Monte Carlo sims
- **Auto-scaling**: Trigger on queue depth > 10 for >2 minutes

### **Failure Handling**
- **Timeout Handling**: Configurable simulation timeout (default 60s)
- **Fallback Strategy**: Automatic downgrade to simpler simulation on failure
- **Retry Logic**: Exponential backoff for transient failures
- **Circuit Breaker**: Disable high-fidelity endpoint if error rate > 10%

---

## 📋 **Integration Requirements**

### **Frontend Integration**
- **Simulation Configuration Component**: UI for setting all simulation parameters
- **Results Visualization**: 
  - 2D plots for altitude, velocity, acceleration vs. time
  - 3D trajectory visualization with R3F
  - Landing dispersion plots for Monte Carlo
- **Parameter Tuning UI**: Interactive controls for design optimization

### **API Integration**
- **Request Transformation**: Convert UI model to RocketPy model
- **Response Processing**: Transform detailed results to client-friendly format
- **Error Handling**: User-friendly error messages with suggestions
- **Progress Tracking**: Websocket connection for long-running simulations

### **External Integrations**
- **Weather API**: Connect to NOAA GFS for atmospheric data
- **Motor Database**: Regular updates from thrustcurve.org
- **Mapping Services**: Integration for launch site selection
- **Export Formats**: OpenRocket, RASAero, and KML compatibility

---

## 📊 **Monitoring & Maintenance**

### **Service Health Metrics**
- **Simulation Success Rate**: % of successful simulations
- **Response Time**: Average and 95th percentile
- **Error Rate**: % of simulations resulting in errors
- **Resource Utilization**: CPU, memory, disk usage
- **Cache Hit Rate**: % of requests served from cache

### **Alerting Thresholds**
- **Critical**: 
  - Error rate > 10% for 5 minutes
  - Response time > 10s for 5 minutes
  - Service unavailable
- **Warning**:
  - Error rate > 5% for 15 minutes
  - Response time > 5s for 15 minutes
  - CPU usage > 80% for 10 minutes

### **Maintenance Procedures**
- **Database Updates**: Weekly motor database synchronization
- **Weather Data**: Daily GFS forecast download
- **Log Rotation**: 7-day retention for detailed logs
- **Cache Cleanup**: Purge stale simulations after 7 days

---

## 🧪 **Testing Strategy**

### **Unit Tests**
- Component-level tests for each wrapper class
- Parameter validation tests
- Error handling tests

### **Integration Tests**
- End-to-end simulation flow tests
- API contract validation
- Response format verification

### **Performance Tests**
- Response time benchmarks for standard rockets
- Scaling tests for concurrent requests
- Monte Carlo performance with various iteration counts

### **Validation Tests**
- Compare simulation results against known flight data
- Verify physical correctness of simulations
- Regression tests for edge cases

---

## 📆 **Development Roadmap**

### **Phase 1: Minimum Viable Product**
- [x] Basic RocketPy service with simplified API
- [x] Standard atmosphere modeling
- [x] Solid motor support
- [x] Simple drag models
- [x] API timeout handling

### **Phase 2: Professional Features**
- [ ] Full 6-DOF simulation with RocketPy
- [ ] Multi-stage rocket support
- [ ] Advanced atmospheric modeling
- [ ] Enhanced motor models (hybrid, liquid)
- [ ] Monte Carlo capability

### **Phase 3: Advanced Capabilities**
- [ ] Optimization algorithms
- [ ] CFD integration
- [ ] Flight envelope analysis
- [ ] Certification requirements checking
- [ ] Advanced recovery simulations

### **Phase 4: Enterprise Features**
- [ ] Multi-user simulation environment
- [ ] Team collaboration features
- [ ] Simulation version control
- [ ] Custom simulation extensions
- [ ] Real-time flight data comparison

---

This specification provides a comprehensive blueprint for implementing the RocketPy service as part of our professional rocket design platform. The service is designed to deliver accurate, high-fidelity simulations while maintaining excellent performance and user experience. 