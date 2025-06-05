/**
 * Centralized Motor Database
 * Single source of truth for all motor specifications
 * Supports both legacy (cm/kg) and SI (m/kg) units for compatibility
 */

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
 * Comprehensive motor database - single source of truth
 */
export const MOTOR_DATABASE: Record<string, MotorSpec> = {
  "mini-motor": {
    id: "mini-motor",
    name: "A8-3",
    manufacturer: "Estes",
    type: "solid",
    impulseClass: "A",
    totalImpulse_Ns: 2.5,
    avgThrust_N: 1.5,
    burnTime_s: 1.8,
    isp_s: 150,
    dimensions: {
      outerDiameter_m: 0.013,
      length_m: 0.100
    },
    mass: {
      propellant_kg: 0.008,
      total_kg: 0.015
    },
    grainConfig: {
      grainNumber: 1,
      grainDensity_kg_m3: 1815,
      grainOuterRadius_m: 0.005,
      grainInitialInnerRadius_m: 0.002,
      grainInitialHeight_m: 0.080
    }
  },
  
  "default-motor": {
    id: "default-motor",
    name: "F32-6",
    manufacturer: "Generic",
    type: "solid",
    impulseClass: "F",
    totalImpulse_Ns: 80,
    avgThrust_N: 32,
    burnTime_s: 2.5,
    isp_s: 200,
    dimensions: {
      outerDiameter_m: 0.029,
      length_m: 0.124
    },
    mass: {
      propellant_kg: 0.040,
      total_kg: 0.070
    },
    grainConfig: {
      grainNumber: 1,
      grainDensity_kg_m3: 1815,
      grainOuterRadius_m: 0.0125,
      grainInitialInnerRadius_m: 0.004,
      grainInitialHeight_m: 0.100
    }
  },
  
  "high-power": {
    id: "high-power",
    name: "H180-7",
    manufacturer: "Generic",
    type: "solid",
    impulseClass: "H",
    totalImpulse_Ns: 320,
    avgThrust_N: 100,
    burnTime_s: 3.2,
    isp_s: 220,
    dimensions: {
      outerDiameter_m: 0.038,
      length_m: 0.150
    },
    mass: {
      propellant_kg: 0.090,
      total_kg: 0.150
    },
    grainConfig: {
      grainNumber: 2,
      grainDensity_kg_m3: 1815,
      grainOuterRadius_m: 0.016,
      grainInitialInnerRadius_m: 0.005,
      grainInitialHeight_m: 0.065
    }
  },
  
  "super-power": {
    id: "super-power",
    name: "I200-8",
    manufacturer: "Generic",
    type: "solid",
    impulseClass: "I",
    totalImpulse_Ns: 800,
    avgThrust_N: 200,
    burnTime_s: 4.0,
    isp_s: 240,
    dimensions: {
      outerDiameter_m: 0.054,
      length_m: 0.200
    },
    mass: {
      propellant_kg: 0.200,
      total_kg: 0.300
    },
    grainConfig: {
      grainNumber: 3,
      grainDensity_kg_m3: 1815,
      grainOuterRadius_m: 0.024,
      grainInitialInnerRadius_m: 0.006,
      grainInitialHeight_m: 0.060
    }
  },
  
  "small-liquid": {
    id: "small-liquid",
    name: "Liquid-500N",
    manufacturer: "Custom",
    type: "liquid",
    impulseClass: "M",
    totalImpulse_Ns: 15000,
    avgThrust_N: 500,
    burnTime_s: 30,
    isp_s: 300,
    dimensions: {
      outerDiameter_m: 0.075,
      length_m: 0.300
    },
    mass: {
      propellant_kg: 1.5,
      total_kg: 2.3
    },
    propellantConfig: {
      oxidizerToFuelRatio: 2.33,
      chamberPressure_pa: 2e6,
      nozzleExpansionRatio: 25
    }
  },
  
  "medium-liquid": {
    id: "medium-liquid",
    name: "Liquid-2000N",
    manufacturer: "Custom",
    type: "liquid",
    impulseClass: "O",
    totalImpulse_Ns: 90000,
    avgThrust_N: 2000,
    burnTime_s: 45,
    isp_s: 320,
    dimensions: {
      outerDiameter_m: 0.100,
      length_m: 0.400
    },
    mass: {
      propellant_kg: 6.5,
      total_kg: 8.5
    },
    propellantConfig: {
      oxidizerToFuelRatio: 2.33,
      chamberPressure_pa: 3e6,
      nozzleExpansionRatio: 40
    }
  },
  
  "large-liquid": {
    id: "large-liquid",
    name: "Liquid-8000N",
    manufacturer: "Custom",
    type: "liquid",
    impulseClass: "P",
    totalImpulse_Ns: 120000,
    avgThrust_N: 8000,
    burnTime_s: 15,
    isp_s: 340,
    dimensions: {
      outerDiameter_m: 0.150,
      length_m: 0.500
    },
    mass: {
      propellant_kg: 8.0,
      total_kg: 11.0
    },
    propellantConfig: {
      oxidizerToFuelRatio: 2.33,
      chamberPressure_pa: 5e6,
      nozzleExpansionRatio: 60
    }
  },
  
  "hybrid-engine": {
    id: "hybrid-engine",
    name: "Hybrid-1200N",
    manufacturer: "Custom",
    type: "hybrid",
    impulseClass: "N",
    totalImpulse_Ns: 24000,
    avgThrust_N: 1200,
    burnTime_s: 20,
    isp_s: 280,
    dimensions: {
      outerDiameter_m: 0.090,
      length_m: 0.350
    },
    mass: {
      propellant_kg: 4.5,
      total_kg: 5.7
    },
    hybridConfig: {
      grainDensity_kg_m3: 920,
      oxidizerMass_kg: 3.6,
      fuelMass_kg: 0.9,
      chamberPressure_pa: 2.5e6
    }
  }
};

/**
 * Legacy format converter for backward compatibility
 */
export function toLegacyFormat(motor: MotorSpec) {
  return {
    name: motor.name,
    manufacturer: motor.manufacturer,
    type: motor.type,
    impulseClass: motor.impulseClass,
    totalImpulse: motor.totalImpulse_Ns,
    avgThrust: motor.avgThrust_N,
    burnTime: motor.burnTime_s,
    dimensions: {
      diameter: motor.dimensions.outerDiameter_m * 1000, // m to mm
      length: motor.dimensions.length_m * 100 // m to cm
    },
    weight: {
      propellant: motor.mass.propellant_kg,
      total: motor.mass.total_kg
    },
    isp: motor.isp_s
  };
}

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