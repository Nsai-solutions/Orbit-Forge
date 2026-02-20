import { useState, useMemo } from 'react'
import { useStore } from '@/stores'
import SectionHeader from '@/components/ui/SectionHeader'
import MetricCard from '@/components/ui/MetricCard'
import {
  estimateCrossSection,
  computeBallisticCoefficient,
  checkCompliance,
  type SolarActivity,
} from '@/lib/orbital-lifetime'

export default function LifetimeConfigPanel() {
  const elements = useStore((s) => s.elements)
  const mission = useStore((s) => s.mission)

  const [solarActivity, setSolarActivity] = useState<SolarActivity>('moderate')
  const [dragCoeff, setDragCoeff] = useState(2.2)

  const avgAlt = elements.semiMajorAxis - 6378.137
  const crossSection = estimateCrossSection(mission.spacecraft.size)
  const bStar = computeBallisticCoefficient(mission.spacecraft.mass, crossSection, dragCoeff)

  const compliance = useMemo(
    () => checkCompliance(avgAlt, bStar, solarActivity),
    [avgAlt, bStar, solarActivity]
  )

  return (
    <div className="space-y-2">
      <SectionHeader title="Drag Parameters">
        <div className="space-y-2">
          <label className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-secondary)]">Solar Activity</span>
            <select
              value={solarActivity}
              onChange={(e) => setSolarActivity(e.target.value as SolarActivity)}
              className="input-field w-24 text-xs"
            >
              <option value="low">Low (F10.7=70)</option>
              <option value="moderate">Moderate (140)</option>
              <option value="high">High (250)</option>
            </select>
          </label>
          <label className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-secondary)]">Drag Coeff (Cd)</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={dragCoeff}
                onChange={(e) => setDragCoeff(parseFloat(e.target.value) || 2.2)}
                className="input-field w-16 text-xs text-center"
                step="0.1"
                min="1.5"
                max="3.5"
              />
              <span className="text-[10px] text-[var(--text-tertiary)] font-mono">Cd</span>
            </div>
          </label>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[var(--text-tertiary)]">Cross-section</span>
            <span className="text-accent-cyan font-mono">{(crossSection * 1e4).toFixed(0)} cm&sup2;</span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[var(--text-tertiary)]">B* coefficient</span>
            <span className="text-accent-cyan font-mono">{bStar.toFixed(4)} m&sup2;/kg</span>
          </div>
        </div>
      </SectionHeader>

      <SectionHeader title="Lifetime Estimate">
        <div className="grid grid-cols-2 gap-2">
          <MetricCard
            label="Lifetime"
            value={compliance.lifetimeYears > 100 ? '>100' : compliance.lifetimeYears.toFixed(1)}
            unit="years"
            status={compliance.lifetime5Year ? 'nominal' : compliance.lifetime25Year ? 'warning' : 'critical'}
          />
          <MetricCard
            label="Deorbit dV"
            value={compliance.deorbitDeltaV.toFixed(1)}
            unit="m/s"
            status="nominal"
          />
        </div>
      </SectionHeader>

      <SectionHeader title="Compliance">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${compliance.lifetime25Year ? 'bg-accent-green' : 'bg-accent-red'}`} />
            <span className="text-xs text-[var(--text-primary)]">25-year rule (IADC)</span>
            <span className={`text-[9px] font-mono ml-auto ${compliance.lifetime25Year ? 'text-accent-green' : 'text-accent-red'}`}>
              {compliance.lifetime25Year ? 'PASS' : 'FAIL'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${compliance.lifetime5Year ? 'bg-accent-green' : 'bg-accent-red'}`} />
            <span className="text-xs text-[var(--text-primary)]">5-year rule (FCC 2024)</span>
            <span className={`text-[9px] font-mono ml-auto ${compliance.lifetime5Year ? 'text-accent-green' : 'text-accent-red'}`}>
              {compliance.lifetime5Year ? 'PASS' : 'FAIL'}
            </span>
          </div>
          <p className="text-[9px] text-[var(--text-tertiary)] leading-relaxed mt-2">
            {compliance.recommendation}
          </p>
        </div>
      </SectionHeader>
    </div>
  )
}
