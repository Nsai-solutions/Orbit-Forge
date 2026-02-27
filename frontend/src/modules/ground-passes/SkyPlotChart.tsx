import { useMemo, useRef, useState, useEffect } from 'react'
import Plot from 'react-plotly.js'
import { useStore } from '@/stores'
import { predictPasses } from '@/lib/pass-prediction'

const QUALITY_COLORS: Record<string, string> = {
  A: '#10B981',
  B: '#3B82F6',
  C: '#F59E0B',
  D: '#6B7280',
}

export default function SkyPlotChart() {
  const elements = useStore((s) => s.elements)
  const mission = useStore((s) => s.mission)
  const groundStations = useStore((s) => s.groundStations)
  const selectedPassIndex = useStore((s) => s.selectedPassIndex)

  // Compute passes with tracks
  const passes = useMemo(
    () => predictPasses(elements, mission.epoch, groundStations, 3, 10, { recordTrack: true }),
    [elements, mission.epoch, groundStations]
  )

  // Determine which station to show (from selected pass, or first active station)
  const selectedPass = selectedPassIndex != null ? passes[selectedPassIndex] : null
  const focusStation = selectedPass?.station ?? groundStations.find((s) => s.active)?.name

  // Filter passes for the focused station
  const stationPasses = useMemo(
    () => passes.filter((p) => p.station === focusStation && p.track && p.track.length > 0),
    [passes, focusStation]
  )

  // Convert to polar coordinates: r = 90 - elevation, theta = azimuth
  const traces: any[] = useMemo(() => {
    return stationPasses.map((pass, i) => {
      const track = pass.track!
      const r = track.map((pt) => 90 - pt.elevation)
      const theta = track.map((pt) => pt.azimuth)

      return {
        type: 'scatterpolar',
        mode: 'lines+markers',
        r,
        theta,
        name: `${pass.aos.toISOString().slice(5, 16).replace('T', ' ')} (${pass.quality})`,
        line: {
          color: QUALITY_COLORS[pass.quality],
          width: selectedPassIndex === passes.indexOf(pass) ? 4 : 2,
        },
        marker: {
          size: 2,
          color: QUALITY_COLORS[pass.quality],
        },
        text: track.map((pt) =>
          `Az: ${pt.azimuth.toFixed(1)}\u00B0<br>El: ${pt.elevation.toFixed(1)}\u00B0<br>T+${pt.timeSec}s`
        ),
        hoverinfo: 'text',
        showlegend: stationPasses.length <= 10,
      }
    })
  }, [stationPasses, selectedPassIndex, passes])

  // Add AOS/LOS markers
  const markerTraces: any[] = useMemo(() => {
    const aosR: number[] = []
    const aosTheta: number[] = []
    const aosText: string[] = []
    const losR: number[] = []
    const losTheta: number[] = []
    const losText: string[] = []

    stationPasses.forEach((pass) => {
      const track = pass.track!
      if (track.length > 0) {
        aosR.push(90 - track[0].elevation)
        aosTheta.push(track[0].azimuth)
        aosText.push(`AOS ${pass.aos.toISOString().slice(11, 19)}`)
        losR.push(90 - track[track.length - 1].elevation)
        losTheta.push(track[track.length - 1].azimuth)
        losText.push(`LOS ${pass.los.toISOString().slice(11, 19)}`)
      }
    })

    return [
      {
        type: 'scatterpolar',
        mode: 'markers',
        r: aosR,
        theta: aosTheta,
        marker: { size: 6, color: '#10B981', symbol: 'triangle-up' },
        text: aosText,
        hoverinfo: 'text',
        name: 'AOS',
        showlegend: false,
      },
      {
        type: 'scatterpolar',
        mode: 'markers',
        r: losR,
        theta: losTheta,
        marker: { size: 6, color: '#EF4444', symbol: 'triangle-down' },
        text: losText,
        hoverinfo: 'text',
        name: 'LOS',
        showlegend: false,
      },
    ]
  }, [stationPasses])

  // Measure container to compute a square size
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 400, h: 400 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const side = Math.min(size.w, size.h)

  return (
    <div ref={containerRef} className="h-full w-full flex items-center justify-center overflow-hidden">
      <Plot
        data={[...traces, ...markerTraces]}
        layout={{
          width: side,
          height: side,
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          font: { family: 'JetBrains Mono', size: 9, color: '#9CA3AF' },
          margin: { l: 20, r: 20, t: 30, b: 20 },
          showlegend: false,
          title: {
            text: focusStation ? `Sky Plot — ${focusStation}` : 'Sky Plot',
            font: { size: 11, color: '#9CA3AF' },
          },
          polar: {
            bgcolor: 'transparent',
            domain: { x: [0, 1], y: [0, 1] },
            radialaxis: {
              range: [0, 90],
              tickvals: [0, 30, 60, 90],
              ticktext: ['90°', '60°', '30°', '0°'],
              gridcolor: 'rgba(255,255,255,0.08)',
              linecolor: 'rgba(255,255,255,0.1)',
              tickfont: { size: 8, color: '#6B7280' },
            },
            angularaxis: {
              direction: 'clockwise',
              rotation: 90,
              tickvals: [0, 45, 90, 135, 180, 225, 270, 315],
              ticktext: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
              gridcolor: 'rgba(255,255,255,0.08)',
              linecolor: 'rgba(255,255,255,0.1)',
              tickfont: { size: 9, color: '#6B7280' },
            },
          },
        }}
        config={{ displayModeBar: false, responsive: false }}
        style={{ width: side, height: side }}
      />
    </div>
  )
}
