# Implementing OpenAI Agents SDK with ROCKETv1

This guide walks you through the implementation of the OpenAI Agents SDK in our ROCKETv1 application, creating a robust agent-based architecture for rocket design and simulation.

## Architecture Overview

The implementation follows a microservice architecture:

1. **Next.js Frontend** - React components that render the rocket design interface and chat panel
2. **Node.js API** - Next.js API routes that proxy requests to the Python agent service
3. **Python Agent Service** - A FastAPI service that uses OpenAI Agents SDK to process user queries and generate actions
4. **RocketPy Service** - A Python service for high-fidelity rocket simulations

```
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│   React UI    │──────│  Next.js API  │──────│  Agent Service│
│  (Browser)    │      │  (Node.js)    │      │   (Python)    │
└───────┬───────┘      └───────────────┘      └───────┬───────┘
        │                                             │
        │                                             │
        │                                             │
┌───────┴───────┐                            ┌────────┴──────┐
│ Zustand Store │                            │ RocketPy Sim  │
│  (Browser)    │                            │   (Python)    │
└───────────────┘                            └───────────────┘
```

## 1. Python Agent Service Implementation

### 1.1 Directory Structure

```
services/
  ├── agentpy/
  │   ├── app.py           # Main FastAPI application
  │   ├── Dockerfile       # Container definition
  │   └── requirements.txt # Python dependencies
  │
  └── rocketpy/
      ├── app.py           # RocketPy simulation service
      ├── Dockerfile
      └── requirements.txt
```

### 1.2 Requirements

Create `services/agentpy/requirements.txt`:

```
fastapi==0.104.0
uvicorn[standard]==0.23.2
openai-agents>=0.4.0
pydantic>=2.7.0
python-dotenv==1.0.0
```

### 1.3 Agent Service Implementation

Create `services/agentpy/app.py`:

```python
import os
import json
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from agents import Agent, Runner, function_tool
from typing import List, Dict, Optional, Any

# Load API key from environment
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is required")

# ---------- Pydantic models for rocket data -------------
class PartProperties(BaseModel):
    length: Optional[float] = None
    shape: Optional[str] = None
    baseØ: Optional[float] = None
    Ø: Optional[float] = None
    root: Optional[float] = None
    span: Optional[float] = None
    sweep: Optional[float] = None

class Part(BaseModel):
    id: str
    type: str
    color: str = "white"
    properties: Dict[str, Any] = {}

class Rocket(BaseModel):
    id: str
    name: str
    parts: List[Part]
    motorId: str
    Cd: float = 0.5
    units: str = "metric"

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    rocket: Rocket

# ---------- Agent tools -----------------------------------
@function_tool
def add_part(type: str, color: str = "white", **props) -> str:
    """
    Insert a new rocket component.
    
    Args:
        type: Type of part to add (nose, body, fin)
        color: Color of the part (default: white)
        **props: Part-specific properties
          For nose: shape (ogive/conical), length, baseØ
          For body: Ø (diameter), length
          For fin: root, span, sweep
    """
    return json.dumps({"action": "add_part", "type": type, "color": color, "props": props})

@function_tool
def update_part(id: str, color: str = None, **props) -> str:
    """
    Modify an existing component.
    
    Args:
        id: Unique identifier of the part to update
        color: New color (optional)
        **props: Part properties to update
    """
    update_data = {"props": props}
    if color:
        update_data["color"] = color
    return json.dumps({"action": "update_part", "id": id, "props": props})

@function_tool
def remove_part(id: str) -> str:
    """
    Remove a component from the rocket.
    
    Args:
        id: Unique identifier of the part to remove
    """
    return json.dumps({"action": "remove_part", "id": id})

@function_tool
def run_simulation(fidelity: str = "quick") -> str:
    """
    Run a rocket flight simulation.
    
    Args:
        fidelity: Simulation detail level ("quick" or "hifi")
    """
    if fidelity not in ["quick", "hifi"]:
        fidelity = "quick"
    return json.dumps({"action": "run_sim", "fidelity": fidelity})

@function_tool
def get_motor_info(motor_id: str) -> str:
    """
    Retrieve information about a specific motor.
    
    Args:
        motor_id: Identifier of the motor
    """
    return json.dumps({"action": "get_motor", "id": motor_id})

@function_tool
def change_motor(motor_id: str) -> str:
    """
    Change the motor used in the rocket.
    
    Args:
        motor_id: Identifier of the new motor
    """
    return json.dumps({"action": "change_motor", "id": motor_id})

TOOLS = [add_part, update_part, remove_part, run_simulation, get_motor_info, change_motor]

# Create the Agent with tools
agent = Agent(
    name="Rocket Design Assistant",
    instructions="""
    You are an expert assistant for model rocket design. Help users design, test, and optimize their rockets.
    
    When responding to users:
    1. Always analyze the current rocket configuration in CURRENT_ROCKET_JSON before making recommendations.
    2. Use appropriate tools to modify the rocket design or run simulations.
    3. Provide clear explanations about how changes will affect performance.
    4. For optimal rocket design, aim for:
       - Stability margin between 1-2 calibers
       - Appropriate motor selection for desired altitude
       - Balanced weight distribution
       - Aerodynamic efficiency
    5. If simulation results show poor performance (apogee < 100m, unstable flight), suggest specific improvements.
    6. When analyzing simulation results, explain the key performance metrics and what they mean.
    
    Key rocket design principles:
    - Center of gravity should be ahead of center of pressure for stability
    - Fin size affects stability: larger fins increase stability but add drag
    - Nose cone shape affects drag: ogive is more efficient than conical
    - Body tube diameter affects both drag and stability
    
    Do not make design changes without explaining why they would improve performance.
    """,
    tools=TOOLS,
    model="gpt-4o-mini",  # Can be upgraded to gpt-4o for better performance
    temperature=0.2,
)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "rocket-agent"}

@app.post("/reason")
async def reason(req: ChatRequest):
    """
    Process user request and generate response with actions
    """
    if not req.messages:
        raise HTTPException(status_code=400, detail="No messages provided")
    
    try:
        # Prepend system message with rocket data
        start = [
            {"role": "system", "content": f"CURRENT_ROCKET_JSON\n{req.rocket.json()}"}
        ] + [{"role": m.role, "content": m.content} for m in req.messages]
        
        # Run the agent
        result = await Runner.run_async(agent=agent, input=start, stream=False)
        
        # Return final output, actions, and trace information
        return {
            "final_output": result.final_output,
            "actions": result.actions,
            "trace_url": result.trace_url if hasattr(result, 'trace_url') else None,
            "token_usage": result.token_usage.dict() if hasattr(result, 'token_usage') else None
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent processing error: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)
```

