import { useMemo } from 'react'
import { useStore } from '@/stores'
import SectionHeader from '@/components/ui/SectionHeader'
import MetricCard from '@/components/ui/MetricCard'
import {
  computeBallisticCoefficient,
  checkCompliance,
  type SolarActivity,
} from '@/lib/orbital-lifetime'
import { getNrlmsiseDensity, SOLAR_PRESETS } from '@/lib/nrlmsise00'
import { R_EARTH_EQUATORIAL, MU_EARTH_KM } from '@/lib/constants'
import EquationsPanel from '@/components/ui/EquationsPanel'
import type { Equation } from '@/components/ui/EquationsPanel'

export default function LifetimeConfigPanel() {
  const elements = useStore((s) => s.elements)
  const mission = useStore((s) => s.mission)
  const updateMission = useStore((s) => s.updateMission)

  const solarActivity = mission.solarActivity as SolarActivity

  const avgAlt = elements.semiMajorAxis - 6378.137
  const crossSection = mission.spacecraft.crossSectionArea
  const dragCoeff = mission.spacecraft.dragCoefficient
  const bStar = computeBallisticCoefficient(mission.spacecraft.mass, crossSection, dragCoeff)

  const compliance = useMemo(
    () => checkCompliance(avgAlt, bStar, solarActivity),
    [avgAlt, bStar, solarActivity]
  )

  const mass = mission.spacecraft.mass
  const preset = SOLAR_PRESETS[solarActivity]
  const density = avgAlt > 0 ? getNrlmsiseDensity(avgAlt, 0, 0, new Date(), preset.f107a, preset.f107, preset.ap) : 0
  const r = R_EARTH_EQUATORIAL + avgAlt
  const vCirc = Math.sqrt(MU_EARTH_KM / r)
  const areaToMass = mass > 0 ? crossSection / mass : 0

  const lifetimeEquations: Equation[] = [
    {
      name: 'Atmospheric Drag Acceleration',
      formula: 'a_drag = -\u00BD \u00D7 C\u1D48 \u00D7 (A/m) \u00D7 \u03C1 \u00D7 v\u00B2 \u00D7 v\u0302',
      computed: `C\u1D48=${dragCoeff.toFixed(1)}, A/m=${areaToMass.toFixed(4)} m\u00B2/kg, \u03C1=${density.toExponential(2)} kg/m\u00B3, v=${vCirc.toFixed(3)} km/s`,
      variables: [
        { symbol: 'C\u1D48', definition: `${dragCoeff.toFixed(1)} (drag coefficient)` },
        { symbol: 'A/m', definition: `${crossSection.toFixed(4)} / ${mass.toFixed(1)} = ${areaToMass.toFixed(4)} m\u00B2/kg` },
      ],
    },
    {
      name: 'Ballistic Coefficient',
      formula: 'B* = C\u1D48 \u00D7 A / m',
      computed: `B* = ${dragCoeff.toFixed(1)} \u00D7 ${crossSection.toFixed(4)} / ${mass.toFixed(1)} = ${bStar.toFixed(4)} m\u00B2/kg`,
    },
    {
      name: 'Atmospheric Density (NRLMSISE-00)',
      formula: '\u03C1 = NRLMSISE-00(alt, lat, lon, date, F10.7, Ap)',
      computed: `\u03C1(${avgAlt.toFixed(1)} km, F10.7=${preset.f107}, Ap=${preset.ap}) = ${density.toExponential(3)} kg/m\u00B3`,
      description: 'Density varies 5\u201310\u00D7 between solar minimum (F10.7\u224870) and maximum (F10.7\u2248200) at 500 km.',
    },
    {
      name: 'Orbital Decay Rate',
      formula: 'da/dt = -\u03C1 \u00D7 v \u00D7 C\u1D48 \u00D7 A / m',
      computed: `Lifetime \u2248 ${compliance.lifetimeYears > 100 ? '>100' : compliance.lifetimeYears.toFixed(1)} years (${compliance.lifetimeDays > 36500 ? '>36500' : compliance.lifetimeDays.toFixed(0)} days)`,
      description: 'Altitude loss per orbit increases as the orbit decays (density increases exponentially).',
    },
    {
      name: 'De-orbit Delta-V',
      formula: '\u0394V = v_circular - v_transfer',
      computed: `\u0394V = ${compliance.deorbitDeltaV.toFixed(1)} m/s (target perigee: 80 km)`,
      description: 'Hohmann transfer to lower perigee to 80 km for atmospheric re-entry.',
    },
  ]

  return (
    <div className="space-y-2">
      <SectionHeader title="Drag Parameters">
        <div className="space-y-2">
          <label className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-secondary)]">Solar Activity</span>
            <select
              value={solarActivity}
              onChange={(e) => updateMission({ solarActivity: e.target.value as SolarActivity })}
              className="input-field w-24 text-xs"
            >
              <option value="low">Low (F10.7=70, Ap=4)</option>
              <option value="moderate">Moderate (F10.7=140, Ap=15)</option>
              <option value="high">High (F10.7=200, Ap=30)</option>
            </select>
          </label>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[var(--text-tertiary)]">Drag Coeff (Cd)</span>
            <span className="text-accent-cyan font-mono">{dragCoeff.toFixed(1)}</span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[var(--text-tertiary)]">Cross-section</span>
            <span className="text-accent-cyan font-mono">{crossSection < 0.01 ? (crossSection * 1e4).toFixed(0) + ' cm²' : crossSection.toFixed(3) + ' m²'}</span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-[var(--text-tertiary)]">B* coefficient</span>
            <span className="text-accent-cyan font-mono">{bStar.toFixed(4)} m²/kg</span>
          </div>
          <p className="text-[9px] text-[var(--text-tertiary)] italic mt-1">Mass, cross-section, and Cd are set in the Mission tab.</p>
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
      <EquationsPanel equations={lifetimeEquations} />
    </div>
  )
}
