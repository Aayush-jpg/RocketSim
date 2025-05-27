"use client"

import { useState, useRef, useEffect } from 'react'
import { useRocket } from '@/lib/store'
import { dispatchActions } from '@/lib/ai/actions'

// Chat message type definition
export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  agent?: string; // Add agent field to store which agent handled the message
}

export default function ChatPanel() {
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
  const suggestedCommands = [
    { id: '1', text: 'Optimize fin design' },
    { id: '2', text: 'Add a nose cone' },
    { id: '3', text: 'Run a simulation' },
    { id: '4', text: 'Make body longer' },
    { id: '5', text: 'Paint it red' },
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
  
  return (
    <div className="h-full flex flex-col w-full">
      {/* Chat messages */}
      <div 
        ref={chatContainerRef} 
        className="flex-1 overflow-y-auto p-3 space-y-4 w-full"
      >
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`rounded-2xl px-4 py-3 ${
                msg.role === 'user' 
                  ? 'bg-white bg-opacity-25 rounded-tr-none shadow-lg ml-4 self-end' 
                  : 'glass-panel rounded-tl-none shadow-md mr-4 self-start'
              } ${msg.role === 'user' ? 'max-w-[80%]' : 'w-[95%]'}`}
            >
              {msg.role === 'user' ? (
                <p className="text-small text-white">{msg.content}</p>
              ) : (
                <div className="relative">
                  {msg.agent && (
                    <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-[10px] rounded-full px-2 py-0.5 opacity-80">
                      {msg.agent.replace('_', ' ')}
                    </div>
                  )}
                  <div 
                    className="text-small text-white formatted-content w-full"
                    style={{
                      overflowWrap: 'break-word',
                      wordWrap: 'break-word'
                    }}
                    dangerouslySetInnerHTML={{ __html: formatContent(msg.content) }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start w-full">
            <div className="glass-panel rounded-2xl rounded-tl-none px-4 py-3 shadow-md mr-4 max-w-[95%]">
              <div className="flex flex-col items-center space-y-2">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse delay-75" />
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse delay-150" />
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
          </div>
        )}
      </div>
      
      {/* Suggestions */}
      <div className="p-2 border-t border-opacity-10 w-full" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
        <div className="flex flex-wrap gap-2 pb-2 w-full">
          {suggestedCommands.map(cmd => (
            <button
              key={cmd.id}
              className="glass-panel whitespace-nowrap rounded-full px-3 py-1 text-small"
              onClick={() => setInputValue(cmd.text)}
            >
              {cmd.text}
            </button>
          ))}
        </div>
      </div>
      
      {/* Input area */}
      <div className="p-3 border-t border-opacity-20 w-full" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
        <div className="flex w-full">
          <input
            type="text"
            className="flex-1 glass-panel-surface rounded-l-full px-4 py-2 text-small focus:outline-none"
            placeholder="Ask the AI assistant..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isLoading) sendMessage(inputValue);
            }}
            disabled={isLoading}
          />
          <button
            className={`glass-panel-surface rounded-r-full px-4 py-2 ${
              isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white hover:bg-opacity-10'
            }`}
            onClick={() => sendMessage(inputValue)}
            disabled={isLoading}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
} 