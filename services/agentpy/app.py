import os
import json
from typing import Dict, Any, List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from agents import Agent, Runner, function_tool, AgentResponse

# Import our modules
from utils.models import ChatRequest, AgentRequest
from utils.format import format_response
from utils.fallbacks import extract_intent_from_text

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

# Initialize the master agent with instructions on how to use all specialized agents
master_agent = Agent(
    name="Rocket‑Cursor AI",
    instructions=(
        "You are an expert assistant for model‑rocket design. "
        "Always inspect CURRENT_ROCKET_JSON and decide which tool to call. "
        "If apogee < 100 m, suggest improvements. "
        "Use add_part, update_part, or run_simulation tools as appropriate."
    ),
    tools=[add_part, update_part, update_rocket, run_simulation, altitude_design_tool],
    model="gpt-4o-mini",
)

# Initialize the prediction agent with the other agents as tools
# We need to do this here after importing the other agents
design_agent_as_tool = function_tool(lambda message, rocket_data: design_agent.complete(
    [{"role": "system", "content": f"CURRENT_ROCKET_JSON\n{json.dumps(rocket_data)}"}, 
     {"role": "user", "content": message}]
).completion)("design_agent_as_tool")

sim_agent_as_tool = function_tool(lambda message, rocket_data: sim_agent.complete(
    [{"role": "system", "content": f"CURRENT_ROCKET_JSON\n{json.dumps(rocket_data)}"}, 
     {"role": "user", "content": message}]
).completion)("sim_agent_as_tool")

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
        # Prepare the context with the current rocket state
        system_message = {"role": "system", "content": f"CURRENT_ROCKET_JSON\n{json.dumps(req.rocket)}"}
        messages = [system_message] + req.messages
        
        # Run the master agent
        result = await Runner.run_async(agent=master_agent, input=messages, stream=False)
        
        # Extract actions from the result
        actions = []
        try:
            if result.actions and isinstance(result.actions, list) and len(result.actions) > 0:
                actions = result.actions
        except Exception as e:
            print(f"Error extracting actions: {str(e)}")
            actions = await extract_intent_from_text(req.messages[-1]["content"], req.rocket)
        
        return {
            "final_output": result.final_output,
            "actions": json.dumps(actions) if actions else None,
            "token_usage": result.token_usage.model_dump() if result.token_usage else None,
            "trace_url": result.trace_url
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
        
        # Prepare the context with the current rocket state
        system_message = {"role": "system", "content": f"CURRENT_ROCKET_JSON\n{json.dumps(req.rocket)}"}
        messages = [system_message] + req.messages
        
        # Run the selected agent
        result = await Runner.run_async(agent=agent, input=messages, stream=False)
        
        # Handle the response based on the agent type
        actions = []
        if agent_name in ["master", "design"]:
            # These agents return actions directly
            if result.actions and isinstance(result.actions, list):
                actions = result.actions
        elif agent_name == "router":
            # Router agent returns the name of another agent to use
            routed_agent_name = result.final_output.strip().lower()
            if routed_agent_name in AGENTS and routed_agent_name != "router":
                # Re-run the request with the routed agent
                routed_agent = AGENTS[routed_agent_name]
                routed_result = await Runner.run_async(agent=routed_agent, input=messages, stream=False)
                
                # Update the response with the routed agent's result
                result = routed_result
                if routed_agent_name in ["master", "design"] and result.actions:
                    actions = result.actions
        
        # Format the response text for better readability
        formatted_output = format_response(result.final_output)
        
        return {
            "final_output": formatted_output,
            "actions": json.dumps(actions) if actions else None,
            "agent_used": agent_name,
            "token_usage": result.token_usage.model_dump() if result.token_usage else None,
            "trace_url": result.trace_url
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
        # Prepare the context with the current rocket state
        system_message = {"role": "system", "content": f"CURRENT_ROCKET_JSON\n{json.dumps(req.rocket)}"}
        messages = [system_message] + req.messages
        
        # Run the router agent
        result = await Runner.run_async(agent=router_agent, input=messages, stream=False)
        
        return {
            "agent": result.final_output.strip().lower(),
            "token_usage": result.token_usage.model_dump() if result.token_usage else None
        }
    except Exception as e:
        print(f"Error in /route-query endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "version": "1.0.0"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8002)