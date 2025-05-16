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
from utils.models import ChatRequest, AgentRequest
from utils.format import format_response
from utils.fallbacks import extract_intent_from_text, design_rocket_for_altitude

# Import all the specialized agents
from rocket_agents import (
    design_agent,
    sim_agent,
    metrics_agent,
    qa_agent,
    router_agent,
    #get_rocket_details,
    PREDICTION_AGENT_INSTRUCTIONS
)

# Import all the tools
from tools.design_tools import add_part, update_part, update_rocket, altitude_design_tool
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

# Helper function to extract actions from result
async def extract_actions_from_result(result, message_text, rocket_data):
    """Safely extract actions from SDK result or fall back to text extraction."""
    actions = []
    
    # First try to get actions directly from result
    try:
        # Check different possible attribute names
        if hasattr(result, 'actions') and result.actions:
            actions = result.actions
        elif hasattr(result, 'tool_calls') and result.tool_calls:
            # Convert tool calls to actions
            for tool_call in result.tool_calls:
                if hasattr(tool_call, 'output') and tool_call.output:
                    try:
                        action = json.loads(tool_call.output)
                        if isinstance(action, dict) and 'action' in action:
                            actions.append(action)
                    except:
                        pass
    except Exception as e:
        print(f"Error extracting actions from result: {str(e)}")
    
    # If no actions found, check result text for educational content about altitude
    if not actions:
        result_text = result.completion if hasattr(result, 'completion') else result.final_output if hasattr(result, 'final_output') else ""
        
        # If result contains educational content about altitude but no actions, treat it as an altitude design request
        altitude_educational_patterns = [
            r'reach.*altitude.*\d+\s*(?:k?m)',
            r'design.*rocket.*reach.*\d+\s*(?:k?m)',
            r'.*(?:motor|engine).*(?:altitude|height)',
            r'.*factor.*(?:altitude|height)',
            r'.*(?:altitude|height).*(?:design|reach)',
        ]
        
        if any(re.search(pattern, result_text, re.IGNORECASE) for pattern in altitude_educational_patterns):
            print("Detected educational content about altitude design, extracting target altitude...")
            
            # Extract altitude value from result text or message
            altitude_patterns = [
                r'(?:altitude|height).*?(\d+)(?:\.\d+)?\s*km',
                r'(\d+)(?:\.\d+)?\s*km.*?(?:altitude|height)',
                r'reach.*?(\d+)(?:\.\d+)?\s*km',
                r'(\d+)(?:\.\d+)?\s*kilometer'
            ]
            
            target_altitude = None
            
            # First check the result text
            for pattern in altitude_patterns:
                match = re.search(pattern, result_text, re.IGNORECASE)
                if match:
                    target_altitude = float(match.group(1)) * 1000  # Convert to meters
                    print(f"Extracted target altitude from result text: {target_altitude}m")
                    break
            
            # If not found in result, check the original message
            if not target_altitude:
                for pattern in altitude_patterns:
                    match = re.search(pattern, message_text, re.IGNORECASE)
                    if match:
                        target_altitude = float(match.group(1)) * 1000  # Convert to meters
                        print(f"Extracted target altitude from user message: {target_altitude}m")
                        break
            
            # Common altitude fallbacks if specific value not found
            if not target_altitude and "50 km" in (result_text.lower() + message_text.lower()):
                target_altitude = 50000  # 50 km in meters
            elif not target_altitude and "30 km" in (result_text.lower() + message_text.lower()):
                target_altitude = 30000  # 30 km in meters
            
            # Call design_rocket_for_altitude if we found a target
            if target_altitude:
                design_actions = await design_rocket_for_altitude(rocket_data, target_altitude)
                if design_actions:
                    actions.extend(design_actions)
                    # Add simulation action after design changes
                    actions.append({"action": "run_sim", "fidelity": "hifi"})
                    return actions  # Return early with the actions
    
    # If still no actions found and message contains altitude target, try design_rocket_for_altitude
    if not actions:
        # First check for any form of altitude query
        altitude_keywords = ["altitude", "height", "high", "reach", "meters", "m ", "km", "kilometer", "fly up", "go up", "how high", "how far up"]
        if any(keyword in message_text.lower() for keyword in altitude_keywords):
            try:
                # Extract altitude target from text
                altitude_patterns = [
                    # Traditional patterns
                    r'reach\s+(\d+(?:\.\d+)?)\s*m(?:eters?)?(?:\s+altitude)?', 
                    r'altitude\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*m',
                    r'(\d+(?:\.\d+)?)\s*m(?:eters?)?\s+(?:high|altitude)', 
                    r'design.*?(\d+)m', 
                    r'[^0-9](\d+)\s*meters?',
                    r'reach\s+(\d+(?:\.\d+)?)\s*k(?:m|ilometers?)(?:\s+altitude)?', 
                    r'altitude\s+(?:of\s+)?(\d+(?:\.\d+)?)\s*k(?:m|ilometers?)',
                    r'(\d+(?:\.\d+)?)\s*k(?:m|ilometers?)?\s+(?:high|altitude)', 
                    r'design.*?(\d+)k(?:m|ilometers?)', 
                    r'[^0-9](\d+)\s*k(?:ilo)?m(?:eters?)?',
                    
                    # More flexible patterns
                    r'(?:fly|flying|flight|go|reach|make\s+it|rocket|height)\s+(?:up|to|of)?\s*(?:to|at|about|around)?\s*(\d+)(?:\.\d+)?\s*(?:km|kilometers|klicks|k)',
                    r'(?:fly|flying|flight|go|reach|make\s+it|rocket|height)\s+(?:up|to|of)?\s*(?:to|at|about|around)?\s*(\d+)(?:\.\d+)?\s*(?:m|meters)',
                    r'(\d+)(?:\.\d+)?\s*(?:km|kilometers|klicks|k)\s+(?:high|tall|altitude|height)',
                    r'(\d+)(?:\.\d+)?\s*(?:m|meters)\s+(?:high|tall|altitude|height)',
                    r'(?:make|get|ensure|have|build|create).*?(?:fly|going|reaching|achieve).*?(\d+)\s*(?:m|km)',
                    r'(?:how\s+to|can|possible|way).*?(?:reach|get|achieve).*?(\d+)\s*(?:m|km)'
                ]
                
                found_match = False
                for i, pattern in enumerate(altitude_patterns):
                    altitude_match = re.search(pattern, message_text.lower())
                    if altitude_match:
                        target_altitude = float(altitude_match.group(1))
                        # If pattern is for km (indices 5-9 or contains 'k'), convert to meters
                        if i >= 5 or 'k' in pattern:
                            target_altitude *= 1000  # Convert km to m
                        print(f"Extracted target altitude: {target_altitude}m")
                        found_match = True
                        
                        # Call design_rocket_for_altitude directly
                        design_actions = await design_rocket_for_altitude(rocket_data, target_altitude)
                        if design_actions:
                            actions.extend(design_actions)
                            # Add simulation action after design changes
                            actions.append({"action": "run_sim", "fidelity": "hifi"})
                            return actions  # Return early if we found an altitude target
                        break
                
                # If we found keywords but couldn't parse a specific altitude, check for common altitudes
                if not found_match:
                    if any(phrase in message_text.lower() for phrase in ["50 km", "50km", "fifty km", "50 kilometers"]):
                        print("Detected 50km altitude goal without standard pattern match")
                        design_actions = await design_rocket_for_altitude(rocket_data, 50000)  # 50 km in meters
                        if design_actions:
                            actions.extend(design_actions)
                            actions.append({"action": "run_sim", "fidelity": "hifi"})
                            return actions
                    elif "altitude" in message_text.lower() and "km" in message_text.lower():
                        # Fallback for any altitude with km mention but no specific number
                        default_altitude = 30000  # 30 km default
                        print(f"Altitude keywords detected but no specific value, using default {default_altitude}m")
                        design_actions = await design_rocket_for_altitude(rocket_data, default_altitude)
                        if design_actions:
                            actions.extend(design_actions)
                            actions.append({"action": "run_sim", "fidelity": "hifi"})
                            return actions
            except Exception as e:
                print(f"Error processing altitude design: {str(e)}")
    
    # If still no actions, try the general text extraction fallback
    if not actions:
        try:
            extracted_actions = await extract_intent_from_text(message_text, rocket_data)
            if extracted_actions:
                return extracted_actions  # Return the extracted actions if any
        except Exception as e:
            print(f"Error extracting intent from text: {str(e)}")
    
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
# Initialize the master agent with instructions on how to use all specialized agents
master_agent = Agent(
    name="Rocket‑Cursor AI",
    instructions=MASTER_AGENT_INSTRUCTIONS,
    tools=[add_part, update_part, update_rocket, run_simulation, altitude_design_tool],
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
    "prediction": prediction_agent,
}

