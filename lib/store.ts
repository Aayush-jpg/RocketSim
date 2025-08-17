import { create } from 'zustand';
import { 
  Rocket, 
  SimulationResult, 
  EnvironmentConfig, 
  LaunchParameters,
  MonteCarloResult,
  StabilityAnalysis,
  MotorAnalysis,
  RecoveryPrediction,
  Project
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
  cleanupOrphanedSessions,
  // Project functions
  createProject,
  getUserProjects,
  updateProject,
  deleteProject,
  getProjectRockets,
  getLatestProjectRocket,
  getChatHistoryByProject,
  updateRocket
} from '@/lib/services/database.service';
import { getDefaultRocket } from '@/lib/data/templates';
import { AnalysisService } from '@/lib/services/analysis.service';

// Use centralized default rocket from templates
const DEFAULT_ROCKET = getDefaultRocket();

// Default environment configuration
export const DEFAULT_ENVIRONMENT: EnvironmentConfig = {
  latitude_deg: 0.0,
  longitude_deg: 0.0,
  elevation_m: 0.0,
  wind_speed_m_s: 0.0,
  wind_direction_deg: 0.0,
  atmospheric_model: "standard",
  atmospheric_profile: undefined
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
  autoQuickSim: boolean;
  
  // Database integration state
  isDatabaseConnected: boolean;
  currentSessionId: string | null;
  savedRockets: Rocket[];
  isSaving: boolean;
  initializationAttempted: boolean;
  
  // Project state (new)
  currentProject: Project | null;
  savedProjects: Project[];
  
  // Left panel state
  userSimulations: any[];
  userChatSessions: any[];
  userStats: { rocketsCount: number; simulationsCount: number; messagesCount: number } | null;
  isLoadingPanelData: boolean;
  
  // Version control state
  rocketVersions: any[];
  isLoadingVersions: boolean;
  
  // Project-related state
  projectPagination: {
    currentPage: number
    totalCount: number
    hasMore: boolean
    isLoadingMore: boolean
  }
  
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
  setAutoQuickSim: (enabled: boolean) => void;
  
  // Database actions
  saveCurrentRocket: () => Promise<void>;
  loadUserRockets: () => Promise<void>;
  initializeDatabase: () => Promise<void>;
  saveChatMessage: (role: 'user' | 'assistant' | 'system', content: string, actions?: any) => Promise<void>;
  
  // Project actions (new)
  loadProject: (projectId: string) => Promise<void>;
  createAndLoadNewProject: (name: string, template?: 'basic' | 'advanced' | 'sport') => Promise<void>;
  loadUserProjects: () => Promise<void>;
  loadMoreProjects: () => Promise<void>;
  
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
  autoQuickSim: false,
  
  // Database state
  isDatabaseConnected: false,
  currentSessionId: null,
  savedRockets: [],
  isSaving: false,
  initializationAttempted: false,
  
  // Project state (new)
  currentProject: null,
  savedProjects: [],
  
  // Left panel state
  userSimulations: [],
  userChatSessions: [],
  userStats: null,
  isLoadingPanelData: true,
  
  // Version control state
  rocketVersions: [],
  isLoadingVersions: false,
  
  // Project-related state
  projectPagination: {
    currentPage: 1,
    totalCount: 0,
    hasMore: true,
    isLoadingMore: false
  },
  
  // Core actions
  updateRocket: (fn, skipAutoSave) => {
    const newRocket = fn(structuredClone(get().rocket));
    console.log('🔍 Store: Rocket updated:', {
      id: newRocket.id,
      name: newRocket.name,
      fin_count: newRocket.fins?.[0]?.fin_count,
      parachute_cd_s: newRocket.parachutes?.[0]?.cd_s_m2,
      motor_id: newRocket.motor?.motor_database_id,
      skipAutoSave: skipAutoSave
    });
    set({ rocket: newRocket });
    
    // Auto-save to database if connected (non-blocking)
    if (get().isDatabaseConnected && !skipAutoSave) {
      // CRITICAL FIX: Use more robust logic to determine if rocket should be auto-saved
      const currentRocket = get().rocket;
      
      // Skip auto-save for temporary/default rockets
      if (!currentRocket.name || currentRocket.name.includes('Default') || currentRocket.id.includes('local-') || currentRocket.id.includes('temp-')) {
        console.log('⏭️ Skipping auto-save for temporary/default rocket');
        return;
      }
      
      // Check if this rocket has a valid database ID (not a local/temp ID)
      const hasValidDatabaseId = currentRocket.id && 
        !currentRocket.id.includes('local-') && 
        !currentRocket.id.includes('temp-') && 
        currentRocket.id.length > 20; // UUIDs are longer than 20 chars
      
      if (hasValidDatabaseId) {
        // This is an existing rocket - update it directly instead of creating versions
        console.log('🔄 Auto-updating existing rocket:', currentRocket.name);
        // Use updateRocket instead of saveRocketVersion to prevent version proliferation
        get().saveCurrentRocket();
      } else {
        // This is a new rocket - save it
        console.log('💾 Auto-saving new rocket:', currentRocket.name);
        get().saveCurrentRocket();
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
          const simulationResult = await saveSimulationToDb(
            savedRocket.id, // Use DB rocket ID, not store rocket ID
            sim, 
            state.lastSimulationType
          );
          
          if (simulationResult) {
            // Save analysis results to analysis_results table
            await AnalysisService.saveAnalysisResult(
              savedRocket.id,
              'flight_simulation',
              {
                fidelity: state.lastSimulationType,
                maxAltitude: sim.maxAltitude,
                maxVelocity: sim.maxVelocity,
                maxAcceleration: sim.maxAcceleration,
                apogeeTime: sim.apogeeTime,
                stabilityMargin: sim.stabilityMargin,
                thrustCurve: sim.thrustCurve,
                flightEvents: sim.flightEvents,
                trajectory: sim.trajectory
              },
              {
                environment: state.environment,
                launchParameters: state.launchParameters
              },
              simulationResult.id
            );
            
            // Save key performance metrics to performance_metrics table
            await Promise.all([
              AnalysisService.savePerformanceMetrics(savedRocket.id, 'max_altitude', sim.maxAltitude || 0, { units: 'm', fidelity: state.lastSimulationType }),
              AnalysisService.savePerformanceMetrics(savedRocket.id, 'max_velocity', sim.maxVelocity || 0, { units: 'm/s', fidelity: state.lastSimulationType }),
              AnalysisService.savePerformanceMetrics(savedRocket.id, 'stability_margin', sim.stabilityMargin || 0, { units: 'cal', fidelity: state.lastSimulationType }),
              AnalysisService.savePerformanceMetrics(savedRocket.id, 'apogee_time', sim.apogeeTime || 0, { units: 's', fidelity: state.lastSimulationType })
            ]);
          }
          
          console.log('Simulation and analysis results saved successfully');
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
  setMonteCarloResult: async (monteCarloResult) => {
    set({ monteCarloResult });
    
    // Auto-save Monte Carlo results to database
    if (monteCarloResult && get().isDatabaseConnected) {
      const state = get();
      try {
        const savedRocket = await saveRocketToDb(state.rocket);
        if (savedRocket) {
          await AnalysisService.saveAnalysisResult(
            savedRocket.id,
            'monte_carlo',
            {
              nominal: monteCarloResult.nominal,
              statistics: monteCarloResult.statistics,
              iterations: monteCarloResult.iterations,
              landingDispersion: monteCarloResult.landingDispersion,
              analysisType: 'monte_carlo_uncertainty',
              iterationCount: monteCarloResult.iterations?.length || 0
            },
            {
              environment: state.environment,
              launchParameters: state.launchParameters
            }
          );
          console.log('✅ Monte Carlo results saved to database');
        }
      } catch (error) {
        console.warn('Failed to save Monte Carlo results:', error);
      }
    }
  },
  
  setStabilityAnalysis: async (stabilityAnalysis) => {
    set({ stabilityAnalysis });
    
    // Auto-save Stability Analysis to database
    if (stabilityAnalysis && get().isDatabaseConnected) {
      const state = get();
      try {
        const savedRocket = await saveRocketToDb(state.rocket);
        if (savedRocket) {
          await AnalysisService.saveAnalysisResult(
            savedRocket.id,
            'stability',
            {
              staticMargin: stabilityAnalysis.staticMargin,
              centerOfMass: stabilityAnalysis.center_of_mass,
              centerOfPressure: stabilityAnalysis.center_of_pressure,
              rating: stabilityAnalysis.rating,
              recommendations: stabilityAnalysis.recommendations,
              analysisType: 'static_stability',
              stabilityRating: stabilityAnalysis.stability_rating
            },
            {
              rocketConfiguration: {
                noseCone: state.rocket.nose_cone,
                bodyTubes: state.rocket.body_tubes,
                fins: state.rocket.fins
              }
            }
          );
          console.log('✅ Stability analysis saved to database');
        }
      } catch (error) {
        console.warn('Failed to save stability analysis:', error);
      }
    }
  },
  
  setMotorAnalysis: async (motorAnalysis) => {
    set({ motorAnalysis });
    
    // Auto-save Motor Analysis to database
    if (motorAnalysis && get().isDatabaseConnected) {
      const state = get();
      try {
        const savedRocket = await saveRocketToDb(state.rocket);
        if (savedRocket) {
          await AnalysisService.saveAnalysisResult(
            savedRocket.id,
            'motor',
            {
              totalImpulse: motorAnalysis.totalImpulse,
              averageThrust: motorAnalysis.averageThrust,
              burnTime: motorAnalysis.burnTime,
              specificImpulse: motorAnalysis.specificImpulse,
              thrustToWeight: motorAnalysis.thrustToWeight,
              impulseClass: motorAnalysis.impulseClass,
              analysisType: 'motor_performance',
              recommendations: motorAnalysis.recommendations
            },
            {
              motorConfiguration: state.rocket.motor
            }
          );
          console.log('✅ Motor analysis saved to database');
        }
      } catch (error) {
        console.warn('Failed to save motor analysis:', error);
      }
    }
  },
  
  setRecoveryPrediction: async (recoveryPrediction) => {
    set({ recoveryPrediction });
    
    // Auto-save Recovery Prediction to database
    if (recoveryPrediction && get().isDatabaseConnected) {
      const state = get();
      try {
        const savedRocket = await saveRocketToDb(state.rocket);
        if (savedRocket) {
          await AnalysisService.saveAnalysisResult(
            savedRocket.id,
            'recovery',
            {
              driftDistance: recoveryPrediction.driftDistance,
              landingVelocity: recoveryPrediction.landingVelocity,
              analysisType: 'recovery_system'
            },
            {
              parachuteConfiguration: state.rocket.parachutes,
              environment: state.environment,
              launchParameters: state.launchParameters
            }
          );
          console.log('✅ Recovery prediction saved to database');
        }
      } catch (error) {
        console.warn('Failed to save recovery prediction:', error);
      }
    }
  },
  
  // UI actions
  setSimulating: (isSimulating) => set({ isSimulating }),
  setSimulationProgress: (simulationProgress) => set({ simulationProgress }),
  setLastSimulationType: (lastSimulationType) => set({ lastSimulationType }),
  setSimulationMessage: (message) => set({ simulationMessage: message }),
  setAutoQuickSim: (enabled) => set({ autoQuickSim: enabled }),
  
  // Database actions
  saveCurrentRocket: async () => {
    const state = get();
    if (state.isSaving) return; // Prevent concurrent saves
    
    set({ isSaving: true });
    try {
      // CRITICAL FIX: Better logic to determine if rocket exists in database
      const currentRocket = state.rocket;
      
      // Check if rocket has a valid database ID
      const hasValidDatabaseId = currentRocket.id && 
        !currentRocket.id.includes('local-') && 
        !currentRocket.id.includes('temp-') && 
        currentRocket.id.length > 20; // UUIDs are longer than 20 chars
      
      if (hasValidDatabaseId) {
        // This rocket has a database ID - try to update it first
        console.log('🔄 Attempting to update existing rocket:', currentRocket.name);
        const updatedRocket = await databaseService.updateRocket(currentRocket);
        
        if (updatedRocket) {
          console.log('✅ Successfully updated existing rocket');
          // Refresh saved rockets list
          get().loadUserRockets();
        } else {
          // Update failed, might be a new rocket - try to save as new
          console.log('⚠️ Update failed, trying to save as new rocket');
          const saved = await saveRocketToDb(currentRocket);
          if (saved) {
            console.log('✅ Saved as new rocket successfully');
            // Refresh saved rockets list
            get().loadUserRockets();
          }
        }
      } else {
        // This is definitely a new rocket - save it
        console.log('💾 Saving new rocket:', currentRocket.name);
        const saved = await saveRocketToDb(currentRocket);
        if (saved) {
          console.log('✅ Rocket saved to database successfully');
          // Refresh saved rockets list
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
      console.log('🔍 initializeDatabase: Already attempted, skipping...');
      return; // Prevent multiple initialization attempts
    }
    
    console.log('🔍 initializeDatabase: Starting database initialization...');
    set({ initializationAttempted: true });
    
    try {
      // Reduce timeout from 10000ms to 6000ms (6 seconds)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database initialization timeout')), 6000)
      );
      
      const initPromise = (async () => {
        console.log('🔍 initializeDatabase: Testing database connection...');
        // Test database connection
        const isConnected = await databaseService.testConnection();
        console.log('🔍 initializeDatabase: Connection result:', isConnected);
        
        if (isConnected) {
          console.log('🔍 initializeDatabase: Getting session ID...');
          // Get or create session
          const sessionId = await getCurrentSessionId();
          console.log('🔍 initializeDatabase: Session ID:', sessionId);
          
          console.log('🔍 initializeDatabase: Loading user rockets...');
          // Load user rockets
          const rockets = await databaseService.loadUserRockets();
          console.log('🔍 initializeDatabase: Loaded rockets:', rockets.length);
          
          set({ 
            isDatabaseConnected: true, 
            currentSessionId: sessionId,
            savedRockets: rockets
          });
          
          console.log('✅ initializeDatabase: Database initialized successfully');
        } else {
          console.warn('⚠️ initializeDatabase: Database connection failed - running in offline mode');
          set({ isDatabaseConnected: false });
        }
      })();
      
      await Promise.race([initPromise, timeoutPromise]);
      
    } catch (error) {
      console.warn('❌ initializeDatabase: Database initialization failed:', error);
      set({ isDatabaseConnected: false });
    }
  },
  
  saveChatMessage: async (role, content, actions) => {
    const state = get();
    if (!state.isDatabaseConnected) {
      return; // Graceful degradation - just don't save
    }
    
    try {
      // For the new project-based chat system, we need a project ID
      // If we have a current project, use that, otherwise try to get/create one
      let projectId = state.currentProject?.id;
      
      if (!projectId && state.rocket.project_id) {
        projectId = state.rocket.project_id;
      }
      
      if (!projectId) {
        // Create a project for this rocket if none exists
        const newProject = await createProject(state.rocket.name);
        if (newProject) {
          projectId = newProject.id;
          // Database now returns proper Project type
          set({ currentProject: newProject as Project });
        }
      }
      
      if (projectId) {
        // Use new project-based chat saving
      await saveChatToDb(
          [{ role, content, agent: actions?.agent }],
          projectId,
          state.rocket.id
        );
      } else {
        // Fallback to old method if no project (should not happen in practice)
        console.warn('No project ID available for chat message, skipping save');
      }
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
    
    // CRITICAL FIX: Better logic to check if rocket is saved
    const currentRocket = state.rocket;
    
    // Check if rocket has a valid database ID
    const hasValidDatabaseId = currentRocket.id && 
      !currentRocket.id.includes('local-') && 
      !currentRocket.id.includes('temp-') && 
      currentRocket.id.length > 20; // UUIDs are longer than 20 chars
    
    if (!hasValidDatabaseId) {
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
    
    // Check if current rocket has a valid database ID
    // For project rockets, we don't need to check savedRockets since they come from database
    const hasValidRocketId = state.rocket.id && !state.rocket.id.includes('local-') && !state.rocket.id.includes('temp-');
    
    if (!hasValidRocketId) {
      // This is a new/unsaved rocket, clear version history
      console.log('🔧 loadRocketVersions: Rocket has no valid database ID, clearing versions');
      set({ rocketVersions: [], isLoadingVersions: false });
      return;
    }
    
    console.log('🔧 loadRocketVersions: Loading versions for rocket ID:', state.rocket.id);
    set({ isLoadingVersions: true });
    
    try {
      const versions = await getRocketVersions(state.rocket.id);
      console.log('🔧 loadRocketVersions: Found', versions.length, 'versions');
      set({ rocketVersions: versions, isLoadingVersions: false });
    } catch (error) {
      console.error('❌ loadRocketVersions: Failed to load rocket versions:', error);
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
  },

  // Project actions (new implementations)
  loadProject: async (projectId: string) => {
    const state = get();
    if (!state.isDatabaseConnected) return;
    
    try {
      console.log('🚀 loadProject: Loading project ID:', projectId);
      
      // Check if project is already in savedProjects
      let project = state.savedProjects.find(p => p.id === projectId);
      
      if (!project) {
        // Project not in current list, load it specifically
        // For now, we'll load all projects to find this one
        // TODO: Implement a getProjectById function for better performance
        const result = await getUserProjects(100, 0); // Load more to find the project
        const dbProject = result.projects.find((p: any) => p.id === projectId);
        if (dbProject) {
          project = dbProject as Project;
        }
      }
      
      if (project) {
        console.log('🚀 loadProject: Found project:', project.name);
        
        // CRITICAL FIX: Set currentProject IMMEDIATELY to prevent race conditions
        set({ currentProject: project });
        console.log('✅ loadProject: currentProject set synchronously');
        
        // Load latest rocket from this project
        const latestRocket = await getLatestProjectRocket(projectId);
        console.log('🚀 loadProject: Latest rocket from DB:', latestRocket);
        
        if (latestRocket) {
          // Use loadRocketById to get the properly converted rocket
          const rocket = await loadRocketById(latestRocket.id);
          if (rocket) {
            // CRITICAL FIX: Ensure project_id is set on the rocket
            rocket.project_id = projectId;
            console.log('🚀 loadProject: Setting rocket with project_id:', projectId);
            
            // Add rocket to savedRockets array if not already there
            const existingRocketIndex = state.savedRockets.findIndex(r => r.id === rocket.id);
            const updatedSavedRockets = [...state.savedRockets];
            if (existingRocketIndex >= 0) {
              updatedSavedRockets[existingRocketIndex] = rocket;
            } else {
              updatedSavedRockets.unshift(rocket); // Add to beginning of list
            }
            
            set({ 
              rocket,
              savedRockets: updatedSavedRockets
            });
            
            // Clear and reload version history for this rocket
            get().clearRocketVersions();
            get().loadRocketVersions();
            
            console.log('✅ loadProject: Successfully loaded project rocket with ID:', rocket.id);
          } else {
            console.warn('⚠️ loadProject: Failed to convert rocket from database');
          }
        } else {
          console.log('⚠️ loadProject: No rockets found in project, keeping current rocket');
          // If no rockets in project, clear current rocket's project association
          const currentRocket = { ...state.rocket };
          currentRocket.project_id = undefined;
          set({ rocket: currentRocket });
        }
        
        console.log('✅ loadProject: Project loaded successfully:', project.name);
      } else {
        console.error('❌ loadProject: Project not found:', projectId);
      }
    } catch (error) {
      console.error('❌ loadProject: Failed to load project:', error);
    }
  },

  createAndLoadNewProject: async (name: string, template = 'basic') => {
    try {
      // Create new project
      const newProject = await createProject(name, `New rocket project: ${name}`);
      if (!newProject) throw new Error('Failed to create project');
      
      // Create new rocket for this project
      const newRocket = await createNewRocket(name, template);
      if (!newRocket) throw new Error('Failed to create rocket');
      
      // Set project ID on rocket
      newRocket.project_id = newProject.id;
      
      // Save rocket to database with project ID
      const savedRocket = await saveRocketToDb(newRocket, newProject.id);
      
      if (savedRocket) {
        set({ 
          currentProject: newProject as Project,
          rocket: newRocket
        });
        
        // Refresh project list
        get().loadUserProjects();
        
        console.log('Created new project and rocket:', name);
      }
    } catch (error) {
      console.error('Failed to create new project:', error);
    }
  },

  loadUserProjects: async () => {
    console.log('🔍 loadUserProjects: Starting to load user projects...');
    try {
      const result = await getUserProjects(20, 0); // Load first 20 projects
      console.log('🔍 loadUserProjects: Raw result from database:', result);
      console.log('🔍 loadUserProjects: Projects count:', result.projects.length);
      console.log('🔍 loadUserProjects: Total count:', result.totalCount);
      
      // Database now returns proper Project types, no conversion needed
      const projects = result.projects as Project[];
      console.log('🔍 loadUserProjects: Projects:', projects);
      
      set({ 
        savedProjects: projects,
        projectPagination: {
          currentPage: 1,
          totalCount: result.totalCount,
          hasMore: result.projects.length < result.totalCount,
          isLoadingMore: false
        }
      });
      console.log('🔍 loadUserProjects: Successfully set projects in store');
    } catch (error) {
      console.error('❌ loadUserProjects: Failed to load user projects:', error);
      set({ 
        savedProjects: [],
        projectPagination: {
          currentPage: 1,
          totalCount: 0,
          hasMore: false,
          isLoadingMore: false
        }
      });
    }
  },

  loadMoreProjects: async () => {
    const state = get();
    if (!state.projectPagination.hasMore || state.projectPagination.isLoadingMore) {
      return;
    }

    console.log('🔍 loadMoreProjects: Loading more projects...');
    set({ 
      projectPagination: { 
        ...state.projectPagination, 
        isLoadingMore: true 
      } 
    });

    try {
      const offset = state.savedProjects.length;
      const result = await getUserProjects(20, offset);
      console.log('🔍 loadMoreProjects: Loaded additional projects:', result.projects.length);
      
      // Database now returns proper Project types, no conversion needed
      const newProjects = result.projects as Project[];
      const allProjects = [...state.savedProjects, ...newProjects];
      
      set({ 
        savedProjects: allProjects,
        projectPagination: {
          currentPage: state.projectPagination.currentPage + 1,
          totalCount: result.totalCount,
          hasMore: allProjects.length < result.totalCount,
          isLoadingMore: false
        }
      });
      console.log('🔍 loadMoreProjects: Successfully loaded more projects. Total:', allProjects.length);
    } catch (error) {
      console.error('❌ loadMoreProjects: Failed to load more projects:', error);
      set({ 
        projectPagination: { 
          ...state.projectPagination, 
          isLoadingMore: false 
        } 
      });
    }
  },
}));

// Initialize database connection when store is created (with better error handling)
if (typeof window !== 'undefined') {
  let initTimeout: NodeJS.Timeout | null = null;
  
  // Watch for auth state changes to reinitialize database if needed
  const checkAuth = () => {
    // Clear any existing timeout to prevent duplicate initialization
    if (initTimeout) {
      clearTimeout(initTimeout);
      initTimeout = null;
    }
    
    const delay = 2000; // Wait 2 seconds for auth to settle
    initTimeout = setTimeout(() => {
    const state = useRocket.getState();
    if (!state.initializationAttempted) {
        console.log('🔌 Initializing database after auth settled');
      state.initializeDatabase();
      }
      initTimeout = null;
    }, delay);
  };
  
  // Initial check
  checkAuth();
  
  // Listen for auth state changes (but debounce to prevent multiple initializations)
  let authDebounceTimeout: NodeJS.Timeout | null = null;
  const authStateChangeHandler = () => {
    if (authDebounceTimeout) {
      clearTimeout(authDebounceTimeout);
    }
    authDebounceTimeout = setTimeout(checkAuth, 500);
  };
  
  // Attach to window for potential auth state change notifications
  (window as any).__rocketAuthChanged = authStateChangeHandler;
  
  // Cleanup on window unload
  window.addEventListener('beforeunload', () => {
    if (initTimeout) clearTimeout(initTimeout);
    if (authDebounceTimeout) clearTimeout(authDebounceTimeout);
  });
} 