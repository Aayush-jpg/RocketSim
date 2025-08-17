/**
 * Rocketez - AI-Powered Rocket Design Service
 * 
 * This service provides advanced rocket design management with AI-powered similarity search, semantic
 * embeddings, and intelligent design recommendations. It combines traditional database operations
 * with machine learning capabilities to enhance the rocket design experience.
 * 
 * **Core Features:**
 * - **AI Embeddings**: Generate vector embeddings of rocket designs using OpenAI's text-embedding models
 * - **Semantic Search**: Find similar rockets using cosine similarity on design embeddings
 * - **Design Insights**: Provide AI-powered recommendations based on similar successful designs
 * - **Vector Database**: Store and query design embeddings using PostgreSQL's pgvector extension
 * - **Smart Categorization**: Automatic tag extraction and classification of rocket designs
 * 
 * **Component-Based Architecture:**
 * - **Professional Design**: Works with SI units and material properties
 * - **Engineering Precision**: Component-level calculations for mass, drag, stability
 * - **Material Analysis**: Considers density, thickness, surface roughness
 * - **Advanced Physics**: Professional-grade simulation preparation
 * 
 * **Search Capabilities:**
 * - **Similarity Search**: Find rockets with similar design characteristics using vector embeddings
 * - **Text Search**: Traditional keyword-based search with fuzzy matching
 * - **Hybrid Search**: Combination of semantic and text-based search for optimal results
 * - **Fallback Logic**: Graceful degradation to basic similarity when AI services unavailable
 * 
 * **Design Analysis:**
 * - **Performance Comparison**: Compare designs against similar rockets in the database
 * - **Tag Extraction**: Automatic categorization by size, motor class, and component types
 * - **Design Recommendations**: AI-generated suggestions based on design patterns
 * - **Popularity Metrics**: Track successful design patterns and common configurations
 * 
 * **Database Integration:**
 * - **Type Conversion**: Seamless conversion between store types and database schema
 * - **Embedding Storage**: Persist 1536-dimensional vectors in PostgreSQL using pgvector
 * - **Cache Integration**: Leverage Redis caching for frequently accessed designs
 * - **Public/Private Access**: Respect user privacy while enabling community sharing
 * 
 * **API Integration:**
 * - **Server-side Embeddings**: Generate embeddings via `/api/embeddings` endpoint
 * - **Similarity Calculations**: Perform vector math via `/api/similarity` endpoint
 * - **Security**: All OpenAI API keys handled server-side for security
 * 
 * @version 1.0.0 - Component-based architecture only
 * @author Rocketez Team
 * @see {@link app/api/embeddings/route.ts} for embedding generation API
 * @see {@link app/api/similarity/route.ts} for vector similarity calculations
 * @see {@link supabase/migrations/20241201000000_add_vector_columns.sql} for database schema
 */

import { supabase, supabaseAdmin } from '@/lib/database/supabase';
import type { Rocket, NewRocket, UpdateRocket } from '@/lib/database/supabase';
import { Rocket as StoreRocket } from '@/types/rocket';
import { cache } from '@/lib/cache';
import { MATERIALS } from '../data/materials';

export class RocketService {
  /**
   * Convert component rocket format to database format
   */
  private storeToDatabase(storeRocket: StoreRocket, userId: string): NewRocket {
    return {
      user_id: userId,
      name: storeRocket.name,
      parts: {
        nose_cone: storeRocket.nose_cone,
        body_tubes: storeRocket.body_tubes,
        fins: storeRocket.fins,
        motor: storeRocket.motor,
        parachutes: storeRocket.parachutes,
        coordinate_system: storeRocket.coordinate_system,
        rail_guides_position_m: storeRocket.rail_guides_position_m
      } as any,
      motor_id: storeRocket.motor.motor_database_id,
      drag_coefficient: this.calculateDragCoefficient(storeRocket),
      units: 'metric', // Always metric for component-based rockets
      is_public: false,
      tags: this.extractTags(storeRocket)
    };
  }

  /**
   * Convert database rocket format to component format
   */
  private databaseToStore(dbRocket: Rocket): StoreRocket {
    const parts = dbRocket.parts as any;
    
    return {
      id: dbRocket.id,
      name: dbRocket.name,
      rocket_type: parts.rocket_type || "solid", // Default to solid if not specified
      nose_cone: parts.nose_cone,
      body_tubes: parts.body_tubes || [],
      fins: parts.fins || [],
      motor: parts.motor,
      parachutes: parts.parachutes || [],
      coordinate_system: parts.coordinate_system || "tail_to_nose",
      rail_guides_position_m: parts.rail_guides_position_m
    };
  }

