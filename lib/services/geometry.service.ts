/**
 * Component Geometry Generator Service
 * 
 * This service generates accurate 3D geometry for rocket components
 * that can be exported for 3D printing. It handles different component
 * types and applies material-specific adjustments.
 */

import * as THREE from 'three';
import { CSG } from 'three-csg-ts';
import { NoseComponent, BodyComponent, FinComponent } from '@/types/rocket';
import { PrintingMaterialSpec, calculateOptimalWallThickness } from '@/lib/data/materials';

export interface GeometryResult {
  geometry: THREE.BufferGeometry;
  volume_cm3: number;
  surface_area_cm2: number;
  boundingBox: THREE.Box3;
  centerOfMass: THREE.Vector3;
}

export interface ExportGeometryOptions {
  material: PrintingMaterialSpec;
  includeSupports: boolean;
  layerHeight: number;
  infillPercent: number;
  exportUnits: 'mm' | 'cm' | 'm';
}

export class ComponentGeometryGenerator {
  
  /**
   * Generate nose cone geometry based on shape and material
   */
  generateNoseConeGeometry(
    component: NoseComponent, 
    material: PrintingMaterialSpec
  ): GeometryResult {
    const optimalWallThickness = calculateOptimalWallThickness(
      material, 
      'nose_cone', 
      (component.base_radius_m || 0.025) * 2
    );
    
    let geometry: THREE.BufferGeometry;
    
    switch (component.shape) {
      case "ogive":
        geometry = this.generateOgiveGeometry(component, optimalWallThickness);
        break;
      case "conical":
        geometry = this.generateConicalGeometry(component, optimalWallThickness);
        break;
      case "elliptical":
        geometry = this.generateEllipticalGeometry(component, optimalWallThickness);
        break;
      case "parabolic":
        geometry = this.generateParabolicGeometry(component, optimalWallThickness);
        break;
      default:
        geometry = this.generateConicalGeometry(component, optimalWallThickness);
    }
    
    return this.calculateGeometryProperties(geometry);
  }
  
  /**
   * Generate body tube geometry
   */
  generateBodyTubeGeometry(
    component: BodyComponent, 
    material: PrintingMaterialSpec
  ): GeometryResult {
    const optimalWallThickness = calculateOptimalWallThickness(
      material, 
      'body_tube', 
      component.outer_radius_m * 2
    );
    
    const geometry = this.generateCylindricalShellGeometry(
      component.outer_radius_m,
      component.length_m,
      optimalWallThickness
    );
    
    return this.calculateGeometryProperties(geometry);
  }
  
  /**
   * Generate fin geometry
   */
  generateFinGeometry(
    component: FinComponent, 
    material: PrintingMaterialSpec
  ): GeometryResult {
    const optimalWallThickness = calculateOptimalWallThickness(
      material, 
      'fin', 
      component.span_m * 2
    );
    
    const geometry = this.generateTrapezoidalFinGeometry(component, optimalWallThickness);
    
    return this.calculateGeometryProperties(geometry);
  }
  
  /**
   * Generate ogive nose cone geometry
   */
  private generateOgiveGeometry(
    component: NoseComponent, 
    wallThickness: number
  ): THREE.BufferGeometry {
    const length = component.length_m;
    const baseRadius = component.base_radius_m || 0.025;
    const wallThickness_m = wallThickness / 1000; // Convert mm to m
    
    // Create seamless hollow ogive using CSG operations
    const segments = 64; // High segment count for smooth appearance
    
    // Create outer cone
    const outerGeometry = new THREE.ConeGeometry(
      baseRadius, length, segments, 1, false
    );
    const outerMesh = new THREE.Mesh(outerGeometry);
    
    // Create inner cone (to be subtracted)
    const innerRadius = Math.max(0, baseRadius - wallThickness_m);
    const innerGeometry = new THREE.ConeGeometry(
      innerRadius, length, segments, 1, false
    );
    const innerMesh = new THREE.Mesh(innerGeometry);
    
    // Perform CSG subtraction to create hollow shell
    const outerCSG = CSG.fromMesh(outerMesh);
    const innerCSG = CSG.fromMesh(innerMesh);
    const hollowCSG = outerCSG.subtract(innerCSG);
    
    // Convert back to Three.js geometry
    const hollowMesh = hollowCSG.toMesh(outerMesh.matrix);
    return hollowMesh.geometry;
  }
  
