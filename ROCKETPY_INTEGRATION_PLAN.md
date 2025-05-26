# RocketPy Integration Plan
## Professional-Grade Simulation Engine for Rocket-Cursor AI

*This document outlines the implementation plan for leveraging RocketPy's advanced 6-DOF simulation capabilities in our rocket design platform.*

---

## 🔍 **Current Implementation Analysis**

### **Current Simulation Implementation**
Our platform currently implements:
- Basic flight simulation with simplified physics
- Fallback local calculations for quick simulations
- Simplified aerodynamic calculations
- Basic motor database with thrust curves
- Elementary stability calculations
- Simplified simulation API with timeout handling

### **Current Limitations**
- Limited to 3-DOF simulations
- No variable mass modeling
- No realistic weather/atmosphere conditions
- Simplified aerodynamic coefficients
- Limited parachute recovery simulation
- No Monte Carlo capability for dispersion analysis
- Timeout issues with more complex simulations

---

## 🚀 **RocketPy Capabilities to Integrate**

### **1. Core Simulation Engine**
- [x] Basic RocketPy installation
- [ ] Full 6-DOF simulation integration
- [ ] Variable mass modeling during flight
- [ ] LSODA solver with adjustable error tolerances
- [ ] Multi-stage rocket support
- [ ] Complete flight phase modeling (boost, coast, descent)

### **2. Advanced Atmospheric Modeling**
- [ ] International Standard Atmosphere (ISA) implementation
- [ ] Custom atmospheric profile imports
- [ ] Weather forecast integration (GFS data)
- [ ] Wind profile modeling with altitude variation
- [ ] Atmospheric condition presets (calm, moderate, turbulent)
- [ ] Historical weather data for post-flight analysis

### **3. Comprehensive Aerodynamic Modeling**
- [ ] Barrowman method implementation for CP calculation
- [ ] CFD data import capability for accurate drag profiles
- [ ] Reynolds number effects on drag coefficients
- [ ] Transonic and supersonic aerodynamic modeling
- [ ] Custom aerodynamic coefficient tables
- [ ] Dynamic stability analysis

### **4. Motor Modeling**
- [ ] Enhanced solid motor database with complete parameters
- [ ] Hybrid motor modeling with regression rates
- [ ] Liquid motor modeling with propellant flow
- [ ] Custom motor definition interface
- [ ] Thrust curve import from CSV/ENG files
- [ ] Motor clustering and configuration

### **5. Recovery System Simulation**
- [ ] Multi-stage recovery system modeling
- [ ] Parachute deployment triggers (altitude, time, acceleration)
- [ ] Customizable parachute drag coefficients
- [ ] Drift prediction with wind models
- [ ] Recovery electronics simulation with noise and delays
- [ ] Dual deploy simulation

### **6. Analysis Capabilities**
- [ ] Monte Carlo simulation for dispersion analysis
- [ ] Sensitivity analysis for design parameters
- [ ] Optimization algorithms for design targets
- [ ] Flight envelope calculation
- [ ] Safety margin analysis
- [ ] Certification requirement validation

---

## 🔧 **Implementation Workflow**

### **Phase 1: Core Integration (Week 1-2)**

#### **Environment Class Integration**
```python
# Environment class wrapper
class SimulationEnvironment:
    def __init__(self, latitude, longitude, elevation, date=None, timezone=None):
        from rocketpy import Environment
        
        self.env = Environment(
            latitude=latitude,
            longitude=longitude,
            elevation=elevation
        )
        
        # Set date if provided
        if date:
            self.env.set_date(date, timezone=timezone)
            
        # Default to standard atmosphere if no weather data specified
        self.env.set_atmospheric_model(type='StandardAtmosphere')
    
    def set_weather_forecast(self):
        """Import GFS forecast data"""
        self.env.set_atmospheric_model(type='Forecast', file='GFS')
        
    def set_custom_atmosphere(self, pressure, temperature, wind_u, wind_v, altitude):
        """Set custom atmospheric conditions"""
        self.env.set_atmospheric_model(
            type='Custom', 
            pressure=pressure,
            temperature=temperature,
            wind_u=wind_u,
            wind_v=wind_v,
            altitude=altitude
        )
```

