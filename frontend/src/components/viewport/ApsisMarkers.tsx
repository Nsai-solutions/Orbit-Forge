import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import { useStore } from '@/stores'
import { keplerianToCartesian, eciToEcefThreeJS } from '@/lib/coordinate-transforms'
import { MU_EARTH_KM, R_EARTH_EQUATORIAL } from '@/lib/constants'
import { dateToGMST } from '@/lib/time-utils'

export default function ApsisMarkers() {
  const elements = useStore((s) => s.elements)
  const orbitEpoch = useStore((s) => s.orbitEpoch)

  const markers = useMemo(() => {
    const gmst = dateToGMST(orbitEpoch)

    // Perigee is at true anomaly = 0
    const perigeeElements = { ...elements, trueAnomaly: 0 }
    const { position: perigeeEci } = keplerianToCartesian(perigeeElements, MU_EARTH_KM)
    const perigee = eciToEcefThreeJS(perigeeEci, gmst)
    const perigeeAlt = elements.semiMajorAxis * (1 - elements.eccentricity) - R_EARTH_EQUATORIAL

    // Apogee is at true anomaly = 180
    const apogeeElements = { ...elements, trueAnomaly: 180 }
    const { position: apogeeEci } = keplerianToCartesian(apogeeElements, MU_EARTH_KM)
    const apogee = eciToEcefThreeJS(apogeeEci, gmst)
    const apogeeAlt = elements.semiMajorAxis * (1 + elements.eccentricity) - R_EARTH_EQUATORIAL

    return { perigee, apogee, perigeeAlt, apogeeAlt }
  }, [elements, orbitEpoch])

  // Only show if orbit has meaningful eccentricity
  if (elements.eccentricity < 0.005) return null

  return (
    <>
      {/* Perigee marker */}
      <group position={[markers.perigee.x, markers.perigee.y, markers.perigee.z]}>
        <mesh>
          <sphereGeometry args={[0.012, 6, 6]} />
          <meshBasicMaterial color="#10B981" />
        </mesh>
        <Html
          center
          occlude
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <div className="whitespace-nowrap bg-space-800/90 border border-accent-green/30 rounded font-mono text-accent-green" style={{ fontSize: '9px', padding: '2px 6px' }}>
            Pe {markers.perigeeAlt.toFixed(0)} km
          </div>
        </Html>
      </group>

      {/* Apogee marker */}
      <group position={[markers.apogee.x, markers.apogee.y, markers.apogee.z]}>
        <mesh>
          <sphereGeometry args={[0.012, 6, 6]} />
          <meshBasicMaterial color="#F59E0B" />
        </mesh>
        <Html
          center
          occlude
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <div className="whitespace-nowrap bg-space-800/90 border border-accent-amber/30 rounded font-mono text-accent-amber" style={{ fontSize: '9px', padding: '2px 6px' }}>
            Ap {markers.apogeeAlt.toFixed(0)} km
          </div>
        </Html>
      </group>
    </>
  )
}
