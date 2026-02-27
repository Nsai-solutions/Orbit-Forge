import { useMemo } from 'react'
import Plot from 'react-plotly.js'
import { useStore } from '@/stores'
import { predictPasses, enrichPassesWithLinkBudget, computeContactGaps } from '@/lib/pass-prediction'
import { R_EARTH_EQUATORIAL } from '@/lib/constants'

const STATION_COLORS: Record<string, string> = {}
const COLOR_PALETTE = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#14B8A6',
]

function getStationColor(station: string): string {
  if (!STATION_COLORS[station]) {
    STATION_COLORS[station] = COLOR_PALETTE[Object.keys(STATION_COLORS).length % COLOR_PALETTE.length]
  }
  return STATION_COLORS[station]
}

export default function ContactTimelineChart() {
  const elements = useStore((s) => s.elements)
  const mission = useStore((s) => s.mission)
  const groundStations = useStore((s) => s.groundStations)
  const commConfig = useStore((s) => s.commConfig)

  const avgAlt = elements.semiMajorAxis - R_EARTH_EQUATORIAL

  const passes = useMemo(
    () => predictPasses(elements, mission.epoch, groundStations, 3),
    [elements, mission.epoch, groundStations]
  )

  const enrichedPasses = useMemo(
    () => enrichPassesWithLinkBudget(passes, commConfig, avgAlt),
    [passes, commConfig, avgAlt]
  )

  const gaps = useMemo(
    () => computeContactGaps(enrichedPasses),
    [enrichedPasses]
  )

  // Build horizontal bar chart: each pass is a bar from AOS to LOS
  const traces = useMemo(() => {
    // Contact bars (one shape per pass)
    const shapes: any[] = []
    const annotations: any[] = []

    enrichedPasses.forEach((pass) => {
      const color = getStationColor(pass.station)
      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'paper',
        x0: pass.aos.toISOString(),
        x1: pass.los.toISOString(),
        y0: 0.1,
        y1: 0.9,
        fillcolor: color,
        opacity: 0.6,
        line: { color, width: 1 },
      })
    })

    // Mark the longest gap with a red region
    const longestGap = gaps.find((g) => g.isLongest)
    if (longestGap) {
      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'paper',
        x0: longestGap.start.toISOString(),
        x1: longestGap.end.toISOString(),
        y0: 0,
        y1: 1,
        fillcolor: 'rgba(239, 68, 68, 0.1)',
        line: { color: 'rgba(239, 68, 68, 0.5)', width: 1, dash: 'dot' },
      })
      annotations.push({
        x: new Date((longestGap.start.getTime() + longestGap.end.getTime()) / 2).toISOString(),
        y: 1,
        yref: 'paper',
        text: `Max Gap: ${longestGap.durationHours.toFixed(1)}h`,
        showarrow: false,
        font: { size: 9, color: '#EF4444', family: 'JetBrains Mono' },
        yanchor: 'bottom',
      })
    }

    // Create scatter traces for legend and hover
    const stationNames = [...new Set(enrichedPasses.map((p) => p.station))]
    const scatterTraces = stationNames.map((station) => {
      const stationPasses = enrichedPasses.filter((p) => p.station === station)
      return {
        type: 'scatter',
        mode: 'markers',
        name: station,
        x: stationPasses.map((p) => {
          const mid = new Date((p.aos.getTime() + p.los.getTime()) / 2)
          return mid.toISOString()
        }),
        y: stationPasses.map(() => 0.5),
        yaxis: 'y',
        text: stationPasses.map((p) =>
          `${station}<br>` +
          `AOS: ${p.aos.toISOString().slice(11, 19)} UTC<br>` +
          `LOS: ${p.los.toISOString().slice(11, 19)} UTC<br>` +
          `Duration: ${Math.round(p.durationSec / 60)} min<br>` +
          `Max El: ${p.maxElevation.toFixed(1)}\u00B0<br>` +
          `Quality: ${p.quality}` +
          (p.linkMarginDb != null ? `<br>Margin: ${p.linkMarginDb.toFixed(1)} dB` : '')
        ),
        hoverinfo: 'text',
        marker: {
          color: getStationColor(station),
          size: 8,
          symbol: 'square',
        },
      }
    })

    return { scatterTraces, shapes, annotations }
  }, [enrichedPasses, gaps])

  return (
    <div className="h-full w-full">
      <Plot
        data={traces.scatterTraces as any}
        layout={{
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          font: { family: 'JetBrains Mono', size: 10, color: '#9CA3AF' },
          margin: { l: 50, r: 20, t: 30, b: 45 },
          title: { text: 'Contact Timeline', font: { size: 11, color: '#9CA3AF' } },
          showlegend: true,
          legend: {
            font: { size: 9, color: '#9CA3AF' },
            bgcolor: 'transparent',
            orientation: 'h' as const,
            y: 1.15,
          },
          xaxis: {
            type: 'date',
            gridcolor: 'rgba(255,255,255,0.05)',
            color: '#6B7280',
            title: { text: 'Time (UTC)', font: { size: 9 } },
          },
          yaxis: {
            visible: false,
            range: [0, 1],
          },
          shapes: traces.shapes,
          annotations: traces.annotations,
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%', height: '100%' }}
        useResizeHandler
      />
    </div>
  )
}
