# Comprehensive Context Integration for Rocket Agents

## Overview

The Rocket Agent system now uses a sophisticated **Comprehensive Context Builder** that provides each agent with precisely the information they need to make informed decisions. This system leverages all available data including environmental conditions, simulation history, analysis results, user preferences, and session information.

## Architecture Summary

### **Context Builder Components**

1. **`RocketContextBuilder`** - Core context building class
2. **`build_agent_context()`** - Agent-specific context tailoring
3. **`create_enhanced_system_message()`** - System message creation with full context
4. **Agent-Specific Context Needs** - Optimized data delivery per agent type

### **Data Sources Integrated**

- **Rocket Configuration** - Current design state (always included)
- **Environmental Data** - Weather, wind, temperature, location
- **Simulation History** - Previous flight results and performance trends  
- **Analysis History** - Technical analysis, stability calculations, Monte Carlo results
- **User Preferences** - Experience level, safety preferences, preferred units
- **Session Information** - Current session state and interaction history

## Agent-Specific Context Allocation

### **Master Agent** 🎯
**Context Level: COMPREHENSIVE** - Gets everything
- ✅ Environment data - For overall decision making
- ✅ Simulation history - For performance awareness
- ✅ Analysis history - For technical understanding
- ✅ User preferences - For appropriate responses
- ✅ Session info - For context awareness

### **Design Agent** 🔧
**Context Level: DESIGN-FOCUSED** - Performance and safety oriented
- ✅ Environment data - Wind conditions affect design choices
- ✅ Simulation history - Learn from performance trends
- ✅ Analysis history - Understand stability patterns
- ✅ User preferences - Experience-appropriate designs
- ❌ Session info - Not needed for technical design

**Special Features:**
- **Wind Warnings**: Alerts for high wind conditions
- **Stability Alerts**: Warnings about previous unstable flights
- **Performance Guidance**: Notes about low altitude issues

### **Simulation Agent** 🚀
**Context Level: SIMULATION-FOCUSED** - Accuracy and comparison oriented
- ✅ Environment data - **CRITICAL** for realistic simulations
- ✅ Simulation history - Compare with previous runs
- ❌ Analysis history - Not needed for running sims
- ✅ User preferences - Simulation fidelity preferences
- ❌ Session info - Not relevant for simulation execution

**Special Features:**
- **Environmental Notes**: Reminds to use current conditions
- **Historical Comparison**: Context for performance trends

### **Metrics Agent** 📊
**Context Level: ANALYSIS-FOCUSED** - Trend and technical analysis
- ❌ Environment data - Less critical for analysis
- ✅ Simulation history - **ESSENTIAL** for trend analysis
- ✅ Analysis history - **CORE** requirement for metrics
- ✅ User preferences - Appropriate complexity level
- ❌ Session info - Not needed for technical analysis

**Special Features:**
- **Trend Analysis Notes**: Highlights available data for comparison
- **Technical Context**: Deep analysis capabilities

### **QA Agent** ❓
**Context Level: INFORMATIONAL** - Context-aware responses
- ❌ Environment data - Not typically needed for questions
- ✅ Simulation history - Answer performance questions
- ✅ Analysis history - Answer technical questions
- ✅ User preferences - Appropriate detail level
- ✅ Session info - Context-aware responses

### **Router Agent** 🧭
**Context Level: MINIMAL** - Classification focused
- ❌ Environment data - Not needed for routing
- ❌ Simulation history - Not needed for classification
- ❌ Analysis history - Not needed for routing
- ✅ User preferences - Understand user skill level
- ✅ Session info - Route based on session patterns

### **Prediction Agent** 🔮
**Context Level: SCENARIO-FOCUSED** - "What-if" analysis
- ✅ Environment data - Realistic scenario conditions
- ✅ Simulation history - Baseline comparisons
- ✅ Analysis history - Current state understanding
- ✅ User preferences - Appropriate complexity
- ❌ Session info - Not needed for predictions

## Context Examples

