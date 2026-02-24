import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '@/stores'
import { geodeticToThreeJS } from '@/lib/coordinate-transforms'
import { R_EARTH_EQUATORIAL, DEG2RAD } from '@/lib/constants'
import { useSatellitePosition } from './SatellitePositionContext'

const CIRCLE_SEGMENTS = 48
const CONE_COLOR = new THREE.Color('#10B981')
const CONE_OPACITY_DEFAULT = 0.10
const CONE_OPACITY_ACTIVE = 0.22
const LINK_COLOR = '#10B981'

// No-op raycast — prevents cone meshes from occluding Html labels
const noRaycast = () => {}

// Pre-allocated temporaries for useFrame (avoid GC)
const _stationUp = new THREE.Vector3()
const _satDir = new THREE.Vector3()

interface StationConeData {
  id: string
  name: string
  pos: THREE.Vector3       // station position on globe (radius ~1.003)
  up: THREE.Vector3        // normalized up direction
  lambda: number           // coverage half-angle in radians
  circlePoints: [number, number, number][]
  coneVertices: Float32Array
}

function computeStationCones(
  stations: { id: string; name: string; lat: number; lon: number; minElevation: number; active: boolean }[],
  altitudeKm: number,
): StationConeData[] {
  const R = R_EARTH_EQUATORIAL
  const h = altitudeKm
  if (h <= 0) return []

  return stations.filter((s) => s.active).map((station) => {
    const epsilon = station.minElevation * DEG2RAD
    // Coverage half-angle: lambda = arccos(R/(R+h) * cos(epsilon)) - epsilon
    const cosLambdaPlusEpsilon = (R / (R + h)) * Math.cos(epsilon)
    const lambdaPlusEpsilon = Math.acos(Math.min(1, Math.max(-1, cosLambdaPlusEpsilon)))
    const lambda = lambdaPlusEpsilon - epsilon

    // Station position and up vector
    const gp = geodeticToThreeJS(station.lat, station.lon, 1.003)
    const pos = new THREE.Vector3(gp.x, gp.y, gp.z)
    const up = pos.clone().normalize()

    // Build orthonormal tangent frame at station
    const refVec = Math.abs(up.y) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
    const tangent = new THREE.Vector3().crossVectors(up, refVec).normalize()
    const bitangent = new THREE.Vector3().crossVectors(up, tangent).normalize()

    // Circle points on sphere at angular distance lambda from station
    const circlePoints: [number, number, number][] = []
    const cosL = Math.cos(lambda)
    const sinL = Math.sin(lambda)
    for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
      const theta = (i / CIRCLE_SEGMENTS) * Math.PI * 2
      const cosT = Math.cos(theta)
      const sinT = Math.sin(theta)
      // Point on unit sphere
      const px = cosL * up.x + sinL * (cosT * tangent.x + sinT * bitangent.x)
      const py = cosL * up.y + sinL * (cosT * tangent.y + sinT * bitangent.y)
      const pz = cosL * up.z + sinL * (cosT * tangent.z + sinT * bitangent.z)
      const r = 1.004 // slightly above globe surface
      circlePoints.push([px * r, py * r, pz * r])
    }

    // Cone fill: triangle fan from apex (station) to circle boundary
    // Each triangle: apex, point[i], point[i+1]
    const numTriangles = CIRCLE_SEGMENTS
    const coneVertices = new Float32Array(numTriangles * 3 * 3) // 3 vertices * 3 coords
    const apex = pos.clone().multiplyScalar(1.003 / pos.length()) // station point
    for (let i = 0; i < numTriangles; i++) {
      const idx = i * 9
      // Apex
      coneVertices[idx + 0] = apex.x
      coneVertices[idx + 1] = apex.y
      coneVertices[idx + 2] = apex.z
      // Point i
      coneVertices[idx + 3] = circlePoints[i][0]
      coneVertices[idx + 4] = circlePoints[i][1]
      coneVertices[idx + 5] = circlePoints[i][2]
      // Point i+1
      coneVertices[idx + 6] = circlePoints[i + 1][0]
      coneVertices[idx + 7] = circlePoints[i + 1][1]
      coneVertices[idx + 8] = circlePoints[i + 1][2]
    }

    return { id: station.id, name: station.name, pos, up, lambda, circlePoints, coneVertices }
  })
}

