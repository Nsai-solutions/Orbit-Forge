import { StateCreator } from 'zustand'
import type { ChatMessage, MissionSummarySection } from '@/types/architect'

export interface ArchitectVisualization {
  template: 'leo-orbit' | 'leo-with-stations' | 'constellation' | 'ground-coverage'
  params: {
    altitude_km: number
    inclination_deg: number
    stations?: { name: string; lat: number; lon: number }[]
    num_planes?: number
    sats_per_plane?: number
    swath_width_km?: number
  }
}

export interface ArchitectSlice {
  architectMessages: ChatMessage[]
  architectIsStreaming: boolean
  architectError: string | null
  architectSummary: MissionSummarySection[] | null
  architectVisualization: ArchitectVisualization | null

  addArchitectMessage: (msg: ChatMessage) => void
  updateArchitectMessage: (id: string, partial: Partial<ChatMessage>) => void
  setArchitectStreaming: (streaming: boolean) => void
  setArchitectError: (error: string | null) => void
  setArchitectSummary: (summary: MissionSummarySection[] | null) => void
  setArchitectVisualization: (viz: ArchitectVisualization | null) => void
  clearArchitectSession: () => void
}

export const createArchitectSlice: StateCreator<ArchitectSlice, [], [], ArchitectSlice> = (set) => ({
  architectMessages: [],
  architectIsStreaming: false,
  architectError: null,
  architectSummary: null,
  architectVisualization: null,

  addArchitectMessage: (msg) =>
    set((s) => ({ architectMessages: [...s.architectMessages, msg] })),

  updateArchitectMessage: (id, partial) =>
    set((s) => ({
      architectMessages: s.architectMessages.map((m) =>
        m.id === id ? { ...m, ...partial } : m
      ),
    })),

  setArchitectStreaming: (streaming) =>
    set({ architectIsStreaming: streaming }),

  setArchitectError: (error) =>
    set({ architectError: error }),

  setArchitectSummary: (summary) =>
    set({ architectSummary: summary }),

  setArchitectVisualization: (viz) =>
    set({ architectVisualization: viz }),

  clearArchitectSession: () =>
    set({
      architectMessages: [],
      architectIsStreaming: false,
      architectError: null,
      architectSummary: null,
      architectVisualization: null,
    }),
})
