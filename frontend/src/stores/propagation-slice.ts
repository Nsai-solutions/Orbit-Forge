import { StateCreator } from 'zustand'
import type {
  PropagationMode, PerturbationConfig, SpacecraftProps, TrajectoryPoint,
} from '@/lib/numerical-propagator'
import { propagateNumerical, configForMode } from '@/lib/numerical-propagator'
import type { OrbitalElements } from '@/types/orbit'

export interface PropagationSlice {
  propagationMode: PropagationMode
  perturbationConfig: PerturbationConfig
  spacecraftProps: SpacecraftProps
  propagatedTrajectory: TrajectoryPoint[]
  propagationEpochMs: number
  numOrbits: number
  dtSec: number
  isPropagating: boolean

  setPropagationMode: (mode: PropagationMode) => void
  setPerturbationConfig: (config: Partial<PerturbationConfig>) => void
  setSpacecraftProps: (props: Partial<SpacecraftProps>) => void
  setNumOrbits: (n: number) => void
  runPropagation: (elements: OrbitalElements, epochMs: number) => void
  clearTrajectory: () => void
}

const DEFAULT_PERTURBATION_CONFIG: PerturbationConfig = {
  j2: true,
  j3j6: false,
  drag: true,
  srp: false,
  thirdBodyMoon: false,
  thirdBodySun: false,
}

const DEFAULT_SPACECRAFT_PROPS: SpacecraftProps = {
  cd: 2.2,
  cr: 1.2,
  area: 0.01,  // m^2 (3U CubeSat cross-section)
  mass: 4.0,   // kg
}

export const createPropagationSlice: StateCreator<PropagationSlice, [], [], PropagationSlice> = (set, get) => ({
  propagationMode: 'keplerian',
  perturbationConfig: DEFAULT_PERTURBATION_CONFIG,
  spacecraftProps: DEFAULT_SPACECRAFT_PROPS,
  propagatedTrajectory: [],
  propagationEpochMs: 0,
  numOrbits: 10,
  dtSec: 30,
  isPropagating: false,

  setPropagationMode: (mode) => {
    const config = mode === 'numerical-full'
      ? { ...get().perturbationConfig }
      : configForMode(mode)
    set({ propagationMode: mode, perturbationConfig: config })
  },

  setPerturbationConfig: (partial) =>
    set((s) => ({ perturbationConfig: { ...s.perturbationConfig, ...partial } })),

  setSpacecraftProps: (partial) =>
    set((s) => ({ spacecraftProps: { ...s.spacecraftProps, ...partial } })),

  setNumOrbits: (n) => set({ numOrbits: n }),

  runPropagation: (elements, epochMs) => {
    const { propagationMode, perturbationConfig, spacecraftProps, numOrbits, dtSec } = get()
    if (propagationMode === 'keplerian') {
      set({ propagatedTrajectory: [], propagationEpochMs: 0 })
      return
    }
    set({ isPropagating: true })
    const trajectory = propagateNumerical(
      elements, epochMs, numOrbits, dtSec, perturbationConfig, spacecraftProps,
    )
    set({ propagatedTrajectory: trajectory, propagationEpochMs: epochMs, isPropagating: false })
  },

  clearTrajectory: () => set({ propagatedTrajectory: [], propagationEpochMs: 0 }),
})
