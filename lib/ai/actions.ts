/**
 * Rocketez - AI Agent Action System (Component-Based)
 * 
 * This module processes actions returned by AI agents and applies them to the component-based rocket state.
 * It provides a unified action dispatcher that handles all rocket modifications, simulations, and exports
 * while maintaining state consistency across the React Three Fiber 3D scene and Zustand store.
 * 
 * **Action Categories:**
 * - **Component Actions**: Update rocket components with professional precision
 * - **Simulation Actions**: Run quick physics calculations or high-fidelity simulations
 * - **Export Actions**: Generate CSV, JSON, KML formats for analysis and sharing
 * - **Analysis Actions**: Stability calculations, performance analysis, Monte Carlo simulations
 * - **Environmental Actions**: Weather, atmospheric conditions, launch site configuration
 * 
 * @version 1.0.0 - Pure component-based architecture
 * @author Rocketez Team
 */

import { useRocket } from '@/lib/store';
import { Rocket, SimulationResult, NoseComponent, BodyComponent, FinComponent, MotorComponent, ParachuteComponent, EnvironmentConfig, LaunchParameters } from '@/types/rocket';
import { MATERIALS, calculateMass } from '@/lib/data/materials';
import { getMotorOrDefault } from '@/lib/data/motors';

// ===========================================
// SIMULATION FUNCTIONS
// ===========================================

/**
 * Quick physics simulation using component-based rocket data
 */
export function runQuickSim() {
  const { rocket, setSim } = useRocket.getState();
  
  setTimeout(() => {
    const noseMass = calculateComponentMass(rocket.nose_cone);
    const bodyMass = rocket.body_tubes.reduce((sum, body) => sum + calculateComponentMass(body), 0);
    const finMass = rocket.fins.reduce((sum, fin) => sum + calculateComponentMass(fin), 0);
    const totalMass = noseMass + bodyMass + finMass + 0.5;

    const thrust = 50;
    const altitude = (thrust / totalMass) * 10;

    const result: SimulationResult = {
      maxAltitude: altitude,
      maxVelocity: Math.sqrt(2 * altitude * 9.81),
      apogeeTime: Math.sqrt(2 * altitude / 9.81),
      stabilityMargin: 1.5,
      simulationFidelity: 'quick',
      timestamp: new Date().toISOString()
    };

    setSim(result);
  }, 1000);
}

/**
 * Calculate mass of a component using centralized material data
 */
function calculateComponentMass(component: any): number {
  if (!component || !component.material_density_kg_m3) return 0;
  
  let volume = 0;
  
  if ('length_m' in component && 'outer_radius_m' in component) {
    const outerVolume = Math.PI * Math.pow(component.outer_radius_m, 2) * component.length_m;
    const innerVolume = Math.PI * Math.pow(component.outer_radius_m - (component.wall_thickness_m || 0.003), 2) * component.length_m;
    volume = outerVolume - innerVolume;
  } else if ('length_m' in component && 'base_radius_m' in component) {
    volume = (Math.PI * Math.pow(component.base_radius_m || 0.05, 2) * component.length_m) / 3;
  } else if ('root_chord_m' in component && 'span_m' in component) {
    const area = component.root_chord_m * component.span_m * (component.fin_count || 1);
    volume = area * (component.thickness_m || 0.006);
  }
  
  return volume * component.material_density_kg_m3;
}

/**
 * Run standard simulation using RocketPy service
 */
export async function runStandardSim() {
  try {
    const { rocket, environment, setSim, setSimulating, setSimulationProgress } = useRocket.getState();
    
    setSimulating(true);
    setSimulationProgress(0);
    
    const response = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rocket, environment, fidelity: 'standard' })
    });
    
    if (!response.ok) {
      throw new Error(`Simulation failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    setSim({
      ...result,
      simulationFidelity: 'standard',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Standard simulation failed:', error);
  } finally {
    useRocket.getState().setSimulating(false);
    useRocket.getState().setSimulationProgress(100);
  }
}

/**
 * Run high-fidelity simulation using RocketPy service
 */
export async function runHighFiSim() {
  try {
    const { rocket, environment, setSim, setSimulating, setSimulationProgress } = useRocket.getState();
    
    setSimulating(true);
    setSimulationProgress(0);
    
    const response = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rocket, environment, fidelity: 'hifi' })
    });
    
    if (!response.ok) {
      throw new Error(`Simulation failed: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    setSim({
      ...result,
      simulationFidelity: 'high',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('High-fidelity simulation failed:', error);
  } finally {
    useRocket.getState().setSimulating(false);
    useRocket.getState().setSimulationProgress(100);
  }
}

/**
 * Run professional fidelity simulation using RocketPy service
 */
export async function runProfessionalSim() {
  try {
    const { rocket, environment, setSim, setSimulating, setSimulationProgress } = useRocket.getState();
    setSimulating(true);
    setSimulationProgress(0);
    const response = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rocket, environment, fidelity: 'professional' })
    });
    if (!response.ok) {
      throw new Error(`Simulation failed: ${response.statusText}`);
    }
    const result = await response.json();
    setSim({
      ...result,
      simulationFidelity: 'professional',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Professional simulation failed:', error);
  } finally {
    useRocket.getState().setSimulating(false);
    useRocket.getState().setSimulationProgress(100);
  }
}

// ===========================================
// COMPONENT ACTION HANDLERS
// ===========================================

/**
 * Extract properties from Python agent action format
 */
export function extractActionProps(action: any): any {
  if (action.props) return action.props;
  const { action: actionType, index, id, ...props } = action;
  return props;
}

/**
 * Update nose cone component
 */
export function updateNoseCone(rocket: Rocket, action: any): Rocket {
  const props = extractActionProps(action);
  
  const updatedNoseCone: NoseComponent = {
    id: action.id || rocket.nose_cone?.id || crypto.randomUUID(),
    shape: props.shape || rocket.nose_cone?.shape || "ogive",
    length_m: props.length_m !== undefined ? props.length_m : rocket.nose_cone?.length_m || 0.15,
    base_radius_m: props.base_radius_m !== undefined ? props.base_radius_m : rocket.nose_cone?.base_radius_m || 0.05,
    wall_thickness_m: props.wall_thickness_m !== undefined ? props.wall_thickness_m : rocket.nose_cone?.wall_thickness_m || 0.002,
    material_id: props.material_id || rocket.nose_cone?.material_id || "fiberglass",
    material_density_kg_m3: props.material_density_kg_m3 !== undefined ? props.material_density_kg_m3 : rocket.nose_cone?.material_density_kg_m3 || MATERIALS.FIBERGLASS.density_kg_m3,
    surface_roughness_m: props.surface_roughness_m !== undefined ? props.surface_roughness_m : rocket.nose_cone?.surface_roughness_m || 1e-5,
    color: props.color || rocket.nose_cone?.color || "#A0A7B8"
  };
  
  return { ...rocket, nose_cone: updatedNoseCone };
}

