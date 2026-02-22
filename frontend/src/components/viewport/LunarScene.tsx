import { useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls, Line, Html } from '@react-three/drei'
import { useStore } from '@/stores'
import Starfield from './Starfield'
import {
  generateLunarTransferArc,
  generateFlybyPath,
  generateFreeReturnTrajectory,
} from '@/lib/lunar-transfer'
import type { PhasedTrajectory } from '@/lib/lunar-transfer'
import { R_MOON } from '@/lib/beyond-leo-constants'
import { R_EARTH_EQUATORIAL } from '@/lib/constants'

// Scale: 1 unit ≈ 400,000 km (Moon at ~0.96 units from Earth)
const SCENE_SCALE = 400000

// Phase colors
const COL_APPROACH = '#F59E0B'  // orange — approach/transfer
const COL_NEARMOON = '#FACC15'  // yellow — near-Moon arc
const COL_DEPART_FLYBY = '#F97316' // orange-red — flyby departure
const COL_RETURN = '#22D3EE'    // cyan — free-return leg
const COL_ORBIT = '#22D3EE'     // cyan — lunar orbit ring
const COL_DESCENT = '#10B981'   // green — descent path

function toTuple(p: { x: number; y: number; z: number }): [number, number, number] {
  return [p.x, p.y, p.z]
}

/** Tiny annotation label — fixed screen-space size, offset from point */
function AnnotationLabel({ position, color, text, offsetY = -14 }: {
  position: [number, number, number]
  color: string
  text: string
  offsetY?: number
}) {
  return (
    <group position={position}>
      {/* Small dot at the actual point */}
      <mesh>
        <sphereGeometry args={[0.004, 6, 6]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.007, 6, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} depthWrite={false} />
      </mesh>
      {/* Label offset away from trajectory */}
      <Html center style={{ pointerEvents: 'none', transform: `translateY(${offsetY}px)` }}>
        <div
          style={{
            color,
            fontSize: '9px',
            fontFamily: 'ui-monospace, monospace',
            fontWeight: 600,
            padding: '1px 3px',
            borderRadius: '2px',
            background: 'rgba(0,0,0,0.45)',
            whiteSpace: 'nowrap',
            lineHeight: 1,
          }}
        >
          {text}
        </div>
      </Html>
    </group>
  )
}

