import os
import json
from typing import Dict, Any, List, Optional
import re
from datetime import datetime

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from agents import Agent, Runner, function_tool

# Import our modules
from utils.models import ChatRequest, AgentRequest, EnvironmentData, SimulationHistory, AnalysisHistory
from utils.format import format_response
from utils.fallbacks import extract_intent_from_text, design_rocket_for_altitude
# Import comprehensive context builder
from utils.context_builder import build_comprehensive_context

# Import all the specialized agents
from rocket_agents import (
    design_agent,
    sim_agent,
    metrics_agent,
    qa_agent,
    router_agent,
    weather_agent,
    #get_rocket_details,
    PREDICTION_AGENT_INSTRUCTIONS
)

# Import all the tools
from tools.design_tools import (
    update_nose_cone, update_body_tube, update_fins, update_motor, update_parachute, 
    update_rocket_properties, altitude_design_tool
)
from tools.sim_tools import run_simulation

# Get API key from environment
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable not set")

# Initialize the FastAPI app
app = FastAPI(title="Rocket-Cursor AI Agent", description="A rocket design and simulation assistant")

# Helper function to clean messages for Agents SDK
def clean_messages(messages):
    """Ensure messages only contain role and content fields to avoid API errors."""
    cleaned = []
    for msg in messages:
        # Only keep role and content fields
        cleaned.append({
            "role": msg.get("role", "user"),
            "content": msg.get("content", "")
        })
    return cleaned

def build_agent_context(agent_name: str, req: ChatRequest, user_message: str = "") -> str:
    """
    Build comprehensive context appropriate for each agent type.
    
    Args:
        agent_name: Name of the agent that will receive the context
        req: ChatRequest containing all available context data
        user_message: Current user message for context
    
    Returns:
        Formatted context string optimized for the specific agent
    """
    
    # Define which agents need which types of context
    AGENT_CONTEXT_NEEDS = {
        "master": {
            "environment": True,
            "simulation_history": True, 
            "analysis_history": True,
            "user_preferences": True,
            "session_info": True
        },
        "design": {
            "environment": True,  # For flight conditions during design
            "simulation_history": True,  # For performance trends
            "analysis_history": True,  # For stability patterns
            "user_preferences": True,  # For experience-appropriate designs
            "session_info": False
        },
        "sim": {
            "environment": True,  # Critical for simulation accuracy
            "simulation_history": True,  # For comparison with previous runs
            "analysis_history": False,
            "user_preferences": True,  # For simulation fidelity preferences
            "session_info": False
        },
        "metrics": {
            "environment": False,  # Less critical for analysis
            "simulation_history": True,  # Essential for trend analysis
            "analysis_history": True,  # Core requirement
            "user_preferences": True,  # For appropriate complexity level
            "session_info": False
        },
        "qa": {
            "environment": False,
            "simulation_history": True,  # For answering performance questions
            "analysis_history": True,  # For technical questions
            "user_preferences": True,  # For appropriate detail level
            "session_info": True  # For context-aware responses
        },
        "weather": {
            "environment": True,  # Critical for weather analysis
            "simulation_history": False,  # Not needed for weather assessment
            "analysis_history": False,  # Not needed for weather data
            "user_preferences": True,  # For safety level preferences
            "session_info": True  # For location and timing context
        },
        "router": {
            # Router needs minimal context, just for classification
            "environment": False,
            "simulation_history": False,
            "analysis_history": False,
            "user_preferences": True,  # For understanding user's skill level
            "session_info": True  # For routing based on session patterns
        },
        "prediction": {
            "environment": True,  # For realistic "what-if" scenarios
            "simulation_history": True,  # For baseline comparisons
            "analysis_history": True,  # For understanding current state
            "user_preferences": True,  # For appropriate complexity
            "session_info": False
        }
    }
    
    # Get context requirements for this agent
    context_needs = AGENT_CONTEXT_NEEDS.get(agent_name, AGENT_CONTEXT_NEEDS["master"])
    
    # Build context based on needs - properly typed
    environment_data: Optional[EnvironmentData] = req.environment if context_needs["environment"] else None
    simulation_history: Optional[List[SimulationHistory]] = req.simulationHistory if context_needs["simulation_history"] else None
    analysis_history: Optional[List[AnalysisHistory]] = req.analysisHistory if context_needs["analysis_history"] else None
    user_preferences: Optional[Dict[str, Any]] = req.userPreferences if context_needs["user_preferences"] else None
    session_info: Optional[Dict[str, Any]] = req.sessionInfo if context_needs["session_info"] else None
    
    # Generate the comprehensive context
    comprehensive_context = build_comprehensive_context(
        rocket_data=req.rocket,
        environment=environment_data,
        simulation_history=simulation_history,
        analysis_history=analysis_history,
        user_preferences=user_preferences,
        session_info=session_info,
        user_message=user_message
    )
    
    # Add agent-specific instructions based on available context
    agent_specific_additions = []
    
    if agent_name == "design":
        if environment_data and environment_data.windSpeed is not None:
            if environment_data.windSpeed > 10:
                agent_specific_additions.append("⚠️ HIGH WINDS: Consider designing for stability in windy conditions")
            elif environment_data.windSpeed > 5:
                agent_specific_additions.append("💨 MODERATE WINDS: Design should account for wind effects")
        
        if simulation_history and len(simulation_history) > 0:
            latest_sim = simulation_history[-1]
            if latest_sim.stabilityMargin is not None and latest_sim.stabilityMargin < 1.0:
                agent_specific_additions.append("🚨 STABILITY ISSUE: Previous simulation showed unstable flight")
            if latest_sim.maxAltitude is not None and latest_sim.maxAltitude < 100:
                agent_specific_additions.append("📉 LOW PERFORMANCE: Previous simulation showed low altitude")
    
    elif agent_name == "sim":
        if environment_data:
            agent_specific_additions.append("🌤️ SIMULATION NOTE: Use current environmental conditions for accurate results")
    
    elif agent_name == "metrics":
        if simulation_history and len(simulation_history) > 1:
            agent_specific_additions.append(f"📊 TREND ANALYSIS: {len(simulation_history)} simulations available for comparison")
    
    # Add agent-specific notes if any
    if agent_specific_additions:
        comprehensive_context += "\n=== AGENT-SPECIFIC NOTES ===\n"
        comprehensive_context += "\n".join(agent_specific_additions)
        comprehensive_context += "\n"
    
    return comprehensive_context

