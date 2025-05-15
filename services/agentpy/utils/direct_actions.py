"""Direct action handlers for common rocket modifications."""

def handle_body_extension(rocket: dict, value: float = None) -> dict:
    """
    Handle body extension requests with sensible defaults.
    
    Args:
        rocket: Dictionary containing rocket configuration
        value: Optional value for extension amount or factor
        
    Returns:
        dict: Message and actions to perform
    """
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
    """
    Handle nose extension requests with sensible defaults.
    
    Args:
        rocket: Dictionary containing rocket configuration
        value: Optional value for extension amount or factor
        
    Returns:
        dict: Message and actions to perform
    """
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
    """
    Handle fin enlargement requests with sensible defaults.
    
    Args:
        rocket: Dictionary containing rocket configuration
        value: Optional value for enlargement amount or factor
        
    Returns:
        dict: Message and actions to perform
    """
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
    """
    Handle color change requests.
    
    Args:
        rocket: Dictionary containing rocket configuration
        color_name: Name of the color to apply
        target: The part to color ("all", "body", "nose", or "fin")
        
    Returns:
        dict: Message and actions to perform
    """
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
    """
    Handle height increase requests by extending the body.
    
    Args:
        rocket: Dictionary containing rocket configuration
        value: Amount to increase height by
        
    Returns:
        dict: Message and actions to perform
    """
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

def get_part_attribute(rocket: dict, part_type: str, attribute: str, template: str) -> str:
    """
    Extract a specific attribute from a rocket part and format it into a response.
    
    Args:
        rocket: Dictionary containing rocket configuration
        part_type: Type of part to look for
        attribute: Attribute to extract
        template: Template string for formatting the response
        
    Returns:
        str: Formatted response string
    """
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