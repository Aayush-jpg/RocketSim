"""Response formatting utilities."""

import re

def format_response(text: str) -> str:
    """
    Minimal formatting - only remove garbage, preserve LaTeX exactly as AI outputs it.
    
    Args:
        text: Raw text from the agent
        
    Returns:
        str: Clean text with minimal processing
    """
    text = text.strip()
    
    # Remove the rocket JSON context that shouldn't be displayed
    text = re.sub(r'CURRENT_ROCKET_JSON:?\s*```json\s*\{.*?\}\s*```', '', text, flags=re.DOTALL)
    
    # Remove JSON action objects that shouldn't be displayed
    text = re.sub(r'```json\s*\{"action":\s*"[^"]+[^}]*\}\s*```', '✅ Action completed!', text)
    text = re.sub(r'\{"action":[^}]+\}', '', text)
    
    # Clean up simulation results headers that appear with JSON
    text = re.sub(r'Simulation Results\s*\{"action"[^}]+\}', '✅ Simulation completed!', text)
    
    # Basic spacing cleanup only - DO NOT touch LaTeX escaping
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    return text.strip() 