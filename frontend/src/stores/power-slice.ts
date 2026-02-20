import { StateCreator } from 'zustand'
import { PowerSubsystem, DEFAULT_SUBSYSTEMS } from '@/lib/power-budget'

export interface PowerSlice {
  subsystems: PowerSubsystem[]
  degradationRate: number  // % per year, e.g. 0.03 = 3%
  addSubsystem: (sub: PowerSubsystem) => void
  removeSubsystem: (id: string) => void
  updateSubsystem: (id: string, partial: Partial<PowerSubsystem>) => void
  setDegradationRate: (rate: number) => void
  setSubsystems: (subs: PowerSubsystem[]) => void
  resetSubsystems: () => void
}

export const createPowerSlice: StateCreator<PowerSlice, [], [], PowerSlice> = (set) => ({
  subsystems: [...DEFAULT_SUBSYSTEMS],
  degradationRate: 0.03,

  addSubsystem: (sub) =>
    set((s) => ({ subsystems: [...s.subsystems, sub] })),

  removeSubsystem: (id) =>
    set((s) => ({ subsystems: s.subsystems.filter((sub) => sub.id !== id) })),

  updateSubsystem: (id, partial) =>
    set((s) => ({
      subsystems: s.subsystems.map((sub) =>
        sub.id === id ? { ...sub, ...partial } : sub
      ),
    })),

  setDegradationRate: (rate) => set({ degradationRate: rate }),

  setSubsystems: (subs) => set({ subsystems: subs }),

  resetSubsystems: () => set({ subsystems: [...DEFAULT_SUBSYSTEMS] }),
})
