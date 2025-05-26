import { useRocket } from '../store';
import { Part, Nose, Body, Fin } from '@/types/rocket';
import type { Rocket, SimulationResult } from '@/types/rocket';

// Extend Window interface for global properties
declare global {
  interface Window {
    environmentConditions?: any;
    launchParameters?: any;
    monteCarloResults?: any;
    flightReport?: any;
  }
}

// Function to run a quick simulation (client-side)
export function runQuickSim() {
  // Client-side physics simulation using rocket data from store
  const { rocket, setSim } = useRocket.getState();
  
  console.log('🚀 Running quick simulation with rocket:', rocket);
  
  // Get motor data (in production, this would come from a motor database)
  // Define our complete propulsion systems database
  const propulsionSystems = {
    'mini-motor': {
      thrust: 15, // N
      burnTime: 1.8, // s
      isp: 180, // s
      type: 'solid',
      propellantMass: 0.010, // kg
      dryMass: 0.008, // kg
      totalImpulse: 27 // N·s
    },
    'default-motor': {
      thrust: 32, // N
      burnTime: 2.4, // s
      isp: 200, // s
      type: 'solid',
      propellantMass: 0.040, // kg
      dryMass: 0.015, // kg
      totalImpulse: 76.8 // N·s
    },
    'high-power': {
      thrust: 60, // N
      burnTime: 3.2, // s
      isp: 220, // s
      type: 'solid',
      propellantMass: 0.090, // kg
      dryMass: 0.025, // kg
      totalImpulse: 192 // N·s
    },
    'super-power': {
      thrust: 120, // N
      burnTime: 4.0, // s
      isp: 240, // s
      type: 'solid',
      propellantMass: 0.200, // kg
      dryMass: 0.050, // kg
      totalImpulse: 480 // N·s
    },
    'small-liquid': {
      thrust: 500, // N
      burnTime: 30, // s
      isp: 300, // s
      type: 'liquid',
      propellantMass: 1.5, // kg
      dryMass: 0.8, // kg
      totalImpulse: 15000 // N·s
    },
    'medium-liquid': {
      thrust: 2000, // N
      burnTime: 45, // s
      isp: 320, // s
      type: 'liquid',
      propellantMass: 6.5, // kg
      dryMass: 2.0, // kg
      totalImpulse: 90000 // N·s
    },
    'large-liquid': {
      thrust: 8000, // N
      burnTime: 60, // s
      isp: 340, // s
      type: 'liquid',
      propellantMass: 24.0, // kg
      dryMass: 5.0, // kg
      totalImpulse: 480000 // N·s
    },
    'hybrid-engine': {
      thrust: 1200, // N
      burnTime: 20, // s
      isp: 280, // s
      type: 'hybrid',
      propellantMass: 4.5, // kg
      dryMass: 1.2, // kg
      totalImpulse: 24000 // N·s
    }
  };
  
  // Get motor data from database or use default
  const selectedMotor = propulsionSystems[rocket.motorId as keyof typeof propulsionSystems] || propulsionSystems['default-motor'];
  const motorThrust = selectedMotor.thrust;
  const burnTime = selectedMotor.burnTime;
  const isp = selectedMotor.isp;
  
  console.log('🔧 Selected motor:', selectedMotor);
  
  // Calculate mass based on parts
  const mass = estimateRocketMass(rocket);
  
  // Add engine mass
  const totalMass = mass + selectedMotor.dryMass + selectedMotor.propellantMass;
  const dragCoefficient = rocket.Cd;
  
  console.log('📊 Mass calculations:', { mass, totalMass, dragCoefficient });
  
  // More sophisticated physics calculations
  let maxAltitude, maxVelocity, maxAcceleration;
  
  if (selectedMotor.type === 'liquid') {
    // Liquid engines need special handling
    console.log('Calculating liquid engine performance...');
    // More accurate rocket equation for liquid engines
    const exhaustVelocity = isp * 9.81; // m/s
    const deltaV = exhaustVelocity * Math.log(totalMass / (totalMass - selectedMotor.propellantMass)) 
                  - burnTime * 9.81 * 0.2; // with gravity losses
    
    // More accurate altitude estimation with air density effects
    const effectiveDeltaV = deltaV * 0.85; // 85% efficiency for drag and other losses
    maxVelocity = effectiveDeltaV;
    maxAcceleration = motorThrust / totalMass; // m/s²
    
    // For liquid engines, consider powered flight contribution
    const poweredAltitude = (motorThrust / totalMass - 9.81) * (burnTime**2) / 2 * 0.8;
    const ballisticAltitude = (effectiveDeltaV**2) / (2 * 9.81);
    maxAltitude = Math.max(0, poweredAltitude) + ballisticAltitude;
    
    // For very high altitudes, apply density correction
    if (maxAltitude > 10000) {
      maxAltitude *= 1.2; // Thinner air at high altitudes means less drag
    }
  } else {
    // Standard calculation for solid motors
    const acceleration = motorThrust / totalMass;
    maxAcceleration = acceleration;
    const impulse = motorThrust * burnTime;
    const velocityFactor = selectedMotor.type === 'hybrid' ? 0.85 : 0.8;
    
    // Calculate burnout velocity using impulse (F*t = m*Δv)
    maxVelocity = impulse / totalMass * velocityFactor;
    
    // Add powered flight contribution and ballistic flight
    const poweredHeight = 0.5 * acceleration * (burnTime * burnTime) * 0.8;
    const ballisticHeight = (maxVelocity * maxVelocity) / (2 * 9.81) * 0.7;
    maxAltitude = poweredHeight + ballisticHeight;
  }
  
  // Calculate stability margin (calibers)
  const stabilityMargin = calculateStability(rocket);
  
  console.log('📈 Simulation results:', { maxAltitude, maxVelocity, maxAcceleration, stabilityMargin, motorThrust });
  
  // Set simulation results in store
  const simResults = {
    maxAltitude,
    maxVelocity,
    maxAcceleration,
    apogeeTime: maxVelocity / 9.8,
    stabilityMargin
  };
  
  console.log('💾 Setting simulation results in store:', simResults);
  setSim(simResults);
  
  // Dispatch event to notify UI components
  window.dispatchEvent(new CustomEvent('simulationComplete', { 
    detail: simResults 
  }));
}

