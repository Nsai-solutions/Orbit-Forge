import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import { useStore } from '@/stores'
import { geodeticToThreeJS } from '@/lib/coordinate-transforms'

export default function GroundStationMarkers() {
  const groundStations = useStore((s) => s.groundStations)

  // Memoize active stations and their positions to avoid recomputing every render
  const stationData = useMemo(() => {
    return groundStations
      .filter((gs) => gs.active)
      .map((station) => ({
        ...station,
        pos: geodeticToThreeJS(station.lat, station.lon, 1.003),
      }))
  }, [groundStations])

  return (
    <group>
      {stationData.map((station) => (
        <group key={station.id} position={[station.pos.x, station.pos.y, station.pos.z]}>
          {/* Station marker */}
          <mesh>
            <sphereGeometry args={[0.008, 6, 6]} />
            <meshBasicMaterial color="#10B981" />
          </mesh>

          {/* Glow ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.01, 0.015, 12]} />
            <meshBasicMaterial
              color="#10B981"
              transparent
              opacity={0.4}
              side={2}
            />
          </mesh>

          {/* Label — occlude hides it when behind the Earth */}
          <Html
            center
            occlude
            style={{ pointerEvents: 'none', userSelect: 'none' }}
            distanceFactor={6}
            position={[0, 0.03, 0]}
          >
            <div className="whitespace-nowrap bg-space-800/90 border border-accent-green/30 rounded px-1.5 py-0.5 text-[9px] font-mono text-accent-green">
              {station.name}
            </div>
          </Html>
        </group>
      ))}
    </group>
  )
}
