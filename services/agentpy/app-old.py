# Never use this file. It is a legacy file that is no longer used.

import os
import json
import uvicorn
import re
import math
import asyncio
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Literal
import httpx

# Import from agents package (openai-agents) as per documentation
from agents import Agent, function_tool, Runner

# Ensure OpenAI API key is set
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is required")

# Define JSON pattern globally (used by extract_intent_from_text)
JSON_PATTERN = r'\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}'

# Advanced rocket physics constants (Unchanged)
GRAVITATIONAL_ACCELERATION = 9.81  # m/s²
EARTH_RADIUS = 6371000  # m
AIR_DENSITY_SEA_LEVEL = 1.225  # kg/m³
ATMOSPHERIC_SCALE_HEIGHT = 8500  # m

# Propulsion systems database with realistic values (Unchanged)
PROPULSION_SYSTEMS = {
    "mini-motor": {"type": "solid", "thrust": 15, "burn_time": 1.8, "specific_impulse": 180, "propellant_mass": 0.010, "dry_mass": 0.008, "total_impulse": 27},
    "default-motor": {"type": "solid", "thrust": 32, "burn_time": 2.4, "specific_impulse": 200, "propellant_mass": 0.040, "dry_mass": 0.015, "total_impulse": 76.8},
    "high-power": {"type": "solid", "thrust": 60, "burn_time": 3.2, "specific_impulse": 220, "propellant_mass": 0.090, "dry_mass": 0.025, "total_impulse": 192},
    "super-power": {"type": "solid", "thrust": 120, "burn_time": 4.0, "specific_impulse": 240, "propellant_mass": 0.200, "dry_mass": 0.050, "total_impulse": 480},
    "small-liquid": {"type": "liquid", "thrust": 500, "burn_time": 30, "specific_impulse": 300, "propellant_mass": 1.5, "dry_mass": 0.8, "total_impulse": 15000, "mixture_ratio": 2.1, "chamber_pressure": 1.5},
    "medium-liquid": {"type": "liquid", "thrust": 2000, "burn_time": 45, "specific_impulse": 320, "propellant_mass": 6.5, "dry_mass": 2.0, "total_impulse": 90000, "mixture_ratio": 2.3, "chamber_pressure": 2.0},
    "large-liquid": {"type": "liquid", "thrust": 8000, "burn_time": 60, "specific_impulse": 340, "propellant_mass": 24.0, "dry_mass": 5.0, "total_impulse": 480000, "mixture_ratio": 2.4, "chamber_pressure": 3.0},
    "hybrid-engine": {"type": "hybrid", "thrust": 1200, "burn_time": 20, "specific_impulse": 280, "propellant_mass": 4.5, "dry_mass": 1.2, "total_impulse": 24000, "oxidizer_flux": 350}
}

app = FastAPI()

# Request models (Unchanged)
class ChatRequest(BaseModel):
    messages: List[Dict[str, str]]
    rocket: Dict[str, Any]

class AgentRequest(BaseModel):
    messages: List[Dict[str, str]]
    rocket: Dict[str, Any]
    agent: Optional[str] = "master"  # Which agent to use

# --- Pydantic Models for Tool Parameters ---
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

# --- Agent SDK Function Tools (decorated with function_tool) ---
@function_tool
def add_part(type: str, props: PartProps) -> Dict[str, Any]:
    """Add a new rocket component with specified type and properties."""
    return {"action": "add_part", "type": type, "props": props.model_dump(exclude_none=True)}

@function_tool
def update_part(id: str, props: PartProps) -> Dict[str, Any]:
    """Update an existing rocket component with specified ID and new properties."""
    return {"action": "update_part", "id": id, "props": props.model_dump(exclude_none=True)}

@function_tool
def run_simulation(fidelity: Literal["quick", "hifi"] = "quick") -> Dict[str, Any]:
    """Run a rocket simulation with specified fidelity ('quick' or 'hifi')."""
    return {"action": "run_sim", "fidelity": fidelity}

@function_tool
def update_rocket(props: RocketProps) -> Dict[str, Any]:
    """Update rocket-level properties like motorId."""
    return {"action": "update_rocket", "props": props.model_dump(exclude_none=True)}

# --- Agent Instructions Templates ---
DESIGN_AGENT_INSTRUCTIONS = """
You are the rocket design specialist. Your primary function is to modify rocket components based on requests.
The user's message will be followed by the current rocket state in a block like this:
CURRENT_ROCKET_JSON:
```json
{... actual JSON data ...}
```
You MUST refer to this JSON data to get part IDs and current properties for modifications.

**Your Process:**
1.  **Identify Target Part(s):** From the user's request and the provided `CURRENT_ROCKET_JSON` (found in the input), determine which part type (e.g., 'nose', 'body', 'fin') the request refers to.
2.  **Find Part ID(s):** Locate the `id`(s) of the target part(s) from the `CURRENT_ROCKET_JSON`.
3.  **Determine Properties & New Values:** Understand what specific properties (e.g., `length`, `span`, `shape`, `color`, `Ø`, `baseØ`, `root`) need to change and their new values based on the user's request.
4.  **EXECUTE A TOOL CALL:** You **MUST** make a call to one of your available tools (`update_part`, `add_part`, `update_rocket`). The tool call itself will produce a JSON output.
5.  **YOUR FINAL RESPONSE IS THE TOOL'S JSON:** After successfully EXECUTING a tool, your response to the system will be the JSON string that the tool call returned. Do not add any other text or explanation. Your entire output should be, for example, `{\"action\": \"update_part\", \"id\": \"nose1\", \"props\": {\"length\": 30}}`.

**Tool Usage Examples:**
- User wants to make fin (id: 'fin-001' from `CURRENT_ROCKET_JSON`) have span 12 and root 15:
  You will EXECUTE the tool call: `update_part(id='fin-001', props={\"span\": 12, \"root\": 15})`. The JSON string `{\"action\": \"update_part\", \"id\": \"fin-001\", \"props\": {\"span\": 12, \"root\": 15}}` is then your required output.
- User wants to change nose cone (id: 'nose-001' from `CURRENT_ROCKET_JSON`) length to 25 and shape to 'conical':
  You will EXECUTE the tool call: `update_part(id='nose-001', props={\"length\": 25, \"shape\": \"conical\"})`. The JSON string `{\"action\": \"update_part\", \"id\": \"nose-001\", \"props\": {\"length\": 25, \"shape\": \"conical\"}}` is your required output.

If the request is ambiguous or you cannot determine the exact parameters for a tool call from the user's request and the provided JSON, your output MUST be ONLY the following JSON: `{\"action\": \"no_op\", \"reason\": \"Request is ambiguous or required information is missing from CURRENT_ROCKET_JSON.\"}`. In this case, you DO NOT call a tool; this specific JSON is your direct output.
Do not ask for clarification in natural language.
"""

SIM_AGENT_INSTRUCTIONS = """
You are the simulation specialist. Your role is to trigger simulations by EXECUTING the `run_simulation` tool when directed.
The user's message may be followed by the current rocket state in a CURRENT_ROCKET_JSON block.
Your output MUST be ONLY the JSON string that the `run_simulation` tool call returns.
Use 'quick' for rapid verification and 'hifi' for detailed analysis, as specified by the tool call parameters.
"""

METRICS_AGENT_INSTRUCTIONS = """
You are the rocket metrics specialist. You analyze the provided CURRENT_ROCKET_JSON to provide:
- Stability calculations (center of gravity, center of pressure)
- Mass distribution analysis
- Aerodynamic characteristics
- Flight performance predictions

You do not have tools to make changes. Report your findings to the master agent. Your output should be a concise textual summary of your findings.
If the design needs improvement to meet specific targets, explain why and suggest what aspects the Design agent should consider modifying.
"""

