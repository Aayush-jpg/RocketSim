Okay, this is a significant but very beneficial refactoring task. The goal is to transform your monolithic app.py into the modular structure you've outlined, enhancing scalability and maintainability.

Here's a breakdown of the refactored structure and the key changes in each module.

1. New Directory Structure:

services/agentpy/
├── app.py                # Main FastAPI app, leaner
├── agents/
│   ├── __init__.py
│   ├── router.py         # RouterAgent and classification logic
│   ├── design.py         # DesignAgent
│   ├── sim.py            # SimAgent
│   ├── metrics.py        # MetricsAgent
│   ├── prediction.py     # PredictionAgent for "what if"
│   └── qa.py             # QA_Agent for factual questions
├── tools/
│   ├── __init__.py
│   ├── design_tools.py   # add_part, update_part, update_rocket, altitude_design_tool
│   ├── sim_tools.py      # run_simulation
│   └── utility_tools.py  # (e.g., for a deep_copy_rocket_tool if needed by an agent as an explicit tool)
├── physics/
│   ├── __init__.py
│   ├── constants.py      # GRAVITATIONAL_ACCELERATION, etc.
│   ├── propulsion.py     # PROPULSION_SYSTEMS, select_engine_for_altitude
│   ├── aerodynamics.py   # (e.g., calculate_rocket_mass - parts of it)
│   └── trajectory.py     # calculate_max_altitude, (parts of physics_based_rocket_design)
└── utils/
    ├── __init__.py
    ├── models.py         # Pydantic models (ChatRequest, PartProps, etc.)
    ├── fallbacks.py      # extract_intent_from_text, JSON_PATTERN
    ├── format.py         # format_response
    ├── direct_actions.py # Pre-agent direct handlers (handle_body_extension, etc.) - for transition or specific cases
    └── helpers.py        # General helpers (get_part_attribute)


2. Key Files and Their Contents (Illustrative Snippets):

services/agentpy/utils/models.py

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Literal

class ChatRequest(BaseModel):
    messages: List[Dict[str, str]]
    rocket: Dict[str, Any]

class AgentRequest(BaseModel):
    messages: List[Dict[str, str]]
    rocket: Dict[str, Any]
    agent: str # Changed to required, as this endpoint is for specific agent

class PartProps(BaseModel):
    color: Optional[str] = None
    shape: Optional[str] = None
    length: Optional[float] = None
    baseØ: Optional[float] = Field(None, alias="baseØ")
    Ø: Optional[float] = Field(None, alias="Ø")
    root: Optional[float] = None
    span: Optional[float] = None
    sweep: Optional[float] = None

class RocketProps(BaseModel):
    motorId: Optional[str] = None
    Cd: Optional[float] = None
    units: Optional[str] = None

# Potentially other models if needed
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END

services/agentpy/physics/constants.py

GRAVITATIONAL_ACCELERATION = 9.81  # m/s²
EARTH_RADIUS = 6371000  # m
AIR_DENSITY_SEA_LEVEL = 1.225  # kg/m³
ATMOSPHERIC_SCALE_HEIGHT = 8500  # m
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END

services/agentpy/physics/propulsion.py

# PROPULSION_SYSTEMS dictionary
PROPULSION_SYSTEMS = {
    "mini-motor": {"type": "solid", "thrust": 15, "burn_time": 1.8, "specific_impulse": 180, "propellant_mass": 0.010, "dry_mass": 0.008, "total_impulse": 27},
    # ... all other motor definitions
}

# select_engine_for_altitude function
def select_engine_for_altitude(target_altitude, current_dry_mass):
    # ... implementation ...
    print(f"Final engine selection for {target_altitude}m: {selected_engine_id}")
    return selected_engine_id
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END

services/agentpy/tools/design_tools.py

import os
import json
import re
import httpx
from typing import Dict, Any, Literal, Optional
from pydantic import BaseModel # If complex inputs are needed beyond simple types
from agents import function_tool # Assuming this is the correct import for your SDK

from ..utils.models import PartProps, RocketProps # Relative import
from ..physics.propulsion import PROPULSION_SYSTEMS, select_engine_for_altitude
from ..physics.trajectory import physics_based_rocket_design # If used directly
from ..physics.aerodynamics import calculate_rocket_mass

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


