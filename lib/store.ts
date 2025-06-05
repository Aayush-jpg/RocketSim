import { create } from 'zustand';
import { 
  Rocket, 
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
  getCurrentSessionId, 
  saveChatToDb,
  createNewRocket,
  deleteRocket,
  getUserSimulations,
  getUserChatSessions,
  getUserStats,
  saveRocketVersion,
  getRocketVersions,
  revertToRocketVersion,
  loadRocketById,
  getRocketForSession,
  cleanupOrphanedSessions
} from '@/lib/services/database.service';
import { getDefaultRocket } from '@/lib/data/templates';

// Use centralized default rocket from templates
const DEFAULT_ROCKET = getDefaultRocket();

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
  
  // Left panel state
  userSimulations: any[];
  userChatSessions: any[];
  userStats: { rocketsCount: number; simulationsCount: number; messagesCount: number } | null;
  isLoadingPanelData: boolean;
  
  // Version control state
  rocketVersions: any[];
  isLoadingVersions: boolean;
  
  // Actions
  updateRocket: (fn: (rocket: Rocket) => Rocket, skipAutoSave?: boolean) => void;
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
  
  // Left panel actions
  loadRocket: (rocket: Rocket) => void;
  createAndLoadNewRocket: (name: string, template?: 'basic' | 'advanced' | 'sport') => Promise<void>;
  deleteRocketFromList: (rocketId: string) => Promise<void>;
  loadPanelData: () => Promise<void>;
  refreshPanelData: () => void;
  
  // New actions
  loadChatSession: (sessionId: string) => Promise<void>;
  saveRocketVersionWithDescription: (description?: string, createdByAction?: string) => Promise<void>;
  loadRocketVersions: () => Promise<void>;
  revertToVersion: (versionId: string) => Promise<void>;
  clearRocketVersions: () => void;
  
  // New function to load a specific rocket version
  loadRocketVersion: (versionId: string, originalRocketId: string) => Promise<void>;
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
  
  // Left panel state
  userSimulations: [],
  userChatSessions: [],
  userStats: null,
  isLoadingPanelData: true,
  
  // Version control state
  rocketVersions: [],
  isLoadingVersions: false,
  
  // Core actions
  updateRocket: (fn, skipAutoSave) => {
    const newRocket = fn(structuredClone(get().rocket));
    set({ rocket: newRocket });
    
    // Auto-save to database if connected (non-blocking)
    if (get().isDatabaseConnected && !skipAutoSave) {
      // Check if this is an existing rocket (has a saved version) 
      // Use a more robust check for existing rockets
      const currentRocket = get().rocket;
      const existingRocket = get().savedRockets.find(r => r.id === currentRocket.id);
      
      if (existingRocket) {
        // This is an existing rocket - save new version
        console.log('🔄 Saving version for existing rocket:', currentRocket.name);
        get().saveRocketVersionWithDescription('Auto-saved changes', 'user_edit');
      } else {
        // This is a new rocket - only save if it has a proper name and isn't a temporary rocket
        if (currentRocket.name && !currentRocket.name.includes('Default') && !currentRocket.id.includes('local-')) {
          console.log('💾 Saving new rocket:', currentRocket.name);
          get().saveCurrentRocket();
        } else {
          console.log('⏭️ Skipping auto-save for temporary/default rocket');
        }
      }
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
      // Check if rocket already exists in database
      const existingRocket = state.savedRockets.find(r => r.id === state.rocket.id);
      
      if (existingRocket) {
        // Update existing rocket instead of creating new one
        console.log('🔄 Updating existing rocket:', state.rocket.name);
        await databaseService.updateRocket(state.rocket);
        // Refresh saved rockets list
        get().loadUserRockets();
      } else {
        // Save as new rocket
        console.log('💾 Saving new rocket:', state.rocket.name);
        const saved = await saveRocketToDb(state.rocket);
        if (saved) {
          console.log('Rocket saved to database successfully');
          // Update saved rockets list
          get().loadUserRockets();
        }
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
      // Reduce timeout from 10000ms to 6000ms (6 seconds)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database initialization timeout')), 6000)
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
  },
  
  // Left panel actions
  loadRocket: (rocket) => {
    console.log('🚀 Loading rocket:', rocket.name, 'ID:', rocket.id);
    set({ rocket });
    // Clear version history when switching rockets
    get().clearRocketVersions();
    // Load version history for the new rocket (if it has an ID from database)
    if (get().isDatabaseConnected && rocket.id && !rocket.id.includes('local-')) {
      get().loadRocketVersions();
    }
  },
  
  createAndLoadNewRocket: async (name, template = 'basic') => {
    const newRocket = await createNewRocket(name, template);
    if (newRocket) {
      set({ rocket: newRocket });
      // Clear version history for new rockets
      get().clearRocketVersions();
      
      // Auto-save to database if connected (non-blocking)
      if (get().isDatabaseConnected) {
        get().saveCurrentRocket();
      }
    }
  },
  
  deleteRocketFromList: async (rocketId) => {
    await deleteRocket(rocketId);
    get().loadUserRockets();
  },
  
  loadPanelData: async () => {
    try {
      // Clean up orphaned sessions before loading (non-blocking)
      if (get().isDatabaseConnected) {
        cleanupOrphanedSessions().catch(error => 
          console.warn('Session cleanup failed:', error)
        );
      }
      
      const userSimulations = await getUserSimulations();
      const userChatSessions = await getUserChatSessions();
      const userStats = await getUserStats();
      
      set({ 
        userSimulations,
        userChatSessions,
        userStats,
        isLoadingPanelData: false
      });
    } catch (error) {
      console.warn('Failed to load panel data:', error);
      set({ isLoadingPanelData: false });
    }
  },
  
  refreshPanelData: () => {
    set({ isLoadingPanelData: true });
    get().loadPanelData();
  },
  
  // New actions
  loadChatSession: async (sessionId: string) => {
    if (!get().isDatabaseConnected) return;
    
    try {
      console.log('Loading chat session:', sessionId);
      
      // Get the rocket associated with this session
      const rocketId = await databaseService.getRocketForSession(sessionId);
      
      if (rocketId) {
        // Load the rocket design
        const rocket = await databaseService.loadRocketById(rocketId);
        if (rocket) {
          set({ rocket });
          console.log('Loaded rocket for session:', rocket.name);
        }
      } else {
        console.log('No specific rocket found for session, keeping current rocket');
      }
    } catch (error) {
      console.error('Error loading chat session:', error);
    }
  },
  
  saveRocketVersionWithDescription: async (description?: string, createdByAction?: string) => {
    const state = get();
    if (!state.isDatabaseConnected) return;
    
    // Check if current rocket is saved in database
    const isRocketSaved = state.savedRockets.some(r => r.id === state.rocket.id);
    if (!isRocketSaved) {
      console.log('Cannot create version for unsaved rocket, saving rocket first...');
      // Save the rocket first, then create a version
      await get().saveCurrentRocket();
      return;
    }
    
    try {
      const version = await saveRocketVersion(
        state.rocket.id, 
        state.rocket, 
        description, 
        createdByAction
      );
      if (version) {
        console.log('Rocket version saved:', version.version_number);
        // Refresh version history
        get().loadRocketVersions();
      }
    } catch (error) {
      console.error('Failed to save rocket version:', error);
    }
  },
  
  loadRocketVersions: async () => {
    const state = get();
    if (!state.isDatabaseConnected) return;
    
    // Check if current rocket is saved in database
    const isRocketInDatabase = state.savedRockets.some(r => r.id === state.rocket.id);
    if (!isRocketInDatabase) {
      // This is a new/unsaved rocket, clear version history
      set({ rocketVersions: [], isLoadingVersions: false });
      return;
    }
    
    set({ isLoadingVersions: true });
    try {
      const versions = await getRocketVersions(state.rocket.id);
      set({ rocketVersions: versions, isLoadingVersions: false });
    } catch (error) {
      console.error('Failed to load rocket versions:', error);
      set({ rocketVersions: [], isLoadingVersions: false });
    }
  },
  
  // New function to load a specific rocket version
  loadRocketVersion: async (versionId: string, originalRocketId: string) => {
    const state = get();
    if (!state.isDatabaseConnected) return;
    
    try {
      console.log('🕐 Loading rocket version:', versionId, 'for rocket:', originalRocketId);
      
      // Get the version data
      const version = state.rocketVersions.find(v => v.id === versionId);
      if (!version) {
        console.error('Version not found:', versionId);
        return;
      }
      
      // Load the rocket from database using the original rocket ID
      const versionRocket = await loadRocketById(originalRocketId);
      if (versionRocket) {
        // Load the version rocket (this will maintain chat history since ID is preserved)
        set({ rocket: versionRocket });
        console.log('✅ Loaded version rocket with preserved ID for chat history');
      }
      
    } catch (error) {
      console.error('Failed to load rocket version:', error);
    }
  },
  
  revertToVersion: async (versionId: string) => {
    const state = get();
    if (!state.isDatabaseConnected) return;
    
    try {
      const revertedRocket = await revertToRocketVersion(state.rocket.id, versionId);
      if (revertedRocket) {
        set({ rocket: revertedRocket });
        console.log('Reverted to version:', versionId);
        // Refresh version history
        get().loadRocketVersions();
      }
    } catch (error) {
      console.error('Failed to revert to version:', error);
    }
  },
  
  clearRocketVersions: () => {
    set({ rocketVersions: [] });
  }
}));

// Initialize database connection when store is created (with better error handling)
if (typeof window !== 'undefined') {
  // Increase delay from 1000ms to 2000ms to wait for auth to fully settle
  setTimeout(() => {
    const state = useRocket.getState();
    if (!state.initializationAttempted) {
      state.initializeDatabase();
    }
  }, 2000); // Wait 2 seconds for auth to settle
} 