### **Design Agent with Full Context**
```
=== COMPREHENSIVE CONTEXT REPORT ===
Generated at: 2024-01-15T10:30:00

=== CURRENT ROCKET CONFIGURATION ===
Name: My Test Rocket
Units: metric
Motor: small-solid
Parts: Body (Ø: 5cm, Length: 30cm), Nose (ogive, 8cm), Fins (3x)

=== ENVIRONMENT CONDITIONS ===
Temperature: 15.2°C
Wind: 8.5 m/s from NW (315°)
💨 MODERATE WINDS: Design should account for wind effects

=== SIMULATION HISTORY ===
Latest Simulation: Max Altitude: 45.2m
🚨 STABILITY ISSUE: Previous simulation showed unstable flight
📉 LOW PERFORMANCE: Previous simulation showed low altitude

=== AGENT-SPECIFIC NOTES ===
⚠️ HIGH WINDS: Consider designing for stability in windy conditions
```

### **Simulation Agent with Focused Context**
```
=== CURRENT ROCKET CONFIGURATION ===
[Rocket details...]

=== ENVIRONMENT CONDITIONS ===
Temperature: 15.2°C, Wind: 8.5 m/s from NW
🌤️ SIMULATION NOTE: Use current environmental conditions for accurate results

=== SIMULATION HISTORY ===
Total simulations: 3
Latest: 45.2m altitude, stability margin: 0.8
```

## Benefits of This System

### **1. Intelligent Context Filtering**
- Each agent gets only relevant data
- Reduces token usage and improves response quality
- Prevents information overload

### **2. Agent-Specific Intelligence**
- Design agents get stability warnings
- Sim agents get environmental reminders
- Metrics agents get trend analysis capabilities

### **3. Dynamic Warnings and Notes**
- Real-time assessment of conditions
- Proactive safety recommendations
- Performance improvement suggestions

### **4. Scalable Architecture**
- Easy to add new data sources
- Simple to modify agent context needs
- Backward compatible with existing code

## Implementation Details

### **Key Functions**

```python
# Main context building function
def build_agent_context(agent_name: str, req: ChatRequest, user_message: str = "") -> str

# System message creation
def create_enhanced_system_message(agent_name: str, req: ChatRequest, user_message: str = "") -> dict

# Legacy compatibility
def build_comprehensive_context(rocket_data, environment=None, simulation_history=None, ...)
```

### **Context Configuration**
The `AGENT_CONTEXT_NEEDS` dictionary defines what each agent requires:

```python
AGENT_CONTEXT_NEEDS = {
    "design": {
        "environment": True,      # Wind affects design
        "simulation_history": True,  # Learn from performance
        "analysis_history": True,    # Stability patterns
        "user_preferences": True,    # Experience level
        "session_info": False       # Not needed
    },
    # ... other agents
}
```

### **Integration Points**

1. **Main `/reason` endpoint** - All agent calls use enhanced context
2. **Secondary agents** - Sim and metrics get context for follow-up analysis
3. **Router decisions** - Context-aware routing based on user preferences
4. **Agent tools** - Sub-agents can access context when called as tools

## Future Enhancements

### **Planned Additions**
- **Weather API Integration** - Real-time weather data
- **Flight Restrictions** - NOTAMs and airspace awareness
- **Community Data** - Shared performance statistics
- **Machine Learning** - Predictive context recommendations

### **Advanced Features**
- **Context Caching** - Reduce computation for repeated requests
- **Context Compression** - Intelligent summarization for large histories
- **Context Versioning** - Track context evolution over time

## Testing and Validation

### **Test Scenarios**
1. **High Wind Design** - Agent should recommend stability-focused designs
2. **Low Performance History** - Agent should suggest performance improvements
3. **Beginner User** - Agent should provide simpler recommendations
4. **Expert User** - Agent should offer advanced technical details

### **Validation Checks**
- Context size appropriate for each agent
- No information leakage between agent types
- Performance impact within acceptable bounds
- Backward compatibility maintained

## Migration and Rollout

### **Backward Compatibility**
- All existing endpoints continue to work
- Graceful degradation when context data unavailable
- Legacy context functions still supported

### **Rollout Strategy**
1. ✅ **Phase 1**: Core context builder implementation
2. ✅ **Phase 2**: Agent-specific context integration
3. 🔄 **Phase 3**: Enhanced context features (wind warnings, etc.)
4. 📋 **Phase 4**: Real-time data integration
5. 📋 **Phase 5**: Machine learning context optimization

---

This comprehensive context system transforms our agents from simple tool-calling entities into intelligent, context-aware assistants that understand the full scope of rocket design, environmental conditions, and user needs. Each agent now has the precise information it needs to make optimal decisions while avoiding information overload.

**The result: Smarter agents, better decisions, superior user experience.** 🚀 