@app.post("/reason")
async def reason(req: ChatRequest):
    """
    Primary endpoint to process user requests and return agent responses with actions.
    """
    try:
        # Clean messages to ensure proper format for Agents SDK
        cleaned_messages = clean_messages(req.messages)
        latest_message = cleaned_messages[-1]["content"] if cleaned_messages else ""
        
        print("\n⭐️ PROCESSING NEW REQUEST ⭐️")
        print(f"User message: {latest_message[:100]}...")
        
        # Prepare the context with the current rocket state
        system_message = {"role": "system", "content": f"CURRENT_ROCKET_JSON\n{json.dumps(req.rocket)}"}
        messages = [system_message] + cleaned_messages
        rocket_json_str = json.dumps(req.rocket)
        
        # Track the agent flow for transparency
        agent_flow = []
        agent_flow.append({"agent": "router", "role": "dispatcher", "timestamp": str(datetime.now())})
        
        # First, use the router agent to determine which specialized agent to use
        print("\n📋 STEP 1: ROUTING REQUEST")
        router_runner = Runner()
        router_result = await router_runner.run(
            router_agent,
            input=messages,
            context={"current_rocket_json_str": rocket_json_str}
        )
        
        # Get the routed agent name
        routed_agent_name = router_result.completion.strip().lower() if hasattr(router_result, 'completion') else router_result.final_output.strip().lower() if hasattr(router_result, 'final_output') else ""
        print(f"🔀 Router directed query to: {routed_agent_name}")
        
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
            print(f"📊 Detected analysis query pattern. Overriding router decision '{routed_agent_name}' to use QA agent.")
            routed_agent_name = "qa"
        
        # Check if the router identified a valid agent
        if routed_agent_name in AGENTS and routed_agent_name != "router":
            # Use the specialized agent
            specialized_agent = AGENTS[routed_agent_name]
            primary_agent_name = routed_agent_name
            agent_flow.append({"agent": primary_agent_name, "role": "primary", "timestamp": str(datetime.now())})
            
            print(f"\n🚀 STEP 2: RUNNING PRIMARY AGENT ({primary_agent_name.upper()})")
            runner = Runner()
            primary_result = await runner.run(
                specialized_agent,
                input=messages,
                context={"current_rocket_json_str": rocket_json_str}
            )
            
            # Extract actions from the primary agent
            primary_actions = await extract_actions_from_result(primary_result, cleaned_messages[-1]["content"], req.rocket)
            all_actions.extend(primary_actions)
            print(f"📋 Primary agent returned {len(primary_actions)} actions")
            
            # For certain design tasks, add appropriate secondary agents
            design_needs_sim = False
            design_needs_metrics = False
            
            # For QA/metrics agent, we normally don't need secondary agents
            if primary_agent_name in ["qa", "metrics"]:
                print(f"ℹ️ {primary_agent_name} agent is analysis-only, no secondary agents needed")
            
            # Analyze if this is a substantial design change that needs sim/metrics follow-up
            elif primary_agent_name == "design" and primary_actions:
                for action in primary_actions:
                    # Check which properties are being changed
                    if action.get('action') == 'update_rocket' and 'motorId' in action.get('props', {}):
                        # Motor changes definitely need simulation and metrics
                        design_needs_sim = True
                        design_needs_metrics = True
                        print(f"🔍 Detected motor change, will add sim+metrics agents")
                    
                    # Substantial body/nose/fin changes
                    elif action.get('action') == 'update_part':
                        props = action.get('props', {})
                        if any(k in props for k in ['length', 'Ø', 'baseØ', 'root', 'span', 'sweep', 'shape']):
                            design_needs_sim = True
                            design_needs_metrics = True
                            print(f"🔍 Detected dimensional changes, will add sim+metrics agents")
                    
                    # Adding new parts
                    elif action.get('action') == 'add_part':
                        design_needs_sim = True
                        design_needs_metrics = True
                        print(f"🔍 Detected part addition, will add sim+metrics agents")
                
                # Also check message content for certain topics
                if any(word in latest_message.lower() for word in 
                       ["height", "altitude", "reach", "fly", "simulation", "test", "far", "km", "meter", 
                        "stability", "stable", "perform", "aerodynamic", "drag", "speed", "velocity"]):
                    design_needs_sim = True
                    design_needs_metrics = True
                    print(f"🔍 Detected performance-related keywords, will add sim+metrics agents")
            
            # Add secondary agents based on the analysis
            if design_needs_sim:
                print(f"\n📊 STEP 3A: RUNNING SIMULATION AGENT")
                # Add sim agent as secondary
                secondary_agents.append("sim")
                agent_flow.append({"agent": "sim", "role": "secondary", "timestamp": str(datetime.now())})
                
                # Run sim agent after design changes are applied
                sim_runner = Runner()
                sim_result = await sim_runner.run(
                    sim_agent,
                    input=messages + [{"role": "assistant", "content": f"Design changes have been applied: {json.dumps(primary_actions)}"}],
                    context={"current_rocket_json_str": rocket_json_str, "design_actions": json.dumps(primary_actions)}
                )
                secondary_results["sim"] = sim_result
                
                # Extract additional actions from sim agent
                sim_actions = await extract_actions_from_result(sim_result, "run simulation", req.rocket)
                all_actions.extend(sim_actions)
                print(f"📋 Simulation agent returned {len(sim_actions)} actions")
            
            if design_needs_metrics:
                print(f"\n📏 STEP 3B: RUNNING METRICS AGENT")
                # Add metrics agent as secondary
                agent_flow.append({"agent": "metrics", "role": "secondary", "timestamp": str(datetime.now())})
                secondary_agents.append("metrics")
                metrics_runner = Runner()
                metrics_result = await metrics_runner.run(
                    metrics_agent,
                    input=messages + [{"role": "assistant", "content": f"Design changes have been applied: {json.dumps(primary_actions)}"}],
                    context={"current_rocket_json_str": rocket_json_str, "design_actions": json.dumps(primary_actions)}
                )
                secondary_results["metrics"] = metrics_result
                print(f"📋 Metrics agent completed analysis")
        else:
            # Fall back to master agent if router couldn't identify a specialized agent
            print(f"\n🧠 STEP 2: FALLING BACK TO MASTER AGENT (router returned: '{routed_agent_name}')")
            agent_flow.append({"agent": "master", "role": "primary", "timestamp": str(datetime.now())})
            runner = Runner()
            primary_result = await runner.run(
                master_agent,
                input=messages,
                context={"current_rocket_json_str": rocket_json_str}
            )
            
            # Extract actions using the helper function
            primary_actions = await extract_actions_from_result(primary_result, cleaned_messages[-1]["content"], req.rocket)
            all_actions.extend(primary_actions)
            print(f"📋 Master agent returned {len(primary_actions)} actions")
        
        # Ensure we have a primary result
        result = primary_result
        
        # Create an enhanced user-facing response that combines the outputs
        enhanced_response = ""
        
        # Get output texts from all agents involved
        primary_output = result.completion if hasattr(result, 'completion') else result.final_output if hasattr(result, 'final_output') else str(result)
        
        print(f"\n✅ RESPONSE GENERATION")
        print(f"Primary agent: {primary_agent_name}")
        print(f"Secondary agents: {secondary_agents}")
        print(f"Total actions: {len(all_actions)}")
        
        # First enhance raw text with markdown formatting
        # Apply bold to key terms
        primary_output = re.sub(r'(?<!\*)\b(rocket|altitude|stability|motor|engine|simulation|analysis|design|nose|body|fin|diameter|length|span|root|sweep|color|shape)\b(?!\*)', r'**\1**', primary_output, flags=re.IGNORECASE)
        
        # Add styled action summaries
        if all_actions:
            action_summary = "\n\n### Actions Performed\n\n"
            for action in all_actions:
                if action.get('action') == 'update_part':
                    part_id = action.get('id')
                    props = action.get('props', {})
                    prop_list = ", ".join([f"**{k}**: {v}" for k, v in props.items()])
                    action_summary += f"- Updated **{part_id}** with {prop_list}\n"
                elif action.get('action') == 'add_part':
                    part_type = action.get('type')
                    props = action.get('props', {})
                    prop_list = ", ".join([f"**{k}**: {v}" for k, v in props.items()])
                    action_summary += f"- Added new **{part_type}** with {prop_list}\n"
                elif action.get('action') == 'update_rocket':
                    props = action.get('props', {})
                    prop_list = ", ".join([f"**{k}**: {v}" for k, v in props.items()]) 
                    action_summary += f"- Updated **rocket** with {prop_list}\n"
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
        system_message = {"role": "system", "content": f"CURRENT_ROCKET_JSON\n{json.dumps(req.rocket)}"}
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
                # Re-run the request with the routed agent
                routed_agent = AGENTS[routed_agent_name]
                runner = Runner()
                routed_result = await runner.run(
                    routed_agent,
                    input=messages,
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
                if action.get('action') == 'update_part':
                    part_id = action.get('id')
                    props = action.get('props', {})
                    prop_list = ", ".join([f"**{k}**: {v}" for k, v in props.items()])
                    action_summary += f"- Updated **{part_id}** with {prop_list}\n"
                elif action.get('action') == 'add_part':
                    part_type = action.get('type')
                    props = action.get('props', {})
                    prop_list = ", ".join([f"**{k}**: {v}" for k, v in props.items()])
                    action_summary += f"- Added new **{part_type}** with {prop_list}\n"
                elif action.get('action') == 'update_rocket':
                    props = action.get('props', {})
                    prop_list = ", ".join([f"**{k}**: {v}" for k, v in props.items()]) 
                    action_summary += f"- Updated **rocket** with {prop_list}\n"
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
        system_message = {"role": "system", "content": f"CURRENT_ROCKET_JSON\n{json.dumps(req.rocket)}"}
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