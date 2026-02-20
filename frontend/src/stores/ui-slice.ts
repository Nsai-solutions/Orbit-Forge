import { StateCreator } from 'zustand'
import { ModuleId } from '@/types'

export interface UISlice {
  activeModule: ModuleId
  bottomPanelExpanded: boolean
  bottomPanelHeight: number
  setActiveModule: (id: ModuleId) => void
  toggleBottomPanel: () => void
  setBottomPanelExpanded: (expanded: boolean) => void
  setBottomPanelHeight: (height: number) => void
}

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  activeModule: ModuleId.OrbitDesign,
  bottomPanelExpanded: true,
  bottomPanelHeight: 280,
  setActiveModule: (id) => set({ activeModule: id }),
  toggleBottomPanel: () => set((s) => ({ bottomPanelExpanded: !s.bottomPanelExpanded })),
  setBottomPanelExpanded: (expanded) => set({ bottomPanelExpanded: expanded }),
  setBottomPanelHeight: (height) => set({ bottomPanelHeight: Math.max(120, Math.min(800, height)) }),
})