// Function to run a high-fidelity simulation (server-side)
export async function runHighFiSim() {
  const { rocket, setSim } = useRocket.getState();
  
  try {
    console.log('Running high-fidelity simulation...');
    
    const response = await fetch('/api/hifi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rocket }),
    });
    
    if (!response.ok) {
      throw new Error(`High-fidelity simulation failed: ${response.statusText}`);
    }
    
    const simResults = await response.json();
    console.log('Simulation results:', simResults);
    
    // Update the store with simulation results
    setSim(simResults);
  } catch (error) {
    console.error('Error running high-fidelity simulation:', error);
    // Fallback to quick sim if high-fi fails
    runQuickSim();
  }
}

// Helper function to estimate rocket mass based on parts
export function estimateRocketMass(rocket: any) {
  let totalMass = 0.05; // Base empty mass in kg
  
  // Add mass for each part
  rocket.parts.forEach((part: any) => {
    switch (part.type) {
      case 'nose':
        totalMass += 0.05 * (part.length / 10); // Mass based on nose length
        break;
      case 'body':
        totalMass += 0.1 * (part.length / 10) * part.Ø; // Mass based on body dimensions
        break;
      case 'fin':
        totalMass += 0.01 * part.root * part.span; // Mass based on fin dimensions
        break;
    }
  });
  
  // Add motor mass (approximation)
  totalMass += 0.05;
  
  return totalMass;
}

// Helper function to calculate stability margin in calibers
export function calculateStability(rocket: any) {
  // Get parts data
  const noseParts = rocket.parts.filter((p: Part) => p.type === 'nose') as Nose[];
  const bodyParts = rocket.parts.filter((p: Part) => p.type === 'body') as Body[];
  const finParts = rocket.parts.filter((p: Part) => p.type === 'fin') as Fin[];
  
  // Get diameter from the first body part (or use default)
  const diameter = bodyParts.length > 0 ? bodyParts[0].Ø : 5; // Default diameter in cm
  
  // Calculate stability (simplified)
  // More fins = more stability
  let stabilityBase = 1.0 + (finParts.length * 0.2);
  
  // Fin size effect
  let finAreaSum = 0;
  finParts.forEach((fin) => {
    if (fin.root && fin.span) {
      // Approximate fin area as 1/2 * root * span
      const finArea = 0.5 * fin.root * fin.span;
      finAreaSum += finArea;
    }
  });
  
  // Add nose cone shape effect on stability
  let noseEffect = 0;
  if (noseParts.length > 0) {
    const nose = noseParts[0];
    // Ogive nose cones provide slightly better stability than conical ones
    if (nose.shape === 'ogive') {
      noseEffect = 0.1;
    }
    // Longer nose cones affect center of pressure
    if (nose.length) {
      noseEffect += (nose.length / 50) * 0.2; // Small effect based on length
    }
  }
  
  // Adjust stability based on fin area relative to body diameter
  // More fin area relative to diameter = more stability
  const finAreaEffect = finAreaSum / (diameter * diameter) * 0.5;
  
  return stabilityBase + finAreaEffect + noseEffect;
}