export default function LunarScene() {
  const params = useStore((s) => s.beyondLeo.lunarParams)
  const { camera } = useThree()

  const moonPos = 384400 / SCENE_SCALE

  const earthR = R_EARTH_EQUATORIAL / SCENE_SCALE
  const moonR = R_MOON / SCENE_SCALE
  // The visual Moon sphere is enlarged for visibility (min 0.012).
  // Orbit rings and descent paths must use this visual radius as baseline,
  // otherwise they'd be hidden inside the Moon sphere.
  const visualMoonR = Math.max(moonR, 0.012)

  // ─── Orbit Insertion & Landing: basic transfer arc ───
  const transferPoints = useMemo(() => {
    if (params.missionType === 'flyby' || params.missionType === 'free-return') return []
    return generateLunarTransferArc(params.departureAltKm, params.targetOrbitAltKm).map(toTuple)
  }, [params.departureAltKm, params.missionType, params.targetOrbitAltKm])

  // ─── Flyby: phased trajectory ───
  const flybyPhases = useMemo<PhasedTrajectory | null>(() => {
    if (params.missionType !== 'flyby') return null
    return generateFlybyPath(params.departureAltKm)
  }, [params.departureAltKm, params.missionType])

  // ─── Free-return: phased trajectory ───
  const freeReturnPhases = useMemo<PhasedTrajectory | null>(() => {
    if (params.missionType !== 'free-return') return null
    return generateFreeReturnTrajectory(params.departureAltKm)
  }, [params.departureAltKm, params.missionType])

  // ─── Lunar orbit ring — orbit insertion & landing ───
  // Uses visual scale so the ring is clearly visible outside the Moon sphere
  // Tilted ~10° for 3D appearance
  const lunarOrbitPoints = useMemo(() => {
    if (params.missionType === 'flyby' || params.missionType === 'free-return') return []
    // Scale orbit proportionally with heavy exaggeration for visibility at full zoom
    const altRatio = params.targetOrbitAltKm / R_MOON // e.g., 100/1737 = 0.058
    const orbitR = visualMoonR * (1 + Math.max(altRatio * 25, 1.2)) // ~2-3x Moon radius
    const tilt = 10 * Math.PI / 180 // 10° tilt for 3D appearance
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 64; i++) {
      const theta = (i / 64) * 2 * Math.PI
      pts.push([
        moonPos + orbitR * Math.cos(theta),
        orbitR * Math.sin(theta) * Math.sin(tilt),
        orbitR * Math.sin(theta) * Math.cos(tilt),
      ])
    }
    return pts
  }, [params.missionType, params.targetOrbitAltKm, moonPos, visualMoonR])

  // ─── Descent path — landing only (visual scale) ───
  // Spiral from orbit ring down to Moon surface with ~3 revolutions
  const descentPoints = useMemo(() => {
    if (params.missionType !== 'landing') return []
    const altRatio = params.targetOrbitAltKm / R_MOON
    const orbitR = visualMoonR * (1 + Math.max(altRatio * 25, 1.2)) // must match orbit ring
    const tilt = 10 * Math.PI / 180 // match orbit ring tilt
    const pts: [number, number, number][] = []
    const numPoints = 60
    // Spiral from orbit radius down to Moon surface — 3 full revolutions
    for (let i = 0; i <= numPoints; i++) {
      const t = i / numPoints
      const angle = t * Math.PI * 6 // 3 full revolutions
      const r = orbitR - t * (orbitR - visualMoonR)
      pts.push([
        moonPos + r * Math.cos(angle),
        r * Math.sin(angle) * Math.sin(tilt),
        r * Math.sin(angle) * Math.cos(tilt),
      ])
    }
    return pts
  }, [params.missionType, params.targetOrbitAltKm, moonPos, visualMoonR])

  // ─── Landing marker — on visual Moon surface ───
  const landingMarker = useMemo<[number, number, number] | null>(() => {
    if (params.missionType !== 'landing') return null
    // Place at the end of the descent spiral (on Moon surface)
    if (descentPoints.length > 0) return descentPoints[descentPoints.length - 1]
    return [moonPos - visualMoonR * 0.9, 0, -visualMoonR * 0.4]
  }, [params.missionType, descentPoints, moonPos, visualMoonR])

  // Set camera
  useMemo(() => {
    camera.position.set(0.5, 0.8, 1.2)
    camera.lookAt(0.5, 0, 0)
  }, [])

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} />
      <Starfield />

      {/* Earth — small label offset below */}
      <group position={[0, 0, 0]}>
        <mesh>
          <sphereGeometry args={[Math.max(earthR, 0.02), 32, 32]} />
          <meshStandardMaterial color="#3B82F6" emissive="#1E40AF" emissiveIntensity={0.3} />
        </mesh>
        <Html center style={{ pointerEvents: 'none', transform: 'translateY(16px)' }}>
          <div style={{
            fontSize: '11px',
            fontFamily: 'ui-monospace, monospace',
            fontWeight: 700,
            color: '#60A5FA',
            padding: '1px 4px',
            borderRadius: '2px',
            background: 'rgba(0,0,0,0.4)',
            whiteSpace: 'nowrap',
          }}>
            Earth
          </div>
        </Html>
      </group>

      {/* Moon — small label offset below sphere, not over trajectory area */}
      <group position={[moonPos, 0, 0]}>
        <mesh>
          <sphereGeometry args={[Math.max(moonR, 0.012), 16, 16]} />
          <meshStandardMaterial color="#9CA3AF" />
        </mesh>
        <Html center style={{ pointerEvents: 'none', transform: 'translateY(14px)' }}>
          <div style={{
            fontSize: '10px',
            fontFamily: 'ui-monospace, monospace',
            fontWeight: 700,
            color: '#9CA3AF',
            padding: '1px 4px',
            borderRadius: '2px',
            background: 'rgba(0,0,0,0.35)',
            whiteSpace: 'nowrap',
          }}>
            Moon
          </div>
        </Html>
      </group>

      {/* ═══ ORBIT INSERTION ═══ */}
      {transferPoints.length > 2 && (
        <Line points={transferPoints} color={COL_APPROACH} lineWidth={2} transparent opacity={0.8} />
      )}
      {lunarOrbitPoints.length > 2 && (
        <Line points={lunarOrbitPoints} color={COL_ORBIT} lineWidth={2.5} transparent opacity={0.9} />
      )}

      {/* ═══ LANDING ═══ */}
      {descentPoints.length > 2 && (
        <Line points={descentPoints} color={COL_DESCENT} lineWidth={2.5} transparent opacity={0.9} />
      )}
      {landingMarker && (
        <AnnotationLabel position={landingMarker} color={COL_DESCENT} text="Landing" offsetY={-12} />
      )}

      {/* ═══ FLYBY ═══ */}
      {flybyPhases && (
        <>
          {flybyPhases.approach.length > 2 && (
            <Line points={flybyPhases.approach.map(toTuple)} color={COL_APPROACH} lineWidth={2} transparent opacity={0.8} />
          )}
          {flybyPhases.nearMoon.length > 2 && (
            <Line points={flybyPhases.nearMoon.map(toTuple)} color={COL_NEARMOON} lineWidth={3.5} transparent opacity={0.9} />
          )}
          {flybyPhases.departure.length > 2 && (
            <Line points={flybyPhases.departure.map(toTuple)} color={COL_DEPART_FLYBY} lineWidth={2} transparent opacity={0.8} />
          )}
          {flybyPhases.closestApproach && (
            <AnnotationLabel
              position={toTuple(flybyPhases.closestApproach)}
              color="#FFFFFF"
              text={`CA: ${Math.round(flybyPhases.closestApproachKm)} km`}
              offsetY={-14}
            />
          )}
        </>
      )}

      {/* ═══ FREE-RETURN ═══ */}
      {freeReturnPhases && (
        <>
          {freeReturnPhases.approach.length > 2 && (
            <Line points={freeReturnPhases.approach.map(toTuple)} color={COL_APPROACH} lineWidth={2} transparent opacity={0.8} />
          )}
          {freeReturnPhases.nearMoon.length > 2 && (
            <Line points={freeReturnPhases.nearMoon.map(toTuple)} color={COL_NEARMOON} lineWidth={3.5} transparent opacity={0.9} />
          )}
          {freeReturnPhases.departure.length > 2 && (
            <Line points={freeReturnPhases.departure.map(toTuple)} color={COL_RETURN} lineWidth={2} transparent opacity={0.8} />
          )}
          {freeReturnPhases.closestApproach && (
            <AnnotationLabel
              position={toTuple(freeReturnPhases.closestApproach)}
              color="#FFFFFF"
              text={`CA: ${Math.round(freeReturnPhases.closestApproachKm)} km`}
              offsetY={-14}
            />
          )}
          {freeReturnPhases.earthReturn && (
            <AnnotationLabel
              position={toTuple(freeReturnPhases.earthReturn)}
              color="#60A5FA"
              text="Re-entry"
              offsetY={12}
            />
          )}
        </>
      )}

      {/* Moon's orbit ring (dashed, background) */}
      {useMemo(() => {
        const pts: [number, number, number][] = []
        for (let i = 0; i <= 100; i++) {
          const theta = (i / 100) * 2 * Math.PI
          pts.push([moonPos * Math.cos(theta), 0, moonPos * Math.sin(theta)])
        }
        return (
          <Line
            points={pts}
            color="#6B7280"
            lineWidth={0.5}
            transparent
            opacity={0.2}
            dashed
            dashSize={0.03}
            gapSize={0.02}
          />
        )
      }, [moonPos])}

      <OrbitControls
        enablePan={false}
        enableZoom
        enableRotate
        minDistance={0.3}
        maxDistance={10}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  )
}