@function_tool
def add_part(type: str, props: PartProps) -> Dict[str, Any]:
    """Add a new rocket component with specified type and properties."""
    return {"action": "add_part", "type": type, "props": props.model_dump(exclude_none=True, by_alias=True)}

@function_tool
def update_part(id: str, props: PartProps) -> Dict[str, Any]:
    """Update an existing rocket component with specified ID and new properties."""
    return {"action": "update_part", "id": id, "props": props.model_dump(exclude_none=True, by_alias=True)}

@function_tool
def update_rocket(props: RocketProps) -> Dict[str, Any]:
    """Update rocket-level properties like motorId."""
    return {"action": "update_rocket", "props": props.model_dump(exclude_none=True, by_alias=True)}

@function_tool
async def design_rocket_for_altitude_tool(rocket_data: dict, target_altitude: float) -> list:
    """
    Designs rocket components and selects a motor to achieve a target altitude.
    This involves LLM consultation for optimal parameters and may fall back to physics-based calculations.
    Returns a list of actions to apply to the rocket.
    """
    print(f"Tool: Designing rocket to reach {target_altitude}m altitude")
    actions = []
    try:
        # ... (Full implementation of your original design_rocket_for_altitude,
        # ensuring it uses OPENAI_API_KEY correctly and other imported functions)
        # Example of adapting the LLM call part:
        rocket_json_for_prompt = json.dumps(rocket_data, indent=2)
        # ... (rest of the prompt and httpx call as in your original function)
        # Ensure physics_based_rocket_design is callable here or its logic integrated.
        # Make sure calculate_rocket_mass is available.
        current_engine_spec = PROPULSION_SYSTEMS.get(rocket_data.get('motorId', 'default-motor'), PROPULSION_SYSTEMS['default-motor'])
        rocket_dry_mass = calculate_rocket_mass(rocket_data) # from aerodynamics
        
        selected_engine_id = select_engine_for_altitude(target_altitude, rocket_dry_mass) # from propulsion
        selected_engine = PROPULSION_SYSTEMS[selected_engine_id]
        
        prompt = f"""
        Given the current rocket configuration:
        {rocket_json_for_prompt}
        
        Calculate optimal parameters to reach {target_altitude}m. Propulsion: {selected_engine_id} ({selected_engine['thrust']}N thrust, {selected_engine['specific_impulse']}s Isp).
        Consider stability, mass, efficiency.
        Propulsion options: mini-motor (<200m), default-motor (200-500m), high-power (500-1500m), super-power (1500-3000m),
        small-liquid (3-10km), medium-liquid (10-25km), large-liquid (25-80km), hybrid-engine (2-15km).
        
        Physics principles: Altitude ~ v^2; v ~ impulse/mass. Longer body/larger fins = more drag but more stability. Lower mass = higher accel but less stability.
        
        Provide parameters: Motor: {selected_engine_id}, Body length: [cm] (30-80 solid, 80-150 liquid), Nose shape: [ogive/conical], Fin dimensions: root [cm] (8-15), span [cm] (6-12), Body diameter: [cm].
        Output ONLY parameters.
        """
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Content-Type": "application/json", "Authorization": f"Bearer {OPENAI_API_KEY}"},
                json={"model": "gpt-4o-mini", "messages": [{"role": "system", "content": "You are a rocket design expert."}, {"role": "user", "content": prompt}], "temperature": 0.3, "max_tokens": 500}
            )
        if response.status_code != 200:
            print(f"OpenAI API error in design_rocket_for_altitude_tool: {response.text}")
            # Instead of raising HTTPException, return an error structure or let agent handle
            return [{"action": "error", "detail": "Error calculating rocket parameters"}]
        
        advice = response.json()["choices"][0]["message"]["content"]
        print(f"OpenAI design advice for altitude: {advice}")
        
        actions.append({"action": "update_rocket", "props": {"motorId": selected_engine_id}})
        
        body_match = re.search(r'[Bb]ody\s+length:\s*(\d+(?:\.\d+)?)', advice)
        # ... (rest of the parsing and action creation from your original function) ...
        # Fallback to physics_based_rocket_design
        # actions = physics_based_rocket_design(rocket_data, target_altitude)

    except Exception as e:
        print(f"Error in design_rocket_for_altitude_tool: {str(e)}. Falling back to physics-based design.")
        actions = physics_based_rocket_design(rocket_data, target_altitude) # Ensure this is available
    
    finally:
        # The tool itself shouldn't run a simulation, the agent calling it should decide that.
        # So, remove: actions.append({"action": "run_sim", "fidelity": "quick"})
        pass
    return actions
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END