// Main dispatcher function to process agent actions
export function dispatchActions(actions: any[]) {
  const { updateRocket, setSim } = useRocket.getState();
  
  console.log('🎯 Dispatching actions:', actions);
  
  actions.forEach((a) => {
    console.log('🔄 Processing action:', a);
    
    // Dispatch event for UI components to react to agent actions
    window.dispatchEvent(new CustomEvent('agentAction', { 
      detail: { action: a.action, ...a } 
    }));
    
    switch (a.action) {
      case "add_part":
        console.log('➕ Adding part:', a.type, a.props);
        updateRocket((r) => {
          r.parts.push({ 
            id: crypto.randomUUID(), 
            type: a.type, 
            color: a.props?.color || "white",
            ...a.props 
          });
          return r;
        });
        break;
      case "update_rocket":
        console.log('🚀 Updating rocket properties:', a.props);
        updateRocket((r) => {
          Object.assign(r, a.props);
          return r;
        });
        break;
      case "update_part":
        console.log('🔧 Updating part:', a.id, a.props);
        updateRocket((r) => {
          if (a.id === "all") {
            // Update all parts
            r.parts.forEach(part => {
              Object.assign(part, a.props);
            });
          } else {
            // First try to find by exact ID
            let p = r.parts.find((p) => p.id === a.id);
            
            // If not found by ID, try to find by type (for agent compatibility)
            if (!p) {
              const typeMap: { [key: string]: string } = {
                'body1': 'body',
                'nose1': 'nose', 
                'finset1': 'fin',
                'engine1': 'engine'
              };
              
              const targetType = typeMap[a.id] || a.id;
              p = r.parts.find((part) => part.type === targetType);
              
              if (p) {
                console.log(`🔄 Found part by type: ${a.id} -> ${targetType}`);
              } else {
                // If part doesn't exist and we know the type, create it
                if (typeMap[a.id]) {
                  const newPartType = typeMap[a.id];
                  console.log(`➕ Creating missing ${newPartType} part for ${a.id}`);
                  
                  // Create default part based on type
                  const defaultParts: { [key: string]: any } = {
                    'nose': { shape: 'ogive', length: 10, baseØ: 5, color: '#A0A7B8' },
                    'body': { Ø: 5, length: 20, color: '#8C8D91' },
                    'fin': { root: 8, span: 6, sweep: 4, color: '#A0A7B8' },
                    'engine': { thrust: 32, Isp: 200, color: '#0066FF' }
                  };
                  
                  const newPart = {
                    id: crypto.randomUUID(),
                    type: newPartType,
                    ...defaultParts[newPartType]
                  };
                  
                  r.parts.push(newPart);
                  p = newPart; // Assign to p for later processing
                  console.log(`✅ Created new ${newPartType} part`);
                }
              }
            }
            
            if (p) {
              // Handle property name mappings for agent compatibility
              const props = { ...a.props };
              
              // Map unicode diameter symbols to property names
              if (props['Ø']) {
                if (p.type === 'body') {
                  props['Ø'] = props['Ø']; // Keep as is for body
                } else if (p.type === 'nose') {
                  props['baseØ'] = props['Ø']; // Map to baseØ for nose
                  delete props['Ø'];
                }
              }
              if (props['baseØ']) {
                props['baseØ'] = props['baseØ']; // Keep as is
              }
              
              Object.assign(p, props);
              console.log(`✅ Updated part ${p.type} with:`, props);
            } else {
              console.warn(`❌ Part not found for update: ${a.id}`);
            }
          }
          return r;
        });
        break;
      case "remove_part":
        console.log('🗑️ Removing part:', a.id);
        updateRocket((r) => {
          // First try to find by exact ID
          let partIndex = r.parts.findIndex((p) => p.id === a.id);
          
          // If not found by ID, try to find by type (for agent compatibility)
          if (partIndex === -1) {
            const typeMap: { [key: string]: string } = {
              'body1': 'body',
              'nose1': 'nose', 
              'finset1': 'fin',
              'engine1': 'engine'
            };
            
            const targetType = typeMap[a.id] || a.id;
            partIndex = r.parts.findIndex((part) => part.type === targetType);
            
            if (partIndex !== -1) {
              console.log(`🔄 Found part by type: ${a.id} -> ${targetType}`);
            }
          }
          
          if (partIndex !== -1) {
            r.parts.splice(partIndex, 1);
            console.log(`✅ Removed part at index ${partIndex}`);
          } else {
            console.warn(`❌ Part not found for removal: ${a.id}`);
          }
          return r;
        });
        break;
      case "change_motor":
      case "update_motor":
        console.log('🚀 Changing motor to:', a.motorId || a.id);
        updateRocket((r) => {
          r.motorId = a.motorId || a.id;
          return r;
        });
        break;
      case "get_motor":
        console.log('ℹ️ Getting motor info for:', a.id);
        // This is typically an informational action that doesn't change state
        // The agent will use this info to make decisions
        break;
      case "run_sim":
        console.log('🚀 Running simulation with fidelity:', a.fidelity);
        // Dispatch specific event for simulation actions
        window.dispatchEvent(new CustomEvent('agentAction', { 
          detail: { action: 'run_sim', type: 'simulation', showMetrics: true } 
        }));
        
        a.fidelity === "quick"
          ? runQuickSim()          // client physics
          : runHighFiSim();        // POST /api/hifi (unchanged)
        break;
      case "run_simulation":
      case "run_professional_simulation":
        handleProfessionalSimulation(a);
        break;
      case "analyze_comprehensive_stability":
        handleStabilityAnalysis(a);
        break;
      case "analyze_comprehensive_performance":
        handlePerformanceAnalysis(a);
        break;
      case "optimize_rocket_design":
        handleDesignOptimization(a);
        break;
      case "run_advanced_monte_carlo":
        handleMonteCarloAnalysis(a);
        break;
      case "set_professional_environment":
        handleEnvironmentSetup(a);
        break;
      case "analyze_motor_performance_detailed":
        handleMotorAnalysis(a);
        break;
      case "generate_flight_report":
        handleFlightReport(a);
        break;
      case "validate_design_requirements":
        handleRequirementsValidation(a);
        break;
      case "analyze_trajectory":
        analyzeTrajectory(a);
        break;
      case "run_monte_carlo":
        runMonteCarloAnalysis(a);
        break;
      case "optimize_design":
        optimizeDesign(a);
        break;
      case "analyze_stability":
        analyzeStability(a);
        break;
      case "set_environment":
        console.log('🌍 Setting environment conditions:', a);
        setEnvironmentConditions(a);
        break;
      case "set_launch_parameters":
        console.log('🚀 Setting launch parameters:', a);
        setLaunchParameters(a);
        break;
      case "analyze_motor":
        console.log('🔥 Analyzing motor:', a.motor_id);
        analyzeMotorPerformance(a);
        break;
      case "export_data":
        console.log('💾 Exporting simulation data:', a.format);
        exportSimulationData(a);
        break;
      case "predict_recovery":
        console.log('🪂 Predicting recovery:', a);
        predictRecovery(a);
        break;
      default:
        console.warn(`Unknown action: ${a.action}`);
    }
  });
}

