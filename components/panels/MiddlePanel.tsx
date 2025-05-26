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
import { motion } from 'framer-motion'
import { useRocket } from '@/lib/store'

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
  setHoveredPart
}: { 
  selected: boolean, 
  isLaunched: boolean,
  throttle: number,
  highlightedPart: string | null,
  preLaunchFire?: boolean,
  countdownStage?: number,
  setHoveredPart: (part: string | null) => void
}) {
  const rocketRef = useRef<THREE.Group>(null)
  
  // Get rocket parts from the store with explicit subscription to force re-renders
  const rocket = useRocket(state => state.rocket)
  const { parts } = rocket
  
  // Force re-render when rocket parts change
  const [renderKey, setRenderKey] = useState(0)
  const prevPartsRef = useRef(parts)
  
  useEffect(() => {
    const currentPartsStr = JSON.stringify(parts)
    const prevPartsStr = JSON.stringify(prevPartsRef.current)
    
    if (currentPartsStr !== prevPartsStr) {
      console.log('🔄 Parts changed, forcing re-render')
      console.log('Previous parts:', prevPartsRef.current)
      console.log('Current parts:', parts)
      setRenderKey(prev => prev + 1)
      prevPartsRef.current = parts
    }
  }, [parts])
  
  // Find parts by type
  const nosePart = parts.find(part => part.type === 'nose')
  const bodyPart = parts.find(part => part.type === 'body')
  const finParts = parts.filter(part => part.type === 'fin')
  const enginePart = parts.find(part => part.type === 'engine') // Add engine part lookup
  
  // DEBUG: Log bodyPart details
  console.log("RocketModel: bodyPart from store:", bodyPart);
  console.log("RocketModel: bodyPart.Ø:", bodyPart?.Ø);

  // Get dimensions from the store or use defaults, scaled for the scene (e.g., cm / 10 = scene units)
  const bodyRadius = bodyPart?.Ø ? bodyPart.Ø / 20 : 0.5; // Diameter to Radius, then scale
  console.log("RocketModel: calculated bodyRadius for scene:", bodyRadius);
  
  // Force Three.js to recognize the dimension change with a unique string
  const dimensionKey = `dims-radius${bodyRadius.toFixed(4)}`;
  console.log("RocketModel: dimensionKey for recreating geometries:", dimensionKey);
  
  const bodyLengthScaled = bodyPart?.length ? bodyPart.length / 10 : 4;
  const noseLengthScaled = nosePart?.length ? nosePart.length / 10 : 1.5;
  const noseShape = nosePart?.shape || 'ogive'; // Currently, 'ogive' is handled by cone, 'conical' would be the same.
  
  // Fin dimensions
  const finRootScaled = finParts[0]?.root ? finParts[0].root / 10 : 1;
  const finSpanScaled = finParts[0]?.span ? finParts[0].span / 10 : 0.8;
  // const finSweepScaled = finParts[0]?.sweep ? finParts[0].sweep / 100 : 0; // Sweep is not used by current boxGeometry

  // Proportional lengths for body segments based on original hardcoded ratio (1.6 upper, 2.4 lower => 40% upper, 60% lower)
  const upperBodyActualLength = bodyLengthScaled * 0.4;
  const lowerBodyActualLength = bodyLengthScaled * 0.6;

  // Define key Y positions based on the original structure's reference seam (where upper and lower body meet)
  // This seam was effectively at Y=0.4 in the original hardcoded model, relative to rocketRef's origin.
  const seamY = 0.4; 

  const lowerBodyCenterY = seamY - lowerBodyActualLength / 2;
  const upperBodyCenterY = seamY + upperBodyActualLength / 2;

  const bottomOfLowerBodyY = seamY - lowerBodyActualLength; 
  const topOfUpperBodyY = seamY + upperBodyActualLength;   

  // Nose cone positioning
  const noseConeBaseY = topOfUpperBodyY;
  const noseConeCenterY = noseConeBaseY + noseLengthScaled / 2;

  // Electronics bay (centered at seamY, fixed height of 0.4)
  const electronicsBayCenterY = seamY;

  // Fins positioning
  // Fins are attached at the bottom of the lower body, extending upwards.
  // Their center is half their root length up from the bottom of the lower body.
  const finCenterY = bottomOfLowerBodyY + finRootScaled / 2;
  const finRadialOffset = bodyRadius + 0.05; // Position fins slightly outside the body radius

  // Engine positioning
  // Original engine group center Y was -2.2. Original bottomOfLowerBodyY was -2.0. Offset = -0.2.
  const engineGroupCenterY = bottomOfLowerBodyY - 0.2;
  
  // Parachute positioning
  // Original parachute Y was 1.5. SeamY was 0.4. Original upper body length was 1.6.
  // Proportional distance up from seam: (1.5 - 0.4) / 1.6 = 0.6875
  const parachuteCenterY = seamY + (upperBodyActualLength * 0.6875);

  // Flame positioning: RocketFlame's internal flame group is hardcoded at y=-3.
  // We need to place the RocketFlame component instance such that this y=-3 aligns with the engine nozzle tip.
  // Approximate engine nozzle tip Y: engineGroupCenterY - (engine main cylinder height/2) - (engine cone height) - (engine small cylinder height)
  // Original engine: main cyl height 0.5, cone 0.4, small cyl 0.3. Total ~0.95 from engineGroupCenterY to nozzle tip.
  const engineNozzleTipY = engineGroupCenterY - 0.95; 
  // So, if RocketFlame instance is placed at Y_placement, its visual flame appears at Y_placement - 3.
  // We want Y_placement - 3 = engineNozzleTipY
  // Y_placement = engineNozzleTipY + 3
  const flameComponentPlacementY = engineNozzleTipY + 3;
  
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
  
  // Raycasting (largely unchanged, mouse interaction logic)
  const raycaster = useRef(new THREE.Raycaster())
  const mouse = useRef(new THREE.Vector2(-1000, -1000)) // Initialize off-screen
  const threeState = useThree()

  // Listen for mouse movement events
  useEffect(() => {
    const handleMouseMove = (e: CustomEvent) => {
      if (e.detail && typeof e.detail.x === 'number' && typeof e.detail.y === 'number') {
        mouse.current.x = e.detail.x
        mouse.current.y = e.detail.y
      }
    }
    
    window.addEventListener('rocketMouseMove' as any, handleMouseMove)
    
    return () => {
      window.removeEventListener('rocketMouseMove' as any, handleMouseMove)
    }
  }, [])

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
      key={`rocket-${renderKey}`}
      position={[0, 0.8, 0]}
    >
      {/* Upper body */}
      <mesh position={[0, upperBodyCenterY, 0]} name="upper-airframe">
        <cylinderGeometry 
          key={dimensionKey + '-upper'} 
          args={[bodyRadius, bodyRadius, upperBodyActualLength, 32]} 
        />
        <meshStandardMaterial 
          color={bodyPart?.color || "#8C8D91"} 
          metalness={0.6} 
          roughness={0.2} 
          emissive={getEmissive('airframe')}
          emissiveIntensity={getEmissiveIntensity('airframe')}
        />
      </mesh>
      
      {/* Lower body */}
      <mesh position={[0, lowerBodyCenterY, 0]} name="lower-airframe">
        <cylinderGeometry 
          key={dimensionKey + '-lower'} 
          args={[bodyRadius, bodyRadius, lowerBodyActualLength, 32]} 
        />
        <meshStandardMaterial 
          color={bodyPart?.color || "#8C8D91"} 
          metalness={0.6} 
          roughness={0.2} 
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
      
      {/* Nose cone */}
      <mesh position={[0, noseConeCenterY, 0]} name="nosecone">
        <coneGeometry 
          key={dimensionKey + '-nose'} 
          args={[bodyRadius, noseLengthScaled, 32]} 
        /> {/* Use noseLengthScaled */}
        <meshStandardMaterial 
          color={nosePart?.color || "#A0A7B8"} 
          metalness={0.7} 
          roughness={0.2} 
          emissive={getEmissive('nosecone')}
          emissiveIntensity={getEmissiveIntensity('nosecone')}
        />
      </mesh>
      
      {/* Electronics bay */}
      <group position={[0, electronicsBayCenterY, 0]} name="electronics">
        <mesh>
          <cylinderGeometry 
            key={dimensionKey + '-electronics'} 
            args={[bodyRadius + 0.01, bodyRadius + 0.01, 0.4, 32]} 
          /> {/* Fixed height 0.4 */}
          <meshStandardMaterial 
            color="#222222"
            metalness={0.35}
            roughness={0.7}
            emissive={getEmissive('electronics')}
            emissiveIntensity={getEmissiveIntensity('electronics')}
          />
        </mesh>
        
        {/* Rings */}
        {[0.2, -0.2].map((y, i) => (
          <mesh key={i} position={[0, y, 0]}>
          <torusGeometry 
            key={`${dimensionKey}-ring-${i}`} 
            args={[bodyRadius + 0.01, 0.02, 16, 32]} 
          />
          <meshStandardMaterial color="#888888" metalness={0.8} roughness={0.2} />
        </mesh>
        ))}
        
        {/* Details */}
      {[0, 1, 2, 3].map((i) => (
        <mesh 
          key={i}
          position={[
              Math.sin(i * Math.PI / 2) * (bodyRadius - 0.05),
              0, 
              Math.cos(i * Math.PI / 2) * (bodyRadius - 0.05)
            ]}
            rotation={[0, i * Math.PI / 2, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.04, 0.04, 0.1, 8]} /> {/* Fixed size detail */}
            <meshStandardMaterial color="#444444" metalness={0.7} roughness={0.3} />
          </mesh>
        ))}
      </group>
      
      {/* Fins */}
      {[0, 1, 2, 3].map((i) => (
        <mesh 
          key={i}
          position={[
            Math.sin(i * Math.PI / 2) * finRadialOffset, // Use dynamic radial offset
            finCenterY, // Use dynamic Y center for fins
            Math.cos(i * Math.PI / 2) * finRadialOffset
          ]}
          rotation={[0, i * Math.PI / 2, 0]}
          name="fins"
        >
          <boxGeometry 
            key={`${dimensionKey}-fin-${i}`} 
            args={[0.1, finRootScaled, finSpanScaled]} 
          /> {/* Use finRootScaled, finSpanScaled */}
          <meshStandardMaterial 
            color={finParts[0]?.color || "#A0A7B8"} 
            metalness={0.3} 
            roughness={0.3} 
            emissive={getEmissive('fins')}
            emissiveIntensity={getEmissiveIntensity('fins')}
          />
        </mesh>
      ))}
      
      {/* Engine */}
      <group position={[0, engineGroupCenterY, 0]} name="engine">
        {/* Engine parts have fixed dimensions relative to engineGroupCenterY */}
        <mesh>
          <cylinderGeometry args={[0.35, 0.4, 0.5, 32]} />
          <meshStandardMaterial 
            color={enginePart?.color || "#0066FF"} 
            metalness={0.7} 
            roughness={0.3} 
            emissive={getEmissive('engine')}
            emissiveIntensity={getEmissiveIntensity('engine')}
          />
      </mesh>

        <mesh position={[0, -0.3, 0]}> {/* Relative to engine group center */}
          <coneGeometry args={[0.4, 0.4, 32, 1, true]} />
          <meshStandardMaterial 
            color={enginePart?.color || "#0066FF"} 
            metalness={0.7} 
            roughness={0.2}
            emissive={getEmissive('engine')}
            emissiveIntensity={getEmissiveIntensity('engine')}
          />
        </mesh>
        
        <mesh position={[0, -0.5, 0]} rotation={[Math.PI, 0, 0]}> {/* Relative to engine group center */}
          <cylinderGeometry args={[0.28, 0.32, 0.3, 32]} />
          <meshStandardMaterial color="#111111" metalness={0.5} roughness={0.8} />
        </mesh>
      </group>

      {/* Parachute */}
      <mesh position={[0, parachuteCenterY, 0]} name="parachute">
        <cylinderGeometry args={[0.2, 0.2, 0.3, 16]} /> {/* Fixed size parachute */}
        <meshStandardMaterial 
          color="#DD2222" 
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
    top: new THREE.Vector3(0, 15, 0),      // Directly above
    side: new THREE.Vector3(15, 0, 0),     // Pure side view
    perspective: new THREE.Vector3(10, 10, 10)  // Isometric view
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
        top: [0, 15, 0],          // Directly above
        side: [15, 0, 0],         // Pure side view
        perspective: [10, 10, 10]  // Isometric view
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
    top: [0, 15, 0],
    side: [15, 0, 0],
    perspective: [10, 10, 10],
  } as const;
  
  return <PerspectiveCamera ref={ref} makeDefault position={cameraPositions[view]} fov={50} />;
}

