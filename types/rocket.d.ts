/**
 * Rocketez - TypeScript Type Definitions
 * 
 * This file contains all TypeScript interfaces and type definitions for the rocket engineering platform.
 * It provides strong typing for rocket components, simulation results, analysis data, and configuration objects.
 * 
 * Key Type Categories:
 * - **Rocket Components**: Component-based architecture for professional-grade design
 * - **Rocket Model**: Main Rocket interface using component-based architecture
 * - **Simulation Data**: SimulationResult, TrajectoryData, FlightEvent - Results from physics simulations
 * - **Analysis Results**: StabilityAnalysis, MotorAnalysis, MonteCarloResult - Engineering analysis outputs
 * - **Configuration**: EnvironmentConfig, LaunchParameters - Simulation setup parameters
 * - **Statistics**: MonteCarloStatistics - Statistical analysis for uncertainty quantification
 * 
 * These types ensure type safety across:
 * - Frontend React components and state management
 * - Backend API routes and database operations
 * - AI/ML services for design optimization
 * - Physics simulation interfaces
 * - Database schema validation
 * 
 * @version 1.0.0 - Component-based architecture only
 * @author Rocketez Team
 */

// ===========================
// COMPONENT-BASED MODEL
// ===========================

/** Component-based nose cone with SI units and material properties */
export interface NoseComponent {
  id: string;
  shape: "ogive" | "conical" | "elliptical" | "parabolic";
  length_m: number;                    // Length in meters
  base_radius_m?: number;             // Base radius in meters (if different from body)
  wall_thickness_m: number;           // Wall thickness in meters
  material_id: string;                 // Material ID from materials database
  material_density_kg_m3: number;     // Material density in kg/m³ (calculated from material_id)
  surface_roughness_m: number;        // Surface roughness in meters
  color?: string;                     // Optional color for rendering
}

/** Component-based body tube with SI units and material properties */
export interface BodyComponent {
  id: string;
  outer_radius_m: number;             // Outer radius in meters
  length_m: number;                   // Length in meters
  wall_thickness_m: number;           // Wall thickness in meters
  material_id: string;                 // Material ID from materials database
  material_density_kg_m3: number;     // Material density in kg/m³ (calculated from material_id)
  surface_roughness_m: number;        // Surface roughness in meters
  color?: string;                     // Optional color for rendering
}

/** Component-based fin with SI units and aerodynamic properties */
export interface FinComponent {
  id: string;
  fin_count: number;                  // Number of fins (typically 3 or 4)
  root_chord_m: number;               // Root chord length in meters
  tip_chord_m: number;                // Tip chord length in meters
  span_m: number;                     // Fin span in meters
  sweep_length_m: number;             // Sweep length in meters
  thickness_m: number;                // Fin thickness in meters
  wall_thickness_m?: number;          // Wall thickness for hollow fins (0 = solid)
  position_from_tail_m: number;       // Position from rocket tail in meters
  material_id: string;                 // Material ID from materials database
  material_density_kg_m3: number;     // Material density in kg/m³ (calculated from material_id)
  airfoil?: string;                   // Airfoil type (e.g., "symmetric")
  cant_angle_deg: number;             // Cant angle in degrees
  color?: string;                     // Optional color for rendering
}

/** Component-based motor with database reference and positioning */
export interface MotorComponent {
  id: string;
  motor_database_id: string;              // Reference to motor database
  position_from_tail_m: number;           // Position from rocket tail in meters
  rocket_type?: "solid" | "liquid" | "hybrid"; // Type of rocket propulsion
  nozzle_expansion_ratio?: number;        // Nozzle expansion ratio (optional)
  chamber_pressure_pa?: number;           // Chamber pressure in Pascals (optional)
}

/** Electronics bay component for avionics and recovery systems */
export interface ElectronicsBayComponent {
  id: string;
  name: string;                           // Electronics bay name
  position_from_tail_m: number;           // Position from rocket tail in meters
  length_m: number;                       // Length of electronics bay in meters
  diameter_m: number;                     // Diameter of electronics bay in meters
  components: string[];                   // List of components (GPS, altimeter, etc.)
  color?: string;                         // Optional color for rendering
}

/** Component-based parachute with deployment parameters */
export interface ParachuteComponent {
  id: string;
  name: string;                       // Parachute name
  cd_s_m2: number;                    // Drag coefficient × reference area in m²
  trigger: string | number;           // Trigger: "apogee", altitude in meters, or custom
  sampling_rate_hz: number;           // Sampling rate in Hz
  lag_s: number;                      // Deployment lag in seconds
  noise_bias: number;                 // Noise bias
  noise_deviation: number;            // Noise standard deviation
  noise_correlation: number;          // Noise correlation
  position_from_tail_m: number;       // Position from rocket tail in meters
  color?: string;                     // Optional color for rendering
}

