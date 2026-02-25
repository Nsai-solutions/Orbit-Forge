import * as THREE from 'three'

// Module-level shared refs — no React context, no provider wrapper needed.
// SatelliteMarker writes these in useFrame; overlay components read them in their own useFrame.
// Safe because there's only one satellite instance and all access is within the same animation frame.
export const sharedSatellitePosition = new THREE.Vector3()
export const sharedSatellitePhase = { current: 0 }
