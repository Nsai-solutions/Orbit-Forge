import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '@/stores'
import { R_EARTH_EQUATORIAL, DEG2RAD } from '@/lib/constants'
import { computeEOAnalysis } from '@/lib/payload-eo'
import { computeSARAnalysis } from '@/lib/payload-sar'
import { computeSATCOMAnalysis } from '@/lib/payload-satcom'
import { sharedSatellitePosition } from './SatellitePositionContext'

const FOOTPRINT_COLOR = new THREE.Color('#06B6D4')
const FOOTPRINT_SURFACE_R = 1.005 // slightly above globe

// No-op raycast — prevents footprint meshes from occluding Html labels
const noRaycast = () => {}

// Circle footprint (SATCOM beam)
const CIRCLE_SEGMENTS = 32
// Rectangle footprint (EO/SAR)
const RECT_EDGE_SUBDIVISIONS = 8 // points per edge for curvature

// Pre-allocated temporaries
const _satPos = new THREE.Vector3()
const _up = new THREE.Vector3()
const _velDir = new THREE.Vector3()
const _crossDir = new THREE.Vector3()
const _orbitNormal = new THREE.Vector3()
const _tmpPt = new THREE.Vector3()

interface FootprintParams {
  type: 'circle' | 'rectangle'
  crossTrackKm: number  // swath width or beam diameter
  alongTrackKm: number  // only for rectangle
}

function useFootprintParams(): FootprintParams | null {
  const payloadType = useStore((s) => s.payloadType)
  const payloadEO = useStore((s) => s.payloadEO)
  const payloadSAR = useStore((s) => s.payloadSAR)
  const payloadSATCOM = useStore((s) => s.payloadSATCOM)
  const payloadShared = useStore((s) => s.payloadShared)
  const elements = useStore((s) => s.elements)

  return useMemo(() => {
    const altKm = elements.semiMajorAxis - R_EARTH_EQUATORIAL
    if (altKm <= 0) return null

    if (payloadType === 'earth-observation') {
      const analysis = computeEOAnalysis(payloadEO, payloadShared, altKm, elements.inclination)
      if (!analysis.swathWidth || analysis.swathWidth <= 0) return null
      // Along-track footprint from altitude and cross-track FOV (approximate)
      const fovAlongRad = (analysis.fovCrossTrack || 1) * DEG2RAD
      const alongTrackKm = altKm * Math.tan(fovAlongRad / 2) * 2
      return {
        type: 'rectangle' as const,
        crossTrackKm: analysis.swathWidth,
        alongTrackKm: Math.max(alongTrackKm, 1),
      }
    }

    if (payloadType === 'sar') {
      const analysis = computeSARAnalysis(payloadSAR, payloadShared, altKm)
      if (!analysis.swathWidth || analysis.swathWidth <= 0) return null
      return {
        type: 'rectangle' as const,
        crossTrackKm: analysis.swathWidth,
        alongTrackKm: analysis.swathWidth, // SAR: roughly square
      }
    }

    if (payloadType === 'satcom') {
      const analysis = computeSATCOMAnalysis(payloadSATCOM, payloadShared, altKm)
      if (!analysis.beamFootprintKm || analysis.beamFootprintKm <= 0) return null
      return {
        type: 'circle' as const,
        crossTrackKm: analysis.beamFootprintKm,
        alongTrackKm: analysis.beamFootprintKm,
      }
    }

    return null
  }, [payloadType, payloadEO, payloadSAR, payloadSATCOM, payloadShared, elements.semiMajorAxis, elements.inclination])
}

function CircleFootprint({ radiusKm }: { radiusKm: number }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const lineRef = useRef<THREE.Group>(null)

  // Pre-allocate geometry: center + CIRCLE_SEGMENTS perimeter = triangle fan
  const { fillGeo, borderPoints } = useMemo(() => {
    const numVerts = CIRCLE_SEGMENTS + 2 // center + perimeter + close
    const positions = new Float32Array(numVerts * 3)
    const indices: number[] = []
    for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
      indices.push(0, i + 1, ((i + 1) % CIRCLE_SEGMENTS) + 1)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setIndex(indices)

    const border: [number, number, number][] = Array.from({ length: CIRCLE_SEGMENTS + 1 }, () => [0, 0, 0])
    return { fillGeo: geo, borderPoints: border }
  }, [])

  const fillMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: FOOTPRINT_COLOR,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [],
  )

  useFrame(() => {
    if (!meshRef.current) return
    _satPos.copy(sharedSatellitePosition)
    if (_satPos.lengthSq() < 0.001) return // satellite not yet positioned

    // Subsatellite point (project onto globe surface)
    _up.copy(_satPos).normalize()

    // Angular radius of footprint on sphere
    const angularRadius = radiusKm / R_EARTH_EQUATORIAL

    // Build tangent frame
    const refVec = Math.abs(_up.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
    _velDir.crossVectors(_up, refVec).normalize()
    _crossDir.crossVectors(_up, _velDir).normalize()

    const posAttr = fillGeo.getAttribute('position') as THREE.BufferAttribute
    const arr = posAttr.array as Float32Array

    // Center point
    const centerR = FOOTPRINT_SURFACE_R
    arr[0] = _up.x * centerR
    arr[1] = _up.y * centerR
    arr[2] = _up.z * centerR

    const cosA = Math.cos(angularRadius)
    const sinA = Math.sin(angularRadius)

    for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
      const theta = (i / CIRCLE_SEGMENTS) * Math.PI * 2
      const cosT = Math.cos(theta)
      const sinT = Math.sin(theta)
      _tmpPt.set(
        cosA * _up.x + sinA * (cosT * _velDir.x + sinT * _crossDir.x),
        cosA * _up.y + sinA * (cosT * _velDir.y + sinT * _crossDir.y),
        cosA * _up.z + sinA * (cosT * _velDir.z + sinT * _crossDir.z),
      )
      _tmpPt.normalize().multiplyScalar(FOOTPRINT_SURFACE_R)

      const vi = (i + 1) * 3
      arr[vi] = _tmpPt.x
      arr[vi + 1] = _tmpPt.y
      arr[vi + 2] = _tmpPt.z

      // Border points for Line
      if (i < borderPoints.length) {
        borderPoints[i][0] = _tmpPt.x
        borderPoints[i][1] = _tmpPt.y
        borderPoints[i][2] = _tmpPt.z
      }
    }

    posAttr.needsUpdate = true
    fillGeo.computeVertexNormals()
  })

  return (
    <group>
      <mesh ref={meshRef} geometry={fillGeo} material={fillMaterial} raycast={noRaycast} />
      <group ref={lineRef}>
        <Line points={borderPoints} color="#06B6D4" lineWidth={1.5} transparent opacity={0.5} />
      </group>
    </group>
  )
}

