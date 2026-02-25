import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useStore } from '@/stores'
import { getSatellitePosition } from '@/lib/orbital-mechanics'
import { keplerianToCartesian, eciToEcef, ecefToGeodetic } from '@/lib/coordinate-transforms'
import { MU_EARTH_KM } from '@/lib/constants'
import { dateToGMST } from '@/lib/time-utils'
import { sharedSatellitePosition, sharedSatellitePhase } from './SatellitePositionContext'
import * as THREE from 'three'

export default function SatelliteMarker() {
  const groupRef = useRef<THREE.Group>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const phaseRef = useRef(0)
  const subPointTimer = useRef(0)

  // Read elements once — re-reads on store change via selector
  const elements = useStore((s) => s.elements)
  const orbitEpoch = useStore((s) => s.orbitEpoch)
  const setSatSubPoint = useStore((s) => s.setSatSubPoint)

  useFrame((_, delta) => {
    if (!groupRef.current) return

    // Advance satellite along orbit using local ref (no Zustand state update)
    const speed = 0.02
    phaseRef.current = (phaseRef.current + speed * delta) % 1

    // Compute position using the same epoch as the orbit ring (prevents GMST drift)
    const trueAnomaly = phaseRef.current * 360
    const pos = getSatellitePosition({ ...elements, trueAnomaly }, orbitEpoch)
    groupRef.current.position.set(pos.x, pos.y, pos.z)

    // Write to shared module-level refs for overlay components
    sharedSatellitePosition.set(pos.x, pos.y, pos.z)
    sharedSatellitePhase.current = phaseRef.current

    // Update subsatellite point for 2D ground track sync (~5Hz to avoid perf issues)
    subPointTimer.current += delta
    if (subPointTimer.current > 0.2) {
      subPointTimer.current = 0
      const gmst = dateToGMST(orbitEpoch)
      const { position: eciPos } = keplerianToCartesian({ ...elements, trueAnomaly }, MU_EARTH_KM)
      const ecef = eciToEcef(eciPos, gmst)
      const geo = ecefToGeodetic(ecef)
      setSatSubPoint({ lat: geo.lat, lon: geo.lon })
    }

    // Pulse the glow
    if (glowRef.current) {
      const scale = 1 + 0.2 * Math.sin(Date.now() * 0.003)
      glowRef.current.scale.setScalar(scale)
    }
  })

  return (
    <group ref={groupRef}>
      {/* Core satellite dot */}
      <mesh>
        <sphereGeometry args={[0.015, 8, 8]} />
        <meshBasicMaterial color="#F9FAFB" />
      </mesh>

      {/* Glow */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial
          color="#3B82F6"
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
