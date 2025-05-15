# Rocket Agent API Service

A modular agent-based API for rocket design, simulation, and analysis built with FastAPI and the OpenAI Agents SDK.

## Architecture

The system uses a modular architecture with specialized agents for different tasks:

```
                ┌─── Router Agent ───┐
                │                    │
                ▼                    ▼
    ┌─────────────────┐    ┌──────────────────┐
    │ Query Answering │    │ Action Execution │
    │    Cluster      │    │     Cluster      │
    └────────┬────────┘    └────────┬─────────┘
             │                      │
             ▼                      ▼
     ┌───────────────┐    ┌──────────────────────┐
     │ Specification │    │ Design  │  Physics   │
     │ Metrics  │ QA │    │ Agent   │  Agent     │
     └───────────────┘    └──────────────────────┘
```

### Agent Types

- **Router Agent**: Determines which specialized agent should handle each user request
- **Design Agent**: Handles rocket component modifications (adding/updating parts)
- **Simulation Agent**: Handles rocket flight simulations
- **Metrics Agent**: Analyzes rocket performance characteristics
- **Prediction Agent**: Processes hypothetical "what if" scenarios

## Module Structure

```
services/agentpy/
├── app.py                # Main FastAPI app
├── agents/
│   ├── __init__.py       # Export agents
│   ├── router.py         # Router agent and classification 
│   ├── design.py         # Design agent
│   ├── sim.py            # Simulation agent
│   ├── metrics.py        # Metrics analysis agent
│   └── prediction.py     # Agent for "what if" scenarios
├── tools/
│   ├── __init__.py       # Export tool functions
│   ├── design_tools.py   # Part modification tools
│   ├── sim_tools.py      # Simulation tools
│   └── utility_tools.py  # Generic utility tools
├── physics/
│   ├── __init__.py
│   ├── propulsion.py     # Engine models
│   ├── aerodynamics.py   # Drag and stability calculations
│   └── trajectory.py     # Flight path calculations
└── utils/
    ├── __init__.py
    ├── models.py         # Pydantic models
    ├── fallbacks.py      # Fallback intent extraction
    ├── format.py         # Response formatting
    └── helpers.py        # General helper functions
```

## API Endpoints

### POST `/reason`

Main endpoint for rocket design and analysis requests. Processes natural language input, determines the appropriate agent, and returns both text responses and action commands.

**Request:**
```json
{
  "messages": [{"role": "user", "content": "Increase the fin size by 20%"}],
  "rocket": {...rocket JSON...}
}
```

**Response:**
```json
{
  "final_output": "I've increased the fin size by 20%.",
  "actions": "[{\"action\": \"update_part\", \"id\": \"fin1\", \"props\": {\"span\": 12, \"root\": 15}}]",
  "agent_used": "design",
  "trace_url": "https://platform.openai.com/..." 
}
```

### POST `/reason-with-agent`

Allows direct targeting of a specific agent for advanced use cases.

### GET `/health`

Health check endpoint.

## Special Features

### Hypothetical "What If" Analysis

The system can process "what if" queries without modifying the actual rocket:

```
"What would happen if I doubled the rocket size?"
```

This routes to the specialized `prediction` agent which simulates the changes and provides a detailed analysis of the hypothetical effects, without actually modifying the user's rocket.

## Development

### Requirements

- Python 3.9+
- OpenAI API key
- Docker and Docker Compose (optional)

### Setup

```bash
pip install -r requirements.txt
```

### Running

```bash
# Direct
python app.py

# Docker
docker compose up -d agentpy
``` 