#### **Motor Class Integration**
```python
# Motor class wrapper
class SimulationMotor:
    def __init__(self, motor_type="solid", **kwargs):
        from rocketpy import SolidMotor, HybridMotor, LiquidMotor
        
        self.motor_type = motor_type
        
        if motor_type == "solid":
            self.motor = SolidMotor(**kwargs)
        elif motor_type == "hybrid":
            self.motor = HybridMotor(**kwargs)
        elif motor_type == "liquid":
            self.motor = LiquidMotor(**kwargs)
        else:
            raise ValueError("Motor type must be 'solid', 'hybrid', or 'liquid'")
            
    @classmethod
    def from_thrust_curve(cls, thrust_curve_file, dry_mass, dry_inertia, **kwargs):
        """Create motor from thrust curve file"""
        return cls(
            motor_type="solid",
            thrust_source=thrust_curve_file,
            dry_mass=dry_mass,
            dry_inertia=dry_inertia,
            **kwargs
        )
```

#### **Rocket Class Integration**
```python
# Rocket class wrapper
class SimulationRocket:
    def __init__(self, radius, mass, inertia, drag_curve, center_of_mass_without_motor):
        from rocketpy import Rocket
        
        self.rocket = Rocket(
            radius=radius,
            mass=mass, # without motor
            inertia=inertia,
            power_off_drag=drag_curve,
            power_on_drag=drag_curve, # Can be different if provided
            center_of_mass_without_motor=center_of_mass_without_motor
        )
    
    def add_motor(self, motor, position):
        """Add motor to rocket"""
        self.rocket.add_motor(motor.motor, position=position)
    
    def add_nose(self, length, kind, position):
        """Add nose cone to rocket"""
        self.rocket.add_nose(
            length=length,
            kind=kind,
            position=position
        )
    
    def add_fins(self, n, root_chord, tip_chord, span, sweep_length, position):
        """Add fins to rocket"""
        self.rocket.add_trapezoidal_fins(
            n=n,
            root_chord=root_chord,
            tip_chord=tip_chord,
            span=span,
            sweep_length=sweep_length,
            position=position
        )
    
    def add_parachute(self, name, cd_s, trigger, sampling_rate=105, lag=1.5):
        """Add parachute to rocket"""
        self.rocket.add_parachute(
            name=name,
            cd_s=cd_s,
            trigger=trigger,
            sampling_rate=sampling_rate,
            lag=lag
        )
```

#### **Flight Class Integration**
```python
# Flight class wrapper
class SimulationFlight:
    def __init__(self, rocket, environment, rail_length, inclination, heading):
        from rocketpy import Flight
        
        self.flight = Flight(
            rocket=rocket.rocket,
            environment=environment.env,
            rail_length=rail_length,
            inclination=inclination,
            heading=heading
        )
    
    def get_results(self):
        """Get key flight results"""
        return {
            "apogee": self.flight.apogee,
            "max_speed": self.flight.max_speed,
            "max_acceleration": self.flight.max_acceleration,
            "time_to_apogee": self.flight.apogee_time,
            "impact_velocity": self.flight.impact_velocity,
            "impact_position": self.flight.impact_position,
            "stability_margin": self.flight.rocket.static_margin()
        }
    
    def get_trajectory(self):
        """Get trajectory data points"""
        return {
            "time": self.flight.time,
            "position": list(zip(self.flight.x, self.flight.y, self.flight.z)),
            "velocity": list(zip(self.flight.vx, self.flight.vy, self.flight.vz)),
            "acceleration": list(zip(self.flight.ax, self.flight.ay, self.flight.az)),
            "attitude": list(zip(self.flight.e0, self.flight.e1, self.flight.e2, self.flight.e3)),
            "angular_velocity": list(zip(self.flight.wx, self.flight.wy, self.flight.wz))
        }
        
    def export_kml(self, filename):
        """Export trajectory to KML for Google Earth"""
        self.flight.export_kml(file_name=filename)
```

### **Phase 2: Advanced Features (Week 3-4)**

