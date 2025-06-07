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
    name: "Basic Starter Rocket",
    description: "Perfect first rocket for beginners. Safe, reliable, and easy to build.",
    category: "beginner",
    targetAltitude_m: 200,
    complexity: "simple",
    estimatedCost: "low",
    buildTime_hours: 4,
    config: {
      id: crypto.randomUUID(),
      name: "Basic Starter",
      nose_cone: {
        id: crypto.randomUUID(),
        shape: "ogive",
        length_m: 0.35,
        base_radius_m: 0.055,
        wall_thickness_m: 0.002,
        material_density_kg_m3: MATERIALS.DENSITY_FIBERGLASS,
        surface_roughness_m: 1e-5,
        color: "#FFFFFF"
      },
      body_tubes: [{
        id: crypto.randomUUID(),
        outer_radius_m: 0.055,
        length_m: 0.70,
        wall_thickness_m: 0.003,
        material_density_kg_m3: MATERIALS.DENSITY_FIBERGLASS,
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
        material_density_kg_m3: MATERIALS.DENSITY_PLYWOOD,
        airfoil: "symmetric",
        cant_angle_deg: 0.0,
        color: "#D3D3D3"
      }],
      motor: {
        id: "motor",
        motor_database_id: "default-motor",
        position_from_tail_m: 0.0
      },
      parachutes: [{
        id: crypto.randomUUID(),
        name: "Recovery Parachute",
        cd_s_m2: 1.8,
        trigger: "apogee",
        sampling_rate_hz: 105.0,
        lag_s: 1.5,
        noise_bias: 0.0,
        noise_deviation: 8.3,
        noise_correlation: 0.5,
        position_from_tail_m: 0.0,
        color: "#E74C3C"
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
      nose_cone: {
        id: crypto.randomUUID(),
        shape: "ogive",
        length_m: 0.30,
        base_radius_m: 0.04,
        wall_thickness_m: 0.002,
        material_density_kg_m3: MATERIALS.DENSITY_FIBERGLASS,
        surface_roughness_m: 1e-5,
        color: "#E74C3C"
      },
      body_tubes: [{
        id: crypto.randomUUID(),
        outer_radius_m: 0.04,
        length_m: 0.60,
        wall_thickness_m: 0.003,
        material_density_kg_m3: MATERIALS.DENSITY_FIBERGLASS,
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
        material_density_kg_m3: MATERIALS.DENSITY_PLYWOOD,
        airfoil: "symmetric",
        cant_angle_deg: 0.0,
        color: "#2C3E50"
      }],
      motor: {
        id: "motor",
        motor_database_id: "high-power",
        position_from_tail_m: 0.0
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
      nose_cone: {
        id: crypto.randomUUID(),
        shape: "ogive",
        length_m: 0.20,
        base_radius_m: 0.06,
        wall_thickness_m: 0.002,
        material_density_kg_m3: MATERIALS.DENSITY_CARBON_FIBER,
        surface_roughness_m: 0.5e-5,
        color: "#1C1C1C"
      },
      body_tubes: [{
        id: crypto.randomUUID(),
        outer_radius_m: 0.06,
        length_m: 0.60,
        wall_thickness_m: 0.003,
        material_density_kg_m3: MATERIALS.DENSITY_CARBON_FIBER,
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
        material_density_kg_m3: MATERIALS.DENSITY_CARBON_FIBER,
        airfoil: "symmetric",
        cant_angle_deg: 0.0,
        color: "#34495E"
      }],
      motor: {
        id: "motor",
        motor_database_id: "high-power",
        position_from_tail_m: 0.0
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

  "competition": {
    id: "competition",
    name: "Competition Rocket",
    description: "Optimized for maximum altitude with minimum mass. Competition-grade design.",
    category: "competition",
    targetAltitude_m: 2000,
    complexity: "complex",
    estimatedCost: "high",
    buildTime_hours: 30,
    config: {
      id: crypto.randomUUID(),
      name: "Competition Rocket",
      nose_cone: {
        id: crypto.randomUUID(),
        shape: "elliptical",
        length_m: 0.25,
        base_radius_m: 0.055,
        wall_thickness_m: 0.001,
        material_density_kg_m3: MATERIALS.DENSITY_CARBON_FIBER,
        surface_roughness_m: 0.3e-5,
        color: "#8E44AD"
      },
      body_tubes: [{
        id: crypto.randomUUID(),
        outer_radius_m: 0.055,
        length_m: 0.80,
        wall_thickness_m: 0.002,
        material_density_kg_m3: MATERIALS.DENSITY_CARBON_FIBER,
        surface_roughness_m: 0.3e-5,
        color: "#9B59B6"
      }],
      fins: [{
        id: crypto.randomUUID(),
        fin_count: 3,
        root_chord_m: 0.10,
        tip_chord_m: 0.03,
        span_m: 0.08,
        sweep_length_m: 0.05,
        thickness_m: 0.004,
        material_density_kg_m3: MATERIALS.DENSITY_CARBON_FIBER,
        airfoil: "symmetric",
        cant_angle_deg: 0.0,
        color: "#8E44AD"
      }],
      motor: {
        id: "motor",
        motor_database_id: "super-power",
        position_from_tail_m: 0.0
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
      nose_cone: {
        id: crypto.randomUUID(),
        shape: "ogive",
        length_m: 0.30,
        base_radius_m: 0.075,
        wall_thickness_m: 0.003,
        material_density_kg_m3: MATERIALS.DENSITY_ALUMINUM,
        surface_roughness_m: 2e-6,
        color: "#BDC3C7"
      },
      body_tubes: [{
        id: crypto.randomUUID(),
        outer_radius_m: 0.075,
        length_m: 1.20,
        wall_thickness_m: 0.005,
        material_density_kg_m3: MATERIALS.DENSITY_ALUMINUM,
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
        material_density_kg_m3: MATERIALS.DENSITY_ALUMINUM,
        airfoil: "symmetric",
        cant_angle_deg: 0.0,
        color: "#7F8C8D"
      }],
      motor: {
        id: "motor",
        motor_database_id: "hybrid-engine",
        position_from_tail_m: 0.0
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
  COMPETITION: ROCKET_TEMPLATES.competition
} as const; 