### 1.4 Dockerfile

Create `services/agentpy/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py .

# Environment variable for API key
ENV OPENAI_API_KEY=${OPENAI_API_KEY}

# Expose the port
EXPOSE 8002

# Run the application
CMD ["python", "app.py"]
```

## 2. Next.js API Integration

### 2.1 API Route

Create `app/api/agent/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { history, rocket } = await req.json();
    
    // Call the Python agent service
    const r = await fetch(process.env.AGENT_URL ?? "http://agentpy:8002/reason", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history, rocket }),
    });
    
    if (!r.ok) {
      const errorText = await r.text();
      console.error(`Agent service error (${r.status}): ${errorText}`);
      return new NextResponse(
        JSON.stringify({ 
          error: "Agent service error", 
          final_output: "I'm having trouble connecting to my reasoning service. Please try again." 
        }),
        { status: 500 }
      );
    }
    
    // Get the response
    const result = await r.json();
    
    // Return the formatted response
    return NextResponse.json({
      final_output: result.final_output,
      actions: result.actions,
      trace_url: result.trace_url,
      token_usage: result.token_usage
    });
  } catch (error) {
    console.error("Error in agent API route:", error);
    return new NextResponse(
      JSON.stringify({ 
        error: "Internal server error", 
        final_output: "Sorry, I encountered an unexpected error. Please try again." 
      }),
      { status: 500 }
    );
  }
}
```

## 3. Frontend Integration

### 3.1 Actions Dispatcher

Create or update `lib/ai/actions.ts` to include the action dispatcher function:

```typescript
export function dispatchActions(actions: any[]) {
  const { updateRocket, setSim } = useRocket.getState();
  
  console.log('🎯 Dispatching actions:', actions);
  
  actions.forEach((a) => {
    console.log('🔄 Processing action:', a);
    
    // Dispatch event for UI components to react to agent actions
    window.dispatchEvent(new CustomEvent('agentAction', { 
      detail: { action: a.action, ...a } 
    }));
    
    switch (a.action) {
      case "add_part":
        console.log('➕ Adding part:', a.type, a.props);
        updateRocket((r) => {
          r.parts.push({ id: crypto.randomUUID(), type: a.type, color: a.color || "white", ...a.props });
          return r;
        });
        break;
      case "update_part":
        console.log('🔧 Updating part:', a.id, a.props);
        updateRocket((r) => {
          // Find part by ID
          const p = r.parts.find((p) => p.id === a.id);
          if (p) {
            Object.assign(p, a.props);
            if (a.color) p.color = a.color;
          }
          return r;
        });
        break;
      case "remove_part":
        console.log('🗑️ Removing part:', a.id);
        updateRocket((r) => {
          r.parts = r.parts.filter((p) => p.id !== a.id);
          return r;
        });
        break;
      case "change_motor":
        console.log('🚀 Changing motor:', a.id);
        updateRocket((r) => {
          r.motorId = a.id;
          return r;
        });
        break;
      case "run_sim":
        console.log('📊 Running simulation with fidelity:', a.fidelity);
        a.fidelity === "quick"
          ? runQuickSim()          // client physics
          : runHighFiSim();        // POST /api/hifi (unchanged)
        break;
      default:
        console.log('❓ Unknown action:', a.action);
    }
  });
}
```

### 3.2 Chat Panel Component

Update your chat panel component to use the agent:

```tsx
async function send(msg: string) {
  const history = [...messages, { role:"user", content: msg }];
  const res = await fetch("/api/agent", {
    method:"POST",
    body: JSON.stringify({ history, rocket: useRocket.getState().rocket })
  });
  const json = await res.json();
  
  // Process the actions returned by the agent
  if (json.actions) {
    dispatchActions(JSON.parse(json.actions || "[]"));
  }
  
  // Update the chat with the agent's response
  setMessages([...history, { role:"assistant", content: json.final_output }]);
}
```

## 4. Docker Compose Configuration

Update `docker-compose.yml`:

```yaml
version: '3'

services:
  web:
    build: .
    ports:
      - "3000:3000"
    env_file: .env
    depends_on: [agentpy]
    volumes:
      - .:/app
      - /app/node_modules
    command: npm run dev

  agentpy:
    build: ./services/agentpy
    ports: ["8002:8002"]
    env_file: .env
    volumes:
      - ./services/agentpy:/app

  rocketpy:
    build: ./services/rocketpy
    ports: ["8000:8000"]
    env_file: .env
```

## 5. Environment Variables

Create `.env` file:

```
OPENAI_API_KEY=your_openai_api_key
AGENT_URL=http://agentpy:8002/reason
ROCKETPY_URL=http://rocketpy:8000/simulate
```

## 6. Launching the Application

Build and start the services:

```bash
docker-compose build
docker-compose up
```

## 7. Migrating to Node.js Agents SDK in the Future

When OpenAI releases the JavaScript Agents SDK, you can migrate the Python agent service to a Node.js implementation:

```typescript
import { Agent, Runner } from "openai-agents";

const agent = new Agent({
  name: "Rocket Design Assistant",
  instructions: "...",
  tools: [
    {
      name: "add_part",
      description: "Insert a new rocket component",
      parameters: {...}
    },
    // ... other tools
  ],
  model: "gpt-4o-mini",
  temperature: 0.2,
});

export async function processMessage(messages, rocket) {
  // Prepend system message with rocket data
  const start = [
    { role: "system", content: `CURRENT_ROCKET_JSON\n${JSON.stringify(rocket)}` }
  ].concat(messages);
  
  // Run the agent
  const result = await Runner.runAsync({ agent, input: start });
  
  // Return results
  return {
    final_output: result.finalOutput,
    actions: result.actions,
    trace_url: result.traceUrl
  };
}
```

## Benefits of the OpenAI Agents SDK Implementation

1. **Structured Tool Calling**: The SDK provides a clean way to define and use tools with proper parameter validation.
2. **Built-in Retries**: The SDK handles retries when tool calls fail or need clarification.
3. **Tracing**: Comprehensive tracing of the agent's reasoning steps and tool calls.
4. **Type Safety**: With Pydantic models, all data is properly validated.
5. **Parallel Processing**: The Python service can handle multiple requests in parallel.
6. **Clean Separation**: The agent logic is cleanly separated from the UI logic.

## Security Considerations

1. **API Key Security**: Store API keys securely in environment variables, never in client-side code.
2. **Rate Limiting**: Implement rate limiting to prevent abuse.
3. **Input Validation**: Validate all user inputs to prevent injection attacks.
4. **Cost Management**: Track token usage to manage API costs.
5. **Tool Permissions**: Ensure agent tools have appropriate permissions and can't execute harmful actions.

---

This implementation provides a robust foundation for an agent-driven rocket design application, leveraging the power of the OpenAI Agents SDK while maintaining a clean architecture that can be easily migrated to newer technologies as they become available. 