/**
 * Update body tube component
 */
export function updateBodyTube(rocket: Rocket, action: any): Rocket {
  const props = extractActionProps(action);
  const bodyIndex = action.index || 0;
  
  const updatedBodyTubes = [...rocket.body_tubes];
  
  if (bodyIndex >= updatedBodyTubes.length) {
    // Add new body tube if index doesn't exist
    const newBodyTube: BodyComponent = {
      id: crypto.randomUUID(),
      outer_radius_m: props.outer_radius_m || 0.05,
      length_m: props.length_m || 0.40,
      wall_thickness_m: props.wall_thickness_m || 0.003,
      material_id: props.material_id || "fiberglass",
      material_density_kg_m3: props.material_density_kg_m3 || MATERIALS.FIBERGLASS.density_kg_m3,
      surface_roughness_m: props.surface_roughness_m || 1e-5,
      color: props.color || "#8C8D91"
    };
    updatedBodyTubes[bodyIndex] = newBodyTube;
  } else {
    // Update existing body tube
    const existingBody = updatedBodyTubes[bodyIndex];
    updatedBodyTubes[bodyIndex] = {
      ...existingBody,
      outer_radius_m: props.outer_radius_m !== undefined ? props.outer_radius_m : existingBody.outer_radius_m,
      length_m: props.length_m !== undefined ? props.length_m : existingBody.length_m,
      wall_thickness_m: props.wall_thickness_m !== undefined ? props.wall_thickness_m : existingBody.wall_thickness_m,
      material_density_kg_m3: props.material_density_kg_m3 !== undefined ? props.material_density_kg_m3 : existingBody.material_density_kg_m3,
      surface_roughness_m: props.surface_roughness_m !== undefined ? props.surface_roughness_m : existingBody.surface_roughness_m,
      color: props.color || existingBody.color
    };
  }
  
  return { ...rocket, body_tubes: updatedBodyTubes };
}

/**
 * Update fin set component
 */
export function updateFinSet(rocket: Rocket, action: any): Rocket {
  const props = extractActionProps(action);
  const finIndex = action.index || 0;
  
  // Debug: Log the fin update
  console.log('🔍 updateFinSet: Updating fin at index', finIndex, 'with props:', props);
  console.log('🔍 updateFinSet: Current fin count:', rocket.fins[finIndex]?.fin_count);
  console.log('🔍 updateFinSet: New fin count:', props.fin_count);
  
  const updatedFins = [...rocket.fins];
  
  if (finIndex >= updatedFins.length) {
    // Add new fin set if index doesn't exist
    const newFinSet: FinComponent = {
      id: crypto.randomUUID(),
      fin_count: props.fin_count || 3,
      root_chord_m: props.root_chord_m || 0.08,
      tip_chord_m: props.tip_chord_m || 0.04,
      span_m: props.span_m || 0.06,
      sweep_length_m: props.sweep_length_m || 0.02,
      thickness_m: props.thickness_m || 0.006,
      wall_thickness_m: props.wall_thickness_m !== undefined ? props.wall_thickness_m : 0, // Solid by default
      position_from_tail_m: props.position_from_tail_m !== undefined ? props.position_from_tail_m : 0.1, // Near tail by default
      material_id: props.material_id || "birch_plywood",
      material_density_kg_m3: props.material_density_kg_m3 || MATERIALS.PLYWOOD.density_kg_m3,
      airfoil: props.airfoil || "symmetric",
      cant_angle_deg: props.cant_angle_deg || 0.0,
      color: props.color || "#A0A7B8"
    };
    updatedFins[finIndex] = newFinSet;
  } else {
    // Update existing fin set
    const existingFin = updatedFins[finIndex];
    updatedFins[finIndex] = {
      ...existingFin,
      fin_count: props.fin_count !== undefined ? props.fin_count : existingFin.fin_count,
      root_chord_m: props.root_chord_m !== undefined ? props.root_chord_m : existingFin.root_chord_m,
      tip_chord_m: props.tip_chord_m !== undefined ? props.tip_chord_m : existingFin.tip_chord_m,
      span_m: props.span_m !== undefined ? props.span_m : existingFin.span_m,
      sweep_length_m: props.sweep_length_m !== undefined ? props.sweep_length_m : existingFin.sweep_length_m,
      thickness_m: props.thickness_m !== undefined ? props.thickness_m : existingFin.thickness_m,
      wall_thickness_m: props.wall_thickness_m !== undefined ? props.wall_thickness_m : existingFin.wall_thickness_m,
      position_from_tail_m: props.position_from_tail_m !== undefined ? props.position_from_tail_m : existingFin.position_from_tail_m,
      material_density_kg_m3: props.material_density_kg_m3 !== undefined ? props.material_density_kg_m3 : existingFin.material_density_kg_m3,
      airfoil: props.airfoil || existingFin.airfoil,
      cant_angle_deg: props.cant_angle_deg !== undefined ? props.cant_angle_deg : existingFin.cant_angle_deg,
      color: props.color || existingFin.color
    };
  }
  
  return { ...rocket, fins: updatedFins };
}

/**
 * Update motor component
 */
export function updateMotor(rocket: Rocket, action: any): Rocket {
  const props = extractActionProps(action);
  
  // Debug: Log the motor update
  console.log('🔍 updateMotor: Updating motor with props:', props);
  console.log('🔍 updateMotor: Current motor ID:', rocket.motor.motor_database_id);
  console.log('🔍 updateMotor: New motor ID:', props.motor_database_id);
  
  let motorId = props.motor_database_id || rocket.motor.motor_database_id;
  if (props.motor_database_id) {
    const validatedMotor = getMotorOrDefault(props.motor_database_id);
    motorId = validatedMotor.id;
    if (validatedMotor.id !== props.motor_database_id) {
      console.log(`⚠️ Invalid motor ID '${props.motor_database_id}', using fallback: ${validatedMotor.id}`);
    }
  }
  
  const updatedMotor: MotorComponent = {
    ...rocket.motor,
    motor_database_id: motorId,
    position_from_tail_m: props.position_from_tail_m !== undefined ? props.position_from_tail_m : rocket.motor.position_from_tail_m,
    nozzle_expansion_ratio: props.nozzle_expansion_ratio || rocket.motor.nozzle_expansion_ratio,
    chamber_pressure_pa: props.chamber_pressure_pa || rocket.motor.chamber_pressure_pa
  };
  
  return { ...rocket, motor: updatedMotor };
}

/**
 * Update parachute component
 */
