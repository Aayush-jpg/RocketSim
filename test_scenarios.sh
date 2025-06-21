#!/bin/bash

echo "🧪 Testing NRLMSISE Environment Data Propagation Scenarios"
echo "=========================================================="

# Test 1: NRLMSISE with Real Coordinates (Washington DC)
echo ""
echo "🌍 Test 1: NRLMSISE Model with Real Coordinates (Washington DC: 39°N, 77°W)"
echo "Expected: Should work without set_date() errors, use real coordinates"

curl -s -X POST http://localhost:8000/simulate/monte-carlo \
  -H "Content-Type: application/json" \
  -d '{
    "rocket": {
      "id": "test-nrlmsise-1",
      "name": "NRLMSISE Test Rocket",
      "nose_cone": {"id": "nose-1", "shape": "ogive", "length_m": 0.325, "base_radius_m": 0.065, "wall_thickness_m": 0.002, "surface_roughness_m": 0.00001, "material_density_kg_m3": 1600},
      "body_tubes": [{"id": "body-1", "outer_radius_m": 0.065, "length_m": 1.3, "wall_thickness_m": 0.003, "surface_roughness_m": 0.00001, "material_density_kg_m3": 1600}],
      "fins": [{"id": "fins-1", "fin_count": 3, "root_chord_m": 0.17, "tip_chord_m": 0.08, "span_m": 0.133, "sweep_length_m": 0.136, "thickness_m": 0.006, "material_density_kg_m3": 650, "cant_angle_deg": 0, "airfoil": "symmetric"}],
      "motor": {"id": "motor-1", "motor_database_id": "large-liquid", "position_from_tail_m": 0},
      "parachutes": [{"id": "parachute-1", "name": "Recovery Parachute", "cd_s_m2": 1.8, "trigger": "apogee", "lag_s": 1.5, "noise_bias": 0, "noise_deviation": 8.3, "noise_correlation": 0.5, "sampling_rate_hz": 105, "position_from_tail_m": 0}],
      "coordinate_system": "tail_to_nose",
      "Cd": 0.17
    },
    "environment": {
      "latitude_deg": 39.0,
      "longitude_deg": -77.0,
      "elevation_m": 100.0,
      "wind_speed_m_s": 2.5,
      "wind_direction_deg": 270.0,
      "atmospheric_model": "nrlmsise",
      "date": "2024-01-15"
    },
    "launchParameters": {
      "rail_length_m": 5.0,
      "inclination_deg": 85.0,
      "heading_deg": 0.0
    },
    "variations": [
      {"parameter": "environment.wind_speed_m_s", "distribution": "uniform", "parameters": [0, 5]},
      {"parameter": "rocket.Cd", "distribution": "normal", "parameters": [0.17, 0.017]}
    ],
    "iterations": 5
  }' | jq -r '.nominal.maxAltitude // "ERROR: " + (.detail // "Unknown error")'

echo ""
echo "🌍 Test 2: Standard Model with Real Coordinates (Same location)"
echo "Expected: Should work normally, baseline comparison"

curl -s -X POST http://localhost:8000/simulate/monte-carlo \
  -H "Content-Type: application/json" \
  -d '{
    "rocket": {
      "id": "test-standard-1",
      "name": "Standard Test Rocket",
      "nose_cone": {"id": "nose-1", "shape": "ogive", "length_m": 0.325, "base_radius_m": 0.065, "wall_thickness_m": 0.002, "surface_roughness_m": 0.00001, "material_density_kg_m3": 1600},
      "body_tubes": [{"id": "body-1", "outer_radius_m": 0.065, "length_m": 1.3, "wall_thickness_m": 0.003, "surface_roughness_m": 0.00001, "material_density_kg_m3": 1600}],
      "fins": [{"id": "fins-1", "fin_count": 3, "root_chord_m": 0.17, "tip_chord_m": 0.08, "span_m": 0.133, "sweep_length_m": 0.136, "thickness_m": 0.006, "material_density_kg_m3": 650, "cant_angle_deg": 0, "airfoil": "symmetric"}],
      "motor": {"id": "motor-1", "motor_database_id": "large-liquid", "position_from_tail_m": 0},
      "parachutes": [{"id": "parachute-1", "name": "Recovery Parachute", "cd_s_m2": 1.8, "trigger": "apogee", "lag_s": 1.5, "noise_bias": 0, "noise_deviation": 8.3, "noise_correlation": 0.5, "sampling_rate_hz": 105, "position_from_tail_m": 0}],
      "coordinate_system": "tail_to_nose",
      "Cd": 0.17
    },
    "environment": {
      "latitude_deg": 39.0,
      "longitude_deg": -77.0,
      "elevation_m": 100.0,
      "wind_speed_m_s": 2.5,
      "wind_direction_deg": 270.0,
      "atmospheric_model": "standard",
      "date": "2024-01-15"
    },
    "launchParameters": {
      "rail_length_m": 5.0,
      "inclination_deg": 85.0,
      "heading_deg": 0.0
    },
    "variations": [
      {"parameter": "environment.wind_speed_m_s", "distribution": "uniform", "parameters": [0, 5]},
      {"parameter": "rocket.Cd", "distribution": "normal", "parameters": [0.17, 0.017]}
    ],
    "iterations": 5
  }' | jq -r '.nominal.maxAltitude // "ERROR: " + (.detail // "Unknown error")'

