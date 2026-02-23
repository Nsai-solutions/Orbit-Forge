import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '@/stores'
import type { ArchitectVisualization } from '@/stores/architect-slice'
import Earth from '@/components/viewport/Earth'
import Atmosphere from '@/components/viewport/Atmosphere'
import { geodeticToThreeJS } from '@/lib/coordinate-transforms'
import { R_EARTH_EQUATORIAL } from '@/lib/constants'

// ─── Constants ───

const EARTH_RADIUS_UNITS = 1 // Earth radius in scene units

function altToRadius(altKm: number): number {
  return EARTH_RADIUS_UNITS * (1 + altKm / R_EARTH_EQUATORIAL)
}

// ─── Orbit Ring ───

function OrbitRing({
  altKm,
  incDeg,
  raanDeg = 0,
  color = '#22D3EE',
  lineWidth = 1.5,
  opacity = 0.8,
}: {
  altKm: number
  incDeg: number
  raanDeg?: number
  color?: string
  lineWidth?: number
  opacity?: number
}) {
  const points = useMemo(() => {
    const r = altToRadius(altKm)
    const incRad = (incDeg * Math.PI) / 180
    const raanRad = (raanDeg * Math.PI) / 180
    const pts: [number, number, number][] = []
    const segments = 128

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      // Orbit in perifocal frame
      const xp = r * Math.cos(angle)
      const yp = r * Math.sin(angle)

      // Rotate by inclination around X, then by RAAN around Y (Three.js Y-up)
      const cosI = Math.cos(incRad)
      const sinI = Math.sin(incRad)
      const cosR = Math.cos(raanRad)
      const sinR = Math.sin(raanRad)

      // First rotate in orbital plane (inclination around X-axis)
      const x1 = xp
      const y1 = yp * cosI
      const z1 = yp * sinI

      // Then rotate by RAAN around Y-axis
      const x = x1 * cosR + z1 * sinR
      const y = y1
      const z = -x1 * sinR + z1 * cosR

      pts.push([x, y, z])
    }
    return pts
  }, [altKm, incDeg, raanDeg])

  return (
    <Line
      points={points}
      color={color}
      lineWidth={lineWidth}
      transparent
      opacity={opacity}
    />
  )
}

// ─── Satellite Dot (animated) ───

function SatelliteDot({ altKm, incDeg, raanDeg = 0, speed = 0.15 }: {
  altKm: number
  incDeg: number
  raanDeg?: number
  speed?: number
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const phaseRef = useRef(0)

  useFrame((_, delta) => {
    phaseRef.current = (phaseRef.current + speed * delta) % (Math.PI * 2)
    const r = altToRadius(altKm)
    const incRad = (incDeg * Math.PI) / 180
    const raanRad = (raanDeg * Math.PI) / 180
    const angle = phaseRef.current

    const xp = r * Math.cos(angle)
    const yp = r * Math.sin(angle)
    const cosI = Math.cos(incRad)
    const sinI = Math.sin(incRad)
    const cosR = Math.cos(raanRad)
    const sinR = Math.sin(raanRad)
    const x1 = xp
    const y1 = yp * cosI
    const z1 = yp * sinI
    const x = x1 * cosR + z1 * sinR
    const y = y1
    const z = -x1 * sinR + z1 * cosR

    if (meshRef.current) {
      meshRef.current.position.set(x, y, z)
    }
    if (glowRef.current) {
      glowRef.current.position.set(x, y, z)
      const s = 1 + 0.3 * Math.sin(Date.now() * 0.004)
      glowRef.current.scale.setScalar(s)
    }
  })

  return (
    <>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshBasicMaterial color="#F9FAFB" />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial color="#3B82F6" transparent opacity={0.4} />
      </mesh>
    </>
  )
}

// ─── Ground Station Marker ───

function StationMarker({ lat, lon, name }: { lat: number; lon: number; name: string }) {
  const pos = useMemo(() => {
    const p = geodeticToThreeJS(lat, lon, 1.003)
    return [p.x, p.y, p.z] as [number, number, number]
  }, [lat, lon])

  return (
    <group position={pos}>
      <mesh>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshBasicMaterial color="#10B981" />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.015, 0.022, 16]} />
        <meshBasicMaterial color="#10B981" transparent opacity={0.4} />
      </mesh>
    </group>
  )
}

// ─── Swath Footprint ───

function SwathFootprint({ altKm, incDeg, swathWidthKm }: {
  altKm: number
  incDeg: number
  swathWidthKm: number
}) {
  const points = useMemo(() => {
    const halfAngle = (swathWidthKm / 2) / R_EARTH_EQUATORIAL // radians on sphere
    const r = EARTH_RADIUS_UNITS * (1 + halfAngle)
    const incRad = (incDeg * Math.PI) / 180
    const pts: [number, number, number][] = []
    const segments = 128

    // Create a band along the orbit ground track
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2
      const xp = r * Math.cos(angle)
      const yp = r * Math.sin(angle)
      const cosI = Math.cos(incRad)
      const sinI = Math.sin(incRad)
      const x = xp
      const y = yp * cosI
      const z = yp * sinI
      pts.push([x, y, z])
    }
    return pts
  }, [altKm, incDeg, swathWidthKm])

  return (
    <Line
      points={points}
      color="#F59E0B"
      lineWidth={3}
      transparent
      opacity={0.3}
    />
  )
}

