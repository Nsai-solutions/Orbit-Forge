import { useMemo } from 'react'
import Plot from 'react-plotly.js'
import { useStore } from '@/stores'
import { predictPasses, enrichPassesWithLinkBudget } from '@/lib/pass-prediction'
import { computeImagingOpportunities, computeStorageTimeline } from '@/lib/eo-imaging'
import { R_EARTH_EQUATORIAL } from '@/lib/constants'

export default function EOPlanningChart() {
  const elements = useStore((s) => s.elements)
  const mission = useStore((s) => s.mission)
  const groundStations = useStore((s) => s.groundStations)
  const commConfig = useStore((s) => s.commConfig)
  const payloadType = useStore((s) => s.payloadType)
  const payloadEO = useStore((s) => s.payloadEO)
  const payloadShared = useStore((s) => s.payloadShared)
  const eoTargets = useStore((s) => s.eoTargets)

  const avgAlt = elements.semiMajorAxis - R_EARTH_EQUATORIAL
  const incDeg = elements.inclination

  const passes = useMemo(
    () => predictPasses(elements, mission.epoch, groundStations, 3),
    [elements, mission.epoch, groundStations],
  )

  const enrichedPasses = useMemo(
    () => enrichPassesWithLinkBudget(passes, commConfig, avgAlt),
    [passes, commConfig, avgAlt],
  )

  const isEO = payloadType === 'earth-observation' && eoTargets.length > 0

  const imagingOpps = useMemo(() => {
    if (!isEO) return []
    return computeImagingOpportunities(
      elements, mission.epoch, eoTargets, payloadEO, payloadShared, avgAlt, incDeg, 3,
    )
  }, [isEO, elements, mission.epoch, eoTargets, payloadEO, payloadShared, avgAlt, incDeg])

  const timeline = useMemo(() => {
    if (!isEO || imagingOpps.length === 0) return []
    return computeStorageTimeline(imagingOpps, enrichedPasses, payloadShared.storageCapacity)
  }, [isEO, imagingOpps, enrichedPasses, payloadShared.storageCapacity])

  if (!isEO) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-tertiary)] text-xs font-mono">
        Select Earth Observation payload type and add targets to see EO planning timeline
      </div>
    )
  }

  if (imagingOpps.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-tertiary)] text-xs font-mono">
        No imaging opportunities found. Add targets closer to the ground track.
      </div>
    )
  }

  const capGB = payloadShared.storageCapacity
  const viableOpps = imagingOpps.filter((o) => o.viable)

  // Storage sawtooth trace
  const storageTrace = {
    type: 'scatter' as const,
    mode: 'lines' as const,
    name: 'Storage Level',
    x: timeline.map((e) => e.time.toISOString()),
    y: timeline.map((e) => e.cumulativeMB / 1024), // convert to GB
    line: { color: '#F59E0B', width: 2 },
    hovertemplate: '%{y:.2f} GB<br>%{x|%m-%d %H:%M}<extra></extra>',
  }

  // Capacity limit line
  const capLine = {
    type: 'scatter' as const,
    mode: 'lines' as const,
    name: `Capacity (${capGB} GB)`,
    x: timeline.length > 0
      ? [timeline[0].time.toISOString(), timeline[timeline.length - 1].time.toISOString()]
      : [],
    y: [capGB, capGB],
    line: { color: '#EF4444', width: 1.5, dash: 'dash' as const },
    hoverinfo: 'skip' as const,
  }

  // Imaging markers (green triangles on top)
  const imgTrace = {
    type: 'scatter' as const,
    mode: 'markers' as const,
    name: 'Imaging',
    x: viableOpps.map((o) => o.startTime.toISOString()),
    y: viableOpps.map(() => capGB * 1.05),
    marker: { color: '#10B981', symbol: 'triangle-down', size: 7 },
    text: viableOpps.map(
      (o) => `${o.targetName}<br>${o.startTime.toISOString().slice(11, 16)} UTC<br>GSD: ${o.gsdAtTarget.toFixed(1)}m<br>Off-nadir: ${o.offNadirDeg.toFixed(1)}°`,
    ),
    hoverinfo: 'text' as const,
  }

  // Downlink markers (blue triangles on bottom)
  const dlPasses = enrichedPasses.filter((p) => p.dataVolumeMB && p.dataVolumeMB > 0)
  const dlTrace = {
    type: 'scatter' as const,
    mode: 'markers' as const,
    name: 'Downlink',
    x: dlPasses.map((p) => p.aos.toISOString()),
    y: dlPasses.map(() => -capGB * 0.05),
    marker: { color: '#3B82F6', symbol: 'triangle-up', size: 7 },
    text: dlPasses.map(
      (p) => `${p.station}<br>${p.aos.toISOString().slice(11, 16)} UTC<br>${(p.dataVolumeMB! / 1024).toFixed(2)} GB<br>${Math.round(p.durationSec / 60)} min`,
    ),
    hoverinfo: 'text' as const,
  }

  return (
    <div className="w-full h-full">
      <Plot
        data={[storageTrace, capLine, imgTrace, dlTrace]}
        layout={{
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          font: { family: 'JetBrains Mono, monospace', size: 10, color: '#9CA3AF' },
          margin: { l: 55, r: 30, t: 30, b: 45 },
          xaxis: {
            title: { text: 'Time (UTC)', font: { size: 9 } },
            gridcolor: 'rgba(255,255,255,0.05)',
            tickformat: '%m-%d %H:%M',
            tickfont: { size: 8 },
          },
          yaxis: {
            title: { text: 'Storage (GB)', font: { size: 9 } },
            gridcolor: 'rgba(255,255,255,0.05)',
            zeroline: false,
            tickfont: { size: 8 },
            rangemode: 'tozero',
          },
          legend: {
            font: { size: 9, color: '#9CA3AF' },
            bgcolor: 'transparent',
            orientation: 'h' as const,
            y: 1.12,
          },
          showlegend: true,
        }}
        config={{ displayModeBar: false, responsive: true }}
        useResizeHandler
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  )
}