  /**
   * Generate conical nose cone geometry
   */
  private generateConicalGeometry(
    component: NoseComponent, 
    wallThickness: number
  ): THREE.BufferGeometry {
    const length = component.length_m;
    const baseRadius = component.base_radius_m || 0.025;
    const wallThickness_m = wallThickness / 1000; // Convert mm to m
    
    // Create seamless hollow cone using CSG operations
    const segments = 64; // High segment count for smooth appearance
    
    // Create outer cone
    const outerGeometry = new THREE.ConeGeometry(
      baseRadius, length, segments, 1, false
    );
    const outerMesh = new THREE.Mesh(outerGeometry);
    
    // Create inner cone (to be subtracted)
    const innerRadius = Math.max(0, baseRadius - wallThickness_m);
    const innerGeometry = new THREE.ConeGeometry(
      innerRadius, length, segments, 1, false
    );
    const innerMesh = new THREE.Mesh(innerGeometry);
    
    // Perform CSG subtraction to create hollow shell
    const outerCSG = CSG.fromMesh(outerMesh);
    const innerCSG = CSG.fromMesh(innerMesh);
    const hollowCSG = outerCSG.subtract(innerCSG);
    
    // Convert back to Three.js geometry
    const hollowMesh = hollowCSG.toMesh(outerMesh.matrix);
    return hollowMesh.geometry;
  }
  
  /**
   * Generate elliptical nose cone geometry
   */
  private generateEllipticalGeometry(
    component: NoseComponent, 
    wallThickness: number
  ): THREE.BufferGeometry {
    const length = component.length_m;
    const baseRadius = component.base_radius_m || 0.025;
    const wallThickness_m = wallThickness / 1000; // Convert mm to m
    
    // Create proper hollow elliptical shell using LatheGeometry
    const segments = 32;
    const points: THREE.Vector3[] = [];
    
    // Generate points for elliptical profile
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = t * Math.PI / 2; // 0 to π/2 radians
      
      // Parametric equations for ellipse: x = a*cos(θ), y = b*sin(θ)
      const x = length * Math.cos(angle);
      const y = baseRadius * Math.sin(angle);
      
      // Outer surface
      points.push(new THREE.Vector3(x, y, 0));
      // Inner surface (wall thickness)
      const innerY = Math.max(0, y - wallThickness_m);
      points.push(new THREE.Vector3(x, innerY, 0));
    }
    
