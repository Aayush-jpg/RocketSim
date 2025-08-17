/**
 * Centralized Rocket Configuration Templates
 * Single source of truth for all default rocket designs
 * Professional rocket configurations for different use cases
 */

import { Rocket } from '@/types/rocket';
import { MATERIALS } from './materials';

export interface RocketTemplate {
  id: string;
  name: string;
  description: string;
  category: 'beginner' | 'intermediate' | 'advanced' | 'competition' | 'experimental';
  targetAltitude_m: number;
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedCost: 'low' | 'medium' | 'high';
  buildTime_hours: number;
  config: Rocket;
}

/**
 * Professional rocket template database
 */
export const ROCKET_TEMPLATES: Record<string, RocketTemplate> = {
  "basic_starter": {
    id: "basic_starter",
    name: "Basic Starter",
    description: "Simple solid rocket for beginners. Easy to build and fly.",
    category: "beginner",
    targetAltitude_m: 300,
    complexity: "simple",
    estimatedCost: "low",
    buildTime_hours: 8,
    config: {
      id: crypto.randomUUID(),
      name: "Basic Starter",
      rocket_type: "solid",
      nose_cone: {
        id: crypto.randomUUID(),
        shape: "conical",
        length_m: 0.15,
        base_radius_m: 0.025,
        wall_thickness_m: 0.002,
        material_id: "cardboard",
        material_density_kg_m3: MATERIALS.CARDBOARD.density_kg_m3,
        surface_roughness_m: 1e-4,
        color: "#FFFFFF"
      },
      body_tubes: [{
        id: crypto.randomUUID(),
        outer_radius_m: 0.025,
        length_m: 0.60,
        wall_thickness_m: 0.002,
        material_id: "cardboard",
        material_density_kg_m3: MATERIALS.CARDBOARD.density_kg_m3,
        surface_roughness_m: 1e-4,
        color: "#FFFFFF"
      }],
      fins: [{
        id: crypto.randomUUID(),
        fin_count: 3,
        root_chord_m: 0.08,
        tip_chord_m: 0.04,
        span_m: 0.06,
        sweep_length_m: 0.02,
        thickness_m: 0.006,
        wall_thickness_m: 0, // Solid fin by default
        position_from_tail_m: 0.1, // Near tail for basic rocket
        material_id: "birch_plywood",
        material_density_kg_m3: MATERIALS.PLYWOOD.density_kg_m3,
        airfoil: "symmetric",
        cant_angle_deg: 0.0,
        color: "#D3D3D3"
      }],
      motor: {
        id: "motor",
        motor_database_id: "mini-motor",
        position_from_tail_m: 0.0,
        rocket_type: "solid"
      },
      electronics_bay: {
        id: crypto.randomUUID(),
        name: "Basic Avionics",
        position_from_tail_m: 0.45, // Near nose for easy recovery
        length_m: 0.08,
        diameter_m: 0.05,
        components: ["altimeter", "recovery_charges"],
        color: "#B87333"
      },
      parachutes: [{
        id: crypto.randomUUID(),
        name: "Basic Recovery",
        cd_s_m2: 0.8,
        trigger: "apogee",
        sampling_rate_hz: 105.0,
        lag_s: 1.0,
        noise_bias: 0.0,
        noise_deviation: 5.0,
        noise_correlation: 0.7,
        position_from_tail_m: 0.0,
        color: "#E67E22"
      }],
      coordinate_system: "tail_to_nose"
    }
  },

  "sport_rocket": {
    id: "sport_rocket",
    name: "Sport Rocket",
    description: "Mid-power rocket for sport flying. Good performance and reliability.",
    category: "intermediate",
    targetAltitude_m: 500,
    complexity: "moderate",
    estimatedCost: "medium",
    buildTime_hours: 8,
    config: {
      id: crypto.randomUUID(),
      name: "Sport Rocket",
      rocket_type: "solid",
      nose_cone: {
        id: crypto.randomUUID(),
        shape: "ogive",
        length_m: 0.30,
        base_radius_m: 0.04,
        wall_thickness_m: 0.002,
        material_id: "fiberglass",
        material_density_kg_m3: MATERIALS.FIBERGLASS.density_kg_m3,
        surface_roughness_m: 1e-5,
        color: "#E74C3C"
      },
      body_tubes: [{
        id: crypto.randomUUID(),
        outer_radius_m: 0.04,
        length_m: 0.60,
        wall_thickness_m: 0.003,
        material_id: "fiberglass",
        material_density_kg_m3: MATERIALS.FIBERGLASS.density_kg_m3,
        surface_roughness_m: 1e-5,
        color: "#FFFFFF"
      }],
      fins: [{
        id: crypto.randomUUID(),
        fin_count: 4,
        root_chord_m: 0.14,
        tip_chord_m: 0.08,
        span_m: 0.10,
        sweep_length_m: 0.05,
        thickness_m: 0.006,
        wall_thickness_m: 0, // Solid fin by default
        position_from_tail_m: 0.1, // Near tail for basic rocket
        material_id: "birch_plywood",
        material_density_kg_m3: MATERIALS.PLYWOOD.density_kg_m3,
        airfoil: "symmetric",
        cant_angle_deg: 0.0,
        color: "#2C3E50"
      }],
      motor: {
        id: "motor",
        motor_database_id: "high-power",
        position_from_tail_m: 0.0,
        rocket_type: "solid"
      },
      parachutes: [{
        id: crypto.randomUUID(),
        name: "Main Parachute",
        cd_s_m2: 1.5,
        trigger: "apogee",
        sampling_rate_hz: 105.0,
        lag_s: 1.5,
        noise_bias: 0.0,
        noise_deviation: 8.3,
        noise_correlation: 0.5,
        position_from_tail_m: 0.0,
        color: "#F39C12"
      }],
      coordinate_system: "tail_to_nose"
    }
  },

  "high_performance": {
    id: "high_performance",
    name: "High Performance Rocket",
    description: "Advanced rocket design with carbon fiber construction and dual deployment.",
    category: "advanced",
    targetAltitude_m: 1000,
    complexity: "complex",
    estimatedCost: "high",
    buildTime_hours: 20,
    config: {
      id: crypto.randomUUID(),
      name: "High Performance",
      rocket_type: "solid",
      nose_cone: {
        id: crypto.randomUUID(),
        shape: "ogive",
        length_m: 0.20,
        base_radius_m: 0.06,
        wall_thickness_m: 0.002,
        material_id: "carbon_fiber",
        material_density_kg_m3: MATERIALS.CARBON_FIBER.density_kg_m3,
        surface_roughness_m: 0.5e-5,
        color: "#1C1C1C"
      },
      body_tubes: [{
        id: crypto.randomUUID(),
        outer_radius_m: 0.06,
        length_m: 0.60,
        wall_thickness_m: 0.003,
        material_id: "carbon_fiber",
        material_density_kg_m3: MATERIALS.CARBON_FIBER.density_kg_m3,
        surface_roughness_m: 0.5e-5,
        color: "#2C3E50"
      }],
      fins: [{
        id: crypto.randomUUID(),
        fin_count: 4,
        root_chord_m: 0.12,
        tip_chord_m: 0.06,
        span_m: 0.10,
        sweep_length_m: 0.04,
        thickness_m: 0.008,
        wall_thickness_m: 0, // Solid fin by default
        position_from_tail_m: 0.1, // Near tail for basic rocket
        material_id: "carbon_fiber",
        material_density_kg_m3: MATERIALS.CARBON_FIBER.density_kg_m3,
        airfoil: "symmetric",
        cant_angle_deg: 0.0,
        color: "#34495E"
      }],
      motor: {
        id: "motor",
        motor_database_id: "high-power",
        position_from_tail_m: 0.0,
        rocket_type: "solid"
      },
      parachutes: [
        {
          id: crypto.randomUUID(),
          name: "Drogue Parachute",
          cd_s_m2: 0.3,
          trigger: "apogee",
          sampling_rate_hz: 105.0,
          lag_s: 1.0,
          noise_bias: 0.0,
          noise_deviation: 8.3,
          noise_correlation: 0.5,
          position_from_tail_m: 0.45,
          color: "#E67E22"
        },
        {
          id: crypto.randomUUID(),
          name: "Main Parachute",
          cd_s_m2: 2.0,
          trigger: 200, // Deploy at 200m AGL
          sampling_rate_hz: 105.0,
          lag_s: 1.5,
          noise_bias: 0.0,
          noise_deviation: 8.3,
          noise_correlation: 0.5,
          position_from_tail_m: 0.35,
          color: "#E74C3C"
        }
      ],
      coordinate_system: "tail_to_nose"
    }
  },

  "competition_rocket": {
    id: "competition_rocket",
    name: "Competition Rocket",
    description: "High-performance rocket for competitions. Optimized for altitude and precision.",
    category: "competition",
    targetAltitude_m: 1500,
    complexity: "moderate",
    estimatedCost: "medium",
    buildTime_hours: 25,
    config: {
      id: crypto.randomUUID(),
      name: "Competition Rocket",
      rocket_type: "solid",
      nose_cone: {
        id: crypto.randomUUID(),
        shape: "ogive",
        length_m: 0.35,
        base_radius_m: 0.055,
        wall_thickness_m: 0.003,
        material_id: "fiberglass",
        material_density_kg_m3: MATERIALS.FIBERGLASS.density_kg_m3,
        surface_roughness_m: 1e-5,
        color: "#FFFFFF"
      },
      body_tubes: [{
        id: crypto.randomUUID(),
        outer_radius_m: 0.055,
        length_m: 0.70,
        wall_thickness_m: 0.003,
        material_id: "fiberglass",
        material_density_kg_m3: MATERIALS.FIBERGLASS.density_kg_m3,
        surface_roughness_m: 1e-5,
        color: "#FFFFFF"
      }],
      fins: [{
        id: crypto.randomUUID(),
        fin_count: 3,
        root_chord_m: 0.16,
        tip_chord_m: 0.08,
        span_m: 0.12,
        sweep_length_m: 0.06,
        thickness_m: 0.006,
        wall_thickness_m: 0, // Solid fin by default
        position_from_tail_m: 0.1, // Near tail for basic rocket
        material_id: "birch_plywood",
        material_density_kg_m3: MATERIALS.PLYWOOD.density_kg_m3,
        airfoil: "symmetric",
        cant_angle_deg: 0.0,
        color: "#D3D3D3"
      }],
      motor: {
        id: "motor",
        motor_database_id: "high-power",
        position_from_tail_m: 0.0,
        rocket_type: "solid"
      },
      electronics_bay: {
        id: crypto.randomUUID(),
        name: "Competition Avionics",
        position_from_tail_m: 0.55, // Near nose for easy recovery
        length_m: 0.12,
        diameter_m: 0.055,
        components: ["gps", "altimeter", "recovery_charges", "data_logger"],
        color: "#B87333"
      },
      parachutes: [{
        id: crypto.randomUUID(),
        name: "Competition Parachute",
        cd_s_m2: 1.5,
        trigger: "apogee",
        sampling_rate_hz: 105.0,
        lag_s: 1.0,
        noise_bias: 0.0,
        noise_deviation: 5.0,
        noise_correlation: 0.7,
        position_from_tail_m: 0.0,
        color: "#E67E22"
      }],
      coordinate_system: "tail_to_nose"
    }
  },

  "high_altitude": {
    id: "high_altitude",
    name: "High Altitude Rocket",
    description: "Designed for maximum altitude. Advanced aerodynamics and lightweight construction.",
    category: "advanced",
    targetAltitude_m: 3000,
    complexity: "complex",
    estimatedCost: "high",
    buildTime_hours: 40,
    config: {
      id: crypto.randomUUID(),
      name: "High Altitude Rocket",
      rocket_type: "solid",
      nose_cone: {
        id: crypto.randomUUID(),
        shape: "elliptical",
        length_m: 0.45,
        base_radius_m: 0.075,
        wall_thickness_m: 0.002,
        material_id: "carbon_fiber",
        material_density_kg_m3: MATERIALS.CARBON_FIBER.density_kg_m3,
        surface_roughness_m: 5e-6,
        color: "#2C3E50"
      },
      body_tubes: [{
        id: crypto.randomUUID(),
        outer_radius_m: 0.075,
        length_m: 1.20,
        wall_thickness_m: 0.002,
        material_id: "carbon_fiber",
        material_density_kg_m3: MATERIALS.CARBON_FIBER.density_kg_m3,
        surface_roughness_m: 5e-6,
        color: "#2C3E50"
      }],
      fins: [{
        id: crypto.randomUUID(),
        fin_count: 4,
        root_chord_m: 0.20,
        tip_chord_m: 0.10,
        span_m: 0.15,
        sweep_length_m: 0.08,
        thickness_m: 0.004,
        wall_thickness_m: 0, // Solid fin by default
        position_from_tail_m: 0.1, // Near tail for basic rocket
        material_id: "carbon_fiber",
        material_density_kg_m3: MATERIALS.CARBON_FIBER.density_kg_m3,
        airfoil: "symmetric",
        cant_angle_deg: 0.0,
        color: "#34495E"
      }],
      motor: {
        id: "motor",
        motor_database_id: "super-power",
        position_from_tail_m: 0.0,
        rocket_type: "solid"
      },
      electronics_bay: {
        id: crypto.randomUUID(),
        name: "High Altitude Avionics",
        position_from_tail_m: 0.70, // Near nose for easy recovery
        length_m: 0.15,
        diameter_m: 0.075,
        components: ["gps", "altimeter", "recovery_charges", "data_logger", "telemetry"],
        color: "#B87333"
      },
      parachutes: [{
        id: crypto.randomUUID(),
        name: "High Altitude Recovery",
        cd_s_m2: 2.5,
        trigger: "apogee",
        sampling_rate_hz: 105.0,
        lag_s: 1.5,
        noise_bias: 0.0,
        noise_deviation: 5.0,
        noise_correlation: 0.7,
        position_from_tail_m: 0.0,
        color: "#E67E22"
      }],
      coordinate_system: "tail_to_nose"
    }
  },

  "experimental_hybrid": {
    id: "experimental_hybrid",
    name: "Experimental Hybrid",
    description: "Hybrid rocket with custom propulsion system. For experienced builders only.",
    category: "experimental",
    targetAltitude_m: 3000,
    complexity: "complex",
    estimatedCost: "high",
    buildTime_hours: 50,
    config: {
      id: crypto.randomUUID(),
      name: "Experimental Hybrid",
      rocket_type: "hybrid",
      nose_cone: {
        id: crypto.randomUUID(),
        shape: "ogive",
        length_m: 0.30,
        base_radius_m: 0.075,
        wall_thickness_m: 0.003,
        material_id: "aluminum_6061",
        material_density_kg_m3: MATERIALS.ALUMINUM.density_kg_m3,
        surface_roughness_m: 2e-6,
        color: "#BDC3C7"
      },
      body_tubes: [{
        id: crypto.randomUUID(),
        outer_radius_m: 0.075,
        length_m: 1.20,
        wall_thickness_m: 0.005,
        material_id: "aluminum_6061",
        material_density_kg_m3: MATERIALS.ALUMINUM.density_kg_m3,
        surface_roughness_m: 2e-6,
        color: "#95A5A6"
      }],
      fins: [{
        id: crypto.randomUUID(),
        fin_count: 4,
        root_chord_m: 0.15,
        tip_chord_m: 0.08,
        span_m: 0.12,
        sweep_length_m: 0.06,
        thickness_m: 0.010,
        wall_thickness_m: 0, // Solid fin by default
        position_from_tail_m: 0.1, // Near tail for basic rocket
        material_id: "aluminum_6061",
        material_density_kg_m3: MATERIALS.ALUMINUM.density_kg_m3,
        airfoil: "symmetric",
        cant_angle_deg: 0.0,
        color: "#7F8C8D"
      }],
      motor: {
        id: "motor",
        motor_database_id: "hybrid-engine",
        position_from_tail_m: 0.0,
        rocket_type: "hybrid"
      },
      electronics_bay: {
        id: crypto.randomUUID(),
        name: "Hybrid Avionics",
        position_from_tail_m: 0.75, // Near nose for easy recovery
        length_m: 0.18,
        diameter_m: 0.075,
        components: ["gps", "altimeter", "recovery_charges", "data_logger", "hybrid_control"],
        color: "#B87333"
      },
      parachutes: [
        {
          id: crypto.randomUUID(),
          name: "Drogue Chute",
          cd_s_m2: 0.5,
          trigger: "apogee",
          sampling_rate_hz: 105.0,
          lag_s: 0.8,
          noise_bias: 0.0,
          noise_deviation: 5.0,
          noise_correlation: 0.8,
          position_from_tail_m: 0.80,
          color: "#F39C12"
        },
        {
          id: crypto.randomUUID(),
          name: "Main Recovery",
          cd_s_m2: 3.0,
          trigger: 300, // Deploy at 300m AGL
          sampling_rate_hz: 105.0,
          lag_s: 1.2,
          noise_bias: 0.0,
          noise_deviation: 5.0,
          noise_correlation: 0.8,
          position_from_tail_m: 0.60,
          color: "#E67E22"
        }
      ],
      coordinate_system: "tail_to_nose"
    }
  }
};

