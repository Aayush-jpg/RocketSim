-- Migration: Component-Based Architecture Transition
-- ====================================================
-- 
-- This migration transitions the database from legacy parts-based rocket storage
-- to the new professional component-based architecture with SI units and material properties.
-- 
-- **Key Changes:**
-- - Converts existing parts arrays to structured component objects
-- - Adds material property fields (density, thickness, surface roughness)
-- - Implements SI unit standardization
-- - Preserves all existing rocket data with backward compatibility
-- - Adds professional engineering metadata
-- 
-- **Migration Strategy:**
-- 1. Create backup of existing data
-- 2. Convert legacy parts to component structure
-- 3. Add material properties with engineering defaults
-- 4. Update rocket metadata and versioning
-- 5. Clean up legacy columns (optional)
-- 
-- @version 3.0.0 - Component-based architecture migration
-- @created 2025-06-05
-- @author ROCKETv1 Team

BEGIN;

-- Create backup table for rollback safety
CREATE TABLE IF NOT EXISTS rockets_legacy_backup AS 
SELECT * FROM rockets;

-- Create function to convert legacy parts to component structure
CREATE OR REPLACE FUNCTION convert_legacy_to_components(legacy_parts jsonb)
RETURNS jsonb AS $$
DECLARE
  components jsonb := '{}';
  part jsonb;
  nose_cone jsonb := NULL;
  body_tubes jsonb := '[]';
  fins jsonb := '[]';
  motor jsonb := NULL;
  parachutes jsonb := '[]';
  body_tube jsonb;
  fin jsonb;
BEGIN
  -- Process each part in the legacy parts array
  FOR part IN SELECT * FROM jsonb_array_elements(legacy_parts)
  LOOP
    CASE part->>'type'
      WHEN 'nose' THEN
        nose_cone := jsonb_build_object(
          'id', COALESCE(part->>'id', gen_random_uuid()::text),
          'shape', COALESCE(part->>'shape', 'ogive'),
          'length_m', CASE 
            WHEN part->'length' IS NOT NULL THEN (part->>'length')::numeric / 100.0  -- Convert cm to m
            ELSE 0.15 
          END,
          'base_radius_m', CASE 
            WHEN part->'baseØ' IS NOT NULL THEN (part->>'baseØ')::numeric / 200.0  -- Convert cm diameter to m radius
            WHEN part->'baseDiameter' IS NOT NULL THEN (part->>'baseDiameter')::numeric / 200.0
            ELSE 0.05 
          END,
          'wall_thickness_m', 0.002,  -- Professional default: 2mm
          'material_density_kg_m3', 1600.0,  -- Fiberglass
          'surface_roughness_m', 1e-5,  -- Professional surface finish
          'color', COALESCE(part->>'color', '#A0A7B8')
        );
        
      WHEN 'body' THEN
        body_tube := jsonb_build_object(
          'id', COALESCE(part->>'id', gen_random_uuid()::text),
          'outer_radius_m', CASE 
            WHEN part->'Ø' IS NOT NULL THEN (part->>'Ø')::numeric / 200.0  -- Convert cm diameter to m radius
            WHEN part->'diameter' IS NOT NULL THEN (part->>'diameter')::numeric / 200.0
            ELSE 0.05 
          END,
          'length_m', CASE 
            WHEN part->'length' IS NOT NULL THEN (part->>'length')::numeric / 100.0  -- Convert cm to m
            ELSE 0.40 
          END,
          'wall_thickness_m', 0.003,  -- Professional default: 3mm
          'material_density_kg_m3', 1600.0,  -- Fiberglass
          'surface_roughness_m', 1e-5,  -- Professional surface finish
          'color', COALESCE(part->>'color', '#8C8D91')
        );
        body_tubes := body_tubes || body_tube;
        
      WHEN 'fin' THEN
        fin := jsonb_build_object(
          'id', COALESCE(part->>'id', gen_random_uuid()::text),
          'fin_count', 3,  -- Standard configuration
          'root_chord_m', CASE 
            WHEN part->'root' IS NOT NULL THEN (part->>'root')::numeric / 100.0  -- Convert cm to m
            ELSE 0.08 
          END,
          'tip_chord_m', CASE 
            WHEN part->'root' IS NOT NULL THEN (part->>'root')::numeric / 200.0  -- Half of root
            ELSE 0.04 
          END,
          'span_m', CASE 
            WHEN part->'span' IS NOT NULL THEN (part->>'span')::numeric / 100.0  -- Convert cm to m
            ELSE 0.06 
          END,
          'sweep_length_m', CASE 
            WHEN part->'sweep' IS NOT NULL THEN (part->>'sweep')::numeric / 100.0  -- Convert cm to m
            ELSE 0.02 
          END,
          'thickness_m', 0.006,  -- Professional default: 6mm
          'material_density_kg_m3', 650.0,  -- Plywood
          'airfoil', 'symmetric',
          'cant_angle_deg', 0.0,
          'color', COALESCE(part->>'color', '#A0A7B8')
        );
        fins := fins || fin;
        
      WHEN 'engine' THEN
        motor := jsonb_build_object(
          'id', COALESCE(part->>'id', 'motor'),
          'motor_database_id', 'C6-5',  -- Default motor
          'position_from_tail_m', 0.0
        );
        
      ELSE
        -- Skip unknown part types
        NULL;
    END CASE;
  END LOOP;
  
  -- Set defaults if components are missing
  IF nose_cone IS NULL THEN
    nose_cone := jsonb_build_object(
      'id', gen_random_uuid()::text,
      'shape', 'ogive',
      'length_m', 0.15,
      'base_radius_m', 0.05,
      'wall_thickness_m', 0.002,
      'material_density_kg_m3', 1600.0,
      'surface_roughness_m', 1e-5,
      'color', '#A0A7B8'
    );
  END IF;
  
  IF motor IS NULL THEN
    motor := jsonb_build_object(
      'id', 'motor',
      'motor_database_id', 'C6-5',
      'position_from_tail_m', 0.0
    );
  END IF;
  
  -- Add default parachute
  parachutes := jsonb_build_array(jsonb_build_object(
    'id', gen_random_uuid()::text,
    'name', 'Main Parachute',
    'cd_s_m2', 1.0,
    'trigger', 'apogee',
    'sampling_rate_hz', 105.0,
    'lag_s', 1.5,
    'noise_bias', 0.0,
    'noise_deviation', 8.3,
    'noise_correlation', 0.5,
    'position_from_tail_m', 0.0,
    'color', '#FF6B35'
  ));
  
  -- Build final component structure
  components := jsonb_build_object(
    'nose_cone', nose_cone,
    'body_tubes', body_tubes,
    'fins', fins,
    'motor', motor,
    'parachutes', parachutes,
    'coordinate_system', 'tail_to_nose'
  );
  
  RETURN components;