MASTER_AGENT_INSTRUCTIONS = """
You are an expert master agent for rocket design coordination. You help users design, optimize, and understand model rockets.

First, analyze the user's request. The user's message will be followed by the current rocket state in a block like this:
CURRENT_ROCKET_JSON:
```json
{... actual JSON data ...}
```
You MUST refer to this JSON data when making decisions or instructing other agents.

Decision Tree:
1.  Specialized Task?
    - If the request is primarily about **changing components, adding parts, or updating rocket configuration** (e.g., "make fins bigger", "add a nose cone", "paint body red"), delegate to `design_agent_tool`. Instruct it clearly about the desired change, ensuring it knows to use the provided `CURRENT_ROCKET_JSON` for part IDs and current values.
    - If for **simulations** (e.g., "run a quick sim"), delegate to `sim_agent_tool`.
    - If for **metrics/analysis** (e.g., "is my rocket stable?", "calculate CoG"), delegate to `metrics_agent_tool`.

2.  Direct Modification (Simple & Confident)?
    - If the request is a very simple, direct modification (e.g., "change motor to X", "set fin span to Y for fin 'finset1'") AND you are highly confident and know the part ID (from the provided `CURRENT_ROCKET_JSON`), you MAY use the direct tools (`add_part`, `update_part`, `update_rocket`) yourself.

3.  Complex Request or Follow-up?
    - If the request is complex, involves multiple steps, or is a follow-up to your previous suggestions, reason through the steps. If design changes are needed, delegate those specific changes to `design_agent_tool` (specifying the part and desired change, referencing the `CURRENT_ROCKET_JSON`) or use direct tools if extremely simple and you have all necessary info like IDs from the `CURRENT_ROCKET_JSON`.

Available Tools (for you or to instruct design_agent_tool):
- `add_part(type: str, props: PartProps)`
- `update_part(id: str, props: PartProps)`
- `update_rocket(props: RocketProps)`
- `run_simulation(fidelity: Literal["quick", "hifi"])`

**CRITICAL: Ensuring Changes are Actioned and Reported**
- When you use a direct tool, its JSON output IS the action.
- When you delegate to `design_agent_tool`, it is instructed to use its tools and output only the tool's JSON. You must then check the `tool_calls` from the `design_agent_tool`'s execution step to retrieve the actual action JSON it produced.
- Your final natural language response to the user should summarize what actions were taken (based on the actual tool calls made by you or the sub-agent) and why.
- If no tools are called (e.g., just providing information, or if a sub-agent fails to make a tool call or returns a "no_op" action), then there are no actions to dispatch. Clearly state if no action was taken if the user expected one.

Do NOT just describe a change in your text response without ensuring a corresponding tool call was made and its output captured as an action.

Always use the correct part ID(s) from the `CURRENT_ROCKET_JSON` (found in the input) when instructing sub-agents or using tools directly.

**Handling Follow-up Instructions:**
If your previous response provided a list of suggestions or options, and the user's current message is a follow-up like "Proceed with option 2", "Yes, do that", "Apply the first suggestion", or "Make it happen", you MUST analyze your *previous* response in conjunction with the `CURRENT_ROCKET_JSON` (from the current input) to determine the appropriate tool calls. Do not simply ask for clarification if the intent can be reasonably inferred from the conversational history and your prior suggestions. If the user asks you to "proceed with the best possible things", analyze your previous suggestions and pick the most impactful ones that improve the rocket based on their general request (e.g., more stability, higher altitude), using the current rocket state from the `CURRENT_ROCKET_JSON`.

If the user asks you to "teach me what you did" or "explain the changes", summarize the tool calls you made in the previous turn and explain *why* those changes were made in the context of their request and the rocket's state (from `CURRENT_ROCKET_JSON`).
"""

# --- Agent Definitions per documentation ---
# Create sub-agents first
design_agent = Agent(
    name="DesignAgent",
    instructions=DESIGN_AGENT_INSTRUCTIONS,
    tools=[add_part, update_part, update_rocket],
    handoff_description="Handles rocket component design changes",
    model="gpt-4o-mini"
)

sim_agent = Agent(
    name="SimAgent",
    instructions=SIM_AGENT_INSTRUCTIONS,
    tools=[run_simulation],
    handoff_description="Handles rocket simulation requests",
    model="gpt-4o-mini"
)

metrics_agent = Agent(
    name="MetricsAgent",
    instructions=METRICS_AGENT_INSTRUCTIONS,
    handoff_description="Analyzes rocket performance metrics",
    model="gpt-4o-mini"
)

# Create master agent with sub-agents as tools
master_agent = Agent(
    name="MasterAgent",
    instructions=MASTER_AGENT_INSTRUCTIONS,
    tools=[
        design_agent.as_tool(
            tool_name="design_agent_tool", 
            tool_description="Handles rocket component design changes"
        ),
        sim_agent.as_tool(
            tool_name="sim_agent_tool", 
            tool_description="Handles rocket simulation requests"
        ),
        metrics_agent.as_tool(
            tool_name="metrics_agent_tool", 
            tool_description="Analyzes rocket performance metrics"
        ),
        add_part, update_part, update_rocket, run_simulation  # Also expose direct tools
    ],
    model="gpt-4o-mini"
)

# Store agents in a dict for easy access
agents = {
    "master": master_agent,
    "design": design_agent,
    "sim": sim_agent,
    "metrics": metrics_agent
}

# --- Physics, Design, and Fallback Helper Functions (All Unchanged) ---
async def extract_intent_from_text(text: str, rocket_data: dict):
    """Try to extract intent from plain text when agent fails to generate proper tool calls"""
    print(f"Attempting to extract intent from text: {text}")
    actions = []
    
    motor_patterns = [
        r'(?:change|switch|upgrade|update).*?(?:to|with).*?(mini\-motor|default\-motor|high\-power|super\-power|small\-liquid|medium\-liquid|large\-liquid|hybrid\-engine)',
        r'(?:use|select|choose|install).*?(mini\-motor|default\-motor|high\-power|super\-power|small\-liquid|medium\-liquid|large\-liquid|hybrid\-engine)',
        r'(mini\-motor|default\-motor|high\-power|super\-power|small\-liquid|medium\-liquid|large\-liquid|hybrid\-engine).*?(?:motor|engine)',
        r'(?:motor|engine).*?(?:to|with).*?(mini\-motor|default\-motor|high\-power|super\-power|small\-liquid|medium\-liquid|large\-liquid|hybrid\-engine)',
        r'change\s+motorId\s+to\s+(mini\-motor|default\-motor|high\-power|super\-power|small\-liquid|medium\-liquid|large\-liquid|hybrid\-engine)'
    ]
    
    for pattern in motor_patterns:
        motor_match = re.search(pattern, text.lower())
        if motor_match:
            new_motor_id = motor_match.group(1)
            print(f"Detected motor change to {new_motor_id}")
            actions.append({"action": "update_rocket", "props": {"motorId": new_motor_id}})
            return actions
    
    if (("upgrade" in text.lower() or "more power" in text.lower()) 
            and ("motor" in text.lower() or "engine" in text.lower()) 
            and "high-power" not in text.lower()):
        current_motor = rocket_data.get("motorId", "default-motor")
        new_motor = ""
        if current_motor == "default-motor": new_motor = "high-power"
        elif current_motor == "high-power": new_motor = "super-power"
        elif current_motor == "mini-motor": new_motor = "default-motor"
        else:
            if "liquid" in current_motor:
                if "small" in current_motor: new_motor = "medium-liquid"
                elif "medium" in current_motor: new_motor = "large-liquid"
                else: new_motor = "large-liquid"
            else: new_motor = "high-power"
        if new_motor:
            print(f"Upgrading motor from {current_motor} to {new_motor}")
            actions.append({"action": "update_rocket", "props": {"motorId": new_motor}})
            return actions
            
    altitude_patterns = [
        r'reach\s+(\d+(?:\.\d+)?)\s*m(?:eters?)?(?:\s+altitude)?', r'altitude\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*m',
        r'(\d+(?:\.\d+)?)\s*m(?:eters?)?\s+(?:high|altitude)', r'design.*?(\d+)m', r'.*?(\d+)\s*meters?',
        r'reach\s+(\d+(?:\.\d+)?)\s*k(?:m|ilometers?)(?:\s+altitude)?', r'altitude\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*k(?:m|ilometers?)',
        r'(\d+(?:\.\d+)?)\s*k(?:m|ilometers?)?\s+(?:high|altitude)', r'design.*?(\d+)k(?:m|ilometers?)', r'.*?(\d+)\s*k(?:ilo)?m(?:eters?)?'
    ]
    for i, pattern in enumerate(altitude_patterns):
        altitude_match = re.search(pattern, text.lower())
        if altitude_match:
            target_altitude = float(altitude_match.group(1))
            if i >= 5: target_altitude *= 1000
            print(f"DETECTED TARGET ALTITUDE (in extract_intent): {target_altitude}m")
            return await design_rocket_for_altitude(rocket_data, target_altitude)
            
    simulation_phrases = ["run a simulation", "run simulation", "perform a simulation", "launch simulation", "simulate", "flight simulation", "test flight", "flight performance"]
    if any(phrase in text.lower() for phrase in simulation_phrases):
        fidelity = "hifi" if any(word in text.lower() for word in ["high", "high-fidelity", "detailed", "accurate", "precise", "hifi"]) else "quick"
        print(f"Detected request to run {fidelity} simulation")
        actions.append({"action": "run_sim", "fidelity": fidelity})
        return actions
        
    if "nose" in text.lower() and "shape" in text.lower() and any(shape in text.lower() for shape in ["conical", "ogive"]):
        new_shape = "conical" if "conical" in text.lower() else "ogive"
        for part in rocket_data.get("parts", []):
            if part.get("type") == "nose":
                print(f"Found nose part, changing shape to {new_shape}")
                actions.append({"action": "update_part", "id": part["id"], "props": {"shape": new_shape}})
                return actions
    
    percentage_match = re.search(r'(\d+)%', text)
    percentage_increase = None
    increase_factor = 1.2
    if percentage_match:
        percentage = int(percentage_match.group(1))
        increase_factor = 1 + (percentage / 100)
        percentage_increase = percentage
    
    if "fin" in text.lower() and any(word in text.lower() for word in ["size", "larger", "bigger", "increase"]) and percentage_increase:
        for part in rocket_data.get("parts", []):
            if part.get("type") == "fin":
                updated_props = {}
                if "root" in part: updated_props["root"] = round(part["root"] * increase_factor, 2)
                if "span" in part: updated_props["span"] = round(part["span"] * increase_factor, 2)
                if "sweep" in part and "sweep" in text.lower(): updated_props["sweep"] = round(part["sweep"] * increase_factor, 2)
                if updated_props:
                    actions.append({"action": "update_part", "id": part["id"], "props": updated_props})
                    return actions
    
    dimension_patterns = [
        r'(root)\s+from\s+(\d+\.?\d*)\s*(?:cm)?\s+to\s+(?:approximately\s+)?(\d+\.?\d*)', r'(span)\s+from\s+(\d+\.?\d*)\s*(?:cm)?\s+to\s+(?:approximately\s+)?(\d+\.?\d*)',
        r'(sweep)\s+from\s+(\d+\.?\d*)\s*(?:cm)?\s+to\s+(?:approximately\s+)?(\d+\.?\d*)', r'(increase|new)\s+(root):\s*(\d+\.?\d*)',
        r'(increase|new)\s+(span):\s*(\d+\.?\d*)', r'(increase|new)\s+(sweep):\s*(\d+\.?\d*)',
    ]
    fin_updates = {}
    for pattern in dimension_patterns:
        matches = re.finditer(pattern, text.lower())
        for match in matches:
            if len(match.groups()) == 3:
                prop_name = match.group(1) if match.group(1) in ["root", "span", "sweep"] else match.group(2)
                new_value = float(match.group(3))
                fin_updates[prop_name] = new_value
    if fin_updates:
        for part in rocket_data.get("parts", []):
            if part.get("type") == "fin":
                actions.append({"action": "update_part", "id": part["id"], "props": fin_updates})
                return actions
                
    if any(phrase in text.lower() for phrase in ["double the body", "twice", "2x", "doubling"]) and any(word in text.lower() for word in ["length", "longer", "size"]):
        for part in rocket_data.get("parts", []):
            if part.get("type") == "body" and "length" in part:
                actions.append({"action": "update_part", "id": part["id"], "props": {"length": part["length"] * 2}})
                break # Assuming one body part
    
    color_map = {"red": "#FF0000", "blue": "#0000FF", "green": "#00FF00", "yellow": "#FFFF00", "purple": "#800080", "orange": "#FFA500", "black": "#000000", "white": "#FFFFFF"}
    for color_name, color_hex in color_map.items():
        if color_name in text.lower():
            part_specific = False
            for part_type in ["nose", "body", "fin"]:
                if part_type in text.lower():
                    for part in rocket_data.get("parts", []):
                        if part.get("type") == part_type:
                            actions.append({"action": "update_part", "id": part["id"], "props": {"color": color_hex}})
                            part_specific = True; break
            if not part_specific and any(word in text.lower() for word in ["all", "entire", "whole", "rocket"]):
                actions.append({"action": "update_part", "id": "all", "props": {"color": color_hex}})
    
    if not actions and "fin" in text.lower() and percentage_increase:
        for part in rocket_data.get("parts", []):
            if part.get("type") == "fin":
                props = {}
                if "root" in part: props["root"] = round(part["root"] * increase_factor, 2)
                if "span" in part: props["span"] = round(part["span"] * increase_factor, 2)
                if props: actions.append({"action": "update_part", "id": part["id"], "props": props})
                break
                
    print(f"Final extracted actions (from text): {actions}")
    return actions