#### **Monte Carlo Simulation**
```python
# Monte Carlo simulation wrapper
class MonteCarlo:
    def __init__(self, base_rocket, base_environment, base_flight_params, iterations=100):
        self.base_rocket = base_rocket
        self.base_environment = base_environment
        self.base_flight_params = base_flight_params
        self.iterations = iterations
        self.results = []
    
    def add_parameter_dispersion(self, parameter, distribution, *args):
        """Add parameter to vary in Monte Carlo simulation"""
        self.dispersions.append({
            "parameter": parameter,
            "distribution": distribution,
            "args": args
        })
    
    def run(self):
        """Run Monte Carlo simulation"""
        import numpy as np
        from copy import deepcopy
        
        for i in range(self.iterations):
            # Create deep copies of base objects
            rocket = deepcopy(self.base_rocket)
            environment = deepcopy(self.base_environment)
            params = deepcopy(self.base_flight_params)
            
            # Apply dispersions
            for dispersion in self.dispersions:
                param = dispersion["parameter"]
                dist = dispersion["distribution"]
                args = dispersion["args"]
                
                # Generate random value based on distribution
                if dist == "normal":
                    value = np.random.normal(*args)
                elif dist == "uniform":
                    value = np.random.uniform(*args)
                # ...other distributions
                
                # Apply to appropriate object
                self._apply_parameter(rocket, environment, params, param, value)
            
            # Run simulation
            flight = SimulationFlight(rocket, environment, **params)
            self.results.append(flight.get_results())
    
    def _apply_parameter(self, rocket, environment, params, param, value):
        """Apply parameter value to appropriate object"""
        if param.startswith("rocket."):
            # Apply to rocket
            pass
        elif param.startswith("environment."):
            # Apply to environment
            pass
        elif param.startswith("params."):
            # Apply to flight parameters
            pass
    
    def get_statistics(self):
        """Get statistical results of Monte Carlo simulation"""
        import numpy as np
        
        apogees = [r["apogee"] for r in self.results]
        return {
            "apogee_mean": np.mean(apogees),
            "apogee_std": np.std(apogees),
            "apogee_min": np.min(apogees),
            "apogee_max": np.max(apogees),
            # Other statistics
        }
```

### **Phase 3: API Integration (Week 5-6)**

#### **FastAPI Endpoints**
```python
# FastAPI endpoints for RocketPy integration
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class RocketModel(BaseModel):
    # Define rocket parameters
    pass

class EnvironmentModel(BaseModel):
    # Define environment parameters
    pass

class SimulationRequest(BaseModel):
    rocket: RocketModel
    environment: EnvironmentModel
    rail_length: float
    inclination: float
    heading: float

@app.post("/simulate/6dof")
async def simulate_6dof(request: SimulationRequest):
    """Run 6DOF simulation using RocketPy"""
    try:
        # Create environment
        env = SimulationEnvironment(
            latitude=request.environment.latitude,
            longitude=request.environment.longitude,
            elevation=request.environment.elevation
        )
        
        # Set weather if provided
        if hasattr(request.environment, "weather"):
            # Set weather based on type
            pass
        
        # Create motor
        motor = SimulationMotor.from_thrust_curve(
            thrust_curve_file=get_motor_file(request.rocket.motorId),
            dry_mass=get_motor_dry_mass(request.rocket.motorId),
            dry_inertia=get_motor_dry_inertia(request.rocket.motorId)
        )
        
        # Create rocket
        rocket = SimulationRocket(
            radius=calculate_radius(request.rocket),
            mass=calculate_mass(request.rocket),
            inertia=calculate_inertia(request.rocket),
            drag_curve=get_drag_curve(request.rocket),
            center_of_mass_without_motor=calculate_com(request.rocket)
        )
        
        # Add components
        add_components_from_parts(rocket, request.rocket.parts)
        
        # Add motor
        rocket.add_motor(motor, position=get_motor_position(request.rocket))
        
        # Create flight
        flight = SimulationFlight(
            rocket=rocket,
            environment=env,
            rail_length=request.rail_length,
            inclination=request.inclination,
            heading=request.heading
        )
        
        # Get results
        results = flight.get_results()
        trajectory = flight.get_trajectory()
        
        return {
            **results,
            "trajectory": trajectory
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation error: {str(e)}")

@app.post("/simulate/monte-carlo")
async def simulate_monte_carlo(request: MonteCarloRequest):
    """Run Monte Carlo simulation"""
    # Similar implementation to 6DOF endpoint but with Monte Carlo
    pass
```

### **Phase 4: UI Integration (Week 7-8)**

