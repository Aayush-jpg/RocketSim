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
    launchAssessment?: any;
    weatherForecast?: any;
    atmosphericAnalysis?: any;
    launchWindows?: any;
  }
}

// Track if rocket has been modified during action dispatch
let rocketModified = false;
let modificationDescription = '';

// Helper function to validate and fix atmospheric model values
function validateAtmosphericModel(atmosphericModel: any): string {
  // Ensure atmospheric model is one of the valid values
  const validModels = ["standard", "custom", "forecast"];
  
  if (typeof atmosphericModel === "string") {
    const cleanModel = atmosphericModel.toLowerCase().trim();
    
    // Fix common corruptions
    if (cleanModel.includes("standard")) {
      return "standard";
    }
    if (cleanModel.includes("forecast")) {
      return "forecast";
    }
    if (cleanModel.includes("custom")) {
      return "custom";
    }
    
    // Check if it's a valid model
    if (validModels.includes(cleanModel)) {
      return cleanModel;
    }
  }
  
  // Default fallback
  return "standard";
}

// Helper function to clean environment data
function cleanEnvironmentData(environment: any): any {
  if (!environment) {
    return {
      latitude: 0,
      longitude: 0,
      elevation: 0,
      windSpeed: 0,
      windDirection: 0,
      atmosphericModel: "standard"
    };
  }
  
  return {
    ...environment,
    atmosphericModel: validateAtmosphericModel(environment.atmosphericModel)
  };
}