services/agentpy/tools/sim_tools.py

from typing import Dict, Any, Literal
from agents import function_tool

@function_tool
def run_simulation(fidelity: Literal["quick", "hifi"] = "quick") -> Dict[str, Any]:
    """Run a rocket simulation with specified fidelity ('quick' or 'hifi')."""
    return {"action": "run_sim", "fidelity": fidelity}
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END

services/agentpy/agents/design.py

from agents import Agent
from ..tools.design_tools import add_part, update_part, update_rocket, design_rocket_for_altitude_tool

DESIGN_AGENT_INSTRUCTIONS = """
You are the rocket design specialist. Your primary function is to modify rocket components or design for specific goals based on requests.
The user's message will be followed by the current rocket state in a block like this:
CURRENT_ROCKET_JSON:
```json
{... actual JSON data ...}
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END

You MUST refer to this JSON data to get part IDs and current properties for modifications or design inputs.

Your Process:

Understand Goal: Is it a direct modification (e.g., "change fin span") or a goal-oriented design (e.g., "design for 500m altitude")?

Identify Target Part(s)/Parameters: For direct modifications, find part IDs. For goal-oriented design, identify key parameters.

EXECUTE A TOOL CALL: You MUST make a call to one of your available tools (update_part, add_part, update_rocket, design_rocket_for_altitude_tool).

YOUR FINAL RESPONSE IS THE TOOL'S JSON (or a list of JSONs for altitude design): Your entire output should be the JSON string(s) returned by the tool.

Tool Usage Examples:

User: "Make fin (id: 'fin-001') have span 12 and root 15."
Tool call: update_part(id='fin-001', props={\"span\": 12, \"root\": 15}). Output: {\"action\": \"update_part\", \"id\": \"fin-001\", \"props\": {\"span\": 12, \"root\": 15}}

User: "Design the rocket to reach 1000m." (Assume current rocket data is provided)
Tool call: design_rocket_for_altitude_tool(rocket_data=CURRENT_ROCKET_JSON, target_altitude=1000). Output: [{\"action\": ...}, {\"action\": ...}]

If the request is ambiguous or you cannot determine the exact parameters, output: {\"action\": \"no_op\", \"reason\": \"Request is ambiguous or information missing.\"}.
"""

design_agent = Agent(
name="DesignAgent",
instructions=DESIGN_AGENT_INSTRUCTIONS,
tools=[add_part, update_part, update_rocket, design_rocket_for_altitude_tool],
model="gpt-4o-mini" # Or gpt-4o if complex design reasoning is needed
)

