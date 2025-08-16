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
import { supportService, SupportOptions } from './support.service';
import { stepExportService } from './step-export.service';
import { printOrientationService, OrientationAnalysis } from './print-orientation.service';

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
  supportOptions?: Partial<SupportOptions>;
}

export interface ExportResult {
  fileData: string | ArrayBuffer;
  fileName: string;
  estimatedPrintTime: number;
  estimatedCost: number;
  mass: number;
  volume: number;
  material: PrintingMaterialSpec;
  orientationAnalysis?: OrientationAnalysis;
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
    
    // Generate support structures if requested
    let finalGeometry = adjustedGeometry;
    let supportVolume = 0;
    let supportPrintTime = 0;
    
    if (options.includeSupports && options.supportOptions) {
      const supportStructure = supportService.generateSupportStructures(
        adjustedGeometry,
        options.supportOptions
      );
      
      // Combine component and support geometries
      finalGeometry = this.combineGeometries([adjustedGeometry, supportStructure.geometry]);
      supportVolume = supportStructure.volume_cm3;
      supportPrintTime = supportStructure.print_time_addition;
    }
    
    // Export to requested format
    const fileData = await this.exportToFormat(finalGeometry, options);
    
    // Calculate estimates
    const accurateVolume = this.calculateComponentVolume(component);
    const totalVolume = accurateVolume + supportVolume;
    const estimatedPrintTime = calculateEstimatedPrintTime(totalVolume, material) + supportPrintTime;
    const estimatedCost = calculateMaterialCost(totalVolume, material);
    
    // Calculate mass: volume in cm³, density in kg/m³, so convert cm³ to m³
    const volumeInM3 = totalVolume / 1000000; // Convert cm³ to m³
    const mass = volumeInM3 * material.density_kg_m3;
    
    // Analyze optimal print orientation
    const orientationAnalysis = printOrientationService.analyzeOptimalOrientation(finalGeometry);
    