def create_enhanced_system_message(agent_name: str, req: ChatRequest, user_message: str = "") -> dict:
    """Create an enhanced system message with comprehensive context for the specified agent."""
    
    # Build comprehensive context for this agent
    context_content = build_agent_context(agent_name, req, user_message)
    
    # Create the enhanced system message
    system_message = {
        "role": "system",
        "content": context_content
    }
    
    return system_message

# Helper function to extract actions from result
async def extract_actions_from_result(result, message_text, rocket_data):
    """Extract actions from agent result"""
    actions = []
    
    # Check for new_items which contain tool call outputs
    if hasattr(result, 'new_items'):
        for item in result.new_items:
            # Look for ToolCallOutputItem which contains the action
            if hasattr(item, 'type') and item.type == 'tool_call_output_item':
                # The output might be a string that needs to be parsed as JSON
                if hasattr(item, 'output'):
                    output = item.output
                    
                    # If output is a string, try to parse it as JSON
                    if isinstance(output, str):
                        try:
                            parsed_output = json.loads(output)
                            if isinstance(parsed_output, dict) and 'action' in parsed_output:
                                actions.append(parsed_output)
                            elif isinstance(parsed_output, list):
                                # Handle case where output is a list of actions
                                for action in parsed_output:
                                    if isinstance(action, dict) and 'action' in action:
                                        actions.append(action)
                        except json.JSONDecodeError:
                            # If it's not valid JSON, skip this item
                            continue
                    
                    # If output is already a dict with action
                    elif isinstance(output, dict) and 'action' in output:
                        actions.append(output)
    
    return actions

# Helper function to get token usage safely
def get_token_usage(result):
    """Safely extract token usage from result if available."""
    try:
        if hasattr(result, 'token_usage'):
            if hasattr(result.token_usage, 'model_dump'):
                return result.token_usage.model_dump()
            return result.token_usage
        elif hasattr(result, 'usage'):
            if hasattr(result.usage, 'model_dump'):
                return result.usage.model_dump()
            return result.usage
    except Exception as e:
        print(f"Error extracting token usage: {str(e)}")
    return None