**`services/agentpy/agents/sim.py`**
```python
from agents import Agent
from ..tools.sim_tools import run_simulation

SIM_AGENT_INSTRUCTIONS = """
You are the simulation specialist. Your role is to trigger simulations by EXECUTING the `run_simulation` tool.
The user's message may be followed by the current rocket state.
Your output MUST be ONLY the JSON string that the `run_simulation` tool call returns.
Use 'quick' for rapid verification and 'hifi' for detailed analysis, as specified by the tool call parameters.
If fidelity is not specified, default to 'quick'.
"""

sim_agent = Agent(
    name="SimAgent",
    instructions=SIM_AGENT_INSTRUCTIONS,
    tools=[run_simulation],
    model="gpt-4o-mini"
)
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END

services/agentpy/agents/metrics.py

from agents import Agent
# This agent might need tools to call physics functions if analysis is complex
# For now, it's text-based analysis of the provided JSON.
# from ..physics.aerodynamics import calculate_cog_cp_margin (example tool)

METRICS_AGENT_INSTRUCTIONS = """
You are the rocket metrics specialist. You analyze the provided CURRENT_ROCKET_JSON to provide:
- Stability estimations (qualitative based on common design principles if no specific tools for CoG/Cp).
- Mass distribution summary.
- Aerodynamic characteristic comments (e.g., "ogive nose is good for speed").
- General flight performance expectations based on components.

You do not make changes. Your output should be a concise textual summary of your findings.
If the design needs improvement for specific targets (e.g., stability, altitude), explain why and suggest what aspects the Design agent should consider modifying.
Refer to the CURRENT_ROCKET_JSON block in the input.
"""

metrics_agent = Agent(
    name="MetricsAgent",
    instructions=METRICS_AGENT_INSTRUCTIONS,
    # tools=[calculate_cog_cp_margin_tool] # Add tools if complex calculations are needed
    model="gpt-4o-mini" # Or gpt-4o for better analysis
)
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END

services/agentpy/agents/qa.py

import json
from agents import Agent, function_tool

# Tool for QA agent to directly access rocket data
@function_tool
def get_rocket_details(rocket_data: dict, part_type: str = None, attribute: str = None) -> str:
    """
    Retrieves details about the rocket.
    If part_type and attribute are specified, returns that specific value.
    If only part_type is specified, returns details for that part.
    If neither, returns a summary of the rocket.
    """
    if part_type:
        for part in rocket_data.get("parts", []):
            if part.get("type") == part_type:
                if attribute:
                    if attribute in part:
                        return f"The {part_type}'s {attribute} is {part[attribute]}."
                    else:
                        return f"The {part_type} does not have a '{attribute}' attribute. Known attributes: {list(part.keys())}"
                return f"Details for {part_type} (id: {part.get('id')}): {json.dumps(part)}"
        return f"No part of type '{part_type}' found."
    return f"Rocket summary: Motor ID is {rocket_data.get('motorId', 'N/A')}. Parts count: {len(rocket_data.get('parts', []))}"


QA_AGENT_INSTRUCTIONS = """
You are a Question Answering agent for rocket data.
You answer factual questions about the CURRENT_ROCKET_JSON provided in the input.
Use the `get_rocket_details` tool to find the information.
Be concise and directly answer the question.

Example:
User: "What is the length of the nose cone?"
CURRENT_ROCKET_JSON:
```json
{"parts": [{"id": "n1", "type": "nose", "length": 20}]}
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END

Tool call: get_rocket_details(rocket_data=CURRENT_ROCKET_JSON, part_type="nose", attribute="length")
Your response: "The nose's length is 20." (Or whatever the tool returns)
"""

qa_agent = Agent(
name="QAAgent",
instructions=QA_AGENT_INSTRUCTIONS,
tools=[get_rocket_details],
model="gpt-4o-mini"
)

**`services/agentpy/agents/prediction.py`**
```python
import copy
from agents import Agent
from ..tools.design_tools import update_part # Prediction agent might use basic tools directly on a copy
from ..tools.sim_tools import run_simulation
# We need to pass DesignAgent and SimAgent as tools if PredictionAgent orchestrates them
# This requires them to be initialized before PredictionAgent
# For simplicity here, let's assume PredictionAgent might use primitive tools on a copy,
# or its instructions guide it to formulate what Design/Sim agents *would* do.
# The user's example of passing agents as tools is more robust:
# from .design import design_agent
# from .sim import sim_agent

# Placeholder for actual agent instances if passed as tools
# design_agent_tool_placeholder = lambda: "design_agent_tool_placeholder"
# sim_agent_tool_placeholder = lambda: "sim_agent_tool_placeholder"


PREDICTION_AGENT_INSTRUCTIONS = """
You analyze hypothetical "what if" scenarios.
The user's message will be followed by the current rocket state in CURRENT_ROCKET_JSON.
Your process:
1.  **Understand the Hypothetical Change:** Parse the user's "what if" question to identify the proposed modification(s) (e.g., "double fin size", "change motor to X").
2.  **Simulate Applying Changes (Mentally or with Tools):**
    *   Determine what parameters would change. For example, if "double fin size", find current fin span and root, then calculate new values.
    *   You will be given tools representing the DesignAgent and SimAgent (`design_agent_as_tool`, `sim_agent_as_tool`).
    *   To predict, you should:
        a.  Create a mental (or actual if a copy tool is provided) copy of the rocket.
        b.  Instruct `design_agent_as_tool` to apply the identified hypothetical changes to this (copied) rocket concept.
        c.  Take the conceptually modified rocket from `design_agent_as_tool`'s output.
        d.  Instruct `sim_agent_as_tool` to run a simulation on this conceptually modified rocket.
