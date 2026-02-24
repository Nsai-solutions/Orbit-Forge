import { StateCreator } from 'zustand'
import type { ChatMessage, MissionSummarySection } from '@/types/architect'

export type ArchitectVizTemplate =
  // LEO templates
  | 'leo-orbit' | 'leo-with-stations' | 'constellation' | 'ground-coverage'
  // Lagrange templates
  | 'lagrange-halo' | 'lagrange-lissajous' | 'lagrange-lyapunov' | 'lagrange-transfer-only'
  // Lunar templates
  | 'lunar-orbit-insertion' | 'lunar-flyby' | 'lunar-free-return' | 'lunar-landing'
  // Interplanetary templates
  | 'interplanetary-hohmann' | 'interplanetary-flyby' | 'interplanetary-with-capture' | 'interplanetary-porkchop'

export interface ArchitectVisualization {
  template: ArchitectVizTemplate
  params: {
    // LEO params
    altitude_km?: number
    inclination_deg?: number
    stations?: { name: string; lat: number; lon: number }[]
    num_planes?: number
    sats_per_plane?: number
    swath_width_km?: number
    // Lagrange params
    system?: string
    l_point?: number
    orbit_type?: string
    amplitude_km?: number
    // Lunar params
    mission_type?: string
    lunar_orbit_alt_km?: number
    closest_approach_km?: number
    // Interplanetary params
    target_body?: string
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