MASTER_AGENT_INSTRUCTIONS = """
You are an expert master agent for rocket design coordination. You help users design, optimize, and understand model rockets.

**IMPORTANT: Mathematical Expression Formatting**
When including mathematical formulas, equations, or LaTeX expressions in your responses:
- ALWAYS wrap inline math in single dollar signs: $equation$
- ALWAYS wrap block math in double dollar signs: $$equation$$

**CRITICAL: Variable Definitions in "Where:" Sections**
When explaining what variables mean (like in "where:" sections), ALWAYS use $ $ format:
- CORRECT: "$F_d$ = drag force (N)"
- CORRECT: "$\rho$ = air density (kg/m³)" 
- WRONG: "\( F_d \) = drag force (N)" ← NEVER use this format

- Examples:
  - Inline: The drag force is $F_d = \frac{1}{2} \rho v^2 C_d A$
  - Block: $$\text{Stability Margin} = \frac{\text{Distance from CoG to CoP}}{D}$$ 
  - Variable definitions: $F_d$ = drag force (N), $\rho$ = air density (kg/m³)
- Never include raw LaTeX commands without proper delimiters
- Use proper LaTeX syntax: \frac{numerator}{denominator}, \mathbf{bold}, \text{text}

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
    - If the request is a very simple, direct modification (e.g., "change motor to X", "update nose cone length", "modify fin dimensions") AND you are highly confident, you MAY use the component-based tools directly. Use `update_nose_cone`, `update_body_tube`, `update_fins`, `update_motor`, `update_parachute` as appropriate for specific components.

3.  Complex Request or Follow-up?
    - If the request is complex, involves multiple steps, or is a follow-up to your previous suggestions, reason through the steps. If design changes are needed, delegate those specific changes to `design_agent_tool` (specifying the part and desired change, referencing the `CURRENT_ROCKET_JSON`) or use direct tools if extremely simple and you have all necessary info like IDs from the `CURRENT_ROCKET_JSON`.

Available Tools (for you or to instruct design_agent_tool):
- `update_nose_cone(props: ComponentProps)` - Update nose cone with shape, length_m, base_radius_m, etc.
- `update_body_tube(props: ComponentProps, index: int)` - Update body tube at specific index
- `update_fins(props: ComponentProps, index: int)` - Update fin set at specific index
- `update_motor(props: ComponentProps)` - Update motor with motor_database_id, position, etc.
- `update_parachute(props: ComponentProps, index: int)` - Update parachute at specific index
- `update_rocket_properties(props: RocketProps)` - Update rocket-level properties
- `run_simulation(fidelity: Literal["quick", "hifi"])` - Run simulation
- `altitude_design_tool(target_altitude: float, rocket_data: Dict)` - Design for specific altitude

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
# Initialize the master agent with instructions on how to use all specialized agents
master_agent = Agent(
    name="Rocket‑Cursor AI",
    instructions=MASTER_AGENT_INSTRUCTIONS,
    tools=[update_nose_cone, update_body_tube, update_fins, update_motor, update_parachute, update_rocket_properties, run_simulation, altitude_design_tool],
    model="gpt-4o-mini",
)

# Initialize the prediction agent with the other agents as tools
# Define the tool functions first with the correct decorator pattern
@function_tool(strict_mode=False)
def design_agent_as_tool(message: str, rocket_data: Dict[str, Any]) -> str:
    """Tool to call the design agent with a specific message and rocket data."""
    return design_agent.complete(
        [{"role": "system", "content": f"CURRENT_ROCKET_JSON\n{json.dumps(rocket_data)}"}, 
         {"role": "user", "content": message}]
    ).completion

@function_tool(strict_mode=False)
def sim_agent_as_tool(message: str, rocket_data: Dict[str, Any]) -> str:
    """Tool to call the simulation agent with a specific message and rocket data."""
    return sim_agent.complete(
        [{"role": "system", "content": f"CURRENT_ROCKET_JSON\n{json.dumps(rocket_data)}"}, 
         {"role": "user", "content": message}]
    ).completion

prediction_agent = Agent(
    name="PredictionAgent",
    instructions=PREDICTION_AGENT_INSTRUCTIONS,
    tools=[design_agent_as_tool, sim_agent_as_tool],
    model="gpt-4o-mini"
)

# Create a map of agent names to agent instances
AGENTS = {
    "master": master_agent,
    "design": design_agent,
    "sim": sim_agent,
    "metrics": metrics_agent,
    "qa": qa_agent,
    "router": router_agent,
    "weather": weather_agent,
    "prediction": prediction_agent,
}

@app.post("/reason")
async def reason(req: ChatRequest):
    """
    Primary endpoint to process user requests and return agent responses with actions.
    """
    try:
        print(f"DEBUG: Received request - Messages: {len(req.messages)}, Rocket ID: {req.rocket.get('id', 'unknown')}")
        
        # Clean messages to ensure proper format for Agents SDK
        cleaned_messages = clean_messages(req.messages)
        latest_message = cleaned_messages[-1]["content"] if cleaned_messages else ""
        
        print(f"DEBUG: Latest message: {latest_message[:100]}...")
        
        # Check if we have required data
        if not req.rocket or not isinstance(req.rocket, dict):
            print("ERROR: Invalid rocket data")
            raise HTTPException(status_code=422, detail="Invalid rocket data provided")
            
        if not cleaned_messages:
            print("ERROR: No valid messages")
            raise HTTPException(status_code=422, detail="No valid messages provided")
        
        # Prepare the context with the current rocket state

        ################ Not Used
        #system_message = create_enhanced_system_message("master", req, latest_message)
        #messages = [system_message] + cleaned_messages
        ################ Not Used
        
        rocket_json_str = json.dumps(req.rocket)
        
        print(f"DEBUG: System message created, rocket JSON length: {len(rocket_json_str)}")
        
        # Track the agent flow for transparency
        agent_flow = []
        agent_flow.append({"agent": "router", "role": "dispatcher", "timestamp": str(datetime.now())})
        
        # First, use the router agent to determine which specialized agent to use
        router_runner = Runner()
        # Use enhanced context for router
        router_system_message = create_enhanced_system_message("router", req, latest_message)
        router_messages = [router_system_message] + cleaned_messages
        
        print("DEBUG: About to run router agent...")
        
        router_result = await router_runner.run(
            router_agent,
            input=router_messages,
            context={"current_rocket_json_str": rocket_json_str},
            max_turns=30  # Much higher for complex routing decisions
        )
        
        print(f"DEBUG: Router result type: {type(router_result)}")
        
        # Get the routed agent name
        routed_agent_name = router_result.completion.strip().lower() if hasattr(router_result, 'completion') else router_result.final_output.strip().lower() if hasattr(router_result, 'final_output') else ""
        
        print(f"DEBUG: Routed to agent: {routed_agent_name}")
        
        # Track which agents will execute
        primary_agent_name = "master"  # Default
        secondary_agents = []
        primary_result = None
        secondary_results = {}
        all_actions = []
        
        # Pre-check if this is an analysis/performance query without actions
        likely_qa_patterns = [
            r"(?:how will|tell me about|what is|performance of|stability of|how does|describe|explain|analyze)" +
            r".*(?:rocket|perform|flight|stability|aerodynamics|design)"
        ]
        is_likely_qa = any(re.search(pattern, latest_message, re.IGNORECASE) for pattern in likely_qa_patterns)
        
        # If router didn't identify a QA query but it looks like one, override
        if is_likely_qa and routed_agent_name not in ["qa", "metrics"]:
            routed_agent_name = "qa"
        
        # Check if the router identified a valid agent
        if routed_agent_name in AGENTS and routed_agent_name != "router":
            # Use the specialized agent
            specialized_agent = AGENTS[routed_agent_name]
            primary_agent_name = routed_agent_name
            agent_flow.append({"agent": primary_agent_name, "role": "primary", "timestamp": str(datetime.now())})
            
            print(f"DEBUG: Using specialized agent: {primary_agent_name}")
            
            # Create enhanced context for the specialized agent
            specialized_system_message = create_enhanced_system_message(primary_agent_name, req, latest_message)
            
            # For QA agent, append rocket data to the message content
            if primary_agent_name == "qa":
                # Add rocket JSON to the latest message for QA agent
                enhanced_message = f"{latest_message}\n\nCURRENT_ROCKET_JSON:\n```json\n{rocket_json_str}\n```"
                specialized_messages = [specialized_system_message] + cleaned_messages[:-1] + [{"role": "user", "content": enhanced_message}]
            else:
                specialized_messages = [specialized_system_message] + cleaned_messages
            
            runner = Runner()
            primary_result = await runner.run(
                specialized_agent,
                input=specialized_messages,
                context={"current_rocket_json_str": rocket_json_str},
                max_turns=30  # Much higher for complex design operations
            )
            
            print(f"DEBUG: Primary agent completed")
            
            # Extract actions from the primary agent
            primary_actions = await extract_actions_from_result(primary_result, cleaned_messages[-1]["content"], req.rocket)
            all_actions.extend(primary_actions)
            
            # For certain design tasks, add appropriate secondary agents
            design_needs_sim = False
            design_needs_metrics = False
            
            # For QA/metrics agent, we normally don't need secondary agents
            if primary_agent_name in ["qa", "metrics"]:
                pass  # No secondary agents needed
            
            # Analyze if this is a substantial design change that needs sim/metrics follow-up
            elif primary_agent_name == "design" and primary_actions:
                for action in primary_actions:
                    # Check which properties are being changed
                    if action.get('action') == 'update_rocket' and 'motorId' in action.get('props', {}):
                        # Motor changes definitely need simulation and metrics
                        design_needs_sim = True
                        design_needs_metrics = True
                    
                    # Substantial component changes
                    elif action.get('action') in ['update_nose_cone', 'update_body_tube', 'update_fins', 'update_motor', 'update_parachute']:
                        # Any component modification needs simulation and metrics follow-up
                        design_needs_sim = True
                        design_needs_metrics = True
                    
                    # Rocket-level changes
                    elif action.get('action') == 'update_rocket_properties':
                        design_needs_sim = True
                        design_needs_metrics = True
                
                # Also check message content for certain topics
                if any(word in latest_message.lower() for word in 
                       ["height", "altitude", "reach", "fly", "simulation", "test", "far", "km", "meter", 
                        "stability", "stable", "perform", "aerodynamic", "drag", "speed", "velocity"]):
                    design_needs_sim = True
                    design_needs_metrics = True
            
            # Add secondary agents based on the analysis
            if design_needs_sim:
                # Add sim agent as secondary
                secondary_agents.append("sim")
                agent_flow.append({"agent": "sim", "role": "secondary", "timestamp": str(datetime.now())})
                
                # Create enhanced context for sim agent
                sim_system_message = create_enhanced_system_message("sim", req, f"Design changes applied: {json.dumps(primary_actions)}")
                sim_messages = [sim_system_message] + cleaned_messages + [{"role": "assistant", "content": f"Design changes have been applied: {json.dumps(primary_actions)}"}]
                
                # Run sim agent after design changes are applied
                sim_runner = Runner()
                sim_result = await sim_runner.run(
                    sim_agent,
                    input=sim_messages,
                    context={"current_rocket_json_str": rocket_json_str, "design_actions": json.dumps(primary_actions)},
                    max_turns=20  # Increased for complex simulations
                )
                secondary_results["sim"] = sim_result
                
                # Extract additional actions from sim agent
                sim_actions = await extract_actions_from_result(sim_result, "run simulation", req.rocket)
                all_actions.extend(sim_actions)
            
            if design_needs_metrics:
                # Add metrics agent as secondary
                agent_flow.append({"agent": "metrics", "role": "secondary", "timestamp": str(datetime.now())})
                secondary_agents.append("metrics")
                
                # Create enhanced context for metrics agent  
                metrics_system_message = create_enhanced_system_message("metrics", req, f"Design changes applied: {json.dumps(primary_actions)}")
                metrics_messages = [metrics_system_message] + cleaned_messages + [{"role": "assistant", "content": f"Design changes have been applied: {json.dumps(primary_actions)}"}]
                
                metrics_runner = Runner()
                metrics_result = await metrics_runner.run(
                    metrics_agent,
                    input=metrics_messages,
                    context={"current_rocket_json_str": rocket_json_str, "design_actions": json.dumps(primary_actions)},
                    max_turns=30  # Increased for complex analysis
                )
                secondary_results["metrics"] = metrics_result
        else:
            # Fall back to master agent if router couldn't identify a specialized agent
            agent_flow.append({"agent": "master", "role": "primary", "timestamp": str(datetime.now())})
            
            print("DEBUG: Using master agent as fallback")
            
            # Create enhanced context for master agent
            master_system_message = create_enhanced_system_message("master", req, latest_message)
            master_messages = [master_system_message] + cleaned_messages
            
            runner = Runner()
            primary_result = await runner.run(
                master_agent,
                input=master_messages,
                context={"current_rocket_json_str": rocket_json_str},
                max_turns=30  # Much higher for complex master agent operations
            )
            
            # Extract actions using the helper function
            primary_actions = await extract_actions_from_result(primary_result, cleaned_messages[-1]["content"], req.rocket)
            all_actions.extend(primary_actions)
        
        # Ensure we have a primary result
        result = primary_result
        
        print(f"DEBUG: Processing final result, actions count: {len(all_actions)}")
        
        # Create an enhanced user-facing response that combines the outputs
        enhanced_response = ""
        
        # Get output texts from all agents involved
        primary_output = result.completion if hasattr(result, 'completion') else result.final_output if hasattr(result, 'final_output') else str(result)
        
        # First enhance raw text with markdown formatting
        # Apply bold to key terms
        primary_output = re.sub(r'(?<!\*)\b(rocket|altitude|stability|motor|engine|simulation|analysis|design|nose|body|fin|diameter|length|span|root|sweep|color|shape)\b(?!\*)', r'**\1**', primary_output, flags=re.IGNORECASE)
        
        # Add styled action summaries
        if all_actions:
            action_summary = "\n\n### Actions Performed\n\n"
            for action in all_actions:
                if action.get('action') == 'update_nose_cone':
                    props = action.get('props', {})
                    prop_list = ", ".join([f"**{k}**: {v}" for k, v in props.items()])
                    action_summary += f"- Updated **nose cone** with {prop_list}\n"
                elif action.get('action') == 'update_body_tube':
                    index = action.get('index', 0)
                    props = action.get('props', {})
                    prop_list = ", ".join([f"**{k}**: {v}" for k, v in props.items()])
                    action_summary += f"- Updated **body tube {index}** with {prop_list}\n"
                elif action.get('action') == 'update_fins':
                    index = action.get('index', 0)
                    props = action.get('props', {})
                    prop_list = ", ".join([f"**{k}**: {v}" for k, v in props.items()])
                    action_summary += f"- Updated **fin set {index}** with {prop_list}\n"
                elif action.get('action') == 'update_motor':
                    props = action.get('props', {})
                    prop_list = ", ".join([f"**{k}**: {v}" for k, v in props.items()])
                    action_summary += f"- Updated **motor** with {prop_list}\n"
                elif action.get('action') == 'update_parachute':
                    index = action.get('index', 0)
                    props = action.get('props', {})
                    prop_list = ", ".join([f"**{k}**: {v}" for k, v in props.items()])
                    action_summary += f"- Updated **parachute {index}** with {prop_list}\n"
                elif action.get('action') == 'update_rocket_properties':
                    props = action.get('props', {})
                    prop_list = ", ".join([f"**{k}**: {v}" for k, v in props.items()]) 
                    action_summary += f"- Updated **rocket properties** with {prop_list}\n"
                elif action.get('action') == 'run_sim':
                    fidelity = action.get('fidelity', 'quick')
                    action_summary += f"- Ran **{fidelity} simulation**\n"
        
        # Structure output based on agents involved
        if secondary_agents:
            # Create combined response with clear sections
            enhanced_response = f"## {primary_agent_name.capitalize()} Analysis\n\n{primary_output}\n\n"
            
            # Add actions summary if not already in primary output
            if all_actions and "actions performed" not in primary_output.lower():
                enhanced_response += action_summary
            
            # Add simulation results if available
            if "sim" in secondary_results:
                sim_output = secondary_results["sim"].completion if hasattr(secondary_results["sim"], 'completion') else secondary_results["sim"].final_output if hasattr(secondary_results["sim"], 'final_output') else ""
                sim_output = re.sub(r'(?<!\*)\b(altitude|apogee|velocity|acceleration|max|meters|height|reached|simulation)\b(?!\*)', r'**\1**', sim_output, flags=re.IGNORECASE)
                enhanced_response += f"\n\n## Simulation Results\n\n{sim_output}\n\n"
            
            # Add metrics analysis if available
            if "metrics" in secondary_results:
                metrics_output = secondary_results["metrics"].completion if hasattr(secondary_results["metrics"], 'completion') else secondary_results["metrics"].final_output if hasattr(secondary_results["metrics"], 'final_output') else ""
                metrics_output = re.sub(r'(?<!\*)\b(stability|center of gravity|CoG|center of pressure|CoP|margin|drag|coefficient|stable|unstable|body|nose|fin)\b(?!\*)', r'**\1**', metrics_output, flags=re.IGNORECASE)
                enhanced_response += f"\n\n## Rocket Analysis\n\n{metrics_output}"
            
            # Add agent diagram
            agent_diagram = "\n\n### Agent Workflow\n\n"
            agent_diagram += f"1. **Router Agent** → Identified this as a {primary_agent_name} task\n"
            agent_diagram += f"2. **{primary_agent_name.capitalize()} Agent** → "
            
            if primary_agent_name == "design":
                agent_diagram += "Made design changes\n"
            elif primary_agent_name == "sim":
                agent_diagram += "Ran simulation\n"
            elif primary_agent_name == "metrics":
                agent_diagram += "Analyzed rocket properties\n"
            elif primary_agent_name == "qa":
                agent_diagram += "Answered query\n"
            else:
                agent_diagram += "Handled primary task\n"
                
            for i, agent in enumerate(secondary_agents, 3):
                agent_diagram += f"{i}. **{agent.capitalize()} Agent** → "
                if agent == "sim":
                    agent_diagram += "Simulated flight performance\n"
                elif agent == "metrics":
                    agent_diagram += "Analyzed stability and aerodynamics\n"
                else:
                    agent_diagram += "Provided additional analysis\n"
            
            enhanced_response += agent_diagram
        else:
            # For standard queries, enhance primary agent's response with formatting
            enhanced_response = primary_output
            
            # Add actions summary if appropriate and not already included
            if all_actions and "actions performed" not in enhanced_response.lower():
                enhanced_response += action_summary
        
        # Apply the format_response for proper HTML formatting
        formatted_response = format_response(enhanced_response)
        
        # Get token usage safely
        token_usage = get_token_usage(result)
        
        # Get trace URL if available
        trace_url = getattr(result, 'trace_url', None)
        
        return {
            "final_output": formatted_response,
            "actions": json.dumps(all_actions) if all_actions else None,
            "token_usage": token_usage,
            "trace_url": trace_url,
            "agent_flow": agent_flow,
            "primary_agent": primary_agent_name,
            "secondary_agents": secondary_agents
        }
    except Exception as e:
        print(f"Error in /reason endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

@app.post("/reason-with-agent")
async def reason_with_agent(req: AgentRequest):
    """
    Endpoint to use a specific agent for processing user requests.
    """
    try:
        agent_name = req.agent.lower() if req.agent else "master"
        if agent_name not in AGENTS:
            raise HTTPException(status_code=400, detail=f"Unknown agent: {agent_name}. Available agents: {list(AGENTS.keys())}")
        
        # Get the selected agent
        agent = AGENTS[agent_name]
        
        # Clean messages to ensure proper format for Agents SDK
        cleaned_messages = clean_messages(req.messages)
        
        # Prepare the context with the current rocket state
        system_message = create_enhanced_system_message(agent_name, req)
        messages = [system_message] + cleaned_messages
        rocket_json_str = json.dumps(req.rocket)
        
        # Run the selected agent
        runner = Runner()
        result = await runner.run(
            agent,
            input=messages,
            context={"current_rocket_json_str": rocket_json_str}
        )
        
        # Handle the response based on the agent type
        actions = await extract_actions_from_result(result, cleaned_messages[-1]["content"], req.rocket)
        
        # If router agent, handle routing
        if agent_name == "router":
            # Router agent returns the name of another agent to use
            routed_agent_name = result.completion.strip().lower() if hasattr(result, 'completion') else result.final_output.strip().lower() if hasattr(result, 'final_output') else ""
            
            if routed_agent_name in AGENTS and routed_agent_name != "router":
                # Re-run the request with the routed agent using enhanced context
                routed_agent = AGENTS[routed_agent_name]
                routed_system_message = create_enhanced_system_message(routed_agent_name, req)
                routed_messages = [routed_system_message] + cleaned_messages
                
                runner = Runner()
                routed_result = await runner.run(
                    routed_agent,
                    input=routed_messages,
                    context={"current_rocket_json_str": rocket_json_str}
                )
                
                # Update the response with the routed agent's result
                result = routed_result
                # Extract actions from routed agent result
                actions = await extract_actions_from_result(result, cleaned_messages[-1]["content"], req.rocket)
        
        # Get the completion text
        final_output = result.completion if hasattr(result, 'completion') else result.final_output if hasattr(result, 'final_output') else str(result)
        
        # Enhance the response with better formatting
        if actions:
            # Add styled action summary
            action_summary = "\n\n### Actions Performed\n\n"
            for action in actions:
                if action.get('action') == 'update_nose_cone':
                    props = action.get('props', {})
                    prop_list = ", ".join([f"**{k}**: {v}" for k, v in props.items()])
                    action_summary += f"- Updated **nose cone** with {prop_list}\n"
                elif action.get('action') == 'update_body_tube':
                    index = action.get('index', 0)
                    props = action.get('props', {})
                    prop_list = ", ".join([f"**{k}**: {v}" for k, v in props.items()])
                    action_summary += f"- Updated **body tube {index}** with {prop_list}\n"
                elif action.get('action') == 'update_fins':
                    index = action.get('index', 0)
                    props = action.get('props', {})
                    prop_list = ", ".join([f"**{k}**: {v}" for k, v in props.items()])
                    action_summary += f"- Updated **fin set {index}** with {prop_list}\n"
                elif action.get('action') == 'update_motor':
                    props = action.get('props', {})
                    prop_list = ", ".join([f"**{k}**: {v}" for k, v in props.items()])
                    action_summary += f"- Updated **motor** with {prop_list}\n"
                elif action.get('action') == 'update_parachute':
                    index = action.get('index', 0)
                    props = action.get('props', {})
                    prop_list = ", ".join([f"**{k}**: {v}" for k, v in props.items()])
                    action_summary += f"- Updated **parachute {index}** with {prop_list}\n"
                elif action.get('action') == 'update_rocket_properties':
                    props = action.get('props', {})
                    prop_list = ", ".join([f"**{k}**: {v}" for k, v in props.items()]) 
                    action_summary += f"- Updated **rocket properties** with {prop_list}\n"
                elif action.get('action') == 'run_sim':
                    fidelity = action.get('fidelity', 'quick')
                    action_summary += f"- Ran **{fidelity} simulation**\n"
            
            # Add the action summary if not already in the response
            if "actions performed" not in final_output.lower():
                final_output += action_summary
        
        # Add agent information
        agent_info = f"\n\n> *Processed by the **{agent_name.capitalize()} Agent***"
        if agent_name == "router" and routed_agent_name in AGENTS and routed_agent_name != "router":
            agent_info += f"\n> *Routed to the **{routed_agent_name.capitalize()} Agent***"
        
        final_output += agent_info
        
        # Apply bold formatting to key terms
        final_output = re.sub(r'(?<!\*)\b(rocket|altitude|stability|motor|engine|simulation|analysis|design|nose|body|fin|diameter|length|span|root|sweep|color|shape)\b(?!\*)', r'**\1**', final_output, flags=re.IGNORECASE)
        
        # Format the response text for better readability
        formatted_output = format_response(final_output)
        
        # Get token usage safely
        token_usage = get_token_usage(result)
        
        # Get trace URL if available
        trace_url = getattr(result, 'trace_url', None)
        
        return {
            "final_output": formatted_output,
            "actions": json.dumps(actions) if actions else None,
            "agent_used": agent_name,
            "token_usage": token_usage,
            "trace_url": trace_url
        }
    except Exception as e:
        print(f"Error in /reason-with-agent endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

@app.post("/route-query")
async def route_query(req: ChatRequest):
    """
    Endpoint to determine which specialized agent should handle a request.
    """
    try:
        # Clean messages to ensure proper format for Agents SDK
        cleaned_messages = clean_messages(req.messages)
        
        # Prepare the context with the current rocket state
        system_message = create_enhanced_system_message("router", req)
        messages = [system_message] + cleaned_messages
        rocket_json_str = json.dumps(req.rocket)
        
        # Run the router agent
        runner = Runner()
        result = await runner.run(
            router_agent,
            input=messages,
            context={"current_rocket_json_str": rocket_json_str}
        )
        
        # Get the agent name from result
        agent_name = result.completion.strip().lower() if hasattr(result, 'completion') else result.final_output.strip().lower() if hasattr(result, 'final_output') else ""
        
        # Get token usage safely
        token_usage = get_token_usage(result)
        
        return {
            "agent": agent_name,
            "token_usage": token_usage
        }
    except Exception as e:
        print(f"Error in /route-query endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    response_data = {
        "status": "ok", 
        "version": "1.0.0",
        "agents": list(AGENTS.keys())
    }
    return response_data

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)