import { useMemo } from 'react'
import Plot from 'react-plotly.js'
import { useStore } from '@/stores'
import { computeDeltaVBudget } from '@/lib/delta-v'
import { R_EARTH_EQUATORIAL } from '@/lib/constants'
import { computeBallisticCoefficient } from '@/lib/orbital-lifetime'

export default function DeltaVChart() {
  const elements = useStore((s) => s.elements)
  const mission = useStore((s) => s.mission)
  const propulsion = useStore((s) => s.propulsion)
  const maneuvers = useStore((s) => s.maneuvers)

  const avgAlt = elements.semiMajorAxis - R_EARTH_EQUATORIAL
  const dryMass = mission.spacecraft.mass
  const crossSection = mission.spacecraft.crossSectionArea
  const bStar = computeBallisticCoefficient(dryMass, crossSection, mission.spacecraft.dragCoefficient)

  const budget = useMemo(
    () => computeDeltaVBudget(propulsion, maneuvers, dryMass, avgAlt, mission.lifetimeTarget, bStar),
    [propulsion, maneuvers, dryMass, avgAlt, mission.lifetimeTarget, bStar]
  )

  const darkLayout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { family: 'JetBrains Mono', size: 10, color: '#9CA3AF' },
    margin: { l: 50, r: 50, t: 30, b: 40 },
    legend: {
      font: { size: 9, color: '#9CA3AF' },
      bgcolor: 'transparent',
      orientation: 'h' as const,
      y: 1.12,
    },
  }

  // Stacked bar chart — each maneuver as a colored segment
  const barColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899']
  const breakdown = budget.maneuverBreakdown

  const barTraces: any[] = breakdown.map((m, i) => ({
    x: ['Required ΔV'],
    y: [m.deltaV],
    type: 'bar',
    name: m.name,
    marker: { color: barColors[i % barColors.length] },
    text: [`${m.deltaV.toFixed(1)} m/s`],
    textposition: m.deltaV > budget.totalRequiredDeltaV * 0.08 ? 'inside' : 'none',
    textfont: { size: 9, color: '#F9FAFB' },
    hovertemplate: `${m.name}: %{y:.1f} m/s<extra></extra>`,
  }))

  // Available ΔV as reference bar
  barTraces.push({
    x: ['Available ΔV'],
    y: [budget.availableDeltaV],
    type: 'bar',
    name: 'Available',
    marker: { color: budget.marginDeltaV >= 0 ? '#10B981' : '#EF4444' },
    text: [`${budget.availableDeltaV.toFixed(1)} m/s`],
    textposition: 'inside',
    textfont: { size: 9, color: '#F9FAFB' },
    hovertemplate: `Available: %{y:.1f} m/s<extra></extra>`,
  })

  // Propellant waterfall chart
  let remaining = propulsion.propellantMass
  const waterfallX: string[] = ['Initial']
  const waterfallY: number[] = [remaining]
  const waterfallColors: string[] = ['#3B82F6']

  for (const m of breakdown) {
    remaining = Math.max(0, remaining - m.propellantKg)
    waterfallX.push(m.name.length > 12 ? m.name.slice(0, 12) + '...' : m.name)
    waterfallY.push(remaining)
    waterfallColors.push(remaining > 0 ? '#F59E0B' : '#EF4444')
  }

  const waterfallTrace: any = {
    x: waterfallX,
    y: waterfallY,
    type: 'bar',
    name: 'Propellant',
    marker: { color: waterfallColors },
    text: waterfallY.map((v) => `${v.toFixed(3)} kg`),
    textposition: 'outside',
    textfont: { size: 8, color: '#9CA3AF' },
    hovertemplate: `%{x}: %{y:.3f} kg<extra></extra>`,
    showlegend: false,
  }

  if (propulsion.type === 'none') {
    return (
      <div className="flex items-center justify-center h-full text-[11px] text-[var(--text-tertiary)] italic">
        Configure a propulsion system to see ΔV charts
      </div>
    )
  }

  return (
    <div className="flex h-full gap-2">
      <div className="flex-1 h-full">
        <Plot
          data={barTraces}
          layout={{
            ...darkLayout,
            title: { text: 'ΔV Budget', font: { size: 11, color: '#9CA3AF' } },
            barmode: 'stack',
            xaxis: { gridcolor: 'rgba(255,255,255,0.05)', color: '#6B7280' },
            yaxis: {
              title: { text: 'ΔV (m/s)', font: { size: 9 } },
              gridcolor: 'rgba(255,255,255,0.05)',
              color: '#6B7280',
            },
            showlegend: true,
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>

      <div className="flex-1 h-full">
        <Plot
          data={[waterfallTrace]}
          layout={{
            ...darkLayout,
            title: { text: 'Propellant Remaining', font: { size: 11, color: '#9CA3AF' } },
            xaxis: {
              gridcolor: 'rgba(255,255,255,0.05)',
              color: '#6B7280',
              tickangle: -30,
              tickfont: { size: 8 },
            },
            yaxis: {
              title: { text: 'Mass (kg)', font: { size: 9 } },
              gridcolor: 'rgba(255,255,255,0.05)',
              color: '#6B7280',
              rangemode: 'tozero',
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
