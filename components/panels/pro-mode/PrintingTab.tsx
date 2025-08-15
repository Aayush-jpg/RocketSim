/**
 * 3D Printing Tab Component
 * 
 * Provides an overview of 3D printing capabilities and quick access
 * to export features for rocket components.
 */

import React, { useState } from 'react';
import { useRocket } from '@/lib/store';
import { getPrintingMaterialsForComponent } from '@/lib/data/materials';
import { NoseComponent, BodyComponent, FinComponent } from '@/types/rocket';

interface ComponentExportSummary {
  component: NoseComponent | BodyComponent | FinComponent;
  componentType: 'nose_cone' | 'body_tube' | 'fin';
  name: string;
  material: string;
  volume: number; // cm³
  mass: number; // kg
  printTime: number; // minutes
  cost: number; // USD
}

export default function PrintingTab() {
  const { rocket } = useRocket();
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);

  // Calculate component summaries for 3D printing
  const componentSummaries: ComponentExportSummary[] = [];

  // Nose cone
  if (rocket.nose_cone) {
    const material = rocket.nose_cone.material_id;
    const volume = (Math.PI * (rocket.nose_cone.base_radius_m || 0.025) ** 2 * rocket.nose_cone.length_m) / 3 * 1000000; // Convert to cm³
    const mass = volume * 0.001 * 1240; // Assume PLA density for estimation
    const printTime = volume / 20; // Rough estimate: 20 cm³ per hour
    const cost = mass * 0.025; // $25/kg for PLA

    componentSummaries.push({
      component: rocket.nose_cone,
      componentType: 'nose_cone',
      name: `${rocket.nose_cone.shape} Nose Cone`,
      material: material,
      volume: volume,
      mass: mass,
      printTime: printTime,
      cost: cost
    });
  }

  // Body tubes
  rocket.body_tubes.forEach((tube, index) => {
    const volume = Math.PI * tube.outer_radius_m ** 2 * tube.length_m * 1000000; // Convert to cm³
    const mass = volume * 0.001 * 1240; // Assume PLA density
    const printTime = volume / 15; // Rough estimate: 15 cm³ per hour for tubes
    const cost = mass * 0.025;

    componentSummaries.push({
      component: tube,
      componentType: 'body_tube',
      name: `Body Tube #${index + 1}`,
      material: tube.material_id,
      volume: volume,
      mass: mass,
      printTime: printTime,
      cost: cost
    });
  });

  // Fins
  rocket.fins.forEach((fin, index) => {
    const area = 0.5 * (fin.root_chord_m + fin.tip_chord_m) * fin.span_m;
    const volume = area * fin.thickness_m * 1000000; // Convert to cm³
    const mass = volume * 0.001 * 1240; // Assume PLA density
    const printTime = volume / 25; // Rough estimate: 25 cm³ per hour for fins
    const cost = mass * 0.025;

    componentSummaries.push({
      component: fin,
      componentType: 'fin',
      name: `Fin Set #${index + 1}`,
      material: fin.material_id,
      volume: volume,
      mass: mass,
      printTime: printTime,
      cost: cost
    });
  });

  // Calculate totals
  const totalVolume = componentSummaries.reduce((sum, comp) => sum + comp.volume, 0);
  const totalMass = componentSummaries.reduce((sum, comp) => sum + comp.mass, 0);
  const totalPrintTime = componentSummaries.reduce((sum, comp) => sum + comp.printTime, 0);
  const totalCost = componentSummaries.reduce((sum, comp) => sum + comp.cost, 0);

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-xl font-semibold text-white mb-2">3D Printing Export</h2>
        <p className="text-white/60 text-sm">
          Export rocket components for 3D printing with material-specific optimizations
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-black/20 rounded-lg border border-white/10">
          <div className="text-white/60 text-sm">Total Volume</div>
          <div className="text-white font-semibold text-lg">{totalVolume.toFixed(1)} cm³</div>
        </div>
        <div className="p-4 bg-black/20 rounded-lg border border-white/10">
          <div className="text-white/60 text-sm">Total Mass</div>
          <div className="text-white font-semibold text-lg">{totalMass.toFixed(3)} kg</div>
        </div>
        <div className="p-4 bg-black/20 rounded-lg border border-white/10">
          <div className="text-white/60 text-sm">Print Time</div>
          <div className="text-white font-semibold text-lg">{Math.round(totalPrintTime)} min</div>
        </div>
        <div className="p-4 bg-black/20 rounded-lg border border-white/10">
          <div className="text-white/60 text-sm">Material Cost</div>
          <div className="text-white font-semibold text-lg">${totalCost.toFixed(2)}</div>
        </div>
      </div>

      {/* Component List */}
      <div className="space-y-3">
        <h3 className="text-white font-medium">Components Available for Export</h3>
        {componentSummaries.map((summary, index) => (
          <div
            key={index}
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
              selectedComponent === summary.name
                ? 'bg-cyan-400/10 border-cyan-400/30'
                : 'bg-black/20 border-white/10 hover:border-white/20'
            }`}
            onClick={() => setSelectedComponent(selectedComponent === summary.name ? null : summary.name)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-white font-medium text-sm">{summary.name}</div>
              <div className="text-cyan-400 text-xs">🖨️ Export</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-white/60">Material:</span>
                <span className="text-white ml-1">{summary.material}</span>
              </div>
              <div>
                <span className="text-white/60">Volume:</span>
                <span className="text-white ml-1">{summary.volume.toFixed(1)} cm³</span>
              </div>
              <div>
                <span className="text-white/60">Mass:</span>
                <span className="text-white ml-1">{summary.mass.toFixed(3)} kg</span>
              </div>
              <div>
                <span className="text-white/60">Print Time:</span>
                <span className="text-white ml-1">{Math.round(summary.printTime)} min</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Available Materials */}
      <div className="space-y-3">
        <h3 className="text-white font-medium">Available 3D Printing Materials</h3>
        <div className="grid grid-cols-1 gap-2">
          {['nose_cone', 'body_tube', 'fin'].map((componentType) => {
            const materials = getPrintingMaterialsForComponent(componentType as any);
            return (
              <div key={componentType} className="p-3 bg-black/20 rounded-lg border border-white/10">
                <div className="text-white/60 text-sm mb-2 capitalize">{componentType.replace('_', ' ')} Materials</div>
                <div className="flex flex-wrap gap-1">
                  {materials.slice(0, 4).map((material) => (
                    <span
                      key={material.id}
                      className="px-2 py-1 text-xs bg-white/10 rounded border border-white/20 text-white"
                    >
                      {material.name}
                    </span>
                  ))}
                  {materials.length > 4 && (
                    <span className="px-2 py-1 text-xs bg-white/10 rounded border border-white/20 text-white">
                      +{materials.length - 4} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Export Formats */}
      <div className="space-y-3">
        <h3 className="text-white font-medium">Supported Export Formats</h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { format: 'STL', description: 'Standard 3D printing format' },
            { format: 'OBJ', description: 'Universal 3D format' },
            { format: 'PLY', description: 'Stanford format with colors' },
            { format: 'STEP', description: 'CAD format (coming soon)' }
          ].map((format) => (
            <div key={format.format} className="p-3 bg-black/20 rounded-lg border border-white/10">
              <div className="text-white font-medium text-sm">{format.format}</div>
              <div className="text-white/60 text-xs">{format.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="p-4 bg-cyan-400/10 rounded-lg border border-cyan-400/30">
        <h3 className="text-cyan-400 font-medium mb-2">How to Export</h3>
        <div className="text-white/80 text-sm space-y-1">
          <div>1. Open the Design Editor (left panel)</div>
          <div>2. Click the 🖨️ Export button next to any component</div>
          <div>3. Select your preferred 3D printing material</div>
          <div>4. Choose export format and settings</div>
          <div>5. Download your 3D printable file</div>
        </div>
      </div>
    </div>
  );
}
