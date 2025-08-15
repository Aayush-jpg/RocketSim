/**
 * Component Export Panel
 * 
 * A comprehensive panel for exporting rocket components for 3D printing
 * with material comparison, export options, and cost/time estimates.
 */

import React, { useState, useMemo } from 'react';
import { NoseComponent, BodyComponent, FinComponent } from '@/types/rocket';
import { PrintingMaterialSpec, getMaterial } from '@/lib/data/materials';
import { ExportFormat, ExportOptions, componentExporter, ExportResult } from '@/lib/services/export.service';
import { PrintingMaterialSelector } from './PrintingMaterialSelector';

interface ComponentExportPanelProps {
  component: NoseComponent | BodyComponent | FinComponent;
  originalMaterial: PrintingMaterialSpec;
  onClose: () => void;
  className?: string;
}

interface ExportOptionsFormProps {
  options: ExportOptions;
  onOptionsChange: (options: ExportOptions) => void;
}

function ExportOptionsForm({ options, onOptionsChange }: ExportOptionsFormProps) {
  return (
    <div className="space-y-6">
      <h4 className="text-white font-medium text-lg">Export Options</h4>
      
      {/* Format selection */}
      <div className="space-y-3">
        <label className="text-white/70 text-base font-medium">File Format</label>
        <div className="grid grid-cols-2 gap-3">
          {Object.values(ExportFormat).map((format) => (
            <button
              key={format}
              onClick={() => onOptionsChange({ ...options, format })}
              className={`
                px-4 py-3 rounded-lg text-sm font-medium transition-colors
                ${options.format === format
                  ? 'bg-cyan-400 text-black'
                  : 'bg-black/40 text-white border border-white/20 hover:border-white/40'
                }
              `}
            >
              {format.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      
      {/* Print settings */}
      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-3">
          <label className="text-white/70 text-base font-medium">Layer Height (mm)</label>
          <input
            type="number"
            step="0.05"
            min="0.1"
            max="0.5"
            value={options.layerHeight}
            onChange={(e) => onOptionsChange({ ...options, layerHeight: parseFloat(e.target.value) })}
            className="w-full px-4 py-3 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:border-cyan-400/50 focus:outline-none"
          />
        </div>
        <div className="space-y-3">
          <label className="text-white/70 text-base font-medium">Infill (%)</label>
          <input
            type="number"
            step="5"
            min="10"
            max="100"
            value={options.infillPercent}
            onChange={(e) => onOptionsChange({ ...options, infillPercent: parseInt(e.target.value) })}
            className="w-full px-4 py-3 bg-black/40 border border-white/20 rounded-lg text-white text-sm focus:border-cyan-400/50 focus:outline-none"
          />
        </div>
      </div>
      
      {/* Export units */}
      <div className="space-y-3">
        <label className="text-white/70 text-base font-medium">Export Units</label>
        <div className="flex gap-3">
          {(['mm', 'cm', 'm'] as const).map((unit) => (
            <button
              key={unit}
              onClick={() => onOptionsChange({ ...options, exportUnits: unit })}
              className={`
                px-4 py-3 rounded-lg text-sm font-medium transition-colors
                ${options.exportUnits === unit
                  ? 'bg-cyan-400 text-black'
                  : 'bg-black/40 text-white border border-white/20 hover:border-white/40'
                }
              `}
            >
              {unit}
            </button>
          ))}
        </div>
      </div>
      
      {/* Include supports toggle */}
      <div className="flex items-center justify-between">
        <label className="text-white/70 text-base font-medium">Include Support Structures</label>
        <button
          onClick={() => onOptionsChange({ ...options, includeSupports: !options.includeSupports })}
          className={`
            w-14 h-7 rounded-full transition-colors relative
            ${options.includeSupports ? 'bg-cyan-400' : 'bg-black/40 border border-white/20'}
          `}
        >
          <div className={`
            w-5 h-5 bg-white rounded-full transition-transform absolute top-1
            ${options.includeSupports ? 'translate-x-7' : 'translate-x-1'}
          `} />
        </button>
      </div>
    </div>
  );
}

interface MaterialComparisonProps {
  originalMaterial: PrintingMaterialSpec;
  printingMaterial: PrintingMaterialSpec;
  component: NoseComponent | BodyComponent | FinComponent;
}

function MaterialComparison({ originalMaterial, printingMaterial, component }: MaterialComparisonProps) {
  const massComparison = useMemo(() => {
    return componentExporter.compareMasses(component, {
      ...component,
      material_density_kg_m3: printingMaterial.density_kg_m3
    });
  }, [component, printingMaterial]);
  
  return (
    <div className="space-y-6">
      <h4 className="text-white font-medium text-lg">Material Comparison</h4>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Original material */}
        <div className="p-6 bg-black/30 rounded-xl border border-white/20">
          <h5 className="text-white font-medium mb-4 text-base">Original Material</h5>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-white/60 text-sm">Material:</span>
              <span className="text-white text-sm font-medium truncate max-w-[200px]" title={originalMaterial.name}>
                {originalMaterial.name}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/60 text-sm">Density:</span>
              <span className="text-white text-sm font-medium">{originalMaterial.density_kg_m3} kg/m³</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/60 text-sm">Mass:</span>
              <span className="text-white text-sm font-medium">{massComparison.originalMass.toFixed(3)} kg</span>
            </div>
          </div>
        </div>
        
        {/* Printing material */}
        <div className="p-6 bg-cyan-400/10 rounded-xl border border-cyan-400/30">
          <h5 className="text-white font-medium mb-4 text-base">3D Printing Material</h5>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-white/60 text-sm">Material:</span>
              <span className="text-white text-sm font-medium truncate max-w-[200px]" title={printingMaterial.name}>
                {printingMaterial.name}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/60 text-sm">Density:</span>
              <span className="text-white text-sm font-medium">{printingMaterial.density_kg_m3} kg/m³</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-white/60 text-sm">Mass:</span>
              <span className="text-white text-sm font-medium">{massComparison.printingMass.toFixed(3)} kg</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Mass difference */}
      <div className="p-6 bg-black/40 rounded-xl border border-white/20">
        <div className="flex items-center justify-between">
          <span className="text-white/70 text-base font-medium">Mass Difference</span>
          <div className="text-right">
            <div className={`text-xl font-bold ${
              massComparison.massDifference > 0 ? 'text-red-400' : 'text-green-400'
            }`}>
              {massComparison.massDifference > 0 ? '+' : ''}{massComparison.massDifference.toFixed(3)} kg
            </div>
            <div className={`text-sm ${
              massComparison.percentageChange > 0 ? 'text-red-400' : 'text-green-400'
            }`}>
              {massComparison.percentageChange > 0 ? '+' : ''}{massComparison.percentageChange.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ComponentExportPanel({ 
  component, 
  originalMaterial, 
  onClose,
  className = ""
}: ComponentExportPanelProps) {
  const [printingMaterial, setPrintingMaterial] = useState<PrintingMaterialSpec | null>(null);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: ExportFormat.STL,
    material: originalMaterial,
    includeSupports: true,
    layerHeight: 0.2,
    infillPercent: 20,
    exportUnits: 'mm'
  });
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  
  const componentType = useMemo(() => {
    if ('shape' in component) return 'nose_cone' as const;
    if ('outer_radius_m' in component) return 'body_tube' as const;
    return 'fin' as const;
  }, [component]);
  
  const handleExport = async () => {
    if (!printingMaterial) return;
    
    setIsExporting(true);
    try {
      let result: ExportResult;
      
      if ('shape' in component) {
        result = await componentExporter.exportNoseCone(component, printingMaterial, exportOptions);
      } else if ('outer_radius_m' in component) {
        result = await componentExporter.exportBodyTube(component, printingMaterial, exportOptions);
      } else {
        result = await componentExporter.exportFin(component, printingMaterial, exportOptions);
      }
      
      setExportResult(result);
      
      // Download the file
      const blob = new Blob([result.fileData as string], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };
  
  const handleMaterialChange = (material: PrintingMaterialSpec) => {
    setPrintingMaterial(material);
    setExportOptions(prev => ({ ...prev, material }));
  };
  
  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-2xl">Export for 3D Printing</h3>
        <button
          onClick={onClose}
          className="p-3 text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/10"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Material selection */}
      <PrintingMaterialSelector
        selectedMaterial={printingMaterial}
        componentType={componentType}
        onMaterialChange={handleMaterialChange}
      />
      
      {/* Material comparison */}
      {printingMaterial && (
        <MaterialComparison
          originalMaterial={originalMaterial}
          printingMaterial={printingMaterial}
          component={component}
        />
      )}
      
      {/* Export options */}
      {printingMaterial && (
        <ExportOptionsForm
          options={exportOptions}
          onOptionsChange={setExportOptions}
        />
      )}
      
      {/* Export actions */}
      {printingMaterial && (
        <div className="space-y-6">
          <div className="flex gap-4">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1 px-6 py-4 bg-cyan-400 text-black font-semibold rounded-lg hover:bg-cyan-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-base"
            >
              {isExporting ? 'Exporting...' : `Export ${exportOptions.format.toUpperCase()}`}
            </button>
          </div>
          
          {/* Export estimates */}
          {exportResult && (
            <div className="p-6 bg-black/40 rounded-xl border border-white/20">
              <h4 className="text-white font-medium mb-4 text-lg">Export Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-white/60 text-sm font-medium">Print Time</div>
                  <div className="text-white font-semibold text-base">{Math.round(exportResult.estimatedPrintTime)} min</div>
                </div>
                <div>
                  <div className="text-white/60 text-sm font-medium">Material Cost</div>
                  <div className="text-white font-semibold text-base">${exportResult.estimatedCost.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-white/60 text-sm font-medium">Volume</div>
                  <div className="text-white font-semibold text-base">{exportResult.volume.toFixed(1)} cm³</div>
                </div>
                <div>
                  <div className="text-white/60 text-sm font-medium">Mass</div>
                  <div className="text-white font-semibold text-base">{exportResult.mass.toFixed(3)} kg</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