// ─── Auto-Rotate Group ───

function AutoRotate({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.05
    }
  })
  return <group ref={groupRef}>{children}</group>
}

// ─── Template Scenes ───

function LEOOrbitScene({ params }: { params: ArchitectVisualization['params'] }) {
  return (
    <>
      <OrbitRing altKm={params.altitude_km} incDeg={params.inclination_deg} />
      <SatelliteDot altKm={params.altitude_km} incDeg={params.inclination_deg} />
    </>
  )
}

function LEOWithStationsScene({ params }: { params: ArchitectVisualization['params'] }) {
  return (
    <>
      <OrbitRing altKm={params.altitude_km} incDeg={params.inclination_deg} />
      <SatelliteDot altKm={params.altitude_km} incDeg={params.inclination_deg} />
      {params.stations?.map((s, i) => (
        <StationMarker key={i} lat={s.lat} lon={s.lon} name={s.name} />
      ))}
    </>
  )
}

function ConstellationScene({ params }: { params: ArchitectVisualization['params'] }) {
  const planes = params.num_planes || 3
  const satsPerPlane = params.sats_per_plane || 4
  const colors = ['#22D3EE', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981']

  return (
    <>
      {Array.from({ length: planes }, (_, p) => {
        const raanDeg = (p / planes) * 360
        const color = colors[p % colors.length]
        return (
          <group key={p}>
            <OrbitRing
              altKm={params.altitude_km}
              incDeg={params.inclination_deg}
              raanDeg={raanDeg}
              color={color}
              lineWidth={1}
              opacity={0.6}
            />
            {Array.from({ length: satsPerPlane }, (_, s) => (
              <SatelliteDot
                key={s}
                altKm={params.altitude_km}
                incDeg={params.inclination_deg}
                raanDeg={raanDeg}
                speed={0.15 + s * (0.001)} // slight offset so they spread
              />
            ))}
          </group>
        )
      })}
    </>
  )
}

function GroundCoverageScene({ params }: { params: ArchitectVisualization['params'] }) {
  return (
    <>
      <OrbitRing altKm={params.altitude_km} incDeg={params.inclination_deg} />
      <SatelliteDot altKm={params.altitude_km} incDeg={params.inclination_deg} />
      {params.swath_width_km && (
        <SwathFootprint
          altKm={params.altitude_km}
          incDeg={params.inclination_deg}
          swathWidthKm={params.swath_width_km}
        />
      )}
      {params.stations?.map((s, i) => (
        <StationMarker key={i} lat={s.lat} lon={s.lon} name={s.name} />
      ))}
    </>
  )
}

// ─── Scene Wrapper ───

function SceneContent({ viz }: { viz: ArchitectVisualization }) {
  const templateScene = useMemo(() => {
    switch (viz.template) {
      case 'leo-orbit':
        return <LEOOrbitScene params={viz.params} />
      case 'leo-with-stations':
        return <LEOWithStationsScene params={viz.params} />
      case 'constellation':
        return <ConstellationScene params={viz.params} />
      case 'ground-coverage':
        return <GroundCoverageScene params={viz.params} />
    }
  }, [viz])

  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 3, 4]} intensity={1.2} />

      <AutoRotate>
        <Earth />
        <Atmosphere />
        {templateScene}
      </AutoRotate>

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={1.8}
        maxDistance={5}
        autoRotate={false}
      />
    </>
  )
}

// ─── Main Component ───

export default function MissionVisualization() {
  const viz = useStore((s) => s.architectVisualization)

  if (!viz) return null

  const templateLabels: Record<string, string> = {
    'leo-orbit': 'LEO Orbit',
    'leo-with-stations': 'LEO + Ground Stations',
    'constellation': 'Constellation',
    'ground-coverage': 'Ground Coverage',
  }

  return (
    <div className="rounded border border-white/5 bg-space-900/30 overflow-hidden">
      <div className="h-8 flex items-center px-3 border-b border-white/5">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
          {templateLabels[viz.template] || 'Visualization'}
        </span>
        <span className="ml-auto text-[10px] text-[var(--text-tertiary)]">
          {viz.params.altitude_km} km · {viz.params.inclination_deg}°
        </span>
      </div>
      <div className="h-[240px] bg-black/40">
        <Canvas
          camera={{ position: [0, 1.5, 3], fov: 40 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 1.5]}
        >
          <SceneContent viz={viz} />
        </Canvas>
      </div>
    </div>
  )
}