// ================================
// ADVANCED SIMULATION FUNCTIONS
// ================================

// Advanced simulation with environment and launch parameters
export async function runAdvancedSimulation(
  fidelity: string = "standard",
  environment?: any,
  launchParams?: any
) {
  const { rocket, updateRocket, setSim } = useRocket.getState();
  
  console.log('🚀 Running advanced simulation:', { fidelity, environment, launchParams });
  
  try {
    // Prepare request payload
    const requestData = {
      rocket: {
        id: rocket.id,
        name: rocket.name,
        parts: rocket.parts,
        motorId: rocket.motorId,
        Cd: rocket.Cd || 0.5,
        units: rocket.units || "metric"
      },
      environment: environment || {
        latitude: 0.0,
        longitude: 0.0,
        elevation: 0.0,
        windSpeed: 0.0,
        windDirection: 0.0,
        atmosphericModel: "standard"
      },
      launchParameters: launchParams || {
        railLength: 5.0,
        inclination: 85.0,
        heading: 0.0
      },
      simulationType: fidelity
    };
    
    // Choose endpoint based on fidelity
    const endpoint = fidelity === "hifi" ? "/api/simulate/hifi" : "/api/simulate";
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestData),
    });
    
    if (!response.ok) {
      throw new Error(`Simulation failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Update simulation state
    setSim({
      maxAltitude: result.maxAltitude,
      maxVelocity: result.maxVelocity,
      maxAcceleration: result.maxAcceleration || result.maxVelocity / 10,
      apogeeTime: result.apogeeTime,
      stabilityMargin: result.stabilityMargin,
      thrustCurve: result.thrustCurve || [],
      simulationFidelity: result.simulationFidelity || fidelity,
      trajectory: result.trajectory,
      flightEvents: result.flightEvents,
      impactVelocity: result.impactVelocity,
      driftDistance: result.driftDistance
    });
    
    // Dispatch event for UI updates
    window.dispatchEvent(new CustomEvent('simulationComplete', { 
      detail: { 
        result, 
        fidelity,
        advanced: true
      } 
    }));
    
    console.log('✅ Advanced simulation complete:', result);
    
  } catch (error) {
    console.error('❌ Advanced simulation failed:', error);
    
    // Fallback to quick simulation
    console.log('🔄 Falling back to quick simulation...');
    runQuickSim();
  }
}

// Trajectory analysis function
export async function analyzeTrajectory(params: any) {
  const { sim } = useRocket.getState();
  
  if (!sim || !sim.trajectory) {
    console.log('⚠️ No trajectory data available, running simulation first...');
    await runAdvancedSimulation("hifi");
    return;
  }
  
  console.log('📈 Analyzing trajectory with params:', params);
  
  // Dispatch trajectory analysis event for UI visualization
  window.dispatchEvent(new CustomEvent('trajectoryAnalysis', {
    detail: {
      trajectory: sim.trajectory,
      params,
      include3DPath: params.include_3d_path,
      includeVelocity: params.include_velocity_profile,
      includeAcceleration: params.include_acceleration_profile,
      includeAttitude: params.include_attitude_data
    }
  }));
}

// Monte Carlo analysis function
export async function runMonteCarloAnalysis(params: any) {
  const { rocket } = useRocket.getState();
  
  console.log('🎲 Starting Monte Carlo analysis with', params.iterations, 'iterations');
  
  try {
    const response = await fetch("/api/simulate/monte-carlo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rocket,
        environment: params.environment || {},
        launchParameters: params.launch_parameters || {},
        variations: params.variations || [],
        iterations: params.iterations || 100
      })
    });
    
    if (!response.ok) {
      throw new Error(`Monte Carlo simulation failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Dispatch Monte Carlo results event
    window.dispatchEvent(new CustomEvent('monteCarloComplete', {
      detail: {
        result,
        statistics: result.statistics,
        landingDispersion: result.landingDispersion,
        iterations: result.iterations
      }
    }));
    
    console.log('✅ Monte Carlo analysis complete:', result);
    
  } catch (error) {
    console.error('❌ Monte Carlo analysis failed:', error);
  }
}

// Design optimization function
export async function optimizeDesign(params: any) {
  const { rocket, updateRocket } = useRocket.getState();
  
  console.log('⚡ Starting design optimization for:', params.target);
  
  // Simple optimization simulation (can be enhanced with actual optimization algorithms)
  const currentSim = useRocket.getState().sim;
  
  if (!currentSim) {
    console.log('⚠️ No simulation data available, running simulation first...');
    await runAdvancedSimulation("hifi");
    return;
  }
  
  // Dispatch optimization event
  window.dispatchEvent(new CustomEvent('designOptimization', {
    detail: {
      target: params.target,
      constraints: params.constraints,
      method: params.method,
      currentPerformance: {
        altitude: currentSim.maxAltitude,
        stability: currentSim.stabilityMargin,
        velocity: currentSim.maxVelocity
      }
    }
  }));
  
  // Simple optimization suggestions based on target
  let suggestions: string[] = [];
  
  switch (params.target) {
    case "max_altitude":
      suggestions = [
        "Consider increasing fin span for better stability",
        "Optimize nose cone shape to reduce drag",
        "Reduce rocket mass by optimizing part dimensions"
      ];
      break;
    case "stability_margin":
      suggestions = [
        "Increase fin area or move fins further aft",
        "Consider a longer, more aerodynamic nose cone",
        "Check center of gravity and center of pressure locations"
      ];
      break;
    case "landing_accuracy":
      suggestions = [
        "Add or optimize recovery system",
        "Consider wind-resistant design features",
        "Optimize apogee detection and deployment timing"
      ];
      break;
  }
  
  // Dispatch suggestions
  window.dispatchEvent(new CustomEvent('optimizationSuggestions', {
    detail: { suggestions, target: params.target }
  }));
}

