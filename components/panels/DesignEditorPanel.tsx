"use client"

import React, { useEffect, useState } from "react"
import { useRocket } from "@/lib/store"
import { dispatchActions } from "@/lib/ai/actions"
import { MATERIAL_DATABASE, getRecommendedMaterials, MaterialSpec, PrintingMaterialSpec } from "@/lib/data/materials"
import { ComponentExportPanel } from "@/components/ui/ComponentExportPanel";
import { ExportPortal } from "@/components/ui/ExportPortal";
import { NoseComponent, BodyComponent, FinComponent } from "@/types/rocket"

type NumberInputProps = {
  label: string
  value: number | undefined
  step?: number
  min?: number
  max?: number
  onCommit: (n: number) => void
}

function NumberInput({ label, value, step = 0.001, min, max, onCommit }: NumberInputProps) {
  const [error, setError] = useState<string | null>(null);
  const [localValue, setLocalValue] = useState<string>((value ?? 0).toString());
  
  // Update local value when prop changes
  useEffect(() => {
    setLocalValue((value ?? 0).toString());
  }, [value]);
  
  const handleCommit = (v: number) => {
    setError(null);
    
    // Validate constraints
    if (min !== undefined && v < min) {
      setError(`Minimum: ${min}`);
      return;
    }
    if (max !== undefined && v > max) {
      setError(`Maximum: ${max}`);
      return;
    }
    
    onCommit(v);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 py-1.5">
        <span className="text-xs text-white/70 whitespace-nowrap">{label}</span>
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={(e) => {
            const v = parseFloat(e.target.value)
            if (!Number.isNaN(v)) handleCommit(v)
          }}
          className={`w-28 px-2 py-1 rounded bg-black/40 border text-white text-xs outline-none focus:border-cyan-400/50 ${
            error ? 'border-red-400/50' : 'border-white/10'
          }`}
        />
      </div>
      {error && (
        <div className="text-[10px] text-red-400/80 px-2">{error}</div>
      )}
    </div>
  )
}

function ColorInput({ label, value, onCommit }: { label: string; value?: string; onCommit: (c: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-white/70 whitespace-nowrap">{label}</span>
      <input
        type="color"
        value={value ?? "#A0A7B8"}
        onChange={(e) => onCommit(e.target.value)}
        className="w-10 h-6 rounded bg-black/40 border border-white/10 text-white text-xs outline-none"
      />
    </div>
  )
}

function SelectInput({ label, value, options, onCommit }: { label: string; value: string; options: string[]; onCommit: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-white/70 whitespace-nowrap">{label}</span>
      <select
        value={value}
        onChange={(e) => onCommit(e.target.value)}
        className="w-36 px-2 py-1 rounded bg-black/40 border border-white/10 text-white text-xs outline-none focus:border-cyan-400/50"
      >
        {options.map((opt) => (
          <option key={opt} value={opt} className="bg-black">
            {opt}
          </option>
        ))}
      </select>
    </div>
  )
}

function MaterialSelect({ 
  label, 
  value, 
  componentType, 
  onCommit 
}: { 
  label: string; 
  value: string; 
  componentType: 'nose_cone' | 'body_tube' | 'fin' | 'motor' | 'recovery';
  onCommit: (materialId: string) => void 
}) {
  const recommendedMaterials = getRecommendedMaterials(componentType);
  const allMaterials = Object.values(MATERIAL_DATABASE);
  
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-xs text-white/70 whitespace-nowrap">{label}</span>
      <select
        value={value}
        onChange={(e) => onCommit(e.target.value)}
        className="w-40 px-2 py-1 rounded bg-black/40 border border-white/10 text-white text-xs outline-none focus:border-cyan-400/50"
      >
        <optgroup label="Recommended" className="bg-black">
          {recommendedMaterials.map((material) => (
            <option key={material.id} value={material.id} className="bg-black">
              {material.name} ({material.density_kg_m3} kg/m³)
            </option>
          ))}
        </optgroup>
        <optgroup label="All Materials" className="bg-black">
          {allMaterials.filter(m => !recommendedMaterials.includes(m)).map((material) => (
            <option key={material.id} value={material.id} className="bg-black">
              {material.name} ({material.density_kg_m3} kg/m³)
            </option>
          ))}
        </optgroup>
      </select>
    </div>
  )
}

