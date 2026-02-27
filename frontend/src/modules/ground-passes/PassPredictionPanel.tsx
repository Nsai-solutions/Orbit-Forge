import { useState, useMemo, useCallback } from 'react'
import { useStore } from '@/stores'
import SectionHeader from '@/components/ui/SectionHeader'
import MetricCard from '@/components/ui/MetricCard'
import ExportCSVButton from '@/components/ui/ExportCSVButton'
import { predictPasses, enrichPassesWithLinkBudget, computePassMetrics } from '@/lib/pass-prediction'
import { exportCSV } from '@/lib/csv-export'
import { R_EARTH_EQUATORIAL } from '@/lib/constants'
import CommConfigSection from './CommConfigSection'

type SortField = 'time' | 'duration' | 'elevation' | 'margin' | 'data'
type SortDir = 'asc' | 'desc'

export default function PassPredictionPanel() {
  const elements = useStore((s) => s.elements)
  const mission = useStore((s) => s.mission)
  const groundStations = useStore((s) => s.groundStations)
  const commConfig = useStore((s) => s.commConfig)
  const selectedPassIndex = useStore((s) => s.selectedPassIndex)
  const setSelectedPassIndex = useStore((s) => s.setSelectedPassIndex)

  const [durationDays, setDurationDays] = useState(3)
  const [minQuality, setMinQuality] = useState<'A' | 'B' | 'C' | 'D'>('D')
  const [stationFilter, setStationFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('time')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const avgAlt = elements.semiMajorAxis - R_EARTH_EQUATORIAL

  const passes = useMemo(
    () => predictPasses(elements, mission.epoch, groundStations, durationDays),
    [elements, mission.epoch, groundStations, durationDays]
  )

  // Enrich with link budget data
  const enrichedPasses = useMemo(
    () => enrichPassesWithLinkBudget(passes, commConfig, avgAlt),
    [passes, commConfig, avgAlt]
  )

  // Get unique stations for filter
  const stationNames = useMemo(
    () => [...new Set(passes.map((p) => p.station))].sort(),
    [passes]
  )

  const filteredPasses = useMemo(() => {
    const qualityOrder = ['A', 'B', 'C', 'D']
    const minIdx = qualityOrder.indexOf(minQuality)
    return enrichedPasses
      .filter((p) => qualityOrder.indexOf(p.quality) <= minIdx)
      .filter((p) => stationFilter === 'all' || p.station === stationFilter)
  }, [enrichedPasses, minQuality, stationFilter])

  // Sort
  const sortedPasses = useMemo(() => {
    const sorted = [...filteredPasses]
    sorted.sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'time': cmp = a.aos.getTime() - b.aos.getTime(); break
        case 'duration': cmp = a.durationSec - b.durationSec; break
        case 'elevation': cmp = a.maxElevation - b.maxElevation; break
        case 'margin': cmp = (a.linkMarginDb ?? -999) - (b.linkMarginDb ?? -999); break
        case 'data': cmp = (a.dataVolumeMB ?? 0) - (b.dataVolumeMB ?? 0); break
      }
      return sortDir === 'desc' ? -cmp : cmp
    })
    return sorted
  }, [filteredPasses, sortField, sortDir])

  const metrics = useMemo(
    () => computePassMetrics(filteredPasses, durationDays, commConfig.dataRateKbps),
    [filteredPasses, durationDays, commConfig.dataRateKbps]
  )

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir(field === 'time' ? 'asc' : 'desc')
    }
  }, [sortField])

  const formatDataRate = (kbps: number) => {
    if (kbps >= 1000) return `${(kbps / 1000).toFixed(0)} Mbps`
    return `${kbps.toFixed(1)} kbps`
  }

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
          <label className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-secondary)]">Station</span>
            <select
              value={stationFilter}
              onChange={(e) => setStationFilter(e.target.value)}
              className="input-field w-24 text-[10px] text-center"
            >
              <option value="all">All</option>
              {stationNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
        </div>
      </SectionHeader>

      <CommConfigSection />

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
            label="Daily Downlink"
            value={metrics.dailyDataMB >= 1024
              ? `${(metrics.dailyDataMB / 1024).toFixed(1)}`
              : metrics.dailyDataMB.toFixed(1)}
            unit={metrics.dailyDataMB >= 1024 ? 'GB' : 'MB'}
            status="nominal"
          />
          <MetricCard
            label="Contact Time"
            value={metrics.totalContactMin.toFixed(1)}
            unit="min"
            status="nominal"
          />
          <MetricCard
            label="Total Passes"
            value={metrics.totalPasses}
            status="nominal"
          />
        </div>
      </SectionHeader>

      <SectionHeader title={`Passes (${sortedPasses.length})`} actions={
        <ExportCSVButton onClick={() => {
          exportCSV(
            `${mission.name.replace(/\s+/g, '_')}_passes_${durationDays}d`,
            ['Station', 'AOS (UTC)', 'LOS (UTC)', 'Duration (min)', 'Max Elevation (deg)', 'AOS Azimuth (deg)', 'LOS Azimuth (deg)', 'Quality', 'Link Margin (dB)', 'Data Volume (MB)', 'Max Data Rate (kbps)'],
            sortedPasses.map(p => [
              p.station,
              p.aos.toISOString(),
              p.los.toISOString(),
              (p.durationSec / 60).toFixed(1),
              p.maxElevation.toFixed(1),
              p.aosAzimuth.toFixed(1),
              p.losAzimuth.toFixed(1),
              p.quality,
              p.linkMarginDb?.toFixed(1) ?? 'N/A',
              p.dataVolumeMB?.toFixed(2) ?? 'N/A',
              p.maxDataRateKbps?.toFixed(1) ?? 'N/A',
            ])
          )
        }} />
      }>
        {/* Sort controls */}
        <div className="flex items-center gap-1 mb-1 flex-wrap">
          {([
            ['time', 'Time'],
            ['duration', 'Dur'],
            ['elevation', 'El'],
            ['margin', 'Margin'],
            ['data', 'Data'],
          ] as [SortField, string][]).map(([field, label]) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`px-1.5 py-0.5 rounded text-[8px] font-mono transition-all border ${
                sortField === field
                  ? 'bg-accent-blue/15 text-accent-blue border-accent-blue/30'
                  : 'text-[var(--text-tertiary)] border-transparent hover:bg-white/5'
              }`}
            >
              {label} {sortField === field ? (sortDir === 'asc' ? '\u2191' : '\u2193') : ''}
            </button>
          ))}
        </div>

        <div className="space-y-0.5 max-h-72 overflow-y-auto">
          {sortedPasses.length === 0 ? (
            <div className="text-[var(--text-tertiary)] text-xs font-mono text-center py-4">
              No passes found. Ensure ground stations are active.
            </div>
          ) : (
            sortedPasses.map((pass, i) => {
              const globalIdx = enrichedPasses.indexOf(pass)
              const isSelected = selectedPassIndex === globalIdx
              const rowBg = isSelected
                ? 'bg-accent-blue/10 border border-accent-blue/30'
                : pass.marginStatus === 'critical'
                ? 'hover:bg-red-500/5'
                : pass.quality <= 'B'
                ? 'hover:bg-white/5'
                : 'hover:bg-white/5'

              return (
                <div
                  key={i}
                  onClick={() => setSelectedPassIndex(isSelected ? null : globalIdx)}
                  className={`px-2 py-1.5 rounded cursor-pointer transition-colors ${rowBg}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--text-primary)] font-mono truncate max-w-[100px]">{pass.station}</span>
                    <div className="flex items-center gap-1.5">
                      {pass.linkMarginDb != null && (
                        <span className={`text-[8px] font-mono px-1 py-0.5 rounded ${
                          pass.marginStatus === 'nominal' ? 'text-accent-green bg-accent-green/10' :
                          pass.marginStatus === 'warning' ? 'text-accent-amber bg-accent-amber/10' :
                          'text-accent-red bg-accent-red/10'
                        }`}>
                          {pass.linkMarginDb.toFixed(1)}dB
                        </span>
                      )}
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        pass.quality === 'A' ? 'bg-accent-green/20 text-accent-green' :
                        pass.quality === 'B' ? 'bg-accent-blue/20 text-accent-blue' :
                        pass.quality === 'C' ? 'bg-accent-amber/20 text-accent-amber' :
                        'bg-white/10 text-[var(--text-tertiary)]'
                      }`}>
                        {pass.quality}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[9px] text-[var(--text-tertiary)] font-mono">
                    <span>{pass.aos.toISOString().slice(5, 16).replace('T', ' ')}</span>
                    <span>{Math.round(pass.durationSec / 60)}m</span>
                    <span className="text-accent-cyan">{pass.maxElevation.toFixed(1)}&deg;</span>
                    {pass.dataVolumeMB != null && pass.dataVolumeMB > 0 && (
                      <span className="text-accent-amber">
                        {pass.dataVolumeMB >= 1 ? `${pass.dataVolumeMB.toFixed(1)}MB` : `${(pass.dataVolumeMB * 1024).toFixed(0)}KB`}
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </SectionHeader>
    </div>
  )
}
