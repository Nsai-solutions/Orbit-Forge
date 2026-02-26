import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useStore } from '@/stores'
import {
  computeOrbitalPeriod,
  solveKeplerEquation,
  eccentricToTrueAnomaly,
  trueToMeanAnomaly,
} from '@/lib/orbital-mechanics'
import { keplerianToCartesian, eciToEcefThreeJS, eciToEcef, ecefToGeodetic } from '@/lib/coordinate-transforms'
import { MU_EARTH_KM, DEG2RAD } from '@/lib/constants'
import { dateToGMST } from '@/lib/time-utils'
import { interpolateTrajectory, cartesianToKeplerian } from '@/lib/numerical-propagator'
import { sharedSatellitePosition, sharedSatellitePhase } from './SatellitePositionContext'
import * as THREE from 'three'
import type { Vec3 } from '@/types'
import type { OrbitalElements } from '@/types/orbit'

/** Compute satellite ECI position analytically (Kepler equation) */
function computeAnalyticalPosition(elements: OrbitalElements, dtSec: number): { eciPos: Vec3; nu: number } {
  const period = computeOrbitalPeriod(elements.semiMajorAxis)
  const n = (2 * Math.PI) / period
  const M0 = trueToMeanAnomaly(elements.trueAnomaly * DEG2RAD, elements.eccentricity)
  let M = (M0 + n * dtSec) % (2 * Math.PI)
  if (M < 0) M += 2 * Math.PI

  const E = solveKeplerEquation(M, elements.eccentricity)
  let nu = eccentricToTrueAnomaly(E, elements.eccentricity)
  if (nu < 0) nu += 2 * Math.PI

  const currentElements = { ...elements, trueAnomaly: nu / DEG2RAD }
  const { position: eciPos } = keplerianToCartesian(currentElements, MU_EARTH_KM)
  return { eciPos, nu }
}

export default function SatelliteMarker() {
  const groupRef = useRef<THREE.Group>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const subPointTimer = useRef(0)
  const osculatingTimer = useRef(0)

  useFrame((_, delta) => {
    if (!groupRef.current) return

    const {
      simTime, orbitEpoch, elements, setSatSubPoint,
      propagationMode, propagatedTrajectory, setOsculatingElements,
    } = useStore.getState()
    const effectiveSimTime = simTime || orbitEpoch.getTime()

    let eciPos: Vec3
    let nu = 0

    if (propagationMode !== 'keplerian' && propagatedTrajectory.length > 0) {
      // Numerical mode: interpolate from cached trajectory
      const sv = interpolateTrajectory(propagatedTrajectory, effectiveSimTime)
      if (sv) {
        eciPos = { x: sv.x, y: sv.y, z: sv.z }
        // Approximate phase for shared ref (not critical)
        nu = Math.atan2(sv.y, sv.x)
        if (nu < 0) nu += 2 * Math.PI
      } else {
        // Fallback to analytical if outside trajectory bounds
        const dtSec = (effectiveSimTime - orbitEpoch.getTime()) / 1000
        const result = computeAnalyticalPosition(elements, dtSec)
        eciPos = result.eciPos
        nu = result.nu
      }
    } else {
      // Keplerian mode: analytical computation
      const dtSec = (effectiveSimTime - orbitEpoch.getTime()) / 1000
      const result = computeAnalyticalPosition(elements, dtSec)
      eciPos = result.eciPos
      nu = result.nu
    }

    // ECEF transform using simTime GMST
    const gmst = dateToGMST(new Date(effectiveSimTime))
    const ecef = eciToEcefThreeJS(eciPos, gmst)

    groupRef.current.position.set(ecef.x, ecef.y, ecef.z)

    // Update shared refs for overlay components
    sharedSatellitePosition.set(ecef.x, ecef.y, ecef.z)
    sharedSatellitePhase.current = nu / (2 * Math.PI)

    // Subsatellite point at ~5Hz for 2D ground track sync
    subPointTimer.current += delta
    if (subPointTimer.current > 0.2) {
      subPointTimer.current = 0
      const ecefKm = eciToEcef(eciPos, gmst)
      const geo = ecefToGeodetic(ecefKm)
      setSatSubPoint({ lat: geo.lat, lon: geo.lon })
    }

    // Compute osculating elements from numerical trajectory (~1Hz)
    if (propagationMode !== 'keplerian' && propagatedTrajectory.length > 0) {
      const now = Date.now()
      if (now - osculatingTimer.current > 1000) {
        osculatingTimer.current = now
        const sv = interpolateTrajectory(propagatedTrajectory, effectiveSimTime)
        if (sv) {
          const oscElements = cartesianToKeplerian(sv)
          setOsculatingElements(oscElements)
        }
      }
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
