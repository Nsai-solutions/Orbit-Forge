import { useMemo, useState } from 'react'
import Plot from 'react-plotly.js'
import { useStore } from '@/stores'
import {
  computeBallisticCoefficient,
  simulateDecay,
  type SolarActivity,
} from '@/lib/orbital-lifetime'

export default function DecayCurveChart() {
  const elements = useStore((s) => s.elements)
  const mission = useStore((s) => s.mission)

  const avgAlt = elements.semiMajorAxis - 6378.137
  const crossSection = mission.spacecraft.crossSectionArea
  const cd = mission.spacecraft.dragCoefficient
  const bStar = computeBallisticCoefficient(mission.spacecraft.mass, crossSection, cd)

  // Simulate decay for all three solar activity levels
  const decayData = useMemo(() => {
    const activities: SolarActivity[] = ['low', 'moderate', 'high']
    return activities.map((activity) => ({
      activity,
      data: simulateDecay(avgAlt, bStar, activity, 30, 1),
    }))
  }, [avgAlt, bStar])

  const traces: any[] = decayData.map(({ activity, data }) => {
    const colors: Record<SolarActivity, string> = {
      low: '#10B981',
      moderate: '#3B82F6',
      high: '#EF4444',
    }
    return {
      x: data.map((d) => d.days / 365.25),
      y: data.map((d) => d.altitude),
      type: 'scatter',
      mode: 'lines',
      name: `${activity.charAt(0).toUpperCase() + activity.slice(1)} solar`,
      line: { color: colors[activity], width: 2 },
    }
  })

  // Add horizontal lines for compliance thresholds
  const maxYears = Math.max(
    ...decayData.map(({ data }) => data[data.length - 1].days / 365.25),
    5
  )

  // Parametric study: altitude vs lifetime for moderate solar activity
  const parametricTrace: any = useMemo(() => {
    const altitudes = []
    const lifetimes = []
    for (let alt = 200; alt <= 800; alt += 25) {
      const decay = simulateDecay(alt, bStar, 'moderate', 50, 5)
      const last = decay[decay.length - 1]
      altitudes.push(alt)
      lifetimes.push(last.altitude <= 80 ? last.days / 365.25 : 50)
    }
    return {
      x: lifetimes,
      y: altitudes,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Lifetime vs Altitude',
      line: { color: '#8B5CF6', width: 2 },
      marker: { size: 4, color: '#8B5CF6' },
    }
  }, [bStar])

  const darkLayout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { family: 'JetBrains Mono', size: 10, color: '#9CA3AF' },
    margin: { l: 60, r: 20, t: 30, b: 40 },
    legend: {
      font: { size: 9, color: '#9CA3AF' },
      bgcolor: 'transparent',
      orientation: 'h' as const,
      y: 1.12,
    },
  }

  return (
    <div className="flex h-full gap-2">
      {/* Decay curve */}
      <div className="flex-[2] h-full">
        <Plot
          data={traces}
          layout={{
            ...darkLayout,
            title: { text: 'Orbital Decay Curve', font: { size: 11, color: '#9CA3AF' } },
            xaxis: {
              title: { text: 'Time (years)', font: { size: 9 } },
              gridcolor: 'rgba(255,255,255,0.05)',
              color: '#6B7280',
            },
            yaxis: {
              title: { text: 'Altitude (km)', font: { size: 9 } },
              gridcolor: 'rgba(255,255,255,0.05)',
              color: '#6B7280',
              range: [0, avgAlt * 1.1],
            },
            shapes: [
              // 5-year line
              {
                type: 'line',
                x0: 5, x1: 5,
                y0: 0, y1: avgAlt * 1.1,
                line: { color: 'rgba(245, 158, 11, 0.5)', width: 1, dash: 'dash' },
              },
              // 25-year line
              {
                type: 'line',
                x0: 25, x1: 25,
                y0: 0, y1: avgAlt * 1.1,
                line: { color: 'rgba(239, 68, 68, 0.5)', width: 1, dash: 'dash' },
              },
            ],
            annotations: [
              {
                x: 5, y: avgAlt * 1.05,
                text: 'FCC 5yr',
                showarrow: false,
                font: { size: 8, color: '#F59E0B' },
              },
              {
                x: 25, y: avgAlt * 1.05,
                text: 'IADC 25yr',
                showarrow: false,
                font: { size: 8, color: '#EF4444' },
              },
            ],
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>

      {/* Parametric study */}
      <div className="flex-1 h-full">
        <Plot
          data={[parametricTrace]}
          layout={{
            ...darkLayout,
            title: { text: 'Lifetime vs Initial Alt.', font: { size: 11, color: '#9CA3AF' } },
            xaxis: {
              title: { text: 'Lifetime (years)', font: { size: 9 } },
              gridcolor: 'rgba(255,255,255,0.05)',
              color: '#6B7280',
              type: 'log',
            },
            yaxis: {
              title: { text: 'Altitude (km)', font: { size: 9 } },
              gridcolor: 'rgba(255,255,255,0.05)',
              color: '#6B7280',
            },
            shapes: [
              // Current altitude marker
              {
                type: 'line',
                x0: 0, x1: 50,
                y0: avgAlt, y1: avgAlt,
                line: { color: 'rgba(6, 182, 212, 0.4)', width: 1, dash: 'dot' },
              },
            ],
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
