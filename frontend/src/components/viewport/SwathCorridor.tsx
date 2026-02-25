import { useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '@/stores'
import { R_EARTH_EQUATORIAL } from '@/lib/constants'
import { computeGroundTrack } from '@/lib/orbital-mechanics'
import { computeEOAnalysis } from '@/lib/payload-eo'
import { computeSARAnalysis } from '@/lib/payload-sar'
import { geodeticToThreeJS } from '@/lib/coordinate-transforms'

const SWATH_COLOR = new THREE.Color('#8B5CF6')
const SWATH_SURFACE_R = 1.003

// No-op raycast — prevents swath mesh from occluding Html labels
const noRaycast = () => {}

function useSwathWidthKm(): number | null {
  const payloadType = useStore((s) => s.payloadType)
  const payloadEO = useStore((s) => s.payloadEO)
  const payloadSAR = useStore((s) => s.payloadSAR)
  const payloadShared = useStore((s) => s.payloadShared)
  const elements = useStore((s) => s.elements)

  return useMemo(() => {
    const altKm = elements.semiMajorAxis - R_EARTH_EQUATORIAL
    if (altKm <= 0) return null

    if (payloadType === 'earth-observation') {
      const analysis = computeEOAnalysis(payloadEO, payloadShared, altKm, elements.inclination)
      return analysis.swathWidth > 0 ? analysis.swathWidth : null
    }

    if (payloadType === 'sar') {
      const analysis = computeSARAnalysis(payloadSAR, payloadShared, altKm)
      return analysis.swathWidth > 0 ? analysis.swathWidth : null
    }

    // SATCOM has no meaningful swath corridor
    return null
  }, [payloadType, payloadEO, payloadSAR, payloadShared, elements.semiMajorAxis, elements.inclination])
}

export default function SwathCorridor() {
  const showSwath = useStore((s) => s.overlayToggles.swathCorridor)
  const elements = useStore((s) => s.elements)
  const orbitEpoch = useStore((s) => s.orbitEpoch)
  const swathWidthKm = useSwathWidthKm()

  const ribbonGeometry = useMemo(() => {
    if (!swathWidthKm || swathWidthKm <= 0) return null

    const track = computeGroundTrack(elements, orbitEpoch, 3, 360, true)
    if (track.length < 2) return null

    // Half-swath angular offset on the unit sphere (radians)
    const halfSwathAngle = (swathWidthKm / 2) / R_EARTH_EQUATORIAL

    const cosA = Math.cos(halfSwathAngle)
    const sinA = Math.sin(halfSwathAngle)

    const vertices: number[] = []
    const indices: number[] = []

    // Reusable vectors for the loop
    const up = new THREE.Vector3()
    const tangent = new THREE.Vector3()
    const crossTrack = new THREE.Vector3()
    const pNext = new THREE.Vector3()
    const pPrev = new THREE.Vector3()

    for (let i = 0; i < track.length; i++) {
      const { lat, lon } = track[i]
      const center = geodeticToThreeJS(lat, lon, SWATH_SURFACE_R)

      // Track direction from neighboring points
      let nextIdx = Math.min(i + 1, track.length - 1)
      let prevIdx = Math.max(i - 1, 0)

      // Skip antimeridian crossings for direction computation
      if (Math.abs(track[nextIdx].lon - track[i].lon) > 180) nextIdx = i
      if (Math.abs(track[prevIdx].lon - track[i].lon) > 180) prevIdx = i

      const n = geodeticToThreeJS(track[nextIdx].lat, track[nextIdx].lon, SWATH_SURFACE_R)
      const p = geodeticToThreeJS(track[prevIdx].lat, track[prevIdx].lon, SWATH_SURFACE_R)
      pNext.set(n.x, n.y, n.z)
      pPrev.set(p.x, p.y, p.z)

      // Track tangent (forward along ground track)
      tangent.subVectors(pNext, pPrev).normalize()

      // Radial up direction
      up.set(center.x, center.y, center.z).normalize()

      // Cross-track direction (perpendicular to both tangent and up)
      crossTrack.crossVectors(up, tangent).normalize()

      // Offset left and right on the sphere surface by half-swath angle
      // Point on sphere = cos(angle)*up + sin(angle)*crossTrack, then normalize and scale
      const lx = cosA * up.x + sinA * crossTrack.x
      const ly = cosA * up.y + sinA * crossTrack.y
      const lz = cosA * up.z + sinA * crossTrack.z
      const lLen = Math.sqrt(lx * lx + ly * ly + lz * lz)

      const rx = cosA * up.x - sinA * crossTrack.x
      const ry = cosA * up.y - sinA * crossTrack.y
      const rz = cosA * up.z - sinA * crossTrack.z
      const rLen = Math.sqrt(rx * rx + ry * ry + rz * rz)

      vertices.push(
        (lx / lLen) * SWATH_SURFACE_R,
        (ly / lLen) * SWATH_SURFACE_R,
        (lz / lLen) * SWATH_SURFACE_R,
      )
      vertices.push(
        (rx / rLen) * SWATH_SURFACE_R,
        (ry / rLen) * SWATH_SURFACE_R,
        (rz / rLen) * SWATH_SURFACE_R,
      )

      // Build quad indices (two triangles per segment), skip antimeridian crossings
      if (i > 0 && Math.abs(track[i].lon - track[i - 1].lon) < 180) {
        const base = (i - 1) * 2
        indices.push(base, base + 1, base + 2)     // triangle 1
        indices.push(base + 1, base + 3, base + 2) // triangle 2
      }
    }

    if (vertices.length < 6) return null

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geo.setIndex(indices)
    geo.computeVertexNormals()
    return geo
  }, [elements, swathWidthKm, orbitEpoch])

  if (!showSwath || !ribbonGeometry) return null

  return (
    <mesh geometry={ribbonGeometry} raycast={noRaycast}>
      <meshBasicMaterial
        color={SWATH_COLOR}
        transparent
        opacity={0.18}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}
