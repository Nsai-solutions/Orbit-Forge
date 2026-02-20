import { useState, useMemo } from 'react'
import { useStore } from '@/stores'
import DataReadout from '@/components/ui/DataReadout'
import MetricCard from '@/components/ui/MetricCard'
import SectionHeader from '@/components/ui/SectionHeader'
import { R_EARTH_EQUATORIAL } from '@/lib/constants'
import { totalAvgPowerDraw } from '@/lib/power-budget'
import {
  SURFACE_MATERIALS,
  DEFAULT_MATERIAL,
  computeThermalSummary,
  computeEarthViewFactor,
} from '@/lib/thermal-analysis'

export default function ThermalSection() {
  const elements = useStore((s) => s.elements)
  const derivedParams = useStore((s) => s.derivedParams)
  const mission = useStore((s) => s.mission)
  const subsystems = useStore((s) => s.subsystems)

  const [materialId, setMaterialId] = useState(DEFAULT_MATERIAL)
  const material = SURFACE_MATERIALS[materialId]

  const avgAlt = elements.semiMajorAxis - R_EARTH_EQUATORIAL
  const eclipseFraction = derivedParams?.eclipseFraction ?? 0.35
  const internalPower = totalAvgPowerDraw(subsystems)

  const summary = useMemo(
    () => computeThermalSummary(material, avgAlt, eclipseFraction, internalPower, mission.spacecraft.size),
    [material, avgAlt, eclipseFraction, internalPower, mission.spacecraft.size]
  )

  const viewFactor = computeEarthViewFactor(avgAlt)

  return (
    <div className="space-y-3">
      <SectionHeader title="Thermal Analysis" defaultOpen={true}>
        {/* Material selector */}
        <div className="mb-3">
          <label className="text-[9px] uppercase tracking-wider text-[var(--text-secondary)] block mb-1">
            Surface Material
          </label>
          <select
            value={materialId}
            onChange={(e) => setMaterialId(e.target.value)}
            className="w-full rounded border border-white/10 bg-white/[0.06] px-2 py-1.5 text-xs font-mono text-[var(--text-primary)] focus:border-accent-blue focus:outline-none"
          >
            {Object.entries(SURFACE_MATERIALS).map(([id, mat]) => (
              <option key={id} value={id}>{mat.name}</option>
            ))}
          </select>
        </div>

        {/* Hot/Cold case cards */}
        <div className="grid grid-cols-2 gap-2">
          <MetricCard
            label="Hot Case"
            value={`${summary.hotCaseC.toFixed(1)}\u00B0C`}
            status={summary.hotCaseStatus}
          />
          <MetricCard
            label="Cold Case"
            value={`${summary.coldCaseC.toFixed(1)}\u00B0C`}
            status={summary.coldCaseStatus}
          />
        </div>

        {/* Recommendation */}
        <div className="mt-2 px-2 py-1.5 rounded border border-white/5 bg-white/[0.02]">
          <span className="text-[10px] text-[var(--text-secondary)] font-mono italic">
            {summary.recommendation}
          </span>
        </div>
      </SectionHeader>

      <SectionHeader title="Surface Properties" defaultOpen={false}>
        <div className="grid grid-cols-2 gap-2">
          <DataReadout
            label="Absorptivity (\u03B1)"
            value={material.absorptivity.toFixed(2)}
          />
          <DataReadout
            label="Emissivity (\u03B5)"
            value={material.emissivity.toFixed(2)}
          />
          <DataReadout
            label="\u03B1/\u03B5 Ratio"
            value={(material.absorptivity / material.emissivity).toFixed(2)}
          />
          <DataReadout
            label="Earth View Factor"
            value={viewFactor.toFixed(3)}
          />
        </div>
      </SectionHeader>
    </div>
  )
}
