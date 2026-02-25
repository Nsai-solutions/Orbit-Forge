import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useStore } from '@/stores'
import { propagateOrbitPositions } from '@/lib/orbital-mechanics'
import { dateToGMST } from '@/lib/time-utils'

export default function SimulationClock() {
  const lastGmstRef = useRef<number | null>(null)
  const lastEpochMsRef = useRef(0)

  useFrame((_, delta) => {
    const state = useStore.getState()
    const {
      simPlaying, simSpeed, simTime,
      setSimTime,
      orbitEpoch, elements,
      setOrbitPositionsForSim,
    } = state

    const currentEpochMs = orbitEpoch.getTime()

    // Initialize simTime on first frame or when orbitEpoch changes (user changed elements/preset)
    if (simTime === 0 || lastEpochMsRef.current !== currentEpochMs) {
      lastEpochMsRef.current = currentEpochMs
      setSimTime(currentEpochMs)
      lastGmstRef.current = null
      return
    }

    if (!simPlaying) return

    // Advance simTime — clamp delta to prevent huge jumps when tab is backgrounded
    const clampedDelta = Math.min(delta, 0.1)
    const newSimTime = simTime + clampedDelta * 1000 * simSpeed
    setSimTime(newSimTime)

    // Throttled orbit ring recomputation: only when GMST changes by >0.001 rad (~14s real time)
    const currentGmst = dateToGMST(new Date(newSimTime))

    if (lastGmstRef.current === null) {
      lastGmstRef.current = currentGmst
    }

    // Angular difference handling 0/2π wrap
    let gmstDiff = currentGmst - lastGmstRef.current
    if (gmstDiff > Math.PI) gmstDiff -= 2 * Math.PI
    if (gmstDiff < -Math.PI) gmstDiff += 2 * Math.PI

    if (Math.abs(gmstDiff) > 0.001) {
      const newPositions = propagateOrbitPositions(elements, 180, new Date(newSimTime))
      setOrbitPositionsForSim(newPositions)
      lastGmstRef.current = currentGmst
    }
  })

  return null
}
