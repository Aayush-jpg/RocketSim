import { NextRequest, NextResponse } from "next/server";
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    // Verify API key is available
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const { text, type = "default" } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: "Text content is required" },
        { status: 400 }
      );
    }

    // Generate embedding based on content type
    let model = "text-embedding-3-small";
    let processedText = text;

    // Optimize text processing based on type
    switch (type) {
      case "rocket":
        // For rocket descriptions, focus on technical aspects
        processedText = `Rocket design: ${text}`;
        break;
      case "chat":
        // For chat messages, preserve conversational context
        processedText = `Conversation: ${text}`;
        break;
      case "similarity":
        // For similarity search, emphasize key characteristics
        processedText = `Technical specification: ${text}`;
        break;
      default:
        processedText = text;
    }

    const response = await openai.embeddings.create({
      model,
      input: processedText,
      dimensions: 1536, // Standard dimension for text-embedding-3-small
    });

    const embedding = response.data[0].embedding;

    return NextResponse.json({
      embedding,
      model,
      usage: response.usage,
      type,
      originalLength: text.length,
      processedLength: processedText.length
    });

  } catch (error: any) {
    console.error('Embedding generation error:', error);
    
    if (error.status === 401) {
      return NextResponse.json(
        { error: "Invalid OpenAI API key" },
        { status: 401 }
      );
    }
    
    if (error.status === 429) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Failed to generate embedding", details: error.message },
      { status: 500 }
    );
  }
}

// Also support GET for simple text embedding (for testing)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const text = searchParams.get('text');
  const type = searchParams.get('type') || 'default';

  if (!text) {
    return NextResponse.json(
      { error: "Text parameter is required" },
      { status: 400 }
    );
  }

  // Forward to POST handler
  return POST(new NextRequest(req.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, type })
  }));
} 