    return {
      fileData,
      fileName: this.generateFileName(component, material, options.format),
      estimatedPrintTime,
      estimatedCost,
      mass,
      volume: totalVolume,
      material,
      orientationAnalysis
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
    
    // Generate support structures if requested
    let finalGeometry = adjustedGeometry;
    let supportVolume = 0;
    let supportPrintTime = 0;
    
    if (options.includeSupports && options.supportOptions) {
      const supportStructure = supportService.generateSupportStructures(
        adjustedGeometry,
        options.supportOptions
      );
      
      // Combine component and support geometries
      finalGeometry = this.combineGeometries([adjustedGeometry, supportStructure.geometry]);
      supportVolume = supportStructure.volume_cm3;
      supportPrintTime = supportStructure.print_time_addition;
    }
    
    // Export to requested format
    const fileData = await this.exportToFormat(finalGeometry, options);
    
    // Calculate estimates
    const accurateVolume = this.calculateComponentVolume(component);
    const totalVolume = accurateVolume + supportVolume;
    const estimatedPrintTime = calculateEstimatedPrintTime(totalVolume, material) + supportPrintTime;
    const estimatedCost = calculateMaterialCost(totalVolume, material);
    
    // Calculate mass: volume in cm³, density in kg/m³, so convert cm³ to m³
    const volumeInM3 = totalVolume / 1000000; // Convert cm³ to m³
    const mass = volumeInM3 * material.density_kg_m3;
    
    return {
      fileData,
      fileName: this.generateFileName(component, material, options.format),
      estimatedPrintTime,
      estimatedCost,
      mass,
      volume: totalVolume,
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
    
    // Generate support structures if requested
    let finalGeometry = adjustedGeometry;
    let supportVolume = 0;
    let supportPrintTime = 0;
    
    if (options.includeSupports && options.supportOptions) {
      const supportStructure = supportService.generateSupportStructures(
        adjustedGeometry,
        options.supportOptions
      );
      
      // Combine component and support geometries
      finalGeometry = this.combineGeometries([adjustedGeometry, supportStructure.geometry]);
      supportVolume = supportStructure.volume_cm3;
      supportPrintTime = supportStructure.print_time_addition;
    }
    
    // Export to requested format
    const fileData = await this.exportToFormat(finalGeometry, options);
    
    // Calculate estimates
    const accurateVolume = this.calculateComponentVolume(component);
    const totalVolume = accurateVolume + supportVolume;
    const estimatedPrintTime = calculateEstimatedPrintTime(totalVolume, material) + supportPrintTime;
    const estimatedCost = calculateMaterialCost(totalVolume, material);
    
    // Calculate mass: volume in cm³, density in kg/m³, so convert cm³ to m³
    const volumeInM3 = totalVolume / 1000000; // Convert cm³ to m³
    const mass = volumeInM3 * material.density_kg_m3;
    
    return {
      fileData,
      fileName: this.generateFileName(component, material, options.format),
      estimatedPrintTime,
      estimatedCost,
      mass,
      volume: totalVolume,
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
    // Use the STEP export service for proper STEP file generation
    const stepContent = await stepExportService.exportToSTEP(geometry, {
      precision: 0.001,
      units: options.exportUnits,
      includeMetadata: true,
      includeMaterials: true,
      includeColors: true,
      compression: false
    });
    
    // Validate the generated STEP file
    if (!stepExportService.validateSTEPFile(stepContent)) {
      throw new Error('Generated STEP file validation failed');
    }
    
    return stepContent;
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
   * Combine multiple geometries into a single geometry
   */
  private combineGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
    if (geometries.length === 0) {
      return new THREE.BufferGeometry();
    }
    
    if (geometries.length === 1) {
      return geometries[0];
    }
    
    // For now, return the first geometry
    // In a full implementation, you'd use proper geometry merging
    // This is a placeholder that can be enhanced with proper CSG operations
    return geometries[0];
  }

  /**
   * Calculate component volume in cm³
   */
  private calculateComponentVolume(component: any): number {
    // Calculate volume based on component type and dimensions
    // For hollow components, calculate the volume of the shell (outer - inner)
    
    if (component.type === 'nose' || 'shape' in component) {
      const length = component.length_m * 100; // Convert to cm
      const baseRadius = (component.base_radius_m || 0.025) * 100; // Convert to cm
      const wallThickness = (component.wall_thickness_m || 0.001) * 100; // Convert to cm
      
      // Calculate outer and inner volumes
      const outerVolume = (Math.PI * baseRadius * baseRadius * length) / 3; // Cone volume
      const innerRadius = Math.max(0, baseRadius - wallThickness);
      const innerVolume = (Math.PI * innerRadius * innerRadius * length) / 3;
      
      return outerVolume - innerVolume; // Hollow shell volume
    }
    
    if (component.type === 'body' || 'outer_radius_m' in component) {
      const length = component.length_m * 100; // Convert to cm
      const outerRadius = component.outer_radius_m * 100; // Convert to cm
      const wallThickness = (component.wall_thickness_m || 0.001) * 100; // Convert to cm
      
      // Calculate outer and inner volumes
      const outerVolume = Math.PI * outerRadius * outerRadius * length; // Cylinder volume
      const innerRadius = Math.max(0, outerRadius - wallThickness);
      const innerVolume = Math.PI * innerRadius * innerRadius * length;
      
      return outerVolume - innerVolume; // Hollow shell volume
    }
    
    if (component.type === 'fin' || 'root_chord_m' in component) {
      // For fins, calculate as solid volume (they're typically solid)
      const rootChord = component.root_chord_m * 100; // Convert to cm
      const tipChord = component.tip_chord_m * 100; // Convert to cm
      const span = component.span_m * 100; // Convert to cm
      const thickness = (component.thickness_m || 0.002) * 100; // Convert to cm
      
      // Trapezoidal fin volume
      const avgChord = (rootChord + tipChord) / 2;
      return avgChord * span * thickness;
    }
    
    return 0;
  }
}

// Export singleton instance
export const componentExporter = new ComponentExportService();