echo ""
echo "🌍 Test 3: NRLMSISE with Zero Coordinates (Previous Problem Case)"
echo "Expected: Should work but use 0,0 coordinates"

curl -s -X POST http://localhost:8000/simulate/monte-carlo \
  -H "Content-Type: application/json" \
  -d '{
    "rocket": {
      "id": "test-zero-coords",
      "name": "Zero Coords Test",
      "nose_cone": {"id": "nose-1", "shape": "ogive", "length_m": 0.325, "base_radius_m": 0.065, "wall_thickness_m": 0.002, "surface_roughness_m": 0.00001, "material_density_kg_m3": 1600},
      "body_tubes": [{"id": "body-1", "outer_radius_m": 0.065, "length_m": 1.3, "wall_thickness_m": 0.003, "surface_roughness_m": 0.00001, "material_density_kg_m3": 1600}],
      "fins": [{"id": "fins-1", "fin_count": 3, "root_chord_m": 0.17, "tip_chord_m": 0.08, "span_m": 0.133, "sweep_length_m": 0.136, "thickness_m": 0.006, "material_density_kg_m3": 650, "cant_angle_deg": 0, "airfoil": "symmetric"}],
      "motor": {"id": "motor-1", "motor_database_id": "large-liquid", "position_from_tail_m": 0},
      "parachutes": [{"id": "parachute-1", "name": "Recovery Parachute", "cd_s_m2": 1.8, "trigger": "apogee", "lag_s": 1.5, "noise_bias": 0, "noise_deviation": 8.3, "noise_correlation": 0.5, "sampling_rate_hz": 105, "position_from_tail_m": 0}],
      "coordinate_system": "tail_to_nose",
      "Cd": 0.17
    },
    "environment": {
      "latitude_deg": 0.0,
      "longitude_deg": 0.0,
      "elevation_m": 0.0,
      "wind_speed_m_s": 0.0,
      "wind_direction_deg": 0.0,
      "atmospheric_model": "nrlmsise",
      "date": "2024-01-15"
    },
    "launchParameters": {
      "rail_length_m": 5.0,
      "inclination_deg": 85.0,
      "heading_deg": 0.0
    },
    "variations": [
      {"parameter": "environment.wind_speed_m_s", "distribution": "uniform", "parameters": [0, 5]},
      {"parameter": "rocket.Cd", "distribution": "normal", "parameters": [0.17, 0.017]}
    ],
    "iterations": 5
  }' | jq -r '.nominal.maxAltitude // "ERROR: " + (.detail // "Unknown error")'

echo ""
echo "🌍 Test 4: NRLMSISE with Different Location (London)"
echo "Expected: Should work with different atmospheric conditions"

curl -s -X POST http://localhost:8000/simulate/monte-carlo \
  -H "Content-Type: application/json" \
  -d '{
    "rocket": {
      "id": "test-london",
      "name": "London Test",
      "nose_cone": {"id": "nose-1", "shape": "ogive", "length_m": 0.325, "base_radius_m": 0.065, "wall_thickness_m": 0.002, "surface_roughness_m": 0.00001, "material_density_kg_m3": 1600},
      "body_tubes": [{"id": "body-1", "outer_radius_m": 0.065, "length_m": 1.3, "wall_thickness_m": 0.003, "surface_roughness_m": 0.00001, "material_density_kg_m3": 1600}],
      "fins": [{"id": "fins-1", "fin_count": 3, "root_chord_m": 0.17, "tip_chord_m": 0.08, "span_m": 0.133, "sweep_length_m": 0.136, "thickness_m": 0.006, "material_density_kg_m3": 650, "cant_angle_deg": 0, "airfoil": "symmetric"}],
      "motor": {"id": "motor-1", "motor_database_id": "large-liquid", "position_from_tail_m": 0},
      "parachutes": [{"id": "parachute-1", "name": "Recovery Parachute", "cd_s_m2": 1.8, "trigger": "apogee", "lag_s": 1.5, "noise_bias": 0, "noise_deviation": 8.3, "noise_correlation": 0.5, "sampling_rate_hz": 105, "position_from_tail_m": 0}],
      "coordinate_system": "tail_to_nose",
      "Cd": 0.17
    },
    "environment": {
      "latitude_deg": 51.5074,
      "longitude_deg": -0.1278,
      "elevation_m": 25.0,
      "wind_speed_m_s": 5.0,
      "wind_direction_deg": 180.0,
      "atmospheric_model": "nrlmsise",
      "date": "2024-06-15"
    },
    "launchParameters": {
      "rail_length_m": 5.0,
      "inclination_deg": 85.0,
      "heading_deg": 0.0
    },
    "variations": [
      {"parameter": "environment.wind_speed_m_s", "distribution": "uniform", "parameters": [0, 8]},
      {"parameter": "rocket.Cd", "distribution": "normal", "parameters": [0.17, 0.017]}
    ],
    "iterations": 5
  }' | jq -r '.nominal.maxAltitude // "ERROR: " + (.detail // "Unknown error")'

echo ""
echo "✅ Test Complete! All scenarios tested."
echo "If all tests show altitude values (not errors), the fixes are working correctly." 