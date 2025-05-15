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
      
      // Call agent API
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          history, 
          rocket,
          preferredAgent: lastUsedAgent // Send previous agent for context continuity
        })
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
          const actions = JSON.parse(json.actions || '[]');
          if (actions.length > 0) {
            console.log(`Dispatching ${actions.length} actions from agent response`);
            dispatchActions(actions);
          } else {
            console.log('No actions to dispatch from agent response');
          }
        } catch (actionError) {
          console.error('Error parsing or dispatching actions:', actionError);
        }
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
    <div className="h-full flex flex-col">
      {/* Chat messages */}
      <div 
        ref={chatContainerRef} 
        className="flex-1 overflow-y-auto p-3 space-y-4"
      >
        {messages.map((msg, index) => (
          <div 
            key={index} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user' 
                  ? 'bg-white bg-opacity-25 rounded-tr-none shadow-lg' 
                  : 'glass-panel rounded-tl-none shadow-md'
              }`}
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
                    className="text-small text-white formatted-content"
                    dangerouslySetInnerHTML={{ __html: msg.content }}
                  />
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="glass-panel rounded-2xl rounded-tl-none px-4 py-3 shadow-md">
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
      <div className="p-2 border-t border-opacity-10" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
        <div className="flex overflow-x-auto pb-2 space-x-2">
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
      <div className="p-3 border-t border-opacity-20" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
        <div className="flex">
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