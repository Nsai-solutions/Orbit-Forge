import { useMemo } from 'react'
import Plot from 'react-plotly.js'
import { useStore } from '@/stores'
import { computeGroundTrack } from '@/lib/orbital-mechanics'

export default function GroundTrackPlot() {
  const elements = useStore((s) => s.elements)
  const orbitEpoch = useStore((s) => s.orbitEpoch)
  const groundStations = useStore((s) => s.groundStations)
  const activeStations = groundStations.filter((gs) => gs.active)

  const traces = useMemo(() => {
    const track = computeGroundTrack(elements, orbitEpoch, 10, 180)

    // Split into segments at antimeridian
    const segments: Array<{ lats: number[]; lons: number[] }> = []
    let seg = { lats: [] as number[], lons: [] as number[] }

    for (let i = 0; i < track.length; i++) {
      if (i > 0 && Math.abs(track[i].lon - track[i - 1].lon) > 180) {
        if (seg.lats.length > 0) segments.push(seg)
        seg = { lats: [], lons: [] }
      }
      seg.lats.push(track[i].lat)
      seg.lons.push(track[i].lon)
    }
    if (seg.lats.length > 0) segments.push(seg)

    const result: any[] = segments.map((s, i) => ({
      type: 'scattergeo',
      lat: s.lats,
      lon: s.lons,
      mode: 'lines',
      line: { color: '#F59E0B', width: 1.5 },
      name: i === 0 ? 'Ground Track' : '',
      showlegend: i === 0,
      hoverinfo: 'lat+lon',
    }))

    // Ground stations
    if (activeStations.length > 0) {
      result.push({
        type: 'scattergeo',
        lat: activeStations.map((gs) => gs.lat),
        lon: activeStations.map((gs) => gs.lon),
        text: activeStations.map((gs) => gs.name),
        mode: 'markers+text',
        marker: { color: '#10B981', size: 8, symbol: 'diamond' },
        textposition: 'top center',
        textfont: { size: 9, color: '#10B981', family: 'JetBrains Mono' },
        name: 'Ground Stations',
        hoverinfo: 'text',
      })
    }

    return result
  }, [elements, activeStations, orbitEpoch])

  // Dynamic satellite marker driven by 3D animation
  const satSubPoint = useStore((s) => s.satSubPoint)
  const satTrace = useMemo(() => {
    if (!satSubPoint) return null
    return {
      type: 'scattergeo' as const,
      lat: [satSubPoint.lat],
      lon: [satSubPoint.lon],
      mode: 'markers' as const,
      marker: { color: '#3B82F6', size: 10, symbol: 'circle' },
      name: 'Satellite',
      hoverinfo: 'lat+lon' as const,
    }
  }, [satSubPoint])

  const allTraces = useMemo(() => {
    const t = [...traces]
    if (satTrace) t.push(satTrace)
    return t
  }, [traces, satTrace])

  return (
    <Plot
      data={allTraces}
      layout={{
        geo: {
          showland: true,
          landcolor: '#1F2937',
          showocean: true,
          oceancolor: '#0F1729',
          showcoastlines: true,
          coastlinecolor: '#374151',
          showlakes: false,
          showcountries: true,
          countrycolor: '#374151',
          bgcolor: 'rgba(0,0,0,0)',
          projection: { type: 'natural earth' as any },
          lataxis: { range: [-90, 90] },
          lonaxis: { range: [-180, 180] },
        },
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: {
          family: 'JetBrains Mono, monospace',
          color: '#6B7280',
          size: 10,
        },
        margin: { l: 0, r: 0, t: 0, b: 0 },
        showlegend: true,
        legend: {
          x: 0.01,
          y: 0.99,
          bgcolor: 'rgba(17,24,39,0.8)',
          bordercolor: 'rgba(59,130,246,0.2)',
          borderwidth: 1,
          font: { size: 9, color: '#9CA3AF' },
        },
        autosize: true,
        height: 220,
      }}
      config={{
        displayModeBar: false,
        responsive: true,
      }}
      style={{ width: '100%' }}
    />
  )
}
