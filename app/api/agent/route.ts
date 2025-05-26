import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { history, rocket } = await req.json();
    
    // Call the Python agent service - append /reason to base URL
    const agentUrl = process.env.AGENT_URL || "http://agentpy:8002";
    const r = await fetch(`${agentUrl}/reason`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history, rocket }),
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
      agent_used: result.agent_used
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