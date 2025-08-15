/**
 * Component Geometry Generator Service
 * 
 * This service generates accurate 3D geometry for rocket components
 * that can be exported for 3D printing. It handles different component
 * types and applies material-specific adjustments.
 */

import * as THREE from 'three';
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
    
    // Ogive parameters
    // For a tangent ogive: ρ = R² + L² / (2R)
    // where ρ is the radius of the circle, R is base radius, L is length
    const rho = (baseRadius * baseRadius + length * length) / (2 * baseRadius);
    
    // Generate points for ogive curve
    const segments = 32;
    const points: THREE.Vector3[] = [];
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = t * Math.PI / 2; // 0 to π/2 radians
      
      // Ogive equation: x = ρ*cos(θ) - (ρ - L), y = ρ*sin(θ) - (ρ - R)
      const x = rho * Math.cos(angle) - (rho - length);
      const y = rho * Math.sin(angle) - (rho - baseRadius);
      
      // Outer surface
      points.push(new THREE.Vector3(x, y, 0));
      // Inner surface (wall thickness)
      const innerY = Math.max(0, y - wallThickness_m);
      points.push(new THREE.Vector3(x, innerY, 0));
    }
    
    // Create lathe geometry
    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i += 2) {
      shape.lineTo(points[i].x, points[i].y);
    }
    
    // Close the shape
    shape.lineTo(points[points.length - 1].x, 0);
    shape.lineTo(0, 0);
    
    const geometry = new THREE.LatheGeometry(shape.getPoints(32), 32);
    return geometry;
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
    
    // Create conical shell using lathe geometry
    const segments = 32;
    const points: THREE.Vector3[] = [];
    
    // Generate points for conical profile
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = length * (1 - t);
      const y = baseRadius * t;
      
      // Outer surface
      points.push(new THREE.Vector3(x, y, 0));
      // Inner surface (wall thickness)
      const innerY = Math.max(0, y - wallThickness_m);
      points.push(new THREE.Vector3(x, innerY, 0));
    }
    
    // Create lathe geometry
    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i += 2) {
      shape.lineTo(points[i].x, points[i].y);
    }
    
    // Close the shape
    shape.lineTo(points[points.length - 1].x, 0);
    shape.lineTo(0, 0);
    
    const geometry = new THREE.LatheGeometry(shape.getPoints(32), 32);
    return geometry;
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
    
    // Elliptical parameters
    const a = length; // Semi-major axis (length)
    const b = baseRadius; // Semi-minor axis (base radius)
    
    // Generate elliptical curve using proper elliptical equation
    const segments = 32;
    const points: THREE.Vector3[] = [];
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = t * Math.PI / 2; // 0 to π/2 radians
      
      // Elliptical equation: x = a*cos(θ), y = b*sin(θ)
      const x = a * Math.cos(angle);
      const y = b * Math.sin(angle);
      
      // Outer surface
      points.push(new THREE.Vector3(x, y, 0));
      // Inner surface (wall thickness)
      const innerY = Math.max(0, y - wallThickness_m);
      points.push(new THREE.Vector3(x, innerY, 0));
    }
    
    // Create lathe geometry
    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i += 2) {
      shape.lineTo(points[i].x, points[i].y);
    }
    
    // Close the shape
    shape.lineTo(points[points.length - 1].x, 0);
    shape.lineTo(0, 0);
    
    const geometry = new THREE.LatheGeometry(shape.getPoints(32), 32);
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
    
    // Parabolic parameters
    // For a parabola: y² = 4px where p is the focal length
    // At x = length, y = baseRadius, so: baseRadius² = 4p*length
    // Therefore: p = baseRadius² / (4*length)
    const p = (baseRadius * baseRadius) / (4 * length);
    
    // Generate parabolic curve using proper parabolic equation
    const segments = 32;
    const points: THREE.Vector3[] = [];
    
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = length * (1 - t * t); // x goes from length to 0
      
      // Parabolic equation: y² = 4px, so y = ±√(4px)
      const y = Math.sqrt(4 * p * x);
      
      // Outer surface
      points.push(new THREE.Vector3(x, y, 0));
      // Inner surface (wall thickness)
      const innerY = Math.max(0, y - wallThickness_m);
      points.push(new THREE.Vector3(x, innerY, 0));
    }
    
    // Create lathe geometry
    const shape = new THREE.Shape();
    shape.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i += 2) {
      shape.lineTo(points[i].x, points[i].y);
    }
    
    // Close the shape
    shape.lineTo(points[points.length - 1].x, 0);
    shape.lineTo(0, 0);
    
    const geometry = new THREE.LatheGeometry(shape.getPoints(32), 32);
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
    
    // Create cylindrical shell using lathe geometry
    const segments = 32;
    const points: THREE.Vector3[] = [];
    
    // Generate points for cylindrical shell profile
    // Start at the base (x = 0)
    points.push(new THREE.Vector3(0, outerRadius, 0));           // Outer surface at base
    points.push(new THREE.Vector3(0, innerRadius, 0));           // Inner surface at base
    
    // Middle section (x = length/2)
    points.push(new THREE.Vector3(length/2, outerRadius, 0));    // Outer surface at middle
    points.push(new THREE.Vector3(length/2, innerRadius, 0));    // Inner surface at middle
    
    // End at the tip (x = length)
    points.push(new THREE.Vector3(length, outerRadius, 0));      // Outer surface at tip
    points.push(new THREE.Vector3(length, innerRadius, 0));      // Inner surface at tip
    
    // Create lathe geometry
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
    
    const geometry = new THREE.LatheGeometry(shape.getPoints(32), 32);
    return geometry;
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
    
    // Create fin shape
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
    
    // Extrude to create 3D fin
    const extrudeSettings = {
      depth: thickness,
      bevelEnabled: false
    };
    
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    
    // Center the geometry
    geometry.center();
    
    return geometry;
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
