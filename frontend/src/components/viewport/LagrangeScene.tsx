import { useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls, Line, Html } from '@react-three/drei'
import { useStore } from '@/stores'
import Starfield from './Starfield'
import { computeLagrangeDistance, generateOrbitPoints, generateTransferArc } from '@/lib/lagrange'
import { AU_KM, MOON_SEMI_MAJOR_AXIS } from '@/lib/beyond-leo-constants'
import type { LagrangePoint } from '@/types/beyond-leo'

const POINT_COLORS: Record<string, string> = {
  L1: '#3B82F6',
  L2: '#10B981',
  L3: '#F59E0B',
  L4: '#8B5CF6',
  L5: '#EC4899',
}

function LPointMarker({ position, label, color }: { position: [number, number, number]; label: string; color: string }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.025, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} depthWrite={false} />
      </mesh>
      <Html center style={{ pointerEvents: 'none', transform: 'translateY(-14px)' }}>
        <div style={{
          color,
          fontSize: '9px',
          fontFamily: 'ui-monospace, monospace',
          fontWeight: 600,
          padding: '1px 3px',
          borderRadius: '2px',
          background: 'rgba(0,0,0,0.45)',
          whiteSpace: 'nowrap',
          lineHeight: 1,
        }}>
          {label}
        </div>
      </Html>
    </group>
  )
}

export default function LagrangeScene() {
  const params = useStore((s) => s.beyondLeo.lagrangeParams)
  const { camera } = useThree()

  const systemDist = params.system === 'SE' ? AU_KM : MOON_SEMI_MAJOR_AXIS

  // Body/marker sizes (needed before useMemo for L-point offset clamping)
  const secondarySize = params.system === 'SE' ? 0.03 : 0.015
  const markerHaloRadius = 0.025
  const minLPointOffset = secondarySize + markerHaloRadius + 0.025

  // Compute L-point positions in normalized coords
  const lPointPositions = useMemo(() => {
    const points: { point: LagrangePoint; pos: [number, number, number] }[] = []
    const allPoints: LagrangePoint[] = ['L1', 'L2', 'L3', 'L4', 'L5']

    for (const pt of allPoints) {
      const dist = computeLagrangeDistance(params.system, pt)

      let x = 0, y = 0
      if (pt === 'L1') {
        x = 1 - dist / systemDist // between bodies
      } else if (pt === 'L2') {
        x = 1 + dist / systemDist // beyond secondary
      } else if (pt === 'L3') {
        x = -1
      } else if (pt === 'L4') {
        x = 0.5
        y = Math.sqrt(3) / 2
      } else {
        x = 0.5
        y = -Math.sqrt(3) / 2
      }

      // Enforce minimum visual separation for L1/L2 from the secondary body
      if (pt === 'L1' || pt === 'L2') {
        const rawOffset = Math.abs(x - 1)
        if (rawOffset < minLPointOffset) {
          const sign = pt === 'L1' ? -1 : 1
          x = 1 + sign * minLPointOffset
        }
      }

      points.push({ point: pt, pos: [x, 0, y] })
    }
    return points
  }, [params.system, systemDist, minLPointOffset])

  // Orbit points (shape depends on orbit type)
  const orbitPoints = useMemo(() => {
    const pts = generateOrbitPoints(params.system, params.point, params.amplitudeKm, params.orbitType)
    return pts.map((p) => [p.x, p.z, p.y] as [number, number, number])
  }, [params.system, params.point, params.amplitudeKm, params.orbitType])

  // Transfer arc
  const transferPoints = useMemo(() => {
    const pts = generateTransferArc(params.system, params.point)
    return pts.map((p) => [p.x, p.z, p.y] as [number, number, number])
  }, [params.system, params.point])

  // Set camera for scene
  useMemo(() => {
    camera.position.set(0, 3, 2)
    camera.lookAt(0.5, 0, 0)
  }, [params.system])

  const primaryLabel = params.system === 'SE' ? 'Sun' : 'Earth'
  const secondaryLabel = params.system === 'SE' ? 'Earth' : 'Moon'
  const primaryColor = params.system === 'SE' ? '#FDB813' : '#3B82F6'
  const secondaryColor = params.system === 'SE' ? '#3B82F6' : '#9CA3AF'
  const primarySize = params.system === 'SE' ? 0.06 : 0.04

  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 3, 5]} intensity={1} />
      <Starfield />

      {/* Primary body at origin */}
      <group position={[0, 0, 0]}>
        <mesh>
          <sphereGeometry args={[primarySize, 32, 32]} />
          <meshStandardMaterial color={primaryColor} emissive={primaryColor} emissiveIntensity={0.5} />
        </mesh>
        <Html center style={{ pointerEvents: 'none', transform: 'translateY(16px)' }}>
          <div style={{
            fontSize: '10px',
            fontFamily: 'ui-monospace, monospace',
            fontWeight: 700,
            color: primaryColor,
            padding: '1px 4px',
            borderRadius: '2px',
            background: 'rgba(0,0,0,0.4)',
            whiteSpace: 'nowrap',
            lineHeight: 1,
          }}>
            {primaryLabel}
          </div>
        </Html>
      </group>

      {/* Secondary body at x=1 */}
      <group position={[1, 0, 0]}>
        <mesh>
          <sphereGeometry args={[secondarySize, 16, 16]} />
          <meshStandardMaterial color={secondaryColor} />
        </mesh>
        <Html center style={{ pointerEvents: 'none', transform: 'translateY(14px)' }}>
          <div style={{
            fontSize: '10px',
            fontFamily: 'ui-monospace, monospace',
            fontWeight: 700,
            color: secondaryColor,
            padding: '1px 4px',
            borderRadius: '2px',
            background: 'rgba(0,0,0,0.4)',
            whiteSpace: 'nowrap',
            lineHeight: 1,
          }}>
            {secondaryLabel}
          </div>
        </Html>
      </group>

      {/* L-point markers */}
      {lPointPositions.map(({ point, pos }) => (
        <LPointMarker
          key={point}
          position={pos}
          label={`${params.system}-${point}`}
          color={POINT_COLORS[point]}
        />
      ))}

      {/* Orbit at L-point */}
      {orbitPoints.length > 2 && (
        <Line
          points={orbitPoints}
          color={POINT_COLORS[params.point]}
          lineWidth={1.5}
          transparent
          opacity={0.8}
        />
      )}

      {/* Transfer arc */}
      {transferPoints.length > 2 && (
        <Line
          points={transferPoints}
          color="#F59E0B"
          lineWidth={1}
          transparent
          opacity={0.6}
          dashed
          dashSize={0.02}
          gapSize={0.01}
        />
      )}

      <OrbitControls
        enablePan={false}
        enableZoom
        enableRotate
        minDistance={0.5}
        maxDistance={15}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  )
}