// Function to run a quick simulation (client-side)
export function runQuickSim() {
  const { rocket, setSimulating, setSim, setLastSimulationType } = useRocket.getState();
  
  setSimulating(true);
  setLastSimulationType('quick');
  
  // Simple physics calculation
  setTimeout(() => {
    const mass = rocket.parts.length * 0.1; // Simplified mass calculation
    const thrust = 50; // Simplified thrust
    const altitude = (thrust / mass) * 10; // Very simplified
    
    const result = {
      maxAltitude: altitude + Math.random() * 50,
      maxVelocity: Math.sqrt(2 * 9.81 * altitude),
      apogeeTime: Math.sqrt(2 * altitude / 9.81),
      trajectory: { time: [], position: [], velocity: [], acceleration: [] }, // Proper trajectory structure
      flightEvents: [
        { time: 0, event: 'Liftoff', name: 'Liftoff', altitude: 0 },
        { time: Math.sqrt(2 * altitude / 9.81), event: 'Apogee', name: 'Apogee', altitude }
      ]
    };
    
    setSim(result);
    setSimulating(false);
  }, 1000);
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
  const { 
    updateRocket, 
    setSim, 
    saveRocketVersionWithDescription,
    savedRockets,
    rocket: currentRocket
  } = useRocket.getState();
  
  console.log('🎯 Starting to dispatch actions:', actions);
  console.log('🚀 Current rocket state before actions:', JSON.stringify(currentRocket.parts, null, 2));
  
  // Reset modification tracking
  rocketModified = false;
  modificationDescription = '';
  
  // Check if current rocket is already saved (exists in database)
  const isExistingRocket = savedRockets.some(r => r.id === currentRocket.id);
  
  // Clone the current rocket once for all modifications
  let modifiedRocket = structuredClone(currentRocket);
  let actualChanges = false; // Track if we made actual changes
  
  // CLEAN UP ACTIONS - Fix truncated IDs with "..." AND handle simple names
  const cleanedActions = actions.map(action => {
    if (action.id && typeof action.id === 'string') {
      // Handle truncated IDs with "..."
      if (action.id.endsWith('...')) {
        const truncatedId = action.id.replace('...', '');
        console.log(`🔧 AI truncated ID: "${action.id}" → Looking for prefix: "${truncatedId}"`);
        console.log(`🔧 Available part IDs:`, currentRocket.parts.map(p => `"${p.id}"`));
        
        const realPart = currentRocket.parts.find(part => 
          part.id === truncatedId || part.id.startsWith(truncatedId)
        );
        
        if (realPart) {
          console.log(`✅ Found real part ID: "${realPart.id}" for truncated "${action.id}"`);
          return { ...action, id: realPart.id };
        } else {
          console.warn(`⚠️ NO MATCH FOUND for truncated ID: "${action.id}"`);
          console.warn(`⚠️ Tried prefix: "${truncatedId}"`);
          console.warn(`⚠️ Available parts:`, currentRocket.parts.map(p => ({ id: p.id, type: p.type })));
          
          // Try shorter prefix as fallback (first 8 characters)
          if (truncatedId.length >= 8) {
            const shortPrefix = truncatedId.substring(0, 8);
            console.log(`🔧 Trying shorter prefix: "${shortPrefix}"`);
            const fallbackPart = currentRocket.parts.find(part => part.id.startsWith(shortPrefix));
            if (fallbackPart) {
              console.log(`✅ Found with short prefix: "${fallbackPart.id}"`);
              return { ...action, id: fallbackPart.id };
            }
          }
        }
      }
      
      // Handle simple agent names like "body1", "nose1", "finset1", etc.
      const simpleNamePattern = /^(body|nose|fin|finset)(\d*)$/i;
      const match = action.id.match(simpleNamePattern);
      
      if (match) {
        const partType = match[1].toLowerCase();
        const partIndex = parseInt(match[2] || '1') - 1; // Convert to 0-based index
        
        console.log(`🔧 AI used simple name: "${action.id}" → Looking for ${partType} part at index ${partIndex}`);
        
        // Map part type names
        let targetType = partType;
        if (partType === 'finset') targetType = 'fin';
        
        // Find parts of the target type
        const partsOfType = currentRocket.parts.filter(part => part.type === targetType);
        
        if (partsOfType.length > 0) {
          // Use the specified index, or the first part if index is out of bounds
          const targetPart = partsOfType[Math.min(partIndex, partsOfType.length - 1)];
          console.log(`✅ Mapped simple name "${action.id}" to real part ID: "${targetPart.id}" (type: ${targetPart.type})`);
          return { ...action, id: targetPart.id };
        } else {
          console.warn(`⚠️ No parts of type "${targetType}" found for simple name "${action.id}"`);
        }
      }
      
      // Handle motor updates in update_rocket actions
      if (action.action === 'update_rocket' && action.props && action.props.motorId) {
        console.log(`🚀 Found motor update in rocket action: ${action.props.motorId}`);
        return action; // Pass through as-is
      }
    }
    
    return action;
  });
  
  console.log('🧹 Cleaned actions:', cleanedActions);
  
  cleanedActions.forEach((action, index) => {
    console.log(`🔄 Processing action ${index + 1}/${cleanedActions.length}:`, action);
    
    // Store original state for this action
    const beforeAction = JSON.stringify(modifiedRocket.parts);
    
    switch (action.action) {
      case "add_part":
        console.log(`➕ Adding ${action.type} part with props:`, action.props);
        const newPart: Part = {
          id: crypto.randomUUID(),
          type: action.type,
          color: action.props.color || '#A0A7B8',
          ...action.props
        };
        console.log('➕ New part created:', newPart);
        modifiedRocket.parts.push(newPart);
        rocketModified = true;
        actualChanges = true;
        modificationDescription = `Added ${action.type}${action.props.color ? ` (${action.props.color})` : ''}`;
        break;
        
      case "update_part":
        console.log(`🔧 Updating part ${action.id} with props:`, action.props);
        const part = modifiedRocket.parts.find((p) => p.id === action.id);
        if (part) {
          console.log('🔧 Found part to update:', part);
          console.log('🔧 Props to apply:', action.props);
          
          // Normalize property names - handle diameter symbol
          const normalizedProps = { ...action.props };
          if (normalizedProps.Ø !== undefined) {
            normalizedProps['Ø'] = normalizedProps.Ø; // Keep the symbol
          }
          if (normalizedProps['baseØ'] !== undefined) {
            normalizedProps['baseØ'] = normalizedProps['baseØ']; // Keep for nose parts
          }
          
          // Check if this will actually change anything
          let willChange = false;
          Object.keys(normalizedProps).forEach(key => {
            if (part[key as keyof Part] !== normalizedProps[key]) {
              willChange = true;
              console.log(`🔧 Property ${key} will change: ${part[key as keyof Part]} → ${normalizedProps[key]}`);
            } else {
              console.log(`🔧 Property ${key} unchanged: ${part[key as keyof Part]}`);
            }
          });
          
          if (willChange) {
            Object.assign(part, normalizedProps);
            rocketModified = true;
            actualChanges = true;
            modificationDescription = `Modified ${part.type}${normalizedProps.color ? ` color to ${normalizedProps.color}` : ''}`;
            console.log('🔧 Part after update:', part);
          } else {
            console.log('🔧 No actual changes needed for this part');
          }
        } else {
          console.warn('🔧 Part not found with ID:', action.id);
          console.warn('🔧 Available parts:', modifiedRocket.parts.map(p => ({ id: p.id, type: p.type })));
          
          // Try fuzzy matching as backup
          const fuzzyMatch = modifiedRocket.parts.find(p => 
            p.id.includes(action.id) || action.id.includes(p.id)
          );
          if (fuzzyMatch) {
            console.log('🔍 Fuzzy match found:', fuzzyMatch.id);
            Object.assign(fuzzyMatch, action.props);
            rocketModified = true;
            actualChanges = true;
            modificationDescription = `Modified ${fuzzyMatch.type} (fuzzy match)`;
          }
        }
        break;
        
      case "remove_part":
        console.log(`🗑️ Removing part ${action.id}`);
        const partIndex = modifiedRocket.parts.findIndex((p) => p.id === action.id);
        if (partIndex !== -1) {
          const removedPart = modifiedRocket.parts[partIndex];
          modificationDescription = `Removed ${removedPart.type}`;
          console.log('🗑️ Removing part:', removedPart);
          modifiedRocket.parts.splice(partIndex, 1);
          rocketModified = true;
          actualChanges = true;
        } else {
          console.warn('🗑️ Part not found for removal with ID:', action.id);
        }
        break;
        
      case "change_motor":
        console.log(`🚀 Changing motor to:`, action.motorId);
        if (modifiedRocket.motorId !== action.motorId) {
          modifiedRocket.motorId = action.motorId;
          rocketModified = true;
          actualChanges = true;
          modificationDescription = `Changed motor to ${action.motorId}`;
        } else {
          console.log('🚀 Motor already set to this value');
        }
        break;
        
      case "update_rocket":
        console.log(`🔧 Updating rocket with:`, action);
        let rocketChanged = false;
        if (action.name && modifiedRocket.name !== action.name) {
          modifiedRocket.name = action.name;
          rocketChanged = true;
        }
        if (action.Cd !== undefined && modifiedRocket.Cd !== action.Cd) {
          modifiedRocket.Cd = action.Cd;
          rocketChanged = true;
        }
        if (action.units && modifiedRocket.units !== action.units) {
          modifiedRocket.units = action.units;
          rocketChanged = true;
        }
        // Handle motorId updates from agent
        if (action.props && action.props.motorId && modifiedRocket.motorId !== action.props.motorId) {
          console.log(`🚀 Updating motor from ${modifiedRocket.motorId} to ${action.props.motorId}`);
          modifiedRocket.motorId = action.props.motorId;
          rocketChanged = true;
          modificationDescription = `Changed motor to ${action.props.motorId}`;
        }
        if (rocketChanged) {
          rocketModified = true;
          actualChanges = true;
          if (!modificationDescription) {
            modificationDescription = action.description || 'Updated rocket configuration';
          }
        }
        break;
        
      case "run_sim":
        // Simulations don't modify the rocket design
        console.log(`📊 Running simulation with fidelity:`, action.fidelity);
        if (action.fidelity === "quick") {
          runQuickSim();
        } else {
          runHighFiSim();
        }
        break;
        
      default:
        console.warn(`❓ Unknown action:`, action.action);
    }
    
    // Check if this action actually changed anything
    const afterAction = JSON.stringify(modifiedRocket.parts);
    const actionMadeChange = beforeAction !== afterAction;
    console.log(`🔍 Action ${index + 1} made changes:`, actionMadeChange);
    if (actionMadeChange) {
      actualChanges = true;
    }
  });
  
  console.log('🏁 Action processing complete:');
  console.log('📊 Rocket was flagged as modified:', rocketModified);
  console.log('📊 Actual changes detected:', actualChanges);
  console.log('📊 Original parts count:', currentRocket.parts.length);
  console.log('📊 Modified parts count:', modifiedRocket.parts.length);
  
  // Only proceed if we have actual changes
  if (actualChanges && rocketModified) {
    console.log('🔄 Applying rocket modifications...');
    console.log('🚀 Modified rocket parts:', JSON.stringify(modifiedRocket.parts, null, 2));
    
    // FORCE EVENT DISPATCH to notify MiddlePanel for force re-render
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rocketActionsDispatched', {
        detail: { 
          actionsCount: actions.length,
          modifications: modificationDescription,
          partsCount: modifiedRocket.parts.length 
        }
      }));
      console.log('📡 Dispatched rocketActionsDispatched event');
    }
    
    // Store original state for comparison
    const originalPartsJson = JSON.stringify(currentRocket.parts);
    const modifiedPartsJson = JSON.stringify(modifiedRocket.parts);
    
    console.log('🔍 Final comparison:');
    console.log('📄 Original vs Modified different:', originalPartsJson !== modifiedPartsJson);
    
    // AGGRESSIVE UPDATE - Force React to see this as a completely new object
    updateRocket(() => {
      // Create completely new objects with new references
      const newRocket = {
        ...modifiedRocket,
        id: modifiedRocket.id, // Keep same ID
        parts: modifiedRocket.parts.map(part => ({ ...part })), // New part objects
        // Add a timestamp to force reference change
        _lastModified: Date.now()
      };
      console.log('🔄 Returning completely new rocket object with', newRocket.parts.length, 'parts');
      return newRocket;
    }, true); // Skip auto-save initially
    
    // FORCE IMMEDIATE VERIFICATION - No timeout delay
    const finalRocketState = useRocket.getState().rocket;
    const finalPartsJson = JSON.stringify(finalRocketState.parts);
    const finalPartsCount = finalRocketState.parts.length;
    
    console.log('🏁 IMMEDIATE Verification:');
    console.log('📊 Final parts count:', finalPartsCount);
    console.log('📊 Original parts count:', currentRocket.parts.length);
    console.log('📊 Final vs Original JSON different:', finalPartsJson !== originalPartsJson);
    console.log('✅ Update verification:', finalPartsJson !== originalPartsJson || finalPartsCount !== currentRocket.parts.length);
    
    // ALWAYS FORCE A SECOND UPDATE to ensure React sees the change
    setTimeout(() => {
      console.log('🔄 SECOND FORCE UPDATE to ensure React re-renders');
      const doubleCheckState = useRocket.getState().rocket;
      updateRocket(() => {
        return {
          ...doubleCheckState,
          _forceUpdate: Date.now() // Force another reference change
        };
      }, false); // Allow auto-save on second update
      
      // Database handling after forced updates
      if (isExistingRocket) {
        console.log('💾 Creating new version for existing rocket:', modificationDescription);
        saveRocketVersionWithDescription(
          `AI ${actions[0]?.action || 'modification'}: ${modificationDescription}`,
          actions[0]?.action || 'ai_modification'
        );
      } else {
        console.log('💾 Saving new rocket after modifications:', modificationDescription);
        useRocket.getState().saveCurrentRocket();
      }
    }, 50);
    
  } else {
    console.log('ℹ️ No actual rocket modifications detected - skipping update');
    console.log('🔍 Debug info:');
    console.log('   - rocketModified flag:', rocketModified);
    console.log('   - actualChanges detected:', actualChanges);
    console.log('   - Actions processed:', actions.length);
    actions.forEach((action, i) => {
      console.log(`   - Action ${i + 1}:`, action.action, action);
    });
    
    // If we have non-modifying actions (like simulations), still process them
    if (actions.some(a => a.action === 'run_sim')) {
      console.log('📊 Processing simulation actions without rocket modifications');
    }
  }
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
async function handleMonteCarloAnalysis(action: any) {
  try {
    const { rocket } = useRocket.getState();
    
    // Clean and validate environment data
    const cleanEnvironment = cleanEnvironmentData(action.environment);
    
    const response = await fetch("/api/simulate/monte-carlo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rocket,
        environment: cleanEnvironment,
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
      `Monte Carlo analysis completed with ${action.iterations} iterations. Mean altitude: ${(result.statistics?.maxAltitude?.mean ?? 0).toFixed(1)}m`,
      "success"
    );
    
  } catch (error) {
    console.error("Monte Carlo analysis failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    showNotification(`Monte Carlo analysis failed: ${errorMessage}`, "error");
  }
}

// Monte Carlo analysis function (export for external use)
export async function runMonteCarloAnalysis(params: any) {
  return handleMonteCarloAnalysis(params);
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
    
    // Clean and validate environment data
    const cleanEnvironment = cleanEnvironmentData(action.environment || {
      latitude: 0,
      longitude: 0,
      elevation: 0,
      windSpeed: 0,
      windDirection: 0,
      atmosphericModel: "standard"
    });
    
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
      environment: cleanEnvironment,
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

// Environment setup handler
function handleEnvironmentSetup(action: any) {
  // Store environment conditions globally for use in simulations
  window.environmentConditions = {
    latitude: action.latitude || 0,
    longitude: action.longitude || 0,
    elevation: action.elevation || 0,
    windSpeed: action.wind_speed || 0,
    windDirection: action.wind_direction || 0,
    atmosphericModel: validateAtmosphericModel(action.atmospheric_model || "standard"),
    date: action.date,
    // Additional real weather data if available
    temperature: action.temperature,
    pressure: action.pressure,
    humidity: action.humidity,
    visibility: action.visibility,
    cloudCover: action.cloudCover
  };

  // If using forecast model, ensure we have real weather data
  if (window.environmentConditions.atmosphericModel === "forecast") {
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
      `Environment set: ${action.wind_speed || 0}m/s wind, ${window.environmentConditions.atmosphericModel} atmosphere`,
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

// Weather-related handlers
async function handleGetWeather(action: any) {
  console.log('🌤️ Getting weather data...');
  
  try {
    const { latitude, longitude, use_user_location } = action;
    
    // Import weather service if not already available
    const { getCurrentWeather, requestLocationPermission } = await import('../services/weather');
    
    let location = null;
    if (use_user_location) {
      // Request user location
      location = await requestLocationPermission();
      showNotification('Location permission granted. Fetching weather...', 'info');
    } else if (latitude && longitude) {
      location = { latitude, longitude, elevation: 0 };
    }
    
    if (location) {
      const weather = await getCurrentWeather(location);
      
      // Store weather data globally for access by agents and UI
      window.environmentConditions = {
        ...window.environmentConditions,
        latitude: location.latitude,
        longitude: location.longitude,
        elevation: location.elevation,
        temperature: weather.current.temperature,
        pressure: weather.current.pressure,
        humidity: weather.current.humidity,
        windSpeed: weather.current.windSpeed,
        windDirection: weather.current.windDirection,
        visibility: weather.current.visibility,
        cloudCover: weather.current.cloudCover,
        dewPoint: weather.current.dewPoint,
        atmosphericModel: "forecast",
        weatherSource: weather.current.source,
        timestamp: weather.current.timestamp
      };
      
      // Dispatch weather update event
      window.dispatchEvent(new CustomEvent('weatherUpdate', {
        detail: { weather, location }
      }));
      
      showNotification(
        `Weather loaded: ${weather.current.temperature}°C, ${weather.current.windSpeed}m/s wind`,
        'success'
      );
    } else {
      showNotification('Unable to get location for weather data', 'warning');
    }
  } catch (error) {
    console.error('Weather fetch failed:', error);
    showNotification('Failed to get weather data', 'error');
  }
}

async function handleAssessLaunchConditions(action: any) {
  console.log('🚀 Assessing launch conditions...');
  
  const { include_weather, safety_level, mission_type } = action;
  
  // Get current environment conditions
  const envConditions = window.environmentConditions;
  
  if (!envConditions || !include_weather) {
    showNotification('No weather data available. Enable location for accurate assessment.', 'warning');
    return;
  }
  
  // Assess conditions based on safety level
  const conditions = {
    windSpeed: envConditions.windSpeed || 0,
    visibility: envConditions.visibility || 10,
    temperature: envConditions.temperature || 20,
    humidity: envConditions.humidity || 50,
    cloudCover: envConditions.cloudCover || 0,
    precipitation: 0 // This would come from weather API
  };
  
  // Define safety thresholds based on safety level
  const thresholds = {
    basic: { maxWind: 15, minVisibility: 3, tempRange: [-20, 50] },
    standard: { maxWind: 10, minVisibility: 5, tempRange: [-10, 40] },
    strict: { maxWind: 5, minVisibility: 10, tempRange: [0, 30] }
  };
  
  const threshold = thresholds[safety_level as keyof typeof thresholds] || thresholds.standard;
  
  // Assess each condition
  const assessments = {
    wind: conditions.windSpeed <= threshold.maxWind,
    visibility: conditions.visibility >= threshold.minVisibility,
    temperature: conditions.temperature >= threshold.tempRange[0] && conditions.temperature <= threshold.tempRange[1],
    safe: true
  };
  
  assessments.safe = assessments.wind && assessments.visibility && assessments.temperature;
  
  // Generate recommendation
  let recommendation = '';
  let status = '';
  
  if (assessments.safe) {
    status = 'SAFE';
    recommendation = `🟢 CONDITIONS ARE SAFE FOR LAUNCH\n${conditions.windSpeed}m/s wind, ${conditions.visibility}km visibility, ${conditions.temperature}°C`;
  } else {
    status = 'UNSAFE';
    const issues = [];
    if (!assessments.wind) issues.push(`High wind: ${conditions.windSpeed}m/s (max ${threshold.maxWind}m/s)`);
    if (!assessments.visibility) issues.push(`Poor visibility: ${conditions.visibility}km (min ${threshold.minVisibility}km)`);
    if (!assessments.temperature) issues.push(`Temperature out of range: ${conditions.temperature}°C`);
    
    recommendation = `🔴 UNSAFE LAUNCH CONDITIONS\n${issues.join('\n')}`;
  }
  
  // Store assessment
  window.launchAssessment = { assessments, conditions, recommendation, status, timestamp: new Date().toISOString() };
  
  // Dispatch assessment event
  window.dispatchEvent(new CustomEvent('launchAssessment', {
    detail: { assessments, conditions, recommendation, status }
  }));
  
  showNotification(recommendation, assessments.safe ? 'success' : 'warning');
}

async function handleGetForecast(action: any) {
  console.log('📊 Getting weather forecast...');
  
  try {
    const { hours_ahead, include_wind_profile, location_override } = action;
    
    // Import weather service
    const { getWeatherForDate } = await import('../services/weather');
    
    const targetDate = new Date();
    targetDate.setHours(targetDate.getHours() + (hours_ahead || 24));
    
    let location = location_override || null;
    if (!location && window.environmentConditions) {
      location = {
        latitude: window.environmentConditions.latitude,
        longitude: window.environmentConditions.longitude,
        elevation: window.environmentConditions.elevation || 0
      };
    }
    
    if (location) {
      const forecast = await getWeatherForDate(targetDate, location);
      
      // Store forecast data
      window.weatherForecast = forecast;
      
      // Dispatch forecast event
      window.dispatchEvent(new CustomEvent('weatherForecast', {
        detail: { forecast, hours_ahead }
      }));
      
      showNotification(`Forecast loaded for next ${hours_ahead || 24} hours`, 'success');
    } else {
      showNotification('Location required for weather forecast', 'warning');
    }
  } catch (error) {
    console.error('Forecast fetch failed:', error);
    showNotification('Failed to get weather forecast', 'error');
  }
}

function handleAnalyzeAtmosphere(action: any) {
  console.log('🌍 Analyzing atmospheric conditions...');
  
  const { max_altitude, include_wind_shear, density_altitude } = action;
  const rocket = useRocket.getState().rocket;
  const envConditions = window.environmentConditions;
  
  if (!envConditions) {
    showNotification('Weather data required for atmospheric analysis', 'warning');
    return;
  }
  
  // Basic atmospheric analysis
  const analysis: any = {
    surfacePressure: envConditions.pressure || 1013.25,
    surfaceTemperature: envConditions.temperature || 15,
    surfaceDensity: calculateAirDensity(envConditions.pressure || 1013.25, envConditions.temperature || 15),
    windSpeed: envConditions.windSpeed || 0,
    windDirection: envConditions.windDirection || 0,
    visibility: envConditions.visibility || 10
  };
  
  if (density_altitude) {
    // Calculate density altitude effect on performance
    const densityAltitude = calculateDensityAltitude(analysis.surfacePressure, analysis.surfaceTemperature);
    analysis.densityAltitude = densityAltitude;
    analysis.performanceEffect = densityAltitude > 1000 ? 'reduced' : 'normal';
  }
  
  // Store analysis
  window.atmosphericAnalysis = analysis;
  
  // Dispatch analysis event
  window.dispatchEvent(new CustomEvent('atmosphericAnalysis', {
    detail: analysis
  }));
  
  showNotification(`Atmospheric analysis complete. Density altitude: ${analysis.densityAltitude?.toFixed(0) || 'N/A'}m`, 'info');
}

async function handleRecommendLaunchWindow(action: any) {
  console.log('⏰ Recommending launch window...');
  
  const { duration_hours, min_conditions, preferred_conditions } = action;
  
  try {
    // Import weather service
    const { getWeatherForDate } = await import('../services/weather');
    
    const now = new Date();
    const windows = [];
    
    // Check conditions for each hour in the duration
    for (let hour = 0; hour < (duration_hours || 6); hour++) {
      const checkTime = new Date(now.getTime() + hour * 60 * 60 * 1000);
      
      try {
        let location = null;
        if (window.environmentConditions) {
          location = {
            latitude: window.environmentConditions.latitude,
            longitude: window.environmentConditions.longitude,
            elevation: window.environmentConditions.elevation || 0
          };
        }
        
        if (location) {
          const weather = await getWeatherForDate(checkTime, location);
          
          // Check against minimum conditions
          const meetsMin = weather.current.windSpeed <= (min_conditions?.max_wind_speed || 10) &&
                          weather.current.visibility >= (min_conditions?.min_visibility || 5);
          
          // Check against preferred conditions
          const meetsPreferred = weather.current.windSpeed <= (preferred_conditions?.max_wind_speed || 5) &&
                                weather.current.visibility >= (preferred_conditions?.min_visibility || 10) &&
                                weather.current.cloudCover <= (preferred_conditions?.max_cloud_cover || 25);
          
          windows.push({
            time: checkTime,
            weather: weather.current,
            meetsMin,
            meetsPreferred,
            score: calculateLaunchScore(weather.current, preferred_conditions)
          });
        }
      } catch (error) {
        console.warn(`Weather check failed for hour ${hour}:`, error);
      }
    }
    
    // Find best windows
    const goodWindows = windows.filter(w => w.meetsMin).sort((a, b) => b.score - a.score);
    
    // Store recommendations
    window.launchWindows = { windows, recommendations: goodWindows.slice(0, 3) };
    
    // Dispatch recommendations event
    window.dispatchEvent(new CustomEvent('launchWindows', {
      detail: { windows, recommendations: goodWindows.slice(0, 3) }
    }));
    
    if (goodWindows.length > 0) {
      const bestWindow = goodWindows[0];
      const timeStr = bestWindow.time.toLocaleTimeString();
      showNotification(`Best launch window: ${timeStr} (${bestWindow.weather.windSpeed}m/s wind)`, 'success');
    } else {
      showNotification('No suitable launch windows found in the next few hours', 'warning');
    }
  } catch (error) {
    console.error('Launch window analysis failed:', error);
    showNotification('Failed to analyze launch windows', 'error');
  }
}

function handleSetLocation(action: any) {
  console.log('📍 Setting launch location...');
  
  const { latitude, longitude, elevation, name } = action;
  
  // Validate coordinates
  if (!latitude || !longitude || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    showNotification('Invalid coordinates provided', 'error');
    return;
  }
  
  // Update environment conditions
  window.environmentConditions = {
    ...window.environmentConditions,
    latitude,
    longitude,
    elevation: elevation || 0,
    locationName: name || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
  };
  
  // Dispatch location update event
  window.dispatchEvent(new CustomEvent('locationUpdate', {
    detail: { latitude, longitude, elevation, name }
  }));
  
  showNotification(`Location set: ${name || 'Custom location'}`, 'success');
}

// Helper functions for atmospheric calculations
function calculateAirDensity(pressure: number, temperature: number): number {
  // Using ideal gas law: ρ = P / (R * T)
  const R = 287.05; // Specific gas constant for dry air (J/kg·K)
  const tempK = temperature + 273.15; // Convert to Kelvin
  const pressurePa = pressure * 100; // Convert hPa to Pa
  return pressurePa / (R * tempK);
}

function calculateDensityAltitude(pressure: number, temperature: number): number {
  // Standard atmosphere at sea level
  const stdPressure = 1013.25; // hPa
  const stdTemp = 15; // °C
  
  // Calculate pressure altitude
  const pressureAltitude = (1 - Math.pow(pressure / stdPressure, 0.190284)) * 145366.45;
  
  // Calculate density altitude
  const tempK = temperature + 273.15;
  const stdTempK = stdTemp + 273.15;
  const densityAltitude = pressureAltitude + (120 * (tempK - stdTempK));
  
  return densityAltitude * 0.3048; // Convert feet to meters
}

function calculateLaunchScore(weather: any, preferences: any): number {
  let score = 100;
  
  // Wind penalty
  const maxWind = preferences?.max_wind_speed || 5;
  if (weather.windSpeed > maxWind) {
    score -= (weather.windSpeed - maxWind) * 10;
  }
  
  // Visibility bonus
  const minVisibility = preferences?.min_visibility || 10;
  if (weather.visibility >= minVisibility) {
    score += 10;
  }
  
  // Cloud cover penalty
  const maxClouds = preferences?.max_cloud_cover || 25;
  if (weather.cloudCover > maxClouds) {
    score -= (weather.cloudCover - maxClouds) * 0.5;
  }
  
  // Temperature range
  const tempRange = preferences?.temperature_range || [5, 30];
  if (weather.temperature < tempRange[0] || weather.temperature > tempRange[1]) {
    score -= 20;
  }
  
  return Math.max(0, score);
} 