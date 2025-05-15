"""QA agent for answering questions about rocket data."""

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
    
    Args:
        rocket_data: The current rocket configuration
        part_type: Optional type of part to query ("nose", "body", "fin")
        attribute: Optional specific attribute to query
        
    Returns:
        str: Formatted information about the requested details
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

# QA agent instructions
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
```

Tool call: get_rocket_details(rocket_data=CURRENT_ROCKET_JSON, part_type="nose", attribute="length")
Your response: "The nose's length is 20cm."
"""

qa_agent = Agent(
    name="QAAgent",
    instructions=QA_AGENT_INSTRUCTIONS,
    tools=[get_rocket_details],
    model="gpt-4o-mini"
) 