async def design_rocket_for_altitude(rocket_data: dict, target_altitude: float) -> list:
    """Design a rocket to reach a specific altitude target using advanced physics calculations"""
    print(f"Designing rocket to reach {target_altitude}m altitude")
    actions = []
    try:
        current_engine_spec = PROPULSION_SYSTEMS.get(rocket_data.get('motorId', 'default-motor'), PROPULSION_SYSTEMS['default-motor'])
        rocket_dry_mass = calculate_rocket_mass(rocket_data)
        
        selected_engine_id = select_engine_for_altitude(target_altitude, rocket_dry_mass)
        selected_engine = PROPULSION_SYSTEMS[selected_engine_id]
        
        rocket_json_for_prompt = json.dumps(rocket_data, indent=2)
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
            print(f"OpenAI API error in design_rocket_for_altitude: {response.text}")
            raise HTTPException(status_code=500, detail="Error calculating rocket parameters in design_rocket_for_altitude")
        
        advice = response.json()["choices"][0]["message"]["content"]
        print(f"OpenAI design advice for altitude: {advice}")
        
        actions.append({"action": "update_rocket", "props": {"motorId": selected_engine_id}})
        
        body_match = re.search(r'[Bb]ody\s+length:\s*(\d+(?:\.\d+)?)', advice)
        nose_match = re.search(r'[Nn]ose\s+shape:\s*(\w+)', advice)
        fin_root_match = re.search(r'[Ff]in\s+(?:dimensions)?:?\s*(?:root)?\s*(\d+(?:\.\d+)?)', advice)
        fin_span_match = re.search(r'[Ss]pan\s*[:-]?\s*(\d+(?:\.\d+)?)', advice)
        diameter_match = re.search(r'[Bb]ody\s+diameter:\s*(\d+(?:\.\d+)?)', advice)

        body_part = next((p for p in rocket_data.get("parts", []) if p.get("type") == "body"), None)
        nose_part = next((p for p in rocket_data.get("parts", []) if p.get("type") == "nose"), None)
        fin_part = next((p for p in rocket_data.get("parts", []) if p.get("type") == "fin"), None)

        if body_part and body_match:
            actions.append({"action": "update_part", "id": body_part["id"], "props": {"length": float(body_match.group(1))}})
        if nose_part and nose_match and nose_match.group(1).lower() in ["ogive", "conical"]:
            actions.append({"action": "update_part", "id": nose_part["id"], "props": {"shape": nose_match.group(1).lower()}})
        if fin_part:
            fin_updates = {}
            if fin_root_match: fin_updates["root"] = float(fin_root_match.group(1))
            if fin_span_match: fin_updates["span"] = float(fin_span_match.group(1))
            if fin_updates: actions.append({"action": "update_part", "id": fin_part["id"], "props": fin_updates})
        if body_part and diameter_match:
            actions.append({"action": "update_part", "id": body_part["id"], "props": {"Ø": float(diameter_match.group(1))}})
            if nose_part: # Match nose diameter to body diameter
                 actions.append({"action": "update_part", "id": nose_part["id"], "props": {"baseØ": float(diameter_match.group(1))}})


    except Exception as e:
        print(f"Error in OpenAI-assisted rocket design: {str(e)}. Falling back to physics-based design.")
        actions = physics_based_rocket_design(rocket_data, target_altitude) # Ensure this is awaited if it becomes async
    
    finally:
        actions.append({"action": "run_sim", "fidelity": "quick"})
        return actions

def calculate_rocket_mass(rocket_data: dict) -> float:
    total_mass = 0.05 
    for part in rocket_data.get("parts", []):
        part_type = part.get("type", "")
        if part_type == "nose":
            radius_m = part.get("baseØ", 5) / 200; length_m = part.get("length", 15) / 100
            total_mass += (1/3) * math.pi * radius_m**2 * length_m * 1200
        elif part_type == "body":
            radius_m = part.get("Ø", 5) / 200; length_m = part.get("length", 40) / 100
            total_mass += math.pi * radius_m**2 * length_m * 1000 * 0.08
        elif part_type == "fin":
            volume_m3 = (part.get("root", 10)/100) * (part.get("span", 8)/100) * (0.3/100)
            total_mass += volume_m3 * 700 * 4 # 4 fins
    return total_mass

