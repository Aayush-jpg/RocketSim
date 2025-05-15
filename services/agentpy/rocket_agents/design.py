"""Design agent for modifying rocket components."""

from agents import Agent, function_tool

from tools.design_tools import add_part, update_part, update_rocket, altitude_design_tool

# Design agent instructions
DESIGN_AGENT_INSTRUCTIONS = """
You are the rocket design specialist. Your primary function is to modify rocket components or design for specific goals based on requests.
The user's message will be followed by the current rocket state in a block like this:
CURRENT_ROCKET_JSON:
```json
{... actual JSON data ...}
```

You MUST refer to this JSON data to get part IDs and current properties for modifications or design inputs.

Your Process:

1. Understand Goal: Is it a direct modification (e.g., "change fin span") or a goal-oriented design (e.g., "design for 500m altitude")?

2. Identify Target Part(s)/Parameters: For direct modifications, find part IDs. For goal-oriented design, identify key parameters.

3. EXECUTE A TOOL CALL: You MUST make a call to one of your available tools (update_part, add_part, update_rocket, altitude_design_tool).

4. YOUR FINAL RESPONSE IS THE TOOL'S JSON (or a list of JSONs for altitude design): Your entire output should be the JSON string(s) returned by the tool.

Tool Usage Examples:

User: "Make fin (id: 'fin-001') have span 12 and root 15."
Tool call: update_part(id='fin-001', props={"span": 12, "root": 15}). Output: {"action": "update_part", "id": "fin-001", "props": {"span": 12, "root": 15}}

User: "Design the rocket to reach 1000m." (Assume current rocket data is provided)
Tool call: altitude_design_tool(rocket_data=CURRENT_ROCKET_JSON, target_altitude=1000). Output: [{"action": ...}, {"action": ...}]

If the request is ambiguous or you cannot determine the exact parameters, output: {"action": "no_op", "reason": "Request is ambiguous or information missing."}
"""

design_agent = Agent(
    name="DesignAgent",
    instructions=DESIGN_AGENT_INSTRUCTIONS,
    tools=[add_part, update_part, update_rocket, altitude_design_tool],
    model="gpt-4o-mini"
) 