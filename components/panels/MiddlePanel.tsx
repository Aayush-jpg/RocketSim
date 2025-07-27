"use client"

import { Suspense, useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { 
  OrbitControls, 
  PerspectiveCamera, 
  Grid, 
  Environment, 
  ContactShadows 
} from '@react-three/drei'
import * as THREE from 'three'
import { motion, AnimatePresence } from 'framer-motion'
import { useRocket } from '@/lib/store'
import { getDefaultRocket } from '@/lib/data/templates'
import { cn } from '@/lib/utils'
import { getMotorOrDefault } from '@/lib/data/motors'

// Import chat and analysis components
import IntegratedChatPanel from '@/components/panels/IntegratedChatPanel'
import SimulationTab from './pro-mode/SimulationTab'
import StabilityTab from './pro-mode/StabilityTab'
import MonteCarloTab from './pro-mode/MonteCarloTab'
import MotorTab from './pro-mode/MotorTab'
import TrajectoryTab from './pro-mode/TrajectoryTab'
import RecoveryTab from './pro-mode/RecoveryTab'
import WeatherStatus from '@/components/WeatherStatus'
import VersionHistoryTab from './pro-mode/VersionHistoryTab'
import AtmosphericModelSelector from '@/components/AtmosphericModelSelector'

// Flame component for rocket engine
function RocketFlame({ isLaunched, throttle = 0, preLaunchFire = false, countdownStage = 0 }: { 
  isLaunched: boolean, 
  throttle: number, 
  preLaunchFire?: boolean,
  countdownStage?: number
}) {
  const flameRef = useRef<THREE.Group>(null);
  const flameVariation = useRef({ scaleY: 0, scaleX: 0, scaleZ: 0 });
  const launchTime = useRef<number | null>(null);
  
  useFrame((state) => {
    if (!flameRef.current || (!isLaunched && !preLaunchFire)) return;
    
    const time = state.clock.getElapsedTime();
    
    // Track when launch begins
    if (isLaunched && launchTime.current === null) {
      launchTime.current = time;
    } else if (!isLaunched) {
      launchTime.current = null;
    }
    
    // Determine effective throttle - enhanced for more dramatic effect during launch
    let effectiveThrottle;
    if (isLaunched) {
      if (launchTime.current !== null) {
        const timeSinceLaunch = time - launchTime.current;
        
        // Ground fire phase (0-2 seconds): intense pulsing effect
        if (timeSinceLaunch < 2.0) {
          // More dramatic pulsing during ground phase
          effectiveThrottle = 1.4 + Math.sin(timeSinceLaunch * 6) * 0.4 + Math.sin(timeSinceLaunch * 20) * 0.2;
        } else if (timeSinceLaunch < 2.5) {
          // Crescendo before liftoff (final buildup)
          effectiveThrottle = 1.8 + Math.sin(timeSinceLaunch * 30) * 0.5;
        } else {
          // Sustained strong flame after liftoff
          effectiveThrottle = throttle * 1.6 + Math.sin(time * 15) * 0.15;
        }
      } else {
        effectiveThrottle = throttle * 1.4;
      }
    } else {
      // Pre-launch more subdued flame
      effectiveThrottle = 0.8; // Slightly increased from 0.7
    }
    
    // Calculate smooth variations using sine waves - more dramatic for launch
    const flameFrequency = isLaunched ? 15 : 10;
    
    // Smooth interpolation of previous values for less jitter
    flameVariation.current.scaleY = THREE.MathUtils.lerp(
      flameVariation.current.scaleY,
      0.8 + Math.sin(time * flameFrequency) * 0.3 + Math.sin(time * 17) * 0.1,
      isLaunched ? 0.3 : 0.2
    );
    
    // Apply flame scale with smooth modulation - larger for actual launch
    const baseScaleMultiplier = isLaunched ? 2.0 : 1.8;
    flameRef.current.scale.y = flameVariation.current.scaleY * (0.5 + effectiveThrottle * baseScaleMultiplier);
    
    // Smooth X/Z scale variation - more dramatic during launch
    const xzVariation = isLaunched ? 0.15 : 0.1;
    const newScaleX = 0.7 + Math.sin(time * 12) * xzVariation + Math.sin(time * 23) * (xzVariation/2);
    const newScaleZ = 0.7 + Math.cos(time * 14) * xzVariation + Math.cos(time * 19) * (xzVariation/2);
    
    flameVariation.current.scaleX = THREE.MathUtils.lerp(flameVariation.current.scaleX, newScaleX, 0.15);
    flameVariation.current.scaleZ = THREE.MathUtils.lerp(flameVariation.current.scaleZ, newScaleZ, 0.15);
    
    flameRef.current.scale.x = flameVariation.current.scaleX;
    flameRef.current.scale.z = flameVariation.current.scaleZ;
  });

  if (!isLaunched && !preLaunchFire) return null;
  
  // Adjusted flame position to align with the rocket engine
  return (
    <group ref={flameRef} position={[0, -3, 0]}>
      {/* Main outer flame - brighter and more intense */}
      <mesh>
        <coneGeometry args={[0.5, 2.3, 24]} /> {/* Slightly larger flame cone */}
        <meshBasicMaterial color="#FF4400" transparent opacity={0.85} />
      </mesh>
      {/* Middle flame layer */}
      <mesh position={[0, -0.1, 0]}>
        <coneGeometry args={[0.38, 1.9, 20]} /> {/* Slightly larger flame cone */}
        <meshBasicMaterial color="#FF7700" transparent opacity={0.9} />
      </mesh>
      {/* Hot inner flame */}
      <mesh position={[0, -0.2, 0]}>
        <coneGeometry args={[0.28, 1.5, 16]} /> {/* Slightly larger flame cone */}
        <meshBasicMaterial color="#FFCC00" transparent opacity={0.95} />
      </mesh>
      {/* Stronger lights for better visual impact */}
      <pointLight color="#FF5500" intensity={isLaunched ? 9 * throttle : 7 * throttle} distance={7} /> {/* Increased intensity and distance */}
      <pointLight color="#FFAA00" intensity={isLaunched ? 6 * throttle : 5 * throttle} distance={4} /> {/* Increased intensity and distance */}
    </group>
  );
}

// Optimized rocket model component
function RocketModel({ 
  selected, 
  isLaunched, 
  throttle,
  highlightedPart,
  preLaunchFire = false,
  countdownStage = 0,
  setHoveredPart,
  displayRocket
}: { 
  selected: boolean, 
  isLaunched: boolean,
  throttle: number,
  highlightedPart: string | null,
  preLaunchFire?: boolean,
  countdownStage?: number,
  setHoveredPart: (part: string | null) => void,
  displayRocket: any // Add displayRocket prop
}) {
  const rocketRef = useRef<THREE.Group>(null)
  
  // Use the displayRocket passed as prop instead of getting from store
  const rocket = displayRocket;
  
  // Get component-specific properties 
  const nosePart = rocket.nose_cone;
  const bodyPart = rocket.body_tubes[0]; // Use first body tube
  const enginePart = rocket.motor;
  const finParts = rocket.fins || [];
  const parachuteParts = rocket.parachutes || [];
  
  // Get fin cant angle from component data
  const finCantAngle = finParts[0]?.cant_angle_deg || 0;
  const finCount = finParts[0]?.fin_count || 3;
  
  // Calculate visual scaling factors
  const visualScaleFactor = 4; // Scale up for better 3D visualization
  const rawBodyRadius = bodyPart?.outer_radius_m || 0.05;
  const bodyRadius = Math.max(rawBodyRadius * visualScaleFactor, 0.15); // Reasonable minimum for visibility
  
  // Calculate component count for re-render tracking
  const componentCount = (nosePart ? 1 : 0) + rocket.body_tubes.length + rocket.fins.length + rocket.parachutes.length + (enginePart ? 1 : 0);
  
  // Force re-render when rocket components change - enhanced detection
  const [renderKey, setRenderKey] = useState(0)
  const prevRocketRef = useRef(rocket)
  const rocketHashRef = useRef('')
  
  // Create a comprehensive hash of all component properties
  const createRocketHash = useCallback((rocket: any) => {
    const components = [
      rocket.nose_cone ? `nose-${rocket.nose_cone.id}-${rocket.nose_cone.length_m}-${rocket.nose_cone.base_radius_m}` : '',
      ...rocket.body_tubes.map((body: any) => `body-${body.id}-${body.outer_radius_m}-${body.length_m}`),
      ...rocket.fins.map((fin: any) => `fin-${fin.id}-${fin.root_chord_m}-${fin.span_m}`),
      rocket.motor ? `motor-${rocket.motor.motor_database_id}` : '',
      ...rocket.parachutes.map((para: any) => `para-${para.id}`)
    ].filter(Boolean);
    return components.join('|');
  }, []);
  
  useEffect(() => {
    const currentRocketHash = createRocketHash(rocket);
    const prevRocketHash = rocketHashRef.current;
    
    console.log('🔍 RocketModel: Checking for component changes');
    console.log('📊 Current rocket hash:', currentRocketHash);
    console.log('📋 Previous rocket hash:', prevRocketHash);
    console.log('🔄 Components changed:', currentRocketHash !== prevRocketHash);
    console.log('📦 Current component count:', componentCount);
    
    if (currentRocketHash !== prevRocketHash) {
      console.log('🚀 COMPONENTS CHANGED - Forcing complete re-render!');
      console.log('🆚 Detailed comparison:');
      console.log('   Previous rocket:', JSON.stringify(prevRocketRef.current, null, 2));
      console.log('   Current rocket:', JSON.stringify(rocket, null, 2));
      
      setRenderKey(prev => {
        const newKey = prev + 1;
        console.log(`🔑 Render key updated: ${prev} → ${newKey}`);
        return newKey;
      });
      
      prevRocketRef.current = structuredClone(rocket);
      rocketHashRef.current = currentRocketHash;
      
      // Force a more aggressive re-render by changing the rocket's position slightly
      if (rocketRef.current) {
        const originalPosition = rocketRef.current.position.clone();
        rocketRef.current.position.y += 0.001;
        setTimeout(() => {
          if (rocketRef.current) {
            rocketRef.current.position.copy(originalPosition);
          }
        }, 1);
      }
    }
  }, [rocket, createRocketHash, componentCount]);

  // Also trigger re-render when individual component properties change
  const [partChangeKey, setPartChangeKey] = useState(0);
  useEffect(() => {
    // Watch for changes in specific component properties that affect rendering
    const criticalValues = {
      bodyDiameter: bodyPart?.outer_radius_m || 0,
      bodyLength: bodyPart?.length_m || 0,
      finRoot: finParts[0]?.root_chord_m || 0,
      finSpan: finParts[0]?.span_m || 0,
      noseLength: nosePart?.length_m || 0,
      componentCount: componentCount
    };
    
    const criticalHash = JSON.stringify(criticalValues);
    const prevCriticalHash = localStorage.getItem('rocketCriticalHash') || '';
    
    if (criticalHash !== prevCriticalHash) {
      console.log('🎯 Critical component properties changed, forcing re-render');
      console.log('⚙️ Critical values:', criticalValues);
      setPartChangeKey(prev => prev + 1);
      localStorage.setItem('rocketCriticalHash', criticalHash);
    }
  }, [nosePart, bodyPart, finParts, componentCount]);

  // DEBUG: Log component details
  console.log("RocketModel: bodyPart from store:", bodyPart);
  console.log("RocketModel: bodyPart outer_radius_m:", bodyPart?.outer_radius_m);

 
  // ✅ FIXED: Realistic rocket proportions like real rockets
  const bodyLengthScaled = bodyPart?.length_m ? bodyPart.length_m * 4 : 8; // Taller for realistic proportions
  const noseLengthScaled = nosePart?.length_m ? nosePart.length_m * 3 : 2; // Longer, more aerodynamic nose
  const noseShape = nosePart?.shape || 'ogive';
  
  // Fin dimensions - FIXED: Realistic fin proportions  
  const finRootScaled = finParts[0]?.root_chord_m ? finParts[0].root_chord_m * 4 : 2; 
  const finSpanScaled = finParts[0]?.span_m ? finParts[0].span_m * 4 : 1.2;

  // DEBUG: Log fin dimensions every render
  console.log("🔧 RocketModel: finParts from store:", finParts);
  console.log("🔧 RocketModel: finRootScaled:", finRootScaled, "finSpanScaled:", finSpanScaled);
  console.log("🔧 RocketModel: fin raw values - root:", finParts[0]?.root_chord_m, "span:", finParts[0]?.span_m);

  // Force Three.js to recognize the dimension change with a unique string
  const dimensionKey = `dims-radius${bodyRadius.toFixed(4)}-finRoot${finRootScaled.toFixed(4)}-finSpan${finSpanScaled.toFixed(4)}-renderKey${renderKey}-partKey${partChangeKey}`;
  const finDimensionKey = `fin-root${finRootScaled.toFixed(4)}-span${finSpanScaled.toFixed(4)}-renderKey${renderKey}`;
  console.log("RocketModel: dimensionKey for recreating geometries:", dimensionKey);
  console.log("RocketModel: finDimensionKey for fin geometries:", finDimensionKey);
  
  // Enhanced render key that includes everything
  const comprehensiveRenderKey = `${renderKey}-${partChangeKey}-components${componentCount}-fin-${finRootScaled.toFixed(3)}-${finSpanScaled.toFixed(3)}-body-${bodyRadius.toFixed(3)}-${bodyLengthScaled.toFixed(3)}`;
  console.log("🔧 RocketModel: comprehensiveRenderKey:", comprehensiveRenderKey);
  
  // ✅ FIXED: Better proportioned upper/lower body design for recovery system
  const upperBodyLength = bodyLengthScaled * 0.4; // Upper payload/recovery section (smaller)
  const lowerBodyLength = bodyLengthScaled * 0.6; // Lower motor/fin section (larger)
  
  // Define the recovery bay position (between upper and lower body)
  const recoveryBayY = 1; // Slightly elevated central reference point
  
  const upperBodyCenterY = recoveryBayY + upperBodyLength / 2;
  const lowerBodyCenterY = recoveryBayY - lowerBodyLength / 2;
  
  const topOfUpperBodyY = recoveryBayY + upperBodyLength;
  const bottomOfLowerBodyY = recoveryBayY - lowerBodyLength;

  // Nose cone positioning - at the top of upper body, make it MUCH sharper
  const noseConeBaseY = topOfUpperBodyY;
  const noseConeCenterY = noseConeBaseY + noseLengthScaled / 2;

  // Electronics bay - much smaller and at the junction
  const electronicsBayCenterY = recoveryBayY;

  // Engine positioning - FIXED: Attached directly to body tube
  const engineGroupCenterY = bottomOfLowerBodyY - 0.3; // Much closer to body
  
  // Parachute positioning - in upper body
  const parachuteCenterY = upperBodyCenterY;

  // Flame positioning for the engine
  const engineNozzleTipY = engineGroupCenterY - 0.95; 
  const flameComponentPlacementY = engineNozzleTipY + 3;
  
  // Fins positioning - FIXED: Connect body to engine seamlessly
  const finCenterY = bottomOfLowerBodyY - 0.15; // Between body and engine
  
  // Trigger re-render when the bodyRadius changes
  const [prevBodyRadius, setPrevBodyRadius] = useState(bodyRadius);
  useEffect(() => {
    if (bodyRadius !== prevBodyRadius) {
      console.log("🚀 DIAMETER CHANGED from", prevBodyRadius, "to", bodyRadius);
      console.log("This should trigger a complete re-render of the rocket model");
      setPrevBodyRadius(bodyRadius);
      
      // Force a subtle movement of the rocket to trigger Three.js updates
      if (rocketRef.current) {
        const originalPosition = rocketRef.current.position.clone();
        // Move slightly
        rocketRef.current.position.y += 0.0001;
        // Schedule move back on next frame to ensure refresh
        requestAnimationFrame(() => {
          if (rocketRef.current) {
            rocketRef.current.position.copy(originalPosition);
          }
        });
      }
    }
  }, [bodyRadius]);
  
  // Trigger re-render when fin dimensions change
  const [prevFinDimensions, setPrevFinDimensions] = useState({ root: finRootScaled, span: finSpanScaled });
  useEffect(() => {
    if (finRootScaled !== prevFinDimensions.root || finSpanScaled !== prevFinDimensions.span) {
      console.log("🚀 FIN DIMENSIONS CHANGED from", prevFinDimensions, "to", { root: finRootScaled, span: finSpanScaled });
      console.log("This should trigger a complete re-render of the fin geometries");
      setPrevFinDimensions({ root: finRootScaled, span: finSpanScaled });
      
      // Force a subtle movement of the rocket to trigger Three.js updates
      if (rocketRef.current) {
        const originalPosition = rocketRef.current.position.clone();
        // Move slightly
        rocketRef.current.position.y += 0.0001;
        // Schedule move back on next frame to ensure refresh
        requestAnimationFrame(() => {
          if (rocketRef.current) {
            rocketRef.current.position.copy(originalPosition);
          }
        });
      }
    }
  }, [finRootScaled, finSpanScaled, prevFinDimensions.root, prevFinDimensions.span]);
  
  // Raycasting (largely unchanged, mouse interaction logic)
  const raycaster = useRef(new THREE.Raycaster())
  const mouse = useRef(new THREE.Vector2(-1000, -1000)) // Initialize off-screen
  const threeState = useThree()

  // Listen for mouse movement events
  useEffect(() => {
    // Safety check for window object
    if (typeof window === 'undefined') return;
    
    const handleMouseMove = (e: CustomEvent) => {
      if (e.detail && typeof e.detail.x === 'number' && typeof e.detail.y === 'number') {
        mouse.current.x = e.detail.x
        mouse.current.y = e.detail.y
      }
    }
    
    try {
      window.addEventListener('rocketMouseMove' as any, handleMouseMove)
      
      return () => {
        if (typeof window !== 'undefined') {
          try {
            window.removeEventListener('rocketMouseMove' as any, handleMouseMove)
          } catch (error) {
            console.warn('Failed to remove rocketMouseMove listener:', error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to add rocketMouseMove listener:', error);
      return () => {}; // Return empty cleanup function
    }
  }, []) // Removed dependency array to prevent re-renders

  // Use a separate effect for raycasting to avoid running it in every frame
  useEffect(() => {
    if (isLaunched || !rocketRef.current) return
    
    // Set up raycasting interval
    const raycastInterval = setInterval(() => {
      try {
        // Skip if the ref is not set
        if (!rocketRef.current) return
        
        // Set up raycasting
        raycaster.current.setFromCamera(mouse.current, threeState.camera)
        
        // Get all intersections with the rocket parts
        const intersects = raycaster.current.intersectObjects(rocketRef.current.children, true)
        
        // Find the first intersection with a named part
        const firstIntersect = intersects.find(intersect => {
          if (!intersect.object || !intersect.object.name) return false
          
          // Check for part name matches
          return (
            intersect.object.name === 'nosecone' || 
            intersect.object.name.includes('airframe') || 
            intersect.object.name === 'fins' || 
            intersect.object.name === 'engine' || 
            intersect.object.name === 'parachute' || 
            intersect.object.name === 'electronics'
          )
        })
        
        // If found an intersection, set the hovered part
        if (firstIntersect && firstIntersect.object) {
          // Map from mesh name to part type for the UI
          const partNameMap: Record<string, string> = {
            'nosecone': 'nosecone',
            'upper-airframe': 'body',
            'lower-airframe': 'body',
            'fins': 'fins',
            'engine': 'engine',
            'parachute': 'parachute',
            'electronics': 'electronics'
          }
          
          const partType = partNameMap[firstIntersect.object.name] || 
                         (firstIntersect.object.name.includes('airframe') ? 'body' : null)
          
          if (partType) {
            setHoveredPart(partType)
          }
        } else {
          setHoveredPart(null)
        }
      } catch (e) {
        // Safely handle any raycasting errors
        console.error("Raycasting error:", e)
      }
    }, 100) // Check every 100ms
    
    return () => {
      clearInterval(raycastInterval)
    }
  }, [isLaunched, setHoveredPart, threeState.camera])

  useFrame((_, delta) => {
    // Only rotate for display when neither selected nor launched
    if (rocketRef.current && !selected && !isLaunched && !preLaunchFire) {
      rocketRef.current.rotation.y += delta * 0.1
    } else if (rocketRef.current && preLaunchFire) {
      // Ensure rocket is facing straight up during pre-launch
      rocketRef.current.rotation.x = THREE.MathUtils.lerp(rocketRef.current.rotation.x, 0, 0.1);
      rocketRef.current.rotation.z = THREE.MathUtils.lerp(rocketRef.current.rotation.z, 0, 0.1);
    }
  })

  const highlightEmissive = "#00AAFF"
  const highlightIntensity = 0.5

  const getEmissive = (part: string) => highlightedPart === part ? highlightEmissive : (selected ? "#FFFFFF" : "#000000")
  const getEmissiveIntensity = (part: string) => highlightedPart === part ? highlightIntensity : (selected ? 0.1 : 0)
  
  // Adjust the entire rocket to sit properly on the grid
  return (
    <group 
      ref={rocketRef} 
      key={`rocket-${comprehensiveRenderKey}`}
      position={[0, 0.8, 0]}
    >
      {/* Upper body - White like real rockets */}
      <mesh position={[0, upperBodyCenterY, 0]} name="upper-airframe">
        <cylinderGeometry 
          key={dimensionKey + '-upper'} 
          args={[bodyRadius, bodyRadius, upperBodyLength, 32]} 
        />
        <meshStandardMaterial 
          color={bodyPart?.color || "#FFFFFF"} 
          metalness={0.1} 
          roughness={0.3} 
          emissive={getEmissive('airframe')}
          emissiveIntensity={getEmissiveIntensity('airframe')}
        />
      </mesh>
      
      {/* Lower body - White like real rockets */}
      <mesh position={[0, lowerBodyCenterY, 0]} name="lower-airframe">
        <cylinderGeometry 
          key={dimensionKey + '-lower'} 
          args={[bodyRadius, bodyRadius, lowerBodyLength, 32]} 
        />
        <meshStandardMaterial 
          color={bodyPart?.color || "#FFFFFF"}
          metalness={0.1} 
          roughness={0.3} 
          emissive={getEmissive('airframe')}
          emissiveIntensity={getEmissiveIntensity('airframe')}
        />
      </mesh>
      
      {/* Top ring */}
      <mesh position={[0, topOfUpperBodyY, 0]}>
        <torusGeometry 
          key={dimensionKey + '-ring'} 
          args={[bodyRadius, 0.03, 16, 32]} 
        />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      
      {/* Nose cone - Realistic aerodynamic design */}
      <mesh position={[0, noseConeCenterY, 0]} name="nosecone">
        {noseShape === 'conical' ? (
          <coneGeometry 
            key={dimensionKey + '-nose-conical'} 
            args={[bodyRadius * 0.98, noseLengthScaled, 32]} 
          />
        ) : noseShape === 'elliptical' ? (
          <sphereGeometry 
            key={dimensionKey + '-nose-elliptical'} 
            args={[bodyRadius, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} 
          />
        ) : (
          /* Sharp, aerodynamic ogive nose cone */
          <coneGeometry 
            key={dimensionKey + '-nose-ogive'} 
            args={[bodyRadius * 0.98, noseLengthScaled, 32]} 
          />
        )}
        <meshStandardMaterial 
          color={nosePart?.color || "#FFFFFF"} 
          metalness={0.3} 
          roughness={0.4} 
          emissive={getEmissive('nosecone')}
          emissiveIntensity={getEmissiveIntensity('nosecone')}
        />
      </mesh>
      
      {/* Electronics bay - FIXED: More visible recovery/electronics section */}
      <group position={[0, electronicsBayCenterY, 0]} name="electronics">
        <mesh>
          <cylinderGeometry 
            key={dimensionKey + '-electronics'} 
            args={[bodyRadius + 0.02, bodyRadius + 0.02, 0.15, 32]} 
          /> {/* FIXED: More visible height 0.15 and slightly larger radius */}
          <meshStandardMaterial 
            color="#B87333"
            metalness={0.4}
            roughness={0.6}
            emissive={getEmissive('electronics')}
            emissiveIntensity={getEmissiveIntensity('electronics')}
          />
        </mesh>
        
        {/* Small recovery system ports */}
        {[0, 1, 2, 3].map((i) => (
          <mesh 
            key={i}
            position={[
                Math.sin(i * Math.PI / 2) * (bodyRadius + 0.01),
                0, 
                Math.cos(i * Math.PI / 2) * (bodyRadius + 0.01)
              ]}
              rotation={[0, i * Math.PI / 2, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.01, 0.01, 0.02, 8]} /> {/* Small recovery ports */}
              <meshStandardMaterial color="#8B4513" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
      </group>
      
      {/* Realistic aerodynamic fins */}
      {Array.from({ length: finCount }, (_, i) => (
        <mesh 
          key={i}
          position={[
            Math.sin(i * (2 * Math.PI) / finCount) * (bodyRadius + finSpanScaled/3), 
            finCenterY, 
            Math.cos(i * (2 * Math.PI) / finCount) * (bodyRadius + finSpanScaled/3)
          ]}
          rotation={[0, i * (2 * Math.PI) / finCount + (finCantAngle * Math.PI / 180), 0]}
          name="fins"
        >
          <boxGeometry 
            key={`${finDimensionKey}-fin-${i}`} 
            args={[0.05, finRootScaled, finSpanScaled]} 
          />
          <meshStandardMaterial 
            color={finParts[0]?.color || "#2C3E50"} 
            metalness={0.4} 
            roughness={0.3} 
            emissive={getEmissive('fins')}
            emissiveIntensity={getEmissiveIntensity('fins')}
          />
        </mesh>
      ))}
      
      {/* Realistic rocket engine - Connected to body */}
      <group position={[0, engineGroupCenterY, 0]} name="engine">
        {/* Main engine chamber - connects directly to body */}
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[bodyRadius, bodyRadius * 0.95, 0.4, 32]} />
          <meshStandardMaterial 
            color="#C0C0C0" 
            metalness={0.8} 
            roughness={0.2} 
            emissive={getEmissive('engine')}
            emissiveIntensity={getEmissiveIntensity('engine')}
          />
        </mesh>

        {/* Engine nozzle - realistic cone shape */}
        <mesh position={[0, -0.25, 0]}>
          <coneGeometry args={[bodyRadius * 0.9, 0.6, 32, 1, true]} />
          <meshStandardMaterial 
            color="#A9A9A9" 
            metalness={0.9} 
            roughness={0.1}
            emissive={getEmissive('engine')}
            emissiveIntensity={getEmissiveIntensity('engine')}
          />
        </mesh>
        
        {/* Engine throat - dark interior */}
        <mesh position={[0, -0.5, 0]} rotation={[Math.PI, 0, 0]}>
          <cylinderGeometry args={[bodyRadius * 0.6, bodyRadius * 0.7, 0.25, 32]} />
          <meshStandardMaterial color="#1C1C1C" metalness={0.5} roughness={0.8} />
        </mesh>
      </group>

      {/* Parachute */}
      <mesh position={[0, parachuteCenterY, 0]} name="parachute">
        <cylinderGeometry args={[0.2, 0.2, 0.3, 16]} />
        <meshStandardMaterial 
          color={parachuteParts[0]?.color || "#E74C3C"} 
          metalness={0.2} 
          roughness={0.5}
          emissive={getEmissive('parachute')}
          emissiveIntensity={getEmissiveIntensity('parachute')}
        />
      </mesh>

      {/* Flame - wrapped in a group to adjust its placement */}
      <group position={[0, flameComponentPlacementY, 0]}>
        <RocketFlame 
          isLaunched={isLaunched} 
          throttle={throttle} 
          preLaunchFire={preLaunchFire || highlightedPart === 'engine'}
          countdownStage={preLaunchFire ? countdownStage : (highlightedPart === 'engine' ? 3 : 0)}
        />
      </group>
    </group>
  )
}

// Optimized dynamic camera that follows the rocket
function DynamicCamera({ 
  isLaunched, 
  target,
  view
}: { 
  isLaunched: boolean,
  target: [number, number, number],
  view: 'top' | 'side' | 'perspective'
}) {
  const ref = useRef<THREE.PerspectiveCamera>(null);
  
  // Camera positions are now more dramatically different for each view
  const initialPositions = useRef<{[key: string]: THREE.Vector3}>({
    top: new THREE.Vector3(0, 10, 0),      // Closer - was 15, now 10
    side: new THREE.Vector3(8, 0, 0),      // Closer - was 15, now 8  
    perspective: new THREE.Vector3(6, 6, 6)  // Much closer - was 10,10,10, now 6,6,6
  });
  
  // Camera up vectors for each view to properly orient the camera
  const camerasUp = useRef<{[key: string]: THREE.Vector3}>({
    top: new THREE.Vector3(0, 0, -1),     // Looking down, "up" is -Z
    side: new THREE.Vector3(0, 1, 0),     // Looking from side, "up" is Y
    perspective: new THREE.Vector3(0, 1, 0) // Standard "up" is Y
  });
  
  const initialCameraPosition = useRef<THREE.Vector3 | null>(null);
  const staticGroundY = -2.8; // Updated to match the grid position
  const lastRocketY = useRef<number>(staticGroundY);
  const cameraLag = useRef<number>(0);
  const prevViewRef = useRef(view);

  // Set initial position and orientation when view changes
  useEffect(() => {
    if (ref.current) {
      // Define positions for each view
      const positions = {
        top: [0, 10, 0],        // Closer - was 15, now 10
        side: [8, 0, 0],        // Closer - was 15, now 8
        perspective: [6, 6, 6], // Much closer - was 10,10,10, now 6,6,6
      };
      
      const position = positions[view];
      const positionVector = new THREE.Vector3(position[0], position[1], position[2]);
      initialPositions.current[view] = positionVector.clone();
      
      // Set camera position
      ref.current.position.copy(positionVector);
      
      // Set camera up vector based on view
      ref.current.up.copy(camerasUp.current[view]);
      
      // Look at target
      ref.current.lookAt(0, staticGroundY, 0);
      
      // Update previous view reference
      prevViewRef.current = view;
    }
  }, [view]);

  // Track rocket launch
  useEffect(() => {
    if (isLaunched && ref.current) {
      // Store initial camera position on launch
      initialCameraPosition.current = ref.current.position.clone();
      lastRocketY.current = staticGroundY;
      cameraLag.current = 0;
    } else {
      // Reset when not launched
      initialCameraPosition.current = null;
      lastRocketY.current = staticGroundY;
      cameraLag.current = 0;
    }
  }, [isLaunched]);

  // Main frame update
  useFrame((_, delta) => {
    if (!ref.current) return;
    
    if (isLaunched) {
      // Direct camera tracking for rocket
      const rocketX = target[0] || 0;
      const rocketY = target[1] || staticGroundY;
      const rocketZ = target[2] || 0;
      
      // Calculate rocket velocity to determine how quickly camera should follow
      const rocketVelocityY = (rocketY - lastRocketY.current) / Math.max(delta, 0.016);
      lastRocketY.current = rocketY;
      
      // Calculate altitude
      const altitude = rocketY - staticGroundY;
      
      // Update camera lag based on rocket velocity
      cameraLag.current = THREE.MathUtils.lerp(
        cameraLag.current,
        Math.max(0, Math.min(5, rocketVelocityY * 0.05)), // Cap lag between 0-5
        0.05
      );
      
      const initialPos = initialCameraPosition.current || initialPositions.current[view];
            
      if (view === 'perspective') {
        // Calculate horizontal distance and angle from initial position
        const horizDist = Math.sqrt(initialPos.x * initialPos.x + initialPos.z * initialPos.z);
        const angle = Math.atan2(initialPos.z, initialPos.x);
        
        // Calculate scaling factor based on altitude to zoom out as rocket goes higher
        const distanceScale = 1 + altitude * 0.02; // Scale distance as rocket ascends
        
        // Apply distance scaling with minimum distance
        const scaledHorizDist = Math.max(horizDist, horizDist * distanceScale);
        
        // More responsive positioning - increase follow speed as rocket goes higher
        // Apply some deliberate lag for dramatic effect
        const targetY = initialPos.y + (rocketY - staticGroundY - cameraLag.current);
        
        // Update positions with appropriate scale and smoothing
        ref.current.position.x = Math.cos(angle) * scaledHorizDist;
        ref.current.position.z = Math.sin(angle) * scaledHorizDist;
        
        // Smooth camera Y movement - faster follow for higher velocities
        const followSpeed = Math.min(1, 0.1 + Math.abs(rocketVelocityY) * 0.001);
        ref.current.position.y = THREE.MathUtils.lerp(
          ref.current.position.y,
          targetY,
          followSpeed
        );
      }
      else if (view === 'top') {
        // Top view - stay directly above rocket with increasing height
        const heightScale = 1 + altitude * 0.05; // Scale height based on altitude
        const topHeight = rocketY + 15 * heightScale; // Scale viewing height
        
        // Smoother transitions for position
        ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, rocketX, 0.1);
        ref.current.position.z = THREE.MathUtils.lerp(ref.current.position.z, rocketZ, 0.1);
        ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, topHeight, 0.05);
      }
      else if (view === 'side') {
        // Side view - maintain X distance but track height directly with some lag
        const targetY = rocketY - cameraLag.current * 0.5; // Reduced lag for side view
        const followSpeed = Math.min(1, 0.15 + Math.abs(rocketVelocityY) * 0.001);
        
        // Smooth tracking
        ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, targetY, followSpeed);
        ref.current.position.z = THREE.MathUtils.lerp(ref.current.position.z, rocketZ, 0.1);
        
        // Zoom out slightly based on altitude
        const sideDistance = initialPos.x * (1 + altitude * 0.01);
        ref.current.position.x = THREE.MathUtils.lerp(ref.current.position.x, sideDistance, 0.05);
      }
      
      // Always look directly at the rocket, maintaining the view orientation
      ref.current.lookAt(rocketX, rocketY, rocketZ);
      
      // Ensure we maintain proper up vector during flight for each view type
      ref.current.up.copy(camerasUp.current[view]);
      
      // Adjust FOV for better visibility - more dynamic FOV change
      const targetFOV = Math.min(70, 50 + altitude * 0.15);
      if (ref.current.fov !== targetFOV) {
        ref.current.fov = THREE.MathUtils.lerp(ref.current.fov, targetFOV, 0.05);
        ref.current.updateProjectionMatrix();
      }
    }
  });
  
  // Camera positions by view type
  const cameraPositions = {
    top: [0, 10, 0],     // Closer - was 15, now 10
    side: [8, 0, 0],     // Closer - was 15, now 8
    perspective: [6, 6, 6],  // Much closer - was 10,10,10, now 6,6,6
  } as const;
  
  return <PerspectiveCamera ref={ref} makeDefault position={cameraPositions[view]} fov={35} />;
}

// Global tracking of rocket position for debugging - emergency backup
let globalRocketY = -2.8; // Updated global reference

// Add mouse event handler at the top level
function MousePositionHandler() {
  useEffect(() => {
    // Safety check for window object
    if (typeof window === 'undefined') return;
    
    const handleMouseMove = (event: MouseEvent) => {
      if (!event || typeof window === 'undefined') return;
      
      // Calculate normalized device coordinates
      const x = (event.clientX / window.innerWidth) * 2 - 1
      const y = -(event.clientY / window.innerHeight) * 2 + 1
      
      // Set mouse position for raycasting in RocketModel
      try {
        window.dispatchEvent(new CustomEvent('rocketMouseMove', { 
          detail: { x, y } 
        }))
      } catch (error) {
        console.warn('Failed to dispatch rocketMouseMove event:', error);
      }
    }
    
    // Add event listener with proper error handling
    try {
      window.addEventListener('mousemove', handleMouseMove)
      
      return () => {
        if (typeof window !== 'undefined') {
          try {
            window.removeEventListener('mousemove', handleMouseMove)
          } catch (error) {
            console.warn('Failed to remove mousemove listener:', error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to add mousemove listener:', error);
      return () => {}; // Return empty cleanup function
    }
  }, []) // Empty dependency array - only setup once
  
  return null
}

// RocketSimulation component
function RocketSimulation({
  selected,
  isLaunched, 
  throttle, 
  resetTrigger,
  setFlightData,
  highlightedPart,
  onHoverPart,
  displayRocket
}: {
  selected: boolean,
  isLaunched: boolean,
  throttle: number,
  resetTrigger: boolean,
  setFlightData: (position: [number, number, number], velocity: [number, number, number]) => void,
  highlightedPart: string | null,
  onHoverPart?: (part: string | null) => void,
  displayRocket: any // Add displayRocket prop
}) {
  // Track mount/unmount for debugging
  useEffect(() => {
    console.log("RocketSimulation mounted");
    return () => console.log("RocketSimulation unmounted");
  }, []);
  
  // Fixed ground position - standardized to match grid
  const GROUND_Y = -2.8; // Standardized ground position to match grid
  // Make GROUND_POSITION an object to be re-created each time to avoid reference issues
  const GROUND_POSITION: [number, number, number] = [0, GROUND_Y, 0];
  
  // State for rocket physics - with precise ground position
  const [position, setPosition] = useState<[number, number, number]>(GROUND_POSITION);
  const [velocity, setVelocity] = useState<[number, number, number]>([0, 0, 0]);
  const [rotation, setRotation] = useState<[number, number, number]>([0, 0, 0]);
  
  // Use refs to track the actual latest values to prevent stale closures
  const positionRef = useRef<[number, number, number]>(GROUND_POSITION);
  const velocityRef = useRef<[number, number, number]>([0, 0, 0]);
  const isLaunchedRef = useRef<boolean>(false);
  
  // Add state for hovering parts
  const [hoveredPart, setHoveredPart] = useState<string | null>(null);
  
  // Get the camera reference for label positioning
  const { camera } = useThree();
  
  // When hoveredPart changes, notify the parent component
  useEffect(() => {
    if (onHoverPart) {
      onHoverPart(hoveredPart);
    }
  }, [hoveredPart, onHoverPart]);
  
  // Update refs when state changes
  useEffect(() => {
    positionRef.current = position;
    velocityRef.current = velocity;
    isLaunchedRef.current = isLaunched;
  }, [position, velocity, isLaunched]);
  
  // Render position
  const renderPosition = useMemo(() => {
    return [
      positionRef.current[0],
      positionRef.current[1], 
      positionRef.current[2]
    ] as [number, number, number];
  }, [positionRef.current]);
  
  // Simplify to a single showFire state for pre-launch
  const [showFire, setShowFire] = useState(false)
  const launchTime = useRef<number>(0)
  const startMovingTime = useRef<number>(0)
  const lastUpdateTime = useRef<number>(0)
  
  return (
    <>
      <group position={renderPosition} rotation={rotation}>
      <RocketModel 
        selected={selected}
        isLaunched={isLaunched}
        throttle={throttle}
          highlightedPart={highlightedPart}
          preLaunchFire={showFire}
          countdownStage={3} // Always max flame intensity
          setHoveredPart={setHoveredPart}
          displayRocket={displayRocket}
      />
    </group>
    </>
  )
}

// ViewportControls component for repositioning camera to default view
function ViewportControls({ 
  view, 
  setView,
  isMobile
}: { 
  view: 'top' | 'side' | 'perspective', 
  setView: (view: 'top' | 'side' | 'perspective') => void,
  isMobile: boolean
}) {
  // Add state to track the rotation of the compass needle
  const [compassRotation, setCompassRotation] = useState(0);
  
  // Listen for camera/rocket rotation changes to update compass
  useEffect(() => {
    // Safety check for window object
    if (typeof window === 'undefined') return;
    
    // Function to handle rotation updates
    const handleRocketRotation = (e: CustomEvent) => {
      if (e && e.detail && typeof e.detail.rotation === 'number') {
        setCompassRotation(e.detail.rotation);
      }
    };
    
    // Listen for custom rocket rotation events with proper checks
    try {
      window.addEventListener('rocketRotation' as any, handleRocketRotation);
      
      return () => {
        if (typeof window !== 'undefined') {
          try {
            window.removeEventListener('rocketRotation' as any, handleRocketRotation);
          } catch (error) {
            console.warn('Failed to remove rocketRotation listener:', error);
          }
        }
      };
    } catch (error) {
      console.warn('Failed to add rocketRotation listener:', error);
      return () => {}; // Return empty cleanup function
    }
  }, []);

  return (
    <div className="absolute top-8 right-10 z-50 flex flex-col items-center pointer-events-auto">
      <motion.button 
        onClick={() => {
          setView('perspective');
          // Reset compass rotation when setting to perspective view
          setCompassRotation(0);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('rocketRotation', { 
              detail: { rotation: 0 } 
            }));
            // Dispatch event to smoothly reposition the camera and rocket
            window.dispatchEvent(new CustomEvent('resetCameraView', {}));
          }
        }}
        className="rounded-full transition-all mx-2"
        aria-label="Reset Camera to Default View"
        whileHover={{ 
          scale: 1.1,
          y: -2,
          filter: "drop-shadow(0 4px 6px rgba(0, 0, 0, 0.1))"
        }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 15 }}
      >
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Define the blur filter */}
          <defs>
            <filter id="pinkShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feOffset dy="2" />
              <feGaussianBlur stdDeviation="3" />
              <feColorMatrix type="matrix" values="0 0 0 0 0.95 0 0 0 0 0.2 0 0 0 0 0.65 0 0 0 0.6 0" />
            </filter>
            {/* Metallic gradient */}
            <linearGradient id="metallicGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7D7D7D" />
              <stop offset="50%" stopColor="#A5A5A5" />
              <stop offset="100%" stopColor="#5A5A5A" />
            </linearGradient>
          </defs>
          {/* Navigation arrow - fatter and longer with pinkish shadow */}
          <g transform={`rotate(-${compassRotation} 24 24)`}>
            {/* Enhanced pinkish shadow */}
            <path 
              d="M24 6L37 38L24 30L11 38L24 6Z" 
              fill="#EC4899"
              opacity="0.7"
              filter="url(#pinkShadow)"
            />
            {/* Black outline to create contrast with the shadow */}
            <path 
              d="M24 6L37 38L24 30L11 38L24 6Z" 
              fill="none"
              stroke="black"
              strokeWidth="1.5"
            />
            {/* Main arrow with metallic gradient */}
            <path 
              d="M24 6L37 38L24 30L11 38L24 6Z" 
              fill="url(#metallicGradient)"
              strokeWidth="0.75"
              stroke="rgba(0,0,0,0.5)"
            />
            {/* Subtle highlight for metallic effect */}
            <path 
              d="M24 6L30.5 22L24 6Z" 
              fill="white"
              opacity="0.2"
            />
          </g>
        </svg>
      </motion.button>
    </div>
  );
}

// Launch control panel
function LaunchControls({ 
  isLaunched, 
  setIsLaunched, 
  throttle,
  setThrottle,
  resetRocket
}: { 
  isLaunched: boolean,
  setIsLaunched: (launched: boolean) => void,
  throttle: number,
  setThrottle: (throttle: number) => void,
  resetRocket: () => void
}) {
  return (
    <div className="absolute bottom-4 left-4 glass-panel rounded p-3 w-48 z-10 shadow-lg">
      <h3 className="text-small font-medium mb-2 text-white">Launch Controls</h3>
      
      {!isLaunched ? (
        <button 
          className="w-full py-2 bg-red-600 hover:bg-red-700 rounded text-white font-medium transition-colors"
          onClick={() => setIsLaunched(true)}
        >
          LAUNCH
        </button>
      ) : (
        <>
          <div className="mb-2">
            <label className="block text-small mb-1">Throttle: {Math.round(throttle * 100)}%</label>
            <input 
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={throttle}
              onChange={(e) => setThrottle(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          <button 
            className="w-full py-1.5 bg-gray-600 hover:bg-gray-700 rounded text-white text-small transition-colors"
            onClick={resetRocket}
          >
            Reset Rocket
          </button>
        </>
      )}
    </div>
  );
}

// Component tree panel
function ComponentTree({ selectedPart, setSelectedPart, hoveredPart }: {
  selectedPart: string | null, 
  setSelectedPart: (part: string | null) => void,
  hoveredPart: string | null // Add this new prop
}) {
  const parts = [
    { id: 'nosecone', name: 'Nose Cone', icon: '▲' },
    { id: 'body', name: 'Main Body', icon: '■' },
    { id: 'fins', name: 'Fins (x4)', icon: '◆' },
    { id: 'engine', name: 'Engine', icon: '●' },
    { id: 'parachute', name: 'Parachute', icon: '○' },
    { id: 'electronics', name: 'Electronics', icon: '⚡' }
  ];

  return (
    <>
      <h3 className="text-small font-medium mb-2 text-white">Components</h3>
      <ul className="space-y-1">
        {parts.map(part => (
          <li 
            key={part.id}
            className={`flex items-center p-1.5 rounded cursor-pointer text-small ${
              selectedPart === part.id 
                ? 'neon-border-active bg-white bg-opacity-10' 
                : hoveredPart === part.id
                ? 'bg-white bg-opacity-5 border border-cyan-500/30'
                : 'hover:bg-white hover:bg-opacity-10'
            }`}
            onClick={() => setSelectedPart(part.id)}
          >
            <span className="mr-2 opacity-80">{part.icon}</span>
            <span>{part.name}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

// Flight data panel
function FlightData({ position, velocity }: { 
  position: [number, number, number], 
  velocity: [number, number, number] 
}) {
  const altitude = Math.max(0, position[1] + 3).toFixed(1);
  const speed = Math.abs(velocity[1]).toFixed(1);
  
  if (position[1] <= -3) return null;
  
  return (
    <div className="absolute top-4 right-4 glass-panel rounded p-3 w-48 z-10 shadow-lg">
      <h3 className="text-small font-medium mb-2 text-white">Flight Data</h3>
      <div className="space-y-1 text-small">
        <div className="flex justify-between">
          <span>Speed:</span>
          <span>{speed} m/s</span>
        </div>
        <div className="flex justify-between">
          <span>Altitude:</span>
          <span>{altitude} m</span>
        </div>
      </div>
    </div>
  );
}

// Optimized launch data display
function LaunchData({
  isLaunched,
  setIsLaunched,
  throttle,
  setThrottle,
  resetRocket,
  launchRocket,
  speed,
  altitude,
  maxSpeed,
  maxAltitude,
  isMobile
}: {
  isLaunched: boolean,
  setIsLaunched: (launched: boolean) => void,
  throttle: number,
  setThrottle: (throttle: number) => void,
  resetRocket: () => void,
  launchRocket: () => void,
  speed: number,
  altitude: number,
  maxSpeed: number,
  maxAltitude: number,
  isMobile: boolean
}) {
  // Prevent multiple clicks
  const isTransitioning = useRef(false);
  const launchTimeRef = useRef<number | null>(null);
  const [forcedSpeed, setForcedSpeed] = useState(0);
  const [forcedAltitude, setForcedAltitude] = useState(0);
  const [isSafari, setIsSafari] = useState(false);
  const [isChrome, setIsChrome] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMacOS, setIsMacOS] = useState(false);
  
  // Enhanced browser/device detection
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(userAgent);
      const isChromeBrowser = /chrome/i.test(userAgent) && !/edge|edg/i.test(userAgent);
      const isIOSDevice = /iphone|ipad|ipod|ios/i.test(userAgent);
      const isMacOSDevice = /macintosh|mac os x/i.test(userAgent) && !isIOSDevice;
      
      setIsSafari(isSafariBrowser);
      setIsChrome(isChromeBrowser);
      setIsIOS(isIOSDevice);
      setIsMacOS(isMacOSDevice);
    }
  }, []);
  
  // Launch animation effect with performance optimizations
  useEffect(() => {
    if (isLaunched && !launchTimeRef.current) {
      launchTimeRef.current = Date.now() / 1000;
      let lastUpdateTime = 0;
      const UPDATE_INTERVAL = 50; // Only update every 50ms (20fps instead of 60fps)
      
      // Start an animation frame loop to update values
      const updateDisplayValues = () => {
        if (!isLaunched) {
          launchTimeRef.current = null;
          setForcedSpeed(0);
          setForcedAltitude(0);
          return;
        }
        
        const now = Date.now();
        
        // Throttle updates to reduce performance impact
        if (now - lastUpdateTime < UPDATE_INTERVAL) {
          requestAnimationFrame(updateDisplayValues);
          return;
        }
        
        lastUpdateTime = now;
        const elapsed = (now / 1000) - (launchTimeRef.current || (now / 1000));
        
        // Guaranteed increasing values based on elapsed time
        // Speed stays at exactly 0.0 during pre-launch, then starts increasing
        let newSpeed = elapsed < 2 
          ? 0.0  // Stay exactly at zero during pre-launch
          : (elapsed - 2) * 10; // Start from zero at ignition, then accelerate
        
        // Altitude starts at 0 then increases with acceleration
        let newAltitude = elapsed < 2 
          ? 0  // Stay at 0 during pre-launch
          : Math.pow(elapsed - 2, 2) * 2; // Quadratic increase after
          
        // Cap at reasonable values
        newSpeed = Math.min(newSpeed, 1000);
        newAltitude = Math.min(newAltitude, 5000);
        
        // Only update if values have changed significantly to reduce re-renders
        setForcedSpeed(prev => Math.abs(prev - newSpeed) > 0.5 ? newSpeed : prev);
        setForcedAltitude(prev => Math.abs(prev - newAltitude) > 0.5 ? newAltitude : prev);
        
        // Continue animation
        requestAnimationFrame(updateDisplayValues);
      };
      
      // Start the animation loop
      requestAnimationFrame(updateDisplayValues);
    } else if (!isLaunched) {
      // Reset on launch end
      launchTimeRef.current = null;
      setForcedSpeed(0);
      setForcedAltitude(0);
    }
  }, [isLaunched]);
  
  // Use our forced values during flight, fall back to physics values if needed
  const displaySpeed = isLaunched ? (forcedSpeed > 0 ? forcedSpeed : speed) : maxSpeed;
  const displayAltitude = isLaunched ? (forcedAltitude > 0 ? forcedAltitude : altitude) : maxAltitude;

  // Format display values to prevent NaN
  const getDisplayValue = (value: number) => {
    if (isNaN(value)) return "0.0";
    return value.toFixed(1);
  };
  
  // Handle button click with debounce
  const handleButtonClick = (e: React.MouseEvent) => {
    // Prevent any UI repositioning
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent rapid clicks
    if (isTransitioning.current) return;
    
    // Lock during transition - longer for reset transitions
    isTransitioning.current = true;
    
    if (isLaunched) {
      // Signal animation to stop immediately
      launchTimeRef.current = null;
      setForcedSpeed(0);
      setForcedAltitude(0);
      
      // For reset, need a longer transition lock
      resetRocket();
      
      // Set a longer timeout for reset transitions
      setTimeout(() => {
        isTransitioning.current = false;
      }, 500);
    } else {
      // Launch transitions are faster
      launchRocket();
      
      setTimeout(() => {
        isTransitioning.current = false;
      }, 300);
    }
  };

  // Refined dashboard position based on device and browser specifics
  const getDashboardPosition = () => {
    if (isMobile) {
      // Mobile device detection
      if (isIOS && isSafari) {
        return 'bottom-[12%]'; // Mobile iOS Safari needs extra space for bottom bar
      } else if (isChrome) {
        return 'bottom-[18%]'; // Mobile Chrome
      } else {
        return 'bottom-[15%]'; // Other mobile browsers
      }
    } else {
      // Desktop handling
      if (isMacOS && isSafari) {
        return 'bottom-4'; // Desktop Safari on MacOS - no need for extra margin
      } else if (isSafari) {
        return 'bottom-5'; // Other Safari instances
      } else {
        return 'bottom-4'; // Desktop Chrome and others
      }
    }
  };

  const dashboardPosition = getDashboardPosition();

  return (
    <div className={`absolute left-0 right-0 mx-auto z-20 flex flex-col items-center 
      ${isMobile ? `w-full ${dashboardPosition}` : `w-[320px] ${dashboardPosition}`}`}
      style={{ height: '110px' }} // Fixed height to prevent layout shifts
    >
      <div className="w-full max-w-xs bg-black/30 backdrop-blur-xl rounded-3xl p-3 shadow-md">
        <div className="flex w-full justify-between items-center px-4">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-mono tracking-wider text-white/90">{getDisplayValue(displaySpeed)}<span className="text-xs ml-1 text-white/60">m/s</span></span>
            {!isLaunched && maxSpeed > 0 && <span className="text-xs text-white/60">max</span>}
          </div>
          <motion.button
            className={`relative flex items-center justify-center w-14 h-14 rounded-full bg-black/40 shadow-md transition-all duration-200`}
            onClick={handleButtonClick}
            aria-label={isLaunched ? "Reset Rocket" : "Launch Rocket"}
            whileHover={{ scale: 1.05, boxShadow: "0 0 15px rgba(255,255,255,0.3)" }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
            style={{ transform: 'translateX(2px)' }} // Slight shift to the right
          >
            {isLaunched ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4C7.58 4 4.01 7.58 4.01 12C4.01 16.42 7.58 20 12 20C15.73 20 18.84 17.45 19.73 14H17.65C16.83 16.33 14.61 18 12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C13.66 6 15.14 6.69 16.22 7.78L13 11H20V4L17.65 6.35Z" fill="white" fillOpacity="0.9"/>
              </svg>
            ) : (
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M14 3L17 15.5H11L14 3Z" fill="#FFFFFF" fillOpacity="0.9"/>
                <circle cx="14" cy="21" r="3" fill="#FFFFFF" fillOpacity="0.9"/>
              </svg>
            )}
          </motion.button>
          <div className="flex flex-col items-center">
            <span className="text-2xl font-mono tracking-wider text-white/90">{getDisplayValue(displayAltitude)}<span className="text-xs ml-1 text-white/60">m</span></span>
            {!isLaunched && maxAltitude > 0 && <span className="text-xs text-white/60">max</span>}
          </div>
        </div>
        <div className="w-3/4 mt-2 flex items-center mx-auto h-6" style={{ minHeight: '24px' }}>
        {!isLaunched && (
            <>
            <div className="relative w-full h-6 flex items-center px-1">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={throttle}
                onChange={e => setThrottle(parseFloat(e.target.value))}
                className="absolute w-full appearance-none bg-transparent cursor-pointer z-10"
                style={{ 
                  WebkitAppearance: 'none',
                  appearance: 'none',
                  height: '1.5rem'
                }}
              />
              <div className="absolute top-1/2 transform -translate-y-1/2 left-1 right-1 flex justify-between">
                {[0, 0.25, 0.5, 0.75, 1].map((mark) => (
                  <div key={mark} className="w-0.5 h-1.5 bg-white/30"></div>
                ))}
              </div>
            </div>
            <span className="text-xs text-white/70 ml-2 w-8">{Math.round(throttle * 100)}%</span>
            </>
        )}
        </div>
      </div>
    </div>
  );
}

// Part Label component - separate from the 3D scene for better stability
function PartLabel({ partName, visible, customStyle = { left: '20px', bottom: '500px' } }: { 
  partName: string | null, 
  visible: boolean,
  customStyle?: React.CSSProperties
}) {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 })
  const labelRef = useRef<HTMLDivElement>(null)
  
  // Initialize window size on mount and update on resize with debouncing
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    let resizeTimeout: NodeJS.Timeout;
    
    const updateWindowSize = () => {
      if (typeof window !== 'undefined') {
        setWindowSize({
          width: window.innerWidth,
          height: window.innerHeight
        })
      }
    }
    
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateWindowSize, 150); // Debounce resize events
    }
    
    // Set initial size
    updateWindowSize()
    
    // Update on resize with debouncing
    window.addEventListener('resize', debouncedResize)
    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener('resize', debouncedResize);
    }
  }, [])
  
  // Nice display names for parts
  const partDisplayNames: Record<string, string> = {
    'nosecone': 'Nose Cone',
    'body': 'Body Tube',
    'fins': 'Stabilizing Fins',
    'engine': 'Rocket Engine',
    'parachute': 'Recovery System',
    'electronics': 'Electronics Bay'
  }
  
  // Additional descriptions for educational value
  const partDescriptions: Record<string, string> = {
    'nosecone': 'Reduces air resistance and helps stability',
    'body': 'Houses payload and internal components',
    'fins': 'Provide aerodynamic stability during flight',
    'engine': 'Provides thrust through propellant combustion',
    'parachute': 'Slows descent for safe landing',
    'electronics': 'Contains flight computer and sensors'
  }
  
  if (!partName || !visible) return null
  
  // Calculate the right panel width (approximately)
  const rightPanelWidth = 250
  
  // Apply custom style or defaults
  const style = {
    ...customStyle,
    position: 'absolute' as const,
    maxWidth: `${Math.min(300, windowSize.width - rightPanelWidth - 60)}px`
  }
  
  return (
    <div 
      ref={labelRef}
      className="z-50 pointer-events-none"
      style={style}
    >
      <div className="bg-black bg-opacity-75 text-white px-4 py-2 rounded-md shadow-lg border border-cyan-400">
        <div className="text-sm font-medium text-cyan-300 mb-1">{partDisplayNames[partName] || partName}</div>
        <div className="text-xs text-white/80">{partDescriptions[partName] || ''}</div>
      </div>
    </div>
  )
}

interface MiddlePanelProps {
  isMobile?: boolean;
  isSmallDesktop?: boolean;
  isFullScreen?: boolean;
  loadSessionId?: string | null;
  onChatSessionLoad?: (sessionId: string | null) => void;
  projectId?: string | null;
}

export default function MiddlePanel({ 
  isMobile = false, 
  isSmallDesktop = false, 
  isFullScreen = false,
  loadSessionId,
  onChatSessionLoad,
  projectId 
}: MiddlePanelProps) {
  // Add container ref and size state for resize detection
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  
  // Right panel width state for resizing
  const [rightPanelWidth, setRightPanelWidth] = useState(520); // 2x the original 320px
  
  // Resize functionality for right panel
  const handleRightDividerDrag = (delta: number) => {
    const minWidth = 320; // Minimum width
    const maxWidth = 800; // Maximum width
    const newWidth = Math.max(minWidth, Math.min(maxWidth, rightPanelWidth - delta));
    setRightPanelWidth(newWidth);
  };

  const startRightDividerDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    
    const startX = e.clientX;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      handleRightDividerDrag(deltaX);
    };
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  // FORCE RE-RENDER MECHANISM - Add state to force component re-render
  const [forceRenderKey, setForceRenderKey] = useState(0);
  const [lastRocketHash, setLastRocketHash] = useState('');
  
  // Add resize observer to detect container size changes
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width, height });
      }
    });
    
    resizeObserver.observe(containerRef.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // State management
  const [view, setView] = useState<'top' | 'side' | 'perspective'>('perspective');
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [isLaunched, setIsLaunched] = useState(false);
  
  // Analysis and chat state (integrated from RightPanel)
  const [metricsExpanded, setMetricsExpanded] = useState(false);
  const [activeAnalysis, setActiveAnalysis] = useState<string | null>(null);
  
  // Analysis types configuration
  const analysisTypes = [
    { id: "simulation", label: "Simulation", icon: "🚀", description: "Flight performance" },
    { id: "trajectory", label: "Trajectory", icon: "📈", description: "Flight path analysis" },
    { id: "stability", label: "Stability", icon: "⚖️", description: "Center of pressure analysis" },
    { id: "recovery", label: "Recovery", icon: "🪂", description: "Parachute deployment" },
    { id: "monte-carlo", label: "Monte Carlo", icon: "🎲", description: "Statistical analysis" },
    { id: "motor", label: "Motor", icon: "🔥", description: "Engine performance" },
    { id: "environment", label: "Environment", icon: "🌍", description: "Weather conditions" },
    { id: "versions", label: "Versions", icon: "🕐", description: "Design history" },
  ];
  
  const [throttle, setThrottle] = useState(0.8);
  const [resetTrigger, setResetTrigger] = useState(false);
  
  // Get rocket and project data from store
  const { rocket, currentProject, isDatabaseConnected } = useRocket();
  
  // Determine which rocket to display
  const displayRocket = useMemo(() => {
    if (!currentProject) {
      // No project selected - show default rocket or current rocket if it's unsaved
      if (!rocket.project_id) {
        // Current rocket is not associated with any project, show it
        return rocket;
      } else {
        // Current rocket belongs to a project but no project is selected, show default
        return getDefaultRocket();
      }
    } else if (rocket.project_id === currentProject.id) {
      // Project is selected and rocket matches - show the project's rocket
      return rocket;
    } else {
      // Project is selected but rocket doesn't match
      // This happens during loading or when switching projects
      // For now, show the current rocket until the project rocket loads
      console.log('⚠️ Project selected but rocket mismatch. Project:', currentProject.id, 'Rocket project:', rocket.project_id);
      return rocket;
    }
  }, [rocket, currentProject]);
  
  // Show loading state when project is loading
  const isProjectLoading = currentProject && rocket.project_id !== currentProject.id;
  
  // Get rocket and simulation data from store for metrics
  const { sim: simData, environment, setEnvironment } = useRocket(state => ({
    sim: state.sim,
    environment: state.environment,
    setEnvironment: state.setEnvironment
  }));
  
  // Rocket metrics calculation (integrated from RightPanel)
  const estimateRocketMass = (rocket: any): number => {
    let totalMass = 0.5; // Base mass
    if (rocket.nose_cone) totalMass += 0.1;
    totalMass += rocket.body_tubes.length * 0.2;
    totalMass += rocket.fins.length * 0.05;
    totalMass += rocket.parachutes.length * 0.03;
    return totalMass;
  };
  
  const calculateStability = (rocket: any): number => {
    const finCount = rocket.fins.reduce((sum: number, fin: any) => sum + (fin.fin_count || 3), 0);
    return 1.0 + finCount * 0.3;
  };
  
  // Calculate rocket metrics
  const mass = estimateRocketMass(displayRocket);
  const motorSpec = getMotorOrDefault(displayRocket.motor?.motor_database_id || 'default-motor');
  const motorThrust = motorSpec.avgThrust_N;
  const burnTime = motorSpec.burnTime_s;
  const motorIsp = motorSpec.isp_s;
  const thrustToWeight = motorThrust / (mass * 9.81);
  
  const exhaustVelocity = motorIsp * 9.81;
  const totalMass = mass + motorSpec.mass.propellant_kg;
  const dryMass = mass + (motorSpec.mass.total_kg - motorSpec.mass.propellant_kg);
  const deltaV = exhaustVelocity * Math.log(totalMass / dryMass);
  const estimatedAltitude = (deltaV * deltaV) / (2 * 9.81) * 0.7;
  const estimatedVelocity = deltaV * 0.8;
  const estimatedRecoveryTime = (estimatedAltitude / 5) + 30;
  
  const metrics = {
    thrust: motorThrust,
    isp: motorIsp,
    mass: mass,
    altitude: simData?.maxAltitude || estimatedAltitude,
    velocity: simData?.maxVelocity || estimatedVelocity,
    stability: simData?.stabilityMargin || calculateStability(displayRocket),
    dragCoefficient: 0.4,
    apogee: simData?.maxAltitude || estimatedAltitude,
    burnTime: burnTime,
    thrustToWeight: thrustToWeight,
    deltaV: deltaV,
    recoveryTime: estimatedRecoveryTime,
    motorId: displayRocket.motor?.motor_database_id || 'default-motor',
  };
  
  // Analysis handlers
  const handleAnalysisClick = (analysisId: string) => {
    setActiveAnalysis(activeAnalysis === analysisId ? null : analysisId);
  };
  
  const renderAnalysisComponent = () => {
    switch (activeAnalysis) {
      case "simulation":
        return <SimulationTab />
      case "trajectory":
        return <TrajectoryTab />
      case "stability":
        return <StabilityTab />
      case "recovery":
        return <RecoveryTab />
      case "monte-carlo":
        return <MonteCarloTab />
      case "motor":
        return <MotorTab />
      case "environment":
        return <EnvironmentTab environment={environment} setEnvironment={setEnvironment} />
      case "versions":
        return <VersionHistoryTab />
      default:
        return null
    }
  };
  
  // FORCE RE-RENDER: Monitor rocket state changes aggressively
  useEffect(() => {
    const currentRocketHash = JSON.stringify(displayRocket);
    if (currentRocketHash !== lastRocketHash && lastRocketHash !== '') {
      console.log('🔄 MiddlePanel: Rocket state changed, forcing re-render!');
      console.log('📊 Previous hash length:', lastRocketHash.length);
      console.log('📊 Current hash length:', currentRocketHash.length);
      const partsCount = (displayRocket.nose_cone ? 1 : 0) + displayRocket.body_tubes.length + displayRocket.fins.length + displayRocket.parachutes.length + (displayRocket.motor ? 1 : 0);
      console.log('📦 Parts count changed:', partsCount);
      
      setForceRenderKey(prev => {
        const newKey = prev + 1;
        console.log(`🔑 MiddlePanel: Force render key updated: ${prev} → ${newKey}`);
        return newKey;
      });
    }
    setLastRocketHash(currentRocketHash);
  }, [displayRocket, lastRocketHash]);
  
  // FORCE RE-RENDER: Listen for action dispatcher events
  useEffect(() => {
    // Safety check for window object
    if (typeof window === 'undefined') return;
    
    const handleActionDispatch = (e: CustomEvent) => {
      console.log('🚀 MiddlePanel: Action dispatch event received, forcing re-render');
      setForceRenderKey(prev => {
        const newKey = prev + 1000; // Large increment to distinguish from normal updates
        console.log(`🔑 MiddlePanel: Action-triggered render key: ${newKey}`);
        return newKey;
      });
    };
    
    try {
      window.addEventListener('rocketActionsDispatched' as any, handleActionDispatch);
      return () => {
        if (typeof window !== 'undefined') {
          try {
            window.removeEventListener('rocketActionsDispatched' as any, handleActionDispatch);
          } catch (error) {
            console.warn('Failed to remove rocketActionsDispatched listener:', error);
          }
        }
      };
    } catch (error) {
      console.warn('Failed to add rocketActionsDispatched listener:', error);
      return () => {}; // Return empty cleanup function
    }
  }, []);
  
  // Create a simple hash of components for key generation using displayRocket
  const componentsHash = [
    displayRocket.nose_cone ? `nose-${displayRocket.nose_cone.id}-${displayRocket.nose_cone.length_m}` : '',
    ...displayRocket.body_tubes.map(body => `body-${body.id}-${body.outer_radius_m}-${body.length_m}`),
    ...displayRocket.fins.map(fin => `fin-${fin.id}-${fin.root_chord_m}-${fin.span_m}`),
    displayRocket.motor ? `motor-${displayRocket.motor.motor_database_id}` : '',
    ...displayRocket.parachutes.map(para => `para-${para.id}`)
  ].filter(Boolean).join('|');
  
  // ENHANCED KEY GENERATION with force render key
  const finalRenderKey = `${componentsHash}-force${forceRenderKey}`;
  console.log('🔧 MiddlePanel: Final render key:', finalRenderKey);
  
  // Fixed ground position that places rocket on top of grid
  const GROUND_Y = -2.8; // Updated to match the grid position
  const GROUND_POSITION: [number, number, number] = [0, GROUND_Y, 0];
  
  const [position, setPosition] = useState<[number, number, number]>(GROUND_POSITION);
  const [velocity, setVelocity] = useState<[number, number, number]>([0, 0, 0]);
  const [maxAltitude, setMaxAltitude] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [hoveredPart, setHoveredPart] = useState<string | null>(null);
  
  // Update flight data from simulation
  const updateFlightData = (pos: [number, number, number], vel: [number, number, number]) => {
    // Ensure we're not getting NaN values
    if (pos.some(isNaN) || vel.some(isNaN)) return;
    
    // Clone the arrays to ensure we break references
    const newPos: [number, number, number] = [...pos];
    const newVel: [number, number, number] = [...vel];
    
    // Set the new position and velocity immediately - removed requestAnimationFrame
    setPosition(newPos);
    setVelocity(newVel);
  };
  
  // Reset rocket function - ensures grid stays in place
  const resetRocket = () => {
    // Set a flag to prevent UI updates during transition
    window.dispatchEvent(new CustomEvent('rocketResetPrepare', { detail: { transitioning: true } }));
    
    // Important: Use requestAnimationFrame to sync with render cycle
    requestAnimationFrame(() => {
      // First stop launch state (this must happen before position changes)
    setIsLaunched(false);
      
      // Then in the next frame (after React has processed the state change)
      requestAnimationFrame(() => {
        // Set position exactly at ground level
        setPosition(GROUND_POSITION);
        setVelocity([0, 0, 0]);
        
        // Trigger reset animation in rocket
    setResetTrigger(true);
        
        // Wait for reset to complete
        setTimeout(() => {
          setResetTrigger(false);
          
          // Double-check position after reset
          setPosition(GROUND_POSITION);
          setVelocity([0, 0, 0]);
          
          // Notify that transition has completed
          window.dispatchEvent(new CustomEvent('rocketResetComplete', { detail: { position: GROUND_POSITION } }));
        }, 50);
      });
    });
  };
  
  // Launch rocket with immediate response
  const launchRocket = () => {
    // If already launched, reset first to prevent any visual jumps
    if (isLaunched) {
      resetRocket();
      
      // Wait for a few frames to ensure smooth visual transition
      setTimeout(() => {
        initiateActualLaunch();
      }, 50);
    } else {
      // Not launched, so we can start directly
      initiateActualLaunch();
    }
  };
  
  // Helper function to handle actual launch sequence
  const initiateActualLaunch = () => {
    // Important: Use requestAnimationFrame to sync with render cycle
    requestAnimationFrame(() => {
      // First ensure exact ground position
      setPosition(GROUND_POSITION);
      
      // Start with zero velocity
      setVelocity([0, 0, 0]);
      
      // Then set launch state
      setIsLaunched(true);
      
      // Trigger an immediate dashboard update for user feedback
      // This will make the dashboard respond right away
      const initialSpeedDisplay: [number, number, number] = [0, 0.01, 0];
      updateFlightData(GROUND_POSITION, initialSpeedDisplay);
      
      // Notify any components that need to respond to launch
      window.dispatchEvent(new CustomEvent('rocketLaunchInitiated', { 
        detail: { position: GROUND_POSITION, throttle }
      }));
    });
  };
  
  // Calculate speed and altitude
  // Updated altitude calculation to use standardized GROUND_Y
  const altitude = Math.max(0, position[1] - GROUND_Y);
  const speed = Math.sqrt(
    velocity[0] * velocity[0] + velocity[1] * velocity[1] + velocity[2] * velocity[2]
  );
  
  // Update max values during flight
  useEffect(() => {
    if (isLaunched && !isNaN(speed) && !isNaN(altitude)) {
      if (speed > maxSpeed) setMaxSpeed(speed);
      if (altitude > maxAltitude) setMaxAltitude(altitude);
    } else if (resetTrigger) {
      setMaxSpeed(0);
      setMaxAltitude(0);
    }
  }, [speed, altitude, isLaunched, resetTrigger, maxSpeed, maxAltitude]);
  
  // Handler for hover events from the simulation
  const handleHoverPart = useCallback((part: string | null) => {
    setHoveredPart(part);
  }, []);
  
  // Listen for component highlight events
  useEffect(() => {
    // Safety check for window object
    if (typeof window === 'undefined') return;
    
    const handleHighlight = (e: CustomEvent) => {
      if (e && e.detail !== undefined) {
        setSelectedPart(e.detail)
      }
    }
    
    try {
      window.addEventListener('highlightComponent' as any, handleHighlight)
      return () => {
        if (typeof window !== 'undefined') {
          try {
            window.removeEventListener('highlightComponent' as any, handleHighlight)
          } catch (error) {
            console.warn('Failed to remove highlightComponent listener:', error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to add highlightComponent listener:', error);
      return () => {}; // Return empty cleanup function
    }
  }, []) // Empty dependency array to prevent re-renders

  // Listen for nose cone click events to reset camera view
  useEffect(() => {
    // Safety check for window object
    if (typeof window === 'undefined') return;
    
    const handleResetCameraView = () => {
      setView('perspective')
      // Reset compass when camera view is reset
      if (typeof window !== 'undefined') {
        try {
          window.dispatchEvent(new CustomEvent('rocketRotation', { 
            detail: { rotation: 0 } 
          }))
        } catch (error) {
          console.warn('Failed to dispatch rocketRotation event:', error);
        }
      }
    }
    
    try {
      window.addEventListener('resetCameraView', handleResetCameraView as EventListener)
      
      return () => {
        if (typeof window !== 'undefined') {
          try {
            window.removeEventListener('resetCameraView', handleResetCameraView as EventListener)
          } catch (error) {
            console.warn('Failed to remove resetCameraView listener:', error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to add resetCameraView listener:', error);
      return () => {}; // Return empty cleanup function
    }
  }, []) // Empty dependency array to prevent re-renders
  
  // Adjust UI positioning based on fullscreen mode
  const viewportControlsClass = isFullScreen 
    ? "absolute top-4 right-4 z-50" 
    : "absolute top-8 right-10 z-50";
  
  const labelPositionStyle = isFullScreen 
    ? { left: '20px', bottom: '150px' } 
    : { left: '20px', bottom: '500px' };
  
  const componentTreeClass = isFullScreen 
    ? "absolute bottom-24 right-4 glass-panel rounded p-3 w-48 z-10 shadow-lg" 
    : "absolute bottom-4 right-4 glass-panel rounded p-3 w-48 z-10 shadow-lg";
  
  return (
    <div 
      ref={containerRef}
      className="flex-1 min-w-0 h-full overflow-hidden flex bg-gradient-to-b from-gray-900 to-black"
    >
      {/* Left side: 3D Visualization */}
      <div className="flex-1 min-w-0 h-full overflow-hidden relative">
        {/* Floating Analysis Tabs - positioned over 3D area */}
        <div className="absolute top-6 right-6 z-30">
          <div className="flex flex-col space-y-3">
            {analysisTypes.map((analysis, index) => (
              <motion.div
                key={analysis.id}
                className={cn(
                  "group relative transition-all duration-300 ease-out",
                  activeAnalysis === analysis.id ? "scale-110" : "hover:scale-105",
                )}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <button
                  onClick={() => handleAnalysisClick(analysis.id)}
                  className={cn(
                    "w-12 h-12 rounded-full transition-all duration-300 flex items-center justify-center text-lg backdrop-blur-xl border shadow-lg relative overflow-hidden",
                    activeAnalysis === analysis.id
                      ? "bg-white text-black border-white/20 shadow-white/20"
                      : "bg-black/40 text-white border-white/10 hover:bg-white/10 hover:border-white/20",
                  )}
                >
                  <span className="relative z-10">{analysis.icon}</span>
                  {activeAnalysis === analysis.id && (
                    <motion.div
                      className="absolute inset-0 bg-white"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3 }}
                    />
                  )}
                </button>

                {/* Enhanced Tooltip */}
                <div className="absolute right-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none">
                  <div className="bg-black/90 backdrop-blur-xl border border-white/10 rounded-lg px-3 py-2 text-sm whitespace-nowrap">
                    <div className="font-medium text-white">{analysis.label}</div>
                    <div className="text-gray-400 text-xs">{analysis.description}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Canvas first - responsive size */}
        <div className="absolute inset-0 w-full h-full overflow-hidden">
          <Canvas 
            shadows
            key={`canvas-${containerSize.width}-${containerSize.height}`}
            style={{ width: '100%', height: '100%', background: 'transparent' }}
          >
            {/* Add global mouse position handler */}
            <MousePositionHandler />
            
            <DynamicCamera 
          isLaunched={isLaunched} 
              target={position}
              view={view}
            />
            
            {/* Use regular OrbitControls instead of CustomOrbitControls */}
            <OrbitControls 
              enableDamping={true}
              dampingFactor={0.2}
              minDistance={1.5} 
              maxDistance={50}
              rotateSpeed={0.8}
              target={[position[0], position[1], position[2]]}
              enableZoom={true}
              enablePan={true}
              enableRotate={true}
            />
            
            <ambientLight intensity={0.6} />
            <directionalLight 
              position={[10, 10, 5]} 
              intensity={1.2} 
              castShadow={true}
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
              shadow-camera-near={0.1}
              shadow-camera-far={50}
              shadow-camera-left={-10}
              shadow-camera-right={10}
              shadow-camera-top={10}
              shadow-camera-bottom={-10}
            />
            
            <Grid 
              args={[50, 50]} 
              position={[0, GROUND_Y, 0]} 
              visible={true}
              sectionColor="#06b6d4"
            />
            <Suspense fallback={null}>
              {/* FORCE RE-RENDER: Use finalRenderKey to force re-creation when actions are dispatched */}
              <RocketSimulation 
                key={`rocket-${isLaunched ? 'launched' : 'idle'}-${resetTrigger ? 'reset' : 'normal'}-${finalRenderKey}`}
                selected={selectedPart !== null} 
                isLaunched={isLaunched} 
                throttle={throttle}
                resetTrigger={resetTrigger}
                setFlightData={updateFlightData}
                highlightedPart={selectedPart || hoveredPart}
                onHoverPart={handleHoverPart}
                displayRocket={displayRocket}
              />
            </Suspense>
          </Canvas>
        </div>
        
        {/* UI elements - absolutely positioned over the canvas */}
        <div className={viewportControlsClass}>
          <ViewportControls view={view} setView={setView} isMobile={isMobile} />
        </div>
        
        {/* Display part label outside of the 3D canvas for better stability */}
        <PartLabel 
          partName={hoveredPart} 
          visible={!isLaunched && hoveredPart !== null}
          customStyle={labelPositionStyle}
        />
        
        {/* Component tree panel */}
        <div className={componentTreeClass}>
          <ComponentTree 
            selectedPart={selectedPart} 
            setSelectedPart={setSelectedPart} 
            hoveredPart={hoveredPart}
          />
        </div>
        
        <LaunchData
          isLaunched={isLaunched}
          setIsLaunched={setIsLaunched}
          throttle={throttle}
          setThrottle={setThrottle}
          resetRocket={resetRocket}
          launchRocket={launchRocket}
          speed={isNaN(speed) ? 0 : speed}
          altitude={isNaN(altitude) ? 0 : altitude}
          maxSpeed={isNaN(maxSpeed) ? 0 : maxSpeed}
          maxAltitude={isNaN(maxAltitude) ? 0 : maxAltitude}
          isMobile={isMobile}
        />
      </div>
      
      {/* Panel Divider for resizing */}
      <div 
        className="w-1 h-full cursor-col-resize flex-shrink-0 bg-white/5 hover:bg-cyan-500/20 transition-colors relative z-10"
        onMouseDown={startRightDividerDrag}
      >
        <div className="absolute inset-0 w-3 -translate-x-1/2 hover:bg-cyan-500 hover:bg-opacity-20" />
      </div>
      
      {/* Right side: AI Assistant Chat Only */}
      <div 
        className="h-full flex-shrink-0 bg-black border-l border-white/10"
        style={{ width: `${rightPanelWidth}px` }}
      >
        <div className="w-full h-full flex flex-col relative bg-black min-w-0">
          {/* Header */}
          <div className="p-6 border-b border-white/5 backdrop-blur-xl bg-black/50 w-full">
            <div className="flex items-center justify-between w-full">
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-white">AI Assistant</h2>
                <p className="text-sm text-gray-400">Advanced rocket design intelligence</p>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-xs text-gray-400">Neural network active</span>
                </div>
              </div>
            </div>
          </div>

          {/* Content - Chat or Analysis */}
          <div className="flex-1 relative overflow-hidden w-full min-w-0">
            {/* Chat View */}
            <div
              className={cn(
                "absolute inset-0 transition-all duration-500 ease-in-out w-full min-w-0",
                activeAnalysis ? "opacity-0 translate-x-full" : "opacity-100 translate-x-0",
              )}
            >
              <IntegratedChatPanel 
                metrics={metrics}
                metricsExpanded={metricsExpanded}
                onToggleMetrics={() => setMetricsExpanded(!metricsExpanded)}
                activeAnalysis={activeAnalysis}
                onAnalysisClick={handleAnalysisClick}
                loadSessionId={loadSessionId}
                projectId={projectId}
              />
            </div>

            {/* Analysis Views */}
            <div
              className={cn(
                "absolute inset-0 transition-all duration-500 ease-in-out w-full min-w-0",
                activeAnalysis ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-full",
              )}
            >
              <div className="w-full h-full min-w-0">
                {renderAnalysisComponent()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 

// Environment Tab Component
interface EnvironmentTabProps {
  environment: any;
  setEnvironment: (env: any) => void;
}

function EnvironmentTab({ environment, setEnvironment }: EnvironmentTabProps) {
  return (
    <div className="h-full p-6 space-y-6 overflow-y-auto w-full">
      {/* Close button */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">Environment Analysis</h3>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('closeAnalysis'))}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
        >
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Weather Status Component */}
      <WeatherStatus />

      {/* Atmospheric Model Selector */}
      <AtmosphericModelSelector environment={environment} setEnvironment={setEnvironment} />
      
      {/* Environment Configuration */}
      <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-4">
        <h3 className="font-medium text-white mb-4 flex items-center gap-2">
          <span>🌍</span>
          Launch Environment
        </h3>
        
        <div className="space-y-4">
          {/* Current Environment Display */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Atmospheric Model</p>
              <p className="font-medium text-white">
                {environment?.atmospheric_model || 'Standard'}
              </p>
            </div>
            
            <div>
              <p className="text-gray-400">Data Source</p>
              <p className="font-medium text-white">
                {environment?.atmospheric_model === 'forecast' ? 'Real-time' : 'Standard ISA'}
              </p>
            </div>
          </div>

          {/* Environment Quality Indicator */}
          <div className="bg-black/40 rounded-lg p-3 border border-gray-600/30">
            <h4 className="font-medium text-gray-100 mb-2">
              Simulation Accuracy
            </h4>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                environment?.atmospheric_model === 'forecast' 
                  ? 'bg-green-400' 
                  : 'bg-yellow-400'
              }`} />
              <span className="text-sm text-gray-200">
                {environment?.atmospheric_model === 'forecast' 
                  ? 'High accuracy with real atmospheric data'
                  : 'Standard accuracy with ISA model'
                }
              </span>
            </div>
          </div>

          {/* Launch Recommendations */}
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <h4 className="font-medium text-white mb-2">
              Launch Recommendations
            </h4>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Check wind conditions before launch</li>
              <li>• Verify recovery system deployment altitude</li>
              <li>• Consider atmospheric density effects on drag</li>
              <li>• Monitor visibility for tracking</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Advanced Environment Settings */}
      <div className="bg-white/5 backdrop-blur-xl rounded-lg border border-white/10 p-4">
        <h3 className="font-medium text-white mb-4 flex items-center gap-2">
          <span>⚙️</span>
          Advanced Settings
        </h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Use real-time weather data</span>
            <div className={`w-10 h-6 rounded-full transition-colors ${
              environment?.atmospheric_model === 'forecast' 
                ? 'bg-green-500' 
                : 'bg-gray-600'
            }`}>
              <div className={`w-4 h-4 bg-white rounded-full mt-1 transition-transform ${
                environment?.atmospheric_model === 'forecast' 
                  ? 'translate-x-5' 
                  : 'translate-x-1'
              }`} />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">High-resolution atmospheric model</span>
            <div className="w-10 h-6 bg-gray-600 rounded-full">
              <div className="w-4 h-4 bg-white rounded-full mt-1 translate-x-1" />
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Include turbulence effects</span>
            <div className="w-10 h-6 bg-gray-600 rounded-full">
              <div className="w-4 h-4 bg-white rounded-full mt-1 translate-x-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 