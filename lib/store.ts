import { create } from 'zustand';
import { 
  Rocket, 
  Part, 
  SimulationResult, 
  EnvironmentConfig, 
  LaunchParameters,
  MonteCarloResult,
  StabilityAnalysis,
  MotorAnalysis,
  RecoveryPrediction
} from '@/types/rocket';

// Default rocket configuration
export const DEFAULT_ROCKET: Rocket = {
  id: crypto.randomUUID(),
  name: 'Default Rocket',
  parts: [
    {
      id: crypto.randomUUID(),
      type: 'nose',
      color: '#A0A7B8',
      shape: 'ogive',
      length: 15,
      baseØ: 5
    },
    {
      id: crypto.randomUUID(),
      type: 'body',
      color: '#8C8D91',
      Ø: 10,
      length: 40
    },
    {
      id: crypto.randomUUID(),
      type: 'fin',
      color: '#A0A7B8',
      root: 10,
      span: 8,
      sweep: 6
    },
    {
      id: crypto.randomUUID(),
      type: 'engine',
      color: '#0066FF',
      thrust: 32,
      Isp: 200
    }
  ],
  motorId: 'default-motor',
  Cd: 0.35,
  units: 'metric'
};

// Default environment configuration
export const DEFAULT_ENVIRONMENT: EnvironmentConfig = {
  latitude: 0.0,
  longitude: 0.0,
  elevation: 0.0,
  windSpeed: 0.0,
  windDirection: 0.0,
  atmosphericModel: "standard"
};

// Default launch parameters
export const DEFAULT_LAUNCH_PARAMS: LaunchParameters = {
  railLength: 5.0,
  inclination: 85.0,
  heading: 0.0
};

// Enhanced state interface
export interface RocketState {
  // Core rocket and simulation data
  rocket: Rocket;
  sim: SimulationResult | null;
  
  // Environment and launch configuration
  environment: EnvironmentConfig;
  launchParameters: LaunchParameters;
  
  // Advanced analysis results
  monteCarloResult: MonteCarloResult | null;
  stabilityAnalysis: StabilityAnalysis | null;
  motorAnalysis: MotorAnalysis | null;
  recoveryPrediction: RecoveryPrediction | null;
  
  // UI state
  isSimulating: boolean;
  simulationProgress: number;
  lastSimulationType: string;
  
  // Actions
  updateRocket: (fn: (rocket: Rocket) => Rocket) => void;
  setSim: (sim: SimulationResult | null) => void;
  setEnvironment: (env: EnvironmentConfig) => void;
  setLaunchParameters: (params: LaunchParameters) => void;
  setMonteCarloResult: (result: MonteCarloResult | null) => void;
  setStabilityAnalysis: (analysis: StabilityAnalysis | null) => void;
  setMotorAnalysis: (analysis: MotorAnalysis | null) => void;
  setRecoveryPrediction: (prediction: RecoveryPrediction | null) => void;
  setSimulating: (isSimulating: boolean) => void;
  setSimulationProgress: (progress: number) => void;
  setLastSimulationType: (type: string) => void;
}

// Create the enhanced store
export const useRocket = create<RocketState>()((set) => ({
  // Core state
  rocket: DEFAULT_ROCKET,
  sim: null,
  
  // Configuration state
  environment: DEFAULT_ENVIRONMENT,
  launchParameters: DEFAULT_LAUNCH_PARAMS,
  
  // Analysis state
  monteCarloResult: null,
  stabilityAnalysis: null,
  motorAnalysis: null,
  recoveryPrediction: null,
  
  // UI state
  isSimulating: false,
  simulationProgress: 0,
  lastSimulationType: "standard",
  
  // Core actions
  updateRocket: (fn) => set((s) => ({ rocket: fn(structuredClone(s.rocket)) })),
  setSim: (sim) => set({ sim }),
  
  // Configuration actions
  setEnvironment: (environment) => set({ environment }),
  setLaunchParameters: (launchParameters) => set({ launchParameters }),
  
  // Analysis actions
  setMonteCarloResult: (monteCarloResult) => set({ monteCarloResult }),
  setStabilityAnalysis: (stabilityAnalysis) => set({ stabilityAnalysis }),
  setMotorAnalysis: (motorAnalysis) => set({ motorAnalysis }),
  setRecoveryPrediction: (recoveryPrediction) => set({ recoveryPrediction }),
  
  // UI actions
  setSimulating: (isSimulating) => set({ isSimulating }),
  setSimulationProgress: (simulationProgress) => set({ simulationProgress }),
  setLastSimulationType: (lastSimulationType) => set({ lastSimulationType }),
})); 