/**
 * 3D Printing Material Selector Component
 * 
 * A clean, modern component for selecting 3D printing materials
 * with material-specific information and recommendations.
 */

import React from 'react';
import { PrintingMaterialSpec, getPrintingMaterialsForComponent } from '@/lib/data/materials';

interface PrintingMaterialSelectorProps {
  selectedMaterial: PrintingMaterialSpec | null;
  componentType: 'nose_cone' | 'body_tube' | 'fin' | 'motor' | 'recovery';
  onMaterialChange: (material: PrintingMaterialSpec) => void;
  className?: string;
}

interface MaterialCardProps {
  material: PrintingMaterialSpec;
  isSelected: boolean;
  onClick: () => void;
}

function MaterialCard({ material, isSelected, onClick }: MaterialCardProps) {
  // Safety check: ensure material has all required properties
  if (!material || !material.name || !material.description || !material.print_settings) {
    return null;
  }
  
  return (
    <div
      onClick={onClick}
      className={`
        relative p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 w-full
        ${isSelected 
          ? 'border-cyan-400 bg-cyan-400/10 shadow-lg shadow-cyan-400/20' 
          : 'border-white/20 bg-black/20 hover:border-white/40 hover:bg-black/30'
        }
      `}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-cyan-400 rounded-full flex items-center justify-center">
          <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}
      
      {/* Material header */}
      <div className="mb-5">
        <h3 className="font-semibold text-white text-base mb-3 truncate">{material.name}</h3>
        <p className="text-white/60 text-sm leading-relaxed">{material.description}</p>
      </div>
      
      {/* Material properties - Row based layout */}
      <div className="space-y-4">
        {/* Density and Strength Row */}
        <div className="flex justify-between items-center">
          <div className="flex-1">
            <div className="text-white/60 text-sm">Density</div>
            <div className="text-white font-medium text-base">{material.density_kg_m3} kg/m³</div>
          </div>
          <div className="flex-1 text-right">
            <div className="text-white/60 text-sm">Strength</div>
            <div className="text-white font-medium text-base">{material.strength_mpa} MPa</div>
          </div>
        </div>
        
        {/* Print Temp and Cost Row */}
        <div className="flex justify-between items-center">
          <div className="flex-1">
            <div className="text-white/60 text-sm">Print Temp</div>
            <div className="text-white font-medium text-base">{material.print_temperature_c}°C</div>
          </div>
          <div className="flex-1 text-right">
            <div className="text-white/60 text-sm">Cost</div>
            <div className="text-white font-medium text-base">${material.cost_per_kg}/kg</div>
          </div>
        </div>
      </div>
      
      {/* Print settings preview */}
      <div className="mt-5 pt-4 border-t border-white/10">
        <div className="text-white/70 text-sm mb-4">Recommended Settings</div>
        <div className="space-y-3">
          {/* Layer Height Row */}
          <div className="flex justify-between items-center">
            <div className="text-white/60 text-sm">Layer Height</div>
            <div className="text-white font-medium text-base">{material.print_settings.layer_height_mm}mm</div>
          </div>
          
          {/* Infill Row */}
          <div className="flex justify-between items-center">
            <div className="text-white/60 text-sm">Infill</div>
            <div className="text-white font-medium text-base">{material.print_settings.infill_percent}%</div>
          </div>
          
          {/* Print Speed Row */}
          <div className="flex justify-between items-center">
            <div className="text-white/60 text-sm">Print Speed</div>
            <div className="text-white font-medium text-base">{material.print_settings.print_speed_mm_s}mm/s</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PrintingMaterialSelector({ 
  selectedMaterial, 
  componentType, 
  onMaterialChange,
  className = ""
}: PrintingMaterialSelectorProps) {
  const printingMaterials = getPrintingMaterialsForComponent(componentType);
  
  // Debug logging
  console.log('PrintingMaterialSelector:', { componentType, printingMaterialsCount: printingMaterials.length });
  
  // Safety check: filter out any materials that don't have required properties
  const validMaterials = printingMaterials.filter(material => 
    material && 
    material.name && 
    material.description && 
    material.print_settings &&
    typeof material.density_kg_m3 === 'number' &&
    typeof material.strength_mpa === 'number' &&
    typeof material.print_temperature_c === 'number'
  );
  
  console.log('Valid materials:', validMaterials.length);
  
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-white font-semibold text-xl">3D Printing Material</h3>
        <div className="text-white/60 text-base">
          {validMaterials.length} materials available
        </div>
      </div>
      
      {/* Material grid */}
      <div className="space-y-3">
        {validMaterials.map((material) => (
          <MaterialCard
            key={material.id}
            material={material}
            isSelected={selectedMaterial?.id === material.id}
            onClick={() => onMaterialChange(material)}
          />
        ))}
      </div>
      
      {/* No materials available */}
      {validMaterials.length === 0 && (
        <div className="text-center py-8 text-white/60">
          <div className="text-4xl mb-2">🖨️</div>
          <div className="text-sm">No 3D printing materials available for this component type.</div>
        </div>
      )}
      
      {/* Selected material details */}
      {selectedMaterial && (
        <div className="mt-8 p-6 bg-black/40 rounded-xl border border-white/20">
          <h4 className="text-white font-medium mb-4 text-base">Selected Material Details</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-white/60 text-sm">Shrinkage</div>
              <div className="text-white font-medium text-base">{selectedMaterial.shrinkage_percent}%</div>
            </div>
            <div>
              <div className="text-white/60 text-sm">Bed Temp</div>
              <div className="text-white font-medium text-base">{selectedMaterial.bed_temperature_c}°C</div>
            </div>
            <div>
              <div className="text-white/60 text-sm">Support Density</div>
              <div className="text-white font-medium text-base">{selectedMaterial.print_settings.support_density}%</div>
            </div>
            <div>
              <div className="text-white/60 text-sm">Availability</div>
              <div className="text-white font-medium text-base capitalize">{selectedMaterial.availability}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
