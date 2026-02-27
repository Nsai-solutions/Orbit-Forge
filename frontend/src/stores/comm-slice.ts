import { StateCreator } from 'zustand'
import { CommConfig, DEFAULT_COMM_CONFIG } from '@/lib/link-budget'

export interface CommSlice {
  commConfig: CommConfig
  selectedPassIndex: number | null
  updateCommConfig: (partial: Partial<CommConfig>) => void
  setCommConfig: (config: CommConfig) => void
  setSelectedPassIndex: (index: number | null) => void
  resetCommConfig: () => void
}

export const createCommSlice: StateCreator<CommSlice, [], [], CommSlice> = (set) => ({
  commConfig: DEFAULT_COMM_CONFIG,
  selectedPassIndex: null,

  updateCommConfig: (partial) =>
    set((s) => ({ commConfig: { ...s.commConfig, ...partial } })),

  setCommConfig: (config) => set({ commConfig: config }),

  setSelectedPassIndex: (index) => set({ selectedPassIndex: index }),

  resetCommConfig: () => set({ commConfig: DEFAULT_COMM_CONFIG }),
})
