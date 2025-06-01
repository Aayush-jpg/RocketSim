import { Redis } from '@upstash/redis';
import type { Rocket, Simulation, WeatherCache } from '@/lib/database/supabase';

// In-memory cache as fallback
class MemoryCache {
  private cache = new Map<string, { data: any; expiry: number }>();

  set(key: string, value: any, ttl: number): void {
    const expiry = Date.now() + (ttl * 1000);
    this.cache.set(key, { data: value, expiry });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  del(key: string): void {
    this.cache.delete(key);
  }

  keys(pattern: string): string[] {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.cache.keys()).filter(key => regex.test(key));
  }

  clear(): void {
    this.cache.clear();
  }
}

// Initialize cache client with fallback
let cacheClient: Redis | MemoryCache;

try {
  // Try to initialize Redis if environment variables are available
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    cacheClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    console.log('Using Redis cache');
  } else {
    throw new Error('Redis credentials not found');
  }
} catch (error: any) {
  console.warn('Redis not available, using memory cache:', error.message);
  cacheClient = new MemoryCache();
}

// Cache adapter that works with both Redis and MemoryCache
class CacheAdapter {
  async setex(key: string, ttl: number, value: string): Promise<void> {
    if (cacheClient instanceof Redis) {
      await cacheClient.setex(key, ttl, value);
    } else {
      cacheClient.set(key, value, ttl);
    }
  }

  async get(key: string): Promise<string | null> {
    if (cacheClient instanceof Redis) {
      return await cacheClient.get(key) as string | null;
    } else {
      return cacheClient.get(key);
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (cacheClient instanceof Redis) {
      await cacheClient.del(...keys);
    } else {
      keys.forEach(key => cacheClient.del(key));
    }
  }

  async keys(pattern: string): Promise<string[]> {
    if (cacheClient instanceof Redis) {
      return await cacheClient.keys(pattern);
    } else {
      return cacheClient.keys(pattern);
    }
  }
}

const cacheAdapter = new CacheAdapter();

export class CacheService {
  private readonly TTL = {
    WEATHER: 1800,        // 30 minutes
    LOCATION: 300,        // 5 minutes  
    SIMULATION: 3600,     // 1 hour
    ROCKET: 1800,         // 30 minutes
    SESSION: 86400,       // 24 hours
    MOTOR: 7200,          // 2 hours
    ANALYSIS: 3600,       // 1 hour
  };

  /**
   * Weather caching
   */
  async cacheWeather(locationKey: string, data: any, source: string = 'default'): Promise<void> {
    try {
      const key = `weather:${locationKey}:${source}`;
      await cacheAdapter.setex(key, this.TTL.WEATHER, JSON.stringify(data));
    } catch (error) {
      console.warn('Cache weather failed:', error);
    }
  }

  async getWeather(locationKey: string, source: string = 'default'): Promise<any | null> {
    try {
      const key = `weather:${locationKey}:${source}`;
      const cached = await cacheAdapter.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn('Get weather cache failed:', error);
      return null;
    }
  }

  /**
   * Location data caching (for reverse geocoding, elevation, etc.)
   */
  async cacheLocation(lat: number, lon: number, data: any): Promise<void> {
    try {
      const key = `location:${lat.toFixed(3)},${lon.toFixed(3)}`;
      await cacheAdapter.setex(key, this.TTL.LOCATION, JSON.stringify(data));
    } catch (error) {
      console.warn('Cache location failed:', error);
    }
  }

  async getLocation(lat: number, lon: number): Promise<any | null> {
    try {
      const key = `location:${lat.toFixed(3)},${lon.toFixed(3)}`;
      const cached = await cacheAdapter.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn('Get location cache failed:', error);
      return null;
    }
  }

  /**
   * Simulation result caching
   */
  async cacheSimulation(rocketHash: string, result: any): Promise<void> {
    try {
      const key = `sim:${rocketHash}`;
      await cacheAdapter.setex(key, this.TTL.SIMULATION, JSON.stringify(result));
    } catch (error) {
      console.warn('Cache simulation failed:', error);
    }
  }

  async getSimulation(rocketHash: string): Promise<any | null> {
    try {
      const key = `sim:${rocketHash}`;
      const cached = await cacheAdapter.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn('Get simulation cache failed:', error);
      return null;
    }
  }

  async deleteSimulation(rocketHash: string): Promise<void> {
    try {
      const key = `sim:${rocketHash}`;
      await cacheAdapter.del(key);
    } catch (error) {
      console.warn('Delete simulation cache failed:', error);
    }
  }

