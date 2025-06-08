"""Fallback utilities for when agent processing fails - UPDATED FOR COMPONENT ARCHITECTURE."""

import re
import json
import asyncio
from typing import List, Dict, Any, Optional

# Define JSON pattern globally (used by extract_intent_from_text)
JSON_PATTERN = r'\{(?:[^{}]|(?:\{(?:[^{}]|(?:\{[^{}]*\}))*\}))*\}'

# Import needed for design_rocket_for_altitude call - UPDATED for component structure
from physics.aerodynamics import calculate_rocket_mass  # Updated to use renamed function
from physics.propulsion import PROPULSION_SYSTEMS, select_engine_for_altitude
from physics.trajectory import physics_based_rocket_design

async def extract_intent_from_text(text: str, rocket_data: dict):
    """
    Try to extract intent from plain text when agent fails to generate proper tool calls
    UPDATED: Now works with component-based rocket structure
    
    Args:
        text: The user's message text
        rocket_data: Current rocket configuration (component-based)
        
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
            actions.append({"action": "update_motor", "props": {"motor_database_id": new_motor_id}})
            return actions
    
    if (("upgrade" in text.lower() or "more power" in text.lower()) 
            and ("motor" in text.lower() or "engine" in text.lower()) 
            and "high-power" not in text.lower()):
        current_motor = rocket_data.get("motor", {}).get("motor_database_id", "default-motor")
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
            actions.append({"action": "update_motor", "props": {"motor_database_id": new_motor}})
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
        
    # UPDATED: Nose cone shape changes for component structure
    if "nose" in text.lower() and "shape" in text.lower() and any(shape in text.lower() for shape in ["conical", "ogive"]):
        new_shape = "conical" if "conical" in text.lower() else "ogive"
        if rocket_data.get("nose_cone"):
            print(f"Found nose cone, changing shape to {new_shape}")
            actions.append({"action": "update_nose_cone", "props": {"shape": new_shape}})
            return actions
    
    percentage_match = re.search(r'(\d+)%', text)
    percentage_increase = None
    increase_factor = 1.2
    if percentage_match:
        percentage = int(percentage_match.group(1))
        increase_factor = 1 + (percentage / 100)
        percentage_increase = percentage
    
    # UPDATED: Fin size changes for component structure
    if "fin" in text.lower() and any(word in text.lower() for word in ["size", "larger", "bigger", "increase"]) and percentage_increase:
        if rocket_data.get("fins", []):
            fin = rocket_data["fins"][0]  # Get first fin set
            updated_props = {}
            if fin.get("root_chord_m"): updated_props["root_chord_m"] = round(fin["root_chord_m"] * increase_factor, 4)
            if fin.get("span_m"): updated_props["span_m"] = round(fin["span_m"] * increase_factor, 4)
            if fin.get("sweep_length_m") and "sweep" in text.lower(): updated_props["sweep_length_m"] = round(fin["sweep_length_m"] * increase_factor, 4)
            if updated_props:
                actions.append({"action": "update_fins", "props": updated_props, "index": 0})
                return actions
    
    # UPDATED: Dimension pattern matching for component structure
    dimension_patterns = [
        r'(root_chord|root)\s+from\s+(\d+\.?\d*)\s*(?:cm|m)?\s+to\s+(?:approximately\s+)?(\d+\.?\d*)', 
        r'(span)\s+from\s+(\d+\.?\d*)\s*(?:cm|m)?\s+to\s+(?:approximately\s+)?(\d+\.?\d*)',
        r'(sweep|sweep_length)\s+from\s+(\d+\.?\d*)\s*(?:cm|m)?\s+to\s+(?:approximately\s+)?(\d+\.?\d*)', 
        r'(increase|new)\s+(root_chord|root):\s*(\d+\.?\d*)',
        r'(increase|new)\s+(span):\s*(\d+\.?\d*)', 
        r'(increase|new)\s+(sweep|sweep_length):\s*(\d+\.?\d*)',
    ]
    fin_updates = {}
    for pattern in dimension_patterns:
        matches = re.finditer(pattern, text.lower())
        for match in matches:
            if len(match.groups()) == 3:
                prop_name = match.group(1) if match.group(1) in ["root_chord", "root", "span", "sweep", "sweep_length"] else match.group(2)
                new_value = float(match.group(3))
                
                # Convert to component structure property names and units
                if prop_name in ["root_chord", "root"]:
                    # Convert cm to m if value seems to be in cm (> 1)
                    fin_updates["root_chord_m"] = new_value / 100 if new_value > 1 else new_value
                elif prop_name == "span":
                    fin_updates["span_m"] = new_value / 100 if new_value > 1 else new_value
                elif prop_name in ["sweep", "sweep_length"]:
                    fin_updates["sweep_length_m"] = new_value / 100 if new_value > 1 else new_value
                    
    if fin_updates:
        if rocket_data.get("fins", []):
            actions.append({"action": "update_fins", "props": fin_updates, "index": 0})
            return actions
                
    # UPDATED: Body tube length changes for component structure
    if any(phrase in text.lower() for phrase in ["double the body", "twice", "2x", "doubling"]) and any(word in text.lower() for word in ["length", "longer", "size"]):
        if rocket_data.get("body_tubes", []):
            body_tube = rocket_data["body_tubes"][0]
            current_length = body_tube.get("length_m", 0.6)
            actions.append({"action": "update_body_tube", "props": {"length_m": current_length * 2}, "index": 0})
            return actions
    
    # Color changes - updated for component structure
    color_map = {"red": "#FF0000", "blue": "#0000FF", "green": "#00FF00", "yellow": "#FFFF00", "purple": "#800080", "orange": "#FFA500", "black": "#000000", "white": "#FFFFFF"}
    for color_name, color_hex in color_map.items():
        if color_name in text.lower():
            part_specific = False
            # Nose cone color
            if "nose" in text.lower() and rocket_data.get("nose_cone"):
                actions.append({"action": "update_nose_cone", "props": {"color": color_hex}})
                part_specific = True
            # Body tube color  
            elif "body" in text.lower() and rocket_data.get("body_tubes", []):
                actions.append({"action": "update_body_tube", "props": {"color": color_hex}, "index": 0})
                part_specific = True
            # Fin color
            elif "fin" in text.lower() and rocket_data.get("fins", []):
                actions.append({"action": "update_fins", "props": {"color": color_hex}, "index": 0})
                part_specific = True
            # All components
            elif not part_specific and any(word in text.lower() for word in ["all", "entire", "whole", "rocket"]):
                if rocket_data.get("nose_cone"):
                    actions.append({"action": "update_nose_cone", "props": {"color": color_hex}})
                if rocket_data.get("body_tubes", []):
                    actions.append({"action": "update_body_tube", "props": {"color": color_hex}, "index": 0})
                if rocket_data.get("fins", []):
                    actions.append({"action": "update_fins", "props": {"color": color_hex}, "index": 0})
    
    # UPDATED: Fin enlargement for component structure
    if not actions and "fin" in text.lower() and percentage_increase:
        if rocket_data.get("fins", []):
            fin = rocket_data["fins"][0]
            props = {}
            if fin.get("root_chord_m"): props["root_chord_m"] = round(fin["root_chord_m"] * increase_factor, 4)
            if fin.get("span_m"): props["span_m"] = round(fin["span_m"] * increase_factor, 4)
            if props: 
                actions.append({"action": "update_fins", "props": props, "index": 0})
                
    print(f"Final extracted actions (from text): {actions}")
    return actions

async def design_rocket_for_altitude(rocket_data: dict, target_altitude: float) -> list:
    """
    Design a rocket to reach a specific altitude target using advanced physics calculations
    UPDATED: Now works with component-based rocket structure
    
    Args:
        rocket_data: Dictionary containing current rocket configuration (component-based)
        target_altitude: Target altitude in meters
        
    Returns:
        list: A list of actions to modify the rocket design
    """
    print(f"Designing rocket to reach {target_altitude}m altitude")
    actions = []
    
    # Create a default rocket if needed - UPDATED for component structure
    if not rocket_data.get("nose_cone") and not rocket_data.get("body_tubes") and not rocket_data.get("fins"):
        # We'll create a default rocket in altitude_design_tool instead
        pass
    
    try:
        # UPDATED: Get motor from component structure
        current_motor_id = rocket_data.get("motor", {}).get("motor_database_id", "default-motor")
        current_engine_spec = PROPULSION_SYSTEMS.get(current_motor_id, PROPULSION_SYSTEMS['default-motor'])
        rocket_dry_mass = calculate_rocket_mass(rocket_data)
        
        # Select appropriate engine based on altitude target
        selected_engine_id = select_engine_for_altitude(target_altitude, rocket_dry_mass)
        selected_engine = PROPULSION_SYSTEMS[selected_engine_id]
        
        # Log debug info
        print(f"Current engine: {current_motor_id} → New engine: {selected_engine_id}")
        print(f"Current thrust: {current_engine_spec.get('thrust', 0)}N → New thrust: {selected_engine.get('thrust', 0)}N")
        
        # Always update the engine - this is critical for altitude
        actions.append({"action": "update_motor", "props": {"motor_database_id": selected_engine_id}})
        
        # UPDATED: Find existing components in the new structure
        has_nose = bool(rocket_data.get("nose_cone"))
        has_body = bool(rocket_data.get("body_tubes", []))
        has_fins = bool(rocket_data.get("fins", []))

        # Calculate appropriate dimensions based on physics and altitude target
        # For very high altitudes (>20km), we need liquid engines and larger dimensions
        if target_altitude > 20000:
            # High altitude configuration (liquid engines)
            body_length_m = min(2.5, max(1.2, 0.8 + (target_altitude / 100000)))  # 0.8-2.5m
            body_radius_m = min(0.1, max(0.05, 0.04 + (target_altitude / 2000000)))  # 5-10cm radius
            nose_shape = "ogive"  # More aerodynamic for high altitudes
            fin_root_m = min(0.3, max(0.16, 0.12 + (target_altitude / 1000000)))  # 12-30cm
            fin_span_m = min(0.25, max(0.12, 0.10 + (target_altitude / 1500000)))  # 10-25cm
            
            print(f"HIGH ALTITUDE DESIGN: Length={body_length_m:.2f}m, Radius={body_radius_m:.3f}m")
            
        elif target_altitude > 5000:
            # Medium altitude configuration (mix of high-power solid or hybrid)
            body_length_m = min(1.8, max(0.8, 0.6 + (target_altitude / 50000)))  # 0.6-1.8m
            body_radius_m = min(0.075, max(0.04, 0.03 + (target_altitude / 1000000)))  # 3-7.5cm radius
            nose_shape = "ogive"
            fin_root_m = min(0.2, max(0.12, 0.10 + (target_altitude / 1000000)))  # 10-20cm
            fin_span_m = min(0.18, max(0.10, 0.08 + (target_altitude / 1200000)))  # 8-18cm
            
            print(f"MEDIUM ALTITUDE DESIGN: Length={body_length_m:.2f}m, Radius={body_radius_m:.3f}m")
            
        else:
            # Low altitude configuration (solid motors)
            body_length_m = min(1.2, max(0.4, 0.3 + (target_altitude / 20000)))  # 0.3-1.2m
            body_radius_m = min(0.05, max(0.025, 0.025 + (target_altitude / 500000)))  # 2.5-5cm radius
            nose_shape = "conical" if target_altitude < 1000 else "ogive"
            fin_root_m = min(0.15, max(0.08, 0.08 + (target_altitude / 500000)))  # 8-15cm
            fin_span_m = min(0.12, max(0.06, 0.06 + (target_altitude / 600000)))  # 6-12cm
            
            print(f"LOW ALTITUDE DESIGN: Length={body_length_m:.2f}m, Radius={body_radius_m:.3f}m")

        # UPDATED: Always update body tube dimensions using component structure
        if has_body:
            actions.append({
                "action": "update_body_tube", 
                "index": 0,
                "props": {
                    "length_m": round(body_length_m, 3),
                    "outer_radius_m": round(body_radius_m, 4)
                }
            })
        
        # UPDATED: Always update nose cone dimensions using component structure
        if has_nose:
            actions.append({
                "action": "update_nose_cone", 
                "props": {
                    "shape": nose_shape,
                    "length_m": round(body_radius_m * 5.0, 3),  # Proportional to radius (5:1 ratio)
                    "base_radius_m": round(body_radius_m, 4)  # Match body radius
                }
            })
        
        # UPDATED: Always update fin dimensions using component structure
        if has_fins:
            actions.append({
                "action": "update_fins", 
                "index": 0,
                "props": {
                    "root_chord_m": round(fin_root_m, 3),
                    "span_m": round(fin_span_m, 3),
                    "sweep_length_m": round(fin_root_m * 0.8, 3)  # Proportional sweep
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
            
            This is a COMPONENT-BASED rocket with:
            - nose_cone: shape, length_m, base_radius_m
            - body_tubes: outer_radius_m, length_m  
            - fins: root_chord_m, span_m, sweep_length_m
            - motor: motor_database_id
            
            Provide parameters: Motor: {selected_engine_id}, Body length: [m] (0.3-2.5), Body radius: [m] (0.025-0.1), Nose shape: [ogive/conical], Fin dimensions: root_chord_m [m] (0.08-0.3), span_m [m] (0.06-0.25).
            Output ONLY parameters in meters.
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
                
                # UPDATED: Override our physics-based values with LLM advice if available
                body_match = re.search(r'[Bb]ody\s+length:\s*(\d+(?:\.\d+)?)', advice)
                nose_match = re.search(r'[Nn]ose\s+shape:\s*(\w+)', advice)
                fin_root_match = re.search(r'[Ff]in\s+(?:dimensions)?:?\s*(?:root_chord_m)?\s*(\d+(?:\.\d+)?)', advice)
                fin_span_match = re.search(r'[Ss]pan_m\s*[:-]?\s*(\d+(?:\.\d+)?)', advice)
                radius_match = re.search(r'[Bb]ody\s+radius:\s*(\d+(?:\.\d+)?)', advice)

                # Apply LLM refinements using component actions
                if body_match and has_body:
                    actions = [a for a in actions if not (a.get("action") == "update_body_tube" and a.get("index") == 0)]
                    actions.append({
                        "action": "update_body_tube", 
                        "index": 0,
                        "props": {
                            "length_m": float(body_match.group(1)),
                            "outer_radius_m": float(radius_match.group(1)) if radius_match else body_radius_m
                        }
                    })
                
                if nose_match and nose_match.group(1).lower() in ["ogive", "conical"] and has_nose:
                    actions = [a for a in actions if not (a.get("action") == "update_nose_cone")]
                    actions.append({
                        "action": "update_nose_cone", 
                        "props": {
                            "shape": nose_match.group(1).lower(),
                            "length_m": round(float(radius_match.group(1)) * 5.0, 3) if radius_match else round(body_radius_m * 5.0, 3),
                            "base_radius_m": float(radius_match.group(1)) if radius_match else body_radius_m
                        }
                    })
                
                if fin_root_match and fin_span_match and has_fins:
                    actions = [a for a in actions if not (a.get("action") == "update_fins" and a.get("index") == 0)]
                    fin_root_val = float(fin_root_match.group(1))
                    actions.append({
                        "action": "update_fins", 
                        "index": 0,
                        "props": {
                            "root_chord_m": fin_root_val,
                            "span_m": float(fin_span_match.group(1)),
                            "sweep_length_m": round(fin_root_val * 0.8, 3)
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