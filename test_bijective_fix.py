#!/usr/bin/env python3
"""
Test script to verify the "Function is not bijective" error fix for NRLMSISE atmospheric models.

This script tests the pressure profile smoothing function to ensure it creates monotonic
pressure profiles that can be used to create valid barometric height functions.
"""

import numpy as np
import sys
import os

# Add the services directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'services', 'rocketpy'))

from app import ensure_monotonic_pressure_profile

def create_non_monotonic_pressure_profile():
    """Create a realistic non-monotonic pressure profile similar to what NRLMSISE might produce"""
    # Altitude from 0 to 50km
    altitudes = np.linspace(0, 50000, 100)
    
    # Base exponential decrease
    base_pressures = 101325 * np.exp(-altitudes / 8000)
    
    # Add temperature inversion effects (pressure oscillations)
    inversion_effect = 500 * np.sin(altitudes / 2000) * np.exp(-altitudes / 15000)
    
    # Add atmospheric wave disturbances
    wave_effect = 200 * np.sin(altitudes / 1000) * np.exp(-altitudes / 10000)
    
    # Combine effects to create non-monotonic profile
    pressures = base_pressures + inversion_effect + wave_effect
    
    return altitudes, pressures

def test_monotonicity_check(pressures):
    """Check if pressure profile is monotonic"""
    pressure_diff = np.diff(pressures)
    is_monotonic = np.all(pressure_diff < 0)  # Should be decreasing
    
    if not is_monotonic:
        non_monotonic_points = np.where(pressure_diff >= 0)[0]
        print(f"❌ Profile is NOT monotonic. {len(non_monotonic_points)} non-monotonic points found.")
        return False
    else:
        print("✅ Profile IS monotonic.")
        return True

def test_rocketpy_function_creation(altitudes, pressures):
    """Test if RocketPy can create a Function object and its inverse"""
    try:
        # This simulates what RocketPy does internally
        from rocketpy import Function
        
        # Create pressure function
        pressure_data = list(zip(altitudes, pressures))
        pressure_func = Function(
            pressure_data,
            inputs="Height Above Sea Level (m)",
            outputs="Pressure (Pa)",
            interpolation="linear"
        )
        
        # Try to create barometric height (inverse function)
        barometric_height = pressure_func.inverse_function()
        
        print("✅ Successfully created RocketPy Function and its inverse")
        return True
        
    except Exception as e:
        if "bijective" in str(e).lower():
            print(f"❌ RocketPy bijective error: {e}")
        else:
            print(f"❌ RocketPy error: {e}")
        return False

def main():
    print("🧪 Testing Pressure Profile Smoothing Fix for NRLMSISE Bijective Error")
    print("=" * 70)
    
    # Test 1: Create problematic pressure profile
    print("\n1️⃣ Creating non-monotonic pressure profile (simulating NRLMSISE output)...")
    altitudes, original_pressures = create_non_monotonic_pressure_profile()
    
    print(f"   Original profile: {len(original_pressures)} points")
    print(f"   Altitude range: {altitudes[0]:.0f} - {altitudes[-1]:.0f} m")
    print(f"   Pressure range: {original_pressures[-1]:.1f} - {original_pressures[0]:.1f} Pa")
    
    # Test 2: Check original monotonicity
    print("\n2️⃣ Testing original profile monotonicity...")
    original_is_monotonic = test_monotonicity_check(original_pressures)
    
    # Test 3: Test RocketPy with original profile
    print("\n3️⃣ Testing RocketPy Function creation with original profile...")
    original_works = test_rocketpy_function_creation(altitudes, original_pressures)
    
    # Test 4: Apply smoothing fix
    print("\n4️⃣ Applying pressure profile smoothing fix...")
    try:
        smoothed_pressures, smoothed_altitudes = ensure_monotonic_pressure_profile(
            original_pressures, altitudes, smoothing_window=5
        )
        print(f"   ✅ Smoothing successful")
        print(f"   Smoothed profile: {len(smoothed_pressures)} points")
        print(f"   Altitude range: {smoothed_altitudes[0]:.0f} - {smoothed_altitudes[-1]:.0f} m")
        print(f"   Pressure range: {smoothed_pressures[-1]:.1f} - {smoothed_pressures[0]:.1f} Pa")
    except Exception as e:
        print(f"   ❌ Smoothing failed: {e}")
        return False
    
    # Test 5: Check smoothed monotonicity
    print("\n5️⃣ Testing smoothed profile monotonicity...")
    smoothed_is_monotonic = test_monotonicity_check(smoothed_pressures)
    
    # Test 6: Test RocketPy with smoothed profile
    print("\n6️⃣ Testing RocketPy Function creation with smoothed profile...")
    smoothed_works = test_rocketpy_function_creation(smoothed_altitudes, smoothed_pressures)
    
    # Summary
    print("\n" + "=" * 70)
    print("📊 TEST RESULTS SUMMARY:")
    print(f"   Original profile monotonic: {'✅' if original_is_monotonic else '❌'}")
    print(f"   Original RocketPy works:    {'✅' if original_works else '❌'}")
    print(f"   Smoothed profile monotonic: {'✅' if smoothed_is_monotonic else '❌'}")
    print(f"   Smoothed RocketPy works:    {'✅' if smoothed_works else '❌'}")
    
    # Overall result
    fix_successful = (not original_works) and smoothed_works and smoothed_is_monotonic
    
    print("\n🎯 OVERALL RESULT:")
    if fix_successful:
        print("   ✅ SUCCESS: Fix resolves the bijective error!")
        print("   ✅ NRLMSISE atmospheric models should now work without errors.")
    else:
        print("   ❌ FAILURE: Fix did not resolve the issue.")
        
    print("=" * 70)
    
    return fix_successful

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 