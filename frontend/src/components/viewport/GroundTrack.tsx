import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import { useStore } from '@/stores'
import { computeGroundTrack } from '@/lib/orbital-mechanics'
import { geodeticToThreeJS, eciToEcef, ecefToGeodetic } from '@/lib/coordinate-transforms'
import { dateToGMST } from '@/lib/time-utils'

export default function GroundTrack() {
  const elements = useStore((s) => s.elements)
  const orbitEpoch = useStore((s) => s.orbitEpoch)
  const propagationMode = useStore((s) => s.propagationMode)
  const propagatedTrajectory = useStore((s) => s.propagatedTrajectory)

  const segments = useMemo(() => {
    let track: Array<{ lat: number; lon: number }>

    if (propagationMode !== 'keplerian' && propagatedTrajectory.length > 0) {
      // Numerical mode: derive ground track from propagated trajectory
      track = propagatedTrajectory.map((pt) => {
        const gmst = dateToGMST(new Date(pt.t))
        const ecef = eciToEcef({ x: pt.state.x, y: pt.state.y, z: pt.state.z }, gmst)
        const geo = ecefToGeodetic(ecef)
        return { lat: geo.lat, lon: geo.lon }
      })
    } else {
      // Keplerian mode: existing analytical ground track
      track = computeGroundTrack(elements, orbitEpoch, 3, 180, false)
    }

    // Break track into segments at antimeridian crossings
    const segs: Array<[number, number, number][]> = []
    let currentSeg: [number, number, number][] = []

    for (let i = 0; i < track.length; i++) {
      const { lat, lon } = track[i]
      const pos = geodeticToThreeJS(lat, lon, 1.002)
      const point: [number, number, number] = [pos.x, pos.y, pos.z]

      if (i > 0) {
        const prevLon = track[i - 1].lon
        // Detect antimeridian crossing (longitude jump > 180)
        if (Math.abs(lon - prevLon) > 180) {
          if (currentSeg.length >= 2) segs.push(currentSeg)
          currentSeg = []
        }
      }

      currentSeg.push(point)
    }

    if (currentSeg.length >= 2) segs.push(currentSeg)

    return segs
  }, [elements, orbitEpoch, propagationMode, propagatedTrajectory])

  if (segments.length === 0) return null

  return (
    <group>
      {segments.map((seg, i) => (
        <Line
          key={i}
          points={seg}
          color="#F59E0B"
          lineWidth={1}
          transparent
          opacity={Math.max(0.2, 0.7 - i * 0.1)}
          dashed
          dashScale={50}
          dashSize={0.003}
          gapSize={0.002}
        />
      ))}
    </group>
  )
}
