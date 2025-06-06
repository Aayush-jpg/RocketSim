"""Simulation agent for running rocket simulations."""

from agents import Agent, function_tool

from tools.sim_tools import run_simulation

# Simulation agent instructions
SIM_AGENT_INSTRUCTIONS = """
You are the simulation specialist. Your role is to trigger simulations by EXECUTING the `run_simulation` tool.
The user's message may be followed by the current rocket state in a CURRENT_ROCKET_JSON block.
Your output MUST be ONLY the JSON string that the `run_simulation` tool call returns.
Use 'quick' for rapid verification and 'hifi' for detailed analysis, as specified by the tool call parameters.
If fidelity is not specified, default to 'quick'.

Examples:
- If the user says "run a simulation", call run_simulation(fidelity="quick")
- If the user says "run a high-fidelity simulation", call run_simulation(fidelity="hifi")
"""

sim_agent = Agent(
    name="SimAgent",
    instructions=SIM_AGENT_INSTRUCTIONS,
    tools=[run_simulation],
    model="gpt-4o-mini"
) 