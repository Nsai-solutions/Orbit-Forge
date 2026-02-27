import { useMemo, useState } from 'react'
import { useStore } from '@/stores'
import DataReadout from '@/components/ui/DataReadout'
import SectionHeader from '@/components/ui/SectionHeader'
import {
  computeBallisticCoefficient,
  estimateLifetime,
  computeDeorbitDeltaV,
  type SolarActivity,
} from '@/lib/orbital-lifetime'
import { getAtmosphericDensity } from '@/lib/constants'

export default function LifetimeDisplay() {
  const elements = useStore((s) => s.elements)
  const mission = useStore((s) => s.mission)
  const [solarActivity] = useState<SolarActivity>('moderate')

  const avgAlt = elements.semiMajorAxis - 6378.137
  const crossSection = mission.spacecraft.crossSectionArea
  const cd = mission.spacecraft.dragCoefficient
  const bStar = computeBallisticCoefficient(mission.spacecraft.mass, crossSection, cd)

  const lifetimeDays = useMemo(
    () => estimateLifetime(avgAlt, bStar, solarActivity),
    [avgAlt, bStar, solarActivity]
  )

  const deorbitDV = useMemo(
    () => computeDeorbitDeltaV(avgAlt),
    [avgAlt]
  )

  const density = getAtmosphericDensity(avgAlt)

  return (
    <div className="space-y-3">
      <SectionHeader title="Spacecraft Parameters">
        <div className="grid grid-cols-2 gap-2">
          <DataReadout
            label="Mass"
            value={mission.spacecraft.mass.toFixed(1)}
            unit="kg"
          />
          <DataReadout
            label="CubeSat Size"
            value={mission.spacecraft.size}
          />
          <DataReadout
            label="Cross-Section"
            value={crossSection < 0.01 ? (crossSection * 1e4).toFixed(0) : crossSection.toFixed(3)}
            unit={crossSection < 0.01 ? 'cm²' : 'm²'}
          />
          <DataReadout
            label="B* Coeff"
            value={bStar.toFixed(4)}
            unit="m²/kg"
          />
        </div>
      </SectionHeader>

      <SectionHeader title="Atmospheric Environment">
        <div className="grid grid-cols-2 gap-2">
          <DataReadout
            label="Altitude"
            value={avgAlt.toFixed(1)}
            unit="km"
          />
          <DataReadout
            label="Density"
            value={density.toExponential(2)}
            unit="kg/m³"
          />
        </div>
      </SectionHeader>

      <SectionHeader title="Lifetime & Deorbit">
        <div className="grid grid-cols-2 gap-2">
          <DataReadout
            label="Est. Lifetime"
            value={lifetimeDays > 36525 ? '>100' : (lifetimeDays / 365.25).toFixed(1)}
            unit="years"
          />
          <DataReadout
            label="Lifetime"
            value={lifetimeDays > 36525 ? '>36500' : lifetimeDays.toFixed(0)}
            unit="days"
          />
          <DataReadout
            label="Deorbit dV"
            value={deorbitDV.toFixed(1)}
            unit="m/s"
          />
          <DataReadout
            label="Target Perigee"
            value="80"
            unit="km"
          />
        </div>
      </SectionHeader>
    </div>
  )
}
