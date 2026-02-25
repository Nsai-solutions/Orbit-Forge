import { StateCreator } from 'zustand'

export const SIM_SPEED_PRESETS = [1, 10, 50, 100, 500, 1000] as const

export interface SimulationSlice {
  simTime: number          // ms since Unix epoch (0 = uninitialized)
  simSpeed: number         // multiplier: 1 = real-time
  simPlaying: boolean
  setSimTime: (time: number) => void
  setSimSpeed: (speed: number) => void
  toggleSimPlaying: () => void
  setSimPlaying: (playing: boolean) => void
  resetSimulation: () => void
}

export const createSimulationSlice: StateCreator<SimulationSlice, [], [], SimulationSlice> = (set) => ({
  simTime: 0,
  simSpeed: 100,
  simPlaying: false,

  setSimTime: (time) => set({ simTime: time }),
  setSimSpeed: (speed) => set({ simSpeed: speed }),
  toggleSimPlaying: () => set((s) => ({ simPlaying: !s.simPlaying })),
  setSimPlaying: (playing) => set({ simPlaying: playing }),
  resetSimulation: () => set({ simPlaying: false, simTime: 0 }),
})