END;
$$ LANGUAGE plpgsql;

-- Migrate existing rockets to component-based structure
UPDATE rockets 
SET 
  parts = convert_legacy_to_components(parts),
  units = 'metric',  -- Standardize on metric system
  updated_at = NOW()
WHERE parts IS NOT NULL;

-- Update rocket versions to component-based structure
UPDATE rocket_versions 
SET 
  parts = convert_legacy_to_components(
    CASE 
      WHEN parts::text LIKE '[%'::text THEN parts::jsonb  -- Already array format
      ELSE jsonb_build_array(parts)  -- Convert single object to array
    END
  ),
  units = 'metric'
WHERE parts IS NOT NULL;

-- Add indexes for better performance on component-based queries
CREATE INDEX IF NOT EXISTS idx_rockets_nose_cone_shape 
ON rockets USING btree ((parts->'nose_cone'->>'shape'));

CREATE INDEX IF NOT EXISTS idx_rockets_motor_id 
ON rockets USING btree ((parts->'motor'->>'motor_database_id'));

CREATE INDEX IF NOT EXISTS idx_rockets_body_count 
ON rockets USING btree ((jsonb_array_length(parts->'body_tubes')));

-- Add materialized view for rocket statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS rocket_component_stats AS
SELECT 
  parts->'nose_cone'->>'shape' as nose_shape,
  parts->'motor'->>'motor_database_id' as motor_id,
  jsonb_array_length(parts->'body_tubes') as body_tube_count,
  jsonb_array_length(parts->'fins') as fin_set_count,
  jsonb_array_length(parts->'parachutes') as parachute_count,
  COUNT(*) as rocket_count
FROM rockets
WHERE parts IS NOT NULL
GROUP BY 
  parts->'nose_cone'->>'shape',
  parts->'motor'->>'motor_database_id',
  jsonb_array_length(parts->'body_tubes'),
  jsonb_array_length(parts->'fins'),
  jsonb_array_length(parts->'parachutes');

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_rocket_component_stats_nose_shape 
ON rocket_component_stats (nose_shape);

CREATE INDEX IF NOT EXISTS idx_rocket_component_stats_motor 
ON rocket_component_stats (motor_id);

-- Add function to refresh component stats
CREATE OR REPLACE FUNCTION refresh_rocket_component_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW rocket_component_stats;
END;
$$ LANGUAGE plpgsql;

-- Set up automatic refresh trigger
CREATE OR REPLACE FUNCTION trigger_refresh_component_stats()
RETURNS trigger AS $$
BEGIN
  -- Refresh stats in background to avoid blocking
  PERFORM pg_notify('refresh_component_stats', '');
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS rocket_component_stats_refresh ON rockets;
CREATE TRIGGER rocket_component_stats_refresh
  AFTER INSERT OR UPDATE OR DELETE ON rockets
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_component_stats();

-- Add comment documenting the migration
COMMENT ON TABLE rockets IS 'Rocket designs using component-based architecture with SI units and material properties. Migrated from legacy parts-based format on 2025-06-05.';

COMMENT ON COLUMN rockets.parts IS 'Component-based rocket structure with nose_cone, body_tubes, fins, motor, and parachutes objects. Uses SI units and material properties for professional engineering analysis.';

-- Clean up migration function (optional - keep for debugging)
-- DROP FUNCTION IF EXISTS convert_legacy_to_components(jsonb);

COMMIT;

-- Instructions for verification:
-- 1. Check rocket count: SELECT COUNT(*) FROM rockets;
-- 2. Verify component structure: SELECT parts FROM rockets LIMIT 1;
-- 3. Check material properties: SELECT parts->'nose_cone'->'material_density_kg_m3' FROM rockets LIMIT 5;
-- 4. Verify SI units: SELECT parts->'nose_cone'->'length_m', parts->'body_tubes'->0->'outer_radius_m' FROM rockets LIMIT 5;
-- 5. Test rollback if needed: UPDATE rockets SET parts = rockets_legacy_backup.parts FROM rockets_legacy_backup WHERE rockets.id = rockets_legacy_backup.id; 