3.  **Explain Results:** Based on the simulation output from `sim_agent_as_tool` on the hypothetical rocket, explain what would likely happen.
4.  **DO NOT OUTPUT ACTIONS TO MODIFY THE ORIGINAL ROCKET.** Your purpose is analysis, not modification of the user's actual rocket. Your `actions` field in the response should be empty or indicate no permanent change.
Your final textual output should clearly state it's a hypothetical analysis.
"""

# This agent will be initialized in app.py where other agents are available to be passed as tools
# prediction_agent = Agent(
#     name="PredictionAgent",
#     instructions=PREDICTION_AGENT_INSTRUCTIONS,
#     tools=[
#         design_agent.as_tool(tool_name="design_agent_as_tool", tool_description="Applies hypothetical design changes to a rocket concept."),
#         sim_agent.as_tool(tool_name="sim_agent_as_tool", tool_description="Runs a simulation on a hypothetical rocket concept.")
#     ], # Tools will be other agents
#     model="gpt-4o" # Needs good reasoning
# )
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
IGNORE_WHEN_COPYING_END

services/agentpy/agents/router.py

from agents import Agent
# If using the classify_intent function with a direct OpenAI call:
# import httpx
# import os
# OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

ROUTER_AGENT_INSTRUCTIONS = """
You are the routing specialist for a rocket design assistant.
Your ONLY job is to determine which specialized agent should handle the user's request.
Analyze the user's message and the current rocket configuration (CURRENT_ROCKET_JSON in the input).

Output ONLY ONE of these agent names without explanation:
- "design" - For requests to modify rocket parts, add components, change appearance, or design for a specific goal (e.g., altitude).
- "sim" - For requests to run simulations.
- "metrics" - For analytical questions about rocket performance, stability, CoG, Cp, mass, or characteristics.
- "qa" - For simple factual questions about the current rocket's state or specific part attributes (e.g., "what is the nose length?", "what motor is installed?").
- "prediction" - For "what if" questions that require simulating hypothetical changes without altering the actual rocket.