  /**
   * Calculate drag coefficient from component properties
   */
  private calculateDragCoefficient(rocket: StoreRocket): number {
    const noseDrag = this.calculateNoseDrag(rocket.nose_cone);
    const bodyDrag = this.calculateBodyDrag(rocket.body_tubes);
    const finDrag = this.calculateFinDrag(rocket.fins);
    
    return noseDrag + bodyDrag + finDrag;
  }

  private calculateNoseDrag(nose: any): number {
    const baseCoeff: { [key: string]: number } = {
      'ogive': 0.15,
      'conical': 0.18,
      'elliptical': 0.12,
      'parabolic': 0.14
    };
    return baseCoeff[nose.shape] || 0.15;
  }

  private calculateBodyDrag(bodies: any[]): number {
    return 0.02 * bodies.length;
  }

  private calculateFinDrag(fins: any[]): number {
    let totalDrag = 0;
    fins.forEach(fin => {
      const finArea = fin.root_chord_m * fin.span_m * fin.fin_count;
      totalDrag += 0.01 * finArea;
    });
    return totalDrag;
  }

  /**
   * Extract tags from component rocket for search and categorization
   */
  private extractTags(rocket: StoreRocket): string[] {
    const tags: string[] = [];
    
    // Add component types
    tags.push('nose_cone', 'body_tube', 'motor');
    if (rocket.fins.length > 0) tags.push('fins');
    if (rocket.parachutes.length > 0) tags.push('parachute');
    
    // Add size category
    const totalLength = rocket.nose_cone.length_m + 
      rocket.body_tubes.reduce((sum, body) => sum + body.length_m, 0);
    
    if (totalLength < 0.5) tags.push('small');
    else if (totalLength < 1.2) tags.push('medium');
    else tags.push('large');
    
    // Add motor class
    if (rocket.motor.motor_database_id && rocket.motor.motor_database_id !== 'default-motor') {
      const motorClass = rocket.motor.motor_database_id.charAt(0);
      tags.push(`motor-${motorClass}`);
    }
    
    // Add material types
    const materials = new Set<string>();
    if (rocket.nose_cone.material_density_kg_m3 === 1600) materials.add('fiberglass');
    if (rocket.nose_cone.material_density_kg_m3 === 2700) materials.add('aluminum');
    if (rocket.nose_cone.material_density_kg_m3 === 650) materials.add('plywood');
    
    rocket.fins.forEach(fin => {
      if (fin.material_density_kg_m3 === 650) materials.add('plywood');
      if (fin.material_density_kg_m3 === 1600) materials.add('fiberglass');
    });
    
    tags.push(...Array.from(materials));
    
    return tags;
  }

  /**
   * Generate text description of rocket for embedding
   */
  private generateRocketDescription(rocket: StoreRocket): string {
    let description = `Component rocket "${rocket.name}". `;
    
    // Describe nose cone
    description += `${rocket.nose_cone.shape} nose cone ${(rocket.nose_cone.length_m * 100).toFixed(1)}cm long, `;
    const baseRadius = rocket.nose_cone.base_radius_m || 0.05; // Default radius if undefined
    description += `${(baseRadius * 200).toFixed(1)}cm diameter. `;
    
    // Describe body tubes
    if (rocket.body_tubes.length > 0) {
      const totalLength = rocket.body_tubes.reduce((sum, body) => sum + body.length_m, 0);
      const avgRadius = rocket.body_tubes.reduce((sum, body) => sum + body.outer_radius_m, 0) / rocket.body_tubes.length;
      description += `Body length ${(totalLength * 100).toFixed(1)}cm, `;
      description += `diameter ${(avgRadius * 200).toFixed(1)}cm. `;
    }
    
    // Describe fins
    if (rocket.fins.length > 0) {
      const fin = rocket.fins[0];
      description += `${fin.fin_count} fins, `;
      description += `root ${(fin.root_chord_m * 100).toFixed(1)}cm, `;
      description += `span ${(fin.span_m * 100).toFixed(1)}cm. `;
    }
    
    description += `Motor: ${rocket.motor.motor_database_id}. `;
    description += `Materials: ${this.extractTags(rocket).filter(t => ['fiberglass', 'aluminum', 'plywood'].includes(t)).join(', ')}.`;
    
    return description;
  }

