import { useStore } from '@/stores'
import { classifyOrbit } from '@/types/orbit'
import { R_EARTH_EQUATORIAL, getAtmosphericDensity } from '@/lib/constants'
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
import ExportCSVButton from '@/components/ui/ExportCSVButton'
import { exportCSV } from '@/lib/csv-export'

export default function OrbitalParamsDisplay() {
  const derivedParams = useStore((s) => s.derivedParams)
  const elements = useStore((s) => s.elements)

  if (!derivedParams) {
    return (
      <div className="text-[var(--text-tertiary)] text-xs font-mono text-center py-8">
        Computing orbital parameters...
      </div>
    )
  }

  const avgAlt = (derivedParams.periapsisAlt + derivedParams.apoapsisAlt) / 2
  const orbitType = classifyOrbit(avgAlt, elements.eccentricity, elements.inclination, derivedParams.raanDrift)
  const atmDensity = getAtmosphericDensity(derivedParams.periapsisAlt)

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
      </div>

      {/* Key Parameters */}
      <SectionHeader title="Orbital Parameters" defaultOpen={true} actions={
        <ExportCSVButton onClick={() => {
          if (!derivedParams) return
          exportCSV(
            'orbital_parameters',
            ['Parameter', 'Value', 'Unit'],
            [
              ['Semi-major Axis', elements.semiMajorAxis.toFixed(3), 'km'],
              ['Eccentricity', elements.eccentricity.toFixed(6), ''],
              ['Inclination', elements.inclination.toFixed(4), 'deg'],
              ['RAAN', elements.raan.toFixed(4), 'deg'],
              ['Arg of Perigee', elements.argOfPerigee.toFixed(4), 'deg'],
              ['True Anomaly', elements.trueAnomaly.toFixed(4), 'deg'],
              ['Period', (derivedParams.period / 60).toFixed(2), 'min'],
              ['Perigee Altitude', derivedParams.periapsisAlt.toFixed(1), 'km'],
              ['Apogee Altitude', derivedParams.apoapsisAlt.toFixed(1), 'km'],
              ['V Perigee', derivedParams.velocityPerigee.toFixed(3), 'km/s'],
              ['V Apogee', derivedParams.velocityApogee.toFixed(3), 'km/s'],
              ['RAAN Drift', derivedParams.raanDrift.toFixed(4), 'deg/day'],
              ['Revs/Day', derivedParams.revsPerDay.toFixed(2), ''],
              ['Eclipse Fraction', (derivedParams.eclipseFraction * 100).toFixed(1), '%'],
            ]
          )
        }} />
      }>
        <div className="grid grid-cols-2 gap-2">
          <DataReadout label="Period" value={formatPeriodMinutes(derivedParams.period)} />
          <DataReadout label="Revs/Day" value={formatRevsPerDay(derivedParams.revsPerDay)} />
          <DataReadout label="Perigee Alt" value={formatDistance(derivedParams.periapsisAlt)} />
          <DataReadout label="Apogee Alt" value={formatDistance(derivedParams.apoapsisAlt)} />
          <DataReadout label="V Perigee" value={formatVelocity(derivedParams.velocityPerigee)} />
          <DataReadout label="V Apogee" value={formatVelocity(derivedParams.velocityApogee)} />
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
            unit="kg/m\u00B3"
          />
        </div>
      </SectionHeader>

      {/* Raw Elements */}
      <SectionHeader title="Classical Elements" defaultOpen={false}>
        <div className="grid grid-cols-1 gap-2">
          <DataReadout label="Semi-major Axis" value={formatDistance(elements.semiMajorAxis)} />
          <DataReadout label="Eccentricity" value={elements.eccentricity.toFixed(6)} />
          <DataReadout label="Inclination" value={formatAngle(elements.inclination)} />
          <DataReadout label="RAAN" value={formatAngle(elements.raan)} />
          <DataReadout label="Arg. of Perigee" value={formatAngle(elements.argOfPerigee)} />
          <DataReadout label="True Anomaly" value={formatAngle(elements.trueAnomaly)} />
        </div>
      </SectionHeader>
    </div>
  )
}
