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
import { 
  databaseService, 
  saveRocketToDb, 
  saveSimulationToDb, 
  saveChatToDb,
  getCurrentSessionId
} from '@/lib/services/database.service';

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
  simulationMessage: string;
  
  // Database integration state
  isDatabaseConnected: boolean;
  currentSessionId: string | null;
  savedRockets: Rocket[];
  isSaving: boolean;
  initializationAttempted: boolean;
  
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
  setSimulationMessage: (message: string) => void;
  
  // Database actions
  saveCurrentRocket: () => Promise<void>;
  loadUserRockets: () => Promise<void>;
  initializeDatabase: () => Promise<void>;
  saveChatMessage: (role: 'user' | 'assistant' | 'system', content: string, actions?: any) => Promise<void>;
}

// Create the enhanced store
export const useRocket = create<RocketState>()((set, get) => ({
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
  simulationMessage: "",
  
  // Database state
  isDatabaseConnected: false,
  currentSessionId: null,
  savedRockets: [],
  isSaving: false,
  initializationAttempted: false,
  
  // Core actions
  updateRocket: (fn) => {
    const newRocket = fn(structuredClone(get().rocket));
    set({ rocket: newRocket });
    
    // Auto-save to database if connected (non-blocking)
    if (get().isDatabaseConnected) {
      get().saveCurrentRocket();
    }
  },
  
  setSim: async (sim) => {
    set({ sim });
    
    // Save simulation result to database if connected (non-blocking)
    if (sim && get().isDatabaseConnected) {
      const state = get();
      
      try {
        // FIRST: Ensure rocket is saved to database
        const savedRocket = await saveRocketToDb(state.rocket);
        
        if (savedRocket) {
          // THEN: Save simulation with the rocket ID from database
          await saveSimulationToDb(
            savedRocket.id, // Use DB rocket ID, not store rocket ID
            sim, 
            state.lastSimulationType
          );
          console.log('Simulation saved successfully');
        } else {
          // Fallback: try with store rocket ID
          await saveSimulationToDb(
            state.rocket.id, 
            sim, 
            state.lastSimulationType
          );
        }
      } catch (error) {
        console.warn('Failed to save simulation to database:', error);
      }
    }
  },
  
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
  setSimulationMessage: (message) => set({ simulationMessage: message }),
  
  // Database actions
  saveCurrentRocket: async () => {
    const state = get();
    if (state.isSaving) return; // Prevent concurrent saves
    
    set({ isSaving: true });
    try {
      const saved = await saveRocketToDb(state.rocket);
      if (saved) {
        console.log('Rocket saved to database successfully');
        // Update saved rockets list
        get().loadUserRockets();
      }
    } catch (error) {
      console.warn('Failed to save rocket:', error);
    } finally {
      set({ isSaving: false });
    }
  },
  
  loadUserRockets: async () => {
    try {
      const rockets = await databaseService.loadUserRockets();
      set({ savedRockets: rockets });
    } catch (error) {
      console.warn('Failed to load user rockets:', error);
      set({ savedRockets: [] });
    }
  },
  
  initializeDatabase: async () => {
    const state = get();
    if (state.initializationAttempted) {
      return; // Prevent multiple initialization attempts
    }
    
    set({ initializationAttempted: true });
    
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database initialization timeout')), 10000)
      );
      
      const initPromise = (async () => {
        // Test database connection
        const isConnected = await databaseService.testConnection();
        
        if (isConnected) {
          // Get or create session
          const sessionId = await getCurrentSessionId();
          
          // Load user rockets
          const rockets = await databaseService.loadUserRockets();
          
          set({ 
            isDatabaseConnected: true, 
            currentSessionId: sessionId,
            savedRockets: rockets
          });
          
          console.log('Database initialized successfully');
        } else {
          console.warn('Database connection failed - running in offline mode');
          set({ isDatabaseConnected: false });
        }
      })();
      
      await Promise.race([initPromise, timeoutPromise]);
      
    } catch (error) {
      console.warn('Database initialization failed:', error);
      set({ isDatabaseConnected: false });
    }
  },
  
  saveChatMessage: async (role, content, actions) => {
    const state = get();
    if (!state.isDatabaseConnected) {
      return; // Graceful degradation - just don't save
    }
    
    try {
      // FIRST: Ensure we have a valid session
      let sessionId = state.currentSessionId;
      if (!sessionId) {
        sessionId = await getCurrentSessionId();
        set({ currentSessionId: sessionId });
      }
      
      // THEN: Save chat message
      await saveChatToDb(
        sessionId,
        role,
        content,
        state.rocket.id,
        actions
      );
    } catch (error) {
      console.warn('Failed to save chat message:', error);
    }
  }
}));

// Initialize database connection when store is created (with better error handling)
if (typeof window !== 'undefined') {
  // Only run in browser environment and add delay to avoid race conditions
  setTimeout(() => {
    const state = useRocket.getState();
    if (!state.initializationAttempted) {
      state.initializeDatabase();
    }
  }, 1000); // Wait 1 second for auth to settle
} 