/** Project interface - top-level container for rocket designs and chat history */
export interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  is_public?: boolean;
  tags?: string[];
  // Computed fields from database views
  rocket_count?: number;
  version_count?: number;
  message_count?: number;
  simulation_count?: number;
  last_rocket_update?: string;
  last_message_time?: string;
}

/** Main component-based rocket model */
export interface Rocket {
  id: string;
  project_id?: string;  // References the project this rocket belongs to
  name: string;
  rocket_type: "solid" | "liquid" | "hybrid"; // Type of rocket propulsion
  nose_cone: NoseComponent;
  body_tubes: BodyComponent[];
  fins: FinComponent[];
  motor: MotorComponent;
  parachutes: ParachuteComponent[];
  electronics_bay?: ElectronicsBayComponent; // Optional electronics bay
  coordinate_system: "tail_to_nose" | "nose_to_tail";
  rail_guides_position_m?: number[];  // Rail guide positions from tail in meters
}

// Enhanced simulation types
export interface TrajectoryData {
  time: number[];
  position: number[][];  // [[x, y, z], ...]
  velocity: number[][];  // [[vx, vy, vz], ...]
  acceleration: number[][]; // [[ax, ay, az], ...]
  attitude?: number[][]; // [[q0, q1, q2, q3], ...] - quaternions
  angularVelocity?: number[][]; // [[wx, wy, wz], ...]
}

export interface FlightEvent {
  name: string;
  time: number;
  altitude: number;
}

export interface SimulationResult {
  maxAltitude?: number;
  maxVelocity?: number;
  maxAcceleration?: number;
  apogeeTime?: number;
  flightTime?: number;
  landingVelocity?: number;
  stabilityMargin?: number;
  thrustCurve?: [number, number][]; // [time, thrust] pairs
  simulationFidelity?: string;
  trajectory?: TrajectoryData;
  flightEvents?: FlightEvent[];
  impactVelocity?: number;
  driftDistance?: number;
  timestamp?: string;
  // Optional analysis results
  stabilityAnalysis?: any;
  performanceAnalysis?: any;
  performanceRating?: string;
  motorAnalysis?: any;
  requirementsValidation?: any;
}

export interface MonteCarloStatistics {
  mean: number;
  std: number;
  min: number;
  max: number;
  percentiles: {
    "5": number;
    "25": number;
    "50": number;
    "75": number;
    "95": number;
  };
}

export interface MonteCarloResult {
  nominal: SimulationResult;
  statistics: {
    [key: string]: MonteCarloStatistics;
  };
  iterations: Array<{[key: string]: number}>;
  landingDispersion?: {
    coordinates: number[][];
    cep: number;
    majorAxis: number;
    minorAxis: number;
    rotation: number;
    meanDrift: number;
    maxDrift: number;
  };
}

export interface EnvironmentConfig {
  latitude_deg: number;
  longitude_deg: number;
  elevation_m: number;
  wind_speed_m_s: number;
  wind_direction_deg: number;
  atmospheric_model: "standard" | "forecast" | "custom" | "nrlmsise";
  date?: string;
  temperature?: number;
  pressure?: number;
  humidity?: number;
  visibility?: number;
  cloudCover?: number;
  airDensity?: number;
  soundSpeed?: number;
  timestamp?: string;
  atmospheric_profile?: AtmosphericProfile;
  // Enhanced weather data for comprehensive simulations
  temperature_offset_k?: number;
  pressure_offset_pa?: number;
  timezone?: string;
}

export interface AtmosphericProfile {
  altitude: number[]; // meters
  temperature: number[]; // K
  pressure: number[]; // Pa
  density: number[]; // kg/m³
  windU: number[]; // m/s (east component)
  windV: number[]; // m/s (north component)
}

export interface LaunchParameters {
  railLength: number;
  inclination: number;
  heading: number;
  launchSiteName?: string;
}

export interface MotorAnalysis {
  motor: any;
  thrustToWeight: number;
  totalImpulse: number;
  specificImpulse: number;
  burnTime: number;
  averageThrust: number;
  impulseClass: string;
  recommendations: string[];
}

export interface StabilityAnalysis {
  staticMargin: number;
  static_margin?: number; // Backend might return this format
  center_of_pressure?: number;
  center_of_mass?: number;
  stability_rating?: string;
  rating?: string;
  flight_phase?: "powered" | "coast" | "all";
  includeStatic?: boolean;
  includeDynamic?: boolean;
  windConditions?: {[key: string]: number};
  recommendations?: string[];
  recommendation?: string; // Single recommendation
  analysisType?: string;
  timestamp?: string;
}

export interface RecoveryPrediction {
  deploymentAltitude: number;
  terminalVelocity: number;
  descentTime: number;
  driftDistance: number;
  landingVelocity: number;
  recommendations: string[];
} 