def calculate_max_altitude(total_mass, thrust, burn_time, specific_impulse, drag_coef, rocket_data):
    body_part = next((p for p in rocket_data.get("parts", []) if p.get("type") == "body"), None)
    diameter = body_part.get("Ø", 5) if body_part else 5
    frontal_area = math.pi * (diameter / 200)**2
    effective_drag = drag_coef * 0.8 if thrust > 500 else drag_coef
    
    exhaust_velocity = specific_impulse * GRAVITATIONAL_ACCELERATION
    prop_mass = (thrust * burn_time) / exhaust_velocity # Tsiolkovsky for prop_mass
    dry_mass = total_mass - prop_mass
    if dry_mass <= 0 or total_mass <= dry_mass : # dry_mass must be less than total_mass
        print(f"Warning: Invalid mass values (total: {total_mass}, dry: {dry_mass}, prop: {prop_mass}). Using estimated dry_mass.")
        # Estimate dry_mass as a fraction of total_mass if calculation is off
        # This is a fallback, ideally PROPULSION_SYSTEMS should have consistent propellant_mass
        engine_details = PROPULSION_SYSTEMS.get(rocket_data.get('motorId', 'default-motor'), PROPULSION_SYSTEMS['default-motor'])
        prop_mass = engine_details['propellant_mass']
        dry_mass = total_mass - prop_mass
        if dry_mass <= 0: return 0 # Still invalid

    ideal_delta_v = exhaust_velocity * math.log(total_mass / dry_mass)
    
    propulsion_type = "solid"
    motor_id = rocket_data.get("motorId", "")
    if "liquid" in motor_id: propulsion_type = "liquid"
    elif "hybrid" in motor_id: propulsion_type = "hybrid"

    efficiency_factor, gravity_loss_factor = (0.85, 0.85) if propulsion_type == "liquid" else (0.78, 0.8) if propulsion_type == "hybrid" else (0.7, 0.75)
    
    gravity_loss = burn_time * GRAVITATIONAL_ACCELERATION * gravity_loss_factor
    delta_v = ideal_delta_v - gravity_loss
    drag_factor = 1.0 - (0.3 * effective_drag)
    
    max_altitude = 0
    if propulsion_type == "liquid":
        powered_altitude = max(0, (thrust / total_mass - GRAVITATIONAL_ACCELERATION) * (burn_time**2) / 2) * 0.8
        effective_delta_v = delta_v * drag_factor * efficiency_factor
        ballistic_altitude = (effective_delta_v**2) / (2 * GRAVITATIONAL_ACCELERATION)
        max_altitude = powered_altitude + ballistic_altitude
    else:
        effective_delta_v = delta_v * drag_factor * efficiency_factor
        max_altitude = (effective_delta_v**2) / (2 * GRAVITATIONAL_ACCELERATION)
        
    if max_altitude > 10000: max_altitude *= (1.0 + (math.log10(max_altitude/10000) * 0.3))
    return max_altitude

def select_engine_for_altitude(target_altitude, current_dry_mass):
    altitude_thresholds = {"mini-motor": 200, "default-motor": 500, "high-power": 1500, "super-power": 3000, "small-liquid": 10000, "hybrid-engine": 15000, "medium-liquid": 25000, "large-liquid": 80000}
    
    # Direct threshold selection for very high altitudes
    if target_altitude > 25000: return "large-liquid"
    if target_altitude > 10000: return "medium-liquid" # Covers 10-25km
    if target_altitude > 3000 and target_altitude <= 15000 : # Hybrid or Small Liquid
         # Prefer hybrid if it fits, else small liquid
        if target_altitude <= altitude_thresholds["hybrid-engine"]: return "hybrid-engine"
        return "small-liquid" # Covers 3-10km, or up to 15km if hybrid not chosen

    sorted_engines = sorted(PROPULSION_SYSTEMS.items(), key=lambda x: x[1]['total_impulse'])
    selected_engine_id = sorted_engines[0][0]

    for engine_id, engine_data in sorted_engines:
        total_mass = current_dry_mass + engine_data['propellant_mass'] + engine_data['dry_mass']
        exhaust_velocity = engine_data['specific_impulse'] * GRAVITATIONAL_ACCELERATION
        # Ensure propellant_mass is positive and less than total_mass for log
        prop_mass = engine_data['propellant_mass']
        if prop_mass <= 0 or total_mass <= prop_mass: continue # Skip invalid engine data for this calc

        dry_mass_for_calc = total_mass - prop_mass
        if dry_mass_for_calc <=0: continue

        delta_v = exhaust_velocity * math.log(total_mass / dry_mass_for_calc) - engine_data['burn_time'] * GRAVITATIONAL_ACCELERATION
        estimated_altitude = ( (delta_v * 0.7)**2) / (2 * GRAVITATIONAL_ACCELERATION) # 0.7 drag factor
        if estimated_altitude > 10000: estimated_altitude *= 1.2
        
        if estimated_altitude >= target_altitude * 0.8:
            selected_engine_id = engine_id
            break 
            
    # Threshold safety check
    current_engine_threshold = altitude_thresholds.get(selected_engine_id, 0)
    if target_altitude > current_engine_threshold * 1.2:
        for engine_id_thresh, max_alt_thresh in sorted(altitude_thresholds.items(), key=lambda x: x[1]):
            if max_alt_thresh >= target_altitude:
                selected_engine_id = engine_id_thresh
                break
        else: # If target still exceeds all, pick largest
            if target_altitude > altitude_thresholds.get(selected_engine_id, 0):
                 selected_engine_id = "large-liquid"

    print(f"Final engine selection for {target_altitude}m: {selected_engine_id}")
    return selected_engine_id

def physics_based_rocket_design(rocket_data, target_altitude):
    actions = []
    rocket_dry_mass = calculate_rocket_mass(rocket_data)
    selected_engine_id = select_engine_for_altitude(target_altitude, rocket_dry_mass)
    selected_engine = PROPULSION_SYSTEMS[selected_engine_id]
    actions.append({"action": "update_rocket", "props": {"motorId": selected_engine_id}})

    body_part = next((p for p in rocket_data.get("parts", []) if p.get("type") == "body"), None)
    nose_part = next((p for p in rocket_data.get("parts", []) if p.get("type") == "nose"), None)
    fin_part = next((p for p in rocket_data.get("parts", []) if p.get("type") == "fin"), None)

    is_liquid = "liquid" in selected_engine_id
    is_high_power_solid = "super-power" in selected_engine_id

    if body_part:
        base_length = body_part.get("length", 40)
        thrust_factor = math.sqrt(selected_engine['thrust'] / 32)
        altitude_factor = math.pow(max(100, target_altitude) / 500, 0.25) # Avoid log(0) or small numbers
        
        if is_liquid: new_length = min(250, max(100, 120 * thrust_factor * 0.6))
        elif is_high_power_solid: new_length = min(120, max(60, 80 * altitude_factor)) # Adjusted for high power solid
        else: new_length = min(120, max(40, base_length * thrust_factor * altitude_factor))
        actions.append({"action": "update_part", "id": body_part["id"], "props": {"length": round(new_length, 1)}})
        
        if is_liquid:
            current_diameter = body_part.get("Ø", 5)
            new_diameter = min(15, max(8, current_diameter * 1.6))
            if new_diameter > current_diameter:
                actions.append({"action": "update_part", "id": body_part["id"], "props": {"Ø": round(new_diameter, 1)}})
                if nose_part: # Match nose base diameter
                    actions.append({"action": "update_part", "id": nose_part["id"], "props": {"baseØ": round(new_diameter, 1)}})


    if fin_part:
        velocity_factor = 1.1 if target_altitude < 1000 else 1.3 if target_altitude < 5000 else 1.5 if target_altitude < 20000 else 1.8
        if is_liquid: velocity_factor *= 1.3
        
        new_root = min(25, max(10, fin_part.get("root", 10) * velocity_factor))
        new_span = min(20, max(8, fin_part.get("span", 8) * velocity_factor))

        if body_part and is_liquid: # Proportional fins for liquid rockets
            body_len = body_part.get("length", new_length if 'new_length' in locals() else 80) # Use updated length if available
            body_dia = body_part.get("Ø", new_diameter if 'new_diameter' in locals() else 5)
            new_root = max(new_root, body_len * 0.15)
            new_span = max(new_span, body_dia * 1.5) # Adjusted span factor

        actions.append({"action": "update_part", "id": fin_part["id"], "props": {"root": round(new_root, 1), "span": round(new_span, 1)}})

    if nose_part and (is_liquid or target_altitude > 1000): # Ogive for higher performance
        if nose_part.get("shape", "ogive") != "ogive":
            actions.append({"action": "update_part", "id": nose_part["id"], "props": {"shape": "ogive"}})
            
    actions.append({"action": "run_sim", "fidelity": "quick"})
    print(f"[physics_based_rocket_design] Generated actions: {json.dumps(actions)}") # ADD THIS LOG
    return actions

