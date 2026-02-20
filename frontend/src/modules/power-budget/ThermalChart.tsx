import { useMemo, useState } from 'react'
import Plot from 'react-plotly.js'
import { useStore } from '@/stores'
import { R_EARTH_EQUATORIAL } from '@/lib/constants'
import { totalAvgPowerDraw } from '@/lib/power-budget'
import {
  SURFACE_MATERIALS,
  DEFAULT_MATERIAL,
  computeThermalProfile,
} from '@/lib/thermal-analysis'

export default function ThermalChart() {
  const elements = useStore((s) => s.elements)
  const derivedParams = useStore((s) => s.derivedParams)
  const mission = useStore((s) => s.mission)
  const subsystems = useStore((s) => s.subsystems)

  const [materialId] = useState(DEFAULT_MATERIAL)
  const material = SURFACE_MATERIALS[materialId]

  const avgAlt = elements.semiMajorAxis - R_EARTH_EQUATORIAL
  const eclipseFraction = derivedParams?.eclipseFraction ?? 0.35
  const internalPower = totalAvgPowerDraw(subsystems)

  const profile = useMemo(
    () => computeThermalProfile(
      material, avgAlt, eclipseFraction, internalPower,
      mission.spacecraft.size, mission.spacecraft.mass
    ),
    [material, avgAlt, eclipseFraction, internalPower, mission.spacecraft.size, mission.spacecraft.mass]
  )

  const positions = profile.map((p) => p.positionDeg)
  const temps = profile.map((p) => p.temperatureC)
  const solarFlux = profile.map((p) => p.solarFluxW)
  const earthIr = profile.map((p) => p.earthIrFluxW)
  const albedo = profile.map((p) => p.albedoFluxW)

  // Eclipse shading
  const eclipseShapes = useMemo(() => {
    const shapes: any[] = []
    let inEclipse = false
    let eclipseStart = 0

    for (let i = 0; i < profile.length; i++) {
      if (!profile[i].inSunlight && !inEclipse) {
        eclipseStart = profile[i].positionDeg
        inEclipse = true
      } else if (profile[i].inSunlight && inEclipse) {
        shapes.push({
          type: 'rect',
          xref: 'x',
          yref: 'paper',
          x0: eclipseStart,
          x1: profile[i].positionDeg,
          y0: 0,
          y1: 1,
          fillcolor: 'rgba(107, 114, 128, 0.15)',
          line: { width: 0 },
          layer: 'below',
        })
        inEclipse = false
      }
    }
    if (inEclipse) {
      shapes.push({
        type: 'rect',
        xref: 'x',
        yref: 'paper',
        x0: eclipseStart,
        x1: 360,
        y0: 0,
        y1: 1,
        fillcolor: 'rgba(107, 114, 128, 0.15)',
        line: { width: 0 },
        layer: 'below',
      })
    }
    return shapes
  }, [profile])

  const darkLayout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { family: 'JetBrains Mono', size: 10, color: '#9CA3AF' },
    margin: { l: 55, r: 20, t: 30, b: 45 },
    legend: {
      font: { size: 9, color: '#9CA3AF' },
      bgcolor: 'transparent',
      orientation: 'h' as const,
      y: 1.12,
    },
  }

  return (
    <div className="flex h-full gap-2">
      {/* Left: Temperature vs orbital position */}
      <div className="flex-[2] h-full">
        <Plot
          data={[
            {
              x: positions,
              y: temps,
              type: 'scatter',
              mode: 'lines',
              name: 'Temperature',
              line: { color: '#EF4444', width: 2 },
            },
          ]}
          layout={{
            ...darkLayout,
            title: { text: 'Thermal Profile \u2014 1 Orbit', font: { size: 11, color: '#9CA3AF' } },
            xaxis: {
              title: { text: 'Orbital Position (\u00B0)', font: { size: 9 } },
              gridcolor: 'rgba(255,255,255,0.05)',
              color: '#6B7280',
              range: [0, 360],
              dtick: 60,
            },
            yaxis: {
              title: { text: 'Temperature (\u00B0C)', font: { size: 9 } },
              gridcolor: 'rgba(255,255,255,0.05)',
              color: '#EF4444',
            },
            shapes: [
              ...eclipseShapes,
              // Operating limits
              {
                type: 'line',
                xref: 'paper',
                x0: 0, x1: 1,
                yref: 'y',
                y0: 50, y1: 50,
                line: { color: 'rgba(245, 158, 11, 0.4)', width: 1, dash: 'dash' },
              },
              {
                type: 'line',
                xref: 'paper',
                x0: 0, x1: 1,
                yref: 'y',
                y0: -10, y1: -10,
                line: { color: 'rgba(59, 130, 246, 0.4)', width: 1, dash: 'dash' },
              },
            ],
            annotations: [
              {
                x: 1.01, y: 50, xref: 'paper', yref: 'y',
                text: 'Hot limit', showarrow: false,
                font: { size: 8, color: '#F59E0B' },
                xanchor: 'left',
              },
              {
                x: 1.01, y: -10, xref: 'paper', yref: 'y',
                text: 'Cold limit', showarrow: false,
                font: { size: 8, color: '#3B82F6' },
                xanchor: 'left',
              },
            ],
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>

      {/* Right: Heat flux breakdown */}
      <div className="flex-1 h-full">
        <Plot
          data={[
            {
              x: positions,
              y: solarFlux,
              type: 'scatter',
              mode: 'lines',
              name: 'Solar',
              line: { color: '#F59E0B', width: 1.5 },
              fill: 'tozeroy',
              fillcolor: 'rgba(245, 158, 11, 0.15)',
              stackgroup: 'flux',
            },
            {
              x: positions,
              y: earthIr,
              type: 'scatter',
              mode: 'lines',
              name: 'Earth IR',
              line: { color: '#EF4444', width: 1.5 },
              fill: 'tonexty',
              fillcolor: 'rgba(239, 68, 68, 0.15)',
              stackgroup: 'flux',
            },
            {
              x: positions,
              y: albedo,
              type: 'scatter',
              mode: 'lines',
              name: 'Albedo',
              line: { color: '#3B82F6', width: 1.5 },
              fill: 'tonexty',
              fillcolor: 'rgba(59, 130, 246, 0.15)',
              stackgroup: 'flux',
            },
          ]}
          layout={{
            ...darkLayout,
            title: { text: 'Heat Flux Breakdown', font: { size: 11, color: '#9CA3AF' } },
            xaxis: {
              title: { text: 'Position (\u00B0)', font: { size: 9 } },
              gridcolor: 'rgba(255,255,255,0.05)',
              color: '#6B7280',
              range: [0, 360],
              dtick: 90,
            },
            yaxis: {
              title: { text: 'Heat Flux (W)', font: { size: 9 } },
              gridcolor: 'rgba(255,255,255,0.05)',
              color: '#6B7280',
            },
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
        />
      </div>
    </div>
  )
}
