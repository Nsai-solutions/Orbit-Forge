import { useMemo } from 'react'
import { useStore } from '@/stores'
import DataReadout from '@/components/ui/DataReadout'
import SectionHeader from '@/components/ui/SectionHeader'
import { predictPasses, computePassMetrics } from '@/lib/pass-prediction'
import LinkBudgetSection from './LinkBudgetSection'

export default function PassDetailsDisplay() {
  const elements = useStore((s) => s.elements)
  const mission = useStore((s) => s.mission)
  const groundStations = useStore((s) => s.groundStations)

  const passes = useMemo(
    () => predictPasses(elements, mission.epoch, groundStations, 1),
    [elements, mission.epoch, groundStations]
  )

  const metrics = useMemo(
    () => computePassMetrics(passes, 1, mission.spacecraft.dataRate),
    [passes, mission.spacecraft.dataRate]
  )

  // Count passes per station
  const stationCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    passes.forEach((p) => {
      counts[p.station] = (counts[p.station] || 0) + 1
    })
    return counts
  }, [passes])

  // Quality distribution
  const qualityDist = useMemo(() => {
    const dist = { A: 0, B: 0, C: 0, D: 0 }
    passes.forEach((p) => { dist[p.quality]++ })
    return dist
  }, [passes])

  return (
    <div className="space-y-3">
      <SectionHeader title="Daily Summary">
        <div className="grid grid-cols-2 gap-2">
          <DataReadout
            label="Total Passes"
            value={passes.length}
          />
          <DataReadout
            label="Daily Contact"
            value={metrics.dailyContactMin.toFixed(1)}
            unit="min"
          />
          <DataReadout
            label="Max Gap"
            value={metrics.maxGapHours.toFixed(1)}
            unit="hrs"
            status={metrics.maxGapHours > 12 ? 'warning' : 'nominal'}
          />
          <DataReadout
            label="Daily Downlink"
            value={metrics.dailyDataMB.toFixed(1)}
            unit="MB"
          />
        </div>
      </SectionHeader>

      <SectionHeader title="Quality Distribution">
        <div className="flex items-center gap-2">
          {(['A', 'B', 'C', 'D'] as const).map((q) => (
            <div key={q} className="flex-1 text-center">
              <div className={`text-lg font-mono font-bold ${
                q === 'A' ? 'text-accent-green' :
                q === 'B' ? 'text-accent-blue' :
                q === 'C' ? 'text-accent-amber' :
                'text-[var(--text-tertiary)]'
              }`}>
                {qualityDist[q]}
              </div>
              <div className="text-[9px] text-[var(--text-tertiary)]">Grade {q}</div>
            </div>
          ))}
        </div>
      </SectionHeader>

      <SectionHeader title="Passes by Station">
        <div className="space-y-1">
          {Object.entries(stationCounts).map(([name, count]) => (
            <div key={name} className="flex items-center justify-between px-2 py-1">
              <span className="text-xs text-[var(--text-primary)] font-mono truncate">{name}</span>
              <span className="text-xs text-accent-cyan font-mono">{count}</span>
            </div>
          ))}
          {Object.keys(stationCounts).length === 0 && (
            <div className="text-[var(--text-tertiary)] text-xs font-mono text-center py-4">
              No active ground stations
            </div>
          )}
        </div>
      </SectionHeader>

      <SectionHeader title="Communication Link">
        <div className="grid grid-cols-2 gap-2">
          <DataReadout
            label="Data Rate"
            value={mission.spacecraft.dataRate}
            unit="kbps"
          />
          <DataReadout
            label="TX Power"
            value={mission.spacecraft.transmitPower}
            unit="W"
          />
          <DataReadout
            label="Antenna Gain"
            value={mission.spacecraft.antennaGain.toFixed(1)}
            unit="dBi"
          />
          <DataReadout
            label="Frequency"
            value={mission.spacecraft.frequencyBand}
          />
        </div>
      </SectionHeader>

      <LinkBudgetSection />
    </div>
  )
}