def format_response(text: str) -> str:
    """Format the agent's response for better readability."""
    # Remove any existing HTML tags for safety (avoid duplicating formatting)
    text = re.sub(r'<\/?[^>]+>', '', text)
    
    # Remove the CURRENT_ROCKET_JSON block from responses if it's included
    text = re.sub(r'CURRENT_ROCKET_JSON:?\s*```json\s*\{.*?\}\s*```', '', text, flags=re.DOTALL)
    
    # 1. Format tables first as they are distinct blocks
    if '|' in text and re.search(r'\|[^|]+\|[^|]+\|', text):
        table_sections = re.finditer(r'([^\n]*\|[^\n]*\n){2,}', text)
        for section in table_sections:
            # Process table content here (same as before)
            table_html = '<div class="table-wrapper"><table class="data-table">'
            rows = section.group(0).strip().split('\n')
            has_header = len(rows) > 1 and re.match(r'\s*\|[\s\-:]+\|[\s\-:]+\|', rows[1])
            for i, row_text in enumerate(rows):
                if i == 1 and has_header: continue
                if row_text.strip():
                    cells = [cell.strip() for cell in row_text.strip().split('|') if cell.strip()]
                    row_html_tag = '<tr>'
                    for cell_text in cells:
                        tag = 'th' if (i == 0 and has_header) else 'td'
                        row_html_tag += f'<{tag}>{cell_text}</{tag}>'
                    row_html_tag += '</tr>'
                    table_html += row_html_tag
            table_html += '</table></div>'
            text = text.replace(section.group(0), table_html)

    # 2. Format headings
    text = re.sub(r'^###\s+(.+?)$', r'<h3>\1</h3>', text, flags=re.MULTILINE)
    text = re.sub(r'^##\s+(.+?)$', r'<h2>\1</h2>', text, flags=re.MULTILINE)
    text = re.sub(r'^#\s+(.+?)$', r'<h1>\1</h1>', text, flags=re.MULTILINE)

    # 3. Format numbered lists (e.g., 1. **Title**: Content)
    def replace_numbered_list(match_obj):
        list_block = match_obj.group(1)
        items_html = []
        item_pattern = r'^(\d+)\.\s+\*\*(.+?)\*\*(?::|\.|\s+)(.+?)$'
        for line in list_block.strip().split('\n'):
            item_match = re.match(item_pattern, line.strip())
            if item_match:
                num, title, content = item_match.groups()
                items_html.append(f'<div class="step-item"><span class="step-number">{num}</span><strong>{title.strip()}</strong> {content.strip()}</div>')
        if not items_html:
            return match_obj.group(0) # Return original if no items matched (should not happen with outer pattern)
        return f'<div class="steps-container">{"".join(items_html)}</div>'
    
    numbered_list_block_pattern = r'(^(?:\d+\.\s+\*\*.*?\*\*(?::|\.|\s+).*?(?:\n|$))+)'
    text = re.sub(numbered_list_block_pattern, replace_numbered_list, text, flags=re.MULTILINE)

    # 4. Format bulleted lists (e.g., - Item content or * Item content)
    def replace_bulleted_list(match_obj):
        list_block = match_obj.group(1)
        items_html = []
        # Handle both '*' and '-' as bullets, also allow for optional '**bold**' content start
        item_pattern = r'^[\*\-]\s+(?:\*\*(.+?)\*\*\s*)?(.*)$'
        for line in list_block.strip().split('\n'):
            item_match = re.match(item_pattern, line.strip())
            if item_match:
                bold_part, rest_part = item_match.groups()
                content = ""
                if bold_part:
                    content += f'<strong>{bold_part.strip()}</strong> '
                content += rest_part.strip()
                items_html.append(f'<div class="bullet-item">{content}</div>')
        if not items_html:
             return match_obj.group(0)
        return f'<div class="bullet-list-container">{"".join(items_html)}</div>'

    bullet_list_block_pattern = r'(^(?:[\*\-]\s+.*?(?:\n|$))+)'
    text = re.sub(bullet_list_block_pattern, replace_bulleted_list, text, flags=re.MULTILINE)
    
    # 5. Format data presentations (e.g., "Your current X is Y")
    text = re.sub(r'Your (current|rocket\'s) (\w+) is ([^\n\.]+)\.?',
                r'Your \1 <strong>\2</strong> is <span class="highlight-value">\3</span>.', text)
    text = re.sub(r'The current ([a-z\s]+) is ([^\n\.]+)\.?',
                 r'The current <strong>\1</strong> is <span class="highlight-value">\2</span>.', text)


    # 6. Format bold and italic text (must come after list processing that uses similar markdown)
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'\*(.+?)\*', r'<em>\1</em>', text)
    
    # 7. Format code blocks and inline code
    text = re.sub(r'```(\w*)\n(.*?)\n```', r'<pre class="code-block \1">\2</pre>', text, flags=re.DOTALL)
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)
    
    # 8. Format paragraphs (final step)
    paragraphs = []
    # Split by double newlines, or single if it's likely a new paragraph start
    chunks = re.split(r'\n\s*\n|(?<!\n)\n(?!<(?:div|h[1-6]|pre|table|ul|li))', text) 
    for chunk in chunks:
        if chunk is None or not chunk.strip():
            continue
        # Skip wrapping if chunk already IS a block-level HTML element
        if re.match(r'^\s*<(div|h[1-6]|pre|table|ul|li)', chunk.strip(), re.IGNORECASE):
            paragraphs.append(chunk.strip())
        else:
            paragraphs.append(f'<p>{chunk.strip()}</p>') # Wrap in paragraph tags
    
    return '\n'.join(paragraphs)