function ConeGeometry({ data }: { data: StationConeData }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { positionRef } = useSatellitePosition()

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(data.coneVertices, 3))
    geo.computeVertexNormals()
    return geo
  }, [data.coneVertices])

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: CONE_COLOR,
        transparent: true,
        opacity: CONE_OPACITY_DEFAULT,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    [],
  )

  // Animate opacity based on satellite proximity
  useFrame(() => {
    if (!meshRef.current) return
    _stationUp.copy(data.up)
    _satDir.copy(positionRef.current).normalize()
    const angularDist = Math.acos(Math.min(1, Math.max(-1, _stationUp.dot(_satDir))))
    const isActive = angularDist < data.lambda
    material.opacity = isActive ? CONE_OPACITY_ACTIVE : CONE_OPACITY_DEFAULT
  })

  return <mesh ref={meshRef} geometry={geometry} material={material} raycast={noRaycast} />
}

function CommLinkLines({ cones }: { cones: StationConeData[] }) {
  const lineRef = useRef<THREE.LineSegments>(null)
  const { positionRef } = useSatellitePosition()

  // Pre-allocate buffer for all possible station links
  const { geometry, maxPairs } = useMemo(() => {
    const n = cones.length
    const positions = new Float32Array(n * 2 * 3) // 2 points per line * 3 coords
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setDrawRange(0, 0)
    return { geometry: geo, maxPairs: n }
  }, [cones])

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: CONE_COLOR,
        transparent: true,
        opacity: 0.6,
      }),
    [],
  )

  useFrame(() => {
    if (!lineRef.current) return
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = posAttr.array as Float32Array
    let activeCount = 0

    for (let i = 0; i < cones.length; i++) {
      const cone = cones[i]
      _stationUp.copy(cone.up)
      _satDir.copy(positionRef.current).normalize()
      const angularDist = Math.acos(Math.min(1, Math.max(-1, _stationUp.dot(_satDir))))

      if (angularDist < cone.lambda) {
        const offset = activeCount * 6
        // Station position
        arr[offset + 0] = cone.pos.x
        arr[offset + 1] = cone.pos.y
        arr[offset + 2] = cone.pos.z
        // Satellite position
        arr[offset + 3] = positionRef.current.x
        arr[offset + 4] = positionRef.current.y
        arr[offset + 5] = positionRef.current.z
        activeCount++
      }
    }

    geometry.setDrawRange(0, activeCount * 2)
    posAttr.needsUpdate = true
  })

  return <lineSegments ref={lineRef} geometry={geometry} material={material} />
}

export default function StationVisibilityCones({
  showCones,
  showCommLinks,
}: {
  showCones: boolean
  showCommLinks: boolean
}) {
  const groundStations = useStore((s) => s.groundStations)
  const semiMajorAxis = useStore((s) => s.elements.semiMajorAxis)
  const altitudeKm = semiMajorAxis - R_EARTH_EQUATORIAL

  const cones = useMemo(
    () => computeStationCones(groundStations, altitudeKm),
    [groundStations, altitudeKm],
  )

  if (cones.length === 0) return null

  return (
    <group>
      {showCones &&
        cones.map((cone) => (
          <group key={cone.id}>
            <ConeGeometry data={cone} />
            <Line
              points={cone.circlePoints}
              color="#10B981"
              lineWidth={1.2}
              transparent
              opacity={0.35}
            />
          </group>
        ))}
      {showCommLinks && <CommLinkLines cones={cones} />}
    </group>
  )
}