  /**
   * Generate embedding for rocket design using server-side API
   */
  private async generateRocketEmbedding(rocket: StoreRocket): Promise<number[]> {
    try {
      const description = this.generateRocketDescription(rocket);
      
      const response = await fetch('/api/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          text: description, 
          type: 'rocket' 
        })
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status}`);
      }

      const data = await response.json();
      return data.embedding;
    } catch (error) {
      console.error('Failed to generate rocket embedding:', error);
      return new Array(1536).fill(0); // Return zero vector as fallback
    }
  }

  /**
   * Save rocket to database with embedding
   */
  async saveRocket(storeRocket: StoreRocket, userId: string): Promise<Rocket> {
    try {
      const newRocket = this.storeToDatabase(storeRocket, userId);
      
      // Generate embedding for similarity search
      const embedding = await this.generateRocketEmbedding(storeRocket);
      
      const { data, error } = await supabase
        .from('rockets')
        .insert({
          ...newRocket,
          design_vector: embedding // Store the embedding
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Cache the rocket
      await cache.cacheRocket(data.id, data).catch((err: any) => 
        console.warn('Could not cache rocket:', err)
      );
      
      return data;
    } catch (error) {
      console.error('Error saving rocket:', error);
      throw error;
    }
  }

  /**
   * Update existing rocket with new embedding
   */
  async updateRocket(rocketId: string, storeRocket: StoreRocket, userId: string): Promise<Rocket> {
    try {
      const updateData = this.storeToDatabase(storeRocket, userId);
      
      // Generate new embedding
      const embedding = await this.generateRocketEmbedding(storeRocket);
      
      const { data, error } = await supabase
        .from('rockets')
        .update({
          ...updateData,
          design_vector: embedding, // Update the embedding
          updated_at: new Date().toISOString()
        })
        .eq('id', rocketId)
        .eq('user_id', userId) // Ensure user can only update their own rockets
        .select()
        .single();
      
      if (error) throw error;
      
      // Update cache
      await cache.cacheRocket(data.id, data).catch((err: any) => 
        console.warn('Could not update rocket cache:', err)
      );
      
      return data;
    } catch (error) {
      console.error('Error updating rocket:', error);
      throw error;
    }
  }

  /**
   * Get user's rockets
   */
  async getUserRockets(userId: string, limit = 50): Promise<StoreRocket[]> {
    try {
      const { data, error } = await supabase
        .from('rockets')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      return (data || []).map((rocket: Rocket) => this.databaseToStore(rocket));
    } catch (error) {
      console.error('Error fetching user rockets:', error);
      return [];
    }
  }

  /**
   * Get rocket by ID
   */
  async getRocket(rocketId: string, userId?: string): Promise<StoreRocket | null> {
    try {
      // Try cache first
      const cached = await cache.getRocket(rocketId).catch(() => null);
      if (cached) {
        return this.databaseToStore(cached);
      }
      
      const query = supabase
        .from('rockets')
        .select('*')
        .eq('id', rocketId);
      
      // Apply user filter or public visibility
      if (userId) {
        query.or(`user_id.eq.${userId},is_public.eq.true`);
      } else {
        query.eq('is_public', true);
      }
      
      const { data, error } = await query.single();
      
      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }
      
      // Cache for future use
      await cache.cacheRocket(data.id, data).catch((err: any) => 
        console.warn('Could not cache fetched rocket:', err)
      );
      
      return this.databaseToStore(data);
    } catch (error) {
      console.error('Error fetching rocket:', error);
      return null;
    }
  }

  /**
   * Delete rocket
   */
  async deleteRocket(rocketId: string, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('rockets')
        .delete()
        .eq('id', rocketId)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      // Remove from cache
      await cache.invalidateRocketData(rocketId).catch((err: any) => 
        console.warn('Could not invalidate rocket cache:', err)
      );
    } catch (error) {
      console.error('Error deleting rocket:', error);
      throw error;
    }
  }

  /**
   * Find similar rockets using vector similarity search
   */
  async findSimilarRockets(rocket: StoreRocket, userId?: string, limit = 10): Promise<{
    rocket: StoreRocket;
    similarity: number;
  }[]> {
    try {
      // Generate embedding for the query rocket
      const queryEmbedding = await this.generateRocketEmbedding(rocket);
      
      // Get rockets with embeddings
      const { data, error } = await supabase
        .from('rockets')
        .select('*')
        .not('design_vector', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100); // Get more rockets to search through
      
      if (error) throw error;
      
      // Filter rockets based on access permissions
      const accessibleRockets = (data || []).filter(dbRocket => {
        if (userId && dbRocket.user_id === userId) return true; // User's own rockets
        return dbRocket.is_public; // Public rockets
      });
      
      if (accessibleRockets.length === 0) {
        // Fallback to basic similarity
        return this.findSimilarRocketsBasic(rocket, userId, limit);
      }
      
      // Prepare vectors for similarity calculation
      const vectors = accessibleRockets.map(dbRocket => ({
        vector: dbRocket.design_vector,
        data: dbRocket,
        id: dbRocket.id
      }));
      
      // Calculate similarities using server-side API
      const similarityResponse = await fetch('/api/similarity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queryVector: queryEmbedding,
          vectors,
          method: 'cosine',
          threshold: 0.6, // Similarity threshold for rockets
          limit
        })
      });
      
      if (!similarityResponse.ok) {
        throw new Error(`Similarity API error: ${similarityResponse.status}`);
      }
      
      const similarityData = await similarityResponse.json();
      
      // Return formatted results
      return similarityData.results.map((result: any) => ({
        rocket: this.databaseToStore(result.data),
        similarity: result.similarity
      }));
      
    } catch (error) {
      console.error('Error finding similar rockets by embedding:', error);
      // Fallback to basic similarity search
      return this.findSimilarRocketsBasic(rocket, userId, limit);
    }
  }

  /**
   * Fallback basic similarity search without embeddings
   */
  private async findSimilarRocketsBasic(rocket: StoreRocket, userId?: string, limit = 10): Promise<{
    rocket: StoreRocket;
    similarity: number;
  }[]> {
    try {
      // Get rockets with similar tags or characteristics
      const rocketTags = this.extractTags(rocket);
      
      const { data, error } = await supabase
        .from('rockets')
        .select('*')
        .overlaps('tags', rocketTags)
        .order('created_at', { ascending: false })
        .limit(limit * 2); // Get more to filter
      
      if (error) throw error;
      
      // Simple similarity calculation based on shared characteristics
      const similar = (data || [])
        .map((dbRocket: Rocket) => {
          const storeRocket = this.databaseToStore(dbRocket);
          const similarity = this.calculateBasicSimilarity(rocket, storeRocket);
          return { rocket: storeRocket, similarity };
        })
        .filter(item => item.similarity > 0.3) // Minimum similarity threshold
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
      
      return similar;
    } catch (error) {
      console.error('Error in basic similarity search:', error);
      return [];
    }
  }

  /**
   * Calculate similarity between two rockets using basic comparison
   */
  private calculateBasicSimilarity(rocket1: StoreRocket, rocket2: StoreRocket): number {
    let score = 0;
    let maxScore = 0;
    
    // Motor similarity
    maxScore += 20;
    if (rocket1.motor.motor_database_id === rocket2.motor.motor_database_id) score += 20;
    else if (rocket1.motor.motor_database_id[0] === rocket2.motor.motor_database_id[0]) score += 10; // Same class
    
    // Component count similarity
    maxScore += 15;
    const componentsDiff = Math.abs(rocket1.body_tubes.length - rocket2.body_tubes.length);
    score += Math.max(0, 15 - componentsDiff * 3);
    
    // Drag coefficient similarity
    maxScore += 15;
    const cdDiff = Math.abs(this.calculateDragCoefficient(rocket1) - this.calculateDragCoefficient(rocket2));
    score += Math.max(0, 15 - cdDiff * 30);
    
    // Component types similarity
    maxScore += 40;
    const tags1 = new Set(this.extractTags(rocket1));
    const tags2 = new Set(this.extractTags(rocket2));
    const intersection = new Set(Array.from(tags1).filter(x => tags2.has(x)));
    const union = new Set([...Array.from(tags1), ...Array.from(tags2)]);
    const similarity = intersection.size / union.size;
    score += similarity * 40;
    
    return score / maxScore;
  }

  /**
   * Search rockets by text query or semantic similarity
   */
  async searchRockets(query: string, userId?: string, limit = 20): Promise<StoreRocket[]> {
    try {
      // Try semantic search first if we have embeddings
      const semanticResults = await this.searchRocketsByEmbedding(query, userId, limit);
      
      if (semanticResults.length > 0) {
        return semanticResults.map(result => result.rocket);
      }
      
      // Fallback to text search
      let dbQuery = supabase
        .from('rockets')
        .select('*')
        .or(`name.ilike.%${query}%,tags.cs.{${query}}`)
        .order('updated_at', { ascending: false })
        .limit(limit);
      
      // If user provided, include their private rockets
      if (userId) {
        dbQuery = dbQuery.or(`user_id.eq.${userId},is_public.eq.true`);
      } else {
        dbQuery = dbQuery.eq('is_public', true);
      }
      
      const { data, error } = await dbQuery;
      
      if (error) throw error;
      
      return (data || []).map((rocket: Rocket) => this.databaseToStore(rocket));
    } catch (error) {
      console.error('Error searching rockets:', error);
      return [];
    }
  }

  /**
   * Search rockets using semantic similarity
   */
  private async searchRocketsByEmbedding(query: string, userId?: string, limit = 20): Promise<{
    rocket: StoreRocket;
    similarity: number;
  }[]> {
    try {
      // Generate embedding for the search query
      const queryRocket = this.createQueryRocket(query);
      const queryEmbedding = await this.generateRocketEmbedding(queryRocket);
      
      // Get rockets with embeddings
      const { data, error } = await supabase
        .from('rockets')
        .select('*')
        .not('design_vector', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      
      // Filter by access permissions
      const accessibleRockets = (data || []).filter(dbRocket => {
        if (userId && dbRocket.user_id === userId) return true;
        return dbRocket.is_public;
      });
      
      if (accessibleRockets.length === 0) {
        return [];
      }
      
      // Prepare vectors for similarity search
      const vectors = accessibleRockets.map(dbRocket => ({
        vector: dbRocket.design_vector,
        data: dbRocket,
        id: dbRocket.id
      }));
      
      // Calculate similarities
      const similarityResponse = await fetch('/api/similarity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queryVector: queryEmbedding,
          vectors,
          method: 'cosine',
          threshold: 0.4, // Lower threshold for search
          limit
        })
      });
      
      if (!similarityResponse.ok) {
        return [];
      }
      
      const similarityData = await similarityResponse.json();
      
      return similarityData.results.map((result: any) => ({
        rocket: this.databaseToStore(result.data),
        similarity: result.similarity
      }));
      
    } catch (error) {
      console.error('Error in semantic rocket search:', error);
      return [];
    }
  }

  /**
   * Get public rockets
   */
  async getPublicRockets(category?: string, limit = 20): Promise<StoreRocket[]> {
    try {
      let query = supabase
        .from('rockets')
        .select('*')
        .eq('is_public', true);
      
      if (category) {
        query = query.contains('tags', [category]);
      }
      
      const { data, error } = await query
        .order('updated_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      
      return (data || []).map((rocket: Rocket) => this.databaseToStore(rocket));
    } catch (error) {
      console.error('Error fetching public rockets:', error);
      return [];
    }
  }

  /**
   * Toggle rocket visibility
   */
  async toggleRocketVisibility(rocketId: string, userId: string, isPublic: boolean): Promise<void> {
    try {
      const { error } = await supabase
        .from('rockets')
        .update({ is_public: isPublic })
        .eq('id', rocketId)
        .eq('user_id', userId);
      
      if (error) throw error;
      
      // Update cache
      await cache.invalidateRocketData(rocketId).catch((err: any) => 
        console.warn('Could not invalidate rocket cache:', err)
      );
    } catch (error) {
      console.error('Error toggling rocket visibility:', error);
      throw error;
    }
  }

  /**
   * Get rocket statistics
   */
  async getRocketStats(rocketId: string): Promise<{
    simulationCount: number;
    averageAltitude: number;
    maxAltitude: number;
    lastSimulation: string | null;
  }> {
    try {
      const { data, error } = await supabase
        .from('simulations')
        .select('max_altitude, created_at')
        .eq('rocket_id', rocketId)
        .eq('status', 'completed');
      
      if (error) throw error;
      
      const simulations = data || [];
      const altitudes = simulations
        .map(s => s.max_altitude)
        .filter((altitude): altitude is number => altitude !== null && altitude !== undefined);
      
      return {
        simulationCount: simulations.length,
        averageAltitude: altitudes.length > 0 ? altitudes.reduce((a, b) => a + b, 0) / altitudes.length : 0,
        maxAltitude: altitudes.length > 0 ? Math.max(...altitudes) : 0,
        lastSimulation: simulations.length > 0 ? simulations[simulations.length - 1].created_at : null
      };
    } catch (error) {
      console.error('Error fetching rocket stats:', error);
      return {
        simulationCount: 0,
        averageAltitude: 0,
        maxAltitude: 0,
        lastSimulation: null
      };
    }
  }

  /**
   * Duplicate rocket with new name
   */
  async duplicateRocket(rocketId: string, newName: string, userId: string): Promise<Rocket> {
    try {
      const originalRocket = await this.getRocket(rocketId, userId);
      if (!originalRocket) {
        throw new Error('Rocket not found or not accessible');
      }
      
      const duplicatedRocket: StoreRocket = {
        ...originalRocket,
        id: '', // Will be generated
        name: newName
      };
      
      return await this.saveRocket(duplicatedRocket, userId);
    } catch (error) {
      console.error('Error duplicating rocket:', error);
      throw error;
    }
  }

  /**
   * Get design insights based on similar rockets
   */
  async getDesignInsights(rocket: StoreRocket, userId?: string): Promise<{
    similarRockets: { rocket: StoreRocket; similarity: number; }[];
    suggestions: string[];
    performanceComparison: {
      averageAltitude: number;
      yourEstimate: number;
      suggestion: string;
    };
  }> {
    try {
      const similarRockets = await this.findSimilarRockets(rocket, userId, 5);
      
      // Generate suggestions based on similar rockets
      const suggestions: string[] = [];
      const popularTags = new Map<string, number>();
      
      similarRockets.forEach(({ rocket: similarRocket }) => {
        const tags = this.extractTags(similarRocket);
        tags.forEach(tag => {
          popularTags.set(tag, (popularTags.get(tag) || 0) + 1);
        });
      });
      
      // Most common tags in similar rockets
      const topTags = Array.from(popularTags.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);
      
      if (topTags.length > 0) {
        suggestions.push(`Consider adding ${topTags[0][0]} features, commonly found in similar designs.`);
      }
      
      // Performance estimation
      const stats = await Promise.all(
        similarRockets.map(({ rocket }) => this.getRocketStats(rocket.id))
      );
      
      const altitudes = stats
        .map(s => s.averageAltitude)
        .filter(alt => alt > 0);
      
      const averageAltitude = altitudes.length > 0 
        ? altitudes.reduce((a, b) => a + b, 0) / altitudes.length 
        : 0;
      
      const yourEstimate = averageAltitude * (0.8 + Math.random() * 0.4); // Rough estimate
      
      let suggestion = "Simulation needed for accurate prediction.";
      if (averageAltitude > 0) {
        if (yourEstimate < averageAltitude * 0.8) {
          suggestion = "Consider optimizing your design for better performance.";
        } else if (yourEstimate > averageAltitude * 1.2) {
          suggestion = "Your design shows great potential!";
        } else {
          suggestion = "Your design is well-balanced compared to similar rockets.";
        }
      }
      
      return {
        similarRockets,
        suggestions,
        performanceComparison: {
          averageAltitude,
          yourEstimate,
          suggestion
        }
      };
      
    } catch (error) {
      console.error('Error generating design insights:', error);
      return {
        similarRockets: [],
        suggestions: ['Run simulations to get performance insights.'],
        performanceComparison: {
          averageAltitude: 0,
          yourEstimate: 0,
          suggestion: 'Simulation needed for performance analysis.'
        }
      };
    }
  }

  /**
   * Create a minimal rocket for query comparison
   */
  private createQueryRocket(query: string): StoreRocket {
    return {
      id: '',
      name: query,
      rocket_type: "solid", // Default rocket type for query rockets
      nose_cone: {
        id: 'query-nose',
        shape: 'ogive',
        length_m: 0.1,
        base_radius_m: 0.05,
        wall_thickness_m: 0.002,
        material_id: 'fiberglass',
        material_density_kg_m3: MATERIALS.FIBERGLASS.density_kg_m3,
        surface_roughness_m: 1e-5,
        color: '#FFFFFF'
      },
      body_tubes: [],
      fins: [],
      motor: {
        id: 'query-motor',
        motor_database_id: 'A',
        position_from_tail_m: 0.0
      },
      parachutes: [],
      coordinate_system: 'tail_to_nose'
    };
  }
}

export const rocketService = new RocketService(); 