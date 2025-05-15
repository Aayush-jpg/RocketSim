"""General helper functions for the rocket agent."""

def is_json_response(text: str) -> bool:
    """
    Check if a string appears to be a JSON response.
    
    Args:
        text: The string to check
        
    Returns:
        bool: True if the string appears to be JSON
    """
    import re
    return bool(re.match(r'^\s*\{.*\}\s*$', text, re.DOTALL)) 