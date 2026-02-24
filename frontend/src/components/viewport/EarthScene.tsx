import { Suspense, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
// Bloom disabled for performance — can re-enable later
// import { EffectComposer, Bloom } from '@react-three/postprocessing'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import { useStore } from '@/stores'
import Earth from './Earth'
import Atmosphere from './Atmosphere'
import Starfield from './Starfield'
import SunLight from './SunLight'
import OrbitLine from './OrbitLine'
import SatelliteMarker from './SatelliteMarker'
import ApsisMarkers from './ApsisMarkers'
import GroundTrack from './GroundTrack'
import CoordinateGrid from './CoordinateGrid'
import GroundStationMarkers from './GroundStationMarker'
import { SatellitePositionProvider } from './SatellitePositionContext'
import StationVisibilityCones from './StationVisibilityCone'
import PayloadFootprint from './PayloadFootprint'

function AdaptiveControls() {
  const controlsRef = useRef<OrbitControlsType>(null)
  const { camera } = useThree()

  // Adjust rotation speed based on zoom distance for finer control when close
  useFrame(() => {
    if (controlsRef.current) {
      const dist = camera.position.length()
      // Slower rotation when zoomed in, faster when zoomed out
      controlsRef.current.rotateSpeed = Math.max(0.15, Math.min(0.6, (dist - 1.2) * 0.25))
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableZoom={true}
      enableRotate={true}
      zoomSpeed={0.8}
      rotateSpeed={0.4}
      minDistance={1.2}
      maxDistance={25}
      enableDamping
      dampingFactor={0.08}
      // Smooth zoom with no discrete steps
      zoomToCursor={false}
      // Prevent flipping upside down
      minPolarAngle={0.1}
      maxPolarAngle={Math.PI - 0.1}
      makeDefault
    />
  )
}

export default function EarthScene() {
  const overlayToggles = useStore((s) => s.overlayToggles)

  return (
    <>
      <SunLight />

      <Suspense fallback={null}>
        <Earth />
        <Atmosphere />
        <Starfield />
      </Suspense>

      {/* Overlays on globe */}
      <CoordinateGrid />
      <GroundTrack />
      <GroundStationMarkers />

      <SatellitePositionProvider>
        {/* Orbit visualization */}
        <OrbitLine />
        <SatelliteMarker />
        <ApsisMarkers />

        {/* Visibility & footprint overlays */}
        <StationVisibilityCones
          showCones={overlayToggles.stationCoverage}
          showCommLinks={overlayToggles.commLinks}
        />
        <PayloadFootprint showFootprint={overlayToggles.sensorFootprint} />
      </SatellitePositionProvider>

      <AdaptiveControls />
    </>
  )
}