// Stability analysis function
export async function analyzeStability(params: any) {
  const { rocket, sim } = useRocket.getState();
  
  console.log('⚖️ Analyzing stability for phase:', params.flight_phase);
  
  // Calculate static stability margin
  const staticMargin = calculateStability(rocket);
  
  // Enhanced stability analysis
  const stabilityAnalysis = {
    staticMargin,
    flight_phase: params.flight_phase,
    includeStatic: params.include_static_margin,
    includeDynamic: params.include_dynamic_stability,
    windConditions: params.wind_conditions,
    recommendations: [] as string[]
  };
  
  // Add recommendations based on stability margin
  if (staticMargin < 1.0) {
    stabilityAnalysis.recommendations.push("⚠️ Stability margin is below recommended minimum (1.0)");
    stabilityAnalysis.recommendations.push("Consider increasing fin area or moving fins aft");
  } else if (staticMargin > 3.0) {
    stabilityAnalysis.recommendations.push("ℹ️ Very high stability margin - rocket may be over-stable");
    stabilityAnalysis.recommendations.push("Consider reducing fin area for optimal performance");
  } else {
    stabilityAnalysis.recommendations.push("✅ Stability margin is within recommended range");
  }
  
  // Dispatch stability analysis event
  window.dispatchEvent(new CustomEvent('stabilityAnalysis', {
    detail: stabilityAnalysis
  }));
}

// Environment conditions setter
export function setEnvironmentConditions(params: any) {
  console.log('🌍 Setting environment conditions:', params);
  
  // Store environment conditions for next simulation
  window.environmentConditions = {
    latitude: params.latitude,
    longitude: params.longitude,
    elevation: params.elevation,
    windSpeed: params.wind_speed,
    windDirection: params.wind_direction,
    atmosphericModel: params.atmospheric_model,
    date: params.date
  };
  
  // Dispatch environment update event
  window.dispatchEvent(new CustomEvent('environmentUpdate', {
    detail: window.environmentConditions
  }));
}

// Launch parameters setter
export function setLaunchParameters(params: any) {
  console.log('🚀 Setting launch parameters:', params);
  
  // Store launch parameters for next simulation
  window.launchParameters = {
    railLength: params.rail_length,
    inclination: params.inclination,
    heading: params.heading,
    launchSiteName: params.launch_site_name
  };
  
  // Dispatch launch parameters update event
  window.dispatchEvent(new CustomEvent('launchParametersUpdate', {
    detail: window.launchParameters
  }));
}

// Motor performance analysis
export async function analyzeMotorPerformance(params: any) {
  const { rocket } = useRocket.getState();
  
  console.log('🔥 Analyzing motor performance for:', params.motor_id);
  
  try {
    // Get motor specifications
    const response = await fetch(`/api/motors`);
    const data = await response.json();
    const motor = data.motors.find((m: any) => m.id === params.motor_id);
    
    if (!motor) {
      console.error('❌ Motor not found:', params.motor_id);
      return;
    }
    
    // Calculate performance metrics
    const analysis = {
      motor,
      thrustToWeight: motor.avgThrust / (estimateRocketMass(rocket) * 9.81),
      totalImpulse: motor.totalImpulse,
      specificImpulse: motor.totalImpulse / (motor.weight.propellant * 9.81),
      burnTime: motor.burnTime,
      averageThrust: motor.avgThrust,
      impulseClass: motor.impulseClass,
      recommendations: [] as string[]
    };
    
    // Add performance recommendations
    if (analysis.thrustToWeight < 5) {
      analysis.recommendations.push("⚠️ Low thrust-to-weight ratio - consider a more powerful motor");
    } else if (analysis.thrustToWeight > 15) {
      analysis.recommendations.push("⚠️ Very high thrust-to-weight ratio - may cause excessive acceleration");
    } else {
      analysis.recommendations.push("✅ Good thrust-to-weight ratio for stable flight");
    }
    
    // Dispatch motor analysis event
    window.dispatchEvent(new CustomEvent('motorAnalysis', {
      detail: analysis
    }));
    
  } catch (error) {
    console.error('❌ Motor analysis failed:', error);
  }
}

