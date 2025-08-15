/**
 * Component Export Service
 * 
 * This service handles exporting rocket components as 3D printable files
 * in various formats (STL, STEP, OBJ, PLY) with material-specific optimizations.
 */

import * as THREE from 'three';
import { NoseComponent, BodyComponent, FinComponent } from '@/types/rocket';
import { PrintingMaterialSpec, calculateEstimatedPrintTime, calculateMaterialCost } from '@/lib/data/materials';
import { geometryGenerator, GeometryResult, ExportGeometryOptions } from './geometry.service';

export enum ExportFormat {
  STL = "stl",
  STEP = "step", 
  OBJ = "obj",
  PLY = "ply"
}

export interface ExportOptions {
  format: ExportFormat;
  material: PrintingMaterialSpec;
  includeSupports: boolean;
  layerHeight: number;
  infillPercent: number;
  exportUnits: 'mm' | 'cm' | 'm';
}

export interface ExportResult {
  fileData: string | ArrayBuffer;
  fileName: string;
  estimatedPrintTime: number; // in minutes
  estimatedCost: number; // in USD
  mass: number; // in kg
  volume: number; // in cm³
  material: PrintingMaterialSpec;
}

export interface MassComparison {
  originalMass: number;
  printingMass: number;
  massDifference: number;
  percentageChange: number;
}

export class ComponentExportService {
  
  /**
   * Export a nose cone component for 3D printing
   */
  async exportNoseCone(
    component: NoseComponent,
    material: PrintingMaterialSpec,
    options: ExportOptions
  ): Promise<ExportResult> {
    // Generate geometry
    const geometryResult = geometryGenerator.generateNoseConeGeometry(component, material);
    
    // Apply material-specific adjustments
    const adjustedGeometry = geometryGenerator.applyMaterialAdjustments(
      geometryResult.geometry, 
      material
    );
    
    // Export to requested format
    const fileData = await this.exportToFormat(adjustedGeometry, options);
    
    // Calculate estimates using accurate volume calculation
    const accurateVolume = this.calculateComponentVolume(component);
    const estimatedPrintTime = calculateEstimatedPrintTime(accurateVolume, material);
    const estimatedCost = calculateMaterialCost(accurateVolume, material);
    const mass = (accurateVolume / 1000) * material.density_kg_m3; // Convert cm³ to kg (density is kg/m³, so divide by 1000)
    
    return {
      fileData,
      fileName: this.generateFileName(component, material, options.format),
      estimatedPrintTime,
      estimatedCost,
      mass,
      volume: accurateVolume,
      material
    };
  }
  
  /**
   * Export a body tube component for 3D printing
   */
  async exportBodyTube(
    component: BodyComponent,
    material: PrintingMaterialSpec,
    options: ExportOptions
  ): Promise<ExportResult> {
    // Generate geometry
    const geometryResult = geometryGenerator.generateBodyTubeGeometry(component, material);
    
    // Apply material-specific adjustments
    const adjustedGeometry = geometryGenerator.applyMaterialAdjustments(
      geometryResult.geometry, 
      material
    );
    
    // Export to requested format
    const fileData = await this.exportToFormat(adjustedGeometry, options);
    
    // Calculate estimates using accurate volume calculation
    const accurateVolume = this.calculateComponentVolume(component);
    const estimatedPrintTime = calculateEstimatedPrintTime(accurateVolume, material);
    const estimatedCost = calculateMaterialCost(accurateVolume, material);
    const mass = (accurateVolume / 1000) * material.density_kg_m3; // Convert cm³ to kg (density is kg/m³, so divide by 1000)
    
    return {
      fileData,
      fileName: this.generateFileName(component, material, options.format),
      estimatedPrintTime,
      estimatedCost,
      mass,
      volume: accurateVolume,
      material
    };
  }
  
  /**
   * Export a fin component for 3D printing
   */
  async exportFin(
    component: FinComponent,
    material: PrintingMaterialSpec,
    options: ExportOptions
  ): Promise<ExportResult> {
    // Generate geometry
    const geometryResult = geometryGenerator.generateFinGeometry(component, material);
    
    // Apply material-specific adjustments
    const adjustedGeometry = geometryGenerator.applyMaterialAdjustments(
      geometryResult.geometry, 
      material
    );
    
    // Export to requested format
    const fileData = await this.exportToFormat(adjustedGeometry, options);
    
    // Calculate estimates using accurate volume calculation
    const accurateVolume = this.calculateComponentVolume(component);
    const estimatedPrintTime = calculateEstimatedPrintTime(accurateVolume, material);
    const estimatedCost = calculateMaterialCost(accurateVolume, material);
    const mass = (accurateVolume / 1000) * material.density_kg_m3; // Convert cm³ to kg (density is kg/m³, so divide by 1000)
    
    return {
      fileData,
      fileName: this.generateFileName(component, material, options.format),
      estimatedPrintTime,
      estimatedCost,
      mass,
      volume: accurateVolume,
      material
    };
  }
  