#### **Web Client Integration**
```typescript
// React hook for 6DOF simulation
function use6DOFSimulation() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  
  const simulate = async (rocketData, environmentData, launchParameters) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/simulate/6dof', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rocket: rocketData,
          environment: environmentData,
          ...launchParameters,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Simulation failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return { loading, results, error, simulate };
}

// React component for 3D trajectory visualization
function TrajectoryVisualization({ trajectoryData }) {
  const ref = useRef();
  
  useEffect(() => {
    if (!trajectoryData) return;
    
    // Use Three.js/R3F to visualize trajectory
    const scene = new THREE.Scene();
    // ... set up scene, camera, renderer
    
    // Create trajectory line
    const points = trajectoryData.position.map(
      pos => new THREE.Vector3(pos[0], pos[1], pos[2])
    );
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
    const line = new THREE.Line(geometry, material);
    scene.add(line);
    
    // ... add launch site, ground, etc.
    
    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    
    animate();
    
    return () => {
      // Cleanup
    };
  }, [trajectoryData]);
  
  return <div ref={ref} style={{ width: '100%', height: '500px' }} />;
}
```

---

## 📊 **Data Requirements**

### **1. Motor Database**
- Complete motor specifications including:
  - Thrust curves (CSV format)
  - Dry mass and inertia
  - Propellant specifications
  - Dimensions
  - Manufacturer data

### **2. Aerodynamic Coefficient Database**
- Drag coefficients vs. Mach number
- Lift coefficients for various components
- CFD-derived data for complex geometries
- Preset coefficient tables for common shapes

### **3. Material Properties Database**
- Density values for common materials
- Structural properties for FEA integration
- Temperature-dependent properties
- Safety factors

### **4. Weather Data Sources**
- Integration with GFS (Global Forecast System)
- Historical weather database
- Launch site presets
- Sounding rocket data format compatibility

### **5. Precomputed Component Data**
- Common nose cone shapes with CP/CG data
- Standard fin profiles
- Body tube specifications
- Parachute drag coefficients

---

## 🎯 **Key Integration Challenges**

### **1. Performance Optimization**
The full 6-DOF simulation is computationally intensive. We need to:
- Implement multi-fidelity simulation levels
- Utilize server-side caching for similar scenarios
- Implement progressive loading of results
- Consider GPU acceleration for Monte Carlo simulations

### **2. Data Translation**
Our current simplified model must be mapped to RocketPy's detailed model:
- Create automated parameter estimation for missing data
- Develop sensible defaults for professional simulations
- Implement validation checks for physically impossible configurations

### **3. Error Handling**
RocketPy simulations can fail for various reasons:
- Develop comprehensive error handling and user feedback
- Implement fallback to simpler models when full simulation fails
- Create diagnostic tools for simulation failures

### **4. User Experience**
Advanced simulations must remain accessible:
- Create simplified interfaces for complex parameters
- Develop visualization tools for simulation results
- Implement progressive disclosure of advanced features

---

## 📈 **Success Metrics**

### **1. Accuracy Metrics**
- **Apogee prediction**: Within 3% of actual flight data
- **Velocity prediction**: Within 5% of actual flight data
- **Stability calculation**: Correct stability prediction in 99% of cases
- **Drift prediction**: Within 10% of actual landing location

### **2. Performance Metrics**
- **Simulation time**: Standard 6-DOF < 3 seconds
- **Monte Carlo (100 runs)**: < 2 minutes
- **API response time**: < 5 seconds for complete results
- **UI responsiveness**: No blocking during simulation requests

### **3. Usability Metrics**
- **Feature discovery**: > 80% of users discover advanced simulations
- **Simulation success rate**: > 95% of simulations complete successfully
- **User-reported accuracy**: > 90% satisfaction with simulation results
- **Feature utilization**: Steady increase in advanced feature usage

---

## 🚀 **Implementation Timeline**

### **Week 1-2: Core Integration**
- [ ] Implement wrapper classes for RocketPy core classes
- [ ] Create data translation layer between our model and RocketPy
- [ ] Develop simplified API for basic 6-DOF simulation
- [ ] Implement comprehensive error handling

### **Week 3-4: Advanced Features**
- [ ] Implement Monte Carlo simulation capabilities
- [ ] Develop weather integration
- [ ] Create advanced recovery system simulation
- [ ] Implement multi-stage rocket support

### **Week 5-6: API Development**
- [ ] Create RESTful API endpoints for all simulation types
- [ ] Implement background processing for long-running simulations
- [ ] Develop results caching strategy
- [ ] Create comprehensive API documentation

### **Week 7-8: UI Integration**
- [ ] Develop simulation configuration UI
- [ ] Create advanced visualization components
- [ ] Implement user-friendly result displays
- [ ] Develop export capabilities for simulation data

---

This implementation plan provides a roadmap for fully leveraging RocketPy's advanced capabilities in our rocket design platform. By following this plan, we'll create a professional-grade simulation engine that delivers accurate results while maintaining an excellent user experience. 