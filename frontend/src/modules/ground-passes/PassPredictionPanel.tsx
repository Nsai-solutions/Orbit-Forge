import { useState, useMemo } from 'react'
import { useStore } from '@/stores'
import SectionHeader from '@/components/ui/SectionHeader'
import MetricCard from '@/components/ui/MetricCard'
import ExportCSVButton from '@/components/ui/ExportCSVButton'
import { predictPasses, computePassMetrics } from '@/lib/pass-prediction'
import { exportCSV } from '@/lib/csv-export'

export default function PassPredictionPanel() {
  const elements = useStore((s) => s.elements)
  const mission = useStore((s) => s.mission)
  const groundStations = useStore((s) => s.groundStations)

  const [durationDays, setDurationDays] = useState(3)
  const [minQuality, setMinQuality] = useState<'A' | 'B' | 'C' | 'D'>('D')

  const passes = useMemo(
    () => predictPasses(elements, mission.epoch, groundStations, durationDays),
    [elements, mission.epoch, groundStations, durationDays]
  )

  const filteredPasses = useMemo(() => {
    const qualityOrder = ['A', 'B', 'C', 'D']
    const minIdx = qualityOrder.indexOf(minQuality)
    return passes.filter((p) => qualityOrder.indexOf(p.quality) <= minIdx)
  }, [passes, minQuality])

  const metrics = useMemo(
    () => computePassMetrics(filteredPasses, durationDays, mission.spacecraft.dataRate),
    [filteredPasses, durationDays, mission.spacecraft.dataRate]
  )

  return (
    <div className="space-y-2">
      <SectionHeader title="Prediction Settings">
        <div className="space-y-2">
          <label className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-secondary)]">Duration</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={durationDays}
                onChange={(e) => setDurationDays(Math.max(1, Math.min(14, parseInt(e.target.value) || 1)))}
                className="input-field w-16 text-xs text-center"
                min="1"
                max="14"
              />
              <span className="text-[11px] text-[var(--text-secondary)] font-mono">days</span>
            </div>
          </label>
          <label className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-secondary)]">Min Quality</span>
            <select
              value={minQuality}
              onChange={(e) => setMinQuality(e.target.value as 'A' | 'B' | 'C' | 'D')}
              className="input-field w-16 text-xs text-center"
            >
              <option value="A">A only</option>
              <option value="B">B+</option>
              <option value="C">C+</option>
              <option value="D">All</option>
            </select>
          </label>
        </div>
      </SectionHeader>

      <SectionHeader title="Contact Metrics">
        <div className="grid grid-cols-2 gap-2">
          <MetricCard
            label="Passes/Day"
            value={metrics.totalPassesPerDay.toFixed(1)}
            status="nominal"
          />
          <MetricCard
            label="Avg Duration"
            value={metrics.avgPassDurationMin.toFixed(1)}
            unit="min"
            status="nominal"
          />
          <MetricCard
            label="Max Gap"
            value={metrics.maxGapHours.toFixed(1)}
            unit="hrs"
            status={metrics.maxGapHours > 12 ? 'warning' : 'nominal'}
          />
          <MetricCard
            label="Daily Data"
            value={metrics.dailyDataMB.toFixed(1)}
            unit="MB"
            status="nominal"
          />
        </div>
      </SectionHeader>

      <SectionHeader title={`Passes (${filteredPasses.length})`} actions={
        <ExportCSVButton onClick={() => {
          exportCSV(
            `${mission.name.replace(/\s+/g, '_')}_passes_${durationDays}d`,
            ['Station', 'AOS (UTC)', 'LOS (UTC)', 'Duration (min)', 'Max Elevation (deg)', 'AOS Azimuth (deg)', 'LOS Azimuth (deg)', 'Quality'],
            filteredPasses.map(p => [
              p.station,
              p.aos.toISOString(),
              p.los.toISOString(),
              (p.durationSec / 60).toFixed(1),
              p.maxElevation.toFixed(1),
              p.aosAzimuth.toFixed(1),
              p.losAzimuth.toFixed(1),
              p.quality,
            ])
          )
        }} />
      }>
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {filteredPasses.length === 0 ? (
            <div className="text-[var(--text-tertiary)] text-xs font-mono text-center py-4">
              No passes found. Ensure ground stations are active.
            </div>
          ) : (
            filteredPasses.map((pass, i) => (
              <div
                key={i}
                className="px-2 py-1.5 rounded hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-primary)] font-mono">{pass.station}</span>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                    pass.quality === 'A' ? 'bg-accent-green/20 text-accent-green' :
                    pass.quality === 'B' ? 'bg-accent-blue/20 text-accent-blue' :
                    pass.quality === 'C' ? 'bg-accent-amber/20 text-accent-amber' :
                    'bg-white/10 text-[var(--text-tertiary)]'
                  }`}>
                    {pass.quality}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-[9px] text-[var(--text-tertiary)] font-mono">
                  <span>{pass.aos.toISOString().slice(5, 16).replace('T', ' ')}</span>
                  <span>{Math.round(pass.durationSec / 60)}m</span>
                  <span className="text-accent-cyan">{pass.maxElevation.toFixed(1)}&deg;</span>
                </div>
              </div>
            ))
          )}
        </div>
      </SectionHeader>
    </div>
  )
}
