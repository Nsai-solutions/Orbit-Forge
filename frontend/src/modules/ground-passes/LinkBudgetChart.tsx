import { useMemo, useState } from 'react'
import Plot from 'react-plotly.js'
import { useStore } from '@/stores'
import { computeLinkMarginProfile, getDefaultLinkParams } from '@/lib/link-budget'
import { R_EARTH_EQUATORIAL } from '@/lib/constants'

export default function LinkBudgetChart() {
  const elements = useStore((s) => s.elements)
  const mission = useStore((s) => s.mission)

  const avgAlt = elements.semiMajorAxis - R_EARTH_EQUATORIAL

  const params = useMemo(
    () => getDefaultLinkParams(mission.spacecraft),
    [mission.spacecraft]
  )

  const profile = useMemo(
    () => computeLinkMarginProfile(params, avgAlt),
    [params, avgAlt]
  )

  const elevations = profile.map((p) => p.elevationDeg)
  const margins = profile.map((p) => p.linkMarginDb)
  const ebN0s = profile.map((p) => p.ebN0Db)
  const ranges = profile.map((p) => p.slantRangeKm)

  const darkLayout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { family: 'JetBrains Mono', size: 10, color: '#9CA3AF' },
    margin: { l: 55, r: 55, t: 30, b: 45 },
    legend: {
      font: { size: 9, color: '#9CA3AF' },
      bgcolor: 'transparent',
      orientation: 'h' as const,
      y: 1.12,
    },
  }

  return (
    <div className="flex h-full gap-2">
      {/* Left: Link margin + Eb/N0 vs elevation */}
      <div className="flex-[2] h-full">
        <Plot
          data={[
            {
              x: elevations,
              y: margins,
              type: 'scatter',
              mode: 'lines',
              name: 'Link Margin',
              line: { color: '#3B82F6', width: 2 },
              fill: 'tozeroy',
              fillcolor: 'rgba(59, 130, 246, 0.1)',
            },
            {
              x: elevations,
              y: ebN0s,
              type: 'scatter',
              mode: 'lines',
              name: 'Eb/N0',
              line: { color: '#10B981', width: 2, dash: 'dot' },
              yaxis: 'y2',
            },
          ]}
          layout={{
            ...darkLayout,
            title: { text: 'Link Budget vs Elevation', font: { size: 11, color: '#9CA3AF' } },
            xaxis: {
              title: { text: 'Elevation (\u00B0)', font: { size: 9 } },
              gridcolor: 'rgba(255,255,255,0.05)',
              color: '#6B7280',
              range: [5, 90],
            },
            yaxis: {
              title: { text: 'Link Margin (dB)', font: { size: 9 } },
              gridcolor: 'rgba(255,255,255,0.05)',
              color: '#3B82F6',
              zeroline: true,
              zerolinecolor: 'rgba(239, 68, 68, 0.5)',
              zerolinewidth: 2,
            },
            yaxis2: {
              title: { text: 'Eb/N0 (dB)', font: { size: 9 } },
              overlaying: 'y',
              side: 'right',
              gridcolor: 'transparent',
              color: '#10B981',
            },
            shapes: [
              // 3 dB margin reference line
              {
                type: 'line',
                xref: 'paper',
                x0: 0,
                x1: 1,
                yref: 'y',
                y0: 3,
                y1: 3,
                line: { color: 'rgba(245, 158, 11, 0.5)', width: 1, dash: 'dash' },
              },
            ],
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>

      {/* Right: Slant range vs elevation */}
      <div className="flex-1 h-full">
        <Plot
          data={[
            {
              x: elevations,
              y: ranges,
              type: 'scatter',
              mode: 'lines',
              name: 'Slant Range',
              line: { color: '#8B5CF6', width: 2 },
              fill: 'tozeroy',
              fillcolor: 'rgba(139, 92, 246, 0.1)',
            },
          ]}
          layout={{
            ...darkLayout,
            title: { text: 'Slant Range', font: { size: 11, color: '#9CA3AF' } },
            xaxis: {
              title: { text: 'Elevation (\u00B0)', font: { size: 9 } },
              gridcolor: 'rgba(255,255,255,0.05)',
              color: '#6B7280',
              range: [5, 90],
            },
            yaxis: {
              title: { text: 'Range (km)', font: { size: 9 } },
              gridcolor: 'rgba(255,255,255,0.05)',
              color: '#8B5CF6',
            },
            showlegend: false,
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>
    </div>
  )
}