/**
 * Get template by ID
 */
export function getTemplate(id: string): RocketTemplate | null {
  return ROCKET_TEMPLATES[id] || null;
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: RocketTemplate['category']): RocketTemplate[] {
  return Object.values(ROCKET_TEMPLATES).filter(template => template.category === category);
}

/**
 * Get beginner-friendly templates
 */
export function getBeginnerTemplates(): RocketTemplate[] {
  return Object.values(ROCKET_TEMPLATES).filter(template => 
    template.category === 'beginner' || template.complexity === 'simple'
  );
}

/**
 * Get templates by target altitude range
 */
export function getTemplatesByAltitude(minAltitude: number, maxAltitude: number): RocketTemplate[] {
  return Object.values(ROCKET_TEMPLATES).filter(template => 
    template.targetAltitude_m >= minAltitude && template.targetAltitude_m <= maxAltitude
  );
}

/**
 * Create a rocket from template with new IDs
 */
export function createRocketFromTemplate(templateId: string, customName?: string): Rocket | null {
  const template = getTemplate(templateId);
  if (!template) return null;

  // Deep clone the config and regenerate all IDs
  const config = JSON.parse(JSON.stringify(template.config)) as Rocket;
  
  config.id = crypto.randomUUID();
  config.name = customName || template.name;
  config.nose_cone.id = crypto.randomUUID();
  config.motor.id = crypto.randomUUID();
  
  config.body_tubes.forEach(body => {
    body.id = crypto.randomUUID();
  });
  
  config.fins.forEach(fin => {
    fin.id = crypto.randomUUID();
  });
  
  config.parachutes.forEach(parachute => {
    parachute.id = crypto.randomUUID();
  });
  
  return config;
}

/**
 * Get default rocket (basic starter template)
 */
export function getDefaultRocket(): Rocket {
  return createRocketFromTemplate("basic_starter", "Default Rocket") || ROCKET_TEMPLATES.basic_starter.config;
}

/**
 * Template shortcuts for common access
 */
export const TEMPLATES = {
  DEFAULT: ROCKET_TEMPLATES.basic_starter,
  BEGINNER: ROCKET_TEMPLATES.basic_starter,
  SPORT: ROCKET_TEMPLATES.sport_rocket,
  ADVANCED: ROCKET_TEMPLATES.high_performance,
  COMPETITION: ROCKET_TEMPLATES.competition_rocket
} as const; 