    // Create lathe geometry for hollow elliptical shell
    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, points[0].y);
    
    // Create the outer wall
    for (let i = 0; i < points.length; i += 2) {
      shape.lineTo(points[i].x, points[i].y);
    }
    
    // Create the inner wall (reverse direction)
    for (let i = points.length - 1; i >= 1; i -= 2) {
      shape.lineTo(points[i].x, points[i].y);
    }
    
    // Close the shape
    shape.lineTo(points[0].x, points[0].y);
    
    const geometry = new THREE.LatheGeometry(shape.getPoints(segments), segments);
    return geometry;
  }
  
  /**
   * Generate parabolic nose cone geometry
   */
  private generateParabolicGeometry(
    component: NoseComponent, 
    wallThickness: number
  ): THREE.BufferGeometry {
    const length = component.length_m;
    const baseRadius = component.base_radius_m || 0.025;
    const wallThickness_m = wallThickness / 1000; // Convert mm to m
    
    // Create proper hollow parabolic shell using LatheGeometry
    const segments = 32;
    const points: THREE.Vector3[] = [];
    
    // Generate points for parabolic profile
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = length * t;
      
      // Parabolic equation: y = √(4px) where p = R²/(4L)
      const p = (baseRadius * baseRadius) / (4 * length);
      const y = Math.sqrt(4 * p * x);
      
      // Outer surface
      points.push(new THREE.Vector3(x, y, 0));
      // Inner surface (wall thickness)
      const innerY = Math.max(0, y - wallThickness_m);
      points.push(new THREE.Vector3(x, innerY, 0));
    }
    
    // Create lathe geometry for hollow parabolic shell
    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, points[0].y);
    
    // Create the outer wall
    for (let i = 0; i < points.length; i += 2) {
      shape.lineTo(points[i].x, points[i].y);
    }
    
    // Create the inner wall (reverse direction)
    for (let i = points.length - 1; i >= 1; i -= 2) {
      shape.lineTo(points[i].x, points[i].y);
    }
    
    // Close the shape
    shape.lineTo(points[0].x, points[0].y);
    
    const geometry = new THREE.LatheGeometry(shape.getPoints(segments), segments);
    return geometry;
  }
  
  /**
   * Generate cylindrical shell geometry for body tubes
   */
  private generateCylindricalShellGeometry(
    outerRadius: number,
    length: number,
    wallThickness: number
  ): THREE.BufferGeometry {
    const wallThickness_m = wallThickness / 1000; // Convert mm to m
    const innerRadius = Math.max(0, outerRadius - wallThickness_m);
    
    // Create seamless hollow cylindrical shell using CSG operations
    const segments = 64; // High segment count for smooth appearance
    
    // Create outer cylinder
    const outerGeometry = new THREE.CylinderGeometry(
      outerRadius, outerRadius, length, segments, 1, false
    );
    const outerMesh = new THREE.Mesh(outerGeometry);
    
    // Create inner cylinder (to be subtracted)
    const innerGeometry = new THREE.CylinderGeometry(
      innerRadius, innerRadius, length, segments, 1, false
    );
    const innerMesh = new THREE.Mesh(innerGeometry);
    
    // Perform CSG subtraction to create hollow shell
    const outerCSG = CSG.fromMesh(outerMesh);
    const innerCSG = CSG.fromMesh(innerMesh);
    const hollowCSG = outerCSG.subtract(innerCSG);
    
    // Convert back to Three.js geometry
    const hollowMesh = hollowCSG.toMesh(outerMesh.matrix);
    return hollowMesh.geometry;
  }
  
  /**
   * Generate trapezoidal fin geometry
   */
  private generateTrapezoidalFinGeometry(
    component: FinComponent, 
    wallThickness: number
  ): THREE.BufferGeometry {
    const rootChord = component.root_chord_m;
    const tipChord = component.tip_chord_m;
    const span = component.span_m;
    const thickness = component.thickness_m;
    const sweepLength = component.sweep_length_m;
    const wallThickness_m = wallThickness / 1000; // Convert mm to m
    
    // Check if fin should be hollow (for advanced designs)
    const shouldBeHollow = wallThickness_m > 0 && wallThickness_m < thickness / 2;
    
    if (shouldBeHollow) {
      // Create hollow fin using CSG operations
      return this.generateHollowFinGeometry(component, wallThickness);
    } else {
      // Create solid fin (standard approach)
      return this.generateSolidFinGeometry(component);
    }
  }
  
  /**
   * Generate solid fin geometry (standard approach)
   */
  private generateSolidFinGeometry(component: FinComponent): THREE.BufferGeometry {
    const rootChord = component.root_chord_m;
    const tipChord = component.tip_chord_m;
    const span = component.span_m;
    const thickness = component.thickness_m;
    const sweepLength = component.sweep_length_m;
    
    // Create optimized fin shape for 3D printing
    const shape = new THREE.Shape();
    
    // Start at root leading edge
    shape.moveTo(0, 0);
    
    // Root chord
    shape.lineTo(rootChord, 0);
    
    // Tip chord (with sweep)
    shape.lineTo(rootChord - sweepLength + tipChord, span);
    
    // Tip trailing edge
    shape.lineTo(-sweepLength, span);
    
    // Close shape
    shape.lineTo(0, 0);
    
    // Extrude to create 3D fin with optimized settings
    const extrudeSettings = {
      depth: thickness,
      bevelEnabled: true,
      bevelThickness: 0.001, // Small bevel for better 3D printing
      bevelSize: 0.001,
      bevelSegments: 3,
      steps: 1
    };
    
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    
    // Center the geometry
    geometry.center();
    
    // Ensure proper normals for smooth rendering
    geometry.computeVertexNormals();
    
    return geometry;
  }
  
  /**
   * Generate hollow fin geometry using CSG operations
   */
  private generateHollowFinGeometry(
    component: FinComponent, 
    wallThickness: number
  ): THREE.BufferGeometry {
    const rootChord = component.root_chord_m;
    const tipChord = component.tip_chord_m;
    const span = component.span_m;
    const thickness = component.thickness_m;
    const sweepLength = component.sweep_length_m;
    const wallThickness_m = wallThickness / 1000; // Convert mm to m
    
    // Create outer fin shape
    const outerShape = new THREE.Shape();
    outerShape.moveTo(0, 0);
    outerShape.lineTo(rootChord, 0);
    outerShape.lineTo(rootChord - sweepLength + tipChord, span);
    outerShape.lineTo(-sweepLength, span);
    outerShape.lineTo(0, 0);
    
    // Create inner fin shape (smaller)
    const innerShape = new THREE.Shape();
    const innerRootChord = Math.max(0.01, rootChord - wallThickness_m * 2);
    const innerTipChord = Math.max(0.01, tipChord - wallThickness_m * 2);
    const innerSpan = Math.max(0.01, span - wallThickness_m * 2);
    const innerSweepLength = Math.max(0, sweepLength - wallThickness_m);
    
    innerShape.moveTo(wallThickness_m, wallThickness_m);
    innerShape.lineTo(innerRootChord + wallThickness_m, wallThickness_m);
    innerShape.lineTo(innerRootChord + wallThickness_m - innerSweepLength + innerTipChord, innerSpan + wallThickness_m);
    innerShape.lineTo(-innerSweepLength + wallThickness_m, innerSpan + wallThickness_m);
    innerShape.lineTo(wallThickness_m, wallThickness_m);
    
    // Create outer and inner geometries
    const extrudeSettings = {
      depth: thickness,
      bevelEnabled: true,
      bevelThickness: 0.001,
      bevelSize: 0.001,
      bevelSegments: 3,
      steps: 1
    };
    
    const outerGeometry = new THREE.ExtrudeGeometry(outerShape, extrudeSettings);
    const innerGeometry = new THREE.ExtrudeGeometry(innerShape, extrudeSettings);
    
    const outerMesh = new THREE.Mesh(outerGeometry);
    const innerMesh = new THREE.Mesh(innerGeometry);
    
    // Perform CSG subtraction to create hollow fin
    const outerCSG = CSG.fromMesh(outerMesh);
    const innerCSG = CSG.fromMesh(innerMesh);
    const hollowCSG = outerCSG.subtract(innerCSG);
    
    // Convert back to Three.js geometry
    const hollowMesh = hollowCSG.toMesh(outerMesh.matrix);
    return hollowMesh.geometry;
  }
  
  /**
   * Calculate geometry properties (volume, surface area, etc.)
   */
  private calculateGeometryProperties(geometry: THREE.BufferGeometry): GeometryResult {
    // Calculate bounding box
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox!;
    
    // Calculate volume (approximate)
    const size = boundingBox.getSize(new THREE.Vector3());
    const volume_cm3 = (size.x * size.y * size.z) * 1000000; // Convert m³ to cm³
    
    // Calculate surface area (approximate)
    const surface_area_cm2 = (size.x * size.y + size.y * size.z + size.z * size.x) * 10000; // Convert m² to cm²
    
    // Calculate center of mass (approximate - center of bounding box)
    const centerOfMass = boundingBox.getCenter(new THREE.Vector3());
    
    return {
      geometry,
      volume_cm3,
      surface_area_cm2,
      boundingBox,
      centerOfMass
    };
  }
  
  /**
   * Apply material-specific adjustments to geometry
   */
  applyMaterialAdjustments(
    geometry: THREE.BufferGeometry,
    material: PrintingMaterialSpec
  ): THREE.BufferGeometry {
    // Apply shrinkage compensation
    const shrinkageFactor = 1 + (material.shrinkage_percent / 100);
    geometry.scale(shrinkageFactor, shrinkageFactor, shrinkageFactor);
    
    return geometry;
  }
}

// Export singleton instance
export const geometryGenerator = new ComponentGeometryGenerator();