  /**
   * Rocket data caching
   */
  async cacheRocket(rocketId: string, rocket: Rocket): Promise<void> {
    try {
      const key = `rocket:${rocketId}`;
      await cacheAdapter.setex(key, this.TTL.ROCKET, JSON.stringify(rocket));
    } catch (error) {
      console.warn('Cache rocket failed:', error);
    }
  }

  async getRocket(rocketId: string): Promise<Rocket | null> {
    try {
      const key = `rocket:${rocketId}`;
      const cached = await cacheAdapter.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn('Get rocket cache failed:', error);
      return null;
    }
  }

  async deleteRocket(rocketId: string): Promise<void> {
    try {
      const key = `rocket:${rocketId}`;
      await cacheAdapter.del(key);
    } catch (error) {
      console.warn('Delete rocket cache failed:', error);
    }
  }

  /**
   * User session management
   */
  async setSession(sessionId: string, data: any, ttl?: number): Promise<void> {
    try {
      const key = `session:${sessionId}`;
      await cacheAdapter.setex(key, ttl || this.TTL.SESSION, JSON.stringify(data));
    } catch (error) {
      console.warn('Set session cache failed:', error);
    }
  }

  async getSession(sessionId: string): Promise<any | null> {
    try {
      const key = `session:${sessionId}`;
      const cached = await cacheAdapter.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn('Get session cache failed:', error);
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const key = `session:${sessionId}`;
      await cacheAdapter.del(key);
    } catch (error) {
      console.warn('Delete session cache failed:', error);
    }
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      const key = `session:${sessionId}`;
      const session = await this.getSession(sessionId);
      if (session) {
        session.lastActivity = new Date().toISOString();
        await this.setSession(sessionId, session);
      }
    } catch (error) {
      console.warn('Update session activity failed:', error);
    }
  }

  /**
   * Motor data caching
   */
  async cacheMotor(motorId: string, motorData: any): Promise<void> {
    try {
      const key = `motor:${motorId}`;
      await cacheAdapter.setex(key, this.TTL.MOTOR, JSON.stringify(motorData));
    } catch (error) {
      console.warn('Cache motor failed:', error);
    }
  }

  async getMotor(motorId: string): Promise<any | null> {
    try {
      const key = `motor:${motorId}`;
      const cached = await cacheAdapter.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn('Get motor cache failed:', error);
      return null;
    }
  }

  async cacheMotorList(category: string, motors: any[]): Promise<void> {
    try {
      const key = `motors:${category}`;
      await cacheAdapter.setex(key, this.TTL.MOTOR, JSON.stringify(motors));
    } catch (error) {
      console.warn('Cache motor list failed:', error);
    }
  }

  async getMotorList(category: string): Promise<any[] | null> {
    try {
      const key = `motors:${category}`;
      const cached = await cacheAdapter.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn('Get motor list cache failed:', error);
      return null;
    }
  }

  /**
   * Analysis result caching
   */
  async cacheAnalysis(rocketId: string, analysisType: string, result: any): Promise<void> {
    try {
      const key = `analysis:${rocketId}:${analysisType}`;
      await cacheAdapter.setex(key, this.TTL.ANALYSIS, JSON.stringify(result));
    } catch (error) {
      console.warn('Cache analysis failed:', error);
    }
  }

  async getAnalysis(rocketId: string, analysisType: string): Promise<any | null> {
    try {
      const key = `analysis:${rocketId}:${analysisType}`;
      const cached = await cacheAdapter.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.warn('Get analysis cache failed:', error);
      return null;
    }
  }

  async deleteAnalysis(rocketId: string, analysisType?: string): Promise<void> {
    try {
      if (analysisType) {
        const key = `analysis:${rocketId}:${analysisType}`;
        await cacheAdapter.del(key);
      } else {
        // Delete all analysis for this rocket
        const pattern = `analysis:${rocketId}:*`;
        const keys = await cacheAdapter.keys(pattern);
        if (keys.length > 0) {
          await cacheAdapter.del(...keys);
        }
      }
    } catch (error) {
      console.warn('Delete analysis cache failed:', error);
    }
  }

