# 🚀 Complete Component Adjustment Guide

This guide shows all the adjustable properties for each rocket component using the AI agent.

## 🎯 Overview

The AI agent can adjust **every aspect** of your rocket design through natural language commands. Simply describe what you want to change, and the agent will update the appropriate component properties.

---

## 📏 **Nose Cone Adjustments**

### Geometry
- **Shape**: `"ogive"`, `"conical"`, `"elliptical"`, `"parabolic"`
- **Length**: Any value in meters (e.g., 0.15m, 0.25m)
- **Base Radius**: Diameter adjustment in meters
- **Wall Thickness**: Material thickness in meters

### Materials & Appearance  
- **Material Density**: kg/m³ (Fiberglass: 1600, Aluminum: 2700, Carbon fiber: 1500)
- **Surface Roughness**: Aerodynamic finish in meters (smoother = lower drag)
- **Color**: Any hex color code or color name

### Example Commands
```
"Make the nose cone 25cm long"
"Change nose shape to conical"  
"Make the nose cone green"
"Set nose diameter to 7cm"
"Use carbon fiber for the nose cone"
```

---

## 🔵 **Body Tube Adjustments**

### Dimensions
- **Outer Radius**: Main diameter of the rocket body in meters
- **Length**: Total body length in meters  
- **Wall Thickness**: Tube wall thickness affecting weight/strength

### Materials & Appearance
- **Material Density**: kg/m³ for different materials
- **Surface Roughness**: Affects aerodynamic drag
- **Color**: Visual appearance

### Multiple Body Sections
- Support for multiple body tube sections
- Each section can have different properties
- Index-based targeting (first body, second body, etc.)

### Example Commands
```
"Make the body diameter 8cm"
"Set body length to 60cm" 
"Make the body tube blue"
"Increase wall thickness to 3mm"
"Add a second body section"
"Make the upper body tube aluminum"
```

---

## 🔺 **Fin Adjustments**

### Geometry
- **Fin Count**: Number of fins (typically 3 or 4)
- **Root Chord**: Length where fin attaches to body (meters)
- **Tip Chord**: Length at fin tip (meters)  
- **Span**: Height of fin from body to tip (meters)
- **Sweep Length**: How far back the fin sweeps (meters)
- **Thickness**: Fin material thickness (meters)

### Aerodynamics
- **Cant Angle**: Fin rotation angle in degrees (for spin stabilization)
- **Airfoil**: Fin cross-section shape (`"symmetric"`, `"cambered"`)

### Materials & Appearance
- **Material Density**: Different materials affect weight/strength
- **Color**: Visual appearance

### Example Commands
```
"Set fin cant angle to 5 degrees"
"Make fins 12cm root chord"  
"Increase fin span to 8cm"
"Use plywood for the fins"
"Make fins black"
"Add 4 fins instead of 3"
"Sweep the fins back 3cm"
```

---

## 🚀 **Motor Adjustments**

### Motor Selection
Available motor types from our database:
- **Mini Motors**: `"mini-motor"` (A8-3 class)
- **Default**: `"default-motor"` (F32-6 class)  
- **High Power**: `"high-power"` (H180-7 class)
- **Super Power**: `"super-power"` (I200-8 class)
- **Liquid Engines**: `"small-liquid"`, `"medium-liquid"`, `"large-liquid"`
- **Hybrid Motors**: `"hybrid-experimental"`

### Positioning
- **Position from Tail**: Motor placement along rocket length (meters)

### Advanced Properties
- **Nozzle Expansion Ratio**: For liquid/hybrid motors
- **Chamber Pressure**: For advanced motor configurations

### Example Commands
```
"Use a high-power motor"
"Switch to I-class motor"  
"Move motor 5cm from tail"
"Use liquid propulsion"
"Set motor to H180-7"
"Install super-power motor"
```

---

## 🪂 **Parachute Adjustments**

