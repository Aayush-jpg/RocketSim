import { NextRequest, NextResponse } from "next/server";

/**
 * Calculate cosine similarity between two vectors
 */
function calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) return 0;
  
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }
  
  if (norm1 === 0 || norm2 === 0) return 0;
  
  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * Calculate Euclidean distance between two vectors
 */
function calculateEuclideanDistance(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) return Infinity;
  
  let sum = 0;
  for (let i = 0; i < vec1.length; i++) {
    const diff = vec1[i] - vec2[i];
    sum += diff * diff;
  }
  
  return Math.sqrt(sum);
}

/**
 * Calculate Manhattan distance between two vectors
 */
function calculateManhattanDistance(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) return Infinity;
  
  let sum = 0;
  for (let i = 0; i < vec1.length; i++) {
    sum += Math.abs(vec1[i] - vec2[i]);
  }
  
  return sum;
}

export async function POST(req: NextRequest) {
  try {
    const { 
      queryVector, 
      vectors, 
      method = "cosine",
      threshold = 0.7,
      limit = 10 
    } = await req.json();

    // Validate input
    if (!queryVector || !Array.isArray(queryVector)) {
      return NextResponse.json(
        { error: "Query vector is required and must be an array" },
        { status: 400 }
      );
    }

    if (!vectors || !Array.isArray(vectors)) {
      return NextResponse.json(
        { error: "Vectors array is required" },
        { status: 400 }
      );
    }

    if (vectors.length === 0) {
      return NextResponse.json({
        results: [],
        method,
        threshold,
        processed: 0
      });
    }

    // Calculate similarities/distances
    const results = vectors.map((item, index) => {
      const vector = item.vector || item.embedding || item;
      
      if (!Array.isArray(vector)) {
        console.warn(`Invalid vector at index ${index}`);
        return null;
      }

      let score: number;
      let similarity: number;

      switch (method) {
        case "cosine":
          score = calculateCosineSimilarity(queryVector, vector);
          similarity = score; // Cosine similarity is already 0-1
          break;
        case "euclidean":
          score = calculateEuclideanDistance(queryVector, vector);
          // Convert distance to similarity (0-1, where 1 is most similar)
          similarity = 1 / (1 + score);
          break;
        case "manhattan":
          score = calculateManhattanDistance(queryVector, vector);
          // Convert distance to similarity
          similarity = 1 / (1 + score / 100); // Scaled for Manhattan distance
          break;
        default:
          score = calculateCosineSimilarity(queryVector, vector);
          similarity = score;
      }

      return {
        index,
        score,
        similarity,
        data: item.data || item.metadata || null,
        id: item.id || index
      };
    }).filter(result => result !== null && result.similarity >= threshold);

    // Sort by similarity (highest first) and limit results
    const sortedResults = results
      .sort((a, b) => b!.similarity - a!.similarity)
      .slice(0, limit);

    return NextResponse.json({
      results: sortedResults,
      method,
      threshold,
      processed: vectors.length,
      returned: sortedResults.length,
      queryVectorLength: queryVector.length,
      averageSimilarity: sortedResults.length > 0 
        ? sortedResults.reduce((sum, r) => sum + r!.similarity, 0) / sortedResults.length 
        : 0
    });

  } catch (error: any) {
    console.error('Similarity calculation error:', error);
    return NextResponse.json(
      { error: "Failed to calculate similarity", details: error.message },
      { status: 500 }
    );
  }
}

// Support batch similarity calculation
export async function PUT(req: NextRequest) {
  try {
    const { queries, vectors, method = "cosine", threshold = 0.7, limit = 10 } = await req.json();

    if (!queries || !Array.isArray(queries)) {
      return NextResponse.json(
        { error: "Queries array is required" },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      queries.map(async (queryVector, queryIndex) => {
        const response = await POST(new NextRequest(req.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queryVector, vectors, method, threshold, limit })
        }));
        
        const data = await response.json();
        return {
          queryIndex,
          ...data
        };
      })
    );

    return NextResponse.json({
      batchResults: results,
      totalQueries: queries.length,
      method,
      threshold,
      limit
    });

  } catch (error: any) {
    console.error('Batch similarity calculation error:', error);
    return NextResponse.json(
      { error: "Failed to calculate batch similarity", details: error.message },
      { status: 500 }
    );
  }
}

// GET endpoint for testing with simple parameters
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const method = searchParams.get('method') || 'cosine';
  const threshold = parseFloat(searchParams.get('threshold') || '0.7');
  const limit = parseInt(searchParams.get('limit') || '10');

  return NextResponse.json({
    endpoint: '/api/similarity',
    supportedMethods: ['cosine', 'euclidean', 'manhattan'],
    defaultMethod: method,
    defaultThreshold: threshold,
    defaultLimit: limit,
    usage: {
      POST: "Calculate similarity between a query vector and an array of vectors",
      PUT: "Batch similarity calculation for multiple queries",
      body: {
        queryVector: "number[] - The query vector",
        vectors: "Array of vectors or objects with vector/embedding property",
        method: "string - similarity method (cosine, euclidean, manhattan)",
        threshold: "number - minimum similarity threshold (0-1)",
        limit: "number - maximum results to return"
      }
    }
  });
} 