  /**
   * Compare masses between original and printing materials
   */
  compareMasses(
    originalComponent: NoseComponent | BodyComponent | FinComponent,
    printingComponent: NoseComponent | BodyComponent | FinComponent
  ): MassComparison {
    // Calculate original mass using the component's actual material density
    const originalVolume = this.calculateComponentVolume(originalComponent);
    const originalMass = (originalVolume / 1000) * originalComponent.material_density_kg_m3; // Convert cm³ to kg (density is kg/m³, so divide by 1000)
    
    // Calculate printing mass
    const printingVolume = this.calculateComponentVolume(printingComponent);
    const printingMass = (printingVolume / 1000) * printingComponent.material_density_kg_m3;
    
    const massDifference = printingMass - originalMass;
    const percentageChange = originalMass > 0 ? (massDifference / originalMass) * 100 : 0;
    
    return {
      originalMass,
      printingMass,
      massDifference,
      percentageChange
    };
  }
  
  /**
   * Generate optimal print orientation for a component
   */
  calculateOptimalPrintOrientation(geometry: THREE.BufferGeometry): THREE.Vector3 {
    // Calculate optimal print orientation to minimize supports
    // This is a simplified algorithm - in practice, you'd use more sophisticated analysis
    
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox!;
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Find the axis with the smallest height (best for printing)
    const minAxis = Math.min(size.x, size.y, size.z);
    
    if (minAxis === size.x) {
      return new THREE.Vector3(0, 1, 0); // Rotate 90° around Y
    } else if (minAxis === size.y) {
      return new THREE.Vector3(0, 0, 1); // Rotate 90° around Z
    } else {
      return new THREE.Vector3(1, 0, 0); // Keep as is
    }
  }
  
  /**
   * Generate support structures for a component
   */
  generateSupports(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
    // This is a placeholder for support generation
    // In a real implementation, you'd analyze overhangs and generate support structures
    
    geometry.computeBoundingBox();
    const boundingBox = geometry.boundingBox!;
    const size = boundingBox.getSize(new THREE.Vector3());
    
    // Simple support structure (rectangular base)
    const supportGeometry = new THREE.BoxGeometry(size.x * 1.2, 2, size.z * 1.2);
    supportGeometry.translate(0, -size.y / 2 - 1, 0);
    
    return supportGeometry;
  }
  
