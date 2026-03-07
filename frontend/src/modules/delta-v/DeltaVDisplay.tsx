import { useMemo } from 'react'
import { useStore } from '@/stores'
import DataReadout from '@/components/ui/DataReadout'
import MetricCard from '@/components/ui/MetricCard'
import SectionHeader from '@/components/ui/SectionHeader'
import { computeDeltaVBudget } from '@/lib/delta-v'
import { R_EARTH_EQUATORIAL } from '@/lib/constants'
import { computeBallisticCoefficient } from '@/lib/orbital-lifetime'
import EquationsPanel from '@/components/ui/EquationsPanel'
import type { Equation } from '@/components/ui/EquationsPanel'

const deltaVEquations: Equation[] = [
  {
    name: 'Vis-Viva Equation',
    formula: 'v\u00B2 = \u03BC(2/r - 1/a)',
    description: 'Relates velocity to position and orbit shape. Core equation for all maneuver calculations.',
    variables: [
      { symbol: '\u03BC', definition: 'gravitational parameter (km\u00B3/s\u00B2)' },
      { symbol: 'r', definition: 'current orbital radius (km)' },
      { symbol: 'a', definition: 'semi-major axis (km)' },
    ],
  },
  {
    name: 'Hohmann Transfer \u0394V',
    formula: '\u0394V\u2081 = v_transfer_periapsis - v_circular\u2081\n\u0394V\u2082 = v_circular\u2082 - v_transfer_apoapsis',
    variables: [
      { symbol: 'a_transfer', definition: '(r\u2081 + r\u2082) / 2' },
    ],
  },
  {
    name: 'Plane Change \u0394V',
    formula: '\u0394V = 2v \u00D7 sin(\u0394i/2)',
    variables: [
      { symbol: '\u0394i', definition: 'inclination change (radians)' },
      { symbol: 'v', definition: 'orbital velocity at maneuver point' },
    ],
  },
  {
    name: 'Tsiolkovsky Rocket Equation',
    formula: '\u0394V = I_sp \u00D7 g\u2080 \u00D7 ln(m\u2080/m_f)',
    description: 'Rearranged: m_propellant = m\u2080 \u00D7 (1 - e^(-\u0394V/(I_sp\u00D7g\u2080)))',
    variables: [
      { symbol: 'I_sp', definition: 'specific impulse (s)' },
      { symbol: 'g\u2080', definition: '9.80665 m/s\u00B2' },
      { symbol: 'm\u2080', definition: 'initial (wet) mass' },
      { symbol: 'm_f', definition: 'final (dry) mass' },
    ],
  },
]

export default function DeltaVDisplay() {
  const elements = useStore((s) => s.elements)
  const mission = useStore((s) => s.mission)
  const propulsion = useStore((s) => s.propulsion)
  const maneuvers = useStore((s) => s.maneuvers)

  const avgAlt = elements.semiMajorAxis - R_EARTH_EQUATORIAL
  const dryMass = mission.spacecraft.mass
  const crossSection = mission.spacecraft.crossSectionArea
  const bStar = computeBallisticCoefficient(dryMass, crossSection, mission.spacecraft.dragCoefficient)

  const budget = useMemo(
    () => computeDeltaVBudget(propulsion, maneuvers, dryMass, avgAlt, mission.lifetimeTarget, bStar),
    [propulsion, maneuvers, dryMass, avgAlt, mission.lifetimeTarget, bStar]
  )

  if (propulsion.type === 'none') {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <MetricCard label="Available ΔV" value="0" unit="m/s" status="critical" />
          <MetricCard label="Required ΔV" value={budget.totalRequiredDeltaV.toFixed(0)} unit="m/s" status="critical" />
        </div>
        <div className="text-[11px] text-[var(--text-tertiary)] italic px-1 py-4 text-center">
          No propulsion system configured.
          <br />
          Configure a thruster in the left panel to see the full budget.
        </div>
      </div>
    )
  }

  const wetMass = dryMass + propulsion.propellantMass

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="Available ΔV"
          value={budget.availableDeltaV.toFixed(1)}
          unit="m/s"
          status={budget.marginStatus}
        />
        <MetricCard
          label="Required ΔV"
          value={budget.totalRequiredDeltaV.toFixed(1)}
          unit="m/s"
          status={budget.marginStatus}
        />
        <MetricCard
          label="ΔV Margin"
          value={budget.marginDeltaV.toFixed(1)}
          unit="m/s"
          status={budget.marginStatus}
        />
        <MetricCard
          label="Propellant Left"
          value={budget.propellantRemainingKg.toFixed(3)}
          unit="kg"
          status={budget.propellantRemainingKg > 0 ? 'nominal' : 'critical'}
        />
      </div>

      <SectionHeader title="Spacecraft Mass">
        <div className="grid grid-cols-2 gap-2">
          <DataReadout label="Dry Mass" value={dryMass.toFixed(2)} unit="kg" />
          <DataReadout label="Propellant Mass" value={propulsion.propellantMass.toFixed(3)} unit="kg" />
          <DataReadout label="Wet Mass" value={wetMass.toFixed(2)} unit="kg" />
          <DataReadout label="Mass Ratio" value={budget.massRatio.toFixed(3)} />
        </div>
      </SectionHeader>

      <SectionHeader title="Maneuver Breakdown">
        <div className="space-y-1.5">
          {budget.maneuverBreakdown.map((m) => (
            <div key={m.id} className="flex items-center justify-between text-[10px]">
              <span className="text-[var(--text-secondary)] truncate flex-1">{m.name}</span>
              <span className="font-mono text-accent-cyan ml-2">{m.deltaV.toFixed(1)} m/s</span>
            </div>
          ))}
          <div className="border-t border-white/10 pt-1 flex items-center justify-between text-[10px] font-semibold">
            <span className="text-[var(--text-secondary)]">Total Required</span>
            <span className="font-mono text-accent-amber">{budget.totalRequiredDeltaV.toFixed(1)} m/s</span>
          </div>
        </div>
      </SectionHeader>

      <SectionHeader title="Reference Values">
        <div className="grid grid-cols-2 gap-2">
          <DataReadout
            label="Deorbit ΔV"
            value={budget.deorbitDeltaV.toFixed(1)}
            unit="m/s"
          />
          <DataReadout
            label="Drag Makeup"
            value={budget.dragDeltaVPerYear.toFixed(2)}
            unit="m/s/yr"
          />
          <DataReadout
            label="Specific Impulse"
            value={propulsion.specificImpulse.toFixed(0)}
            unit="s"
          />
          <DataReadout
            label="Margin"
            value={`${(budget.marginPercent * 100).toFixed(1)}`}
            unit="%"
            status={budget.marginStatus}
          />
        </div>
      </SectionHeader>

      <EquationsPanel equations={deltaVEquations} />
    </div>
  )
}
