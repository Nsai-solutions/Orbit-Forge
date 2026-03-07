import { useStore } from '@/stores'
import DataReadout from '@/components/ui/DataReadout'
import SectionHeader from '@/components/ui/SectionHeader'
import {
  computeBallisticCoefficient,
  estimateLifetime,
  computeDeorbitDeltaV,
  checkCompliance,
  type SolarActivity,
} from '@/lib/orbital-lifetime'
import { getNrlmsiseDensity, SOLAR_PRESETS } from '@/lib/nrlmsise00'
import { R_EARTH_EQUATORIAL, MU_EARTH_KM } from '@/lib/constants'
import EquationsPanel from '@/components/ui/EquationsPanel'
import type { Equation } from '@/components/ui/EquationsPanel'

export default function LifetimeDisplay() {
  const elements = useStore((s) => s.elements)
  const mission = useStore((s) => s.mission)
  const solarActivity = (useStore((s) => s.mission.solarActivity) || 'moderate') as SolarActivity

  const avgAlt = elements.semiMajorAxis - 6378.137
  const mass = mission.spacecraft.mass
  const crossSection = mission.spacecraft.crossSectionArea
  const cd = mission.spacecraft.dragCoefficient
  const bStar = computeBallisticCoefficient(mass, crossSection, cd)

  const lifetimeDays = estimateLifetime(avgAlt, bStar, solarActivity)
  const deorbitDV = computeDeorbitDeltaV(avgAlt)
  const preset = SOLAR_PRESETS[solarActivity]
  const density = getNrlmsiseDensity(avgAlt, 0, 0, new Date(), preset.f107a, preset.f107, preset.ap)

  const compliance = checkCompliance(avgAlt, bStar, solarActivity)
  const r = R_EARTH_EQUATORIAL + avgAlt
  const vCirc = Math.sqrt(MU_EARTH_KM / r)
  const areaToMass = mass > 0 ? crossSection / mass : 0

  const lifetimeEquations: Equation[] = [
    {
      name: 'Atmospheric Drag Acceleration',
      formula: 'a_drag = -\u00BD \u00D7 C\u1D48 \u00D7 (A/m) \u00D7 \u03C1 \u00D7 v\u00B2 \u00D7 v\u0302',
      computed: `C\u1D48=${cd.toFixed(1)}, A/m=${areaToMass.toFixed(4)} m\u00B2/kg, \u03C1=${density.toExponential(2)} kg/m\u00B3, v=${vCirc.toFixed(3)} km/s`,
      variables: [
        { symbol: 'C\u1D48', definition: `${cd.toFixed(1)} (drag coefficient)` },
        { symbol: 'A/m', definition: `${crossSection.toFixed(4)} / ${mass.toFixed(1)} = ${areaToMass.toFixed(4)} m\u00B2/kg` },
      ],
    },
    {
      name: 'Ballistic Coefficient',
      formula: 'B* = C\u1D48 \u00D7 A / m',
      computed: `B* = ${cd.toFixed(1)} \u00D7 ${crossSection.toFixed(4)} / ${mass.toFixed(1)} = ${bStar.toFixed(4)} m\u00B2/kg`,
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
    <div className="space-y-3">
      <SectionHeader title="Spacecraft Parameters">
        <div className="grid grid-cols-2 gap-2">
          <DataReadout
            label="Mass"
            value={mass.toFixed(1)}
            unit="kg"
          />
          <DataReadout
            label="Bus Type"
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

      <EquationsPanel equations={lifetimeEquations} />
    </div>
  )
}
