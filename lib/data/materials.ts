/**
 * Centralized Material Properties Database
 * Single source of truth for all material specifications
 * Now imports from materials.json to eliminate duplication
 */

// Import material data from shared JSON file
const MATERIAL_DATA = require('./materials.json');

export interface MaterialSpec {
  id: string;
  name: string;
  category: "metal" | "composite" | "plastic" | "wood" | "propellant";
  density_kg_m3: number;
  tensileStrength_pa?: number;
  yieldStrength_pa?: number;
  elasticModulus_pa?: number;
  thermalExpansion_per_k?: number;
  meltingPoint_k?: number;
  surfaceRoughness_m: number;
  cost_per_kg?: number;
  availability: "common" | "specialty" | "experimental";
  description: string;
  applications: string[];
}

/**
 * Professional material database - imported from shared JSON
 */
export const MATERIAL_DATABASE: Record<string, MaterialSpec> = MATERIAL_DATA;

/**
 * Material property shortcuts for common materials
 */
export const MATERIALS = {
  // Most common materials - easy access
  FIBERGLASS: MATERIAL_DATABASE.fiberglass,
  CARBON_FIBER: MATERIAL_DATABASE.carbon_fiber,
  ALUMINUM: MATERIAL_DATABASE.aluminum_6061,
  PLYWOOD: MATERIAL_DATABASE.birch_plywood,
  ABS: MATERIAL_DATABASE.abs,
  APCP: MATERIAL_DATABASE.apcp,
  
  // Legacy constants for backward compatibility
  DENSITY_FIBERGLASS: 1600.0,
  DENSITY_CARBON_FIBER: 1500.0,
  DENSITY_ALUMINUM: 2700.0,
  DENSITY_PLYWOOD: 650.0,
  DENSITY_ABS: 1050.0,
  DENSITY_APCP: 1815.0
} as const;

/**
 * Get material by ID with fallback to fiberglass
 */
export function getMaterial(id: string): MaterialSpec {
  return MATERIAL_DATABASE[id] || MATERIAL_DATABASE.fiberglass;
}

/**
 * Get materials by category
 */
export function getMaterialsByCategory(category: MaterialSpec['category']): MaterialSpec[] {
  return Object.values(MATERIAL_DATABASE).filter(material => material.category === category);
}

/**
 * Get materials by application
 */
export function getMaterialsForApplication(application: string): MaterialSpec[] {
  return Object.values(MATERIAL_DATABASE).filter(material => 
    material.applications.includes(application)
  );
}

/**
 * Calculate mass for a given material and volume
 */
export function calculateMass(materialId: string, volume_m3: number): number {
  const material = getMaterial(materialId);
  return material.density_kg_m3 * volume_m3;
}

/**
 * Get appropriate material recommendations for component
 */
export function getRecommendedMaterials(componentType: 'nose_cone' | 'body_tube' | 'fin' | 'motor' | 'recovery'): MaterialSpec[] {
  const applicationMap = {
    nose_cone: 'nose_cones',
    body_tube: 'body_tubes', 
    fin: 'fins',
    motor: 'motor_casings',
    recovery: 'recovery_systems'
  };
  
  return getMaterialsForApplication(applicationMap[componentType]);
} 