import { StateCreator } from 'zustand'
import type { GroundStation } from '@/types/ground-station'
import { DEFAULT_GROUND_STATIONS } from '@/data/ground-stations'

export interface GroundSlice {
  groundStations: GroundStation[]
  addGroundStation: (station: GroundStation) => void
  removeGroundStation: (id: string) => void
  updateGroundStation: (id: string, partial: Partial<GroundStation>) => void
  toggleStationActive: (id: string) => void
  setGroundStations: (stations: GroundStation[]) => void
  resetGroundStations: () => void
}

export const createGroundSlice: StateCreator<GroundSlice, [], [], GroundSlice> = (set) => ({
  groundStations: DEFAULT_GROUND_STATIONS,

  addGroundStation: (station) =>
    set((s) => ({ groundStations: [...s.groundStations, station] })),

  removeGroundStation: (id) =>
    set((s) => ({ groundStations: s.groundStations.filter((gs) => gs.id !== id) })),

  updateGroundStation: (id, partial) =>
    set((s) => ({
      groundStations: s.groundStations.map((gs) =>
        gs.id === id ? { ...gs, ...partial } : gs
      ),
    })),

  toggleStationActive: (id) =>
    set((s) => ({
      groundStations: s.groundStations.map((gs) =>
        gs.id === id ? { ...gs, active: !gs.active } : gs
      ),
    })),

  setGroundStations: (stations) => set({ groundStations: stations }),

  resetGroundStations: () => set({ groundStations: DEFAULT_GROUND_STATIONS }),
})