  /**
   * Rate limiting
   */
  async checkRateLimit(identifier: string, limit: number, window: number): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    try {
      const key = `rate:${identifier}`;
      const now = Date.now();
      const windowStart = Math.floor(now / (window * 1000)) * window * 1000;
      
      const current = parseInt(await cacheAdapter.get(key) || '0');
      
      if (current >= limit) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: windowStart + window * 1000
        };
      }
      
      // Increment counter
      await cacheAdapter.setex(key, window, (current + 1).toString());
      
      return {
        allowed: true,
        remaining: limit - current - 1,
        resetTime: windowStart + window * 1000
      };
    } catch (error) {
      console.warn('Rate limit check failed:', error);
      // Allow request if rate limiting fails
      return {
        allowed: true,
        remaining: limit - 1,
        resetTime: Date.now() + window * 1000
      };
    }
  }

  /**
   * Real-time simulation progress tracking
   */
  async setSimulationProgress(sessionId: string, progress: {
    rocketId: string;
    status: 'running' | 'completed' | 'failed';
    progress: number;
    message?: string;
    result?: any;
  }): Promise<void> {
    const key = `sim_progress:${sessionId}`;
    await cacheAdapter.setex(key, 300, JSON.stringify(progress)); // 5 minute TTL
  }

  async getSimulationProgress(sessionId: string): Promise<any | null> {
    const key = `sim_progress:${sessionId}`;
    const cached = await cacheAdapter.get(key);
    return cached ? JSON.parse(cached as string) : null;
  }

  async deleteSimulationProgress(sessionId: string): Promise<void> {
    const key = `sim_progress:${sessionId}`;
    await cacheAdapter.del(key);
  }

  /**
   * Chat context caching (for AI assistant)
   */
  async cacheChatContext(sessionId: string, context: any): Promise<void> {
    const key = `chat_context:${sessionId}`;
    await cacheAdapter.setex(key, this.TTL.SESSION, JSON.stringify(context));
  }

  async getChatContext(sessionId: string): Promise<any | null> {
    const key = `chat_context:${sessionId}`;
    const cached = await cacheAdapter.get(key);
    return cached ? JSON.parse(cached as string) : null;
  }

  /**
   * User preferences caching
   */
  async cacheUserPreferences(userId: string, preferences: any): Promise<void> {
    const key = `prefs:${userId}`;
    await cacheAdapter.setex(key, this.TTL.SESSION, JSON.stringify(preferences));
  }

  async getUserPreferences(userId: string): Promise<any | null> {
    const key = `prefs:${userId}`;
    const cached = await cacheAdapter.get(key);
    return cached ? JSON.parse(cached as string) : null;
  }

  /**
   * Generic counters
   */
  async incrementCounter(key: string, increment: number = 1): Promise<number> {
    const current = parseInt(await cacheAdapter.get(key) || '0');
    const newValue = current + increment;
    await cacheAdapter.setex(key, 86400, newValue.toString()); // 24 hour TTL
    return newValue;
  }

  async getCounter(key: string): Promise<number> {
    const value = await cacheAdapter.get(key);
    return value ? parseInt(value) : 0;
  }

  async setCounterExpiry(key: string, ttl: number): Promise<void> {
    await cacheAdapter.setex(key, ttl, (await cacheAdapter.get(key) || '0'));
  }

  /**
   * Bulk operations
   */
  async invalidateUserData(userId: string): Promise<void> {
    const patterns = [
      `session:${userId}:*`,
      `prefs:${userId}`,
      `chat_context:${userId}:*`,
      // Note: We might want to keep rockets and simulations
    ];
    
    for (const pattern of patterns) {
      const keys = await cacheAdapter.keys(pattern);
      if (keys.length > 0) {
        await cacheAdapter.del(...keys);
      }
    }
  }

  async invalidateRocketData(rocketId: string): Promise<void> {
    const patterns = [
      `rocket:${rocketId}`,
      `analysis:${rocketId}:*`,
      `sim:*${rocketId}*`, // Simulation caches that might include this rocket
    ];
    
    for (const pattern of patterns) {
      const keys = await cacheAdapter.keys(pattern);
      if (keys.length > 0) {
        await cacheAdapter.del(...keys);
      }
    }
  }

  /**
   * Cache statistics
   */
  async getCacheStats(): Promise<{
    totalKeys: number;
    memoryUsage: string;
    hitRate: number;
  }> {
    try {
      // For Upstash Redis, we'll use a simpler approach since info() might not be available
      // In a real implementation, you might want to track these metrics separately
      const dbSize = await cacheAdapter.keys('*');
      
      return {
        totalKeys: dbSize.length,
        memoryUsage: 'N/A', // Upstash manages memory automatically
        hitRate: 0.95 // Placeholder - would need separate tracking
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {
        totalKeys: 0,
        memoryUsage: 'Unknown',
        hitRate: 0
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await cacheAdapter.get('health_check');
      return true;
    } catch (error) {
      console.error('Cache health check failed:', error);
      return false;
    }
  }

  /**
   * Generate rocket hash for caching simulations
   */
  generateRocketHash(rocket: any): string {
    // Create a deterministic hash based on rocket configuration
    const hashInput = JSON.stringify({
      parts: rocket.parts,
      motorId: rocket.motorId,
      Cd: rocket.Cd,
      units: rocket.units
    });
    
    // Simple hash function (in production, use crypto.createHash)
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

export const cacheService = new CacheService();

// Backward compatibility export
export const cache = cacheService; 