import { useEffect, useRef } from 'react'
import { useStore } from '@/stores'

/**
 * Watches orbital elements, propagation mode, perturbation config, and spacecraft props.
 * Re-runs numerical propagation when any dependency changes (if not in keplerian mode).
 * Should be called once from EarthScene.tsx.
 */
export function usePropagationSync() {
  const elements = useStore((s) => s.elements)
  const orbitEpoch = useStore((s) => s.orbitEpoch)
  const propagationMode = useStore((s) => s.propagationMode)
  const perturbationConfig = useStore((s) => s.perturbationConfig)
  const spacecraftProps = useStore((s) => s.spacecraftProps)
  const numOrbits = useStore((s) => s.numOrbits)
  const runPropagation = useStore((s) => s.runPropagation)

  const isInitial = useRef(true)

  useEffect(() => {
    if (isInitial.current) {
      isInitial.current = false
      // On mount, propagate if numerical mode was persisted
      if (propagationMode !== 'keplerian') {
        runPropagation(elements, orbitEpoch.getTime())
      }
      return
    }
    if (propagationMode === 'keplerian') return
    runPropagation(elements, orbitEpoch.getTime())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elements, orbitEpoch, propagationMode, perturbationConfig, spacecraftProps, numOrbits])
}
