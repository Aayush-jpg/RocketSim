/**
 * Centralized Motor Database
 * Single source of truth for all motor specifications
 * Now imports from motors.json to eliminate duplication
 */

// Import motor data from shared JSON file
const MOTOR_DATA = require('./motors.json');

export interface MotorSpec {
  id: string;
  name: string;
  manufacturer: string;
  type: "solid" | "liquid" | "hybrid";
  impulseClass: string;
  
  // Performance data (SI units - meters, kg, Newtons, seconds)
  totalImpulse_Ns: number;
  avgThrust_N: number;
  burnTime_s: number;
  isp_s: number;
  
  // Physical dimensions (SI units)
  dimensions: {
    outerDiameter_m: number;
    length_m: number;
  };
  
  // Mass properties (SI units)
  mass: {
    propellant_kg: number;
    total_kg: number;
  };
  
  // Advanced properties for simulation
  grainConfig?: {
    grainNumber: number;
    grainDensity_kg_m3: number;
    grainOuterRadius_m: number;
    grainInitialInnerRadius_m: number;
    grainInitialHeight_m: number;
  };
  
  propellantConfig?: {
    oxidizerToFuelRatio?: number;
    chamberPressure_pa?: number;
    nozzleExpansionRatio?: number;
  };
  
  hybridConfig?: {
    grainDensity_kg_m3?: number;
    oxidizerMass_kg?: number;
    fuelMass_kg?: number;
    chamberPressure_pa?: number;
  };
}

/**
 * Comprehensive motor database - imported from shared JSON
 */
export const MOTOR_DATABASE: Record<string, MotorSpec> = MOTOR_DATA;

/**
 * Get motors by filter criteria
 */
export function getMotors(filter?: {
  type?: "solid" | "liquid" | "hybrid";
  manufacturer?: string;
  impulseClass?: string;
}): MotorSpec[] {
  return Object.values(MOTOR_DATABASE).filter(motor => {
    if (filter?.type && motor.type !== filter.type) return false;
    if (filter?.manufacturer && motor.manufacturer.toLowerCase() !== filter.manufacturer.toLowerCase()) return false;
    if (filter?.impulseClass && motor.impulseClass !== filter.impulseClass) return false;
    return true;
  });
}

/**
 * Get motor by ID with fallback
 */
export function getMotor(id: string): MotorSpec | null {
  return MOTOR_DATABASE[id] || null;
}

/**
 * Get motor with default fallback
 */
export function getMotorOrDefault(id: string): MotorSpec {
  return MOTOR_DATABASE[id] || MOTOR_DATABASE["default-motor"];
} 