// Simulation data export
export function exportSimulationData(params: any) {
  const { sim, rocket } = useRocket.getState();
  
  if (!sim) {
    console.log('⚠️ No simulation data to export');
    return;
  }
  
  console.log('💾 Exporting simulation data in format:', params.format);
  
  let exportData: any = {
    rocket: {
      name: rocket.name,
      parts: rocket.parts,
      motorId: rocket.motorId,
      Cd: rocket.Cd
    },
    simulation: {
      maxAltitude: sim.maxAltitude,
      maxVelocity: sim.maxVelocity,
      apogeeTime: sim.apogeeTime,
      stabilityMargin: sim.stabilityMargin,
      fidelity: sim.simulationFidelity
    }
  };
  
  if (params.include_trajectory && sim.trajectory) {
    exportData.trajectory = sim.trajectory;
  }
  
  if (params.include_events && sim.flightEvents) {
    exportData.events = sim.flightEvents;
  }
  
  if (params.include_motor_data && sim.thrustCurve) {
    exportData.motorData = {
      thrustCurve: sim.thrustCurve
    };
  }
  
  // Create and download file
  let content: string;
  let filename: string;
  let mimeType: string;
  
  switch (params.format) {
    case "csv":
      content = convertToCSV(exportData);
      filename = `${rocket.name}_simulation.csv`;
      mimeType = "text/csv";
      break;
    case "json":
      content = JSON.stringify(exportData, null, 2);
      filename = `${rocket.name}_simulation.json`;
      mimeType = "application/json";
      break;
    case "kml":
      content = convertToKML(exportData);
      filename = `${rocket.name}_trajectory.kml`;
      mimeType = "application/vnd.google-earth.kml+xml";
      break;
    default:
      content = JSON.stringify(exportData, null, 2);
      filename = `${rocket.name}_simulation.json`;
      mimeType = "application/json";
  }
  
  // Create download
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  
  console.log('✅ Data exported as:', filename);
}

// Recovery prediction
export function predictRecovery(params: any) {
  const { sim } = useRocket.getState();
  
  console.log('🪂 Predicting recovery with parameters:', params);
  
  if (!sim) {
    console.log('⚠️ No simulation data available for recovery prediction');
    return;
  }
  
  const apogeeAltitude = sim.maxAltitude;
  const deploymentAltitude = params.deployment_altitude;
  
  if (!apogeeAltitude) {
    return {
      deploymentAltitude: 0,
      terminalVelocity: 0,
      descentTime: 0,
      driftDistance: 0,
      landingVelocity: 0,
      recommendations: ["No simulation data available for recovery prediction"]
    };
  }
  
  const descentDistance = apogeeAltitude - deploymentAltitude;
  
  // Estimate descent time and drift
  const parachuteDragArea = params.parachute_cd_s;
  const terminalVelocity = Math.sqrt((2 * estimateRocketMass(useRocket.getState().rocket) * 9.81) / (1.225 * parachuteDragArea));
  const descentTime = descentDistance / terminalVelocity + params.deployment_delay;
  
  // Simple drift calculation (assuming constant wind)
  const windSpeed = window.environmentConditions?.windSpeed || 5; // m/s
  const driftDistance = windSpeed * descentTime;
  
  const recoveryPrediction = {
    deploymentAltitude,
    terminalVelocity,
    descentTime,
    driftDistance,
    landingVelocity: terminalVelocity,
    recommendations: [] as string[]
  };
  
  // Add recommendations
  if (terminalVelocity > 6) {
    recoveryPrediction.recommendations.push("⚠️ High landing velocity - consider larger parachute");
  } else if (terminalVelocity < 3) {
    recoveryPrediction.recommendations.push("ℹ️ Very gentle landing - parachute may be oversized");
  } else {
    recoveryPrediction.recommendations.push("✅ Good landing velocity for safe recovery");
  }
  
  if (driftDistance > 500) {
    recoveryPrediction.recommendations.push("⚠️ Large drift distance - consider dual deploy or lower deployment altitude");
  }
  
  // Dispatch recovery prediction event
  window.dispatchEvent(new CustomEvent('recoveryPrediction', {
    detail: recoveryPrediction
  }));
}

// Helper function to convert data to CSV
function convertToCSV(data: any): string {
  if (!data.trajectory) {
    return "No trajectory data available for CSV export";
  }
  
  let csv = "Time,X,Y,Z,Vx,Vy,Vz\n";
  
  data.trajectory.time.forEach((time: number, index: number) => {
    const pos = data.trajectory.position[index] || [0, 0, 0];
    const vel = data.trajectory.velocity[index] || [0, 0, 0];
    csv += `${time},${pos[0]},${pos[1]},${pos[2]},${vel[0]},${vel[1]},${vel[2]}\n`;
  });
  
  return csv;
}

// Helper function to convert data to KML
function convertToKML(data: any): string {
  if (!data.trajectory) {
    return "<?xml version='1.0' encoding='UTF-8'?><kml xmlns='http://www.opengis.net/kml/2.2'><Document><name>No Trajectory Data</name></Document></kml>";
  }
  
  let coordinates = "";
  data.trajectory.position.forEach((pos: number[]) => {
    coordinates += `${pos[1]},${pos[0]},${pos[2]} `;
  });
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${data.rocket.name} Flight Path</name>
    <Placemark>
      <name>Rocket Trajectory</name>
      <LineString>
        <coordinates>${coordinates}</coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;
}