# --- FastAPI Endpoints ---
@app.post("/reason")
async def reason(req: ChatRequest):
    try:
        latest_message_text = ""
        if req.messages and req.messages[-1]['role'] == 'user':
            latest_message_text = req.messages[-1]['content']
            print(f"PRE-PROCESSING USER MESSAGE: {latest_message_text}")

            # Handle direct queries about rocket attributes
            attribute_patterns = {
                r'(?:what|tell me|show).*(?:current|my).*body.*(?:height|length)': 
                    lambda r: get_part_attribute(r, "body", "length", "The current body length is {}cm."),
                r'(?:what|tell me|show).*(?:current|my).*(?:diameter|radius|width)': 
                    lambda r: get_part_attribute(r, "body", "Ø", "The current body diameter is {}cm."),
                r'(?:what|tell me|show).*(?:current|my).*(?:nose|cone).*(?:height|length)': 
                    lambda r: get_part_attribute(r, "nose", "length", "The current nose cone length is {}cm."),
                r'(?:what|tell me|show).*(?:current|my).*fin.*(?:span|size)': 
                    lambda r: get_part_attribute(r, "fin", "span", "The current fin span is {}cm."),
                r'(?:what|tell me|show).*(?:current|my).*fin.*root': 
                    lambda r: get_part_attribute(r, "fin", "root", "The current fin root length is {}cm."),
                r'(?:what|tell me|show).*(?:current|my).*motor': 
                    lambda r: f"Your rocket is currently using the **{r.get('motorId', 'default-motor')}** motor."
            }
            
            for pattern, response_fn in attribute_patterns.items():
                if re.search(pattern, latest_message_text, re.IGNORECASE):
                    response = response_fn(req.rocket)
                    if response:
                        return {
                            "final_output": response,
                            "actions": "[]",
                            "agent_used": "direct_query"
                        }

            # Handle direct modification commands with sensible defaults
            modification_patterns = [
                # Body length modifications
                (r'(?:make|increase|extend)(?:\s+the)?\s+body\s+(?:longer|taller|bigger)', 
                 lambda r: handle_body_extension(r, None)),
                (r'(?:make|increase|extend)(?:\s+the)?\s+body\s+(?:by|to)\s+(\d+(?:\.\d+)?)', 
                 lambda r, m: handle_body_extension(r, float(m.group(1)))),
                (r'(?:make|increase|extend)(?:\s+the)?\s+body\s+(\d+(?:\.\d+)?)\s*x\s+(?:longer|taller|bigger)',
                 lambda r, m: handle_body_extension(r, float(m.group(1)))),
                 
                # Height modifications (for the whole rocket or body)
                (r'(?:increase|extend)(?:\s+(?:the|rocket))?\s+height\s+(?:by)?\s+(\d+(?:\.\d+)?)',
                 lambda r, m: handle_height_increase(r, float(m.group(1)))),
                
                # Nose length modifications
                (r'(?:make|increase|extend)(?:\s+the)?\s+(?:nose|cone)\s+(?:longer|taller|bigger)',
                 lambda r: handle_nose_extension(r, None)),
                (r'(?:make|increase|extend)(?:\s+the)?\s+(?:nose|cone)\s+(?:by|to)\s+(\d+(?:\.\d+)?)',
                 lambda r, m: handle_nose_extension(r, float(m.group(1)))),
                (r'(?:make|increase|extend)(?:\s+the)?\s+(?:nose|cone)\s+(\d+(?:\.\d+)?)\s*x\s+(?:longer|taller|bigger)',
                 lambda r, m: handle_nose_extension(r, float(m.group(1)))),
                 
                # Fin modifications
                (r'(?:make|increase)(?:\s+the)?\s+fins?\s+(?:larger|bigger)',
                 lambda r: handle_fin_enlargement(r, None)),
                (r'(?:make|increase)(?:\s+the)?\s+fins?\s+(?:span|width)\s+(?:by|to)\s+(\d+(?:\.\d+)?)',
                 lambda r, m: handle_fin_enlargement(r, float(m.group(1)))),
                (r'(?:make|increase)(?:\s+the)?\s+fins?\s+(\d+(?:\.\d+)?)\s*x\s+(?:larger|bigger)',
                 lambda r, m: handle_fin_enlargement(r, float(m.group(1)))),
                 
                # Color changes
                (r'(?:make|paint|color)(?:\s+it|the\s+rocket|everything)\s+(red|blue|green|yellow|black|white|purple|orange)',
                 lambda r, m: handle_color_change(r, m.group(1), "all")),
                (r'(?:make|paint|color)(?:\s+the)?\s+(body|nose|fins?)\s+(red|blue|green|yellow|black|white|purple|orange)',
                 lambda r, m: handle_color_change(r, m.group(2), m.group(1)))
            ]
            
            for pattern, handler in modification_patterns:
                match = re.search(pattern, latest_message_text, re.IGNORECASE)
                if match:
                    if len(handler.__code__.co_varnames) > 1:
                        result = handler(req.rocket, match)
                    else:
                        result = handler(req.rocket)
                    
                    if result:
                        return {
                            "final_output": result["message"],
                            "actions": json.dumps(result["actions"]),
                            "agent_used": "direct_action"
                        }

            # 1. Altitude Pre-processing
            altitude_patterns = [
                r'reach\s+(\d+(?:\.\d+)?)\s*m(?:eters?)?(?:\s+altitude)?', r'altitude\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*m',
                r'(\d+(?:\.\d+)?)\s*m(?:eters?)?\s+(?:high|altitude)', r'design.*?(\d+)m', r'.*?(\d+)\s*meters?',
                r'reach\s+(\d+(?:\.\d+)?)\s*k(?:m|ilometers?)(?:\s+altitude)?', r'altitude\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*k(?:m|ilometers?)',
                r'(\d+(?:\.\d+)?)\s*k(?:m|ilometers?)?\s+(?:high|altitude)', r'design.*?(\d+)k(?:m|ilometers?)', r'.*?(\d+)\s*k(?:ilo)?m(?:eters?)?'
            ]
            for i, pattern in enumerate(altitude_patterns):
                altitude_match = re.search(pattern, latest_message_text.lower())
                if altitude_match:
                    target_altitude = float(altitude_match.group(1))
                    if i >= 5: target_altitude *= 1000
                    
                    print(f"ALTITUDE PRE-PROCESSING: Detected target {target_altitude}m. Calling design_rocket_for_altitude.")
                    actions_list = await design_rocket_for_altitude(req.rocket, target_altitude)
                    # design_rocket_for_altitude already includes a simulation action
                    return {
                        "final_output": f"Okay, I've configured the rocket to aim for {target_altitude}m. I've adjusted the motor, body, and fins, and initiated a simulation.",
                        "actions": json.dumps(actions_list)
                    }
        
        # 2. Agent-based Processing
        print("No altitude pre-processing triggered. Proceeding with agent.")
        current_rocket_json_str = json.dumps(req.rocket, indent=2)
        
        # Determine which agent to use based on message content
        selected_agent = "master"  # Default to master agent
        
        if latest_message_text:
            # Simple keyword-based routing
            query_starters = r"^(what|what's|whats|tell me|show me|can you tell me|is the|does the|how (?:much|many|big|long|tall))"
            modification_keywords = r"(change|modify|update|add|set|increase|decrease|make|paint|color|shape|size|length|diameter|extend|enlarge)"

            if re.search(r'(simulate|simulation|test flight|launch|run sim)', latest_message_text.lower()):
                selected_agent = "sim"
            elif re.search(r'(analysis|metrics|performance|stability|center of|drag|weight distribution|calculate)', latest_message_text.lower()) and not re.search(query_starters, latest_message_text.lower()):
                selected_agent = "metrics"
            # If it's a query, it should not go to design, even if it contains design-related keywords like 'diameter'
            elif re.search(query_starters, latest_message_text.lower()):
                # For now, let master handle queries; it can then decide if QA or Metrics agent tool is best, or answer directly if simple enough.
                selected_agent = "master" # Or potentially a dedicated "qa" agent if master is too complex for simple lookups.
            elif re.search(modification_keywords, latest_message_text.lower()):
                selected_agent = "design"
            # If unclear or complex request, default to master agent (already the default)
        
        print(f"Selected agent: {selected_agent}")
        
        # Initialize collected_actions with direct fallback if possible for common patterns
        collected_actions = []
        if (match := re.search(r'span\s+to\s+(\d+(?:\.\d+)?)', latest_message_text)):
            # Direct pattern for span modification
            new_span = float(match.group(1))
            for part in req.rocket.get("parts", []):
                if part.get("type") == "fin":
                    collected_actions.append({"action": "update_part", "id": part["id"], "props": {"span": new_span}})
                    final_assistant_response = f"I've increased the fin span to {new_span}."
                    return {
                        "final_output": final_assistant_response,
                        "actions": json.dumps(collected_actions),
                        "agent_used": selected_agent
                    }
        # Direct pattern for simulation requests
        elif re.search(r'(run|start|perform)\s+(a\s+)?(quick|high|hifi|high[\s-]fidelity)?\s*simulation', latest_message_text, re.IGNORECASE):
            fidelity = "hifi" if re.search(r'(high|hifi|high[\s-]fidelity)', latest_message_text, re.IGNORECASE) else "quick"
            collected_actions.append({"action": "run_sim", "fidelity": fidelity})
            final_assistant_response = f"Running a {fidelity} simulation for your rocket."
            return {
                "final_output": final_assistant_response,
                "actions": json.dumps(collected_actions),
                "agent_used": selected_agent
            }
        
        try:
            # Using Runner with the correct API for openai-agents version 0.0.14
            runner = Runner()
            
            user_message = req.messages[-1]['content'] if req.messages and req.messages[-1]['role'] == 'user' else ""
            
            # Context-aware input enhancement for follow-ups
            agent_input = user_message
            if len(req.messages) >= 3 and req.messages[-1]['role'] == 'user' and req.messages[-2]['role'] == 'assistant':
                # Check for follow-up keywords in the user's latest message
                follow_up_keywords = ['proceed', 'do that', 'yes', 'apply', 'go ahead', 'continue', 'make it happen', 'best possible']
                if any(keyword in user_message.lower() for keyword in follow_up_keywords):
                    previous_agent_response = req.messages[-2]['content']
                    agent_input = f"My previous response was: \n'''{previous_agent_response}'''\n\nThe user's new instruction is: \n'''{user_message}'''"
            
            rocket_json_str = json.dumps(req.rocket, indent=2)
            
            # Add rocket data to the user's message for context if not already part of a specific follow-up structure
            if "CURRENT_ROCKET_JSON" not in agent_input:
                 enhanced_input = f"{agent_input}\n\nCURRENT_ROCKET_JSON:\n```json\n{rocket_json_str}\n```"
            else:
                enhanced_input = agent_input # Already structured with rocket data potentially
            
            result = await runner.run(
                agents[selected_agent],
                input=enhanced_input,
                context={"current_rocket_json_str": current_rocket_json_str} # Context still useful for sub-agents
            )
            
            # Process the result
            final_assistant_response = result.final_output
            
            # Parse the actions from tool calls
            if hasattr(result, 'steps') and result.steps:
                for step in result.steps:
                    if hasattr(step, 'tool_calls') and step.tool_calls:
                        for tool_call in step.tool_calls:
                            tool_name = tool_call.name
                            tool_output_str = tool_call.output # For master_agent, this is output from design_agent_tool etc.
                                                              # For design_agent itself, this is output from add_part etc.
                            print(f"Agent '{selected_agent}' called tool '{tool_name}'. Output: {tool_output_str}")

                            if selected_agent == "master" and tool_name in ["design_agent_tool", "sim_agent_tool"]:
                                try:
                                    action = json.loads(tool_output_str) # tool_output_str is the action JSON from sub-agent's tool
                                    if isinstance(action, dict) and action.get("action") != "no_op":
                                        collected_actions.append(action)
                                    # Master agent formulates its own response later based on these actions and its instructions
                                    # So, we might not use master_agent's direct result.final_output if it just matches tool_output_str
                                    if final_assistant_response == tool_output_str: final_assistant_response = None 
                                except json.JSONDecodeError:
                                    print(f"Warning: Output from master's tool '{tool_name}' was not valid JSON: {tool_output_str}")
                            elif selected_agent != "master" and tool_name in ["add_part", "update_part", "update_rocket", "run_simulation"]:
                                # Direct call to design/sim agent, and it used one of ITS tools
                                try:
                                    action = json.loads(tool_output_str) # tool_output_str is the action JSON
                                    if isinstance(action, dict) and action.get("action") != "no_op":
                                        collected_actions.append(action)
                                    # If the agent directly called a tool, its final_output might be just the JSON string.
                                    # We want to replace it with a more natural response later.
                                    if final_assistant_response == tool_output_str: final_assistant_response = None
                                except json.JSONDecodeError:
                                    print(f"Warning: Output from '{selected_agent}' agent's tool '{tool_name}' was not valid JSON: {tool_output_str}")
            
            # If NO tool calls were recorded in steps, but the agent's final_output ITSELF is a parsable action JSON
            # (this handles if a specialized agent like 'design' directly returns the JSON text instead of via a formal tool_call step)
            if not collected_actions and final_assistant_response and selected_agent != "master":
                try:
                    # Attempt to parse final_assistant_response as if it IS the action JSON
                    potential_action = json.loads(final_assistant_response)
                    if isinstance(potential_action, dict) and 'action' in potential_action and potential_action.get("action") != "no_op":
                        print(f"Treating final_output from '{selected_agent}' as direct action JSON: {potential_action}")
                        collected_actions.append(potential_action)
                        # Since we used its final_output as an action, clear it so we can formulate a better response.
                        final_assistant_response = None 
                    elif isinstance(potential_action, dict) and potential_action.get("action") == "no_op":
                        print(f"Agent '{selected_agent}' returned a no_op action directly in final_output: {potential_action.get('reason')}")
                        # Keep final_assistant_response as the no_op JSON, it will be handled by response generation or formatting.
                        # Or, set a specific message: final_assistant_response = potential_action.get('reason')
                        final_assistant_response = f"The request resulted in no specific design change: {potential_action.get('reason', 'No action taken.')}" 

                except json.JSONDecodeError:
                    # final_assistant_response was not a parsable JSON. It's just text from the agent.
                    print(f"Agent '{selected_agent}' produced no tool calls, and its final_output is not direct action JSON. Output: {final_assistant_response}")
                    pass # Let the existing final_assistant_response (text) be handled by fallback or response generation

        except Exception as agent_run_error:
            print(f"Error during agent run ('{selected_agent}'): {str(agent_run_error)}")
            # If an error occurs, final_assistant_response might be None or some error message from SDK
            # Ensure it's at least a string for later logic.
            if not isinstance(final_assistant_response, str):
                 final_assistant_response = f"An error occurred while processing with the {selected_agent} agent."
            # collected_actions will be empty, triggering fallback

        # 3. Fallback Logic / Response Formulation
        if not collected_actions and latest_message_text:
            print("Agent did not produce tool calls or errored. Attempting fallback intent extraction from original user message.")
            # ALWAYS use the original user message for fallback if agent failed to produce tool calls.
            fallback_actions = await extract_intent_from_text(latest_message_text, req.rocket)
            if fallback_actions:
                print(f"Fallback intent extraction produced actions: {fallback_actions}")
                collected_actions.extend(fallback_actions)
                # Construct a new final_assistant_response based *only* on these fallback_actions
                if collected_actions: # Should be true if fallback_actions is not empty
                    action_summary_parts = []
                    for action in collected_actions:
                        if action.get('action') == 'update_part':
                            action_summary_parts.append(f"updated part '{action.get('id')}' with properties {action.get('props')}")
                        elif action.get('action') == 'add_part':
                            action_summary_parts.append(f"added a new '{action.get('type')}' part with properties {action.get('props')}")
                        elif action.get('action') == 'update_rocket':
                            action_summary_parts.append(f"updated rocket properties with {action.get('props')}")
                        elif action.get('action') == 'run_sim':
                            action_summary_parts.append(f"initiated a '{action.get('fidelity')}' simulation")
                        else:
                            action_summary_parts.append(f"performed action: {action.get('action')} with details {action.get('props') or action}") # Generic fallback
                    
                    if action_summary_parts:
                        final_assistant_response = f"Okay, I've processed your request: { '; '.join(action_summary_parts) }."
                    else: # Should not happen if collected_actions is not empty
                        final_assistant_response = f"I've performed the requested actions: {json.dumps(collected_actions)}" # Fallback to raw JSON dump
                else: # Should not happen if fallback_actions was populated
                    final_assistant_response = "I processed your request via fallback, but no specific actions were finalized."
            else: # Agent failed AND fallback also failed to produce actions
                # If agent had some textual response, use it, otherwise a generic failure.
                if not final_assistant_response: # Only if agent produced no text at all
                    final_assistant_response = "I'm sorry, I couldn't determine the exact modification or action from your request. Could you please be more specific or try rephrasing?"
                # If final_assistant_response already has text from the agent (even if it's a hallucination without actions),
                # we might let it pass here, or explicitly override it. For now, let agent's text pass if it exists.
                print(f"Agent and fallback failed to produce actions. Agent's original text (if any): {final_assistant_response}")

        if not final_assistant_response and collected_actions:
            # Construct a descriptive summary if actions were collected but no specific response was formulated.
            action_summary_parts = []
            for action in collected_actions:
                if action.get('action') == 'update_part':
                    action_summary_parts.append(f"updated part '{action.get('id')}' with properties {action.get('props')}")
                elif action.get('action') == 'add_part':
                    action_summary_parts.append(f"added a new '{action.get('type')}' part with properties {action.get('props')}")
                elif action.get('action') == 'update_rocket':
                    action_summary_parts.append(f"updated rocket properties with {action.get('props')}")
                elif action.get('action') == 'run_sim':
                    action_summary_parts.append(f"initiated a '{action.get('fidelity')}' simulation")
                else:
                    action_summary_parts.append(f"performed action: {action.get('action')} with details {action.get('props') or action}") # Generic fallback
            
            if action_summary_parts:
                final_assistant_response = f"Okay, I've processed your request: { '; '.join(action_summary_parts) }."
            else: # Should not happen if collected_actions is not empty
                final_assistant_response = f"I've performed the requested actions: {json.dumps(collected_actions)}" # Fallback to raw JSON dump
        elif not final_assistant_response and not collected_actions:
            # This is the ultimate fallback if no response has been set and no actions taken.
            final_assistant_response = "I received your message, but I'm not sure what action to take. Could you please clarify or try rephrasing?"

        print(f"Final actions to return: {json.dumps(collected_actions)}")
        print(f"Final text output: {final_assistant_response}")

        # Format the response before returning
        formatted_response = format_response(final_assistant_response)

        return {
            "final_output": formatted_response,
            "actions": json.dumps(collected_actions),
            "trace_url": result.trace_url if 'result' in locals() and hasattr(result, 'trace_url') else None,
            "agent_used": selected_agent if 'selected_agent' in locals() else "unknown"
        }

    except Exception as e:
        print(f"Error in /reason: {str(e)}")
        # Log the full traceback for debugging
        import traceback
        traceback.print_exc()
        
        # Try to use fallback logic even on errors
        try:
            if 'latest_message_text' in locals() and latest_message_text:
                fallback_actions = await extract_intent_from_text(latest_message_text, req.rocket)
                if fallback_actions:
                    response_text = "I had some trouble processing your request, but I'll try to help anyway."
                    if "span" in latest_message_text.lower():
                        for action in fallback_actions:
                            if action.get("action") == "update_part" and "span" in action.get("props", {}):
                                new_span = action["props"]["span"]
                                response_text = f"I've adjusted the fin span to {new_span}."
                                break
                    # Format the response before returning
                    response_text = format_response(response_text)
                    return {
                        "final_output": response_text,
                        "actions": json.dumps(fallback_actions),
                        "trace_url": None,
                        "agent_used": "fallback"
                    }
        except Exception as fallback_error:
            print(f"Error in fallback error handling: {str(fallback_error)}")
        
        # Return a generic error to the client
        return {
            "final_output": "I encountered an unexpected error processing your request. Please try again or contact support if the issue persists.",
            "actions": "[]",
            "trace_url": None,
            "agent_used": selected_agent if 'selected_agent' in locals() else "unknown"
        }

