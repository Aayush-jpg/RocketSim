import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { history, rocket, environment, simulationHistory, analysisHistory, userPreferences, sessionInfo } = await req.json();
    

    
    // Clean rocket data for backend compatibility
    const cleanedRocket = { ...rocket };
    if (cleanedRocket.fins && Array.isArray(cleanedRocket.fins)) {
      cleanedRocket.fins = cleanedRocket.fins.map((fin: any) => {
        const cleanedFin = { ...fin };
        // Remove wall_thickness_m property for backend (backend treats all fins as solid)
        if ('wall_thickness_m' in cleanedFin) {
          delete cleanedFin.wall_thickness_m;
        }
        return cleanedFin;
      });
    }
    
    // Call the Python agent service - append /reason to base URL
    // Force runtime reading of environment variable
    const agentUrl = process.env.AGENT_URL || "https://rocket-agentpy.internal.yellowhill-85e5bd96.eastus.azurecontainerapps.io";
    console.log(`DEBUG: Using AGENT_URL: ${agentUrl}`);
    console.log(`DEBUG: process.env.AGENT_URL: ${process.env.AGENT_URL}`);
    console.log(`DEBUG: All env vars with AGENT: ${JSON.stringify(Object.keys(process.env).filter(k => k.includes('AGENT')))}`);
    
    // Prepare the comprehensive request payload
    const requestPayload: any = { 
      messages: history, 
      rocket: cleanedRocket
    };
    
    // Add environment data if available
    if (environment) {
      requestPayload.environment = environment;
    }
    
    // Add other context data if available
    if (simulationHistory) {
      requestPayload.simulationHistory = simulationHistory;
    }
    
    if (analysisHistory) {
      requestPayload.analysisHistory = analysisHistory;
    }
    
    if (userPreferences) {
      requestPayload.userPreferences = userPreferences;
    }
    
    if (sessionInfo) {
      requestPayload.sessionInfo = sessionInfo;
    }
    
    console.log(`DEBUG: Making request to: ${agentUrl}/reason`);
    
    const r = await fetch(`${agentUrl}/reason`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestPayload),
    });
    
    if (!r.ok) {
      const errorText = await r.text();
      console.error(`Agent service error (${r.status}): ${errorText}`);
      return new NextResponse(
        JSON.stringify({ 
          error: "Agent service error", 
          final_output: "I'm having trouble connecting to my reasoning service. Please try again." 
        }),
        { status: 500 }
      );
    }
    
    // Get the response
    const result = await r.json();
    
    // Return the formatted response
    return NextResponse.json({
      final_output: result.final_output,
      actions: result.actions,
      trace_url: result.trace_url,
      agent_used: result.agent_used || result.primary_agent,
      agent_flow: result.agent_flow,
      secondary_agents: result.secondary_agents
    });
  } catch (error) {
    console.error("Error in agent API route:", error);
    return new NextResponse(
      JSON.stringify({ 
        error: "Internal server error", 
        final_output: "Sorry, I encountered an unexpected error. Please try again." 
      }),
      { status: 500 }
    );
  }
} 