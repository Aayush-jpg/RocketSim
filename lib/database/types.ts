/**
 * Database type utilities
 * Helps with converting TypeScript types to Supabase Json types
 */

// Use the generic Json type from Supabase
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

/**
 * Convert any value to a Json-compatible format for Supabase
 * This ensures compatibility with the database schema
 */
export function toJson<T>(value: T | null | undefined): Json | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  try {
    // Use JSON stringify/parse to ensure the value is serializable
    // and compatible with Supabase's Json type
    return JSON.parse(JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to convert value to Json:', error);
    return null;
  }
}

/**
 * Convert a Json value back to a typed object
 * Used when reading from the database
 */
export function fromJson<T>(value: Json | null): T | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  try {
    // If it's already an object, return it
    if (typeof value === 'object') {
      return value as T;
    }
    
    // If it's a string, try to parse it
    if (typeof value === 'string') {
      return JSON.parse(value) as T;
    }
    
    // Otherwise, return as-is
    return value as T;
  } catch (error) {
    console.warn('Failed to convert Json to typed object:', error);
    return null;
  }
}

/**
 * Type-safe converter for simulation trajectory data
 */
export function trajectoryToJson(trajectory: any): Json | null {
  return toJson(trajectory);
}

/**
 * Type-safe converter for flight events
 */
export function flightEventsToJson(events: any[]): Json | null {
  return toJson(events);
}

/**
 * Type-safe converter for thrust curve data
 */
export function thrustCurveToJson(thrustCurve: [number, number][]): Json | null {
  return toJson(thrustCurve);
} 