### Recovery Performance
- **Cd×S**: Drag coefficient × surface area (m²) - affects descent rate
- **Trigger**: When to deploy (`"apogee"`, `"altitude:100"`, time in seconds)
- **Deployment Lag**: Delay in seconds before opening

### Positioning  
- **Position from Tail**: Where parachute is located (meters)

### Simulation Parameters
- **Sampling Rate**: Sensor frequency (Hz)
- **Noise Bias/Deviation**: Realistic sensor errors
- **Noise Correlation**: How sensor errors relate over time

### Appearance
- **Name**: Descriptive label
- **Color**: Visual appearance

### Example Commands
```
"Make parachute deploy at 100m altitude"
"Increase parachute size for slower descent"
"Set parachute lag to 2 seconds"
"Make parachute deploy at apogee"
"Color the parachute orange"
"Move parachute to nose section"
```

---

## 🔧 **Rocket-Level Properties**

### Coordinate System
- **Coordinate System**: `"tail_to_nose"` or `"nose_to_tail"`

### Rail Guides
- **Rail Guide Positions**: Array of positions from tail (meters)

### Example Commands
```
"Use nose-to-tail coordinates"
"Add rail guides at 10cm and 50cm from tail"
```

---

## 🎨 **Advanced Material Properties**

### Material Density Options
- **Fiberglass**: 1600 kg/m³ (default, lightweight, strong)
- **Aluminum**: 2700 kg/m³ (strong, professional)  
- **Carbon Fiber**: 1500 kg/m³ (ultra-light, expensive)
- **Plywood**: 650 kg/m³ (fins, economical)

### Surface Finish
- **Rough Finish**: 1×10⁻⁵ m (standard)
- **Smooth Finish**: 0.5×10⁻⁵ m (polished, lower drag)
- **Very Smooth**: 0.3×10⁻⁵ m (professional finish)

### Example Commands
```
"Use carbon fiber for all components"
"Make the surface finish very smooth"
"Use aluminum body with fiberglass nose"
```

---

## 💡 **Natural Language Examples**

The AI understands natural language, so you can say:

### Combined Adjustments
```
"Make a bigger rocket with 8cm diameter, 70cm long body, and larger fins"
"Design for high altitude with smooth finish and 4 swept fins"
"Make it more stable with bigger fins angled at 5 degrees"
```

### Performance-Based Requests  
```
"Optimize for 1000m altitude"
"Make it fly faster" 
"Reduce drag for better performance"
"Make it more stable"
```

### Appearance Changes
```
"Make it look like a NASA rocket - white body, black nose"
"Paint it red, white, and blue"
"Use professional materials - carbon fiber and aluminum"
```

---

## 🔄 **Multi-Component Operations**

### Scaling
```
"Scale the entire rocket up by 1.5x"
"Make everything 20% larger"
```

### Material Changes
```
"Convert to all carbon fiber construction"
"Use aluminum for strength"
```

### Add/Remove Components
```
"Add a second body section"
"Remove the second fin set"  
"Add a drogue parachute"
```

---

## ⚙️ **Technical Validation**

The system automatically:
- ✅ Validates all dimensions are physically reasonable
- ✅ Ensures structural integrity  
- ✅ Maintains aerodynamic stability
- ✅ Checks motor-to-body compatibility
- ✅ Verifies recovery system adequacy

---

## 🎯 **Quick Reference**

| Property | Units | Range | Example |
|----------|-------|-------|---------|
| **Lengths** | meters | 0.05-3.0m | `"25cm long"` |
| **Diameters** | meters | 0.01-0.2m | `"8cm diameter"` |
| **Angles** | degrees | 0-45° | `"5 degree cant"` |
| **Materials** | kg/m³ | 650-2700 | `"carbon fiber"` |
| **Colors** | hex/name | any | `"red"`, `"#FF0000"` |

---

**🚀 Everything is adjustable! Just describe what you want to change in natural language, and the AI will handle the technical details.** 