def get_part_attribute(rocket: dict, part_type: str, attribute: str, template: str) -> str:
    """Extract a specific attribute from a rocket part and format it into a response"""
    for part in rocket.get('parts', []):
        if part.get('type') == part_type and attribute in part:
            return template.format(part[attribute])
    
    # If the specific part or attribute isn't found, provide a detailed response
    all_parts = [f"**{p.get('type', 'unknown')}**" for p in rocket.get('parts', [])]
    parts_list = ", ".join(all_parts) if all_parts else "No parts found"
    
    if not any(p.get('type') == part_type for p in rocket.get('parts', [])):
        return f"I don't see a {part_type} component in your rocket. Your rocket has: {parts_list}."
    else:
        # Part exists but attribute doesn't
        return f"I found a {part_type} component, but it doesn't have a {attribute} attribute defined."

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.post("/reason-with-agent")
async def reason_with_agent(req: AgentRequest):
    try:
        print(f"Explicitly requested agent: {req.agent}")
        
        if req.agent not in agents:
            return {
                "final_output": f"Error: Unknown agent '{req.agent}'. Available agents: {', '.join(agents.keys())}",
                "actions": "[]",
                "trace_url": None
            }
        
        # Get rocket data
        current_rocket_json_str = json.dumps(req.rocket, indent=2)
        
        # Run the specified agent using Runner with the correct API
        runner = Runner()
        result = await runner.run(
            agents[req.agent],
            input=req.messages[-1]['content'] if req.messages else "",
            context={"current_rocket_json_str": current_rocket_json_str}
        )
        
        # Process the result
        final_assistant_response = result.final_output
        collected_actions = []
        
        # Parse the actions from tool calls
        if hasattr(result, 'steps') and result.steps:
            for step in result.steps:
                if hasattr(step, 'tool_calls') and step.tool_calls:
                    for tool_call in step.tool_calls:
                        tool_name = tool_call.name
                        if tool_name in ['add_part', 'update_part', 'update_rocket', 'run_simulation']:
                            # Direct tool call
                            action = json.loads(tool_call.output)
                            collected_actions.append(action)
        
        # Fallback logic
        if not collected_actions and final_assistant_response:
            fallback_actions = await extract_intent_from_text(final_assistant_response, req.rocket)
            if fallback_actions:
                collected_actions.extend(fallback_actions)
                if not final_assistant_response:
                    final_assistant_response = "I've processed your request based on the text."

        if not final_assistant_response and collected_actions:
            final_assistant_response = "I've performed the requested actions."
        elif not final_assistant_response and not collected_actions:
            final_assistant_response = "I received your message, but I'm not sure what action to take. Could you please clarify?"

        # Format the response before returning
        formatted_response = format_response(final_assistant_response)

        return {
            "final_output": formatted_response,
            "actions": json.dumps(collected_actions),
            "trace_url": result.trace_url if hasattr(result, 'trace_url') else None,
            "agent_used": req.agent
        }
    except Exception as e:
        print(f"Error in /reason-with-agent: {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "final_output": "I encountered an unexpected error processing your request. Please try again or contact support if the issue persists.",
            "actions": "[]",
            "trace_url": None,
            "agent_used": req.agent
        }