function RectangleFootprint({
  crossTrackKm,
  alongTrackKm,
}: {
  crossTrackKm: number
  alongTrackKm: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const elements = useStore((s) => s.elements)

  // Pre-allocate: 4 corner quad = 2 triangles
  const { fillGeo, borderPoints } = useMemo(() => {
    const positions = new Float32Array(4 * 3) // 4 corners
    const indices = [0, 1, 2, 0, 2, 3]
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setIndex(indices)

    const border: [number, number, number][] = Array.from({ length: 5 }, () => [0, 0, 0])
    return { fillGeo: geo, borderPoints: border }
  }, [])

  const fillMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: FOOTPRINT_COLOR,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [],
  )

  useFrame(() => {
    if (!meshRef.current) return
    _satPos.copy(sharedSatellitePosition)
    if (_satPos.lengthSq() < 0.001) return

    _up.copy(_satPos).normalize()

    // Orbit normal from inclination and RAAN
    const iRad = elements.inclination * DEG2RAD
    const raanRad = elements.raan * DEG2RAD
    _orbitNormal.set(
      Math.sin(iRad) * Math.sin(raanRad),
      Math.cos(iRad),
      -Math.sin(iRad) * Math.cos(raanRad),
    ).normalize()

    // Velocity direction (tangent to orbit in direction of motion)
    _velDir.crossVectors(_orbitNormal, _up).normalize()
    // Cross-track direction
    _crossDir.crossVectors(_up, _velDir).normalize()

    const halfCross = (crossTrackKm / 2) / R_EARTH_EQUATORIAL // angular
    const halfAlong = (alongTrackKm / 2) / R_EARTH_EQUATORIAL // angular

    // Four corners: offset from subsatellite point
    const corners = [
      [-halfCross, -halfAlong], // bottom-left
      [halfCross, -halfAlong],  // bottom-right
      [halfCross, halfAlong],   // top-right
      [-halfCross, halfAlong],  // top-left
    ]

    const posAttr = fillGeo.getAttribute('position') as THREE.BufferAttribute
    const arr = posAttr.array as Float32Array

    for (let c = 0; c < 4; c++) {
      const [cx, ca] = corners[c]
      // Spherical offset
      _tmpPt.set(
        _up.x + cx * _crossDir.x + ca * _velDir.x,
        _up.y + cx * _crossDir.y + ca * _velDir.y,
        _up.z + cx * _crossDir.z + ca * _velDir.z,
      )
      _tmpPt.normalize().multiplyScalar(FOOTPRINT_SURFACE_R)

      arr[c * 3] = _tmpPt.x
      arr[c * 3 + 1] = _tmpPt.y
      arr[c * 3 + 2] = _tmpPt.z

      borderPoints[c][0] = _tmpPt.x
      borderPoints[c][1] = _tmpPt.y
      borderPoints[c][2] = _tmpPt.z
    }
    // Close the border loop
    borderPoints[4][0] = borderPoints[0][0]
    borderPoints[4][1] = borderPoints[0][1]
    borderPoints[4][2] = borderPoints[0][2]

    posAttr.needsUpdate = true
    fillGeo.computeVertexNormals()
  })

  return (
    <group>
      <mesh ref={meshRef} geometry={fillGeo} material={fillMaterial} raycast={noRaycast} />
      <Line points={borderPoints} color="#06B6D4" lineWidth={1.5} transparent opacity={0.5} />
    </group>
  )
}

export default function PayloadFootprint() {
  const showFootprint = useStore((s) => s.overlayToggles.sensorFootprint)
  const params = useFootprintParams()

  if (!showFootprint || !params) return null

  if (params.type === 'circle') {
    return <CircleFootprint radiusKm={params.crossTrackKm / 2} />
  }

  return (
    <RectangleFootprint
      crossTrackKm={params.crossTrackKm}
      alongTrackKm={params.alongTrackKm}
    />
  )
}