// Professional simulation handler
async function handleProfessionalSimulation(action: any) {
  try {
    const { rocket } = useRocket.getState();
    
    // Use the correct API endpoint
    const endpoint = "/api/simulate";
    
    // Prepare payload
    const payload: {
      rocket: Rocket;
      environment?: any;
      launchParameters?: any;
      fidelity: string;
      [key: string]: any;
    } = {
      rocket,
      fidelity: action.fidelity || "professional",
      environment: action.environment || {
        latitude: 0,
        longitude: 0,
        elevation: 0,
        windSpeed: 0,
        windDirection: 0,
        atmosphericModel: "standard"
      },
      launchParameters: action.launch_parameters || {
        railLength: 5.0,
        inclination: 85.0,
        heading: 0.0
      }
    };
    
    // Add analysis options for professional simulations
    if (action.analysis_options) {
      payload.analysisOptions = action.analysis_options;
    }
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Simulation failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Update simulation state
    useRocket.getState().setSim(result);
    
    showNotification(
      `Professional ${action.fidelity} simulation completed. Max altitude: ${result.maxAltitude?.toFixed(1)}m`,
      "success"
    );
    
  } catch (error) {
    console.error("Professional simulation failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    showNotification(`Simulation failed: ${errorMessage}`, "error");
    
    // Fallback to quick simulation
    runQuickSim();
  }
}

// Stability analysis handler
async function handleStabilityAnalysis(action: any) {
  try {
    const { rocket, sim: currentSim } = useRocket.getState();
    
    const response = await fetch("/api/analyze/stability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rocket,
        environment: action.wind_conditions || {},
        analysisType: "comprehensive"
      })
    });
    
    if (!response.ok) {
      throw new Error(`Analysis failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Update stability analysis state
    useRocket.getState().setStabilityAnalysis(result);
    
    // Also update simulation state with stability data
    const updatedSim: SimulationResult = {
      ...currentSim,
      stabilityAnalysis: result,
      stabilityMargin: result.static_margin || currentSim?.stabilityMargin || 1.0
    };
    
    useRocket.getState().setSim(updatedSim);
    
    showNotification(`Stability analysis completed. Margin: ${result.static_margin?.toFixed(2)}`, "success");
    
  } catch (error) {
    console.error("Stability analysis failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    showNotification(`Stability analysis failed: ${errorMessage}`, "error");
  }
}

// Performance analysis handler
async function handlePerformanceAnalysis(action: any) {
  try {
    const { rocket, sim: currentSim } = useRocket.getState();
    
    const response = await fetch("/api/analyze/performance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rocket,
        environment: action.environment || {},
        analysisType: "comprehensive"
      })
    });
    
    if (!response.ok) {
      throw new Error(`Analysis failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Update simulation state with proper typing
    const updatedSim: SimulationResult = {
      ...currentSim,
      performanceAnalysis: result,
      performanceRating: result.performance_rating
    };
    
    useRocket.getState().setSim(updatedSim);
    
    showNotification(`Performance analysis completed. Rating: ${result.performance_rating}`, "success");
    
  } catch (error) {
    console.error("Performance analysis failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    showNotification(`Performance analysis failed: ${errorMessage}`, "error");
  }
}

// Design optimization handler
async function handleDesignOptimization(action: any) {
  try {
    const { rocket } = useRocket.getState();
    
    const response = await fetch("/api/optimize/design", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rocket,
        target: action.target || "max_altitude",
        constraints: action.constraints || {},
        method: action.method || "professional"
      })
    });
    
    if (!response.ok) {
      throw new Error(`Optimization failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Apply optimized design if available
    if (result.optimized_rocket) {
      useRocket.getState().updateRocket(() => result.optimized_rocket);
    }
    
    // Update simulation with optimization results
    if (result.optimized_performance) {
      useRocket.getState().setSim(result.optimized_performance);
    }
    
    showNotification(
      `Design optimized for ${action.target}. Improvement: ${result.improvements?.altitude_gain?.toFixed(1)}m`,
      "success"
    );
    
  } catch (error) {
    console.error("Design optimization failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    showNotification(`Optimization failed: ${errorMessage}`, "error");
  }
}

// Monte Carlo analysis handler
async function handleMonteCarloAnalysis(action: any) {
  try {
    const { rocket } = useRocket.getState();
    
    const response = await fetch("/api/simulate/monte-carlo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rocket,
        environment: action.environment || {},
        launchParameters: action.launch_parameters || {},
        variations: action.variations || [],
        iterations: action.iterations || 100
      })
    });
    
    if (!response.ok) {
      throw new Error(`Monte Carlo analysis failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    // Update Monte Carlo results in store
    useRocket.getState().setMonteCarloResult(result);
    
    // Update simulation state with nominal results
    if (result.nominal) {
      useRocket.getState().setSim(result.nominal);
    }
    
    showNotification(
      `Monte Carlo analysis completed with ${action.iterations} iterations. Mean altitude: ${result.statistics?.maxAltitude?.mean?.toFixed(1)}m`,
      "success"
    );
    
  } catch (error) {
    console.error("Monte Carlo analysis failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    showNotification(`Monte Carlo analysis failed: ${errorMessage}`, "error");
  }
}

// Environment setup handler
function handleEnvironmentSetup(action: any) {
  // Store environment conditions globally for use in simulations
  window.environmentConditions = {
    latitude: action.latitude || 0,
    longitude: action.longitude || 0,
    elevation: action.elevation || 0,
    windSpeed: action.wind_speed || 0,
    windDirection: action.wind_direction || 0,
    atmosphericModel: action.atmospheric_model || "standard",
    date: action.date,
    // Additional real weather data if available
    temperature: action.temperature,
    pressure: action.pressure,
    humidity: action.humidity,
    visibility: action.visibility,
    cloudCover: action.cloudCover
  };

  // If using forecast model, ensure we have real weather data
  if (action.atmospheric_model === "forecast") {
    // Check if we have real weather data loaded
    const hasRealWeather = window.environmentConditions.temperature !== undefined;
    
    if (hasRealWeather) {
      showNotification(
        `Real weather data active: ${action.wind_speed?.toFixed(1) || 0}m/s wind, ${action.temperature?.toFixed(1) || 'N/A'}°C`,
        "success"
      );
    } else {
      showNotification(
        "Forecast model selected but no real weather data available. Enable location access for accurate conditions.",
        "warning"
      );
    }
  } else {
    showNotification(
      `Environment set: ${action.wind_speed || 0}m/s wind, ${action.atmospheric_model || "standard"} atmosphere`,
      "info"
    );
  }

  // Dispatch event for UI updates
  window.dispatchEvent(new CustomEvent('environmentUpdate', {
    detail: window.environmentConditions
  }));
}

// Motor analysis handler
async function handleMotorAnalysis(action: any) {
  try {
    const response = await fetch("/api/motors/detailed", {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    
    if (!response.ok) {
      throw new Error(`Motor analysis failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    const motorData = result.motors[action.motor_id];
    
    if (!motorData) {
      throw new Error(`Motor ${action.motor_id} not found`);
    }
    
    // Calculate rocket mass for thrust-to-weight ratio
    const { rocket } = useRocket.getState();
    const rocketMass = estimateRocketMass(rocket);
    
    // Update motor analysis state with proper typing
    const motorAnalysis = {
      motor: motorData,
      thrustToWeight: (motorData.averageThrust || motorData.thrust || 0) / (rocketMass * 9.81),
      totalImpulse: motorData.totalImpulse || 0,
      specificImpulse: motorData.specificImpulse || motorData.isp || 0,
      burnTime: motorData.burnTime || 0,
      averageThrust: motorData.averageThrust || motorData.thrust || 0,
      impulseClass: motorData.impulseClass || 'Unknown',
      recommendations: motorData.applications || motorData.recommendations || []
    };
    
    useRocket.getState().setMotorAnalysis(motorAnalysis);
    
    // Update simulation state with motor analysis
    const { sim: currentSim } = useRocket.getState();
    const updatedSim: SimulationResult = {
      ...currentSim,
      motorAnalysis: motorAnalysis
    };
    
    useRocket.getState().setSim(updatedSim);
    
    showNotification(`Motor analysis completed for ${motorData.name || action.motor_id}`, "success");
    
  } catch (error) {
    console.error("Motor analysis failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    showNotification(`Motor analysis failed: ${errorMessage}`, "error");
  }
}

// Flight report handler
function handleFlightReport(action: any) {
  const { rocket, sim } = useRocket.getState();
  
  if (!sim) {
    showNotification("No simulation data available for report generation", "warning");
    return;
  }
  
  const report = generateFlightReport(sim, action);
  
  // Store report for download or display
  window.flightReport = report;
  
  showNotification(`Flight report generated in ${action.report_format || "professional"} format`, "success");
}

// Requirements validation handler
function handleRequirementsValidation(action: any) {
  const { rocket, sim } = useRocket.getState();
  
  if (!sim) {
    showNotification("No simulation data available for validation", "warning");
    return;
  }
  
  const validation = validateRequirements(rocket, sim, action);
  
  // Update simulation state with validation results
  const updatedSim: SimulationResult = {
    ...sim,
    requirementsValidation: validation
  };
  
  useRocket.getState().setSim(updatedSim);
  
  const passedCount = validation.results.filter((r: any) => r.passed).length;
  const totalCount = validation.results.length;
  
  showNotification(
    `Requirements validation: ${passedCount}/${totalCount} requirements met`,
    passedCount === totalCount ? "success" : "warning"
  );
}

// Utility functions
function showNotification(message: string, type: "success" | "error" | "info" | "warning") {
  // Dispatch custom event for notification system
  window.dispatchEvent(new CustomEvent('notification', {
    detail: { message, type }
  }));
}

function generateFlightReport(sim: any, options: any) {
  // Generate comprehensive flight report
  return {
    summary: `Flight reached ${sim.maxAltitude?.toFixed(1)}m altitude`,
    performance: sim,
    recommendations: generateRecommendations(sim),
    format: options.report_format || "professional"
  };
}

function validateRequirements(rocket: any, sim: any, requirements: any) {
  const results = [];
  
  // Safety requirements
  if (requirements.safety_requirements) {
    const safety = requirements.safety_requirements;
    if (safety.min_stability_margin) {
      results.push({
        requirement: "Minimum Stability Margin",
        target: safety.min_stability_margin,
        actual: sim.stabilityMargin,
        passed: sim.stabilityMargin >= safety.min_stability_margin
      });
    }
  }
  
  // Performance requirements
  if (requirements.performance_requirements) {
    const performance = requirements.performance_requirements;
    if (performance.min_altitude) {
      results.push({
        requirement: "Minimum Altitude",
        target: performance.min_altitude,
        actual: sim.maxAltitude,
        passed: sim.maxAltitude >= performance.min_altitude
      });
    }
  }
  
  return {
    results,
    overallPassed: results.every((r: any) => r.passed)
  };
}

function generateRecommendations(sim: any) {
  const recommendations = [];
  
  if (sim.stabilityMargin < 1.0) {
    recommendations.push("Increase fin area or move fins aft for better stability");
  }
  
  if (sim.maxAltitude < 100) {
    recommendations.push("Consider a more powerful motor or reduce rocket mass");
  }
  
  return recommendations;
} 