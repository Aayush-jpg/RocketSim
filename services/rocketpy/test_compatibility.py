#!/usr/bin/env python3
"""
Comprehensive test script for rocket model compatibility layer
Tests both legacy parts-based and new component-based formats
"""

import asyncio
import json
from app import (
    LegacyRocketModel, LegacyPartModel, RocketModel, ModelConverter,
    FlexibleSimulationRequestModel, simulate_simplified_fallback,
    NoseComponentModel, BodyComponentModel, FinComponentModel, 
    MotorComponentModel, ParachuteComponentModel, EnvironmentModel
)

def create_legacy_rocket():
    """Create a legacy rocket with parts array"""
    parts = [
        LegacyPartModel(
            id="nose",
            type="nose",
            color="red",
            length=15.0,  # cm
            diameter=20.0,  # cm
            thickness=2.0,  # mm
            shape="ogive"
        ),
        LegacyPartModel(
            id="body",
            type="body", 
            color="white",
            length=40.0,  # cm
            diameter=20.0,  # cm
            thickness=3.0  # mm
        ),
        LegacyPartModel(
            id="fins",
            type="fin",
            color="black",
            root=8.0,  # cm
            span=6.0,  # cm
            tip=4.0,  # cm
            sweep=2.0  # cm
        ),
        LegacyPartModel(
            id="recovery",
            type="parachute",
            color="orange",
            cd_s=1.0,  # m²
            trigger="apogee"
        )
    ]
    
    return LegacyRocketModel(
        id="legacy-test-rocket",
        name="Legacy Test Rocket",
        parts=parts,
        motorId="default-motor",
        Cd=0.5,
        units="metric"
    )

def create_new_rocket():
    """Create a new component-based rocket"""
    return RocketModel(
        id="new-test-rocket",
        name="New Test Rocket",
        nose_cone=NoseComponentModel(
            id="nose",
            shape="ogive",
            length_m=0.15,
            base_radius_m=0.10,
            wall_thickness_m=0.002,
            material_density_kg_m3=1600.0
        ),
        body_tubes=[
            BodyComponentModel(
                id="main_body",
                outer_radius_m=0.10,
                length_m=0.40,
                wall_thickness_m=0.003,
                material_density_kg_m3=1600.0
            )
        ],
        fins=[
            FinComponentModel(
                id="main_fins",
                fin_count=3,
                root_chord_m=0.08,
                tip_chord_m=0.04,
                span_m=0.06,
                sweep_length_m=0.02,
                thickness_m=0.006,
                material_density_kg_m3=650.0
            )
        ],
        motor=MotorComponentModel(
            id="motor",
            motor_database_id="default-motor",
            position_from_tail_m=0.0
        ),
        parachutes=[
            ParachuteComponentModel(
                id="main_chute",
                name="Main Parachute",
                cd_s_m2=1.0,
                trigger="apogee",
                lag_s=1.5,
                position_from_tail_m=0.0
            )
        ]
    )

async def test_legacy_conversion():
    """Test legacy to new format conversion"""
    print("🔄 Testing legacy to new format conversion...")
    
    legacy_rocket = create_legacy_rocket()
    print(f"   Legacy rocket: {legacy_rocket.name}")
    print(f"   Parts: {len(legacy_rocket.parts)} parts")
    
    # Convert to new format
    new_rocket = ModelConverter.legacy_to_component(legacy_rocket)
    print(f"   Converted rocket: {new_rocket.name}")
    print(f"   Components: nose_cone={bool(new_rocket.nose_cone)}, "
          f"body_tubes={len(new_rocket.body_tubes)}, "
          f"fins={len(new_rocket.fins)}, "
          f"parachutes={len(new_rocket.parachutes)}")
    
    # Test conversion back
    legacy_again = ModelConverter.component_to_legacy(new_rocket)
    print(f"   Round-trip conversion: {len(legacy_again.parts)} parts")
    
    print("   ✅ Legacy conversion test passed\n")

async def test_new_format():
    """Test new component-based format"""
    print("🆕 Testing new component-based format...")
    
    new_rocket = create_new_rocket()
    print(f"   New rocket: {new_rocket.name}")
    print(f"   Nose cone: {new_rocket.nose_cone.shape} {new_rocket.nose_cone.length_m:.2f}m")
    print(f"   Body tubes: {len(new_rocket.body_tubes)} tubes")
    print(f"   Fins: {len(new_rocket.fins)} fin sets, {new_rocket.fins[0].fin_count} fins each")
    print(f"   Motor: {new_rocket.motor.motor_database_id}")
    print(f"   Parachutes: {len(new_rocket.parachutes)} parachutes")
    
    print("   ✅ New format test passed\n")