// Global tracking of rocket position for debugging - emergency backup
let globalRocketY = -2.8; // Updated global reference

// Add mouse event handler at the top level
function MousePositionHandler() {
  const [mousePos, setMousePos] = useState<[number, number]>([-1000, -1000])
  
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      // Calculate normalized device coordinates
      const x = (event.clientX / window.innerWidth) * 2 - 1
      const y = -(event.clientY / window.innerHeight) * 2 + 1
      
      setMousePos([x, y])
      
      // Set mouse position for raycasting in RocketModel
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rocketMouseMove', { 
          detail: { x, y } 
        }))
      }
    }
    
    // Add event listener
    window.addEventListener('mousemove', handleMouseMove)
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [])
  
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
  onHoverPart
}: {
  selected: boolean,
  isLaunched: boolean,
  throttle: number,
  resetTrigger: boolean,
  setFlightData: (position: [number, number, number], velocity: [number, number, number]) => void,
  highlightedPart: string | null,
  onHoverPart?: (part: string | null) => void
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
    // Function to handle rotation updates
    const handleRocketRotation = (e: CustomEvent) => {
      if (e.detail && typeof e.detail.rotation === 'number') {
        setCompassRotation(e.detail.rotation);
      }
    };
    
    // Listen for custom rocket rotation events
    window.addEventListener('rocketRotation' as any, handleRocketRotation);
    
    return () => {
      window.removeEventListener('rocketRotation' as any, handleRocketRotation);
    };
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
    <div className="absolute bottom-4 right-4 glass-panel rounded p-3 w-48 z-10 shadow-lg">
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
    </div>
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
  
  // COMPLETELY NEW APPROACH: Generate synthetic display values
  // This runs independently of the physics engine
  useEffect(() => {
    // Start the animation when launched
    if (isLaunched && !launchTimeRef.current) {
      launchTimeRef.current = Date.now() / 1000;
      
      // Start an animation frame loop to update values
      const updateDisplayValues = () => {
        if (!isLaunched) {
          launchTimeRef.current = null;
          setForcedSpeed(0);
          setForcedAltitude(0);
          return;
        }
        
        const now = Date.now() / 1000;
        const elapsed = now - (launchTimeRef.current || now);
        
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
        
        setForcedSpeed(newSpeed);
        setForcedAltitude(newAltitude);
        
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
  
  // Initialize window size on mount and update on resize
  useEffect(() => {
    const updateWindowSize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }
    
    // Set initial size
    updateWindowSize()
    
    // Update on resize
    window.addEventListener('resize', updateWindowSize)
    return () => window.removeEventListener('resize', updateWindowSize)
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

export default function MiddlePanel({ isMobile = false, isSmallDesktop = false, isFullScreen = false }) {
  // State management
  const [view, setView] = useState<'top' | 'side' | 'perspective'>('perspective');
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [isLaunched, setIsLaunched] = useState(false);
  const [throttle, setThrottle] = useState(0.8);
  const [resetTrigger, setResetTrigger] = useState(false);
  
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
    const handleHighlight = (e: CustomEvent) => setSelectedPart(e.detail)
    window.addEventListener('highlightComponent' as any, handleHighlight)
    return () => window.removeEventListener('highlightComponent' as any, handleHighlight)
  }, [])

  // Listen for nose cone click events to reset camera view
  useEffect(() => {
    const handleResetCameraView = () => {
      setView('perspective')
      // Reset compass when camera view is reset
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rocketRotation', { 
          detail: { rotation: 0 } 
        }))
      }
    }
    
    window.addEventListener('resetCameraView', handleResetCameraView as EventListener)
    
    return () => {
      window.removeEventListener('resetCameraView', handleResetCameraView as EventListener)
    }
  }, [])
  
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
    <div className="relative w-full h-full overflow-hidden">
      {/* Canvas first - fixed size and position */}
      <div className="absolute inset-0 w-full h-full overflow-hidden">
        <Canvas shadows>
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
            minDistance={2} 
            maxDistance={100}
            rotateSpeed={0.8}
            target={[position[0], position[1], position[2]]}
          />

          {/* Scene lighting */}
          <ambientLight intensity={0.25} /> 
          <directionalLight 
            position={[8, 10, 5]} 
            intensity={0.7} 
            castShadow 
            shadow-mapSize={[1024, 1024]}
            shadow-camera-far={50}
            shadow-camera-left={-10}
            shadow-camera-right={10}
            shadow-camera-top={10}
            shadow-camera-bottom={-10}
          />
          <directionalLight position={[-6, 3, -5]} intensity={0.25} />
          <spotLight 
            position={[0, -2, 10]} 
            intensity={0.4} 
            angle={0.6} 
            penumbra={0.5} 
            distance={20}
            color="#5eead4"
          />
          
          {/* Launch light - adjusted to match ground position */}
          {isLaunched && (
            <pointLight 
              position={[0, GROUND_Y, 0]} 
              intensity={2} 
              distance={15} 
              color="#ff8866"
              decay={2}
            />
          )}
          
          <Environment preset="night" />
          {/* Fixed contact shadows at exactly ground level */}
          <ContactShadows 
            position={[0, GROUND_Y + 0.01, 0]} 
            opacity={0.4} 
            scale={15} 
            blur={2.5} 
            far={5} 
            resolution={512}
            color="#001133"
            frames={1} // Render once and cache for better performance
          />
          
          {/* Absolutely fixed grid that never moves */}
          <Grid 
            infiniteGrid 
            cellSize={0.5} 
            cellThickness={0.5} 
            sectionSize={2} 
            sectionThickness={1} 
            fadeDistance={30} 
            fadeStrength={1.5}
            cellColor="#00eaff" 
            sectionColor="#ec4899"
            position={[0, GROUND_Y, 0]}
          />
          <Suspense fallback={null}>
            {/* Force re-creation of RocketSimulation when launch state changes */}
            <RocketSimulation 
              key={`rocket-${isLaunched ? 'launched' : 'idle'}-${resetTrigger ? 'reset' : 'normal'}`}
              selected={selectedPart !== null} 
              isLaunched={isLaunched} 
              throttle={throttle}
              resetTrigger={resetTrigger}
              setFlightData={updateFlightData}
              highlightedPart={selectedPart || hoveredPart}
              onHoverPart={handleHoverPart}
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
  )
} 