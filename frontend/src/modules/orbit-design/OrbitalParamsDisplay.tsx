import { useStore } from '@/stores'
import { classifyOrbit } from '@/types/orbit'
import { R_EARTH_EQUATORIAL, MU_EARTH_KM } from '@/lib/constants'
import { getNrlmsiseDensity, SOLAR_PRESETS } from '@/lib/nrlmsise00'
import type { SolarActivity } from '@/lib/orbital-lifetime'
import {
  formatDistance,
  formatVelocity,
  formatPeriodMinutes,
  formatAngle,
  formatPercent,
  formatRate,
  formatRevsPerDay,
} from '@/lib/units'
import DataReadout from '@/components/ui/DataReadout'
import SectionHeader from '@/components/ui/SectionHeader'
import EquationsPanel from '@/components/ui/EquationsPanel'
import type { Equation } from '@/components/ui/EquationsPanel'
import ExportCSVButton from '@/components/ui/ExportCSVButton'
import { exportCSV } from '@/lib/csv-export'

export default function OrbitalParamsDisplay() {
  const derivedParams = useStore((s) => s.derivedParams)
  const elements = useStore((s) => s.elements)
  const propagationMode = useStore((s) => s.propagationMode)
  const osculatingElements = useStore((s) => s.osculatingElements)
  const solarActivity = (useStore((s) => s.mission.solarActivity) || 'moderate') as SolarActivity

  if (!derivedParams) {
    return (
      <div className="text-[var(--text-tertiary)] text-xs font-mono text-center py-8">
        Computing orbital parameters...
      </div>
    )
  }

  // When in numerical mode with osculating elements, compute live derived params
  const isNumerical = propagationMode !== 'keplerian' && osculatingElements !== null
  const displayElements = isNumerical ? osculatingElements : elements

  // Compute display values from osculating or static elements
  const sma = displayElements.semiMajorAxis
  const ecc = displayElements.eccentricity
  const periapsisAlt = isNumerical ? sma * (1 - ecc) - R_EARTH_EQUATORIAL : derivedParams.periapsisAlt
  const apoapsisAlt = isNumerical ? sma * (1 + ecc) - R_EARTH_EQUATORIAL : derivedParams.apoapsisAlt
  const period = isNumerical ? 2 * Math.PI * Math.sqrt(Math.pow(sma, 3) / MU_EARTH_KM) : derivedParams.period
  const revsPerDay = isNumerical ? 86400 / period : derivedParams.revsPerDay

  // Velocities from vis-viva: v = sqrt(mu * (2/r - 1/a))
  const vPerigee = isNumerical
    ? Math.sqrt(MU_EARTH_KM * (2 / (sma * (1 - ecc)) - 1 / sma))
    : derivedParams.velocityPerigee
  const vApogee = isNumerical
    ? Math.sqrt(MU_EARTH_KM * (2 / (sma * (1 + ecc)) - 1 / sma))
    : derivedParams.velocityApogee

  const avgAlt = (periapsisAlt + apoapsisAlt) / 2
  const orbitType = classifyOrbit(avgAlt, ecc, displayElements.inclination, derivedParams.raanDrift)
  const solarPreset = SOLAR_PRESETS[solarActivity]
  const atmDensity = getNrlmsiseDensity(periapsisAlt, 0, 0, new Date(), solarPreset.f107a, solarPreset.f107, solarPreset.ap)

  const rPerigee = sma * (1 - ecc)
  const orbitEquations: Equation[] = [
    {
      name: 'Orbital Velocity (Circular)',
      formula: 'v = \u221A(\u03BC/r)',
      computed: `v = \u221A(${MU_EARTH_KM.toFixed(2)} / ${rPerigee.toFixed(3)}) = ${vPerigee.toFixed(3)} km/s`,
      variables: [
        { symbol: '\u03BC', definition: `${MU_EARTH_KM.toFixed(4)} km\u00B3/s\u00B2` },
        { symbol: 'r', definition: `${R_EARTH_EQUATORIAL.toFixed(3)} + ${periapsisAlt.toFixed(1)} = ${rPerigee.toFixed(3)} km` },
      ],
    },
    {
      name: 'Orbital Period',
      formula: 'T = 2\u03C0\u221A(a\u00B3/\u03BC)',
      computed: `T = 2\u03C0\u221A(${sma.toFixed(3)}\u00B3 / ${MU_EARTH_KM.toFixed(2)}) = ${(period / 60).toFixed(2)} min`,
      variables: [
        { symbol: 'a', definition: `${sma.toFixed(3)} km` },
      ],
    },
    {
      name: 'J2 RAAN Drift',
      formula: 'd\u03A9/dt = -3/2 \u00D7 n \u00D7 J\u2082 \u00D7 (R\u2091/a)\u00B2 \u00D7 cos(i) / (1-e\u00B2)\u00B2',
      computed: `d\u03A9/dt = ${derivedParams.raanDrift.toFixed(4)}\u00B0/day  (i=${displayElements.inclination.toFixed(2)}\u00B0, e=${ecc.toFixed(6)})`,
      variables: [
        { symbol: 'J\u2082', definition: '1.08263\u00D710\u207B\u00B3' },
      ],
    },
    {
      name: 'J2 Arg. Perigee Drift',
      formula: 'd\u03C9/dt = 3/2 \u00D7 n \u00D7 J\u2082 \u00D7 (R\u2091/a)\u00B2 \u00D7 (2 - 5/2 \u00D7 sin\u00B2(i)) / (1-e\u00B2)\u00B2',
      computed: `d\u03C9/dt = ${derivedParams.argPerigeeDrift.toFixed(4)}\u00B0/day`,
    },
    {
      name: 'Sun-Synchronous Condition',
      formula: 'd\u03A9/dt = 0.9856\u00B0/day',
      computed: `Actual d\u03A9/dt = ${derivedParams.raanDrift.toFixed(4)}\u00B0/day \u2014 ${derivedParams.isSunSync ? 'SUN-SYNC \u2713' : 'Not sun-synchronous'}`,
      description: 'Solve RAAN drift equation for inclination at a given altitude to achieve sun-synchronous precession matching Earth\u2019s orbital rate.',
    },
  ]

  return (
    <div className="space-y-3">
      {/* Orbit Classification */}
      <div className="glass-panel p-3 flex items-center gap-2">
        <div className={`
          px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase
          ${orbitType === 'LEO' ? 'bg-accent-blue/20 text-accent-blue' :
            orbitType === 'SSO' ? 'bg-accent-purple/20 text-accent-purple' :
            orbitType === 'GEO' ? 'bg-accent-red/20 text-accent-red' :
            orbitType === 'MEO' ? 'bg-accent-amber/20 text-accent-amber' :
            'bg-accent-purple/20 text-accent-purple'}
        `}>
          {orbitType}
        </div>
        {derivedParams.isSunSync && (
          <div className="px-2 py-0.5 rounded text-[10px] font-mono bg-accent-green/20 text-accent-green">
            SUN-SYNC
          </div>
        )}
        {derivedParams.isSunSync && (
          <span className="text-[10px] text-[var(--text-tertiary)] font-mono">
            LTAN {derivedParams.sunSyncLTAN}
          </span>
        )}
        {isNumerical && (
          <div className="px-2 py-0.5 rounded text-[9px] font-mono bg-accent-cyan/15 text-accent-cyan border border-accent-cyan/30">
            OSCULATING
          </div>
        )}
      </div>

      {/* Key Parameters */}
      <SectionHeader title="Orbital Parameters" defaultOpen={true} actions={
        <ExportCSVButton onClick={() => {
          if (!derivedParams) return
          exportCSV(
            'orbital_parameters',
            ['Parameter', 'Value', 'Unit'],
            [
              ['Semi-major Axis', sma.toFixed(3), 'km'],
              ['Eccentricity', ecc.toFixed(6), ''],
              ['Inclination', displayElements.inclination.toFixed(4), 'deg'],
              ['RAAN', displayElements.raan.toFixed(4), 'deg'],
              ['Arg of Perigee', displayElements.argOfPerigee.toFixed(4), 'deg'],
              ['True Anomaly', displayElements.trueAnomaly.toFixed(4), 'deg'],
              ['Period', (period / 60).toFixed(2), 'min'],
              ['Perigee Altitude', periapsisAlt.toFixed(1), 'km'],
              ['Apogee Altitude', apoapsisAlt.toFixed(1), 'km'],
              ['V Perigee', vPerigee.toFixed(3), 'km/s'],
              ['V Apogee', vApogee.toFixed(3), 'km/s'],
              ['RAAN Drift', derivedParams.raanDrift.toFixed(4), 'deg/day'],
              ['Revs/Day', revsPerDay.toFixed(2), ''],
              ['Eclipse Fraction', (derivedParams.eclipseFraction * 100).toFixed(1), '%'],
            ]
          )
        }} />
      }>
        <div className="grid grid-cols-2 gap-2">
          <DataReadout label="Period" value={formatPeriodMinutes(period)} />
          <DataReadout label="Revs/Day" value={formatRevsPerDay(revsPerDay)} />
          <DataReadout label="Perigee Alt" value={formatDistance(periapsisAlt)} />
          <DataReadout label="Apogee Alt" value={formatDistance(apoapsisAlt)} />
          <DataReadout label="V Perigee" value={formatVelocity(vPerigee)} />
          <DataReadout label="V Apogee" value={formatVelocity(vApogee)} />
        </div>
      </SectionHeader>

      {/* Eclipse */}
      <SectionHeader title="Eclipse Analysis" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-2">
          <DataReadout
            label="Eclipse Fraction"
            value={formatPercent(derivedParams.eclipseFraction * 100)}
            status={derivedParams.eclipseFraction > 0.4 ? 'warning' : 'default'}
          />
          <DataReadout
            label="Avg Eclipse"
            value={formatPeriodMinutes(derivedParams.avgEclipseDuration)}
          />
          <DataReadout
            label="Max Eclipse"
            value={formatPeriodMinutes(derivedParams.maxEclipseDuration)}
          />
          <DataReadout
            label="Sunlight"
            value={formatPercent((1 - derivedParams.eclipseFraction) * 100)}
            status="nominal"
          />
        </div>
      </SectionHeader>

      {/* J2 Perturbations */}
      <SectionHeader title="J2 Perturbations" defaultOpen={true}>
        <div className="grid grid-cols-1 gap-2">
          <DataReadout
            label="RAAN Drift"
            value={formatRate(derivedParams.raanDrift)}
          />
          <DataReadout
            label="Arg. Perigee Drift"
            value={formatRate(derivedParams.argPerigeeDrift)}
          />
          <DataReadout
            label="Atm. Density"
            value={atmDensity.toExponential(2)}
            unit="kg/m&#178;"
          />
        </div>
      </SectionHeader>

      {/* Raw Elements */}
      <SectionHeader title={isNumerical ? 'Osculating Elements' : 'Classical Elements'} defaultOpen={false}>
        <div className="grid grid-cols-1 gap-2">
          <DataReadout label="Semi-major Axis" value={formatDistance(sma)} />
          <DataReadout label="Eccentricity" value={ecc.toFixed(6)} />
          <DataReadout label="Inclination" value={formatAngle(displayElements.inclination)} />
          <DataReadout label="RAAN" value={formatAngle(displayElements.raan)} />
          <DataReadout label="Arg. of Perigee" value={formatAngle(displayElements.argOfPerigee)} />
          <DataReadout label="True Anomaly" value={formatAngle(displayElements.trueAnomaly)} />
        </div>
      </SectionHeader>

      <EquationsPanel equations={orbitEquations} />
    </div>
  )
}
