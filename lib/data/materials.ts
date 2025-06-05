/**
 * Centralized Material Properties Database
 * Single source of truth for all material specifications
 * Professional-grade material properties for rocket components
 */

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
 * Professional material database
 */
export const MATERIAL_DATABASE: Record<string, MaterialSpec> = {
  // === COMPOSITES ===
  "fiberglass": {
    id: "fiberglass",
    name: "Fiberglass (G10/FR4)",
    category: "composite",
    density_kg_m3: 1600.0,
    tensileStrength_pa: 400e6, // 400 MPa
    elasticModulus_pa: 18e9, // 18 GPa
    thermalExpansion_per_k: 16e-6, // 16 µm/m/K
    surfaceRoughness_m: 1e-5, // 10 µm
    cost_per_kg: 25,
    availability: "common",
    description: "Standard fiberglass composite, excellent strength-to-weight ratio",
    applications: ["nose_cones", "body_tubes", "fin_root_sections"]
  },
  
  "carbon_fiber": {
    id: "carbon_fiber",
    name: "Carbon Fiber (T300)",
    category: "composite",
    density_kg_m3: 1500.0,
    tensileStrength_pa: 600e6, // 600 MPa
    elasticModulus_pa: 150e9, // 150 GPa
    thermalExpansion_per_k: -0.5e-6, // Negative expansion
    surfaceRoughness_m: 0.5e-5, // 5 µm (smooth)
    cost_per_kg: 150,
    availability: "specialty",
    description: "High-performance carbon fiber, aerospace grade",
    applications: ["high_performance_body_tubes", "precision_nose_cones", "competition_fins"]
  },
  
  "kevlar": {
    id: "kevlar",
    name: "Kevlar Aramid Fiber",
    category: "composite",
    density_kg_m3: 1440.0,
    tensileStrength_pa: 500e6, // 500 MPa
    elasticModulus_pa: 80e9, // 80 GPa
    thermalExpansion_per_k: -4e-6, // Negative expansion
    surfaceRoughness_m: 1e-5,
    cost_per_kg: 100,
    availability: "specialty",
    description: "High-strength aramid fiber, excellent impact resistance",
    applications: ["recovery_systems", "high_stress_body_sections"]
  },
  
  // === METALS ===
  "aluminum_6061": {
    id: "aluminum_6061",
    name: "Aluminum 6061-T6",
    category: "metal",
    density_kg_m3: 2700.0,
    tensileStrength_pa: 310e6, // 310 MPa
    yieldStrength_pa: 275e6, // 275 MPa
    elasticModulus_pa: 69e9, // 69 GPa
    thermalExpansion_per_k: 23e-6, // 23 µm/m/K
    meltingPoint_k: 925, // 652°C
    surfaceRoughness_m: 2e-6, // 2 µm (machined)
    cost_per_kg: 5,
    availability: "common",
    description: "Standard aluminum alloy, good machinability and weldability",
    applications: ["motor_casings", "structural_components", "recovery_hardware"]
  },
  
  "titanium": {
    id: "titanium",
    name: "Titanium Ti-6Al-4V",
    category: "metal",
    density_kg_m3: 4430.0,
    tensileStrength_pa: 950e6, // 950 MPa
    yieldStrength_pa: 880e6, // 880 MPa
    elasticModulus_pa: 114e9, // 114 GPa
    thermalExpansion_per_k: 8.6e-6,
    meltingPoint_k: 1933, // 1660°C
    surfaceRoughness_m: 1e-6, // 1 µm (precision machined)
    cost_per_kg: 50,
    availability: "specialty",
    description: "High-performance titanium alloy, excellent strength and corrosion resistance",
    applications: ["high_temperature_components", "precision_motor_parts", "advanced_recovery_systems"]
  },
  
  "stainless_steel": {
    id: "stainless_steel",
    name: "Stainless Steel 316L",
    category: "metal",
    density_kg_m3: 8000.0,
    tensileStrength_pa: 580e6, // 580 MPa
    yieldStrength_pa: 290e6, // 290 MPa
    elasticModulus_pa: 200e9, // 200 GPa
    thermalExpansion_per_k: 16e-6,
    meltingPoint_k: 1673, // 1400°C
    surfaceRoughness_m: 3e-6, // 3 µm
    cost_per_kg: 8,
    availability: "common",
    description: "Corrosion-resistant steel, good for harsh environments",
    applications: ["recovery_hardware", "motor_nozzles", "structural_fasteners"]
  },
  
  // === WOOD ===
  "birch_plywood": {
    id: "birch_plywood",
    name: "Baltic Birch Plywood",
    category: "wood",
    density_kg_m3: 650.0,
    tensileStrength_pa: 50e6, // 50 MPa
    elasticModulus_pa: 9e9, // 9 GPa
    thermalExpansion_per_k: 5e-6,
    surfaceRoughness_m: 50e-6, // 50 µm (sanded)
    cost_per_kg: 3,
    availability: "common",
    description: "High-quality plywood, excellent for fins and internal structures",
    applications: ["fins", "centering_rings", "internal_structures"]
  },
  
  "basswood": {
    id: "basswood",
    name: "Basswood",
    category: "wood",
    density_kg_m3: 400.0,
    tensileStrength_pa: 30e6, // 30 MPa
    elasticModulus_pa: 8e9, // 8 GPa
    thermalExpansion_per_k: 5e-6,
    surfaceRoughness_m: 30e-6, // 30 µm
    cost_per_kg: 8,
    availability: "common",
    description: "Lightweight hardwood, easy to work with",
    applications: ["nose_cones", "small_fins", "prototyping"]
  },
  
  // === PLASTICS ===
  "abs": {
    id: "abs",
    name: "ABS Plastic",
    category: "plastic",
    density_kg_m3: 1050.0,
    tensileStrength_pa: 40e6, // 40 MPa
    elasticModulus_pa: 2.3e9, // 2.3 GPa
    thermalExpansion_per_k: 90e-6,
    meltingPoint_k: 378, // 105°C
    surfaceRoughness_m: 20e-6, // 20 µm (3D printed)
    cost_per_kg: 20,
    availability: "common",
    description: "Common 3D printing plastic, good impact resistance",
    applications: ["prototyping", "small_components", "recovery_parts"]
  },
  
  "pla": {
    id: "pla",
    name: "PLA Plastic",
    category: "plastic",
    density_kg_m3: 1240.0,
    tensileStrength_pa: 50e6, // 50 MPa
    elasticModulus_pa: 3.5e9, // 3.5 GPa
    thermalExpansion_per_k: 70e-6,
    meltingPoint_k: 453, // 180°C
    surfaceRoughness_m: 15e-6, // 15 µm (3D printed)
    cost_per_kg: 25,
    availability: "common",
    description: "Biodegradable 3D printing plastic, easy to work with",
    applications: ["prototyping", "nose_cone_tips", "internal_components"]
  },
  
  "peek": {
    id: "peek",
    name: "PEEK (Polyetheretherketone)",
    category: "plastic",
    density_kg_m3: 1320.0,
    tensileStrength_pa: 100e6, // 100 MPa
    elasticModulus_pa: 3.6e9, // 3.6 GPa
    thermalExpansion_per_k: 47e-6,
    meltingPoint_k: 615, // 342°C
    surfaceRoughness_m: 5e-6, // 5 µm (machined)
    cost_per_kg: 200,
    availability: "specialty",
    description: "High-performance engineering plastic, excellent chemical resistance",
    applications: ["high_temperature_seals", "precision_components", "chemical_resistant_parts"]
  },
  
  // === PROPELLANTS ===
  "apcp": {
    id: "apcp",
    name: "APCP (Ammonium Perchlorate Composite Propellant)",
    category: "propellant",
    density_kg_m3: 1815.0,
    surfaceRoughness_m: 1e-6, // Very smooth for consistent burn
    availability: "specialty",
    description: "Standard solid rocket propellant, high performance",
    applications: ["solid_motor_grains"]
  },
  
  "htpb": {
    id: "htpb",
    name: "HTPB (Hydroxyl-terminated polybutadiene)",
    category: "propellant",
    density_kg_m3: 920.0,
    surfaceRoughness_m: 1e-6,
    availability: "specialty",
    description: "Hybrid rocket fuel grain material",
    applications: ["hybrid_motor_fuel_grains"]
  }
};

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