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
  category: "metal" | "composite" | "plastic" | "wood" | "propellant" | "3d_printing";
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

export interface PrintingMaterialSpec extends MaterialSpec {
  category: "3d_printing";
  print_temperature_c: number;
  bed_temperature_c: number;
  shrinkage_percent: number;
  strength_mpa: number;
  print_settings: {
    layer_height_mm: number;
    infill_percent: number;
    support_density: number;
    print_speed_mm_s: number;
  };
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
  CARDBOARD: MATERIAL_DATABASE.cardboard,
  ABS: MATERIAL_DATABASE.abs,
  APCP: MATERIAL_DATABASE.apcp,
  
  // 3D Printing materials
  PLA: MATERIAL_DATABASE.pla,
  PETG: MATERIAL_DATABASE.petg,
  TPU: MATERIAL_DATABASE.tpu,
  PC: MATERIAL_DATABASE.pc,
  NYLON: MATERIAL_DATABASE.nylon,
  
  // Legacy constants for backward compatibility
  DENSITY_FIBERGLASS: 1600.0,
  DENSITY_CARBON_FIBER: 1500.0,
  DENSITY_ALUMINUM: 2700.0,
  DENSITY_PLYWOOD: 650.0,
  DENSITY_CARDBOARD: 800.0,
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

/**
 * Get all 3D printing materials
 */
export function getPrintingMaterials(): PrintingMaterialSpec[] {
  return Object.values(MATERIAL_DATABASE).filter(
    (material): material is PrintingMaterialSpec => material.category === "3d_printing"
  );
}

/**
 * Get 3D printing materials suitable for a specific component
 */
export function getPrintingMaterialsForComponent(componentType: 'nose_cone' | 'body_tube' | 'fin' | 'motor' | 'recovery'): PrintingMaterialSpec[] {
  const applicationMap = {
    nose_cone: 'nose_cones',
    body_tube: 'body_tubes', 
    fin: 'fins',
    motor: 'motor_casings',
    recovery: 'recovery_systems'
  };
  
  const targetApplication = applicationMap[componentType];
  return getPrintingMaterials().filter(material => 
    material.applications.includes(targetApplication)
  );
}

/**
 * Calculate optimal wall thickness for 3D printing
 */
export function calculateOptimalWallThickness(
  material: PrintingMaterialSpec,
  componentType: string,
  diameter: number
): number {
  // Base wall thickness based on component type and diameter
  const baseThickness = (() => {
    switch (componentType) {
      case 'nose_cone':
        return Math.max(0.8, diameter * 0.02); // 2% of diameter, min 0.8mm
      case 'body_tube':
        return Math.max(1.2, diameter * 0.025); // 2.5% of diameter, min 1.2mm
      case 'fin':
        return Math.max(0.6, diameter * 0.015); // 1.5% of diameter, min 0.6mm
      default:
        return Math.max(1.0, diameter * 0.02);
    }
  })();
  
  // Material-specific adjustment factors
  const materialFactors = {
    'pla': 1.0,
    'abs': 1.1,
    'petg': 1.05,
    'tpu': 1.2,
    'pc': 1.15,
    'nylon': 1.1
  };
  
  const factor = materialFactors[material.id as keyof typeof materialFactors] || 1.0;
  return baseThickness * factor;
}

/**
 * Calculate estimated print time for a component
 */
export function calculateEstimatedPrintTime(
  volume_cm3: number,
  material: PrintingMaterialSpec
): number {
  // Base calculation: volume / (layer_height * print_speed * infill_factor)
  const layerHeight = material.print_settings.layer_height_mm / 10; // Convert to cm
  const printSpeed = material.print_settings.print_speed_mm_s / 60; // Convert to cm/s
  const infillFactor = material.print_settings.infill_percent / 100;
  
  // Calculate base time in seconds
  const baseTimeSeconds = volume_cm3 / (layerHeight * printSpeed * infillFactor);
  
  // Convert to minutes and add 20% for support material and other overhead
  const totalTimeMinutes = (baseTimeSeconds * 1.2) / 60;
  
  // Ensure reasonable bounds (minimum 5 minutes, maximum 48 hours)
  return Math.max(5, Math.min(2880, totalTimeMinutes));
}

/**
 * Calculate estimated material cost for a component
 */
export function calculateMaterialCost(
  volume_cm3: number,
  material: PrintingMaterialSpec
): number {
  const volume_m3 = volume_cm3 / 1000000; // Convert cm³ to m³
  const mass_kg = volume_m3 * material.density_kg_m3;
  return mass_kg * (material.cost_per_kg || 0);
} 