def handle_body_extension(rocket: dict, value: float = None) -> dict:
    """Handle body extension requests with sensible defaults"""
    body_part = None
    for part in rocket.get('parts', []):
        if part.get('type') == 'body':
            body_part = part
            break
    
    if not body_part:
        return {
            "message": "I couldn't find a body component in your rocket design. Please add a body tube first.",
            "actions": []
        }
    
    current_length = body_part.get('length', 0)
    
    # If no specific value given, increase by 30%
    if value is None:
        new_length = round(current_length * 1.3, 1)
        message = f"I've increased the body length by 30% from {current_length}cm to {new_length}cm."
    # If value is small (likely a multiplier), treat as factor
    elif value < 5:
        new_length = round(current_length * value, 1)
        message = f"I've multiplied the body length by {value}x from {current_length}cm to {new_length}cm."
    # If value has decimal, assume it's exact new length
    elif value % 1 != 0:
        new_length = value
        message = f"I've set the body length to exactly {new_length}cm (was {current_length}cm)."
    # Otherwise, treat as addition
    else:
        new_length = current_length + value
        message = f"I've extended the body by {value}cm from {current_length}cm to {new_length}cm."
    
    return {
        "message": message,
        "actions": [{"action": "update_part", "id": body_part['id'], "props": {"length": new_length}}]
    }

def handle_nose_extension(rocket: dict, value: float = None) -> dict:
    """Handle nose extension requests with sensible defaults"""
    nose_part = None
    for part in rocket.get('parts', []):
        if part.get('type') == 'nose':
            nose_part = part
            break
    
    if not nose_part:
        return {
            "message": "I couldn't find a nose cone in your rocket design. Please add a nose cone first.",
            "actions": []
        }
    
    current_length = nose_part.get('length', 0)
    
    # If no specific value given, increase by 20%
    if value is None:
        new_length = round(current_length * 1.2, 1)
        message = f"I've increased the nose cone length by 20% from {current_length}cm to {new_length}cm."
    # If value is small (likely a multiplier), treat as factor
    elif value < 5:
        new_length = round(current_length * value, 1)
        message = f"I've multiplied the nose length by {value}x from {current_length}cm to {new_length}cm."
    # If value has decimal, assume it's exact new length
    elif value % 1 != 0:
        new_length = value
        message = f"I've set the nose length to exactly {new_length}cm (was {current_length}cm)."
    # Otherwise, treat as addition
    else:
        new_length = current_length + value
        message = f"I've extended the nose by {value}cm from {current_length}cm to {new_length}cm."
    
    return {
        "message": message,
        "actions": [{"action": "update_part", "id": nose_part['id'], "props": {"length": new_length}}]
    }

def handle_fin_enlargement(rocket: dict, value: float = None) -> dict:
    """Handle fin enlargement requests with sensible defaults"""
    fin_part = None
    for part in rocket.get('parts', []):
        if part.get('type') == 'fin':
            fin_part = part
            break
    
    if not fin_part:
        return {
            "message": "I couldn't find fins in your rocket design. Please add fins first.",
            "actions": []
        }
    
    current_span = fin_part.get('span', 0)
    current_root = fin_part.get('root', 0)
    
    # If no specific value given, increase by 25%
    if value is None:
        new_span = round(current_span * 1.25, 1)
        new_root = round(current_root * 1.25, 1)
        message = (f"I've increased the fin size by 25%. Span: {current_span}cm → {new_span}cm. "
                  f"Root: {current_root}cm → {new_root}cm.")
        props = {"span": new_span, "root": new_root}
    # Assume this is specifically for span
    else:
        # If value is small (likely a multiplier), treat as factor
        if value < 5:
            new_span = round(current_span * value, 1)
            message = f"I've multiplied the fin span by {value}x from {current_span}cm to {new_span}cm."
        # If value has decimal, assume it's exact new span
        elif value % 1 != 0:
            new_span = value
            message = f"I've set the fin span to exactly {new_span}cm (was {current_span}cm)."
        # Otherwise, treat as addition
        else:
            new_span = current_span + value
            message = f"I've increased the fin span by {value}cm from {current_span}cm to {new_span}cm."
        props = {"span": new_span}
    
    return {
        "message": message,
        "actions": [{"action": "update_part", "id": fin_part['id'], "props": props}]
    }

def handle_color_change(rocket: dict, color_name: str, target: str) -> dict:
    """Handle color change requests"""
    color_map = {
        "red": "#FF0000",
        "blue": "#0000FF",
        "green": "#00FF00",
        "yellow": "#FFFF00",
        "purple": "#800080",
        "orange": "#FFA500",
        "black": "#000000",
        "white": "#FFFFFF"
    }
    
    if color_name.lower() not in color_map:
        return None
    
    color_hex = color_map[color_name.lower()]
    
    if target.lower() in ["all", "everything", "it", "rocket"]:
        return {
            "message": f"I've painted the entire rocket {color_name}.",
            "actions": [{"action": "update_part", "id": "all", "props": {"color": color_hex}}]
        }
    
    # Target is a specific part type
    target_type = ""
    if "fin" in target.lower():
        target_type = "fin"
    elif "nose" in target.lower() or "cone" in target.lower():
        target_type = "nose"
    elif "body" in target.lower() or "tube" in target.lower():
        target_type = "body"
    
    if not target_type:
        return None
        
    part_ids = []
    for part in rocket.get('parts', []):
        if part.get('type') == target_type:
            part_ids.append(part['id'])
    
    if not part_ids:
        return {
            "message": f"I couldn't find any {target_type} components to color.",
            "actions": []
        }
    
    actions = [{"action": "update_part", "id": pid, "props": {"color": color_hex}} for pid in part_ids]
    return {
        "message": f"I've painted the {target_type} {color_name}.",
        "actions": actions
    }

def handle_height_increase(rocket: dict, value: float) -> dict:
    """Handle height increase requests by extending the body"""
    body_part = None
    for part in rocket.get('parts', []):
        if part.get('type') == 'body':
            body_part = part
            break
    
    if not body_part:
        return {
            "message": "I couldn't find a body component in your rocket design. Please add a body tube first.",
            "actions": []
        }
    
    current_length = body_part.get('length', 0)
    new_length = current_length + value
    
    # Generate a detailed response showing the rocket parts
    parts_summary = "Current rocket parts:\n"
    for part in rocket.get('parts', []):
        part_type = part.get('type', 'unknown')
        if part_type == 'body':
            parts_summary += f"- Body: length={part.get('length')}cm, diameter={part.get('Ø')}cm\n"
        elif part_type == 'nose':
            parts_summary += f"- Nose: length={part.get('length')}cm, shape={part.get('shape', 'ogive')}\n"
        elif part_type == 'fin':
            parts_summary += f"- Fins: root={part.get('root')}cm, span={part.get('span')}cm\n"
    
    message = f"I've increased the rocket height by extending the body component by {value}cm " + \
              f"(from {current_length}cm to {new_length}cm).\n\n" + \
              parts_summary
    
    return {
        "message": message,
        "actions": [{"action": "update_part", "id": body_part['id'], "props": {"length": new_length}}]
    }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)