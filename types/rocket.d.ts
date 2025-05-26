export interface PartBase { id: string; type: string; color: string }
export interface Nose extends PartBase { type: "nose"; shape:"ogive"|"conical"; length:number; baseØ:number }
export interface Body extends PartBase { type: "body"; Ø:number; length:number }
export interface Fin  extends PartBase { type: "fin"; root:number; span:number; sweep:number }
export interface Engine extends PartBase { type: "engine"; thrust:number; Isp?:number }
export type Part = Nose | Body | Fin | Engine;

export interface Rocket {
  id: string; name: string; parts: Part[];
  motorId: string; Cd: number; units:"metric"|"imperial";
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
  maxAltitude: number;
  maxVelocity: number;
  maxAcceleration: number;
  apogeeTime: number;
  stabilityMargin: number;
  thrustCurve?: [number, number][]; // [time, thrust] pairs
  simulationFidelity?: string;
  trajectory?: TrajectoryData;
  flightEvents?: FlightEvent[];
  impactVelocity?: number;
  driftDistance?: number;
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
  latitude: number;
  longitude: number;
  elevation: number;
  windSpeed: number;
  windDirection: number;
  atmosphericModel: "standard" | "forecast" | "custom";
  date?: string;
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
  flight_phase: "powered" | "coast" | "all";
  includeStatic: boolean;
  includeDynamic: boolean;
  windConditions?: {[key: string]: number};
  recommendations: string[];
}

export interface RecoveryPrediction {
  deploymentAltitude: number;
  terminalVelocity: number;
  descentTime: number;
  driftDistance: number;
  landingVelocity: number;
  recommendations: string[];
} 