import type { StateCreator } from 'zustand'

export interface ImagingTarget {
  id: string
  name: string
  lat: number
  lon: number
  active: boolean
}

export interface EOPlanningSlice {
  eoTargets: ImagingTarget[]
  isPlacingTarget: boolean

  addEOTarget: (target: ImagingTarget) => void
  removeEOTarget: (id: string) => void
  updateEOTarget: (id: string, partial: Partial<ImagingTarget>) => void
  toggleEOTargetActive: (id: string) => void
  setIsPlacingTarget: (v: boolean) => void
  clearEOTargets: () => void
}

export const createEOPlanningSlice: StateCreator<EOPlanningSlice, [], [], EOPlanningSlice> = (set) => ({
  eoTargets: [],
  isPlacingTarget: false,

  addEOTarget: (target) =>
    set((s) => ({ eoTargets: [...s.eoTargets, target] })),

  removeEOTarget: (id) =>
    set((s) => ({ eoTargets: s.eoTargets.filter((t) => t.id !== id) })),

  updateEOTarget: (id, partial) =>
    set((s) => ({
      eoTargets: s.eoTargets.map((t) => (t.id === id ? { ...t, ...partial } : t)),
    })),

  toggleEOTargetActive: (id) =>
    set((s) => ({
      eoTargets: s.eoTargets.map((t) => (t.id === id ? { ...t, active: !t.active } : t)),
    })),

  setIsPlacingTarget: (v) => set({ isPlacingTarget: v }),

  clearEOTargets: () => set({ eoTargets: [], isPlacingTarget: false }),
})
