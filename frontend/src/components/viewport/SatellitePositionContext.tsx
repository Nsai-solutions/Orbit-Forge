import { createContext, useContext, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import * as THREE from 'three'

interface SatellitePositionContextValue {
  /** Current satellite 3D position in ECEF-aligned Three.js coords (updated every frame by SatelliteMarker) */
  positionRef: React.MutableRefObject<THREE.Vector3>
  /** Current orbit phase 0-1 (updated every frame by SatelliteMarker) */
  phaseRef: React.MutableRefObject<number>
}

const SatellitePositionContext = createContext<SatellitePositionContextValue | null>(null)

export function SatellitePositionProvider({ children }: { children: ReactNode }) {
  const positionRef = useRef(new THREE.Vector3())
  const phaseRef = useRef(0)
  // Memoize to prevent consumer re-renders when parent re-renders
  const value = useMemo(() => ({ positionRef, phaseRef }), [])
  return (
    <SatellitePositionContext.Provider value={value}>
      {children}
    </SatellitePositionContext.Provider>
  )
}

export function useSatellitePosition() {
  const ctx = useContext(SatellitePositionContext)
  if (!ctx) throw new Error('useSatellitePosition must be used inside SatellitePositionProvider')
  return ctx
}