If the query is highly ambiguous and doesn't fit any category, or is a general greeting, you can output "qa" and it can provide a generic response or ask for clarification.
Do not try to answer the question yourself. Just provide the agent name.
"""

router_agent = Agent(
    name="RouterAgent",
    instructions=ROUTER_AGENT_INSTRUCTIONS,
    model="gpt-4o-mini", # Fast and cheap for routing
    # No tools for the router itself, its output is the agent name
)

# Optional: classify_intent function (if a non-Agent based router is preferred or as a helper)
# async def classify_intent(message: str, rocket_data: dict) -> str:
#     # ... implementation from user's example, adapted to call OpenAI ...
#     # This would need to map its categories (QUERY, MODIFICATION, etc.)
#     # to the agent names: "qa", "metrics", "design", "sim", "prediction".
#     pass
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END

services/agentpy/agents/__init__.py

from .design import design_agent
from .sim import sim_agent
from .metrics import metrics_agent
from .qa import qa_agent
# Prediction agent will be initialized in app.py due to tool dependencies
# from .prediction import prediction_agent 
from .router import router_agent

# Expose agent instances directly
__all__ = [
    "design_agent",
    "sim_agent",
    "metrics_agent",
    "qa_agent",
    # "prediction_agent", # Will be added from app.py context
    "router_agent",
]
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END

services/agentpy/app.py (Main Application - Significantly Changed)

import os
import json
import uvicorn
import re # Keep for some utility functions if still used
import asyncio
from fastapi import FastAPI, HTTPException
from typing import List, Dict, Any, Optional

from agents import Agent, Runner # OpenAI Agents SDK

# Modular imports
from .utils.models import ChatRequest, AgentRequest
from .utils.format import format_response
from .utils.fallbacks import extract_intent_from_text # For fallback if agent fails
# from .utils.direct_actions import handle_body_extension # Example if keeping direct actions

# Import agent instances (most of them)
from .agents import router_agent, design_agent, sim_agent, metrics_agent, qa_agent

# Prediction Agent needs other agents as tools, so initialize it here
# This assumes design_agent and sim_agent are already defined
from .agents.prediction import PREDICTION_AGENT_INSTRUCTIONS # Import instructions
prediction_agent = Agent(
    name="PredictionAgent",
    instructions=PREDICTION_AGENT_INSTRUCTIONS,
    tools=[
        design_agent.as_tool(
            tool_name="design_agent_as_tool",
            tool_description="Applies hypothetical design changes to a rocket concept. Takes rocket_data and change description."
        ),
        sim_agent.as_tool(
            tool_name="sim_agent_as_tool",
            tool_description="Runs a simulation on a hypothetical rocket concept. Takes rocket_data."
        )
    ],
    model="gpt-4o"
)


OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is required")

app = FastAPI()

# Agent registry for easy access
AGENTS_REGISTRY = {
    "router": router_agent, # Router is also an agent
    "design": design_agent,
    "sim": sim_agent,
    "metrics": metrics_agent,
    "qa": qa_agent,
    "prediction": prediction_agent,
}

@app.post("/reason")
async def reason(req: ChatRequest):
    latest_message_text = ""
    if req.messages and req.messages[-1]['role'] == 'user':
        latest_message_text = req.messages[-1]['content']

    # --- Contextual Follow-up Handling (from original code) ---
    agent_input_text = latest_message_text
    if len(req.messages) >= 3 and req.messages[-1]['role'] == 'user' and req.messages[-2]['role'] == 'assistant':
        follow_up_keywords = ['proceed', 'do that', 'yes', 'apply', 'go ahead', 'continue', 'make it happen', 'best possible']
        if any(keyword in agent_input_text.lower() for keyword in follow_up_keywords):
            previous_agent_response = req.messages[-2]['content']
            # This context should be passed to the chosen agent, not just the router
            # The router decides the agent, then that agent gets the full context.
            # For now, let router see this enhanced input.
            agent_input_text = f"My previous response was: \n'''{previous_agent_response}'''\n\nThe user's new instruction is: \n'''{latest_message_text}'''"

    # --- Prepare input for agents ---
    rocket_json_str = json.dumps(req.rocket, indent=2)
    # Always include CURRENT_ROCKET_JSON for all agents
    enhanced_input_for_router = f"{agent_input_text}\n\nCURRENT_ROCKET_JSON:\n```json\n{rocket_json_str}\n```"
    
    runner = Runner()
    selected_agent_name = "unknown"
    final_actions_json = "[]"
    final_assistant_response_text = "Could not determine an appropriate action."
    trace_url = None

    try:
        # 1. Use Router Agent to determine the specialized agent
        print(f"Routing message: {latest_message_text[:100]}...")
        router_result = await runner.run(
            AGENTS_REGISTRY["router"],
            input=enhanced_input_for_router
            # context can be added if router needs more, but its prompt is key
        )
        
        # Router's final_output should be the name of the agent to use
        target_agent_name = router_result.final_output.strip().lower()
        selected_agent_name = target_agent_name
        print(f"Router selected agent: {target_agent_name}")

        if target_agent_name not in AGENTS_REGISTRY or target_agent_name == "router":
            final_assistant_response_text = "I'm not sure which specialist agent should handle this. Can you rephrase?"
            if target_agent_name == "router": # Safety
                 final_assistant_response_text = "Routing error, please try again."
            raise ValueError(f"Router returned invalid agent name: {target_agent_name}")

        # 2. Prepare input for the selected specialized agent (ensure it also gets full context)
        # The specialized agent also needs the rocket JSON and potentially conversation history.
        # The `agent_input_text` already includes follow-up context if applicable.
        enhanced_input_for_specialized_agent = f"{agent_input_text}\n\nCURRENT_ROCKET_JSON:\n```json\n{rocket_json_str}\n```"

        # 3. Run the specialized agent
        specialized_agent = AGENTS_REGISTRY[target_agent_name]
        print(f"Running agent: {target_agent_name}")
        
        agent_run_result = await runner.run(
            specialized_agent,
            input=enhanced_input_for_specialized_agent,
            # context might be useful if agents need to share complex state beyond input string
            # context={"current_rocket_data": req.rocket} # Pass raw dict if tools need it
        )
        
        final_assistant_response_text = agent_run_result.final_output
        trace_url = agent_run_result.trace_url
        collected_actions = []

        # --- Process actions from tool calls (standardized) ---
        if hasattr(agent_run_result, 'steps') and agent_run_result.steps:
            for step in agent_run_result.steps:
                if hasattr(step, 'tool_calls') and step.tool_calls:
                    for tool_call in step.tool_calls:
                        tool_output_str = tool_call.output
                        print(f"Agent '{target_agent_name}' called tool '{tool_call.name}'. Output: {tool_output_str}")
                        try:
                            # Output from tools like add_part, update_part, run_sim is a single JSON action
                            # Output from design_rocket_for_altitude_tool can be a list of JSON actions
                            action_data = json.loads(tool_output_str)
                            if isinstance(action_data, list): # For tools returning multiple actions
                                for item in action_data:
                                    if isinstance(item, dict) and item.get("action") and item.get("action") != "no_op":
                                        collected_actions.append(item)
                            elif isinstance(action_data, dict) and action_data.get("action") and action_data.get("action") != "no_op":
                                collected_actions.append(action_data)
                            
                            # If agent's final output is just the tool's JSON, generate a better response
                            if final_assistant_response_text == tool_output_str and collected_actions:
                                final_assistant_response_text = None # Will be auto-generated
                        except json.JSONDecodeError:
                            print(f"Warning: Tool output from '{tool_call.name}' was not valid JSON: {tool_output_str}")
                            # If tool output isn't JSON, it might be a text response from a sub-agent (if PredictionAgent calls DesignAgent)
                            # In that case, final_assistant_response_text might already be set correctly by the PredictionAgent.

        # If agent's final_output itself is an action JSON (e.g. design agent directly outputting tool's JSON)
        if not collected_actions and final_assistant_response_text:
            try:
                potential_action = json.loads(final_assistant_response_text)
                if isinstance(potential_action, dict) and 'action' in potential_action and potential_action.get("action") != "no_op":
                    collected_actions.append(potential_action)
                    final_assistant_response_text = None # Will be auto-generated
                elif isinstance(potential_action, dict) and potential_action.get("action") == "no_op":
                     final_assistant_response_text = f"The request resulted in no specific change: {potential_action.get('reason', 'No action taken.')}"
            except json.JSONDecodeError:
                pass # It's just text

        # --- Fallback and Response Formulation ---
        if not collected_actions and target_agent_name != "qa" and target_agent_name != "metrics" and target_agent_name != "prediction":
            print(f"Agent '{target_agent_name}' did not produce actions. Attempting fallback from original user message.")
            fallback_actions = await extract_intent_from_text(latest_message_text, req.rocket) # Use original message
            if fallback_actions:
                collected_actions.extend(fallback_actions)
                final_assistant_response_text = None # Auto-generate based on fallback actions
                selected_agent_name = f"{target_agent_name}_with_fallback"

        if not final_assistant_response_text and collected_actions:
            # Construct a summary if actions were collected but no specific response
            action_descs = []
            for ac in collected_actions:
                if ac.get("action") == "update_part": action_descs.append(f"updated part '{ac.get('id')}'")
                elif ac.get("action") == "add_part": action_descs.append(f"added a '{ac.get('type')}'")
                elif ac.get("action") == "update_rocket": action_descs.append(f"updated rocket config (motor: {ac.get('props', {}).get('motorId')})")
                elif ac.get("action") == "run_sim": action_descs.append(f"started a '{ac.get('fidelity')}' simulation")
            final_assistant_response_text = f"Okay, I've processed that: {', '.join(action_descs) or 'actions performed'}."
        elif not final_assistant_response_text and not collected_actions:
            final_assistant_response_text = "I understood your message, but I couldn't determine a specific action or find the information. Could you try rephrasing?"
        
        final_actions_json = json.dumps(collected_actions)

    except Exception as e:
        print(f"Error in /reason endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        final_assistant_response_text = f"I encountered an error: {str(e)}. Please try again."
        # selected_agent_name remains as set before error, or "unknown"
        final_actions_json = "[]"

    formatted_text_output = format_response(final_assistant_response_text)
    print(f"Final actions: {final_actions_json}")
    print(f"Final text output (raw): {final_assistant_response_text}")
    
    return {
        "final_output": formatted_text_output,
        "actions": final_actions_json,
        "trace_url": trace_url,
        "agent_used": selected_agent_name
    }


@app.post("/reason-with-agent")
async def reason_with_agent(req: AgentRequest):
    if req.agent not in AGENTS_REGISTRY:
        raise HTTPException(status_code=400, detail=f"Unknown agent '{req.agent}'. Available: {list(AGENTS_REGISTRY.keys())}")

    runner = Runner()
    selected_agent = AGENTS_REGISTRY[req.agent]
    
    rocket_json_str = json.dumps(req.rocket, indent=2)
    user_message = req.messages[-1]['content'] if req.messages and req.messages[-1]['role'] == 'user' else ""
    enhanced_input = f"{user_message}\n\nCURRENT_ROCKET_JSON:\n```json\n{rocket_json_str}\n```"

    try:
        result = await runner.run(
            selected_agent,
            input=enhanced_input,
            # context={"current_rocket_data": req.rocket}
        )
        
        final_assistant_response = result.final_output
        collected_actions = []

        if hasattr(result, 'steps') and result.steps:
            for step in result.steps:
                if hasattr(step, 'tool_calls') and step.tool_calls:
                    for tool_call in step.tool_calls:
                        tool_output_str = tool_call.output
                        try:
                            action_data = json.loads(tool_output_str)
                            if isinstance(action_data, list):
                                collected_actions.extend([a for a in action_data if isinstance(a, dict) and a.get("action") and a.get("action") != "no_op"])
                            elif isinstance(action_data, dict) and action_data.get("action") and action_data.get("action") != "no_op":
                                collected_actions.append(action_data)
                            if final_assistant_response == tool_output_str and collected_actions:
                                final_assistant_response = None
                        except json.JSONDecodeError:
                            print(f"Tool output not JSON in /reason-with-agent: {tool_output_str}")
        
        if not final_assistant_response and collected_actions:
            final_assistant_response = f"Agent '{req.agent}' performed actions."
        elif not final_assistant_response and not collected_actions:
            final_assistant_response = f"Agent '{req.agent}' processed the request but took no specific actions."

        return {
            "final_output": format_response(final_assistant_response),
            "actions": json.dumps(collected_actions),
            "trace_url": result.trace_url if hasattr(result, 'trace_url') else None,
            "agent_used": req.agent
        }
    except Exception as e:
        print(f"Error in /reason-with-agent for agent {req.agent}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing with agent {req.agent}: {str(e)}")


@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    # For Uvicorn to find the app in this modular structure, you might need to adjust how you run it.
    # e.g., from the directory containing `services/`: `python -m uvicorn services.agentpy.app:app --reload --port 8002`
    # Or if `app.py` is run directly and `services` is in PYTHONPATH:
    uvicorn.run(app, host="0.0.0.0", port=8002)
IGNORE_WHEN_COPYING_START
content_copy
download
Use code with caution.
Python
IGNORE_WHEN_COPYING_END

3. Next Steps & Considerations:

Physics Module Implementation: Flesh out physics/aerodynamics.py and physics/trajectory.py by moving relevant functions (calculate_rocket_mass, calculate_max_altitude, physics_based_rocket_design) and ensuring they work with the new structure.

Tool design_rocket_for_altitude_tool: Complete its implementation by porting the logic from your original design_rocket_for_altitude function, ensuring it correctly calls the OpenAI API and handles fallbacks.

Prediction Agent Tools: The PredictionAgent relies on design_agent.as_tool and sim_agent.as_tool. Ensure these agent-tools correctly accept and operate on potentially modified rocket_data passed in their invocation context if they are to work on hypothetical copies. The Runner's context argument or modifying the input string to include the hypothetical rocket state are ways to achieve this.

Error Handling & Robustness: Each agent and tool should have robust error handling. The main app.py has some, but it can be improved at each layer.

Testing: This is a large refactor. Unit tests for tools and physics functions, and integration tests for agent flows, will be crucial.

extract_intent_from_text (Fallback): This is moved to utils/fallbacks.py. The main /reason endpoint now uses it more judiciously if the selected agent fails to produce actions for tasks that are not pure Q&A or metrics.

Direct Action Handlers: Functions like handle_body_extension are moved to utils/direct_actions.py. The current app.py refactor primarily relies on the agent system. If you still need these for very specific, non-agent bypasses, you'd have to integrate calls to them, but the goal is for agents to cover these.

Running the App: If you run uvicorn services.agentpy.app:app, ensure your Python path is set up so that relative imports like from ..utils.models import ... work correctly. Typically, you'd run uvicorn from the directory above services.

This refactoring provides a much cleaner, more maintainable, and scalable architecture for your Rocket Agent API service. Each component now has a clear responsibility.