  /**
   * Export geometry to specified format
   */
  private async exportToFormat(
    geometry: THREE.BufferGeometry, 
    options: ExportOptions
  ): Promise<string | ArrayBuffer> {
    switch (options.format) {
      case ExportFormat.STL:
        return this.exportToSTL(geometry, options);
      case ExportFormat.OBJ:
        return this.exportToOBJ(geometry, options);
      case ExportFormat.PLY:
        return this.exportToPLY(geometry, options);
      case ExportFormat.STEP:
        return this.exportToSTEP(geometry, options);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }
  
  /**
   * Export to STL format
   */
  private async exportToSTL(geometry: THREE.BufferGeometry, options: ExportOptions): Promise<string> {
    // Convert geometry to STL format
    // This is a simplified implementation - in practice, you'd use a proper STL exporter
    
    const vertices = geometry.attributes.position.array;
    const indices = geometry.index?.array || [];
    
    let stl = 'solid rocket_component\n';
    
    // Generate triangles
    for (let i = 0; i < indices.length; i += 3) {
      const v1 = new THREE.Vector3(
        vertices[indices[i] * 3],
        vertices[indices[i] * 3 + 1],
        vertices[indices[i] * 3 + 2]
      );
      const v2 = new THREE.Vector3(
        vertices[indices[i + 1] * 3],
        vertices[indices[i + 1] * 3 + 1],
        vertices[indices[i + 1] * 3 + 2]
      );
      const v3 = new THREE.Vector3(
        vertices[indices[i + 2] * 3],
        vertices[indices[i + 2] * 3 + 1],
        vertices[indices[i + 2] * 3 + 2]
      );
      
      // Calculate normal
      const normal = new THREE.Vector3()
        .crossVectors(v2.clone().sub(v1), v3.clone().sub(v1))
        .normalize();
      
      stl += `  facet normal ${normal.x} ${normal.y} ${normal.z}\n`;
      stl += `    outer loop\n`;
      stl += `      vertex ${v1.x} ${v1.y} ${v1.z}\n`;
      stl += `      vertex ${v2.x} ${v2.y} ${v2.z}\n`;
      stl += `      vertex ${v3.x} ${v3.y} ${v3.z}\n`;
      stl += `    endloop\n`;
      stl += `  endfacet\n`;
    }
    
    stl += 'endsolid rocket_component\n';
    return stl;
  }
  
  /**
   * Export to OBJ format
   */
  private async exportToOBJ(geometry: THREE.BufferGeometry, options: ExportOptions): Promise<string> {
    // Convert geometry to OBJ format
    const vertices = geometry.attributes.position.array;
    const indices = geometry.index?.array || [];
    
    let obj = '# Rocket Component Export\n';
    obj += `# Material: ${options.material.name}\n`;
    obj += `# Generated by Rocket-Cursor AI\n\n`;
    
    // Write vertices
    for (let i = 0; i < vertices.length; i += 3) {
      obj += `v ${vertices[i]} ${vertices[i + 1]} ${vertices[i + 2]}\n`;
    }
    
    // Write faces
    for (let i = 0; i < indices.length; i += 3) {
      obj += `f ${indices[i] + 1} ${indices[i + 1] + 1} ${indices[i + 2] + 1}\n`;
    }
    
    return obj;
  }
  
  /**
   * Export to PLY format
   */
  private async exportToPLY(geometry: THREE.BufferGeometry, options: ExportOptions): Promise<string> {
    // Convert geometry to PLY format
    const vertices = geometry.attributes.position.array;
    const indices = geometry.index?.array || [];
    
    let ply = 'ply\n';
    ply += 'format ascii 1.0\n';
    ply += `element vertex ${vertices.length / 3}\n`;
    ply += 'property float x\n';
    ply += 'property float y\n';
    ply += 'property float z\n';
    ply += `element face ${indices.length / 3}\n`;
    ply += 'property list uchar int vertex_indices\n';
    ply += 'end_header\n';
    
    // Write vertices
    for (let i = 0; i < vertices.length; i += 3) {
      ply += `${vertices[i]} ${vertices[i + 1]} ${vertices[i + 2]}\n`;
    }
    
    // Write faces
    for (let i = 0; i < indices.length; i += 3) {
      ply += `3 ${indices[i]} ${indices[i + 1]} ${indices[i + 2]}\n`;
    }
    
    return ply;
  }
  
  /**
   * Export to STEP format (placeholder)
   */
  private async exportToSTEP(geometry: THREE.BufferGeometry, options: ExportOptions): Promise<string> {
    // STEP format is complex and requires specialized libraries
    // This is a placeholder implementation
    return `# STEP format export not yet implemented
# This would require a STEP/IGES library like OpenCASCADE
# For now, please use STL, OBJ, or PLY formats`;
  }
  
  /**
   * Generate filename for exported component
   */
  private generateFileName(
    component: NoseComponent | BodyComponent | FinComponent,
    material: PrintingMaterialSpec,
    format: ExportFormat
  ): string {
    const componentType = this.getComponentType(component);
    const materialName = material.name.replace(/[^a-zA-Z0-9]/g, '_');
    const timestamp = new Date().toISOString().slice(0, 10);
    
    return `${componentType}_${materialName}_${timestamp}.${format}`;
  }
  
  /**
   * Get component type string
   */
  private getComponentType(component: NoseComponent | BodyComponent | FinComponent): string {
    if ('shape' in component) {
      return `nose_cone_${component.shape}`;
    } else if ('outer_radius_m' in component) {
      return 'body_tube';
    } else {
      return 'fin_set';
    }
  }
  
  /**
   * Calculate component volume in cm³
   */
  private calculateComponentVolume(component: NoseComponent | BodyComponent | FinComponent): number {
    // Volume calculation in cm³ (convert from m to cm)
    if ('shape' in component) {
      // Nose cone: approximate as cone
      const baseRadius = (component.base_radius_m || 0.025) * 100; // Convert to cm
      const length = component.length_m * 100; // Convert to cm
      return (Math.PI * baseRadius * baseRadius * length) / 3;
    } else if ('outer_radius_m' in component) {
      // Body tube: cylindrical shell
      const outerRadius = component.outer_radius_m * 100; // Convert to cm
      const length = component.length_m * 100; // Convert to cm
      const wallThickness = component.wall_thickness_m * 100; // Convert to cm
      
      const outerVolume = Math.PI * outerRadius * outerRadius * length;
      const innerRadius = outerRadius - wallThickness;
      const innerVolume = Math.PI * innerRadius * innerRadius * length;
      return outerVolume - innerVolume;
    } else {
      // Fin: trapezoidal prism
      const rootChord = component.root_chord_m * 100; // Convert to cm
      const tipChord = component.tip_chord_m * 100; // Convert to cm
      const span = component.span_m * 100; // Convert to cm
      const thickness = component.thickness_m * 100; // Convert to cm
      
      const area = 0.5 * (rootChord + tipChord) * span;
      return area * thickness;
    }
  }
}

// Export singleton instance
export const componentExporter = new ComponentExportService();
