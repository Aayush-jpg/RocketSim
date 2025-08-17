"use client"

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRocket } from '@/lib/store'
import { dispatchActions } from '@/lib/ai/actions'
import { useAuth } from '@/lib/auth/AuthContext'
import { chatService } from '@/lib/services/chat.service'
import { getChatHistoryByProject, saveChatToDb } from '@/lib/services/database.service'
import TextareaAutosize from 'react-textarea-autosize'
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
      content: 'Welcome to Rocketez! I can help you design and optimize your rocket. What would you like to work on today?',
      agent: 'master'
    }
  ]);

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [lastUsedAgent, setLastUsedAgent] = useState<string>('master');
  const [currentlyRunningAgent, setCurrentlyRunningAgent] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);
  
  // Chat scroll position persistence
  const [scrollPosition, setScrollPosition] = useState<number>(0);
  const [isManuallyScrolling, setIsManuallyScrolling] = useState(false);
  const scrollPositionKey = `chat-scroll-${projectId || 'default'}`;
  
  // Restore scroll position on mount and when returning from analysis
  useEffect(() => {
    if (!activeAnalysis && chatContainerRef.current) {
      const savedPosition = sessionStorage.getItem(scrollPositionKey);
      if (savedPosition) {
        const position = parseInt(savedPosition, 10);
        // Restore scroll position after a brief delay to ensure content is rendered
        setTimeout(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = position;
            // Reset manual scrolling flag after restoration
            setIsManuallyScrolling(false);
            // Update shouldScrollToBottom based on restored position
            const { scrollHeight, clientHeight } = chatContainerRef.current;
            const isNearBottom = scrollHeight - position - clientHeight < 100;
            setShouldScrollToBottom(isNearBottom);
          }
        }, 150);
      } else {
        // No saved position, reset manual scrolling flag
        setIsManuallyScrolling(false);
      }
    }
  }, [activeAnalysis, scrollPositionKey]);
  
  // Save scroll position when switching to analysis or component unmounts
  useEffect(() => {
    const saveScrollPosition = () => {
      if (chatContainerRef.current) {
        const currentPosition = chatContainerRef.current.scrollTop;
        sessionStorage.setItem(scrollPositionKey, currentPosition.toString());
        setScrollPosition(currentPosition);
      }
    };

    // Save position when switching to analysis
    if (activeAnalysis) {
      saveScrollPosition();
    }

    // Save position on page unload/refresh
    const handleBeforeUnload = () => {
      saveScrollPosition();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      saveScrollPosition(); // Save on component unmount
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activeAnalysis, scrollPositionKey]);
  
  // Track scroll position continuously for better UX
  const handleScroll = useCallback(() => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const currentPosition = scrollTop;
      
      // Update scroll position state
      setScrollPosition(currentPosition);
      
      // Determine if user is near bottom (within 100px)
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      
      // Set manual scrolling flag when user scrolls away from bottom
      if (!isNearBottom && shouldScrollToBottom) {
        setIsManuallyScrolling(true);
      } else if (isNearBottom) {
        setIsManuallyScrolling(false);
      }
      
      setShouldScrollToBottom(isNearBottom);
      
      // Debounced save to sessionStorage (save every 500ms when scrolling stops)
      clearTimeout((window as any).scrollSaveTimeout);
      (window as any).scrollSaveTimeout = setTimeout(() => {
        sessionStorage.setItem(scrollPositionKey, currentPosition.toString());
      }, 500);
    }
  }, [scrollPositionKey, shouldScrollToBottom]);

  // Add scroll listener
  useEffect(() => {
    const container = chatContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        container.removeEventListener('scroll', handleScroll);
      };
    }
  }, [handleScroll]);
  
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
  
  // Auto-scroll to bottom for new messages (improved logic)
  useEffect(() => {
    if (chatContainerRef.current && !isManuallyScrolling) {
      const container = chatContainerRef.current;
      
      // Only auto-scroll if user is near the bottom and not manually scrolling
      if (shouldScrollToBottom) {
        // Small delay to prevent interfering with manual scrolling
        setTimeout(() => {
          if (chatContainerRef.current && !isManuallyScrolling) {
            container.scrollTo({
              top: container.scrollHeight,
              behavior: 'smooth'
            });
            
            // Update saved position to bottom
            const newPosition = container.scrollHeight;
            sessionStorage.setItem(scrollPositionKey, newPosition.toString());
            setScrollPosition(newPosition);
          }
        }, 100);
      }
    }
  }, [messages, shouldScrollToBottom, scrollPositionKey, isManuallyScrolling]);

  // Handle typing indicator scroll
  useEffect(() => {
    if (isLoading && shouldScrollToBottom && !isManuallyScrolling && chatContainerRef.current) {
      const container = chatContainerRef.current;
      setTimeout(() => {
        if (chatContainerRef.current && !isManuallyScrolling) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 50);
    }
  }, [isLoading, shouldScrollToBottom, isManuallyScrolling]);

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
            content: 'Welcome back to Rocketez! Your previous conversation has been restored. How can I help you today?',
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
      console.log('🔍 ChatPanel: Current rocket state when sending to AgentPy:', {
        fin_count: rocket.fins?.[0]?.fin_count,
        parachute_cd_s: rocket.parachutes?.[0]?.cd_s_m2,
        motor_id: rocket.motor?.motor_database_id
      });
      console.log('🔍 ChatPanel: Sending rocket data to AgentPy');
      console.log('🔍 ChatPanel: Rocket fins:', rocket.fins.map(f => ({ id: f.id, fin_count: f.fin_count })));
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
      
      // FIX: Unescape LaTeX that was double-escaped during JSON serialization
      // This is the most robust place to fix it - right after JSON parsing
      if (json.final_output) {
        console.log('🔍 BEFORE LaTeX unescaping:', json.final_output);
        console.log('🔍 Looking for patterns like \\\\( and \\\\)');
        
        let processed = json.final_output;
        
        // Test specific patterns that we're seeing in the logs
        const testPatterns = [
          /\\\\\(/g,  // \\( pattern
          /\\\\\)/g,  // \\) pattern
          /\\\\rho/g, // \\rho pattern
          /\\\\text/g // \\text pattern
        ];
        
        testPatterns.forEach((pattern, index) => {
          const matches = processed.match(pattern);
          if (matches) {
            console.log(`🎯 Found pattern ${index}: ${pattern} - ${matches.length} matches`);
          }
        });
        
        // More comprehensive LaTeX unescaping
        // Handle all double-escaped LaTeX commands and symbols
        processed = processed
          // LaTeX delimiters (most important - these are the main issue)
          .replace(/\\\\\(/g, '\\(')     // \\( -> \(
          .replace(/\\\\\)/g, '\\)')     // \\) -> \)
          .replace(/\\\\\[/g, '\\[')     // \\[ -> \[
          .replace(/\\\\\]/g, '\\]')     // \\] -> \]
          .replace(/\\\\\{/g, '\\{')     // \\{ -> \{
          .replace(/\\\\\}/g, '\\}')     // \\} -> \}
          // Common LaTeX commands  
          .replace(/\\\\(frac|text|mathbf|mathrm|sqrt|sum|int|lim|log|ln|sin|cos|tan)/g, '\\$1')
          // Greek letters (comprehensive list)
          .replace(/\\\\(alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|omicron|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega)/g, '\\$1')
          .replace(/\\\\(Alpha|Beta|Gamma|Delta|Epsilon|Zeta|Eta|Theta|Iota|Kappa|Lambda|Mu|Nu|Xi|Omicron|Pi|Rho|Sigma|Tau|Upsilon|Phi|Chi|Psi|Omega)/g, '\\$1')
          // Math operators and symbols
          .replace(/\\\\(cdot|times|div|pm|mp|leq|geq|neq|approx|equiv|in|subset|supset|infty|partial|nabla|exists|forall)/g, '\\$1')
          // Arrows and relations
          .replace(/\\\\(rightarrow|leftarrow|leftrightarrow|Rightarrow|Leftarrow|Leftrightarrow)/g, '\\$1')
          // Miscellaneous
          .replace(/\\\\(quad|qquad|space|,|;|!)/g, '\\$1');
        
        console.log('🔍 AFTER LaTeX unescaping:', processed);
        console.log('🔍 Changes made:', processed !== json.final_output);
        
        // FALLBACK: Convert \( \) format to $ $ format if the agents are still using the old format
        const beforeFallback = processed;
        processed = processed
          .replace(/\\\(/g, '$')    // \( -> $
          .replace(/\\\)/g, '$');   // \) -> $
        
        if (processed !== beforeFallback) {
          console.log('🔄 FALLBACK: Converted \\( \\) format to $ $ format');
          console.log('🔍 After fallback conversion:', processed);
        }
        
        json.final_output = processed;
      }
      
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
        className="flex-1 overflow-y-auto p-3 space-y-3 w-full min-w-0"
        style={{
          scrollBehavior: 'smooth',
        }}
      >
        {messages.map((message, index) => (
          <motion.div
            key={index}
            className={cn("flex w-full", message.role === "user" ? "justify-end" : "justify-stretch")}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <div
              className={cn(
                "rounded-2xl backdrop-blur-xl relative shadow-sm transition-all duration-200",
                message.role === "user"
                  ? "bg-gray-900/95 text-white max-w-[80%] px-3 py-2 text-sm border border-gray-700/30"
                  : "text-gray-100 border border-gray-600/40 w-full px-4 py-4",
              )}
              style={{
                // Ensure proper containment
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
                minWidth: 0,
              }}
            >
              {message.role === 'assistant' && message.agent && (
                <div className="absolute -top-1.5 -right-1.5 bg-black/90 text-white text-[9px] rounded-full px-1.5 py-0.5 opacity-90 font-medium border border-gray-600/50">
                  {message.agent.replace('_', ' ')}
                </div>
              )}
              <div className="w-full min-w-0 overflow-hidden">
                <FormattedMessage 
                  content={message.content}
                  role={message.role}
                  className="text-sm leading-relaxed"
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
        
        {/* Agent transition indicator */}
        {currentlyRunningAgent && (
          <motion.div
            className="flex justify-center"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <div className="text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-lg border border-gray-600/50">
              Switching to {currentlyRunningAgent.replace('_', ' ')} agent...
            </div>
          </motion.div>
        )}
        
        {/* Typing indicator */}
        {isLoading && (
          <motion.div
            className="flex justify-start"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="text-gray-100 max-w-[85%] rounded-2xl px-3 py-2.5 border border-gray-700/50">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-xs text-gray-400">AI is thinking...</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-white/5 backdrop-blur-xl bg-black/20 w-full min-w-0">
        <div className="flex space-x-4 w-full min-w-0">
          <div className="flex-1 relative min-w-0">
            <TextareaAutosize
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Describe your rocket design goals..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              minRows={1}
              maxRows={4}
              className="pr-12 bg-white/5 backdrop-blur-xl border border-white/10 focus:border-white/20 rounded-xl text-white placeholder:text-white/60 w-full min-w-0 px-4 py-3 resize-none outline-none transition-all"
              style={{
                lineHeight: '1.5',
                fontSize: '14px',
              }}
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
              className="px-4 py-2 text-xs bg-white/5 backdrop-blur-xl border border-white/10 rounded-full text-gray-300 hover:text-white hover:bg-white/10 transition-all mb-2"
            >
              {action}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
