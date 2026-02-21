import { useMemo } from 'react'
import { useStore } from '@/stores'
import MetricCard from '@/components/ui/MetricCard'
import SectionHeader from '@/components/ui/SectionHeader'
import DataReadout from '@/components/ui/DataReadout'
import { computeInterplanetaryResult } from '@/lib/interplanetary'
import { PLANET_DATA } from '@/lib/beyond-leo-constants'

export default function InterplanetaryDisplay() {
  const params = useStore((s) => s.beyondLeo.interplanetaryParams)

  const result = useMemo(() => computeInterplanetaryResult(params), [params])

  const planet = PLANET_DATA[params.targetBody]

  // Status for C3: lower is better
  const c3Status = result.c3Km2s2 < 20 ? 'nominal' : result.c3Km2s2 < 50 ? 'warning' : 'critical'

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MetricCard
          label="C3"
          value={result.c3Km2s2.toFixed(1)}
          unit="km²/s²"
          status={c3Status}
        />
        <MetricCard
          label="Departure ΔV"
          value={result.departureDeltaVms.toFixed(0)}
          unit="m/s"
          status="nominal"
        />
      </div>

      <SectionHeader title="Transfer">
        <div className="grid grid-cols-2 gap-2">
          <DataReadout
            label="Transfer Time"
            value={result.transferTimeDays.toFixed(0)}
            unit="days"
          />
          <DataReadout
            label="Arrival V∞"
            value={result.arrivalVinfKms.toFixed(2)}
            unit="km/s"
          />
          <DataReadout
            label="Insertion ΔV"
            value={result.arrivalInsertionDeltaVms.toFixed(0)}
            unit="m/s"
          />
          {result.arrivalInsertionDeltaVms > 10000 && params.arrivalOrbitType !== 'elliptical' && (
            <div className="col-span-2 text-[10px] text-amber-400/90 bg-amber-400/10 px-2 py-1.5 rounded">
              Very high insertion ΔV — consider using an elliptical capture orbit to reduce propellant requirements.
            </div>
          )}
          <DataReadout
            label="Total ΔV"
            value={result.totalDeltaVms.toFixed(0)}
            unit="m/s"
          />
        </div>
      </SectionHeader>

      <SectionHeader title={`${planet.name} Data`}>
        <div className="grid grid-cols-2 gap-2">
          <DataReadout
            label="Radius"
            value={planet.radiusKm > 10000 ? (planet.radiusKm / 1000).toFixed(1) + 'k' : planet.radiusKm.toFixed(0)}
            unit="km"
          />
          <DataReadout
            label="Surface Gravity"
            value={result.planetSurfaceGravityMs2.toFixed(2)}
            unit="m/s²"
          />
          <DataReadout
            label="Escape Velocity"
            value={result.planetEscapeVelocityKms.toFixed(2)}
            unit="km/s"
          />
          <DataReadout
            label="Atmosphere"
            value={planet.atmosphereType.charAt(0).toUpperCase() + planet.atmosphereType.slice(1)}
          />
        </div>
      </SectionHeader>

      <SectionHeader title="Communications">
        <div className="grid grid-cols-2 gap-2">
          <DataReadout
            label="Min Distance"
            value={result.commsDistanceAU.toFixed(2)}
            unit="AU"
          />
          <DataReadout
            label="One-Way Delay"
            value={result.commsDelayS > 60
              ? (result.commsDelayS / 60).toFixed(1)
              : result.commsDelayS.toFixed(1)}
            unit={result.commsDelayS > 60 ? 'min' : 's'}
          />
          <DataReadout
            label="Synodic Period"
            value={result.synodicPeriodDays.toFixed(0)}
            unit="days"
          />
        </div>
      </SectionHeader>
    </div>
  )
}