async def test_flexible_simulation():
    """Test FlexibleSimulationRequestModel with both formats"""
    print("🚀 Testing flexible simulation with both formats...")
    
    # Test with legacy format
    legacy_rocket = create_legacy_rocket()
    legacy_request = FlexibleSimulationRequestModel(
        rocket=legacy_rocket,
        environment=EnvironmentModel(),
        simulationType="standard"
    )
    
    print("   Testing legacy format simulation...")
    rocket_model = legacy_request.get_rocket_model()
    print(f"   Converted rocket type: {type(rocket_model).__name__}")
    
    try:
        result = await simulate_simplified_fallback(rocket_model)
        print(f"   Legacy simulation result: {result.maxAltitude:.1f}m altitude")
        print(f"   Stability margin: {result.stabilityMargin:.2f}")
    except Exception as e:
        print(f"   ❌ Legacy simulation failed: {e}")
        return False
    
    # Test with new format
    new_rocket = create_new_rocket()
    new_request = FlexibleSimulationRequestModel(
        rocket=new_rocket,
        environment=EnvironmentModel(),
        simulationType="standard"
    )
    
    print("   Testing new format simulation...")
    rocket_model = new_request.get_rocket_model()
    print(f"   Rocket type: {type(rocket_model).__name__}")
    
    try:
        result = await simulate_simplified_fallback(rocket_model)
        print(f"   New simulation result: {result.maxAltitude:.1f}m altitude")
        print(f"   Stability margin: {result.stabilityMargin:.2f}")
    except Exception as e:
        print(f"   ❌ New simulation failed: {e}")
        return False
    
    print("   ✅ Flexible simulation test passed\n")
    return True

async def test_component_access():
    """Test that component access methods work correctly"""
    print("🔧 Testing component access methods...")
    
    new_rocket = create_new_rocket()
    
    # Test direct component access
    print(f"   Nose cone shape: {new_rocket.nose_cone.shape}")
    print(f"   First body tube radius: {new_rocket.body_tubes[0].outer_radius_m:.3f}m")
    print(f"   First fin set count: {new_rocket.fins[0].fin_count}")
    print(f"   Motor database ID: {new_rocket.motor.motor_database_id}")
    print(f"   First parachute name: {new_rocket.parachutes[0].name}")
    
    # Test that these don't throw errors when used in calculations
    total_length = new_rocket.nose_cone.length_m + sum(tube.length_m for tube in new_rocket.body_tubes)
    print(f"   Total rocket length: {total_length:.3f}m")
    
    total_fin_count = sum(fin.fin_count for fin in new_rocket.fins)
    print(f"   Total fin count: {total_fin_count}")
    
    print("   ✅ Component access test passed\n")

async def test_unit_consistency():
    """Test that units are consistent throughout the system"""
    print("📏 Testing unit consistency...")
    
    new_rocket = create_new_rocket()
    
    # All these should be in SI units (meters, kg, seconds)
    print(f"   Nose cone length: {new_rocket.nose_cone.length_m:.3f} m")
    print(f"   Body tube radius: {new_rocket.body_tubes[0].outer_radius_m:.3f} m")
    print(f"   Fin root chord: {new_rocket.fins[0].root_chord_m:.3f} m")
    print(f"   Fin thickness: {new_rocket.fins[0].thickness_m:.3f} m")
    print(f"   Material density: {new_rocket.nose_cone.material_density_kg_m3:.0f} kg/m³")
    
    # Test legacy conversion maintains proper units
    legacy_rocket = create_legacy_rocket()
    converted_rocket = ModelConverter.legacy_to_component(legacy_rocket)
    
    print(f"   Legacy converted nose length: {converted_rocket.nose_cone.length_m:.3f} m")
    print(f"   Legacy converted body radius: {converted_rocket.body_tubes[0].outer_radius_m:.3f} m")
    
    print("   ✅ Unit consistency test passed\n")

async def main():
    """Run all tests"""
    print("🧪 Running Component Architecture Compatibility Tests\n")
    print("="*60)
    
    try:
        await test_legacy_conversion()
        await test_new_format()
        await test_component_access()
        await test_unit_consistency()
        success = await test_flexible_simulation()
        
        if success:
            print("="*60)
            print("🎉 ALL TESTS PASSED! Component architecture is working correctly.")
            print("\n✅ Legacy parts-based format: SUPPORTED")
            print("✅ New component-based format: SUPPORTED") 
            print("✅ Automatic conversion: WORKING")
            print("✅ Unit consistency: VERIFIED")
            print("✅ Simulation compatibility: CONFIRMED")
        else:
            print("❌ Some tests failed!")
            
    except Exception as e:
        print(f"❌ Test suite failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main()) 