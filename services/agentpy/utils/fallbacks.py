"""Fallback utilities for when agent processing fails."""

import re
import json
import asyncio
from typing import List, Dict, Any, Optional

# Define JSON pattern globally (used by extract_intent_from_text)
JSON_PATTERN = r'\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}'

# Import needed for design_rocket_for_altitude call
from physics.aerodynamics import calculate_rocket_mass
from physics.propulsion import PROPULSION_SYSTEMS, select_engine_for_altitude
from physics.trajectory import physics_based_rocket_design

async def extract_intent_from_text(text: str, rocket_data: dict):
    """
    Try to extract intent from plain text when agent fails to generate proper tool calls
    
    Args:
        text: The user's message text
        rocket_data: Current rocket configuration
        
    Returns:
        list: A list of actions to perform
    """
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
    """
    Design a rocket to reach a specific altitude target using advanced physics calculations
    
    Args:
        rocket_data: Dictionary containing current rocket configuration
        target_altitude: Target altitude in meters
        
    Returns:
        list: A list of actions to modify the rocket design
    """
    print(f"Designing rocket to reach {target_altitude}m altitude")
    actions = []
    
    # Create a default rocket if needed
    if not rocket_data.get("parts", []):
        # We'll create a default rocket in altitude_design_tool instead
        pass
    
    try:
        current_engine_spec = PROPULSION_SYSTEMS.get(rocket_data.get('motorId', 'default-motor'), PROPULSION_SYSTEMS['default-motor'])
        rocket_dry_mass = calculate_rocket_mass(rocket_data)
        
        # Select appropriate engine based on altitude target
        selected_engine_id = select_engine_for_altitude(target_altitude, rocket_dry_mass)
        selected_engine = PROPULSION_SYSTEMS[selected_engine_id]
        
        # Log debug info
        print(f"Current engine: {rocket_data.get('motorId', 'default-motor')} → New engine: {selected_engine_id}")
        print(f"Current thrust: {current_engine_spec.get('thrust', 0)}N → New thrust: {selected_engine.get('thrust', 0)}N")
        
        # Always update the engine - this is critical for altitude
        actions.append({"action": "update_rocket", "props": {"motorId": selected_engine_id}})
        
        # Find existing parts or placeholder IDs for new parts
        body_part = next((p for p in rocket_data.get("parts", []) if p.get("type") == "body"), None)
        nose_part = next((p for p in rocket_data.get("parts", []) if p.get("type") == "nose"), None)
        fin_part = next((p for p in rocket_data.get("parts", []) if p.get("type") == "fin"), None)
        
        # Default part IDs if parts don't exist
        body_id = body_part["id"] if body_part else "body-default"
        nose_id = nose_part["id"] if nose_part else "nose-default"
        fin_id = fin_part["id"] if fin_part else "fin-default"

        # Calculate appropriate dimensions based on physics and altitude target
        # For very high altitudes (>20km), we need liquid engines and larger dimensions
        if target_altitude > 20000:
            # High altitude configuration (liquid engines)
            body_length = min(250, max(120, 80 + (target_altitude / 1000)))
            body_diameter = min(20, max(10, 8 + (target_altitude / 20000)))
            nose_shape = "ogive"  # More aerodynamic for high altitudes
            fin_root = min(30, max(16, 12 + (target_altitude / 10000)))
            fin_span = min(25, max(12, 10 + (target_altitude / 15000)))
            
            print(f"HIGH ALTITUDE DESIGN: Length={body_length}cm, Diameter={body_diameter}cm")
            
        elif target_altitude > 5000:
            # Medium altitude configuration (mix of high-power solid or hybrid)
            body_length = min(180, max(80, 60 + (target_altitude / 500)))
            body_diameter = min(15, max(8, 6 + (target_altitude / 10000)))
            nose_shape = "ogive"
            fin_root = min(20, max(12, 10 + (target_altitude / 10000)))
            fin_span = min(18, max(10, 8 + (target_altitude / 12000)))
            
            print(f"MEDIUM ALTITUDE DESIGN: Length={body_length}cm, Diameter={body_diameter}cm")
            
        else:
            # Low altitude configuration (solid motors)
            body_length = min(120, max(40, 30 + (target_altitude / 200)))
            body_diameter = min(10, max(5, 5 + (target_altitude / 5000)))
            nose_shape = "conical" if target_altitude < 1000 else "ogive"
            fin_root = min(15, max(8, 8 + (target_altitude / 5000)))
            fin_span = min(12, max(6, 6 + (target_altitude / 6000)))
            
            print(f"LOW ALTITUDE DESIGN: Length={body_length}cm, Diameter={body_diameter}cm")

        # Always update body dimensions
        actions.append({
            "action": "update_part", 
            "id": body_id, 
            "props": {
                "length": round(body_length, 1),
                "Ø": round(body_diameter, 1)
            }
        })
        
        # Always update nose dimensions
        actions.append({
            "action": "update_part", 
            "id": nose_id, 
            "props": {
                "shape": nose_shape,
                "length": round(body_diameter * 2.5, 1),  # Proportional to diameter
                "baseØ": round(body_diameter, 1)  # Match body diameter
            }
        })
        
        # Always update fin dimensions
        actions.append({
            "action": "update_part", 
            "id": fin_id, 
            "props": {
                "root": round(fin_root, 1),
                "span": round(fin_span, 1),
                "sweep": round(fin_root * 0.8, 1)  # Proportional sweep
            }
        })
        
        # Get additional refinements from LLM if possible
        try:
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
            
            # Import at runtime to avoid circular imports
            import os
            import httpx
            OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Content-Type": "application/json", "Authorization": f"Bearer {OPENAI_API_KEY}"},
                    json={"model": "gpt-4o-mini", "messages": [{"role": "system", "content": "You are a rocket design expert."}, {"role": "user", "content": prompt}], "temperature": 0.3, "max_tokens": 500}
                )
                
            if response.status_code == 200:
                advice = response.json()["choices"][0]["message"]["content"]
                print(f"OpenAI design advice for altitude: {advice}")
                
                # Override our physics-based values with LLM advice if available
                body_match = re.search(r'[Bb]ody\s+length:\s*(\d+(?:\.\d+)?)', advice)
                nose_match = re.search(r'[Nn]ose\s+shape:\s*(\w+)', advice)
                fin_root_match = re.search(r'[Ff]in\s+(?:dimensions)?:?\s*(?:root)?\s*(\d+(?:\.\d+)?)', advice)
                fin_span_match = re.search(r'[Ss]pan\s*[:-]?\s*(\d+(?:\.\d+)?)', advice)
                diameter_match = re.search(r'[Bb]ody\s+diameter:\s*(\d+(?:\.\d+)?)', advice)

                # Apply LLM refinements
                if body_match:
                    actions = [a for a in actions if not (a.get("action") == "update_part" and a.get("id") == body_id)]
                    actions.append({
                        "action": "update_part", 
                        "id": body_id, 
                        "props": {
                            "length": float(body_match.group(1)),
                            "Ø": float(diameter_match.group(1)) if diameter_match else body_diameter
                        }
                    })
                
                if nose_match and nose_match.group(1).lower() in ["ogive", "conical"]:
                    actions = [a for a in actions if not (a.get("action") == "update_part" and a.get("id") == nose_id)]
                    actions.append({
                        "action": "update_part", 
                        "id": nose_id, 
                        "props": {
                            "shape": nose_match.group(1).lower(),
                            "length": round(float(diameter_match.group(1)) * 2.5, 1) if diameter_match else round(body_diameter * 2.5, 1),
                            "baseØ": float(diameter_match.group(1)) if diameter_match else body_diameter
                        }
                    })
                
                if fin_root_match and fin_span_match:
                    actions = [a for a in actions if not (a.get("action") == "update_part" and a.get("id") == fin_id)]
                    fin_root_val = float(fin_root_match.group(1))
                    actions.append({
                        "action": "update_part", 
                        "id": fin_id, 
                        "props": {
                            "root": fin_root_val,
                            "span": float(fin_span_match.group(1)),
                            "sweep": round(fin_root_val * 0.8, 1)
                        }
                    })
                    
        except Exception as e:
            print(f"Error in LLM refinement: {str(e)}. Using physics-based values only.")

    except Exception as e:
        print(f"Error in design_rocket_for_altitude: {str(e)}. Falling back to physics-based design.")
        actions = physics_based_rocket_design(rocket_data, target_altitude)
    
    # Always ensure we have a simulation action
    if not any(a.get("action") == "run_sim" for a in actions):
        actions.append({"action": "run_sim", "fidelity": "quick"})
    
    # Print final actions for debugging
    action_summary = "\n".join([f"  - {json.dumps(a)}" for a in actions])
    print(f"Final design actions for {target_altitude}m altitude:\n{action_summary}")
    
    return actions 