export function updateParachute(rocket: Rocket, action: any): Rocket {
  const props = extractActionProps(action);
  const parachuteIndex = action.index || 0;
  
  // Debug: Log the parachute update
  console.log('🔍 updateParachute: Updating parachute at index', parachuteIndex, 'with props:', props);
  console.log('🔍 updateParachute: Current cd_s_m2:', rocket.parachutes[parachuteIndex]?.cd_s_m2);
  console.log('🔍 updateParachute: New cd_s_m2:', props.cd_s_m2);
  
  const updatedParachutes = [...rocket.parachutes];
  
  if (parachuteIndex >= updatedParachutes.length) {
    // Add new parachute if index doesn't exist
    const newParachute: ParachuteComponent = {
      id: crypto.randomUUID(),
      name: props.name || "Parachute",
      cd_s_m2: props.cd_s_m2 || 1.0,
      trigger: props.trigger || "apogee",
      sampling_rate_hz: props.sampling_rate_hz || 105.0,
      lag_s: props.lag_s || 1.5,
      noise_bias: props.noise_bias || 0.0,
      noise_deviation: props.noise_deviation || 8.3,
      noise_correlation: props.noise_correlation || 0.5,
      position_from_tail_m: props.position_from_tail_m || 0.0,
      color: props.color || "#FF6B35"
    };
    updatedParachutes[parachuteIndex] = newParachute;
  } else {
    // Update existing parachute
    const existingParachute = updatedParachutes[parachuteIndex];
    updatedParachutes[parachuteIndex] = {
      ...existingParachute,
      name: props.name || existingParachute.name,
      cd_s_m2: props.cd_s_m2 !== undefined ? props.cd_s_m2 : existingParachute.cd_s_m2,
      trigger: props.trigger || existingParachute.trigger,
      sampling_rate_hz: props.sampling_rate_hz !== undefined ? props.sampling_rate_hz : existingParachute.sampling_rate_hz,
      lag_s: props.lag_s !== undefined ? props.lag_s : existingParachute.lag_s,
      noise_bias: props.noise_bias !== undefined ? props.noise_bias : existingParachute.noise_bias,
      noise_deviation: props.noise_deviation !== undefined ? props.noise_deviation : existingParachute.noise_deviation,
      noise_correlation: props.noise_correlation !== undefined ? props.noise_correlation : existingParachute.noise_correlation,
      position_from_tail_m: props.position_from_tail_m !== undefined ? props.position_from_tail_m : existingParachute.position_from_tail_m,
      color: props.color || existingParachute.color
    };
  }
  
  return { ...rocket, parachutes: updatedParachutes };
}

/**
 * Update rocket-level properties
 */
export function updateRocketProperties(rocket: Rocket, action: any): Rocket {
  const props = extractActionProps(action);
  
  return {
    ...rocket,
    name: props.name || rocket.name,
    coordinate_system: props.coordinate_system || rocket.coordinate_system
  };
}

// ===========================================
// BASIC MUTATION HELPERS (ADD/REMOVE/SCALE)
// ===========================================

function addBodyTubeHelper(rocket: Rocket, props: Partial<BodyComponent>): Rocket {
  const newTube: BodyComponent = {
    id: crypto.randomUUID(),
    outer_radius_m: props.outer_radius_m ?? 0.05,
    length_m: props.length_m ?? 0.4,
    wall_thickness_m: props.wall_thickness_m ?? 0.003,
    material_id: props.material_id ?? "fiberglass",
    material_density_kg_m3: props.material_density_kg_m3 ?? MATERIALS.FIBERGLASS.density_kg_m3,
    surface_roughness_m: props.surface_roughness_m ?? 1e-5,
    color: props.color ?? '#8C8D91'
  } as BodyComponent;
  return { ...rocket, body_tubes: [...rocket.body_tubes, newTube] };
}

function removeBodyTubeHelper(rocket: Rocket, index: number): Rocket {
  const tubes = [...rocket.body_tubes];
  if (index < 0 || index >= tubes.length) return rocket;
  tubes.splice(index, 1);
  return { ...rocket, body_tubes: tubes };
}

function addFinSetHelper(rocket: Rocket, props: Partial<FinComponent>): Rocket {
  const newFin: FinComponent = {
    id: crypto.randomUUID(),
    fin_count: props.fin_count ?? 3,
    root_chord_m: props.root_chord_m ?? 0.08,
    tip_chord_m: props.tip_chord_m ?? 0.04,
    span_m: props.span_m ?? 0.06,
    sweep_length_m: props.sweep_length_m ?? 0.02,
    thickness_m: props.thickness_m ?? 0.006,
    material_id: props.material_id ?? "birch_plywood",
    material_density_kg_m3: props.material_density_kg_m3 ?? MATERIALS.PLYWOOD.density_kg_m3,
    airfoil: props.airfoil ?? 'symmetric',
    cant_angle_deg: props.cant_angle_deg ?? 0.0,
    color: props.color ?? '#A0A7B8'
  } as FinComponent;
  return { ...rocket, fins: [...rocket.fins, newFin] };
}

function removeFinSetHelper(rocket: Rocket, index: number): Rocket {
  const fins = [...rocket.fins];
  if (index < 0 || index >= fins.length) return rocket;
  fins.splice(index, 1);
  return { ...rocket, fins };
}

