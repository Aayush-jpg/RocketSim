"use client"

import { useState, useRef, useEffect } from 'react'
import { useRocket } from '@/lib/store'
import { dispatchActions } from '@/lib/ai/actions'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'

// Chat message type definition
export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  agent?: string; // Add agent field to store which agent handled the message
}
interface ChatPanelProps {
  activeAnalysis?: string | null;
  onAnalysisClick?: (analysisId: string) => void;
}

export default function ChatPanel({ activeAnalysis, onAnalysisClick }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Welcome to RocketSim! I can help you design and optimize your rocket. What would you like to work on today?',
      agent: 'master'
    }
  ]);


  
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastUsedAgent, setLastUsedAgent] = useState<string>('master');
  const [currentlyRunningAgent, setCurrentlyRunningAgent] = useState<string | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);
  
  // Suggested commands
  const quickActions = [
     "Optimize fin design" ,
     "Add a nose cone" ,
     "Run a simulation" ,
     "Make body longer" ,
     "Paint it red" ,
  ];
  
  // Format content for better display
  function formatContent(content: string): string {
    // Try to detect and format JSON content
    if (content.includes('{"') && content.includes('"}')) {
      try {
        // Extract JSON parts and format them
        const jsonRegex = /\{[^{}]*"[^"]*"[^{}]*\}/g;
        let formattedContent = content;
        
        const jsonMatches = content.match(jsonRegex);
        if (jsonMatches) {
          jsonMatches.forEach(jsonStr => {
            try {
              const parsed = JSON.parse(jsonStr);
              let formatted = '<div class="bg-black/20 rounded-lg p-3 my-2 border-l-4 border-blue-500">';
              
              Object.entries(parsed).forEach(([key, value]) => {
                const displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                formatted += `<div class="mb-2"><strong class="text-blue-300">${displayKey}:</strong><br/>`;
                formatted += `<span class="text-white/90">${value}</span></div>`;
              });
              
              formatted += '</div>';
              formattedContent = formattedContent.replace(jsonStr, formatted);
            } catch (e) {
              // If parsing fails, leave as is
            }
          });
        }
        
        return formattedContent;
      } catch (e) {
        // If formatting fails, return original
        return content;
      }
    }
    
    return content;
  }
  
  // Send message to AI service
  async function sendMessage(msg: string) {
    if (!msg.trim()) return;
    
    // Add user message to chat
    const userMessage: ChatMessage = { role: 'user', content: msg };
    const history = [...messages, userMessage];
    setMessages(history);
    setInputValue('');
    setIsLoading(true);
    setCurrentlyRunningAgent(lastUsedAgent); // Show that the last used agent is initially running
    
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
            console.log('🚀 Rocket state BEFORE dispatching actions:', JSON.stringify(rocketBefore.parts, null, 2));
            
            dispatchActions(actions);
            
            // Check rocket state after dispatching
            setTimeout(() => {
              const rocketAfter = useRocket.getState().rocket;
              console.log('🚀 Rocket state AFTER dispatching actions:', JSON.stringify(rocketAfter.parts, null, 2));
              
              // Compare before and after
              const changed = JSON.stringify(rocketBefore.parts) !== JSON.stringify(rocketAfter.parts);
              console.log('🔄 Rocket parts changed:', changed);
              
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
        className="flex-1 overflow-y-auto p-6 space-y-6 w-full min-w-0"
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
                "rounded-2xl px-6 py-4 backdrop-blur-xl relative",
                message.role === "user"
                  ? "bg-white text-black shadow-lg max-w-[85%]"
                  : "bg-white/5 text-white border border-white/10 w-full",
              )}
            >
              {message.role === 'assistant' && message.agent && (
                <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-[10px] rounded-full px-2 py-0.5 opacity-80">
                  {message.agent.replace('_', ' ')}
                </div>
              )}
              <div className="w-full">
                {message.role === 'assistant' ? (
                  <div 
                    className="whitespace-pre-wrap break-words w-full text-white leading-relaxed text-sm prose prose-invert prose-sm max-w-none prose-headings:text-white prose-p:text-white prose-strong:text-white prose-ul:text-white prose-li:text-white"
                    dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
                  />
                ) : (
                  <p className="whitespace-pre-wrap break-words w-full !text-black leading-relaxed text-sm">{message.content}</p>
                )}
              </div>
              {/* Show simulation metrics if this is a simulation message */}
              {message.content.includes('simulation') && useRocket.getState().sim && (
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-gray-400">Max Altitude</span>
                      <div className="font-mono text-white">
                        {useRocket.getState().sim?.maxAltitude?.toFixed(0) || '0'}m
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-gray-400">Max Velocity</span>
                      <div className="font-mono text-white">
                        {useRocket.getState().sim?.maxVelocity?.toFixed(1) || '0'}m/s
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
      <div className="p-6 border-t border-white/5 backdrop-blur-xl bg-black/20 w-full min-w-0">
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