export default function DesignEditorPanel({ onClose, activeFinIndex, setActiveFinIndex }: { onClose?: () => void; activeFinIndex?: number; setActiveFinIndex?: (i: number) => void }) {
  const { rocket } = useRocket()
  const [motorOptions, setMotorOptions] = useState<Array<{id: string; name?: string}>>([])
  const [isLoadingMotors, setIsLoadingMotors] = useState(false)
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({})
  
  // 3D Printing Export State
  const [showExportPanel, setShowExportPanel] = useState(false)
  const [exportComponent, setExportComponent] = useState<NoseComponent | BodyComponent | FinComponent | null>(null)
  const [exportComponentType, setExportComponentType] = useState<'nose_cone' | 'body_tube' | 'fin'>('nose_cone')

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        setIsLoadingMotors(true)
        const res = await fetch('/api/motors')
        if (!res.ok) throw new Error('Failed to fetch motors')
        const data = await res.json()
        if (mounted) setMotorOptions(Array.isArray(data) ? data : [])
      } catch {
        if (mounted) setMotorOptions([])
      } finally {
        if (mounted) setIsLoadingMotors(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const bodyTubes = rocket.body_tubes
  const fins = rocket.fins
  const parachutes = rocket.parachutes

  const noseShape = rocket.nose_cone?.shape ?? "ogive"

  // Validation helper
  const validateFinSet = (fin: {tip_chord_m: number; root_chord_m: number; sweep_length_m: number; span_m: number}, index: number) => {
    const errors: string[] = [];
    
    // Tip chord <= Root chord
    if (fin.tip_chord_m > fin.root_chord_m) {
      errors.push("Tip chord must be ≤ root chord");
    }
    
    // Sweep length <= Span
    if (fin.sweep_length_m > fin.span_m) {
      errors.push("Sweep length must be ≤ span");
    }
    
    // Minimum span for stability
    if (fin.span_m < 0.05) {
      errors.push("Span too small for stability");
    }
    
    if (errors.length > 0) {
      setValidationErrors(prev => ({ ...prev, [`fin-${index}`]: errors.join(", ") }));
    } else {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`fin-${index}`];
        return newErrors;
      });
    }
  };

  // Validate fins on mount and changes
  useEffect(() => {
    fins.forEach((fin, index) => validateFinSet(fin, index));
  }, [fins]);

  // Handle 3D printing export
  const handleExportComponent = (component: NoseComponent | BodyComponent | FinComponent, componentType: 'nose_cone' | 'body_tube' | 'fin') => {
    setExportComponent(component);
    setExportComponentType(componentType);
    setShowExportPanel(true);
  };

  const handleCloseExport = () => {
    setShowExportPanel(false);
    setExportComponent(null);
  };

  return (
    <div className="absolute top-6 left-6 z-40 w-[320px] max-h-[82vh] overflow-y-auto glass-panel rounded-lg p-4 border border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-white">Design Editor</h3>
        <button
          onClick={onClose}
          className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20 text-white border border-white/10"
        >
          Close
        </button>
      </div>

      {/* Nose cone */}
      <div className="mb-3 p-3 rounded-lg bg-white/5 border border-white/10">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-white">Nose Cone</div>
          {rocket.nose_cone && (
            <button
              onClick={() => handleExportComponent(rocket.nose_cone!, 'nose_cone')}
              className="px-2 py-1 text-xs rounded bg-cyan-400/20 hover:bg-cyan-400/30 text-cyan-400 border border-cyan-400/30 hover:border-cyan-400/50 transition-colors"
            >
              🖨️ Export
            </button>
          )}
        </div>
        <SelectInput
          label="Shape"
          value={noseShape}
          options={["ogive", "conical", "elliptical", "parabolic"]}
          onCommit={(shape) => dispatchActions([{ action: "update_nose_cone", props: { shape } }])}
        />
        <NumberInput
          label="Length (m)"
          value={rocket.nose_cone?.length_m}
          step={0.001}
          min={0.01}
          max={2.0}
          onCommit={(length_m) => dispatchActions([{ action: "update_nose_cone", props: { length_m } }])}
        />
        <NumberInput
          label="Base radius (m)"
          value={rocket.nose_cone?.base_radius_m}
          step={0.001}
          min={0.005}
          max={1.0}
          onCommit={(base_radius_m) => dispatchActions([{ action: "update_nose_cone", props: { base_radius_m } }])}
        />
        <NumberInput
          label="Wall (m)"
          value={rocket.nose_cone?.wall_thickness_m}
          step={0.0005}
          min={0.0005}
          max={0.01}
          onCommit={(wall_thickness_m) => dispatchActions([{ action: "update_nose_cone", props: { wall_thickness_m } }])}
        />
        <MaterialSelect
          label="Material"
          value={rocket.nose_cone?.material_id || "fiberglass"}
          componentType="nose_cone"
          onCommit={(material_id) => {
            const material = MATERIAL_DATABASE[material_id];
            dispatchActions([{ 
              action: "update_nose_cone", 
              props: { 
                material_id,
                material_density_kg_m3: material.density_kg_m3,
                surface_roughness_m: material.surfaceRoughness_m
              } 
            }]);
          }}
        />
        <ColorInput
          label="Color"
          value={rocket.nose_cone?.color}
          onCommit={(color) => dispatchActions([{ action: "update_nose_cone", props: { color } }])}
        />
      </div>

      {/* Body tubes */}
      <div className="mb-3 p-3 rounded-lg bg-white/5 border border-white/10">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-white">Body Tubes</div>
          <button
            onClick={() => dispatchActions([{ action: "add_body_tube", props: { outer_radius_m: 0.05, length_m: 0.4 } }])}
            className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20 text-white border border-white/10"
          >
            Add
          </button>
        </div>
        {bodyTubes.map((b, i) => (
          <div key={b.id} className="mb-2 p-2 rounded bg-black/30 border border-white/10">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[11px] text-white/80">Tube #{i + 1}</div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleExportComponent(b, 'body_tube')}
                  className="px-2 py-0.5 text-[11px] rounded bg-cyan-400/20 hover:bg-cyan-400/30 text-cyan-400 border border-cyan-400/30 hover:border-cyan-400/50 transition-colors"
                >
                  🖨️
                </button>
                {bodyTubes.length > 1 && (
                  <button
                    onClick={() => dispatchActions([{ action: "remove_body_tube", index: i }])}
                    className="px-2 py-0.5 text-[11px] rounded bg-white/5 hover:bg-white/15 text-white border border-white/10"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
            <NumberInput
              label="Length (m)"
              value={b.length_m}
              step={0.001}
              min={0.01}
              max={10.0}
              onCommit={(length_m) => dispatchActions([{ action: "update_body_tube", index: i, props: { length_m } }])}
            />
            <NumberInput
              label="Radius (m)"
              value={b.outer_radius_m}
              step={0.001}
              min={0.005}
              max={1.0}
              onCommit={(outer_radius_m) => dispatchActions([{ action: "update_body_tube", index: i, props: { outer_radius_m } }])}
            />
            <NumberInput
              label="Wall (m)"
              value={b.wall_thickness_m}
              step={0.0005}
              min={0.0005}
              max={Math.min(0.01, b.outer_radius_m * 0.8)}
              onCommit={(wall_thickness_m) => dispatchActions([{ action: "update_body_tube", index: i, props: { wall_thickness_m } }])}
            />
            <MaterialSelect
              label="Material"
              value={b.material_id || "fiberglass"}
              componentType="body_tube"
              onCommit={(material_id) => {
                const material = MATERIAL_DATABASE[material_id];
                dispatchActions([{ 
                  action: "update_body_tube", 
                  index: i,
                  props: { 
                    material_id,
                    material_density_kg_m3: material.density_kg_m3,
                    surface_roughness_m: material.surfaceRoughness_m
                  } 
                }]);
              }}
            />
            <ColorInput
              label="Color"
              value={b.color}
              onCommit={(color) => dispatchActions([{ action: "update_body_tube", index: i, props: { color } }])}
            />
          </div>
        ))}
      </div>

      {/* Fins */}
      <div className="mb-3 p-3 rounded-lg bg-white/5 border border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold text-white">Fins</div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="text-[10px] text-green-400/70">Active</div>
              <select
                value={Math.min(activeFinIndex ?? 0, Math.max(0, fins.length - 1))}
                onChange={(e) => setActiveFinIndex?.(Math.max(0, Math.min(fins.length - 1, parseInt(e.target.value))))}
                className="px-2 py-1 text-xs rounded bg-black/40 border border-white/10 text-white outline-none focus:border-cyan-400/50"
                disabled={fins.length === 0}
              >
                {fins.map((_f, i) => (
                  <option key={i} value={i} className="bg-black">#{i + 1}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => dispatchActions([{ action: "add_fin_set", props: { fin_count: 3, root_chord_m: 0.08, tip_chord_m: 0.04, span_m: 0.06 } }])}
              className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20 text-white border border-white/10"
            >
              Add
            </button>
            {fins.length > 1 && (
              <button
                onClick={() => dispatchActions([{ action: "remove_fin_set", index: Math.min(activeFinIndex ?? fins.length - 1, fins.length - 1) }])}
                className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20 text-white border border-white/10"
              >
                Remove Last
              </button>
            )}
          </div>
        </div>
        {fins.map((f, i) => (
          <div key={f.id} className={`mb-2 p-2 rounded border ${
            validationErrors[`fin-${i}`] ? 'bg-red-900/20 border-red-400/30' : 'bg-black/30 border-white/10'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <div className="text-[11px] text-white/80">Fin Set #{i + 1}</div>
              <button
                onClick={() => handleExportComponent(f, 'fin')}
                className="px-2 py-0.5 text-[11px] rounded bg-cyan-400/20 hover:bg-cyan-400/30 text-cyan-400 border border-cyan-400/30 hover:border-cyan-400/50 transition-colors"
              >
                🖨️
              </button>
            </div>
            {validationErrors[`fin-${i}`] && (
              <div className="text-[10px] text-red-400/80 mb-2 px-2 py-1 bg-red-900/20 rounded">
                ⚠️ {validationErrors[`fin-${i}`]}
              </div>
            )}
            <NumberInput
              label="Count"
              value={f.fin_count}
              step={1}
              min={2}
              max={8}
              onCommit={(fin_count) => dispatchActions([{ action: "update_fins", index: i, props: { fin_count } }])}
            />
            <NumberInput
              label="Root (m)"
              value={f.root_chord_m}
              step={0.001}
              min={0.01}
              max={0.5}
              onCommit={(root_chord_m) => dispatchActions([{ action: "update_fins", index: i, props: { root_chord_m } }])}
            />
            <NumberInput
              label="Tip (m)"
              value={f.tip_chord_m}
              step={0.001}
              min={0.005}
              max={f.root_chord_m}
              onCommit={(tip_chord_m) => dispatchActions([{ action: "update_fins", index: i, props: { tip_chord_m } }])}
            />
            <NumberInput
              label="Span (m)"
              value={f.span_m}
              step={0.001}
              min={0.05}
              max={0.3}
              onCommit={(span_m) => dispatchActions([{ action: "update_fins", index: i, props: { span_m } }])}
            />
            <NumberInput
              label="Sweep (m)"
              value={f.sweep_length_m}
              step={0.001}
              min={0}
              max={f.span_m}
              onCommit={(sweep_length_m) => dispatchActions([{ action: "update_fins", index: i, props: { sweep_length_m } }])}
            />
            <NumberInput
              label="Thickness (m)"
              value={f.thickness_m}
              step={0.0005}
              min={0.001}
              max={0.02}
              onCommit={(thickness_m) => dispatchActions([{ action: "update_fins", index: i, props: { thickness_m } }])}
            />
            
            <NumberInput
              label="Pos from tail (m)"
              value={f.position_from_tail_m}
              step={0.001}
              min={0}
              max={10}
              onCommit={(position_from_tail_m) => dispatchActions([{ action: "update_fins", index: i, props: { position_from_tail_m } }])}
            />
            
            {/* Fin Type Toggle */}
            <div className="flex items-center justify-between gap-3 py-1.5">
              <span className="text-xs text-white/70 whitespace-nowrap">Fin Type</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => dispatchActions([{ action: "update_fins", index: i, props: { wall_thickness_m: 0 } }])}
                  className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                    !f.wall_thickness_m || f.wall_thickness_m === 0
                      ? 'bg-cyan-400/20 text-cyan-400 border-cyan-400/50'
                      : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
                  }`}
                >
                  Solid
                </button>
                <button
                  onClick={() => dispatchActions([{ action: "update_fins", index: i, props: { wall_thickness_m: f.thickness_m * 0.3 } }])}
                  className={`px-2 py-1 text-[10px] rounded border transition-colors ${
                    f.wall_thickness_m && f.wall_thickness_m > 0
                      ? 'bg-cyan-400/20 text-cyan-400 border-cyan-400/50'
                      : 'bg-white/10 text-white/70 border-white/20 hover:bg-white/20'
                  }`}
                >
                  Hollow
                </button>
              </div>
            </div>
            
            {/* Wall Thickness (only show for hollow fins) */}
            {f.wall_thickness_m && f.wall_thickness_m > 0 && (
              <NumberInput
                label="Wall (m)"
                value={f.wall_thickness_m}
                step={0.0005}
                min={0.001}
                max={f.thickness_m * 0.5}
                onCommit={(wall_thickness_m) => dispatchActions([{ action: "update_fins", index: i, props: { wall_thickness_m } }])}
              />
            )}
            
            <NumberInput
              label="Cant (deg)"
              value={f.cant_angle_deg}
              step={0.5}
              min={-15}
              max={15}
              onCommit={(cant_angle_deg) => dispatchActions([{ action: "update_fins", index: i, props: { cant_angle_deg } }])}
            />
            <MaterialSelect
              label="Material"
              value={f.material_id || "birch_plywood"}
              componentType="fin"
              onCommit={(material_id) => {
                const material = MATERIAL_DATABASE[material_id];
                dispatchActions([{ 
                  action: "update_fins", 
                  index: i,
                  props: { 
                    material_id,
                    material_density_kg_m3: material.density_kg_m3
                  } 
                }]);
              }}
            />
            <ColorInput
              label="Color"
              value={f.color}
              onCommit={(color) => dispatchActions([{ action: "update_fins", index: i, props: { color } }])}
            />
          </div>
        ))}
      </div>

      {/* Motor */}
      <div className="mb-3 p-3 rounded-lg bg-white/5 border border-white/10">
        <div className="text-xs font-semibold text-white mb-2">Motor</div>
        <div className="flex items-center justify-between gap-3 py-1.5">
          <span className="text-xs text-white/70 whitespace-nowrap">Select</span>
          <select
            value={rocket.motor?.motor_database_id || ""}
            onChange={(e) => {
              console.log('🔍 Motor selection changed:', {
                rocketId: rocket.id,
                rocketName: rocket.name,
                oldMotor: rocket.motor?.motor_database_id,
                newMotor: e.target.value
              });
              dispatchActions([{ action: "update_motor", props: { motor_database_id: e.target.value } }]);
            }}
            className="w-44 px-2 py-1 rounded bg-black/40 border border-white/10 text-white text-xs outline-none focus:border-cyan-400/50"
          >
            <option value="" disabled>{isLoadingMotors ? 'Loading…' : 'Choose motor'}</option>
            {motorOptions.map((m) => (
              <option key={m.id} value={m.id} className="bg-black">{m.name ?? m.id}</option>
            ))}
          </select>
        </div>
        <NumberInput
          label="Pos from tail (m)"
          value={rocket.motor?.position_from_tail_m}
          step={0.001}
          min={0}
          onCommit={(position_from_tail_m) => dispatchActions([{ action: "update_motor", props: { position_from_tail_m } }])}
        />
      </div>

      {/* Parachutes */}
      <div className="mb-1 p-3 rounded-lg bg-white/5 border border-white/10">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-white">Parachutes</div>
          <button
            onClick={() => dispatchActions([{ action: "add_parachute", props: { name: "Parachute", cd_s_m2: 1.0 } }])}
            className="px-2 py-1 text-xs rounded bg-white/10 hover:bg-white/20 text-white border border-white/10"
          >
            Add
          </button>
        </div>
        {parachutes.map((p, i) => (
          <div key={p.id} className="mb-2 p-2 rounded bg-black/30 border border-white/10">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[11px] text-white/80">Parachute #{i + 1}</div>
              {parachutes.length > 1 && (
                <button
                  onClick={() => dispatchActions([{ action: "remove_parachute", index: i }])}
                  className="px-2 py-0.5 text-[11px] rounded bg-white/5 hover:bg-white/15 text-white border border-white/10"
                >
                  Remove
                </button>
              )}
            </div>
            <NumberInput
              label="Cd·S (m²)"
              value={p.cd_s_m2}
              step={0.1}
              min={0.1}
              max={100}
              onCommit={(cd_s_m2) => dispatchActions([{ action: "update_parachute", index: i, props: { cd_s_m2 } }])}
            />
            <NumberInput
              label="Lag (s)"
              value={p.lag_s}
              step={0.1}
              min={0}
              max={10}
              onCommit={(lag_s) => dispatchActions([{ action: "update_parachute", index: i, props: { lag_s } }])}
            />
            <NumberInput
              label="Pos from tail (m)"
              value={p.position_from_tail_m}
              step={0.001}
              min={0}
              onCommit={(position_from_tail_m) => dispatchActions([{ action: "update_parachute", index: i, props: { position_from_tail_m } }])}
            />
            <ColorInput
              label="Color"
              value={p.color}
              onCommit={(color) => dispatchActions([{ action: "update_parachute", index: i, props: { color } }])}
            />
          </div>
        ))}
      </div>
      
      {/* 3D Printing Export Panel */}
      {showExportPanel && exportComponent && (
        <ExportPortal isOpen={showExportPanel}>
          <ComponentExportPanel
            component={exportComponent}
            originalMaterial={MATERIAL_DATABASE[exportComponent.material_id] as PrintingMaterialSpec || MATERIAL_DATABASE.pla as PrintingMaterialSpec}
            onClose={handleCloseExport}
          />
        </ExportPortal>
      )}
    </div>
  )
}