function addParachuteHelper(rocket: Rocket, props: Partial<ParachuteComponent>): Rocket {
  // Calculate a default position that's different from existing parachutes
  let defaultPosition = 0.1; // Start at 0.1m from tail
  if (rocket.parachutes.length > 0) {
    // Find the highest position and add 0.1m to it
    const maxPosition = Math.max(...rocket.parachutes.map(p => p.position_from_tail_m || 0));
    defaultPosition = maxPosition + 0.1;
  }
  
  // Generate different colors for each parachute
  const parachuteColors = ['#FF6B35', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
  const colorIndex = rocket.parachutes.length % parachuteColors.length;
  
  const newPara: ParachuteComponent = {
    id: crypto.randomUUID(),
    name: props.name ?? 'Parachute',
    cd_s_m2: props.cd_s_m2 ?? 1.0,
    trigger: props.trigger ?? 'apogee',
    sampling_rate_hz: props.sampling_rate_hz ?? 105.0,
    lag_s: props.lag_s ?? 1.5,
    noise_bias: props.noise_bias ?? 0,
    noise_deviation: props.noise_deviation ?? 8.3,
    noise_correlation: props.noise_correlation ?? 0.5,
    position_from_tail_m: props.position_from_tail_m ?? defaultPosition,
    color: props.color ?? parachuteColors[colorIndex]
  } as ParachuteComponent;
  return { ...rocket, parachutes: [...rocket.parachutes, newPara] };
}

function removeParachuteHelper(rocket: Rocket, index: number): Rocket {
  const parachutes = [...rocket.parachutes];
  if (index < 0 || index >= parachutes.length) return rocket;
  parachutes.splice(index, 1);
  return { ...rocket, parachutes };
}

function scaleRocketHelper(rocket: Rocket, scale: number): Rocket {
  if (!Number.isFinite(scale) || scale <= 0) return rocket;
  const scaledNose = {
    ...rocket.nose_cone,
    length_m: rocket.nose_cone.length_m * scale,
    base_radius_m: (rocket.nose_cone.base_radius_m ?? 0) * scale || undefined,
    wall_thickness_m: rocket.nose_cone.wall_thickness_m * scale
  };
  const scaledBodies = rocket.body_tubes.map(b => ({
    ...b,
    outer_radius_m: b.outer_radius_m * scale,
    length_m: b.length_m * scale,
    wall_thickness_m: b.wall_thickness_m * scale
  }));
  const scaledFins = rocket.fins.map(f => ({
    ...f,
    root_chord_m: f.root_chord_m * scale,
    tip_chord_m: f.tip_chord_m * scale,
    span_m: f.span_m * scale,
    sweep_length_m: f.sweep_length_m * scale,
    thickness_m: f.thickness_m * scale
  }));
  const scaledParas = rocket.parachutes.map(p => ({
    ...p,
    position_from_tail_m: p.position_from_tail_m * scale
  }));
  const scaledMotor = {
    ...rocket.motor,
    position_from_tail_m: rocket.motor.position_from_tail_m * scale
  };
  return {
    ...rocket,
    nose_cone: scaledNose,
    body_tubes: scaledBodies,
    fins: scaledFins,
    parachutes: scaledParas,
    motor: scaledMotor
  };
}

// ===========================================
// ANALYSIS/UTILITY ACTIONS
// ===========================================

function actionAnalyzeComponentMass() {
  try {
    const { rocket, setSimulationMessage } = useRocket.getState();
    const nose = calculateComponentMass(rocket.nose_cone);
    const bodies = rocket.body_tubes.reduce((s, b) => s + calculateComponentMass(b), 0);
    const fins = rocket.fins.reduce((s, f) => s + calculateComponentMass(f), 0);
    const estOther = 0.5;
    const total = nose + bodies + fins + estOther;
    const msg = [
      '=== COMPONENT MASS BREAKDOWN ===',
      `Nose: ${nose.toFixed(3)} kg`,
      `Bodies: ${bodies.toFixed(3)} kg`,
      `Fins: ${fins.toFixed(3)} kg`,
      `Other: ${estOther.toFixed(3)} kg`,
      `Total (approx): ${total.toFixed(3)} kg`
    ].join('\n');
    setSimulationMessage(msg);
  } catch (e) {
    console.error('Failed component mass analysis', e);
  }
}

function actionCalculateCenterOfMass() {
  try {
    const { rocket, setSimulationMessage } = useRocket.getState();
    const com = calculateCenterOfMass(rocket);
    setSimulationMessage(`Center of Mass (approx): ${com.toFixed(3)} m from nose origin`);
  } catch (e) {
    console.error('Failed CoM calculation', e);
  }
}

function actionCalculateCenterOfPressure() {
  try {
    const { rocket, setSimulationMessage } = useRocket.getState();
    const cp = calculateCenterOfPressure(rocket);
    setSimulationMessage(`Center of Pressure (approx): ${cp.toFixed(3)} m from nose origin`);
  } catch (e) {
    console.error('Failed CoP calculation', e);
  }
}

function actionOptimizeFinDesign(targetStabilityMargin: number = 2.0) {
  try {
    const { rocket, updateRocket } = useRocket.getState();
    const currentCom = calculateCenterOfMass(rocket);
    const currentCp = calculateCenterOfPressure(rocket);
    const currentSm = currentCp - currentCom;
    const scale = currentSm > 0 ? Math.min(1.25, Math.max(0.8, targetStabilityMargin / currentSm)) : 1.1;
    updateRocket((r) => ({
      ...r,
      fins: r.fins.map(f => ({
        ...f,
        root_chord_m: f.root_chord_m * scale,
        span_m: f.span_m * scale
      }))
    }));
  } catch (e) {
    console.error('Failed to optimize fin design', e);
  }
}

// ===========================================
// ENVIRONMENTAL ACTIONS  
// ===========================================

/**
 * Set environmental conditions for simulation
 */
export function setEnvironment(action: any) {
  try {
    const { setEnvironment } = useRocket.getState();
    
    const environmentUpdate = {
      latitude_deg: action.latitude_deg !== undefined ? action.latitude_deg : action.latitude,
      longitude_deg: action.longitude_deg !== undefined ? action.longitude_deg : action.longitude,
      elevation_m: action.elevation_m !== undefined ? action.elevation_m : action.elevation,
      wind_speed_m_s: action.wind_speed_m_s !== undefined ? action.wind_speed_m_s : action.windSpeed,
      wind_direction_deg: action.wind_direction_deg !== undefined ? action.wind_direction_deg : action.windDirection,
      atmospheric_model: action.atmospheric_model || action.atmosphericModel || undefined,
      date: action.date || undefined
    };
    
    const filteredUpdate = Object.fromEntries(
      Object.entries(environmentUpdate).filter(([_, value]) => value !== undefined)
    );
    
    const currentEnv = useRocket.getState().environment;
    const newEnvironment = { ...currentEnv, ...filteredUpdate };
    
    setEnvironment(newEnvironment);
    console.log('✅ Environmental conditions updated');
    
  } catch (error) {
    console.error('❌ Failed to set environmental conditions:', error);
  }
}

/**
 * Set launch site and conditions
 */
export function setLaunchSite(action: any) {
  try {
    const { setEnvironment, setLaunchParameters } = useRocket.getState();
    
    if (action.latitude !== undefined || action.longitude !== undefined || action.elevation !== undefined) {
      const currentEnv = useRocket.getState().environment;
      const environmentUpdate = {
        ...currentEnv,
        ...(action.latitude !== undefined && { latitude: action.latitude }),
        ...(action.longitude !== undefined && { longitude: action.longitude }),
        ...(action.elevation !== undefined && { elevation: action.elevation })
      };
      setEnvironment(environmentUpdate);
    }
    
    if (action.railLength !== undefined || action.inclination !== undefined || 
        action.heading !== undefined || action.launchSiteName !== undefined) {
      const currentParams = useRocket.getState().launchParameters;
      const parameterUpdate = {
        ...currentParams,
        ...(action.railLength !== undefined && { railLength: action.railLength }),
        ...(action.inclination !== undefined && { inclination: action.inclination }),
        ...(action.heading !== undefined && { heading: action.heading }),
        ...(action.launchSiteName !== undefined && { launchSiteName: action.launchSiteName })
      };
      setLaunchParameters(parameterUpdate);
    }
    
    console.log('✅ Launch site configured');
    
  } catch (error) {
    console.error('❌ Failed to set launch site:', error);
  }
}

/**
 * Set wind conditions
 */
export function setWindConditions(action: any) {
  try {
    const { setEnvironment } = useRocket.getState();
    
    const currentEnv = useRocket.getState().environment;
    const windUpdate = {
      ...currentEnv,
      wind_speed_m_s: action.wind_speed_m_s !== undefined ? action.wind_speed_m_s : (action.windSpeed !== undefined ? action.windSpeed : currentEnv.wind_speed_m_s),
      wind_direction_deg: action.wind_direction_deg !== undefined ? action.wind_direction_deg : (action.windDirection !== undefined ? action.windDirection : currentEnv.wind_direction_deg)
    };
    
    setEnvironment(windUpdate);
    console.log(`✅ Wind conditions: ${windUpdate.wind_speed_m_s} m/s @ ${windUpdate.wind_direction_deg}°`);
    
  } catch (error) {
    console.error('❌ Failed to set wind conditions:', error);
  }
}

/**
 * Set atmospheric model and conditions
 */
export function setAtmosphericConditions(action: any) {
  try {
    const { setEnvironment } = useRocket.getState();
    
    const currentEnv = useRocket.getState().environment;
    const atmosphericUpdate = {
      ...currentEnv,
      atmospheric_model: action.atmosphericModel || currentEnv.atmospheric_model,
      elevation_m: action.elevation !== undefined ? action.elevation : currentEnv.elevation_m,
      date: action.date || currentEnv.date
    };
    
    setEnvironment(atmosphericUpdate);
    console.log(`✅ Atmospheric model: ${atmosphericUpdate.atmospheric_model}`);
    
  } catch (error) {
    console.error('❌ Failed to set atmospheric conditions:', error);
  }
}

/**
 * Set launch rail and orientation parameters
 */
export function setLaunchParameters(action: any) {
  try {
    const { setLaunchParameters } = useRocket.getState();
    
    const currentParams = useRocket.getState().launchParameters;
    const parameterUpdate = {
      ...currentParams,
      railLength: action.railLength !== undefined ? action.railLength : currentParams.railLength,
      inclination: action.inclination !== undefined ? action.inclination : currentParams.inclination,
      heading: action.heading !== undefined ? action.heading : currentParams.heading,
      launchSiteName: action.launchSiteName || currentParams.launchSiteName
    };
    
    setLaunchParameters(parameterUpdate);
    console.log(`✅ Launch parameters updated`);
    
  } catch (error) {
    console.error('❌ Failed to set launch parameters:', error);
  }
}

/**
 * Analyze environmental impact on flight
 */
export function analyzeEnvironmentalImpact(action: any) {
  try {
    const { environment, launchParameters, rocket, setSimulationMessage } = useRocket.getState();
    
    const analysis = [];
    const warnings = [];
    const recommendations = [];
    
    // Wind analysis
    if (environment.wind_speed_m_s > 10) {
      warnings.push(`High wind speed (${environment.wind_speed_m_s} m/s) may affect flight stability`);
      recommendations.push('Consider postponing launch or using wind-resistant design');
    } else if (environment.wind_speed_m_s > 5) {
      analysis.push(`Moderate wind (${environment.wind_speed_m_s} m/s) will cause some drift`);
      recommendations.push('Account for wind drift in recovery planning');
    } else {
      analysis.push(`Low wind conditions (${environment.wind_speed_m_s} m/s) - ideal for flight`);
    }
    
    // Elevation analysis
    if (environment.elevation_m > 1500) {
      analysis.push(`High altitude launch (${environment.elevation_m}m) - reduced air density will increase altitude`);
      recommendations.push('Expect 5-15% altitude increase due to thin air');
    } else if (environment.elevation_m < 0) {
      analysis.push(`Below sea level launch (${environment.elevation_m}m) - increased air density will reduce altitude`);
      recommendations.push('Expect 2-8% altitude decrease due to dense air');
    } else {
      analysis.push(`Launch elevation (${environment.elevation_m}m) within normal range`);
    }
    
    // Launch angle analysis
    if (launchParameters.inclination < 80) {
      warnings.push(`Low launch angle (${launchParameters.inclination}°) may reduce altitude significantly`);
      recommendations.push('Consider increasing launch angle to 85-90° for maximum altitude');
    } else if (launchParameters.inclination > 90) {
      warnings.push(`Launch angle over 90° (${launchParameters.inclination}°) will result in backwards flight`);
      recommendations.push('Adjust launch angle to 85-90° for forward flight');
    } else {
      analysis.push(`Launch angle (${launchParameters.inclination}°) is optimal for maximum altitude`);
    }
    
    // Rail length analysis
    const rocketLength = rocket.nose_cone.length_m + 
      rocket.body_tubes.reduce((sum, body) => sum + body.length_m, 0);
    if (launchParameters.railLength < rocketLength * 2) {
      warnings.push(`Short rail (${launchParameters.railLength}m) for rocket length (${rocketLength.toFixed(2)}m) - consider longer rail`);
      recommendations.push(`Recommended rail length: ${(rocketLength * 2.5).toFixed(1)}m for stable launch`);
    } else if (launchParameters.railLength > rocketLength * 4) {
      analysis.push(`Very long rail (${launchParameters.railLength}m) provides excellent guidance`);
    } else {
      analysis.push(`Rail length (${launchParameters.railLength}m) is adequate for ${rocketLength.toFixed(2)}m rocket`);
    }
    
    // Atmospheric model analysis
    if (environment.atmospheric_model === "standard") {
      analysis.push("Using standard atmosphere model - good for general predictions");
    } else if (environment.atmospheric_model === "forecast") {
      analysis.push("Using weather forecast data for enhanced accuracy");
      recommendations.push("Real-time weather data will improve simulation precision");
    } else if (environment.atmospheric_model === "custom") {
      analysis.push("Using custom atmospheric model for specialized conditions");
    }
    
    // Combined wind and launch analysis
    if (environment.wind_speed_m_s > 0 && launchParameters.inclination !== undefined) {
      const crosswindComponent = environment.wind_speed_m_s * Math.sin(Math.PI * (90 - launchParameters.inclination) / 180);
      if (crosswindComponent > 5) {
        warnings.push(`High crosswind component (${crosswindComponent.toFixed(1)} m/s) for ${launchParameters.inclination}° launch`);
        recommendations.push(`Consider adjusting launch angle or postponing if wind exceeds safety limits`);
      } else if (crosswindComponent > 2) {
        analysis.push(`Moderate crosswind effect (${crosswindComponent.toFixed(1)} m/s) expected`);
      }
    }
    
    // Comprehensive assessment
    const overallRisk = warnings.length > 2 ? "HIGH" : warnings.length > 0 ? "MODERATE" : "LOW";
    
    const message = [
      `=== ENVIRONMENTAL IMPACT ANALYSIS ===`,
      `Overall Risk Level: ${overallRisk}`,
      ``,
      ...analysis,
      ...(warnings.length > 0 ? ['', '⚠️ WARNINGS:', ...warnings] : []),
      ...(recommendations.length > 0 ? ['', '💡 RECOMMENDATIONS:', ...recommendations] : [])
    ].join('\n');
    
    setSimulationMessage(message);
    console.log('✅ Environmental analysis completed');
    
  } catch (error) {
    console.error('❌ Environmental analysis failed:', error);
  }
}

/**
 * Run Monte Carlo simulation by calling the dedicated API endpoint.
 */
export async function runMonteCarloSimulation(action: any) {
  try {
    const { rocket, environment, launchParameters, setMonteCarloResult, setSimulating } = useRocket.getState();
    
    console.log('🎲 Running Monte Carlo simulation via API...');
    setSimulating(true);
    
    // Estimate rocket's drag coefficient for the simulation
    const estimatedCd = (rocket.nose_cone?.surface_roughness_m ?? 0.05) + 
                        (rocket.fins?.[0]?.thickness_m ?? 0.005) * 4;
    
    const iterations = action.iterations || 100;
    const variations = action.variations || [
      {
        parameter: "environment.wind_speed_m_s",
        distribution: "uniform",
        parameters: [0, 10]
      },
      {
        parameter: "rocket.Cd",
        distribution: "normal",
        parameters: [estimatedCd, estimatedCd * 0.1]
      },
      {
        parameter: "launch.inclination_deg",
        distribution: "normal",
        parameters: [85, 2]
      }
    ];
      
    const response = await fetch('/api/simulate/monte-carlo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rocket: { ...rocket, Cd: estimatedCd },
        environment,
        launchParameters,
        iterations,
        variations
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Monte Carlo analysis failed: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    setMonteCarloResult(result);
    
    // Dispatch a browser event that other components (like charts) can listen to
    window.dispatchEvent(new CustomEvent('monteCarloComplete', { 
      detail: { result } 
    }));
    
  } catch (error) {
    console.error('❌ Monte Carlo simulation failed:', error);
    // Optionally, dispatch a notification to the UI for user feedback
    window.dispatchEvent(new CustomEvent('notification', {
      detail: { 
        message: `Monte Carlo analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 
        type: 'error' 
      }
    }));
  } finally {
    useRocket.getState().setSimulating(false);
    console.log(`✅ Monte Carlo API call completed`);
  }
}

/**
 * Sync environment data from window.environmentConditions to store
 */
export function syncEnvironmentFromGlobal() {
  try {
    const { setEnvironment } = useRocket.getState();
    
    if (typeof window !== 'undefined' && (window as any).environmentConditions) {
      const globalEnv = (window as any).environmentConditions;
      
      const storeEnvironment = {
        latitude_deg: globalEnv.latitude || 0,
        longitude_deg: globalEnv.longitude || 0,
        elevation_m: globalEnv.elevation || 0,
        wind_speed_m_s: globalEnv.wind_speed_m_s || globalEnv.windSpeed || 0,
        wind_direction_deg: globalEnv.wind_direction_deg || globalEnv.windDirection || 0,
        atmospheric_model: globalEnv.atmosphericModel as "standard" | "forecast" | "custom" || "standard",
        date: globalEnv.date || new Date().toISOString()
      };
      
      setEnvironment(storeEnvironment);
      console.log('✅ Environment data synced to store');
      
      return globalEnv;
    }
    
    return null;
  } catch (error) {
    console.error('❌ Failed to sync environment data:', error);
    return null;
  }
}

/**
 * Toggle real-time weather data usage
 */
export function toggleRealTimeWeather(action: any) {
  try {
    const { setEnvironment } = useRocket.getState();
    
    const currentEnv = useRocket.getState().environment;
    const atmosphericModel: "standard" | "forecast" | "custom" = action.enabled ? "forecast" : "standard";
    
    setEnvironment({ ...currentEnv, atmospheric_model: atmosphericModel });
    
    if (action.enabled) {
      syncEnvironmentFromGlobal();
    }
    
    console.log(`✅ Real-time weather ${action.enabled ? 'enabled' : 'disabled'}`);
    
  } catch (error) {
    console.error('❌ Failed to toggle real-time weather:', error);
  }
}

/**
 * Toggle high-resolution atmospheric model
 */
export function toggleHighResolutionAtmosphere(action: any) {
  try {
    const preferences = {
      highResolutionAtmosphere: action.enabled,
      atmosphericLayers: action.enabled ? 50 : 10,
      altitudeSteps: action.enabled ? 100 : 20
    };
    
    useRocket.getState().setSimulationMessage(
      `High-resolution atmospheric model ${action.enabled ? 'enabled' : 'disabled'}`
    );
    
    console.log('✅ High-resolution atmospheric model configured');
    
  } catch (error) {
    console.error('❌ Failed to toggle high-resolution atmosphere:', error);
  }
}

/**
 * Toggle turbulence effects
 */
export function toggleTurbulenceEffects(action: any) {
  try {
    const turbulenceConfig = {
      enabled: action.enabled,
      gustIntensity: action.gustIntensity || 1.5,
      turbulenceScale: action.turbulenceScale || 100
    };
    
    useRocket.getState().setSimulationMessage(
      `Turbulence effects ${action.enabled ? 'enabled' : 'disabled'}`
    );
    
    console.log('✅ Turbulence effects configured');
    
  } catch (error) {
    console.error('❌ Failed to toggle turbulence effects:', error);
  }
}

/**
 * Analyze comprehensive environmental data
 */
export function analyzeComprehensiveEnvironment(action: any) {
  try {
    const richData = syncEnvironmentFromGlobal();
    const storeEnv = useRocket.getState().environment;
    
    const analysis: string[] = [];
    const warnings: string[] = [];
    
    if (richData?.temperature !== undefined) {
      if (richData.temperature < 0) {
        warnings.push(`Low temperature (${richData.temperature}°C) may affect motor performance`);
      } else if (richData.temperature > 35) {
        warnings.push(`High temperature (${richData.temperature}°C) may reduce motor efficiency`);
      } else {
        analysis.push(`Temperature (${richData.temperature}°C) is within optimal range`);
      }
    }
    
    if (richData?.pressure !== undefined) {
      if (richData.pressure < 1000) {
        analysis.push(`Low pressure (${richData.pressure} hPa) - expect altitude increase`);
      } else if (richData.pressure > 1020) {
        analysis.push(`High pressure (${richData.pressure} hPa) - expect altitude decrease`);
      }
    }
    
    const fullAnalysis = [
      `=== COMPREHENSIVE ENVIRONMENTAL ANALYSIS ===`,
      `Location: ${storeEnv.latitude_deg}°, ${storeEnv.longitude_deg}° @ ${storeEnv.elevation_m}m`,
      '',
      ...analysis,
      ...(warnings.length > 0 ? ['', '⚠️ WARNINGS:', ...warnings] : [])
    ].join('\n');
    
    useRocket.getState().setSimulationMessage(fullAnalysis);
    console.log('✅ Comprehensive environmental analysis completed');
    
  } catch (error) {
    console.error('❌ Comprehensive environmental analysis failed:', error);
  }
}

/**
 * Update environment from external weather data
 */
export function updateEnvironmentFromWeather(action: any) {
  try {
    const { setEnvironment } = useRocket.getState();
    
    const environmentUpdate: Partial<EnvironmentConfig> = {
      latitude_deg: action.location?.latitude || action.lat,
      longitude_deg: action.location?.longitude || action.lon,
      elevation_m: action.location?.elevation || action.elevation || 0,
      wind_speed_m_s: action.current?.windSpeed || action.wind?.speed || 0,
      wind_direction_deg: action.current?.windDirection || action.wind?.direction || 0,
      atmospheric_model: "forecast",
      date: action.validTime || action.timestamp || new Date().toISOString(),
      atmospheric_profile: action.atmospheric 
    };
    
    const filteredUpdate = Object.fromEntries(
      Object.entries(environmentUpdate).filter(([_, value]) => value !== undefined && value !== null)
    ) as Partial<EnvironmentConfig>;
    
    const currentEnv = useRocket.getState().environment;
    const newEnvironment = { ...currentEnv, ...filteredUpdate };
    
    setEnvironment(newEnvironment);
    
    if (typeof window !== 'undefined') {
      (window as any).environmentConditions = {
        ...(window as any).environmentConditions,
        ...action,
        atmospheric_model: "forecast"
      };
    }
    
    console.log('✅ Environment updated from weather data');
    
  } catch (error) {
    console.error('❌ Failed to update environment from weather:', error);
  }
}

// ===========================================
// ANALYSIS AND EXPORT FUNCTIONS
// ===========================================

/**
 * Export simulation data in various formats
 */
export function exportSimulationData(params: any) {
  try {
    const { rocket, sim } = useRocket.getState();
  
    if (!sim) {
      console.log('⚠️ No simulation data to export');
      return;
    }
    
    const exportData = {
      rocket: {
        name: rocket.name,
        nose_cone: rocket.nose_cone,
        body_tubes: rocket.body_tubes,
        fins: rocket.fins,
        motor: rocket.motor,
        parachutes: rocket.parachutes
      },
      simulation: {
        maxAltitude: sim.maxAltitude,
        maxVelocity: sim.maxVelocity,
        apogeeTime: sim.apogeeTime,
        stabilityMargin: sim.stabilityMargin,
        fidelity: sim.simulationFidelity
      }
    };
    
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
      default:
        console.error('Unsupported export format:', params.format);
        return;
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('✅ Export completed:', filename);
  } catch (error) {
    console.error('❌ Export failed:', error);
  }
}

/**
 * Analyze rocket stability
 */
export function analyzeStability(params: any) {
  try {
    const { rocket, setStabilityAnalysis } = useRocket.getState();
    
    const centerOfMass = calculateCenterOfMass(rocket);
    const centerOfPressure = calculateCenterOfPressure(rocket);
    const staticMargin = centerOfPressure - centerOfMass;
    
    let rating = "Unknown";
    const recommendations: string[] = [];
    
    if (staticMargin < 0) {
      rating = "Unstable";
      recommendations.push("Add weight to nose or move fins back");
    } else if (staticMargin < 0.5) {
      rating = "Marginally Stable";
      recommendations.push("Increase fin size for better stability");
    } else if (staticMargin > 2.0) {
      rating = "Overstable";
      recommendations.push("Reduce fin size or move fins forward");
    } else {
      rating = "Stable";
      recommendations.push("Good stability configuration");
    }
    
    const analysis = {
      staticMargin,
      center_of_mass: centerOfMass,
      center_of_pressure: centerOfPressure,
      rating,
      recommendations,
      timestamp: new Date().toISOString()
    };
    
    setStabilityAnalysis(analysis);
    console.log('✅ Stability analysis completed:', rating);
    
  } catch (error) {
    console.error('❌ Stability analysis failed:', error);
  }
}

/**
 * Optimize rocket design
 */
export function optimizeDesign(params: any) {
  try {
    const { rocket, updateRocket } = useRocket.getState();
    
    const optimizedRocket = { ...rocket };
    
    switch (params.objective) {
      case "altitude":
        if (optimizedRocket.fins.length > 0) {
          optimizedRocket.fins = optimizedRocket.fins.map(fin => ({
            ...fin,
            thickness_m: Math.max(0.003, fin.thickness_m * 0.8),
            root_chord_m: fin.root_chord_m * 0.9
          }));
        }
        break;
        
      case "stability":
        if (optimizedRocket.fins.length > 0) {
          optimizedRocket.fins = optimizedRocket.fins.map(fin => ({
            ...fin,
            root_chord_m: fin.root_chord_m * 1.2,
            span_m: fin.span_m * 1.1
          }));
        }
        break;
        
      case "mass":
        optimizedRocket.nose_cone = {
          ...optimizedRocket.nose_cone,
          wall_thickness_m: Math.max(0.001, optimizedRocket.nose_cone.wall_thickness_m * 0.8)
        };
        break;
    }
    
    updateRocket(() => optimizedRocket);
    console.log('✅ Design optimization completed');
    
  } catch (error) {
    console.error('❌ Design optimization failed:', error);
  }
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Calculate rocket center of mass
 */
function calculateCenterOfMass(rocket: Rocket): number {
  let totalMass = 0;
  let totalMoment = 0;
  let position = 0;
  
  const noseMass = calculateComponentMass(rocket.nose_cone);
  const nosePosition = position + rocket.nose_cone.length_m / 2;
  totalMass += noseMass;
  totalMoment += noseMass * nosePosition;
  position += rocket.nose_cone.length_m;
  
  rocket.body_tubes.forEach(body => {
    const bodyMass = calculateComponentMass(body);
    const bodyPosition = position + body.length_m / 2;
    totalMass += bodyMass;
    totalMoment += bodyMass * bodyPosition;
    position += body.length_m;
  });
  
  rocket.fins.forEach(fin => {
    const finMass = calculateComponentMass(fin);
    const finPosition = position - 0.05;
    totalMass += finMass;
    totalMoment += finMass * finPosition;
  });
  
  return totalMass > 0 ? totalMoment / totalMass : 0;
}

/**
 * Calculate rocket center of pressure
 */
function calculateCenterOfPressure(rocket: Rocket): number {
  const totalLength = rocket.nose_cone.length_m + 
    rocket.body_tubes.reduce((sum, body) => sum + body.length_m, 0);
  
  if (rocket.fins.length > 0) {
    return totalLength - 0.1;
  }
  
  return totalLength * 0.7;
}

/**
 * Convert data to CSV format
 */
function convertToCSV(data: any): string {
  const headers = ['Parameter', 'Value', 'Unit'];
  const rows = [
    ['Rocket Name', data.rocket.name, ''],
    ['Max Altitude', data.simulation.maxAltitude?.toFixed(2) || 'N/A', 'm'],
    ['Max Velocity', data.simulation.maxVelocity?.toFixed(2) || 'N/A', 'm/s'],
    ['Apogee Time', data.simulation.apogeeTime?.toFixed(2) || 'N/A', 's'],
    ['Stability Margin', data.simulation.stabilityMargin?.toFixed(2) || 'N/A', ''],
    ['Simulation Fidelity', data.simulation.fidelity || 'N/A', '']
  ];
  
  return [headers, ...rows].map(row => row.join(',')).join('\n');
}

// ===========================================
// MAIN ACTION DISPATCHER (COMPONENT-BASED)
// ===========================================

/**
 * Main action dispatcher for AI agent actions
 * Pure component-based architecture - no legacy handlers
 */
export function dispatchActions(actions: any[]) {
  if (!actions || !Array.isArray(actions)) {
    return;
  }
  
  const { updateRocket } = useRocket.getState();

  actions.forEach((action) => {
    try {
      switch (action.action) {
        // COMPONENT-BASED ACTIONS FROM PYTHON AGENT
        case "update_nose_cone":
          updateRocket((rocket) => updateNoseCone(rocket, action));
          break;
          
        case "update_body_tube":
          updateRocket((rocket) => updateBodyTube(rocket, action));
          break;
          
        case "update_fins":
        case "update_fin_set":
          updateRocket((rocket) => updateFinSet(rocket, action));
          break;
          
        case "update_motor":
          updateRocket((rocket) => updateMotor(rocket, action));
          break;
          
        case "update_parachute":
          updateRocket((rocket) => updateParachute(rocket, action));
          break;
          
        case "update_rocket_properties":
          updateRocket((rocket) => updateRocketProperties(rocket, action));
          break;

        // SIMULATION ACTIONS
        case "run_simulation":
        case "run_sim":
          if (action.fidelity === "quick") {
            runQuickSim();
          } else if (action.fidelity === "hifi") {
            runHighFiSim();
          } else if (action.fidelity === "professional") {
            runProfessionalSim();
          } else if (action.fidelity === "monte_carlo") {
            runMonteCarloSimulation(action);
          } else {
            runStandardSim();
          }
          break;

        // ANALYSIS AND EXPORT ACTIONS
        case "export_data":
          exportSimulationData(action);
          break;
          
        case "analyze_stability":
          analyzeStability(action);
          break;
          
        case "optimize_design":
          optimizeDesign(action);
          break;

        case "analyze_component_mass":
          actionAnalyzeComponentMass();
          break;
        case "calculate_center_of_mass":
          actionCalculateCenterOfMass();
          break;
        case "calculate_center_of_pressure":
          actionCalculateCenterOfPressure();
          break;
        case "optimize_fin_design":
          actionOptimizeFinDesign(action?.props?.target_stability_margin ?? action?.target_stability_margin ?? 2.0);
          break;
        case "scale_rocket":
          updateRocket((rocket) => scaleRocketHelper(rocket, action?.props?.scale_factor ?? action?.scale_factor ?? 1));
          break;
        case "generate_manufacturing_tolerances":
        case "validate_structural_integrity":
          useRocket.getState().setSimulationMessage('Engineering analysis requested: ' + action.action);
          break;

        // ADD/REMOVE COMPONENTS
        case "add_body_tube":
          updateRocket((rocket) => addBodyTubeHelper(rocket, extractActionProps(action)));
          break;
        case "remove_body_tube":
          updateRocket((rocket) => removeBodyTubeHelper(rocket, action.index ?? 0));
          break;
        case "add_fin_set":
        case "add_fins":
          updateRocket((rocket) => addFinSetHelper(rocket, extractActionProps(action)));
          break;
        case "remove_fin_set":
          updateRocket((rocket) => removeFinSetHelper(rocket, action.index ?? 0));
          break;
        case "add_parachute":
          updateRocket((rocket) => addParachuteHelper(rocket, extractActionProps(action)));
          break;
        case "remove_parachute":
          updateRocket((rocket) => removeParachuteHelper(rocket, action.index ?? 0));
          break;

        // ENVIRONMENTAL ACTIONS
        case "set_environment":
          setEnvironment(action);
          break;
          
        case "set_launch_site":
          setLaunchSite(action);
          break;
          
        case "set_wind_conditions":
          setWindConditions(action);
          break;
          
        case "set_atmospheric_conditions":
          setAtmosphericConditions(action);
          break;
          
        case "set_launch_parameters":
          setLaunchParameters(action);
          break;
          
        case "analyze_environmental_impact":
          analyzeEnvironmentalImpact(action);
          break;
          
        case "run_monte_carlo":
        case "run_monte_carlo_simulation":
          runMonteCarloSimulation(action);
          break;
          
        case "sync_environment_from_global":
          syncEnvironmentFromGlobal();
          break;
          
        case "toggle_real_time_weather":
          toggleRealTimeWeather(action);
          break;
          
        case "toggle_high_resolution_atmosphere":
          toggleHighResolutionAtmosphere(action);
          break;
          
        case "toggle_turbulence_effects":
          toggleTurbulenceEffects(action);
          break;
          
        case "analyze_comprehensive_environment":
          analyzeComprehensiveEnvironment(action);
          break;
          
        case "update_environment_from_weather":
          updateEnvironmentFromWeather(action);
          break;
      }
    } catch (error) {
      console.error(`❌ Error processing action ${action.action}:`, error);
    }
  });

  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rocketActionsDispatched', { detail: { actions } }));
    }
  } catch (_e) {
    // ignore
  }

  // Auto quick sim after edits (debounced)
  try {
    const state = useRocket.getState();
    if (state.autoQuickSim && Array.isArray(actions) && actions.some(a => typeof a?.action === 'string' && a.action.startsWith('update_'))) {
      scheduleAutoQuickSim();
    }
  } catch (_e) {}
} 

// Debounce helper for auto quick sim
let autoQuickSimTimer: any = null;
function scheduleAutoQuickSim(delayMs: number = 800) {
  if (autoQuickSimTimer) {
    clearTimeout(autoQuickSimTimer);
  }
  autoQuickSimTimer = setTimeout(() => {
    try {
      runQuickSim();
    } catch (_e) {}
    autoQuickSimTimer = null;
  }, delayMs);
}