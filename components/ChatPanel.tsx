"use client"

import { useState, useRef, useEffect } from 'react'
import { useRocket } from '@/lib/store'
import { dispatchActions } from '@/lib/ai/actions'
import { useAuth } from '@/lib/auth/AuthContext'
import { chatService } from '@/lib/services/chat.service'
import { getChatHistoryByProject, saveChatToDb } from '@/lib/services/database.service'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import FormattedMessage from '@/components/ui/FormattedMessage'

// Chat message type definition
export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  agent?: string; // Add agent field to store which agent handled the message
}
interface ChatPanelProps {
  activeAnalysis?: string | null;
  onAnalysisClick?: (analysisId: string) => void;
  loadSessionId?: string | null;  // Add this prop to trigger loading a specific session
  projectId?: string | null;  // Add this prop to load project-specific conversations
}

export default function ChatPanel({ activeAnalysis, onAnalysisClick, loadSessionId, projectId }: ChatPanelProps) {
  const { user, userSession } = useAuth();
  const { currentProject } = useRocket(); // Get current project from store
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Welcome to ROCKETv1! I can help you design and optimize your rocket. What would you like to work on today?',
      agent: 'master'
    }
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [lastUsedAgent, setLastUsedAgent] = useState<string>('master');
  const [currentlyRunningAgent, setCurrentlyRunningAgent] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Load chat history when component mounts
  useEffect(() => {
    if (user && userSession) {
      loadChatHistory();
    }
  }, [user, userSession]);
  
  // Load specific session when loadSessionId changes
  useEffect(() => {
    if (loadSessionId && loadSessionId !== userSession?.session_id) {
      loadSpecificSessionHistory(loadSessionId);
      // Also load the rocket associated with this session
      useRocket.getState().loadChatSession(loadSessionId);
    }
  }, [loadSessionId]);
  
  // Load project-specific chat history when currentProject changes
  useEffect(() => {
    if (currentProject && user) {
      loadProjectChatHistory(currentProject.id);
    } else if (!currentProject && user) {
      // No project selected - load default/general chat
      loadChatHistory();
    }
  }, [currentProject, user]);
  
  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);
  
  // Load previous chat messages from database
  const loadChatHistory = async () => {
    if (!user || !userSession) return;
    
    try {
      const history = await chatService.getChatHistory(userSession.session_id, 50);
      if (history.length > 0) {
        const formattedHistory = history.map((msg: any) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          agent: msg.context_data?.agent || 'master'
        }));
        setMessages([
          {
            role: 'assistant',
            content: 'Welcome back to ROCKETv1! Your previous conversation has been restored. How can I help you today?',
            agent: 'master'
          },
          ...formattedHistory
        ]);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };
  
  // Load chat history from a specific session
  const loadSpecificSessionHistory = async (sessionId: string) => {
    if (!user) return;
    
    try {
      const history = await chatService.getChatHistory(sessionId, 50);
      if (history.length > 0) {
        const formattedHistory = history.map((msg: any) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          agent: msg.context_data?.agent || 'master'
        }));
        setMessages([
          {
            role: 'assistant',
            content: `Switched to previous session. You can continue designing from where you left off!`,
            agent: 'system'
          },
          ...formattedHistory
        ]);
      } else {
        setMessages([
          {
            role: 'assistant',
            content: 'No messages found in this chat session. Start a new conversation!',
            agent: 'system'
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading session history:', error);
      setMessages([
        {
          role: 'assistant',
          content: 'Error loading chat session. Please try again.',
          agent: 'error'
        }
      ]);
    }
  };
  
  // Load chat history for a specific project
  const loadProjectChatHistory = async (projectId: string) => {
    if (!user) return;
    
    console.log('🚀 Loading project chat history for project ID:', projectId);
    setIsLoadingHistory(true);
    
    // Show loading state immediately
    setMessages([
      {
        role: 'assistant',
        content: '⏳ Loading your project chat history... This may take a few seconds.',
        agent: 'system'
      }
    ]);
    
    try {
      // Use the new project-based chat history function with timeout
      const history = await getChatHistoryByProject(projectId, 100);
      console.log('🚀 Found', history.length, 'messages for project', projectId);
      
      if (history.length > 0) {
        const formattedHistory = history.map((msg: any) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          agent: msg.context_data?.agent || 'master'
        }));
        setMessages([
          {
            role: 'assistant',
            content: `✅ Welcome back to your project! Found ${history.length} messages in your conversation history.`,
            agent: 'system'
          },
          ...formattedHistory
        ]);
        console.log('🚀 Successfully loaded project chat history');
      } else {
        setMessages([
          {
            role: 'assistant',
            content: 'Welcome to your new project! Let\'s start designing your rocket. 🚀',
            agent: 'system'
          }
        ]);
      }
    } catch (error) {
      console.error('❌ Error loading project chat history:', error);
      setMessages([
        {
          role: 'assistant',
          content: '⚠️ There was an issue loading your chat history, but we can start fresh! How can I help you with your rocket design?',
          agent: 'master'
        }
      ]);
    } finally {
      setIsLoadingHistory(false);
    }
  };
  
  // Save message to database
  const saveMessage = async (message: ChatMessage, context?: any) => {
    if (!user) return;
    
    // CRITICAL DEBUG: Log current project and rocket state
    console.log('🔍 DEBUG saveMessage called with:');
    console.log('   - currentProject:', currentProject);
    console.log('   - currentProject.id:', currentProject?.id);
    console.log('   - user:', user?.id);
    console.log('   - message role:', message.role);
    console.log('   - message content length:', message.content?.length);
    
    // Get current rocket state
    const rocketState = useRocket.getState();
    const currentRocketId = context?.rocketId || rocketState.rocket?.id;
    
    // CRITICAL FIX: Handle race condition where no project is loaded yet
    let targetProjectId = currentProject?.id;
    
    if (!targetProjectId) {
      console.log('⚠️ No current project detected, attempting fallback...');
      
      // FALLBACK 1: Check if rocket has project_id
      if (rocketState.rocket?.project_id) {
        targetProjectId = rocketState.rocket.project_id;
        console.log('📋 Using project_id from rocket:', targetProjectId);
      } else {
        // FALLBACK 2: Auto-create a project for this conversation
        console.log('🏗️ Auto-creating project for orphaned conversation...');
        try {
          const { createProject } = await import('@/lib/services/database.service');
          const newProject = await createProject('Chat Session', 'Conversation started without a project');
          
          if (newProject) {
            targetProjectId = newProject.id;
            // Update the store with the new project
            useRocket.setState({ 
              currentProject: newProject as any,
              rocket: { 
                ...rocketState.rocket, 
                project_id: newProject.id 
              }
            });
            console.log('✅ Auto-created project:', targetProjectId);
          }
        } catch (error) {
          console.error('❌ Failed to auto-create project:', error);
        }
      }
    }
    
    if (!targetProjectId) {
      console.log('❌ Still no project available, skipping chat message save');
      console.log('   - currentProject object:', JSON.stringify(currentProject, null, 2));
      return;
    }
    
    console.log('💾 Saving message to project:', targetProjectId, 'rocket:', currentRocketId);
    
    try {
      // Use the new project-based chat saving function
      const success = await saveChatToDb(
        [{
          role: message.role,
          content: message.content,
          agent: message.agent
        }],
        targetProjectId,
        currentRocketId
      );
      
      if (success) {
        console.log('✅ Message saved successfully to project');
      } else {
        console.error('❌ Failed to save message to project');
      }
    } catch (error) {
      console.error('❌ Error saving message to project:', error);
    }
  };
  
  // Suggested commands
  const quickActions = [
     "Optimize fin design" ,
     "Add a nose cone" ,
     "Run a simulation" ,
     "Make body longer" ,
     "Paint it red" ,
  ];
  
  // Send message to AI service
  async function sendMessage(msg: string) {
    if (!msg.trim()) return;
    
    // Remove read-only restriction - allow sending messages to any loaded session
    
    // Add user message to chat
    const userMessage: ChatMessage = { role: 'user', content: msg };
    const history = [...messages, userMessage];
    setMessages(history);
    setInputValue('');
    setIsLoading(true);
    setCurrentlyRunningAgent(lastUsedAgent);
    
    try {
      // Get rocket data from store
      const rocket = useRocket.getState().rocket;
      console.log('Sending request to agent with rocket data:', JSON.stringify(rocket, null, 2));
      
      // Gather environment data from global state
      let environment = null;
      if (typeof window !== 'undefined' && window.environmentConditions) {
        const envConditions = window.environmentConditions;
        environment = {
          temperature: envConditions.temperature,
          pressure: envConditions.pressure,
          humidity: envConditions.humidity,
          windSpeed: envConditions.windSpeed,
          windDirection: envConditions.windDirection,
          visibility: envConditions.visibility,
          cloudCover: envConditions.cloudCover,
          dewPoint: envConditions.dewPoint,
          location: {
            lat: envConditions.latitude,
            lon: envConditions.longitude,
            elevation: envConditions.elevation,
            city: envConditions.locationName || null,
            country: null // Could be added if available
          },
          weatherSource: envConditions.weatherSource,
          timestamp: envConditions.timestamp
        };
        console.log('Including environment data:', environment);
      }
      
      // Prepare comprehensive request payload
      const requestPayload: any = {
        history,
        rocket,
        preferredAgent: lastUsedAgent
      };
      
      // Add environment data if available
      if (environment) {
        requestPayload.environment = environment;
      }
      
      // Add other context data if available from global state
      if (typeof window !== 'undefined') {
        // Simulation history could be stored in global state or Zustand
        const simulationState = useRocket.getState().sim;
        if (simulationState) {
          requestPayload.simulationHistory = [{
            maxAltitude: simulationState.maxAltitude,
            maxVelocity: simulationState.maxVelocity,
            maxAcceleration: simulationState.maxAcceleration,
            apogeeTime: simulationState.apogeeTime,
            stabilityMargin: simulationState.stabilityMargin,
            thrustCurve: simulationState.thrustCurve,
            trajectory: simulationState.trajectory,
            flightEvents: simulationState.flightEvents,
            fidelity: simulationState.simulationFidelity || 'quick',
            timestamp: new Date().toISOString()
          }];
        }
        
        // User preferences from localStorage or other global state
        const storedPreferences = localStorage.getItem('userPreferences');
        if (storedPreferences) {
          try {
            requestPayload.userPreferences = JSON.parse(storedPreferences);
          } catch (e) {
            console.warn('Failed to parse user preferences:', e);
          }
        }
        
        // Session info
        requestPayload.sessionInfo = {
          sessionId: sessionStorage.getItem('sessionId') || 'unknown',
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          messageCount: history.length,
          lastAgent: lastUsedAgent
        };
      }
      
      // Call agent API
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload)
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Agent API error:', res.status, errorText);
        throw new Error(`Failed to get response from agent: ${res.status} ${errorText.slice(0, 100)}`);
      }
      
      const json = await res.json();
      console.log('Received response from agent:', JSON.stringify(json, null, 2));
      
      // If agent changed during processing, show a transition animation
      if (json.agent_used && json.agent_used !== lastUsedAgent) {
        setCurrentlyRunningAgent(json.agent_used);
        // Give time to see the transition animation
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      
      // Apply actions returned by the agent
      if (json.actions) {
        try {
          console.log('🔍 Raw actions from agent:', json.actions);
          const actions = JSON.parse(json.actions || '[]');
          console.log('🔍 Parsed actions:', actions);
          
          if (actions.length > 0) {
            console.log(`🎯 About to dispatch ${actions.length} actions...`);
            console.log('🎯 Actions to dispatch:', actions);
            
            // Get current rocket state before dispatching
            const rocketBefore = useRocket.getState().rocket;
            // Create parts count for logging compatibility
            const partsBefore = (rocketBefore.nose_cone ? 1 : 0) + rocketBefore.body_tubes.length + rocketBefore.fins.length + rocketBefore.parachutes.length + (rocketBefore.motor ? 1 : 0);
            console.log('🚀 Rocket state BEFORE dispatching actions - parts count:', partsBefore);
            
            dispatchActions(actions);
            
            // Check rocket state after dispatching
            setTimeout(() => {
              const rocketAfter = useRocket.getState().rocket;
              const partsAfter = (rocketAfter.nose_cone ? 1 : 0) + rocketAfter.body_tubes.length + rocketAfter.fins.length + rocketAfter.parachutes.length + (rocketAfter.motor ? 1 : 0);
              console.log('🚀 Rocket state AFTER dispatching actions - parts count:', partsAfter);
              
              // Compare before and after
              const changed = partsBefore !== partsAfter || JSON.stringify(rocketBefore) !== JSON.stringify(rocketAfter);
              console.log('🔄 Rocket changed:', changed);
              
              if (!changed) {
                console.error('❌ PROBLEM: Actions were dispatched but rocket state did not change!');
              } else {
                console.log('✅ SUCCESS: Rocket state updated successfully!');
              }
            }, 100);
          } else {
            console.log('⚠️ No actions to dispatch from agent response');
          }
        } catch (actionError) {
          console.error('❌ Error parsing or dispatching actions:', actionError);
          console.error('❌ Original actions string:', json.actions);
        }
      } else {
        console.log('⚠️ No actions field in agent response');
      }
      
      // Add assistant response to chat
      const assistantMessage: ChatMessage = { 
        role: 'assistant', 
        content: json.final_output,
        agent: json.agent_used // Store the agent that handled this message
      };
      setMessages([...history, assistantMessage]);
      
      // Save both user and assistant messages to database
      await saveMessage(userMessage, { rocket, environment, rocketId: rocket.id });
      await saveMessage(assistantMessage, { actions: json.actions, agentUsed: json.agent_used, rocketId: rocket.id });
      
      // Store which agent was used for next request
      if (json.agent_used) {
        setLastUsedAgent(json.agent_used);
        console.log(`Request handled by agent: ${json.agent_used}`);
      }
    } catch (error) {
      console.error('Error communicating with agent:', error);
      const errorMessage: ChatMessage = { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again later.',
        agent: 'error'
      };
      setMessages([...history, errorMessage]);
    } finally {
      setIsLoading(false);
      setCurrentlyRunningAgent(null);
    }
  }

  const handleSend = () => {
    sendMessage(inputValue);
  };
  
  return (
    <div className="h-full flex flex-col w-full min-w-0">
      {/* Messages */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 w-full min-w-0"
        style={{
          scrollBehavior: 'smooth',
        }}
      >
        {messages.map((message, index) => (
          <motion.div
            key={index}
            className={cn("flex w-full", message.role === "user" ? "justify-end" : "justify-start")}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <div
              className={cn(
                "rounded-2xl backdrop-blur-xl relative shadow-lg border transition-all duration-200",
                message.role === "user"
                  ? "bg-white/95 text-black border-white/20 max-w-[85%] px-4 py-2"
                  : "bg-white/5 text-white border-white/10 w-full px-5 py-4",
              )}
              style={{
                // Ensure proper containment
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
                minWidth: 0,
                maxWidth: '100%',
              }}
            >
              {message.role === 'assistant' && message.agent && (
                <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-[10px] rounded-full px-2 py-0.5 opacity-80 font-medium">
                  {message.agent.replace('_', ' ')}
                </div>
              )}
              <div className="w-full min-w-0 overflow-hidden">
                <FormattedMessage 
                  content={message.content}
                  role={message.role}
                />
              </div>
              {/* Show simulation metrics if this is a simulation message */}
              {message.content.includes('simulation') && useRocket.getState().sim && (
                <div className="mt-6 pt-4 border-t border-white/10">
                  <div className="bg-black/20 rounded-lg p-4 border border-white/5">
                    <h4 className="text-xs font-medium text-white/70 mb-3 uppercase tracking-wide">
                      Simulation Results
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-xs text-gray-400">Max Altitude</span>
                        <div className="font-mono text-white text-base font-semibold">
                          {useRocket.getState().sim?.maxAltitude?.toFixed(0) || '0'}m
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-gray-400">Max Velocity</span>
                        <div className="font-mono text-white text-base font-semibold">
                          {useRocket.getState().sim?.maxVelocity?.toFixed(1) || '0'}m/s
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {/* Typing Indicator */}
        {isLoading && (
          <motion.div
            className="flex justify-start"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-4">
              <div className="flex flex-col items-center space-y-2">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-white/60 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-white/60 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
                {currentlyRunningAgent && (
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="w-3 h-3 rounded-full bg-blue-500 animate-ping opacity-75 relative">
                      <div className="absolute inset-0 rounded-full bg-blue-500 opacity-75"></div>
                    </div>
                    <span className="text-xs text-white animate-pulse">
                      {currentlyRunningAgent === 'router' 
                        ? 'Choosing best agent...' 
                        : `${currentlyRunningAgent.replace('_', ' ')} agent running...`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/5 backdrop-blur-xl bg-black/20 w-full min-w-0">
        <div className="flex space-x-4 w-full min-w-0">
          <div className="flex-1 relative min-w-0">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Describe your rocket design goals..."
              onKeyPress={(e) => e.key === "Enter" && handleSend()}
              className="pr-12 bg-white/5 backdrop-blur-xl border-white/10 focus:border-white/20 rounded-full text-white placeholder:text-white/60 w-full min-w-0"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white text-black rounded-full flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 transition-transform"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex space-x-2 mt-4 w-full flex-wrap min-w-0">
          {quickActions.map((action) => (
            <button
              key={action}
              onClick={() => setInputValue(action)}
              className="px-4 py-2 text-xs bg-white/5 backdrop-blur-xl border border-white/10 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-all"
            >
              {action}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}